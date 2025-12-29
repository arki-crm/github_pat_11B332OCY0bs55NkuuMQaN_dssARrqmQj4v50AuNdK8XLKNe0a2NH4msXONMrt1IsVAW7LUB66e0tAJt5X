import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Progress } from '../components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import {
  Loader2,
  Users,
  Phone,
  MapPin,
  FileText,
  Clock,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  UserPlus,
  DollarSign,
  Target,
  Calendar,
  CheckCircle2,
  XCircle,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Sales funnel stages
const FUNNEL_STAGES = [
  { key: "New Lead", label: "New", color: "slate" },
  { key: "BC Call Scheduled", label: "BC Scheduled", color: "blue" },
  { key: "BC Call Done", label: "BC Done", color: "blue" },
  { key: "Site Visit Scheduled", label: "SV Scheduled", color: "purple" },
  { key: "Site Visit Done", label: "SV Done", color: "purple" },
  { key: "Tentative BOQ Sent", label: "BOQ (Tent.)", color: "amber" },
  { key: "Revised BOQ Sent", label: "BOQ (Rev.)", color: "amber" },
  { key: "Negotiation", label: "Negotiation", color: "orange" },
  { key: "Waiting for Booking", label: "Waiting", color: "emerald" }
];

const SalesManagerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [designers, setDesigners] = useState([]);
  
  // Reassign modal state
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [newAssignee, setNewAssignee] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    if (user?.role && !['Admin', 'Manager', 'SalesManager'].includes(user.role)) {
      navigate('/dashboard');
      return;
    }
    fetchData();
    fetchDesigners();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/sales-manager/dashboard`, {
        withCredentials: true
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch sales dashboard:', err);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchDesigners = async () => {
    try {
      const response = await axios.get(`${API}/users?role=PreSales,HybridDesigner,Designer&status=Active`, {
        withCredentials: true
      });
      setDesigners(response.data.users || []);
    } catch (err) {
      console.error('Failed to fetch designers:', err);
    }
  };

  const handleReassign = async () => {
    if (!selectedLead || !newAssignee) {
      toast.error('Please select a new assignee');
      return;
    }
    
    try {
      setReassigning(true);
      await axios.post(`${API}/sales-manager/reassign-lead/${selectedLead.lead_id}`, {
        assignee_id: newAssignee,
        reason: reassignReason || 'Reassigned by Sales Manager'
      }, { withCredentials: true });
      
      toast.success('Lead reassigned successfully');
      setShowReassignModal(false);
      setSelectedLead(null);
      setNewAssignee('');
      setReassignReason('');
      fetchData();
    } catch (err) {
      toast.error('Failed to reassign lead');
    } finally {
      setReassigning(false);
    }
  };

  const openReassignModal = (lead) => {
    setSelectedLead(lead);
    setShowReassignModal(true);
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const summary = data?.summary || {};
  const funnel = data?.funnel || {};
  const designerPerformance = data?.designer_performance || [];
  const inactiveLeads = data?.inactive_leads || [];
  const noFollowupLeads = data?.no_followup_leads || [];
  const needsReassignment = data?.needs_reassignment || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-7 h-7 text-blue-600" />
            Sales Manager Dashboard
          </h1>
          <p className="text-sm text-slate-500">Monitor sales pipeline & designer performance</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-slate-500 uppercase">Active Leads</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{summary.total_active_leads || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="w-4 h-4 text-indigo-600" />
              <span className="text-xs text-slate-500 uppercase">BC Pending</span>
            </div>
            <p className="text-2xl font-bold text-indigo-600">{summary.bc_call_pending || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-slate-500 uppercase">SV Pending</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{summary.site_visit_pending || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-slate-500 uppercase">BOQ Sent</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {(summary.tentative_boq_sent || 0) + (summary.revised_boq_sent || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-emerald-600 uppercase">Ready to Book</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{summary.waiting_for_booking || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-xs text-green-600 uppercase">Pipeline</span>
            </div>
            <p className="text-lg font-bold text-green-700">{formatCurrency(summary.pipeline_value)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={cn(
          "border-slate-200",
          summary.inactive_count > 0 && "border-orange-200 bg-orange-50"
        )}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Inactive ({'>'}7 days)</p>
              <p className="text-xl font-bold text-orange-600">{summary.inactive_count || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-400" />
          </CardContent>
        </Card>

        <Card className={cn(
          "border-slate-200",
          summary.no_followup_count > 0 && "border-red-200 bg-red-50"
        )}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">No Follow-up</p>
              <p className="text-xl font-bold text-red-600">{summary.no_followup_count || 0}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </CardContent>
        </Card>

        <Card className={cn(
          "border-slate-200",
          summary.needs_reassignment_count > 0 && "border-amber-200 bg-amber-50"
        )}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Needs Reassignment</p>
              <p className="text-xl font-bold text-amber-600">{summary.needs_reassignment_count || 0}</p>
            </div>
            <UserPlus className="w-8 h-8 text-amber-400" />
          </CardContent>
        </Card>
      </div>

      {/* Sales Funnel */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Sales Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-48">
            {FUNNEL_STAGES.map((stage) => {
              const count = funnel[stage.key] || 0;
              const maxCount = Math.max(...Object.values(funnel), 1);
              const height = (count / maxCount) * 100;
              
              const colorClasses = {
                slate: 'bg-slate-400',
                blue: 'bg-blue-500',
                purple: 'bg-purple-500',
                amber: 'bg-amber-500',
                orange: 'bg-orange-500',
                emerald: 'bg-emerald-500'
              };
              
              return (
                <div key={stage.key} className="flex flex-col items-center flex-1">
                  <span className="text-sm font-semibold text-slate-700 mb-1">{count}</span>
                  <div 
                    className={cn(
                      "w-full rounded-t-md transition-all duration-300",
                      colorClasses[stage.color]
                    )}
                    style={{ height: `${Math.max(height, 5)}%` }}
                  />
                  <span className="text-xs text-slate-500 mt-2 text-center leading-tight">
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Designer Performance */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Designer Sales Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {designerPerformance.length > 0 ? (
              <div className="space-y-4">
                {designerPerformance.slice(0, 8).map((designer, idx) => (
                  <div key={designer.user_id} className="flex items-center gap-3">
                    <span className={cn(
                      "text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center",
                      idx === 0 && "bg-yellow-100 text-yellow-700",
                      idx === 1 && "bg-slate-100 text-slate-600",
                      idx === 2 && "bg-amber-100 text-amber-700",
                      idx > 2 && "bg-slate-50 text-slate-500"
                    )}>
                      {idx + 1}
                    </span>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={designer.picture} />
                      <AvatarFallback className="bg-slate-100 text-xs">
                        {getInitials(designer.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{designer.name}</p>
                      <p className="text-xs text-slate-500">
                        {designer.stats.total} leads • {designer.stats.waiting_booking} ready
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-bold",
                        designer.conversion_rate >= 20 && "text-green-600",
                        designer.conversion_rate >= 10 && designer.conversion_rate < 20 && "text-amber-600",
                        designer.conversion_rate < 10 && "text-slate-500"
                      )}>
                        {designer.conversion_rate}%
                      </p>
                      <p className="text-xs text-slate-400">conversion</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No designer data</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Items */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {/* Needs Reassignment */}
              {needsReassignment.map((lead) => (
                <div 
                  key={lead.lead_id}
                  className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{lead.client_name}</p>
                    <p className="text-xs text-slate-500">{lead.stage} • {lead.reason}</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="ml-2 text-xs"
                    onClick={() => openReassignModal(lead)}
                  >
                    <UserPlus className="w-3 h-3 mr-1" />
                    Reassign
                  </Button>
                </div>
              ))}

              {/* No Follow-up */}
              {noFollowupLeads.slice(0, 5).map((lead) => (
                <div 
                  key={lead.lead_id}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200 cursor-pointer hover:bg-red-100"
                  onClick={() => navigate(`/leads/${lead.lead_id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{lead.client_name}</p>
                    <p className="text-xs text-red-600">{lead.stage} • No follow-up scheduled</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}

              {/* Inactive Leads */}
              {inactiveLeads.slice(0, 5).map((lead) => (
                <div 
                  key={lead.lead_id}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200 cursor-pointer hover:bg-orange-100"
                  onClick={() => navigate(`/leads/${lead.lead_id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{lead.client_name}</p>
                    <p className="text-xs text-orange-600">{lead.stage} • {lead.days_inactive} days inactive</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}

              {needsReassignment.length === 0 && noFollowupLeads.length === 0 && inactiveLeads.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-2" />
                  <p className="text-slate-500">All leads are on track!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reassign Modal */}
      <Dialog open={showReassignModal} onOpenChange={setShowReassignModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Lead</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="font-medium text-slate-800">{selectedLead.client_name}</p>
                <p className="text-sm text-slate-500">{selectedLead.stage}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">New Assignee</label>
                <Select value={newAssignee} onValueChange={setNewAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select designer" />
                  </SelectTrigger>
                  <SelectContent>
                    {designers.map((d) => (
                      <SelectItem key={d.user_id} value={d.user_id}>
                        {d.name} ({d.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Reason (optional)</label>
                <Textarea
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Why is this lead being reassigned?"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReassignModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleReassign} disabled={reassigning || !newAssignee}>
              {reassigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesManagerDashboard;
