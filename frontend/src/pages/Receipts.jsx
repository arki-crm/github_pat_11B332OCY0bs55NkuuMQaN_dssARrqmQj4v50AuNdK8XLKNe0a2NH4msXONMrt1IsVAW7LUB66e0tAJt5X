import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { 
  Loader2, 
  Plus,
  Receipt,
  Search,
  Download,
  Eye,
  Ban
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' }
];

const Receipts = () => {
  const { hasPermission } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [newReceipt, setNewReceipt] = useState({
    project_id: '',
    amount: '',
    payment_mode: '',
    account_id: '',
    stage_name: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [receiptsRes, projectsRes, accountsRes] = await Promise.all([
        axios.get(`${API}/finance/receipts`, { withCredentials: true }),
        axios.get(`${API}/finance/project-finance`, { withCredentials: true }),
        axios.get(`${API}/accounting/accounts`, { withCredentials: true })
      ]);
      setReceipts(receiptsRes.data);
      setProjects(projectsRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      console.error('Failed to fetch receipts:', error);
      toast.error('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddReceipt = async () => {
    if (!newReceipt.project_id || !newReceipt.amount || !newReceipt.payment_mode || !newReceipt.account_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post(`${API}/finance/receipts`, {
        project_id: newReceipt.project_id,
        amount: parseFloat(newReceipt.amount),
        payment_mode: newReceipt.payment_mode,
        account_id: newReceipt.account_id,
        stage_name: newReceipt.stage_name || null,
        notes: newReceipt.notes || null
      }, { withCredentials: true });
      
      toast.success(`Receipt ${res.data.receipt_number} created`);
      setIsAddDialogOpen(false);
      setNewReceipt({ project_id: '', amount: '', payment_mode: '', account_id: '', stage_name: '', notes: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create receipt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewReceipt = async (receiptId) => {
    try {
      const res = await axios.get(`${API}/finance/receipts/${receiptId}`, { withCredentials: true });
      setViewReceipt(res.data);
    } catch (error) {
      toast.error('Failed to load receipt details');
    }
  };

  const filteredReceipts = receipts.filter(r => 
    !search || 
    r.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.pid?.toLowerCase().includes(search.toLowerCase()) ||
    r.project_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (!hasPermission('finance.view_receipts')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">You don't have permission to view receipts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen" data-testid="receipts-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Payment Receipts
          </h1>
          <p className="text-slate-500 text-sm mt-1">Record and manage customer payments</p>
        </div>
        {hasPermission('finance.add_receipt') && (
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Receipt
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by receipt number, PID, project..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Receipts List */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="p-8 text-center">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No receipts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Receipt #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Project</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mode</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Account</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredReceipts.map((receipt) => (
                    <tr key={receipt.receipt_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-blue-600">{receipt.receipt_number}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(receipt.payment_date)}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{receipt.pid}</span>
                        <p className="text-sm text-slate-700 mt-0.5">{receipt.project_name}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{receipt.client_name}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-green-600">{formatCurrency(receipt.amount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">{receipt.payment_mode?.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{receipt.account_name}</td>
                      <td className="px-4 py-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => handleViewReceipt(receipt.receipt_id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Receipt Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Payment Receipt</DialogTitle>
            <DialogDescription>
              Create a receipt for incoming customer payment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Project *</Label>
              <Select value={newReceipt.project_id} onValueChange={(v) => setNewReceipt(prev => ({ ...prev, project_id: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.project_id} value={p.project_id}>
                      {p.pid_display} - {p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  value={newReceipt.amount}
                  onChange={(e) => setNewReceipt(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="25000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Payment Mode *</Label>
                <Select value={newReceipt.payment_mode} onValueChange={(v) => setNewReceipt(prev => ({ ...prev, payment_mode: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Account *</Label>
              <Select value={newReceipt.account_id} onValueChange={(v) => setNewReceipt(prev => ({ ...prev, account_id: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.account_id} value={a.account_id}>{a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Stage</Label>
              <Input
                value={newReceipt.stage_name}
                onChange={(e) => setNewReceipt(prev => ({ ...prev, stage_name: e.target.value }))}
                placeholder="e.g., Booking Amount, Design Payment"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={newReceipt.notes}
                onChange={(e) => setNewReceipt(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddReceipt} disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Receipt Dialog */}
      <Dialog open={!!viewReceipt} onOpenChange={(open) => !open && setViewReceipt(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-600" />
              Receipt {viewReceipt?.receipt_number}
            </DialogTitle>
          </DialogHeader>
          {viewReceipt && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-3xl font-bold text-green-600">{formatCurrency(viewReceipt.amount)}</p>
                <p className="text-sm text-green-700 mt-1">Payment Received</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Date</p>
                  <p className="font-medium">{formatDate(viewReceipt.payment_date)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Mode</p>
                  <p className="font-medium capitalize">{viewReceipt.payment_mode?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-slate-500">Account</p>
                  <p className="font-medium">{viewReceipt.account_name}</p>
                </div>
                <div>
                  <p className="text-slate-500">Stage</p>
                  <p className="font-medium">{viewReceipt.stage_name || '-'}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-slate-500 text-sm">Project</p>
                <p className="font-medium">{viewReceipt.project?.pid} - {viewReceipt.project?.project_name}</p>
                <p className="text-sm text-slate-600">{viewReceipt.project?.client_name}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Contract Value</span>
                  <span className="font-medium">{formatCurrency(viewReceipt.project?.contract_value)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Total Received</span>
                  <span className="font-medium text-green-600">{formatCurrency(viewReceipt.total_received)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-slate-700 font-medium">Balance Remaining</span>
                  <span className="font-bold">{formatCurrency(viewReceipt.balance_remaining)}</span>
                </div>
              </div>

              {viewReceipt.notes && (
                <div>
                  <p className="text-slate-500 text-sm">Notes</p>
                  <p className="text-sm">{viewReceipt.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewReceipt(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Receipts;
