import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  Send, 
  Check, 
  Clock, 
  AlertTriangle,
  UserPlus,
  ArrowRightCircle,
  X,
  CalendarDays,
  Plus,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  Pause,
  Play,
  Power
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import MeetingModal from '../components/MeetingModal';
import MeetingCard from '../components/MeetingCard';
import CustomerDetailsSection from '../components/CustomerDetailsSection';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Lead stages
const LEAD_STAGES = [
  "BC Call Done",
  "BOQ Shared",
  "Site Meeting",
  "Revised BOQ Shared",
  "Waiting for Booking",
  "Booking Completed"
];

const STAGE_COLORS = {
  'BC Call Done': { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-400' },
  'BOQ Shared': { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-400' },
  'Site Meeting': { bg: 'bg-cyan-100', text: 'text-cyan-700', ring: 'ring-cyan-400' },
  'Revised BOQ Shared': { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-400' },
  'Waiting for Booking': { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-400' },
  'Booking Completed': { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-400' }
};

const STATUS_STYLES = {
  'New': 'bg-blue-100 text-blue-700',
  'Contacted': 'bg-amber-100 text-amber-700',
  'Waiting': 'bg-purple-100 text-purple-700',
  'Qualified': 'bg-green-100 text-green-700',
  'Dropped': 'bg-red-100 text-red-700'
};

const ROLE_BADGE_STYLES = {
  Admin: 'bg-purple-100 text-purple-700',
  Manager: 'bg-blue-100 text-blue-700',
  Designer: 'bg-pink-100 text-pink-700',
  PreSales: 'bg-orange-100 text-orange-700'
};

// Format helpers
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const getAvatarColor = (name) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
    'bg-amber-500', 'bg-cyan-500', 'bg-red-500', 'bg-indigo-500'
  ];
  const index = name ? name.charCodeAt(0) % colors.length : 0;
  return colors[index];
};

// ============ TIMELINE COMPONENT ============
const LeadTimelinePanel = ({ timeline, currentStage }) => {
  const currentStageIndex = LEAD_STAGES.indexOf(currentStage);

  // Format date for display (DD/MM/YYYY)
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusDotColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'delayed':
        return 'bg-red-500';
      default:
        return 'bg-slate-300';
    }
  };

  return (
    <div data-testid="lead-timeline-panel">
      <h3 className="text-sm font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Lead Timeline
      </h3>
      
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200" />
        
        <div className="space-y-3">
          {timeline?.map((item, index) => {
            const itemStageIndex = LEAD_STAGES.indexOf(item.stage_ref);
            const isCompleted = item.status === 'completed' || itemStageIndex < currentStageIndex;
            const isCurrent = item.stage_ref === currentStage;
            const isDelayed = item.status === 'delayed';
            
            return (
              <div key={item.id || index} className="relative flex gap-3" data-testid={`timeline-item-${index}`}>
                {/* Status dot */}
                <div className={cn(
                  "relative z-10 w-6 h-6 rounded-full flex items-center justify-center",
                  isCompleted ? 'bg-green-500' :
                  isDelayed ? 'bg-red-500' :
                  isCurrent ? 'bg-blue-500' : 'bg-white border-2 border-slate-300'
                )}>
                  {isCompleted ? (
                    <Check className="w-3 h-3 text-white" />
                  ) : isDelayed ? (
                    <AlertTriangle className="w-3 h-3 text-white" />
                  ) : (
                    <Clock className="w-3 h-3 text-slate-400" />
                  )}
                </div>
                
                {/* Content */}
                <div className={cn(
                  "flex-1 p-2.5 rounded-lg border",
                  isCompleted ? 'bg-green-50 border-green-200' :
                  isDelayed ? 'bg-red-50 border-red-200' :
                  isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
                )}>
                  <p className={cn(
                    "text-sm font-medium",
                    isCompleted ? 'text-green-700' :
                    isDelayed ? 'text-red-700' :
                    isCurrent ? 'text-blue-700' : 'text-slate-700'
                  )}>{item.title}</p>
                  
                  {/* Date display */}
                  <div className="flex flex-col gap-0.5 mt-1">
                    {item.expectedDate && (
                      <p className={cn(
                        "text-xs",
                        isDelayed ? 'text-red-500' : 'text-slate-500'
                      )}>
                        Expected: {formatDisplayDate(item.expectedDate)}
                      </p>
                    )}
                    {item.completedDate && (
                      <p className="text-xs text-green-600">
                        Completed: {formatDisplayDate(item.completedDate)}
                      </p>
                    )}
                    {/* Fallback to old date field if new fields not present */}
                    {!item.expectedDate && !item.completedDate && item.date && (
                      <p className="text-xs text-slate-500">{formatDisplayDate(item.date)}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============ COMMENTS COMPONENT ============
const LeadCommentsPanel = ({ comments, onAddComment, isSubmitting }) => {
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    onAddComment(newMessage.trim());
    setNewMessage('');
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  return (
    <div className="flex flex-col h-full" data-testid="lead-comments-panel">
      <h3 className="text-sm font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Activity & Comments
      </h3>
      
      <ScrollArea className="flex-1 pr-3" ref={scrollRef}>
        <div className="space-y-4">
          {comments?.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No comments yet.</p>
          )}
          {comments?.map((comment) => (
            <div 
              key={comment.id} 
              className={cn(
                "rounded-lg p-3",
                comment.is_system ? "bg-slate-100 border border-slate-200" : "bg-white border border-slate-200"
              )}
              data-testid={`comment-${comment.id}`}
            >
              {comment.is_system ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-600 italic">{comment.message}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(comment.created_at)}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white",
                      getAvatarColor(comment.user_name)
                    )}>
                      {getInitials(comment.user_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{comment.user_name}</span>
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full",
                          ROLE_BADGE_STYLES[comment.role] || 'bg-slate-100 text-slate-600'
                        )}>
                          {comment.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{formatRelativeTime(comment.created_at)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 pl-9">{comment.message}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <Input
          type="text"
          placeholder="Add a comment..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1"
          data-testid="lead-comment-input"
        />
        <Button 
          type="submit" 
          disabled={!newMessage.trim() || isSubmitting}
          className="bg-blue-600 hover:bg-blue-700"
          data-testid="send-lead-comment-btn"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
};

// ============ STAGES PANEL ============
const LeadStagesPanel = ({ 
  currentStage, 
  onStageChange, 
  canChangeStage, 
  isUpdating,
  designerDetails,
  onAssignDesigner,
  canAssignDesigner,
  onConvertToProject,
  canConvert,
  userRole
}) => {
  const currentIndex = LEAD_STAGES.indexOf(currentStage);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, targetStage: null });
  
  // Check if stage is in the past (already completed)
  const isPastStage = (stage) => {
    const stageIndex = LEAD_STAGES.indexOf(stage);
    return stageIndex < currentIndex;
  };
  
  // Check if this is the next valid stage
  const isNextStage = (stage) => {
    const stageIndex = LEAD_STAGES.indexOf(stage);
    return stageIndex === currentIndex + 1;
  };
  
  // Can click on a stage
  const canClickStage = (stage) => {
    if (!canChangeStage || isUpdating) return false;
    const stageIndex = LEAD_STAGES.indexOf(stage);
    if (stageIndex === currentIndex) return false; // Current stage
    if (stageIndex < currentIndex) return userRole === 'Admin'; // Only Admin can rollback
    return true; // Future stages allowed
  };
  
  const handleStageClick = (stage) => {
    if (!canClickStage(stage)) return;
    setConfirmDialog({ open: true, targetStage: stage });
  };
  
  const confirmStageChange = () => {
    if (confirmDialog.targetStage) {
      onStageChange(confirmDialog.targetStage);
    }
    setConfirmDialog({ open: false, targetStage: null });
  };

  return (
    <div data-testid="lead-stages-panel">
      <h3 className="text-sm font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Lead Stage
      </h3>
      
      {/* Forward-only notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4">
        <p className="text-xs text-blue-600 flex items-center gap-1">
          <ChevronRight className="w-3 h-3" />
          Forward-only progression
        </p>
      </div>
      
      <div className="relative mb-6">
        {/* Vertical connector line */}
        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200" />
        
        <div className="space-y-2">
          {LEAD_STAGES.map((stage, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isNext = isNextStage(stage);
            const stageColors = STAGE_COLORS[stage];
            const canClick = canClickStage(stage);
            
            return (
              <button
                key={stage}
                onClick={() => canClick && handleStageClick(stage)}
                disabled={!canClick}
                className={cn(
                  "relative flex items-center gap-3 w-full p-2.5 rounded-lg transition-all text-left",
                  canClick ? "cursor-pointer hover:bg-slate-50" : "cursor-not-allowed",
                  isCurrent && "ring-2 ring-offset-1",
                  isCurrent && stageColors.ring,
                  isCompleted && "opacity-60"
                )}
                data-testid={`lead-stage-${stage.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <div className={cn(
                  "relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2",
                  isCompleted ? "bg-green-500 border-green-500" :
                  isCurrent ? `${stageColors.bg} border-current ${stageColors.text}` :
                  "bg-white border-slate-300"
                )}>
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : isCurrent ? (
                    <div className={cn("w-2 h-2 rounded-full", stageColors.bg.replace('100', '500'))} />
                  ) : (
                    <span className="text-xs text-slate-400">{index + 1}</span>
                  )}
                </div>
                
                <div className="flex-1">
                  <span className={cn(
                    "text-sm font-medium",
                    isCompleted && "line-through text-slate-500",
                    isCurrent ? stageColors.text : !isCompleted && "text-slate-600"
                  )}>
                    {stage}
                  </span>
                </div>
                
                {isUpdating && isCurrent && (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                )}
                {isNext && canChangeStage && !isUpdating && (
                  <ChevronRight className="w-4 h-4 text-blue-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!canChangeStage && (
        <p className="text-xs text-slate-500 text-center mb-4">
          You don&apos;t have permission to change the stage
        </p>
      )}

      {/* Designer Assignment */}
      <div className="border-t border-slate-200 pt-4 mt-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Designer</h4>
        
        {designerDetails ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white",
              getAvatarColor(designerDetails.name)
            )}>
              {getInitials(designerDetails.name)}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{designerDetails.name}</p>
              <p className="text-xs text-slate-500">Assigned Designer</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="text-sm text-slate-500 mb-2">No designer assigned</p>
            {canAssignDesigner && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAssignDesigner}
                className="w-full"
                data-testid="assign-designer-btn"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Assign Designer
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Convert to Project */}
      {canConvert && currentStage === 'Booking Completed' && (
        <div className="border-t border-slate-200 pt-4 mt-4">
          <Button
            onClick={onConvertToProject}
            className="w-full bg-green-600 hover:bg-green-700"
            data-testid="convert-to-project-btn"
          >
            <ArrowRightCircle className="w-4 h-4 mr-2" />
            Convert to Project
          </Button>
        </div>
      )}
      
      {/* Stage Change Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, targetStage: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ChevronRight className="w-5 h-5 text-blue-500" />
              Update Stage
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update the stage to <strong className="text-blue-600">&quot;{confirmDialog.targetStage}&quot;</strong>?
              <br /><br />
              <span className="text-amber-600 text-sm">
                ⚠️ This action cannot be undone. Stage progression is forward-only.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStageChange}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ============ MAIN COMPONENT ============
const LeadDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [showDesignerDialog, setShowDesignerDialog] = useState(false);
  const [designers, setDesigners] = useState([]);
  const [loadingDesigners, setLoadingDesigners] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [converting, setConverting] = useState(false);
  
  // Meetings state
  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  
  // Collaborators state
  const [collaborators, setCollaborators] = useState([]);
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addingCollaborator, setAddingCollaborator] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState('');
  const [collaboratorReason, setCollaboratorReason] = useState('');
  
  // Hold/Activate/Deactivate state
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdAction, setHoldAction] = useState(null); // 'Hold', 'Activate', 'Deactivate'
  const [holdReason, setHoldReason] = useState('');
  const [isUpdatingHoldStatus, setIsUpdatingHoldStatus] = useState(false);

  // Fetch lead
  const fetchLead = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/leads/${id}`, {
        withCredentials: true
      });
      setLead(response.data);
    } catch (err) {
      console.error('Failed to fetch lead:', err);
      if (err.response?.status === 403) {
        toast.error('Access denied');
        navigate('/dashboard', { replace: true });
      } else {
        setError(err.response?.data?.detail || 'Failed to load lead');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchLead();
      fetchMeetings();
      fetchCollaborators();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Fetch meetings for this lead
  const fetchMeetings = async () => {
    try {
      setLoadingMeetings(true);
      const response = await axios.get(`${API}/leads/${id}/meetings`, {
        withCredentials: true
      });
      setMeetings(response.data || []);
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoadingMeetings(false);
    }
  };

  // Handle meeting status update
  const handleMeetingStatusUpdate = async (meetingId, status) => {
    try {
      await axios.put(`${API}/meetings/${meetingId}`, { status }, {
        withCredentials: true
      });
      toast.success(`Meeting ${status.toLowerCase()}`);
      fetchMeetings();
    } catch (err) {
      console.error('Failed to update meeting:', err);
      toast.error('Failed to update meeting');
    }
  };

  // Fetch collaborators
  const fetchCollaborators = async () => {
    try {
      const response = await axios.get(`${API}/leads/${id}/collaborators`, {
        withCredentials: true
      });
      setCollaborators(response.data.collaborators || []);
    } catch (err) {
      console.error('Failed to fetch collaborators:', err);
    }
  };

  // Fetch all users for collaborator selection
  const fetchAllUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await axios.get(`${API}/users`, {
        withCredentials: true
      });
      setAllUsers(response.data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Add collaborator
  const handleAddCollaborator = async () => {
    if (!selectedCollaborator) {
      toast.error('Please select a user');
      return;
    }
    
    try {
      setAddingCollaborator(true);
      await axios.post(`${API}/leads/${id}/collaborators`, 
        { 
          user_id: selectedCollaborator,
          reason: collaboratorReason || 'Added as collaborator'
        },
        { withCredentials: true }
      );
      toast.success('Collaborator added');
      setShowCollaboratorModal(false);
      setSelectedCollaborator('');
      setCollaboratorReason('');
      fetchCollaborators();
      fetchLead(); // Refresh to get updated comments
    } catch (err) {
      console.error('Failed to add collaborator:', err);
      toast.error(err.response?.data?.detail || 'Failed to add collaborator');
    } finally {
      setAddingCollaborator(false);
    }
  };

  // Remove collaborator
  const handleRemoveCollaborator = async (collaboratorUserId) => {
    try {
      await axios.delete(`${API}/leads/${id}/collaborators/${collaboratorUserId}`, {
        withCredentials: true
      });
      toast.success('Collaborator removed');
      fetchCollaborators();
      fetchLead();
    } catch (err) {
      console.error('Failed to remove collaborator:', err);
      toast.error(err.response?.data?.detail || 'Failed to remove collaborator');
    }
  };

  // Can add collaborator
  const canAddCollaborator = () => {
    if (!user || !lead) return false;
    // Admin, SalesManager can always add
    if (user.role === 'Admin' || user.role === 'SalesManager' || user.role === 'Manager') return true;
    // Lead owner/designer can add
    return lead.assigned_to === user.user_id || lead.designer_id === user.user_id;
  };

  // Add comment
  const handleAddComment = async (message) => {
    try {
      setIsSubmittingComment(true);
      const response = await axios.post(`${API}/leads/${id}/comments`, 
        { message },
        { withCredentials: true }
      );
      
      setLead(prev => ({
        ...prev,
        comments: [...(prev.comments || []), response.data]
      }));
      
      toast.success('Comment added');
    } catch (err) {
      console.error('Failed to add comment:', err);
      toast.error('Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Update stage
  const handleStageChange = async (newStage) => {
    if (newStage === lead?.stage) return;
    
    try {
      setIsUpdatingStage(true);
      await axios.put(`${API}/leads/${id}/stage`,
        { stage: newStage },
        { withCredentials: true }
      );
      
      await fetchLead();
      toast.success(`Stage updated to "${newStage}"`);
    } catch (err) {
      console.error('Failed to update stage:', err);
      toast.error(err.response?.data?.detail || 'Failed to update stage');
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // Fetch designers
  const fetchDesigners = async () => {
    try {
      setLoadingDesigners(true);
      const response = await axios.get(`${API}/users/designers`, {
        withCredentials: true
      });
      setDesigners(response.data);
    } catch (err) {
      console.error('Failed to fetch designers:', err);
      toast.error('Failed to load designers');
    } finally {
      setLoadingDesigners(false);
    }
  };

  // Assign designer
  const handleAssignDesigner = async (designerId) => {
    try {
      setAssigning(true);
      await axios.put(`${API}/leads/${id}/assign-designer`,
        { designer_id: designerId },
        { withCredentials: true }
      );
      
      await fetchLead();
      setShowDesignerDialog(false);
      toast.success('Designer assigned successfully');
    } catch (err) {
      console.error('Failed to assign designer:', err);
      toast.error(err.response?.data?.detail || 'Failed to assign designer');
    } finally {
      setAssigning(false);
    }
  };

  // Convert to project
  const handleConvertToProject = async () => {
    try {
      setConverting(true);
      const response = await axios.post(`${API}/leads/${id}/convert`, {}, {
        withCredentials: true
      });
      
      toast.success('Lead converted to project!');
      navigate(`/projects/${response.data.project_id}`);
    } catch (err) {
      console.error('Failed to convert lead:', err);
      toast.error(err.response?.data?.detail || 'Failed to convert lead');
    } finally {
      setConverting(false);
    }
  };

  // Update customer details
  const handleUpdateCustomerDetails = async (updatedData) => {
    try {
      await axios.put(`${API}/leads/${id}/customer-details`, updatedData, {
        withCredentials: true
      });
      toast.success('Customer details updated');
      fetchLead(); // Refresh lead data
    } catch (err) {
      console.error('Failed to update customer details:', err);
      toast.error(err.response?.data?.detail || 'Failed to update customer details');
      throw err;
    }
  };

  // Permission checks
  const canChangeStage = () => {
    if (!user || !lead) return false;
    if (user.role === 'Designer') return false;
    if (user.role === 'Admin' || user.role === 'SalesManager') return true;
    if (user.role === 'PreSales') {
      return lead.assigned_to === user.user_id;
    }
    return false;
  };

  const canAssignDesigner = () => {
    return user?.role === 'Admin' || user?.role === 'SalesManager';
  };

  const canConvert = () => {
    return user?.role === 'Admin' || user?.role === 'SalesManager';
  };
  
  // Can edit customer details
  const canEditCustomerDetails = () => {
    if (!user || !lead) return false;
    // Admin/SalesManager can always edit
    if (user.role === 'Admin' || user.role === 'SalesManager') return true;
    // PreSales can edit their own leads BEFORE qualified
    if (user.role === 'PreSales') {
      return lead.assigned_to === user.user_id && lead.status !== 'Qualified';
    }
    // Designer cannot edit
    return false;
  };
  
  // Hold/Activate/Deactivate permission checks
  const canHold = () => {
    if (!user) return false;
    return ['Admin', 'Manager', 'SalesManager', 'Designer'].includes(user.role);
  };
  
  const canActivateOrDeactivate = () => {
    if (!user) return false;
    return ['Admin', 'Manager', 'SalesManager'].includes(user.role);
  };
  
  // Handle hold status actions
  const openHoldModal = (action) => {
    setHoldAction(action);
    setHoldReason('');
    setShowHoldModal(true);
  };
  
  const handleHoldStatusUpdate = async () => {
    if (!holdReason.trim()) {
      toast.error('Please provide a reason for this action');
      return;
    }
    
    try {
      setIsUpdatingHoldStatus(true);
      await axios.put(`${API}/leads/${id}/hold-status`, {
        action: holdAction,
        reason: holdReason.trim()
      }, { withCredentials: true });
      
      toast.success(`Lead ${holdAction.toLowerCase()}d successfully`);
      setShowHoldModal(false);
      setHoldReason('');
      setHoldAction(null);
      await fetchLead();
    } catch (err) {
      console.error('Failed to update hold status:', err);
      toast.error(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setIsUpdatingHoldStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="lead-loading">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" data-testid="lead-error">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/leads')}
          className="text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Leads
        </Button>
        
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="lead-details-page">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => navigate('/leads')}
        className="text-slate-600 hover:text-slate-900 -ml-2"
        data-testid="back-to-leads-btn"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Leads
      </Button>

      {/* Lead Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* PID Badge - Always visible if exists */}
            {lead?.pid && (
              <span 
                className="inline-flex items-center rounded-md bg-slate-900 px-2.5 py-1 text-sm font-mono font-bold text-white"
                data-testid="lead-pid-badge"
              >
                {lead.pid}
              </span>
            )}
            <h1 
              className="text-2xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              {lead?.customer_name}
            </h1>
            {user?.role && (
              <span 
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  ROLE_BADGE_STYLES[user.role]
                )}
                data-testid="user-role-badge"
              >
                {user.role}
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1">
            {lead?.pid && <span className="font-medium text-slate-700">{lead.pid} • </span>}
            Phone: {lead?.customer_phone} • Source: {lead?.source} • Updated {formatRelativeTime(lead?.updated_at)}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {lead?.status && (
            <span 
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
                STATUS_STYLES[lead.status]
              )}
              data-testid="lead-status-badge"
            >
              {lead.status}
            </span>
          )}
          {lead?.stage && (
            <span 
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
                STAGE_COLORS[lead.stage]?.bg,
                STAGE_COLORS[lead.stage]?.text
              )}
              data-testid="lead-stage-badge"
            >
              {lead.stage}
            </span>
          )}
        </div>
      </div>

      {/* Converted notice */}
      {lead?.is_converted && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600" />
              <p className="text-green-700">This lead has been converted to a project.</p>
            </div>
            {lead.project_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/projects/${lead.project_id}`)}
                className="text-green-700 border-green-300 hover:bg-green-100"
              >
                View Project
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Customer Details Section - Always visible */}
      <CustomerDetailsSection
        data={lead}
        canEdit={canEditCustomerDetails()}
        onSave={handleUpdateCustomerDetails}
        isProject={false}
      />

      {/* Three Column Layout */}
      {!lead?.is_converted && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Timeline (25%) */}
          <Card className="border-slate-200 lg:col-span-1">
            <CardContent className="p-4">
              <LeadTimelinePanel 
                timeline={lead?.timeline || []} 
                currentStage={lead?.stage}
              />
            </CardContent>
          </Card>

          {/* Center Column - Comments (50%) */}
          <Card className="border-slate-200 lg:col-span-2 flex flex-col" style={{ minHeight: '500px' }}>
            <CardContent className="p-4 flex-1 flex flex-col">
              <LeadCommentsPanel 
                comments={lead?.comments || []}
                onAddComment={handleAddComment}
                isSubmitting={isSubmittingComment}
              />
            </CardContent>
          </Card>

          {/* Right Column - Stages + Actions (25%) */}
          <Card className="border-slate-200 lg:col-span-1">
            <CardContent className="p-4 space-y-4">
              {/* 1. Stages Panel */}
              <LeadStagesPanel 
                currentStage={lead?.stage}
                onStageChange={handleStageChange}
                canChangeStage={canChangeStage()}
                isUpdating={isUpdatingStage}
                designerDetails={lead?.designer_details}
                onAssignDesigner={() => {
                  setShowDesignerDialog(true);
                  fetchDesigners();
                }}
                canAssignDesigner={canAssignDesigner()}
                onConvertToProject={handleConvertToProject}
                canConvert={canConvert()}
                userRole={user?.role}
              />

              {/* 2. Collaborators Section - Compact */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Collaborators ({collaborators.length})
                  </h4>
                  {canAddCollaborator() && (
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowCollaboratorModal(true);
                        fetchAllUsers();
                      }}
                      className="h-6 text-xs px-2"
                      data-testid="add-collaborator-btn"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
                
                {collaborators.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">No collaborators</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {collaborators.slice(0, 5).map((collab, idx) => (
                      <div 
                        key={collab.user_id || idx}
                        className="group relative"
                        title={`${collab.name || 'Unknown'} (${collab.role || 'Collaborator'})`}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium text-white border-2 border-white shadow-sm",
                          getAvatarColor(collab.name || 'U')
                        )}>
                          {getInitials(collab.name || 'U')}
                        </div>
                        {canAddCollaborator() && (
                          <button
                            onClick={() => handleRemoveCollaborator(collab.user_id)}
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full items-center justify-center text-[8px] hidden group-hover:flex"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {collaborators.length > 5 && (
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-600 border-2 border-white">
                        +{collaborators.length - 5}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Meetings Section - Compact */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Meetings ({meetings.length})
                  </h4>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMeetingModal(true)}
                    className="h-6 text-xs px-2"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Schedule
                  </Button>
                </div>
                
                {loadingMeetings ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  </div>
                ) : meetings.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">No meetings</p>
                ) : (
                  <div className="space-y-1.5">
                    {meetings.slice(0, 2).map(meeting => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        compact
                        showLead={false}
                        onMarkCompleted={(meetingId) => handleMeetingStatusUpdate(meetingId, 'Completed')}
                        onCancel={(meetingId) => handleMeetingStatusUpdate(meetingId, 'Cancelled')}
                      />
                    ))}
                    {meetings.length > 2 && (
                      <p className="text-[10px] text-center text-slate-400">+{meetings.length - 2} more</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Meeting Modal */}
      <MeetingModal
        open={showMeetingModal}
        onOpenChange={setShowMeetingModal}
        onSuccess={fetchMeetings}
        initialLeadId={id}
      />

      {/* Assign Designer Dialog */}
      {showDesignerDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDesignerDialog(false)}>
          <div 
            className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-slate-900">Assign Designer</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDesignerDialog(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              {loadingDesigners ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : designers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500">No designers available</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {designers.map((designer) => (
                    <button
                      key={designer.user_id}
                      onClick={() => handleAssignDesigner(designer.user_id)}
                      disabled={assigning}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                      data-testid={`assign-designer-${designer.user_id}`}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white",
                        getAvatarColor(designer.name)
                      )}>
                        {designer.picture ? (
                          <img src={designer.picture} alt={designer.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          getInitials(designer.name)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{designer.name}</p>
                        <p className="text-xs text-slate-500 truncate">{designer.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Collaborator Modal */}
      {showCollaboratorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCollaboratorModal(false)}>
          <div 
            className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-slate-900">Add Collaborator</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCollaboratorModal(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Select User</label>
                    <select
                      value={selectedCollaborator}
                      onChange={(e) => setSelectedCollaborator(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select a user --</option>
                      {allUsers
                        .filter(u => 
                          u.user_id !== user?.user_id && 
                          u.user_id !== lead?.assigned_to &&
                          u.user_id !== lead?.designer_id &&
                          !collaborators.some(c => c.user_id === u.user_id)
                        )
                        .map(u => (
                          <option key={u.user_id} value={u.user_id}>
                            {u.name} ({u.role})
                          </option>
                        ))
                      }
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Reason (optional)</label>
                    <Input
                      value={collaboratorReason}
                      onChange={(e) => setCollaboratorReason(e.target.value)}
                      placeholder="e.g., Design review assistance"
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCollaboratorModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCollaborator}
                disabled={!selectedCollaborator || addingCollaborator}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {addingCollaborator ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Collaborator'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadDetails;
