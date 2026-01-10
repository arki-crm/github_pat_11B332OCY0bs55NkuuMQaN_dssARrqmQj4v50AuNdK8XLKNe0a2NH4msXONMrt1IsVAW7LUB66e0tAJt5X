import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  DialogTrigger,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { 
  ArrowLeft,
  Loader2, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Plus,
  Pencil,
  Trash2,
  Lock,
  CheckCircle,
  XCircle,
  DollarSign,
  Wallet,
  Building2,
  ArrowUpCircle,
  ArrowDownCircle,
  Snowflake,
  ShieldCheck,
  FileWarning,
  BarChart3,
  Receipt,
  Eye,
  Download,
  Calendar,
  Percent,
  LockOpen,
  Save,
  X
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
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const VENDOR_CATEGORIES = ['Modular', 'Non-Modular', 'Installation', 'Transport', 'Other'];

const ProjectFinanceDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [decisions, setDecisions] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [attributions, setAttributions] = useState([]);
  const [isOverrunDialogOpen, setIsOverrunDialogOpen] = useState(false);
  const [overrunForm, setOverrunForm] = useState({ reason: '', responsible_category: '', notes: '', overrun_amount: '' });
  const [overrunOptions, setOverrunOptions] = useState({ reasons: [], responsible_categories: [] });
  const [projectReceipts, setProjectReceipts] = useState([]);
  const [viewReceipt, setViewReceipt] = useState(null);
  const [paymentSchedule, setPaymentSchedule] = useState(null);
  const [isScheduleEditing, setIsScheduleEditing] = useState(false);
  const [editedSchedule, setEditedSchedule] = useState([]);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  
  const [newMapping, setNewMapping] = useState({
    vendor_name: '',
    category: '',
    planned_amount: '',
    notes: ''
  });

  const isAdmin = user?.role === 'Admin';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [financeRes, decisionsRes, intelligenceRes, attrRes, overrunRes, receiptsRes, scheduleRes] = await Promise.all([
        axios.get(`${API}/finance/project-finance/${projectId}`, { withCredentials: true }),
        axios.get(`${API}/finance/projects/${projectId}/decisions`, { withCredentials: true }).catch(() => ({ data: {} })),
        axios.get(`${API}/finance/cost-intelligence/${projectId}`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/finance/overrun-attributions/${projectId}`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/finance/overrun-reasons`, { withCredentials: true }).catch(() => ({ data: { reasons: [], responsible_categories: [] } })),
        axios.get(`${API}/finance/receipts?project_id=${projectId}`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/finance/payment-schedule/${projectId}`, { withCredentials: true }).catch(() => ({ data: null }))
      ]);
      setData(financeRes.data);
      setDecisions(decisionsRes.data);
      setIntelligence(intelligenceRes.data);
      setAttributions(attrRes.data);
      setOverrunOptions(overrunRes.data);
      setProjectReceipts(receiptsRes.data || []);
      setPaymentSchedule(scheduleRes.data);
    } catch (error) {
      console.error('Failed to fetch project finance:', error);
      if (error.response?.status === 404) {
        toast.error('Project not found');
        navigate('/finance/project-finance');
      } else {
        toast.error('Failed to load project finance data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Decision Shortcuts Handlers
  const handleFreezeSpending = async () => {
    try {
      await axios.post(`${API}/finance/projects/${projectId}/freeze-spending`, {}, { withCredentials: true });
      toast.success('Project spending frozen');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to freeze spending');
    }
  };

  const handleUnfreezeSpending = async () => {
    try {
      await axios.post(`${API}/finance/projects/${projectId}/unfreeze-spending`, {}, { withCredentials: true });
      toast.success('Project spending unfrozen');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to unfreeze spending');
    }
  };

  const handleMarkExceptional = async () => {
    const reason = prompt('Enter reason for marking as exceptional:');
    if (!reason) return;
    try {
      await axios.post(`${API}/finance/projects/${projectId}/mark-exceptional`, null, { 
        params: { reason },
        withCredentials: true 
      });
      toast.success('Project marked as exceptional');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark as exceptional');
    }
  };

  const handleAllowOverrun = async () => {
    const amount = prompt('Enter additional amount to allow (₹):');
    if (!amount || isNaN(parseFloat(amount))) return;
    const reason = prompt('Enter reason for allowing overrun:');
    if (!reason) return;
    try {
      await axios.post(`${API}/finance/projects/${projectId}/allow-overrun`, null, { 
        params: { additional_amount: parseFloat(amount), reason },
        withCredentials: true 
      });
      toast.success('Overrun allowed');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to allow overrun');
    }
  };

  const handleAddAttribution = async () => {
    if (!overrunForm.reason || !overrunForm.responsible_category) {
      toast.error('Please select reason and responsible category');
      return;
    }
    try {
      setSubmitting(true);
      await axios.post(`${API}/finance/overrun-attributions`, {
        project_id: projectId,
        reason: overrunForm.reason,
        responsible_category: overrunForm.responsible_category,
        notes: overrunForm.notes || null,
        overrun_amount: parseFloat(overrunForm.overrun_amount) || (data?.summary?.actual_cost - data?.summary?.planned_cost)
      }, { withCredentials: true });
      toast.success('Overrun attribution recorded');
      setIsOverrunDialogOpen(false);
      setOverrunForm({ reason: '', responsible_category: '', notes: '', overrun_amount: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record attribution');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMapping = async () => {
    if (!newMapping.vendor_name.trim()) {
      toast.error('Vendor name is required');
      return;
    }
    if (!newMapping.category) {
      toast.error('Category is required');
      return;
    }
    if (!newMapping.planned_amount || parseFloat(newMapping.planned_amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setSubmitting(true);
      await axios.post(`${API}/finance/vendor-mappings`, {
        project_id: projectId,
        vendor_name: newMapping.vendor_name,
        category: newMapping.category,
        planned_amount: parseFloat(newMapping.planned_amount),
        notes: newMapping.notes || null
      }, { withCredentials: true });
      
      toast.success('Vendor mapping added');
      setIsAddDialogOpen(false);
      setNewMapping({ vendor_name: '', category: '', planned_amount: '', notes: '' });
      fetchData();
    } catch (error) {
      console.error('Failed to add mapping:', error);
      toast.error(error.response?.data?.detail || 'Failed to add vendor mapping');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateMapping = async () => {
    if (!editingMapping) return;
    
    try {
      setSubmitting(true);
      await axios.put(`${API}/finance/vendor-mappings/${editingMapping.mapping_id}`, {
        vendor_name: editingMapping.vendor_name,
        category: editingMapping.category,
        planned_amount: parseFloat(editingMapping.planned_amount),
        notes: editingMapping.notes || null
      }, { withCredentials: true });
      
      toast.success('Vendor mapping updated');
      setEditingMapping(null);
      fetchData();
    } catch (error) {
      console.error('Failed to update mapping:', error);
      toast.error(error.response?.data?.detail || 'Failed to update vendor mapping');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    try {
      await axios.delete(`${API}/finance/vendor-mappings/${mappingId}`, { withCredentials: true });
      toast.success('Vendor mapping deleted');
      fetchData();
    } catch (error) {
      console.error('Failed to delete mapping:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete vendor mapping');
    }
  };

  // Receipt handlers
  const handleViewReceipt = async (receiptId) => {
    try {
      const res = await axios.get(`${API}/finance/receipts/${receiptId}`, { withCredentials: true });
      setViewReceipt(res.data);
    } catch (error) {
      toast.error('Failed to load receipt details');
    }
  };

  const handleDownloadPDF = async (receiptId, receiptNumber) => {
    try {
      toast.info('Generating PDF...');
      const res = await axios.get(`${API}/finance/receipts/${receiptId}/pdf`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Receipt_${receiptNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded');
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('Failed to download PDF');
    }
  };

  if (!hasPermission('finance.view_project_finance')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Project not found</p>
      </div>
    );
  }

  const { project, summary, vendor_mappings, transactions, comparison, can_edit_vendor_mapping, spending_started, production_started } = data;
  const canEdit = hasPermission('finance.edit_vendor_mapping') && can_edit_vendor_mapping;

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen" data-testid="project-finance-detail-page">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/finance/project-finance')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-600">
              {project.pid_display}
            </span>
            <Badge variant={project.status === 'Active' ? 'default' : 'secondary'}>
              {project.status}
            </Badge>
            {summary.has_overspend && (
              <Badge variant="destructive">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Over Budget
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {project.project_name}
          </h1>
          <p className="text-slate-500">{project.client_name}</p>
        </div>
      </div>

      {/* Lock Status Banner */}
      {!can_edit_vendor_mapping && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
          <Lock className="w-5 h-5 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">Vendor Mapping Locked</p>
            <p className="text-xs text-amber-600">
              {spending_started ? 'Spending has started for this project' : 
               production_started ? 'Production has started for this project' : 
               'Editing is not allowed'}
            </p>
          </div>
        </div>
      )}

      {/* Frozen Banner */}
      {decisions?.spending_frozen && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
          <Snowflake className="w-5 h-5 text-blue-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">Spending Frozen</p>
            <p className="text-xs text-blue-600">
              Frozen by {decisions.frozen_by_name} on {formatDate(decisions.frozen_at)}
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={handleUnfreezeSpending} className="border-blue-300 text-blue-700">
              Unfreeze
            </Button>
          )}
        </div>
      )}

      {/* Decision Shortcuts - Admin Only */}
      {isAdmin && (
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-slate-700">Quick Actions:</span>
              {!decisions?.spending_frozen ? (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleFreezeSpending}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <Snowflake className="w-4 h-4 mr-1" />
                  Freeze Spending
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleUnfreezeSpending}
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Unfreeze
                </Button>
              )}
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleAllowOverrun}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                Allow Overrun
              </Button>
              {!decisions?.is_exceptional && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleMarkExceptional}
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  <ShieldCheck className="w-4 h-4 mr-1" />
                  Mark Exceptional
                </Button>
              )}
              {summary.has_overspend && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsOverrunDialogOpen(true)}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <FileWarning className="w-4 h-4 mr-1" />
                  Explain Overrun
                </Button>
              )}
            </div>
            {decisions?.is_exceptional && (
              <div className="mt-3 p-2 bg-purple-50 rounded-lg text-xs text-purple-700">
                <ShieldCheck className="w-3 h-3 inline mr-1" />
                Marked as exceptional: {decisions.exceptional_reason}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cost Intelligence */}
      {intelligence && intelligence.benchmark?.similar_project_count > 0 && (
        <Card className={cn(
          "border-slate-200",
          intelligence.benchmark.is_abnormal && "border-amber-300 bg-amber-50/50"
        )}>
          <CardHeader className="border-b border-slate-200 pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-600" />
              Cost Benchmark
              {intelligence.benchmark.is_abnormal && (
                <Badge variant="outline" className="border-amber-400 text-amber-600 ml-2">
                  Deviation Detected
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Similar Projects</p>
                <p className="text-lg font-semibold text-slate-900">{intelligence.benchmark.similar_project_count}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Avg Planned Ratio</p>
                <p className="text-lg font-semibold text-slate-900">{intelligence.benchmark.avg_planned_ratio}%</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Your Planned Ratio</p>
                <p className={cn(
                  "text-lg font-semibold",
                  Math.abs(intelligence.benchmark.planned_deviation) > 20 ? "text-amber-600" : "text-slate-900"
                )}>
                  {intelligence.current_project.planned_ratio}%
                  <span className="text-xs ml-1">
                    ({intelligence.benchmark.planned_deviation > 0 ? '+' : ''}{intelligence.benchmark.planned_deviation}%)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Your Actual Ratio</p>
                <p className={cn(
                  "text-lg font-semibold",
                  Math.abs(intelligence.benchmark.actual_deviation) > 20 ? "text-amber-600" : "text-slate-900"
                )}>
                  {intelligence.current_project.actual_ratio}%
                </p>
              </div>
            </div>
            {intelligence.benchmark.abnormal_reason && (
              <div className="mt-3 p-2 bg-amber-100 rounded-lg text-sm text-amber-700">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                {intelligence.benchmark.abnormal_reason}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Overrun Attributions */}
      {attributions.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-200 pb-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-amber-500" />
              Overrun Explanations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {attributions.map((attr) => (
                <div key={attr.attribution_id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge variant="outline" className="text-xs mb-1">{attr.responsible_category}</Badge>
                      <p className="font-medium text-slate-900">{attr.reason}</p>
                      {attr.notes && <p className="text-sm text-slate-600 mt-1">{attr.notes}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-600">{formatCurrency(attr.overrun_amount)}</p>
                      <p className="text-xs text-slate-500">{attr.logged_by_name}</p>
                      <p className="text-xs text-slate-400">{formatDate(attr.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overrun Attribution Dialog */}
      <Dialog open={isOverrunDialogOpen} onOpenChange={setIsOverrunDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Explain Overrun</DialogTitle>
            <DialogDescription>
              Document why this project exceeded planned costs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Reason *</Label>
              <Select value={overrunForm.reason} onValueChange={(v) => setOverrunForm(prev => ({ ...prev, reason: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {overrunOptions.reasons.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsible Category *</Label>
              <Select value={overrunForm.responsible_category} onValueChange={(v) => setOverrunForm(prev => ({ ...prev, responsible_category: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {overrunOptions.responsible_categories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Overrun Amount (₹)</Label>
              <Input
                type="number"
                value={overrunForm.overrun_amount}
                onChange={(e) => setOverrunForm(prev => ({ ...prev, overrun_amount: e.target.value }))}
                placeholder={`${summary.actual_cost - summary.planned_cost}`}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={overrunForm.notes}
                onChange={(e) => setOverrunForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional details..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOverrunDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAttribution} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Financial Summary Card - THE MOST IMPORTANT SCREEN */}
      <Card className="border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-1">Contract Value</p>
              <p className="text-xl font-bold">{formatCurrency(summary.contract_value)}</p>
            </div>
            <div>
              <p className="text-xs text-green-400 mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Total Received
              </p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(summary.total_received)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-400 mb-1">Planned Cost</p>
              <p className="text-xl font-bold text-blue-400">{formatCurrency(summary.planned_cost)}</p>
            </div>
            <div>
              <p className="text-xs text-red-400 mb-1 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> Actual Cost
              </p>
              <p className="text-xl font-bold text-red-400">{formatCurrency(summary.actual_cost)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Remaining Liability</p>
              <p className="text-xl font-bold">{formatCurrency(summary.remaining_liability)}</p>
            </div>
            <div className={cn(
              "rounded-lg p-3 -m-2",
              summary.safe_surplus >= 0 ? "bg-green-600/20" : "bg-red-600/20"
            )}>
              <p className="text-xs text-slate-300 mb-1">Safe Surplus</p>
              <p className={cn(
                "text-2xl font-bold",
                summary.safe_surplus >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {formatCurrency(summary.safe_surplus)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {summary.safe_surplus >= 0 ? 'Available to use' : 'Deficit'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendor Mapping Section */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-600" />
              Vendor Mapping (Planned Costs)
            </CardTitle>
            {canEdit && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700" data-testid="add-vendor-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Vendor
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add Vendor Mapping</DialogTitle>
                    <DialogDescription>
                      Plan your project costs by adding vendors before spending starts.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="vendor_name">Vendor Name *</Label>
                      <Input
                        id="vendor_name"
                        value={newMapping.vendor_name}
                        onChange={(e) => setNewMapping(prev => ({ ...prev, vendor_name: e.target.value }))}
                        placeholder="Enter vendor name"
                        className="mt-1"
                        data-testid="vendor-name-input"
                      />
                    </div>
                    <div>
                      <Label>Category *</Label>
                      <Select value={newMapping.category} onValueChange={(v) => setNewMapping(prev => ({ ...prev, category: v }))}>
                        <SelectTrigger className="mt-1" data-testid="category-select">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {VENDOR_CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="planned_amount">Planned Amount (₹) *</Label>
                      <Input
                        id="planned_amount"
                        type="number"
                        value={newMapping.planned_amount}
                        onChange={(e) => setNewMapping(prev => ({ ...prev, planned_amount: e.target.value }))}
                        placeholder="Enter planned amount"
                        className="mt-1"
                        data-testid="amount-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={newMapping.notes}
                        onChange={(e) => setNewMapping(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Optional notes"
                        className="mt-1"
                        data-testid="notes-input"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddMapping} disabled={submitting} data-testid="save-vendor-btn">
                      {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Add Vendor
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {vendor_mappings.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500">No vendor mappings yet</p>
              {canEdit && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Vendor
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Planned Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Created By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    {canEdit && <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {vendor_mappings.map((vm) => (
                    <tr key={vm.mapping_id} className="hover:bg-slate-50" data-testid={`vendor-row-${vm.mapping_id}`}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{vm.vendor_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">{vm.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                        {formatCurrency(vm.planned_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">
                        {vm.notes || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{vm.created_by_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{formatDate(vm.created_at)}</td>
                      {canEdit && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingMapping({...vm})}
                              data-testid={`edit-vendor-${vm.mapping_id}`}
                            >
                              <Pencil className="w-4 h-4 text-slate-500" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`delete-vendor-${vm.mapping_id}`}>
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Vendor Mapping</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the mapping for "{vm.vendor_name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteMapping(vm.mapping_id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-slate-700">Total Planned</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right">
                      {formatCurrency(summary.planned_cost)}
                    </td>
                    <td colSpan={canEdit ? 4 : 3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Vendor Dialog */}
      <Dialog open={!!editingMapping} onOpenChange={(open) => !open && setEditingMapping(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Vendor Mapping</DialogTitle>
          </DialogHeader>
          {editingMapping && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit_vendor_name">Vendor Name *</Label>
                <Input
                  id="edit_vendor_name"
                  value={editingMapping.vendor_name}
                  onChange={(e) => setEditingMapping(prev => ({ ...prev, vendor_name: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={editingMapping.category} onValueChange={(v) => setEditingMapping(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_planned_amount">Planned Amount (₹) *</Label>
                <Input
                  id="edit_planned_amount"
                  type="number"
                  value={editingMapping.planned_amount}
                  onChange={(e) => setEditingMapping(prev => ({ ...prev, planned_amount: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit_notes">Notes</Label>
                <Textarea
                  id="edit_notes"
                  value={editingMapping.notes || ''}
                  onChange={(e) => setEditingMapping(prev => ({ ...prev, notes: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMapping(null)}>Cancel</Button>
            <Button onClick={handleUpdateMapping} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Planned vs Actual Comparison */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-slate-600" />
            Planned vs Actual (By Category)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {comparison.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500">No data to compare yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Planned</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actual</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Difference</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {comparison.map((row, idx) => (
                    <tr key={idx} className={cn("hover:bg-slate-50", row.over_budget && "bg-red-50")}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.category}</td>
                      <td className="px-4 py-3 text-sm text-blue-600 text-right">{formatCurrency(row.planned)}</td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-right">{formatCurrency(row.actual)}</td>
                      <td className={cn(
                        "px-4 py-3 text-sm font-semibold text-right",
                        row.difference >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {row.difference >= 0 ? '+' : ''}{formatCurrency(row.difference)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.over_budget ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Over
                          </Badge>
                        ) : row.actual > 0 ? (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            On Track
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">No spending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-lg font-semibold">
            Recent Transactions (From Cash Book)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500">No transactions linked to this project yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Account</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Paid To</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {transactions.slice(0, 20).map((txn) => (
                    <tr key={txn.transaction_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {formatDate(txn.created_at)}
                      </td>
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
                      <td className="px-4 py-3 text-sm text-slate-600">{txn.category_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{txn.account_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{txn.paid_to || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{txn.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length > 20 && (
                <div className="p-4 text-center border-t border-slate-200">
                  <p className="text-sm text-slate-500">Showing 20 of {transactions.length} transactions</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Receipts Section */}
      {hasPermission('finance.view_receipts') && (
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-600" />
              Receipts (This Project)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {projectReceipts.length === 0 ? (
              <div className="p-8 text-center">
                <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No receipts recorded for this project yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Receipt #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mode</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Account</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {projectReceipts.map((receipt) => (
                      <tr key={receipt.receipt_id} className="hover:bg-slate-50" data-testid={`project-receipt-${receipt.receipt_id}`}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-blue-600">{receipt.receipt_number}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(receipt.payment_date)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-green-600">{formatCurrency(receipt.amount)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs capitalize">{receipt.payment_mode?.replace('_', ' ')}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{receipt.account_name}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleViewReceipt(receipt.receipt_id)}
                              data-testid={`view-project-receipt-${receipt.receipt_id}`}
                            >
                              <Eye className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDownloadPDF(receipt.receipt_id, receipt.receipt_number)}
                              data-testid={`download-project-receipt-${receipt.receipt_id}`}
                            >
                              <Download className="w-4 h-4 text-blue-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-slate-700">Total Received</td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">
                        {formatCurrency(projectReceipts.reduce((sum, r) => sum + (r.amount || 0), 0))}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
            {viewReceipt && (
              <Button 
                onClick={() => handleDownloadPDF(viewReceipt.receipt_id, viewReceipt.receipt_number)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectFinanceDetail;
