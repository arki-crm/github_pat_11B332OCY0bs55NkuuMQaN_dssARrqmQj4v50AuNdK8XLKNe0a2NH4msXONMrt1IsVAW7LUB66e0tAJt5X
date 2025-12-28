import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  Send, 
  Check, 
  Clock, 
  AlertTriangle,
  FileText,
  StickyNote,
  Users,
  LayoutDashboard
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Stage configuration - 6 main stages
const STAGES = [
  "Design Finalization",
  "Production Preparation",
  "Production",
  "Delivery",
  "Installation",
  "Handover"
];

const STAGE_COLORS = {
  'Design Finalization': { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-400' },
  'Production Preparation': { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-400' },
  'Production': { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-400' },
  'Delivery': { bg: 'bg-cyan-100', text: 'text-cyan-700', ring: 'ring-cyan-400' },
  'Installation': { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-400' },
  'Handover': { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-400' }
};

const ROLE_BADGE_STYLES = {
  Admin: 'bg-purple-100 text-purple-700',
  Manager: 'bg-blue-100 text-blue-700',
  Designer: 'bg-pink-100 text-pink-700',
  PreSales: 'bg-orange-100 text-orange-700'
};

// Format date helper
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

// Get initials from name
const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Avatar colors based on name
const getAvatarColor = (name) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
    'bg-amber-500', 'bg-cyan-500', 'bg-red-500', 'bg-indigo-500'
  ];
  const index = name ? name.charCodeAt(0) % colors.length : 0;
  return colors[index];
};

// Group timeline items by stage
const groupTimelineByStage = (timeline) => {
  const groups = {};
  STAGES.forEach(stage => {
    groups[stage] = [];
  });
  
  timeline?.forEach(item => {
    const stage = item.stage_ref;
    if (groups[stage]) {
      groups[stage].push(item);
    }
  });
  
  return groups;
};

// ============ TIMELINE COMPONENT ============
const TimelinePanel = ({ timeline, currentStage }) => {
  const groupedTimeline = groupTimelineByStage(timeline);
  const currentStageIndex = STAGES.indexOf(currentStage);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <Check className="w-3 h-3 text-green-600" />;
      case 'delayed':
        return <AlertTriangle className="w-3 h-3 text-red-500" />;
      default:
        return <Clock className="w-3 h-3 text-slate-400" />;
    }
  };

  return (
    <div data-testid="timeline-panel">
      <h3 className="text-sm font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Milestones
      </h3>
      
      <ScrollArea className="h-[450px] pr-2">
        <div className="space-y-4">
          {STAGES.map((stage, stageIndex) => {
            const milestones = groupedTimeline[stage] || [];
            const isCurrentStage = stage === currentStage;
            const isCompletedStage = stageIndex < currentStageIndex;
            const stageColors = STAGE_COLORS[stage] || STAGE_COLORS['Design Finalization'];
            
            return (
              <div 
                key={stage} 
                className={cn(
                  "rounded-lg border p-3",
                  isCurrentStage ? `${stageColors.bg} border-current ${stageColors.text}` :
                  isCompletedStage ? "bg-green-50 border-green-200" : "bg-white border-slate-200"
                )}
                data-testid={`milestone-group-${stage.replace(/\s+/g, '-').toLowerCase()}`}
              >
                {/* Stage Header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center",
                    isCompletedStage ? "bg-green-500" : 
                    isCurrentStage ? stageColors.bg.replace('100', '500') : "bg-slate-200"
                  )}>
                    {isCompletedStage ? (
                      <Check className="w-3 h-3 text-white" />
                    ) : (
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        isCurrentStage ? "bg-white" : "bg-slate-400"
                      )} />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    isCurrentStage ? stageColors.text : 
                    isCompletedStage ? "text-green-700" : "text-slate-500"
                  )}>
                    {stage}
                  </span>
                  {isCurrentStage && (
                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded ml-auto">
                      Current
                    </span>
                  )}
                </div>
                
                {/* Milestones */}
                <div className="space-y-1.5 ml-2.5 pl-4 border-l border-slate-200">
                  {milestones.map((item, index) => (
                    <div 
                      key={item.id || index} 
                      className="flex items-center gap-2 py-1"
                      data-testid={`milestone-${item.id}`}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0",
                        item.status === 'completed' ? 'bg-green-100' :
                        item.status === 'delayed' ? 'bg-red-100' : 'bg-slate-100'
                      )}>
                        {getStatusIcon(item.status)}
                      </div>
                      <span className={cn(
                        "text-xs",
                        item.status === 'completed' ? 'text-slate-700' : 'text-slate-500'
                      )}>
                        {item.title}
                      </span>
                    </div>
                  ))}
                  {milestones.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-1">No milestones</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

// ============ COMMENTS COMPONENT ============
const CommentsPanel = ({ comments, onAddComment, isSubmitting }) => {
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    onAddComment(newMessage.trim());
    setNewMessage('');
  };

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  return (
    <div className="flex flex-col h-full" data-testid="comments-panel">
      <h3 className="text-sm font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Activity & Comments
      </h3>
      
      {/* Comments List */}
      <ScrollArea className="flex-1 pr-3" ref={scrollRef}>
        <div className="space-y-4">
          {comments?.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No comments yet. Start the conversation!</p>
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
                // System message
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
                // User comment
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
      
      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <Input
          type="text"
          placeholder="Add a comment..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1"
          data-testid="comment-input"
        />
        <Button 
          type="submit" 
          disabled={!newMessage.trim() || isSubmitting}
          className="bg-blue-600 hover:bg-blue-700"
          data-testid="send-comment-btn"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
};

// ============ STAGES PANEL ============
const StagesPanel = ({ currentStage, onStageChange, canChangeStage, isUpdating }) => {
  const currentIndex = STAGES.indexOf(currentStage);

  return (
    <div data-testid="stages-panel">
      <h3 className="text-sm font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Project Stage
      </h3>
      
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200" />
        
        <div className="space-y-3">
          {STAGES.map((stage, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const stageColors = STAGE_COLORS[stage];
            
            return (
              <button
                key={stage}
                onClick={() => canChangeStage && !isUpdating && onStageChange(stage)}
                disabled={!canChangeStage || isUpdating}
                className={cn(
                  "relative flex items-center gap-3 w-full p-3 rounded-lg transition-all text-left",
                  canChangeStage && !isUpdating ? "cursor-pointer hover:bg-slate-50" : "cursor-default",
                  isCurrent && "ring-2 ring-offset-2",
                  isCurrent && stageColors.ring
                )}
                data-testid={`stage-${stage.replace(/\s+/g, '-').toLowerCase()}`}
              >
                {/* Circle indicator */}
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
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                  )}
                </div>
                
                {/* Label */}
                <div className="flex-1">
                  <span className={cn(
                    "text-sm font-medium",
                    isCurrent ? stageColors.text : isCompleted ? "text-slate-700" : "text-slate-500"
                  )}>
                    {stage}
                  </span>
                  {isCurrent && (
                    <p className="text-xs text-slate-500 mt-0.5">Current stage</p>
                  )}
                </div>
                
                {isUpdating && isCurrent && (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {!canChangeStage && (
        <p className="text-xs text-slate-500 mt-4 text-center">
          You don't have permission to change the stage
        </p>
      )}
    </div>
  );
};

// ============ PLACEHOLDER TABS ============
const FilesTab = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="files-tab">
    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
      <FileText className="w-8 h-8 text-slate-400" />
    </div>
    <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
      Files module will be added in the next phase
    </h3>
    <p className="text-sm text-slate-500 mt-1">Upload and manage project documents, drawings, and images.</p>
  </div>
);

const NotesTab = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="notes-tab">
    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
      <StickyNote className="w-8 h-8 text-slate-400" />
    </div>
    <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
      Notes module coming soon
    </h3>
    <p className="text-sm text-slate-500 mt-1">Create and organize project notes and documentation.</p>
  </div>
);

const CollaboratorsTab = ({ collaborators }) => (
  <div data-testid="collaborators-tab">
    <div className="max-w-lg mx-auto">
      <h3 className="text-lg font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Project Collaborators
      </h3>
      
      <div className="space-y-3">
        {collaborators?.map((collab) => (
          <div 
            key={collab.user_id}
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white"
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white",
              getAvatarColor(collab.name)
            )}>
              {collab.picture ? (
                <img src={collab.picture} alt={collab.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                getInitials(collab.name)
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">{collab.name}</p>
              <p className="text-xs text-slate-500">{collab.user_id}</p>
            </div>
            <Button variant="outline" size="sm" disabled className="text-xs">
              Remove
            </Button>
          </div>
        ))}
      </div>
      
      <Button variant="outline" className="w-full mt-4" disabled>
        + Add Collaborator
      </Button>
      
      <p className="text-xs text-slate-500 mt-4 text-center">
        Collaborator management will be enabled in a future update.
      </p>
    </div>
  </div>
);

// ============ MAIN COMPONENT ============
const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

  // PreSales redirect
  useEffect(() => {
    if (user?.role === 'PreSales') {
      toast.error('Access denied');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Fetch project
  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/projects/${id}`, {
        withCredentials: true
      });
      setProject(response.data);
    } catch (err) {
      console.error('Failed to fetch project:', err);
      if (err.response?.status === 403) {
        toast.error('Access denied');
        navigate('/dashboard', { replace: true });
      } else {
        setError(err.response?.data?.detail || 'Failed to load project');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && user?.role !== 'PreSales') {
      fetchProject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Add comment
  const handleAddComment = async (message) => {
    try {
      setIsSubmittingComment(true);
      const response = await axios.post(`${API}/projects/${id}/comments`, 
        { message },
        { withCredentials: true }
      );
      
      // Add new comment to local state
      setProject(prev => ({
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
    if (newStage === project?.stage) return;
    
    try {
      setIsUpdatingStage(true);
      const response = await axios.put(`${API}/projects/${id}/stage`,
        { stage: newStage },
        { withCredentials: true }
      );
      
      // Refetch project to get updated timeline and comments
      await fetchProject();
      toast.success(`Stage updated to "${newStage}"`);
    } catch (err) {
      console.error('Failed to update stage:', err);
      toast.error(err.response?.data?.detail || 'Failed to update stage');
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // Check if user can change stage
  const canChangeStage = () => {
    if (!user || !project) return false;
    if (user.role === 'Admin' || user.role === 'Manager') return true;
    if (user.role === 'Designer') {
      return project.collaborators?.some(c => c.user_id === user.user_id);
    }
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="project-loading">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" data-testid="project-error">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/projects')}
          className="text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
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
    <div className="space-y-6" data-testid="project-details-page">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => navigate('/projects')}
        className="text-slate-600 hover:text-slate-900 -ml-2"
        data-testid="back-to-projects-btn"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Projects
      </Button>

      {/* Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 
              className="text-2xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              {project?.project_name}
            </h1>
            {user?.role && (
              <span 
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  ROLE_BADGE_STYLES[user.role] || 'bg-slate-100 text-slate-700'
                )}
                data-testid="user-role-badge"
              >
                {user.role}
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1">
            Client: {project?.client_name} • Last updated {formatRelativeTime(project?.updated_at)}
          </p>
        </div>
        
        {/* Current Stage Badge */}
        {project?.stage && (
          <span 
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
              STAGE_COLORS[project.stage]?.bg,
              STAGE_COLORS[project.stage]?.text
            )}
            data-testid="project-stage-badge"
          >
            {project.stage}
          </span>
        )}
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-white"
            data-testid="tab-overview"
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="files" 
            className="data-[state=active]:bg-white"
            data-testid="tab-files"
          >
            <FileText className="w-4 h-4 mr-2" />
            Files
          </TabsTrigger>
          <TabsTrigger 
            value="notes" 
            className="data-[state=active]:bg-white"
            data-testid="tab-notes"
          >
            <StickyNote className="w-4 h-4 mr-2" />
            Notes
          </TabsTrigger>
          <TabsTrigger 
            value="collaborators" 
            className="data-[state=active]:bg-white"
            data-testid="tab-collaborators"
          >
            <Users className="w-4 h-4 mr-2" />
            Collaborators
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" data-testid="overview-tab">
          {/* Left Column - Timeline (25%) */}
          <Card className="border-slate-200 lg:col-span-1">
            <CardContent className="p-4">
              <TimelinePanel timeline={project?.timeline || []} />
            </CardContent>
          </Card>

          {/* Center Column - Comments (50%) */}
          <Card className="border-slate-200 lg:col-span-2 flex flex-col" style={{ minHeight: '500px' }}>
            <CardContent className="p-4 flex-1 flex flex-col">
              <CommentsPanel 
                comments={project?.comments || []}
                onAddComment={handleAddComment}
                isSubmitting={isSubmittingComment}
              />
            </CardContent>
          </Card>

          {/* Right Column - Stages (25%) */}
          <Card className="border-slate-200 lg:col-span-1">
            <CardContent className="p-4">
              <StagesPanel 
                currentStage={project?.stage}
                onStageChange={handleStageChange}
                canChangeStage={canChangeStage()}
                isUpdating={isUpdatingStage}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'files' && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <FilesTab />
          </CardContent>
        </Card>
      )}

      {activeTab === 'notes' && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <NotesTab />
          </CardContent>
        </Card>
      )}

      {activeTab === 'collaborators' && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <CollaboratorsTab collaborators={project?.collaborators || []} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProjectDetails;
