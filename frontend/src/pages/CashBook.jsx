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
  DialogTrigger,
} from '../components/ui/dialog';
import { 
  Plus, 
  Loader2, 
  ArrowUpCircle, 
  ArrowDownCircle,
  Lock,
  CheckCircle,
  Calendar,
  Wallet,
  Building2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Eye,
  UserCheck,
  FileCheck,
  Filter,
  Paperclip
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import AttachmentUploader from '../components/AttachmentUploader';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TRANSACTION_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' }
];

// Amount thresholds for guardrails
const THRESHOLDS = {
  petty_cash_max: 1000,      // ₹0-1000: Direct entry
  review_threshold: 5000,    // ₹1001-5000: Needs review
  approval_required: 5001    // ₹5001+: Needs approver or expense request
};

// Static Income Categories for Money In
const INCOME_CATEGORIES = [
  { category_id: 'income_project_payment', name: 'Project Payment' },
  { category_id: 'income_advance_booking', name: 'Advance / Booking Amount' },
  { category_id: 'income_design_fee', name: 'Design Fee' },
  { category_id: 'income_refund_reversal', name: 'Refund Reversal' },
  { category_id: 'income_other', name: 'Other Income' }
];

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
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const CashBook = () => {
  const { user, hasPermission } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [approvedExpenseRequests, setApprovedExpenseRequests] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCloseDayDialogOpen, setIsCloseDayDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNeedsReviewOnly, setShowNeedsReviewOnly] = useState(false);
  const [viewTransaction, setViewTransaction] = useState(null); // For viewing transaction details with attachments
  
  // New transaction form
  const [newTxn, setNewTxn] = useState({
    transaction_type: 'outflow',
    amount: '',
    mode: 'cash',
    category_id: '',
    account_id: '',
    project_id: '',
    paid_to: '',
    remarks: '',
    // New accountability fields
    requested_by: '',
    requested_by_name: '',
    approved_by: '',
    approved_by_name: '',
    expense_request_id: ''
  });

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const needsReviewParam = showNeedsReviewOnly ? '&needs_review=true' : '';
      const [txnRes, accRes, catRes, summaryRes, reviewRes] = await Promise.all([
        axios.get(`${API}/accounting/transactions?date=${selectedDate}${needsReviewParam}`, { withCredentials: true }),
        axios.get(`${API}/accounting/accounts`, { withCredentials: true }),
        axios.get(`${API}/accounting/categories`, { withCredentials: true }),
        axios.get(`${API}/accounting/daily-summary/${selectedDate}`, { withCredentials: true }),
        axios.get(`${API}/accounting/transactions/review-summary`, { withCredentials: true }).catch(() => ({ data: null }))
      ]);
      
      setTransactions(txnRes.data);
      setAccounts(accRes.data);
      setCategories(catRes.data.filter(c => c.is_active));
      setDailySummary(summaryRes.data);
      setReviewSummary(reviewRes.data);
      
      // Set default account if available
      if (accRes.data.length > 0 && !newTxn.account_id) {
        setNewTxn(prev => ({ ...prev, account_id: accRes.data[0].account_id }));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      if (error.response?.status === 403) {
        toast.error('Access denied - you need finance permissions');
      } else {
        toast.error('Failed to load cash book data');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovers = async () => {
    try {
      const res = await axios.get(`${API}/accounting/users-for-approval`, { withCredentials: true });
      setApprovers(res.data || []);
    } catch (error) {
      console.error('Failed to fetch approvers:', error);
    }
  };

  const fetchApprovedExpenseRequests = async () => {
    try {
      const res = await axios.get(`${API}/accounting/approved-expense-requests`, { withCredentials: true });
      setApprovedExpenseRequests(res.data || []);
    } catch (error) {
      console.error('Failed to fetch expense requests:', error);
    }
  };

  const fetchProjects = async (search = '') => {
    try {
      const res = await axios.get(`${API}/accounting/projects-list?search=${search}`, { withCredentials: true });
      setProjects(res.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchProjects();
    fetchApprovers();
    fetchApprovedExpenseRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, showNeedsReviewOnly]);

  const handleAddTransaction = async () => {
    if (!newTxn.amount || parseFloat(newTxn.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!newTxn.category_id) {
      toast.error('Please select a category');
      return;
    }
    if (!newTxn.account_id) {
      toast.error('Please select an account');
      return;
    }
    if (!newTxn.remarks.trim()) {
      toast.error('Remarks is required');
      return;
    }

    const amount = parseFloat(newTxn.amount);
    
    // Guardrails validation for outflows
    if (newTxn.transaction_type === 'outflow' && amount > THRESHOLDS.review_threshold) {
      // High value transaction - needs approver or expense request
      if (!newTxn.approved_by && !newTxn.expense_request_id) {
        toast.warning('High value transaction (>₹5,000). Consider selecting an Approver or linking to an approved Expense Request.');
        // Still allow but warn
      }
    }

    try {
      setSubmitting(true);
      await axios.post(`${API}/accounting/transactions`, {
        ...newTxn,
        amount: amount,
        transaction_date: new Date().toISOString(),
        project_id: newTxn.project_id || null,
        requested_by: newTxn.requested_by || user?.user_id,
        requested_by_name: newTxn.requested_by_name || user?.name
      }, { withCredentials: true });
      
      let message = 'Transaction added successfully';
      if (amount > THRESHOLDS.petty_cash_max && amount <= THRESHOLDS.review_threshold) {
        message += ' (flagged for review)';
      }
      toast.success(message);
      
      setIsAddDialogOpen(false);
      setNewTxn({
        transaction_type: 'outflow',
        amount: '',
        mode: 'cash',
        category_id: '',
        account_id: accounts[0]?.account_id || '',
        project_id: '',
        paid_to: '',
        remarks: '',
        requested_by: '',
        requested_by_name: '',
        approved_by: '',
        approved_by_name: '',
        expense_request_id: ''
      });
      fetchData();
    } catch (error) {
      console.error('Failed to add transaction:', error);
      toast.error(error.response?.data?.detail || 'Failed to add transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkReviewed = async (transactionId) => {
    try {
      await axios.put(`${API}/accounting/transactions/${transactionId}/mark-reviewed`, {}, { withCredentials: true });
      toast.success('Transaction marked as reviewed');
      fetchData();
    } catch (error) {
      toast.error('Failed to mark as reviewed');
    }
  };

  const handleCloseDay = async () => {
    try {
      setSubmitting(true);
      await axios.post(`${API}/accounting/close-day/${selectedDate}`, {}, { withCredentials: true });
      toast.success(`Day ${formatDate(selectedDate)} has been locked`);
      setIsCloseDayDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Failed to close day:', error);
      toast.error(error.response?.data?.detail || 'Failed to close day');
    } finally {
      setSubmitting(false);
    }
  };

  const changeDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const canAddTransaction = hasPermission('finance.add_transaction');
  const canCloseDay = hasPermission('finance.close_day');
  const isDayLocked = dailySummary?.is_locked;
  const isAdminOrCEO = user?.role === 'Admin' || user?.role === 'CEO' || user?.role === 'Founder' || hasPermission('finance.founder_dashboard');

  // Get amount category for display
  const getAmountCategory = (amount) => {
    if (amount <= THRESHOLDS.petty_cash_max) return { label: 'Petty Cash', color: 'bg-green-100 text-green-800' };
    if (amount <= THRESHOLDS.review_threshold) return { label: 'Review Flagged', color: 'bg-amber-100 text-amber-800' };
    return { label: 'Approval Required', color: 'bg-red-100 text-red-800' };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen" data-testid="cash-book-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Cash Book
          </h1>
          <p className="text-slate-500 text-sm mt-1">Daily financial transactions</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Needs Review Badge - Visible to Admin/CEO */}
          {isAdminOrCEO && reviewSummary?.needs_review_count > 0 && (
            <Button
              variant={showNeedsReviewOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowNeedsReviewOnly(!showNeedsReviewOnly)}
              className="gap-2"
              data-testid="needs-review-filter"
            >
              <Eye className="w-4 h-4" />
              Needs Review ({reviewSummary.needs_review_count})
            </Button>
          )}
          
          {/* Date Navigation */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} data-testid="prev-date-btn">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 px-3">
              <Calendar className="w-4 h-4 text-slate-400" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-0 bg-transparent p-0 w-[130px] focus:ring-0"
                data-testid="date-picker"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => changeDate(1)} data-testid="next-date-btn">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Actions */}
          {canAddTransaction && !isDayLocked && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700" data-testid="add-transaction-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Add Transaction</DialogTitle>
                  <DialogDescription>
                    Record a new financial entry for {formatDate(selectedDate)}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
                  {/* Type */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={newTxn.transaction_type === 'inflow' ? 'default' : 'outline'}
                      className={cn(
                        "flex-1",
                        newTxn.transaction_type === 'inflow' && "bg-green-600 hover:bg-green-700"
                      )}
                      onClick={() => setNewTxn(prev => ({ ...prev, transaction_type: 'inflow', category_id: '' }))}
                      data-testid="type-inflow-btn"
                    >
                      <ArrowDownCircle className="w-4 h-4 mr-2" />
                      Money In
                    </Button>
                    <Button
                      type="button"
                      variant={newTxn.transaction_type === 'outflow' ? 'default' : 'outline'}
                      className={cn(
                        "flex-1",
                        newTxn.transaction_type === 'outflow' && "bg-red-600 hover:bg-red-700"
                      )}
                      onClick={() => setNewTxn(prev => ({ ...prev, transaction_type: 'outflow', category_id: '' }))}
                      data-testid="type-outflow-btn"
                    >
                      <ArrowUpCircle className="w-4 h-4 mr-2" />
                      Money Out
                    </Button>
                  </div>

                  {/* Amount */}
                  <div>
                    <Label htmlFor="amount">Amount (₹) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={newTxn.amount}
                      onChange={(e) => setNewTxn(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="Enter amount"
                      className="mt-1"
                      data-testid="amount-input"
                    />
                  </div>

                  {/* Account & Mode */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Account *</Label>
                      <Select value={newTxn.account_id} onValueChange={(v) => setNewTxn(prev => ({ ...prev, account_id: v }))}>
                        <SelectTrigger className="mt-1" data-testid="account-select">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map(acc => (
                            <SelectItem key={acc.account_id} value={acc.account_id}>
                              {acc.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Payment Mode *</Label>
                      <Select value={newTxn.mode} onValueChange={(v) => setNewTxn(prev => ({ ...prev, mode: v }))}>
                        <SelectTrigger className="mt-1" data-testid="mode-select">
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSACTION_MODES.map(mode => (
                            <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <Label>Category *</Label>
                    <Select value={newTxn.category_id} onValueChange={(v) => setNewTxn(prev => ({ ...prev, category_id: v }))}>
                      <SelectTrigger className="mt-1" data-testid="category-select">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {newTxn.transaction_type === 'inflow' ? (
                          // Show Income Categories for Money In
                          INCOME_CATEGORIES.map(cat => (
                            <SelectItem key={cat.category_id} value={cat.category_id}>{cat.name}</SelectItem>
                          ))
                        ) : (
                          // Show Expense Categories for Money Out
                          categories.map(cat => (
                            <SelectItem key={cat.category_id} value={cat.category_id}>{cat.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Project (Optional) */}
                  <div>
                    <Label>Project (Optional)</Label>
                    <Select value={newTxn.project_id || "none"} onValueChange={(v) => setNewTxn(prev => ({ ...prev, project_id: v === "none" ? "" : v }))}>
                      <SelectTrigger className="mt-1" data-testid="project-select">
                        <SelectValue placeholder="Link to project (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Project</SelectItem>
                        {projects.map(p => (
                          <SelectItem key={p.project_id} value={p.project_id}>
                            {p.pid_display} - {p.project_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Paid To */}
                  <div>
                    <Label htmlFor="paid_to">Paid To / Received From</Label>
                    <Input
                      id="paid_to"
                      value={newTxn.paid_to}
                      onChange={(e) => setNewTxn(prev => ({ ...prev, paid_to: e.target.value }))}
                      placeholder="Vendor / Person name"
                      className="mt-1"
                      data-testid="paid-to-input"
                    />
                  </div>

                  {/* Remarks */}
                  <div>
                    <Label htmlFor="remarks">Remarks *</Label>
                    <Input
                      id="remarks"
                      value={newTxn.remarks}
                      onChange={(e) => setNewTxn(prev => ({ ...prev, remarks: e.target.value }))}
                      placeholder="Description of transaction"
                      className="mt-1"
                      data-testid="remarks-input"
                    />
                  </div>

                  {/* Accountability Section - For Outflows */}
                  {newTxn.transaction_type === 'outflow' && (
                    <>
                      <div className="col-span-2 border-t pt-4 mt-2">
                        <h4 className="font-medium text-sm text-slate-700 mb-3 flex items-center gap-2">
                          <UserCheck className="w-4 h-4" />
                          Accountability (Who is responsible?)
                        </h4>
                        
                        {/* Amount Category Indicator */}
                        {newTxn.amount && (
                          <div className="mb-3">
                            {(() => {
                              const cat = getAmountCategory(parseFloat(newTxn.amount) || 0);
                              return (
                                <Badge className={cat.color}>
                                  {cat.label}: {formatCurrency(parseFloat(newTxn.amount) || 0)}
                                </Badge>
                              );
                            })()}
                            {parseFloat(newTxn.amount) > THRESHOLDS.petty_cash_max && parseFloat(newTxn.amount) <= THRESHOLDS.review_threshold && (
                              <p className="text-xs text-amber-600 mt-1">This transaction will be flagged for review</p>
                            )}
                            {parseFloat(newTxn.amount) > THRESHOLDS.review_threshold && (
                              <p className="text-xs text-red-600 mt-1">High value: Consider selecting an Approver or linking to Expense Request</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Requested By */}
                      <div>
                        <Label>Requested By</Label>
                        <Input
                          value={newTxn.requested_by_name}
                          onChange={(e) => setNewTxn(prev => ({ ...prev, requested_by_name: e.target.value }))}
                          placeholder={user?.name || "Who initiated this spend?"}
                          className="mt-1"
                        />
                        <p className="text-xs text-slate-500 mt-1">Leave blank = you</p>
                      </div>

                      {/* Approved By - Only show for high-value transactions */}
                      {parseFloat(newTxn.amount) > THRESHOLDS.review_threshold && (
                        <div>
                          <Label>Approved By {parseFloat(newTxn.amount) > THRESHOLDS.review_threshold ? '(Recommended)' : ''}</Label>
                          <Select 
                            value={newTxn.approved_by || "none"} 
                            onValueChange={(v) => {
                              const approver = approvers.find(a => a.user_id === v);
                              setNewTxn(prev => ({ 
                                ...prev, 
                                approved_by: v === "none" ? "" : v,
                                approved_by_name: approver?.name || ""
                              }));
                            }}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select approver" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Approver</SelectItem>
                              {approvers.map(a => (
                                <SelectItem key={a.user_id} value={a.user_id}>
                                  {a.name} ({a.role})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Link to Expense Request - For high-value */}
                      {parseFloat(newTxn.amount) > THRESHOLDS.review_threshold && approvedExpenseRequests.length > 0 && (
                        <div className="col-span-2">
                          <Label>Link to Expense Request (Optional)</Label>
                          <Select 
                            value={newTxn.expense_request_id || "none"} 
                            onValueChange={(v) => setNewTxn(prev => ({ ...prev, expense_request_id: v === "none" ? "" : v }))}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Link to approved expense request" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Link</SelectItem>
                              {approvedExpenseRequests.map(req => (
                                <SelectItem key={req.request_id} value={req.request_id}>
                                  {req.title} - {formatCurrency(req.amount)} (by {req.requested_by_name})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <DialogFooter className="flex-shrink-0 border-t pt-4 mt-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddTransaction} disabled={submitting} data-testid="save-transaction-btn">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Entry
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {canCloseDay && !isDayLocked && transactions.length > 0 && (
            <Dialog open={isCloseDayDialogOpen} onOpenChange={setIsCloseDayDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50" data-testid="close-day-btn">
                  <Lock className="w-4 h-4 mr-2" />
                  Close Day
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Close Day - {formatDate(selectedDate)}</DialogTitle>
                  <DialogDescription>
                    This will lock all transactions for this day. No one will be able to add, edit, or delete entries after closing.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                  <p className="text-sm"><strong>Total Inflow:</strong> {formatCurrency(dailySummary?.total_inflow)}</p>
                  <p className="text-sm"><strong>Total Outflow:</strong> {formatCurrency(dailySummary?.total_outflow)}</p>
                  <p className="text-sm"><strong>Net Change:</strong> {formatCurrency(dailySummary?.net_change)}</p>
                  <p className="text-sm"><strong>Transactions:</strong> {dailySummary?.transaction_count}</p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCloseDayDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCloseDay} disabled={submitting} className="bg-amber-600 hover:bg-amber-700">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                    Lock Day
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Day Status Banner */}
      {isDayLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
          <Lock className="w-5 h-5 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">Day Locked</p>
            <p className="text-xs text-amber-600">
              Locked by {dailySummary?.locked_by} on {formatDate(dailySummary?.locked_at)}
            </p>
          </div>
        </div>
      )}

      {/* Account Balances Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {dailySummary?.accounts?.map((acc) => (
          <Card key={acc.account_id} className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {acc.account_type === 'cash' ? (
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-green-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 truncate">{acc.account_name}</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(acc.closing_balance)}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">In:</span>
                  <span className="text-green-600 font-medium ml-1">+{formatCurrency(acc.inflow)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Out:</span>
                  <span className="text-red-600 font-medium ml-1">-{formatCurrency(acc.outflow)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* Day Summary Card */}
        <Card className="border-slate-200 bg-slate-900 text-white">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400">Day Summary</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Total In:</span>
                <span className="text-green-400 font-medium">{formatCurrency(dailySummary?.total_inflow)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Out:</span>
                <span className="text-red-400 font-medium">{formatCurrency(dailySummary?.total_outflow)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-1 mt-2">
                <span className="text-slate-300 font-medium">Net:</span>
                <span className={cn(
                  "font-bold",
                  (dailySummary?.net_change || 0) >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  {formatCurrency(dailySummary?.net_change)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-200 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Transactions ({transactions.length})
            {showNeedsReviewOnly && <Badge className="ml-2 bg-amber-100 text-amber-800">Filtered: Needs Review</Badge>}
          </CardTitle>
          {showNeedsReviewOnly && (
            <Button variant="ghost" size="sm" onClick={() => setShowNeedsReviewOnly(false)}>
              Show All
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500">{showNeedsReviewOnly ? 'No transactions needing review' : 'No transactions for this day'}</p>
              {canAddTransaction && !isDayLocked && !showNeedsReviewOnly && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Entry
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Requested By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Remarks</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Docs</th>
                    {isAdminOrCEO && <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {transactions.map((txn) => (
                    <tr 
                      key={txn.transaction_id} 
                      className={cn(
                        "hover:bg-slate-50",
                        txn.needs_review && "bg-amber-50/50"
                      )} 
                      data-testid={`txn-row-${txn.transaction_id}`}
                    >
                      <td className="px-4 py-3 text-sm text-slate-600">{formatTime(txn.created_at)}</td>
                      <td className="px-4 py-3">
                        {txn.transaction_type === 'inflow' ? (
                          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                            <ArrowDownCircle className="w-3 h-3 mr-1" />
                            In
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
                            <ArrowUpCircle className="w-3 h-3 mr-1" />
                            Out
                          </span>
                        )}
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-sm font-medium text-right",
                        txn.transaction_type === 'inflow' ? "text-green-600" : "text-red-600"
                      )}>
                        {txn.transaction_type === 'inflow' ? '+' : '-'}{formatCurrency(txn.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{txn.account_name || txn.paid_from_account}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{txn.category_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <div>
                          <p className="text-slate-700">{txn.requested_by_name || txn.created_by_name}</p>
                          {txn.approved_by_name && (
                            <p className="text-xs text-green-600">✓ {txn.approved_by_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate" title={txn.remarks}>
                        {txn.remarks}
                        {txn.paid_to && <span className="block text-xs text-slate-400">→ {txn.paid_to}</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {txn.is_verified && (
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                          {txn.needs_review && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Needs Review
                            </Badge>
                          )}
                          {txn.approval_status === 'pending_approval' && (
                            <Badge className="bg-red-100 text-red-700 text-xs">
                              No Approver
                            </Badge>
                          )}
                          {txn.expense_request_id && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs">
                              <FileCheck className="w-3 h-3 mr-1" />
                              ER Linked
                            </Badge>
                          )}
                        </div>
                      </td>
                      {isAdminOrCEO && (
                        <td className="px-4 py-3 text-center">
                          {txn.needs_review && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkReviewed(txn.transaction_id)}
                              className="text-xs"
                            >
                              Mark Reviewed
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CashBook;
