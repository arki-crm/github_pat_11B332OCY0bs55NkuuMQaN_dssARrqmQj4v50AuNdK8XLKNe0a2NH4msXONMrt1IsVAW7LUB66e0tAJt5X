import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { 
  Loader2, 
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  User,
  Calendar,
  IndianRupee,
  Building2,
  Filter,
  ChevronDown,
  Eye,
  Receipt,
  Lock
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

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-IN', { 
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' }
];

const URGENCY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-amber-100 text-amber-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' }
];

const STATUS_CONFIG = {
  pending_approval: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-800', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  recorded: { label: 'Recorded', color: 'bg-blue-100 text-blue-800', icon: Receipt },
  refund_pending: { label: 'Refund Pending', color: 'bg-purple-100 text-purple-800', icon: RefreshCw },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-700', icon: Lock }
};

const ExpenseRequests = () => {
  const { hasPermission, user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  
  // Master data
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form states
  const [newRequest, setNewRequest] = useState({
    project_id: '',
    category_id: '',
    vendor_id: '',
    amount: '',
    description: '',
    urgency: 'normal',
    expected_date: ''
  });
  
  const [approvalAction, setApprovalAction] = useState({
    action: '',
    remarks: '',
    over_budget_justification: ''
  });
  
  const [recordAction, setRecordAction] = useState({
    account_id: '',
    mode: '',
    transaction_date: new Date().toISOString().split('T')[0],
    paid_to: '',
    remarks: ''
  });
  
  const [refundAction, setRefundAction] = useState({
    refund_expected_amount: '',
    refund_expected_date: '',
    refund_notes: ''
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [requestsRes, summaryRes, projectsRes, categoriesRes, vendorsRes, accountsRes, usersRes] = await Promise.all([
        axios.get(`${API}/finance/expense-requests`, { withCredentials: true }),
        axios.get(`${API}/finance/expense-requests/stats/summary`, { withCredentials: true }),
        axios.get(`${API}/projects`, { withCredentials: true }),
        axios.get(`${API}/accounting/categories`, { withCredentials: true }),
        axios.get(`${API}/accounting/vendors`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/accounting/accounts`, { withCredentials: true }),
        axios.get(`${API}/users`, { withCredentials: true }).catch(() => ({ data: [] }))
      ]);
      
      setRequests(requestsRes.data);
      setSummary(summaryRes.data);
      setProjects(projectsRes.data);
      setCategories(categoriesRes.data);
      setVendors(vendorsRes.data);
      setAccounts(accountsRes.data);
      setUsers(usersRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load expense requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateRequest = async () => {
    if (!newRequest.category_id || !newRequest.amount || !newRequest.description) {
      toast.error('Category, amount, and description are required');
      return;
    }
    
    try {
      setSubmitting(true);
      await axios.post(`${API}/finance/expense-requests`, {
        ...newRequest,
        amount: parseFloat(newRequest.amount),
        project_id: newRequest.project_id || null,
        vendor_id: newRequest.vendor_id || null
      }, { withCredentials: true });
      
      toast.success('Expense request created');
      setIsCreateDialogOpen(false);
      setNewRequest({
        project_id: '',
        category_id: '',
        vendor_id: '',
        amount: '',
        description: '',
        urgency: 'normal',
        expected_date: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovalAction = async () => {
    if (!approvalAction.action) {
      toast.error('Please select an action');
      return;
    }
    
    if (selectedRequest?.is_over_budget && approvalAction.action === 'approve' && !approvalAction.over_budget_justification) {
      toast.error('Over-budget expenses require justification');
      return;
    }
    
    try {
      setSubmitting(true);
      await axios.post(`${API}/finance/expense-requests/${selectedRequest.request_id}/approve`, approvalAction, { withCredentials: true });
      
      toast.success(`Request ${approvalAction.action === 'approve' ? 'approved' : 'rejected'}`);
      setIsApprovalDialogOpen(false);
      setApprovalAction({ action: '', remarks: '', over_budget_justification: '' });
      setSelectedRequest(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordExpense = async () => {
    if (!recordAction.account_id || !recordAction.mode || !recordAction.transaction_date) {
      toast.error('Account, mode, and date are required');
      return;
    }
    
    try {
      setSubmitting(true);
      await axios.post(`${API}/finance/expense-requests/${selectedRequest.request_id}/record`, recordAction, { withCredentials: true });
      
      toast.success('Expense recorded in cashbook');
      setIsRecordDialogOpen(false);
      setRecordAction({
        account_id: '',
        mode: '',
        transaction_date: new Date().toISOString().split('T')[0],
        paid_to: '',
        remarks: ''
      });
      setSelectedRequest(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Recording failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkRefundPending = async () => {
    if (!refundAction.refund_expected_amount) {
      toast.error('Expected refund amount is required');
      return;
    }
    
    try {
      setSubmitting(true);
      await axios.post(`${API}/finance/expense-requests/${selectedRequest.request_id}/mark-refund-pending`, {
        ...refundAction,
        refund_expected_amount: parseFloat(refundAction.refund_expected_amount)
      }, { withCredentials: true });
      
      toast.success('Refund marked as pending');
      setIsRefundDialogOpen(false);
      setRefundAction({ refund_expected_amount: '', refund_expected_date: '', refund_notes: '' });
      setSelectedRequest(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark refund');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseExpense = async (requestId) => {
    try {
      await axios.post(`${API}/finance/expense-requests/${requestId}/close`, {}, { withCredentials: true });
      toast.success('Expense closed');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to close expense');
    }
  };

  const viewRequestDetails = async (requestId) => {
    try {
      const res = await axios.get(`${API}/finance/expense-requests/${requestId}`, { withCredentials: true });
      setSelectedRequest(res.data);
      setIsViewDialogOpen(true);
    } catch (error) {
      toast.error('Failed to load request details');
    }
  };

  // Filter requests based on tab and search
  const filteredRequests = requests.filter(req => {
    // Tab filter
    if (activeTab !== 'all') {
      if (activeTab === 'pending' && req.status !== 'pending_approval') return false;
      if (activeTab === 'approved' && req.status !== 'approved') return false;
      if (activeTab === 'recorded' && req.status !== 'recorded') return false;
      if (activeTab === 'refund' && req.status !== 'refund_pending') return false;
    }
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        req.request_number?.toLowerCase().includes(searchLower) ||
        req.description?.toLowerCase().includes(searchLower) ||
        req.project_name?.toLowerCase().includes(searchLower) ||
        req.category_name?.toLowerCase().includes(searchLower) ||
        req.requester_name?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="expense-requests-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expense Requests</h1>
          <p className="text-slate-500 text-sm mt-1">Manage expense authorization and tracking</p>
        </div>
        {hasPermission('finance.create_expense_request') && (
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="create-expense-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-600 text-sm font-medium">Pending Approval</p>
                  <p className="text-2xl font-bold text-amber-900">{summary.total_pending_approval}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-medium">Approved (Unrecorded)</p>
                  <p className="text-2xl font-bold text-green-900">{summary.total_approved_unrecorded}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-600 text-sm font-medium">Pending Refunds</p>
                  <p className="text-2xl font-bold text-purple-900">{summary.pending_refunds_count}</p>
                </div>
                <RefreshCw className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 text-sm font-medium">Money at Risk</p>
                  <p className="text-2xl font-bold text-red-900">{formatCurrency(summary.money_at_risk)}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
                <TabsTrigger value="approved" data-testid="tab-approved">Approved</TabsTrigger>
                <TabsTrigger value="recorded" data-testid="tab-recorded">Recorded</TabsTrigger>
                <TabsTrigger value="refund" data-testid="tab-refund">Refunds</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
                data-testid="search-input"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No expense requests found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => {
                const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending_approval;
                const StatusIcon = statusConfig.icon;
                const urgencyConfig = URGENCY_LEVELS.find(u => u.value === req.urgency) || URGENCY_LEVELS[1];
                
                return (
                  <div
                    key={req.request_id}
                    className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
                    data-testid={`expense-row-${req.request_id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm text-slate-600">{req.request_number}</span>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          <Badge className={urgencyConfig.color}>{urgencyConfig.label}</Badge>
                          {req.is_over_budget && (
                            <Badge className="bg-red-100 text-red-700">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Over Budget
                            </Badge>
                          )}
                        </div>
                        
                        <p className="font-medium text-slate-900 mb-1">{req.description}</p>
                        
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <IndianRupee className="w-3 h-3" />
                            {formatCurrency(req.amount)}
                          </span>
                          {req.project_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {req.project_pid} - {req.project_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {req.requester_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(req.created_at)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewRequestDetails(req.request_id)}
                          data-testid={`view-btn-${req.request_id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {req.status === 'pending_approval' && hasPermission('finance.approve_expense') && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(req);
                              setIsApprovalDialogOpen(true);
                            }}
                            data-testid={`approve-btn-${req.request_id}`}
                          >
                            Review
                          </Button>
                        )}
                        
                        {req.status === 'approved' && hasPermission('finance.record_expense') && (
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              setSelectedRequest(req);
                              setIsRecordDialogOpen(true);
                            }}
                            data-testid={`record-btn-${req.request_id}`}
                          >
                            Record
                          </Button>
                        )}
                        
                        {req.status === 'recorded' && hasPermission('finance.track_refunds') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest(req);
                              setRefundAction({ 
                                refund_expected_amount: req.amount.toString(),
                                refund_expected_date: '',
                                refund_notes: ''
                              });
                              setIsRefundDialogOpen(true);
                            }}
                            data-testid={`refund-btn-${req.request_id}`}
                          >
                            Mark Refund
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Request Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Expense Request</DialogTitle>
            <DialogDescription>
              Submit a new expense for approval before recording in the cashbook.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Project (Optional)</Label>
              <Select value={newRequest.project_id} onValueChange={(v) => setNewRequest(p => ({ ...p, project_id: v }))}>
                <SelectTrigger data-testid="project-select">
                  <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.project_id} value={p.project_id}>
                      {p.pid?.replace('ARKI-', '')} - {p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Category *</Label>
              <Select value={newRequest.category_id} onValueChange={(v) => setNewRequest(p => ({ ...p, category_id: v }))}>
                <SelectTrigger data-testid="category-select">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.category_id} value={c.category_id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Vendor (Optional)</Label>
              <Select value={newRequest.vendor_id} onValueChange={(v) => setNewRequest(p => ({ ...p, vendor_id: v }))}>
                <SelectTrigger data-testid="vendor-select">
                  <SelectValue placeholder="Select vendor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Vendor</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={newRequest.amount}
                  onChange={(e) => setNewRequest(p => ({ ...p, amount: e.target.value }))}
                  data-testid="amount-input"
                />
              </div>
              <div>
                <Label>Urgency</Label>
                <Select value={newRequest.urgency} onValueChange={(v) => setNewRequest(p => ({ ...p, urgency: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_LEVELS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Expected Payment Date</Label>
              <Input
                type="date"
                value={newRequest.expected_date}
                onChange={(e) => setNewRequest(p => ({ ...p, expected_date: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Description *</Label>
              <Textarea
                placeholder="Describe what this expense is for..."
                value={newRequest.description}
                onChange={(e) => setNewRequest(p => ({ ...p, description: e.target.value }))}
                rows={3}
                data-testid="description-input"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRequest} disabled={submitting} data-testid="submit-request-btn">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Expense Request Details</span>
              {selectedRequest && (
                <Badge className={STATUS_CONFIG[selectedRequest.status]?.color}>
                  {STATUS_CONFIG[selectedRequest.status]?.label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Request Number</p>
                  <p className="font-mono">{selectedRequest.request_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Amount</p>
                  <p className="text-xl font-bold">{formatCurrency(selectedRequest.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Category</p>
                  <p>{selectedRequest.category_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Urgency</p>
                  <Badge className={URGENCY_LEVELS.find(u => u.value === selectedRequest.urgency)?.color}>
                    {selectedRequest.urgency}
                  </Badge>
                </div>
                {selectedRequest.project_name && (
                  <div className="col-span-2">
                    <p className="text-sm text-slate-500">Project</p>
                    <p>{selectedRequest.project_pid} - {selectedRequest.project_name}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-sm text-slate-500">Description</p>
                  <p>{selectedRequest.description}</p>
                </div>
              </div>
              
              {selectedRequest.is_over_budget && selectedRequest.budget_info && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-700 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Over Budget Warning</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Planned Budget: {formatCurrency(selectedRequest.budget_info.planned_budget)}</div>
                    <div>Actual Spent: {formatCurrency(selectedRequest.budget_info.actual_spent)}</div>
                    <div>Remaining: {formatCurrency(selectedRequest.budget_info.remaining_before_this)}</div>
                    <div className="text-red-700">Over by: {formatCurrency(selectedRequest.budget_info.over_budget_amount)}</div>
                  </div>
                </div>
              )}
              
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Activity Log</h4>
                <div className="space-y-3">
                  {selectedRequest.activity_log?.map((log, idx) => (
                    <div key={idx} className="flex gap-3 text-sm">
                      <div className="w-24 text-slate-400 shrink-0">{formatDateTime(log.at)}</div>
                      <div>
                        <span className="font-medium">{log.by_name}</span> - {log.details}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Expense Request</DialogTitle>
            <DialogDescription>
              {selectedRequest?.request_number} - {formatCurrency(selectedRequest?.amount)}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-600 mb-2">{selectedRequest.description}</p>
                <div className="flex items-center gap-4 text-sm">
                  <span>Requested by: {selectedRequest.requester_name}</span>
                  {selectedRequest.project_name && <span>Project: {selectedRequest.project_name}</span>}
                </div>
              </div>
              
              {selectedRequest.is_over_budget && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-700 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">This expense exceeds the project budget</span>
                  </div>
                  <p className="text-sm text-red-600">
                    Over budget by: {formatCurrency(selectedRequest.budget_info?.over_budget_amount || 0)}
                  </p>
                </div>
              )}
              
              <div>
                <Label>Action</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant={approvalAction.action === 'approve' ? 'default' : 'outline'}
                    className={approvalAction.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                    onClick={() => setApprovalAction(p => ({ ...p, action: 'approve' }))}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant={approvalAction.action === 'reject' ? 'destructive' : 'outline'}
                    onClick={() => setApprovalAction(p => ({ ...p, action: 'reject' }))}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
              
              <div>
                <Label>Remarks</Label>
                <Textarea
                  placeholder={approvalAction.action === 'reject' ? 'Reason for rejection...' : 'Any comments...'}
                  value={approvalAction.remarks}
                  onChange={(e) => setApprovalAction(p => ({ ...p, remarks: e.target.value }))}
                />
              </div>
              
              {selectedRequest.is_over_budget && approvalAction.action === 'approve' && (
                <div>
                  <Label className="text-red-700">Over-Budget Justification *</Label>
                  <Textarea
                    placeholder="Explain why this over-budget expense should be approved..."
                    value={approvalAction.over_budget_justification}
                    onChange={(e) => setApprovalAction(p => ({ ...p, over_budget_justification: e.target.value }))}
                    className="border-red-200"
                  />
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleApprovalAction} 
              disabled={submitting || !approvalAction.action}
              className={approvalAction.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={approvalAction.action === 'reject' ? 'destructive' : 'default'}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {approvalAction.action === 'approve' ? 'Approve' : approvalAction.action === 'reject' ? 'Reject' : 'Select Action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Expense Dialog */}
      <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Expense in Cashbook</DialogTitle>
            <DialogDescription>
              Recording: {selectedRequest?.request_number} - {formatCurrency(selectedRequest?.amount)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Pay from Account *</Label>
              <Select value={recordAction.account_id} onValueChange={(v) => setRecordAction(p => ({ ...p, account_id: v }))}>
                <SelectTrigger data-testid="record-account-select">
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.account_id} value={a.account_id}>
                      {a.account_name} ({formatCurrency(a.current_balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Mode *</Label>
                <Select value={recordAction.mode} onValueChange={(v) => setRecordAction(p => ({ ...p, mode: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Transaction Date *</Label>
                <Input
                  type="date"
                  value={recordAction.transaction_date}
                  onChange={(e) => setRecordAction(p => ({ ...p, transaction_date: e.target.value }))}
                />
              </div>
            </div>
            
            <div>
              <Label>Paid To (Override)</Label>
              <Input
                placeholder={selectedRequest?.vendor_name || 'Vendor/Supplier name...'}
                value={recordAction.paid_to}
                onChange={(e) => setRecordAction(p => ({ ...p, paid_to: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Additional Remarks</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={recordAction.remarks}
                onChange={(e) => setRecordAction(p => ({ ...p, remarks: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecordDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordExpense} disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Record Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Refund Pending Dialog */}
      <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Refund Pending</DialogTitle>
            <DialogDescription>
              Track expected refund for: {selectedRequest?.request_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Expected Refund Amount (₹) *</Label>
              <Input
                type="number"
                placeholder="Enter expected refund amount"
                value={refundAction.refund_expected_amount}
                onChange={(e) => setRefundAction(p => ({ ...p, refund_expected_amount: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Expected Refund Date</Label>
              <Input
                type="date"
                value={refundAction.refund_expected_date}
                onChange={(e) => setRefundAction(p => ({ ...p, refund_expected_date: e.target.value }))}
              />
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Reason for refund, vendor details, etc..."
                value={refundAction.refund_notes}
                onChange={(e) => setRefundAction(p => ({ ...p, refund_notes: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRefundDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMarkRefundPending} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Mark Refund Pending
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpenseRequests;
