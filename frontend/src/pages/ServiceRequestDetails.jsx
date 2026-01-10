import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  Check,
  Clock,
  AlertTriangle,
  User,
  Phone,
  MapPin,
  Calendar,
  ChevronRight,
  Send,
  UserPlus,
  Camera,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SERVICE_STAGES = [
  'New', 'Assigned to Technician', 'Technician Visit Scheduled', 'Technician Visited',
  'Spare Parts Required', 'Waiting for Spares', 'Work In Progress', 'Completed', 'Closed'
];

const DELAY_REASONS = [
  'Customer not available', 'Spare not received', 'Workmanship not available',
  'Technician not available', 'Vendor delay', 'Factory delay', 'Revisit required',
  'Complex repair', 'Weather issue', 'Other'
];

const DELAY_OWNERS = ['Technician', 'Vendor', 'Company', 'Customer'];

const STAGE_STYLES = {
  'New': 'bg-blue-100 text-blue-700',
  'Assigned to Technician': 'bg-purple-100 text-purple-700',
  'Technician Visit Scheduled': 'bg-indigo-100 text-indigo-700',
  'Technician Visited': 'bg-cyan-100 text-cyan-700',
  'Spare Parts Required': 'bg-amber-100 text-amber-700',
  'Waiting for Spares': 'bg-orange-100 text-orange-700',
  'Work In Progress': 'bg-yellow-100 text-yellow-700',
  'Completed': 'bg-green-100 text-green-700',
  'Closed': 'bg-slate-100 text-slate-700'
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const ServiceRequestDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [sr, setSr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Technicians list
  const [technicians, setTechnicians] = useState([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  
  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStageConfirm, setShowStageConfirm] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [showClosureDateModal, setShowClosureDateModal] = useState(false);
  
  // Form states
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [pendingStage, setPendingStage] = useState(null);
  const [stageNotes, setStageNotes] = useState('');
  const [delayData, setDelayData] = useState({ delay_reason: '', delay_owner: '', new_expected_date: '', notes: '' });
  const [expectedClosureDate, setExpectedClosureDate] = useState('');
  const [commentText, setCommentText] = useState('');
  const [noteText, setNoteText] = useState('');
  
  // Loading states
  const [assigning, setAssigning] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [submittingDelay, setSubmittingDelay] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    fetchServiceRequest();
    fetchTechnicians();
  }, [id]);

  const fetchServiceRequest = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/service-requests/${id}`, { withCredentials: true });
      setSr(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load service request');
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      setLoadingTechnicians(true);
      const response = await axios.get(`${API}/technicians`, { withCredentials: true });
      setTechnicians(response.data);
    } catch (err) {
      console.error('Failed to fetch technicians:', err);
    } finally {
      setLoadingTechnicians(false);
    }
  };

  const handleAssignTechnician = async () => {
    if (!selectedTechnician) { toast.error('Please select a technician'); return; }
    try {
      setAssigning(true);
      await axios.put(`${API}/service-requests/${id}/assign`, { technician_id: selectedTechnician }, { withCredentials: true });
      toast.success('Technician assigned successfully');
      setShowAssignModal(false);
      fetchServiceRequest();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to assign technician');
    } finally {
      setAssigning(false);
    }
  };

  const initiateStageChange = (stage) => {
    // Check if we need delay modal (SLA breach)
    const now = new Date();
    const slaDate = new Date(sr.sla_visit_by);
    const expectedClosure = sr.expected_closure_date ? new Date(sr.expected_closure_date) : null;
    
    if (stage === 'Technician Visited' && !sr.actual_visit_date && now > slaDate) {
      // Visit SLA breach - show delay modal first
      setPendingStage(stage);
      setShowDelayModal(true);
      return;
    }
    
    if ((stage === 'Completed' || stage === 'Closed') && expectedClosure && now > expectedClosure && sr.stage !== 'Completed') {
      // Closure SLA breach - show delay modal first
      setPendingStage(stage);
      setShowDelayModal(true);
      return;
    }
    
    // If moving to Technician Visited, ask for expected closure date
    if (stage === 'Technician Visited' && !sr.expected_closure_date) {
      setPendingStage(stage);
      setShowClosureDateModal(true);
      return;
    }
    
    setPendingStage(stage);
    setShowStageConfirm(true);
  };

  const confirmStageChange = async () => {
    try {
      setUpdatingStage(true);
      await axios.put(`${API}/service-requests/${id}/stage`, { stage: pendingStage, notes: stageNotes }, { withCredentials: true });
      toast.success(`Stage updated to ${pendingStage}`);
      setShowStageConfirm(false);
      setStageNotes('');
      fetchServiceRequest();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update stage');
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleSetClosureDate = async () => {
    if (!expectedClosureDate) { toast.error('Please select expected closure date'); return; }
    try {
      await axios.put(`${API}/service-requests/${id}/expected-closure`, { expected_closure_date: expectedClosureDate }, { withCredentials: true });
      toast.success('Expected closure date set');
      setShowClosureDateModal(false);
      // Now proceed with stage change
      setShowStageConfirm(true);
      fetchServiceRequest();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to set closure date');
    }
  };

  const handleSubmitDelay = async () => {
    if (!delayData.delay_reason || !delayData.delay_owner || !delayData.new_expected_date) {
      toast.error('Please fill all required delay fields');
      return;
    }
    try {
      setSubmittingDelay(true);
      await axios.post(`${API}/service-requests/${id}/delay`, delayData, { withCredentials: true });
      toast.success('Delay logged successfully');
      setShowDelayModal(false);
      setDelayData({ delay_reason: '', delay_owner: '', new_expected_date: '', notes: '' });
      // Now proceed with stage change
      setShowStageConfirm(true);
      fetchServiceRequest();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to log delay');
    } finally {
      setSubmittingDelay(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      setSubmittingComment(true);
      await axios.post(`${API}/service-requests/${id}/comments`, { message: commentText }, { withCredentials: true });
      setCommentText('');
      fetchServiceRequest();
    } catch (err) {
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      await axios.post(`${API}/service-requests/${id}/notes`, { note: noteText }, { withCredentials: true });
      setNoteText('');
      toast.success('Note added');
      fetchServiceRequest();
    } catch (err) {
      toast.error('Failed to add note');
    }
  };

  const canAssign = ['Admin', 'SalesManager', 'ProductionOpsManager'].includes(user?.role);
  const canUpdateStage = user?.role !== 'PreSales' && (user?.role !== 'Technician' || sr?.assigned_technician_id === user?.user_id);
  const currentStageIndex = sr ? SERVICE_STAGES.indexOf(sr.stage) : 0;

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/service-requests')}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <Card><CardContent className="flex flex-col items-center justify-center py-16"><AlertCircle className="w-12 h-12 text-red-400 mb-4" /><p className="text-red-600">{error}</p></CardContent></Card>
      </div>
    );
  }

  const slaDate = new Date(sr.sla_visit_by);
  const now = new Date();
  const isSlaBreach = !sr.actual_visit_date && now > slaDate && sr.stage !== 'Closed' && sr.stage !== 'Completed';

  return (
    <div className="space-y-6" data-testid="service-request-details">
      <Button variant="ghost" size="sm" onClick={() => navigate('/service-requests')}><ArrowLeft className="w-4 h-4 mr-2" />Back to Service Requests</Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{sr.service_request_id}</h1>
            {sr.pid && <span className="font-mono text-sm bg-slate-900 text-white px-2 py-0.5 rounded">{sr.pid.replace('ARKI-', '')}</span>}
            <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STAGE_STYLES[sr.stage])}>{sr.stage}</span>
          </div>
          <p className="text-slate-500 mt-1">Created {formatDate(sr.created_at)} • {sr.source}</p>
        </div>
        <div className="flex gap-2">
          {canAssign && sr.stage === 'New' && (
            <Button onClick={() => setShowAssignModal(true)} className="bg-purple-600 hover:bg-purple-700"><UserPlus className="w-4 h-4 mr-2" />Assign Technician</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader><CardTitle className="text-base">Customer Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400" /><span>{sr.customer_name}</span></div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /><span>{sr.customer_phone}</span></div>
              {sr.customer_address && <div className="col-span-2 flex items-start gap-2"><MapPin className="w-4 h-4 text-slate-400 mt-0.5" /><span>{sr.customer_address}</span></div>}
            </CardContent>
          </Card>

          {/* Issue Details */}
          <Card>
            <CardHeader><CardTitle className="text-base">Issue Details</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div><Label className="text-xs text-slate-500">Category</Label><p className="font-medium">{sr.issue_category}</p></div>
                <div><Label className="text-xs text-slate-500">Description</Label><p className="text-slate-700">{sr.issue_description}</p></div>
                {sr.issue_images?.length > 0 && (
                  <div><Label className="text-xs text-slate-500">Images</Label>
                    <div className="flex gap-2 mt-1">
                      {sr.issue_images.map((img, i) => <a key={i} href={img.url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline">Image {i+1}</a>)}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* SLA Panel */}
          <Card className={isSlaBreach ? 'border-red-300 bg-red-50' : ''}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2">{isSlaBreach && <AlertTriangle className="w-4 h-4 text-red-600" />}SLA Tracking</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><Label className="text-xs text-slate-500">SLA Visit By</Label><p className={isSlaBreach ? 'text-red-600 font-medium' : ''}>{formatDate(sr.sla_visit_by)}</p></div>
                <div><Label className="text-xs text-slate-500">Actual Visit</Label><p>{sr.actual_visit_date ? formatDate(sr.actual_visit_date) : '—'}</p></div>
                <div><Label className="text-xs text-slate-500">Expected Closure</Label><p>{sr.expected_closure_date || '—'}</p></div>
                <div><Label className="text-xs text-slate-500">Actual Closure</Label><p>{sr.actual_closure_date ? formatDate(sr.actual_closure_date) : '—'}</p></div>
                <div><Label className="text-xs text-slate-500">Delay Count</Label><p className={sr.delay_count > 0 ? 'text-amber-600 font-medium' : ''}>{sr.delay_count}</p></div>
                <div><Label className="text-xs text-slate-500">Last Delay Reason</Label><p>{sr.last_delay_reason || '—'}</p></div>
                <div><Label className="text-xs text-slate-500">Delay Owner</Label><p>{sr.last_delay_owner || '—'}</p></div>
                <div><Label className="text-xs text-slate-500">Technician</Label><p>{sr.assigned_technician_name || '—'}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader><CardTitle className="text-base">Activity Timeline</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {[...(sr.timeline || [])].reverse().map((entry) => (
                    <div key={entry.id} className="flex gap-3 text-sm border-l-2 border-slate-200 pl-3 py-1">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{entry.action}</p>
                        <p className="text-xs text-slate-500">{entry.user_name} • {formatDate(entry.timestamp)}</p>
                        {entry.notes && <p className="text-slate-600 mt-1">{entry.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader><CardTitle className="text-base">Comments</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                {(sr.comments || []).map((c) => (
                  <div key={c.id} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-sm">{c.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{c.user_name} • {formatDate(c.created_at)}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} />
                <Button onClick={handleAddComment} disabled={submittingComment || !commentText.trim()} size="icon"><Send className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions & Stage */}
        <div className="space-y-6">
          {/* Stage Progression */}
          <Card>
            <CardHeader><CardTitle className="text-base">Workflow Stages</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {SERVICE_STAGES.map((stage, index) => {
                  const isComplete = index < currentStageIndex;
                  const isCurrent = index === currentStageIndex;
                  const isNext = index === currentStageIndex + 1;
                  const canClick = isNext && canUpdateStage && sr.stage !== 'Closed';
                  
                  return (
                    <button
                      key={stage}
                      onClick={() => canClick && initiateStageChange(stage)}
                      disabled={!canClick}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors",
                        isComplete && "bg-green-50 text-green-700",
                        isCurrent && "bg-blue-100 text-blue-700 font-medium",
                        isNext && canClick && "bg-slate-50 hover:bg-slate-100 cursor-pointer",
                        !isComplete && !isCurrent && !isNext && "text-slate-400"
                      )}
                    >
                      {isComplete ? <Check className="w-4 h-4" /> : isCurrent ? <Clock className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                      {stage}
                      {canClick && <ChevronRight className="w-4 h-4 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Technician Notes */}
          {user?.role === 'Technician' && sr.assigned_technician_id === user.user_id && (
            <Card>
              <CardHeader><CardTitle className="text-base">Add Note</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add technician note..." rows={3} />
                <Button onClick={handleAddNote} disabled={!noteText.trim()} className="w-full mt-2"><FileText className="w-4 h-4 mr-2" />Add Note</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Technician</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
              <SelectContent>
                {technicians.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.name} ({t.open_requests} open)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button onClick={handleAssignTechnician} disabled={assigning} className="bg-purple-600 hover:bg-purple-700">
              {assigning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage Confirm Dialog */}
      <AlertDialog open={showStageConfirm} onOpenChange={setShowStageConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Stage Change</AlertDialogTitle>
            <AlertDialogDescription>Move this service request to "{pendingStage}"? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Notes (optional)</Label>
            <Textarea value={stageNotes} onChange={(e) => setStageNotes(e.target.value)} placeholder="Add any notes..." rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStageChange} disabled={updatingStage}>
              {updatingStage ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delay Modal */}
      <Dialog open={showDelayModal} onOpenChange={setShowDelayModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="w-5 h-5" />Delay Detected</DialogTitle>
            <DialogDescription>The SLA deadline has passed. Please provide delay details before proceeding.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Delay Reason *</Label>
              <Select value={delayData.delay_reason} onValueChange={(v) => setDelayData(p => ({ ...p, delay_reason: v }))}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>{DELAY_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Delay Owner *</Label>
              <Select value={delayData.delay_owner} onValueChange={(v) => setDelayData(p => ({ ...p, delay_owner: v }))}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>{DELAY_OWNERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>New Expected Closure Date *</Label>
              <Input type="date" value={delayData.new_expected_date} onChange={(e) => setDelayData(p => ({ ...p, new_expected_date: e.target.value }))} />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={delayData.notes} onChange={(e) => setDelayData(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelayModal(false)}>Cancel</Button>
            <Button onClick={handleSubmitDelay} disabled={submittingDelay} className="bg-amber-600 hover:bg-amber-700">
              {submittingDelay ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Log Delay & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expected Closure Date Modal */}
      <Dialog open={showClosureDateModal} onOpenChange={setShowClosureDateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Expected Closure Date</DialogTitle>
            <DialogDescription>Please set the expected date for completing this service request.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Expected Closure Date *</Label>
              <Input type="date" value={expectedClosureDate} onChange={(e) => setExpectedClosureDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClosureDateModal(false)}>Cancel</Button>
            <Button onClick={handleSetClosureDate} className="bg-blue-600 hover:bg-blue-700">Set Date & Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceRequestDetails;
