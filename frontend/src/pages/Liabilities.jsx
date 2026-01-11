import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Loader2, 
  Plus,
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle,
  DollarSign,
  Building2,
  Calendar,
  Filter,
  Download
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

const LIABILITY_CATEGORIES = [
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'production', label: 'Production' },
  { value: 'installation', label: 'Installation' },
  { value: 'transport', label: 'Transport' },
  { value: 'office', label: 'Office' },
  { value: 'salary', label: 'Salary' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' }
];

const LIABILITY_SOURCES = [
  { value: 'expense_request', label: 'Expense Request' },
  { value: 'vendor_credit', label: 'Vendor Credit' },
  { value: 'manual', label: 'Manual Entry' }
];

export default function Liabilities() {
  const [liabilities, setLiabilities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [selectedLiability, setSelectedLiability] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterProject, setFilterProject] = useState('');
  
  // Create form
  const [createForm, setCreateForm] = useState({
    project_id: '',
    vendor_name: '',
    category: '',
    amount: '',
    due_date: '',
    description: '',
    source: 'manual'
  });
  
  // Settle form
  const [settleForm, setSettleForm] = useState({
    amount: '',
    remarks: ''
  });

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterCategory) params.append('category', filterCategory);
      if (filterProject) params.append('project_id', filterProject);
      
      const [liabilitiesRes, summaryRes, projectsRes] = await Promise.all([
        axios.get(`${API}/finance/liabilities?${params.toString()}`, { withCredentials: true }),
        axios.get(`${API}/finance/liabilities/summary`, { withCredentials: true }),
        axios.get(`${API}/projects`, { withCredentials: true }).catch(() => ({ data: [] }))
      ]);
      
      setLiabilities(liabilitiesRes.data);
      setSummary(summaryRes.data);
      setProjects(projectsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch liabilities:', error);
      toast.error('Failed to load liabilities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterCategory, filterProject]);

  const handleCreateLiability = async () => {
    if (!createForm.vendor_name || !createForm.category || !createForm.amount) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      setSubmitting(true);
      await axios.post(`${API}/finance/liabilities`, {
        ...createForm,
        project_id: createForm.project_id || null,
        amount: parseFloat(createForm.amount)
      }, { withCredentials: true });
      
      toast.success('Liability created successfully');
      setIsCreateOpen(false);
      setCreateForm({
        project_id: '',
        vendor_name: '',
        category: '',
        amount: '',
        due_date: '',
        description: '',
        source: 'manual'
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create liability');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettleLiability = async () => {
    if (!settleForm.amount || parseFloat(settleForm.amount) <= 0) {
      toast.error('Please enter a valid settlement amount');
      return;
    }
    
    try {
      setSubmitting(true);
      await axios.post(`${API}/finance/liabilities/${selectedLiability.liability_id}/settle`, {
        amount: parseFloat(settleForm.amount),
        remarks: settleForm.remarks
      }, { withCredentials: true });
      
      toast.success('Settlement recorded');
      setIsSettleOpen(false);
      setSettleForm({ amount: '', remarks: '' });
      setSelectedLiability(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to settle liability');
    } finally {
      setSubmitting(false);
    }
  };

  const openSettleDialog = (liability) => {
    setSelectedLiability(liability);
    setSettleForm({ amount: String(liability.amount_remaining), remarks: '' });
    setIsSettleOpen(true);
  };

  const exportToCSV = () => {
    const headers = ['Liability ID', 'Vendor', 'Category', 'Amount', 'Settled', 'Remaining', 'Status', 'Project', 'Due Date', 'Source', 'Created At'];
    const rows = liabilities.map(l => [
      l.liability_id,
      l.vendor_name,
      l.category,
      l.amount,
      l.amount_settled,
      l.amount_remaining,
      l.status,
      l.project_name || '-',
      l.due_date || '-',
      l.source,
      l.created_at?.split('T')[0]
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liabilities_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  const getStatusBadge = (status) => {
    const variants = {
      open: 'bg-amber-100 text-amber-700 border-amber-200',
      partially_settled: 'bg-blue-100 text-blue-700 border-blue-200',
      closed: 'bg-green-100 text-green-700 border-green-200'
    };
    const labels = {
      open: 'Open',
      partially_settled: 'Partial',
      closed: 'Closed'
    };
    return (
      <Badge variant="outline" className={cn("text-xs", variants[status] || variants.open)}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6" data-testid="liabilities-page">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Liability Register</h1>
            <p className="text-slate-500 text-sm mt-1">Track and manage financial obligations</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV} data-testid="export-csv-btn">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="create-liability-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Liability
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create Liability</DialogTitle>
                  <DialogDescription>
                    Add a new financial obligation (vendor credit, commitment, etc.)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Vendor Name *</Label>
                    <Input
                      value={createForm.vendor_name}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, vendor_name: e.target.value }))}
                      placeholder="e.g., ABC Suppliers"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Category *</Label>
                      <Select value={createForm.category} onValueChange={(v) => setCreateForm(prev => ({ ...prev, category: v }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {LIABILITY_CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Amount (₹) *</Label>
                      <Input
                        type="number"
                        value={createForm.amount}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Source</Label>
                      <Select value={createForm.source} onValueChange={(v) => setCreateForm(prev => ({ ...prev, source: v }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          {LIABILITY_SOURCES.map(src => (
                            <SelectItem key={src.value} value={src.value}>{src.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={createForm.due_date}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, due_date: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Project (Optional)</Label>
                    <Select value={createForm.project_id} onValueChange={(v) => setCreateForm(prev => ({ ...prev, project_id: v }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="No project linked" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No project</SelectItem>
                        {projects.map(p => (
                          <SelectItem key={p.project_id} value={p.project_id}>
                            {p.project_name || p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Details about this liability..."
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateLiability} disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Create Liability
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-red-500" />
                  <p className="text-sm text-slate-500">Total Outstanding</p>
                </div>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.total_outstanding)}</p>
                <p className="text-xs text-slate-400">{summary.open_count} open liabilities</p>
              </CardContent>
            </Card>
            
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <p className="text-sm text-slate-500">Due This Month</p>
                </div>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(summary.due_this_month)}</p>
              </CardContent>
            </Card>
            
            <Card className={cn("border-slate-200", summary.overdue > 0 && "border-red-200 bg-red-50")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className={cn("w-4 h-4", summary.overdue > 0 ? "text-red-500" : "text-slate-400")} />
                  <p className="text-sm text-slate-500">Overdue</p>
                </div>
                <p className={cn("text-2xl font-bold", summary.overdue > 0 ? "text-red-600" : "text-slate-600")}>
                  {formatCurrency(summary.overdue)}
                </p>
                <p className="text-xs text-slate-400">{summary.overdue_count} overdue</p>
              </CardContent>
            </Card>
            
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  <p className="text-sm text-slate-500">Top Vendor</p>
                </div>
                {summary.top_vendors?.[0] ? (
                  <>
                    <p className="text-lg font-bold text-slate-800 truncate">{summary.top_vendors[0].vendor}</p>
                    <p className="text-xs text-slate-400">{formatCurrency(summary.top_vendors[0].amount)}</p>
                  </>
                ) : (
                  <p className="text-slate-400">-</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">Filters:</span>
              </div>
              <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="partially_settled">Partial</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory || "all"} onValueChange={(v) => setFilterCategory(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {LIABILITY_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterProject || "all"} onValueChange={(v) => setFilterProject(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.project_id} value={p.project_id}>
                      {p.project_name || p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(filterStatus || filterCategory || filterProject) && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setFilterStatus('');
                  setFilterCategory('');
                  setFilterProject('');
                }}>
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Liabilities Table */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-200 pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-600" />
              Liabilities ({liabilities.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Vendor</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Category</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Amount</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600">Remaining</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Project</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Due Date</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {liabilities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400">
                        No liabilities found
                      </td>
                    </tr>
                  ) : (
                    liabilities.map((liability) => (
                      <tr key={liability.liability_id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-slate-900">{liability.vendor_name}</p>
                            <p className="text-xs text-slate-400">{liability.description || liability.liability_id}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="capitalize">{liability.category.replace('_', ' ')}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(liability.amount)}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-red-600">
                          {formatCurrency(liability.amount_remaining)}
                        </td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(liability.status)}</td>
                        <td className="py-3 px-4">
                          {liability.project_name ? (
                            <span className="text-slate-700">{liability.project_name}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {liability.due_date ? (
                            <span className={cn(
                              liability.due_date < new Date().toISOString().split('T')[0] && liability.status !== 'closed'
                                ? 'text-red-600 font-medium'
                                : 'text-slate-600'
                            )}>
                              {formatDate(liability.due_date)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {liability.status !== 'closed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openSettleDialog(liability)}
                              data-testid={`settle-btn-${liability.liability_id}`}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Settle
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settle Dialog */}
      <Dialog open={isSettleOpen} onOpenChange={setIsSettleOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Settle Liability</DialogTitle>
            <DialogDescription>
              {selectedLiability && (
                <>Record payment against {selectedLiability.vendor_name} - {formatCurrency(selectedLiability.amount_remaining)} remaining</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Settlement Amount (₹)</Label>
              <Input
                type="number"
                value={settleForm.amount}
                onChange={(e) => setSettleForm(prev => ({ ...prev, amount: e.target.value }))}
                max={selectedLiability?.amount_remaining}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={settleForm.remarks}
                onChange={(e) => setSettleForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Payment reference, notes..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettleOpen(false)}>Cancel</Button>
            <Button onClick={handleSettleLiability} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Record Settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
