import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
  LayoutDashboard,
  Upload,
  Download,
  Trash2,
  Plus,
  UserPlus,
  X,
  CalendarDays,
  IndianRupee,
  Wallet,
  Receipt,
  Edit2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import MeetingModal from '../components/MeetingModal';
import MeetingCard from '../components/MeetingCard';

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

  // Format date for display (DD/MM/YYYY)
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

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
                      className="flex items-start gap-2 py-1"
                      data-testid={`milestone-${item.id}`}
                    >
                      {/* Status dot */}
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1",
                        getStatusDotColor(item.status)
                      )} />
                      
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "text-xs block",
                          item.status === 'completed' ? 'text-slate-700' : 
                          item.status === 'delayed' ? 'text-red-600 font-medium' : 'text-slate-500'
                        )}>
                          {item.title}
                        </span>
                        
                        {/* Date display */}
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          {item.expectedDate && (
                            <span className={cn(
                              "text-[10px]",
                              item.status === 'delayed' ? 'text-red-500' : 'text-slate-400'
                            )}>
                              Expected: {formatDisplayDate(item.expectedDate)}
                            </span>
                          )}
                          {item.completedDate && (
                            <span className="text-[10px] text-green-600">
                              Completed: {formatDisplayDate(item.completedDate)}
                            </span>
                          )}
                        </div>
                      </div>
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
          You don&apos;t have permission to change the stage
        </p>
      )}
    </div>
  );
};

// ============ FILES TAB ============
const FilesTab = ({ projectId, files, onFilesChange, userRole }) => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const fileInputRef = useRef(null);

  const canUpload = ['Admin', 'Manager', 'Designer'].includes(userRole);
  const canDelete = userRole === 'Admin';

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'image':
        return '🖼️';
      case 'pdf':
        return '📄';
      case 'doc':
        return '📝';
      default:
        return '📎';
    }
  };

  const getFileType = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'doc';
    return 'other';
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    try {
      setUploading(true);
      
      // Convert to base64 for storage (in production, use cloud storage)
      const reader = new FileReader();
      reader.onload = async () => {
        const fileUrl = reader.result;
        const fileType = getFileType(file.name);
        
        const response = await axios.post(`${API}/projects/${projectId}/files`, {
          file_name: file.name,
          file_url: fileUrl,
          file_type: fileType
        }, { withCredentials: true });
        
        onFilesChange([...files, response.data]);
        toast.success('File uploaded successfully');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId) => {
    try {
      setDeleting(fileId);
      await axios.delete(`${API}/projects/${projectId}/files/${fileId}`, {
        withCredentials: true
      });
      onFilesChange(files.filter(f => f.id !== fileId));
      toast.success('File deleted');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (file) => {
    const link = document.createElement('a');
    link.href = file.file_url;
    link.download = file.file_name;
    link.click();
  };

  return (
    <div data-testid="files-tab">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Project Files
        </h3>
        {canUpload && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="upload-file-btn"
            >
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload File
            </Button>
          </div>
        )}
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h4 className="text-base font-medium text-slate-900">No files uploaded yet</h4>
          <p className="text-sm text-slate-500 mt-1">Upload documents, drawings, and images for this project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors"
              data-testid={`file-item-${file.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{getFileIcon(file.file_type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{file.file_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    by {file.uploaded_by_name} • {formatRelativeTime(file.uploaded_at)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleDownload(file)}
                  data-testid={`download-${file.id}`}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
                {canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(file.id)}
                    disabled={deleting === file.id}
                    data-testid={`delete-${file.id}`}
                  >
                    {deleting === file.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============ NOTES TAB ============
const NotesTab = ({ projectId, notes, onNotesChange, userRole, currentUserId }) => {
  const [selectedNote, setSelectedNote] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const saveTimeoutRef = useRef(null);

  const canCreate = ['Admin', 'Manager', 'Designer'].includes(userRole);

  const canEdit = (note) => {
    return note.created_by === currentUserId || userRole === 'Admin';
  };

  // Auto-save on content change
  useEffect(() => {
    if (!selectedNote || !canEdit(selectedNote)) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (editTitle !== selectedNote.title || editContent !== selectedNote.content) {
        try {
          setSaving(true);
          const response = await axios.put(
            `${API}/projects/${projectId}/notes/${selectedNote.id}`,
            { title: editTitle, content: editContent },
            { withCredentials: true }
          );
          
          onNotesChange(notes.map(n => n.id === selectedNote.id ? response.data : n));
          setSelectedNote(response.data);
        } catch (err) {
          console.error('Save error:', err);
          toast.error('Failed to save note');
        } finally {
          setSaving(false);
        }
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTitle, editContent]);

  const handleCreateNote = async () => {
    try {
      setIsCreating(true);
      const response = await axios.post(`${API}/projects/${projectId}/notes`, {
        title: 'Untitled Note',
        content: ''
      }, { withCredentials: true });
      
      onNotesChange([...notes, response.data]);
      setSelectedNote(response.data);
      setEditTitle(response.data.title);
      setEditContent(response.data.content);
      toast.success('Note created');
    } catch (err) {
      console.error('Create error:', err);
      toast.error('Failed to create note');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectNote = (note) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  return (
    <div className="flex gap-6 min-h-[500px]" data-testid="notes-tab">
      {/* Notes List (Left) */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 pr-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
          {canCreate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCreateNote}
              disabled={isCreating}
              className="h-8 px-2"
              data-testid="create-note-btn"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          )}
        </div>
        
        {notes.length === 0 ? (
          <div className="text-center py-8">
            <StickyNote className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No notes yet</p>
            {canCreate && (
              <p className="text-xs text-slate-400 mt-1">Create the first note</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-colors",
                  selectedNote?.id === note.id 
                    ? "bg-blue-50 border border-blue-200" 
                    : "bg-white border border-slate-200 hover:border-slate-300"
                )}
                data-testid={`note-item-${note.id}`}
              >
                <p className="text-sm font-medium text-slate-900 truncate">{note.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {note.created_by_name} • {formatRelativeTime(note.updated_at)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Note Editor (Right) */}
      <div className="flex-1">
        {selectedNote ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {canEdit(selectedNote) ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-lg font-semibold border-none shadow-none px-0 focus-visible:ring-0"
                    placeholder="Note title"
                    data-testid="note-title-input"
                  />
                ) : (
                  <h3 className="text-lg font-semibold text-slate-900">{selectedNote.title}</h3>
                )}
                {saving && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
              </div>
              {!canEdit(selectedNote) && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Read-only</span>
              )}
            </div>
            
            <p className="text-xs text-slate-500 mb-4">
              Created by {selectedNote.created_by_name} • Updated {formatRelativeTime(selectedNote.updated_at)}
            </p>
            
            {canEdit(selectedNote) ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full p-3 rounded-lg border border-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Start writing..."
                data-testid="note-content-input"
              />
            ) : (
              <div className="flex-1 w-full p-3 rounded-lg border border-slate-200 bg-slate-50 text-sm whitespace-pre-wrap overflow-auto">
                {selectedNote.content || 'No content'}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <StickyNote className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-sm text-slate-500">Select a note to view or edit</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============ COLLABORATORS TAB ============
const CollaboratorsTabFull = ({ projectId, collaborators, onCollaboratorsChange, userRole }) => {
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const canAdd = ['Admin', 'Manager'].includes(userRole);
  const canRemove = userRole === 'Admin';

  const fetchAvailableUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/users/available`, { withCredentials: true });
      // Filter out already added collaborators
      const collaboratorIds = collaborators.map(c => c.user_id);
      setAvailableUsers(response.data.filter(u => !collaboratorIds.includes(u.user_id)));
    } catch (err) {
      console.error('Fetch users error:', err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCollaborator = async (userId) => {
    try {
      setAdding(true);
      await axios.post(`${API}/projects/${projectId}/collaborators`, {
        user_id: userId
      }, { withCredentials: true });
      
      // Refetch collaborators
      const response = await axios.get(`${API}/projects/${projectId}/collaborators`, {
        withCredentials: true
      });
      onCollaboratorsChange(response.data);
      setShowAddDialog(false);
      setSearchQuery('');
      toast.success('Collaborator added');
    } catch (err) {
      console.error('Add error:', err);
      toast.error(err.response?.data?.detail || 'Failed to add collaborator');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveCollaborator = async (userId) => {
    try {
      setRemoving(userId);
      await axios.delete(`${API}/projects/${projectId}/collaborators/${userId}`, {
        withCredentials: true
      });
      onCollaboratorsChange(collaborators.filter(c => c.user_id !== userId));
      toast.success('Collaborator removed');
    } catch (err) {
      console.error('Remove error:', err);
      toast.error('Failed to remove collaborator');
    } finally {
      setRemoving(null);
    }
  };

  const filteredUsers = availableUsers.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div data-testid="collaborators-tab">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Project Collaborators
          </h3>
          {canAdd && (
            <Button
              onClick={() => {
                setShowAddDialog(true);
                fetchAvailableUsers();
              }}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="add-collaborator-btn"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Collaborator
            </Button>
          )}
        </div>

        {collaborators.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <h4 className="text-base font-medium text-slate-900">No collaborators added yet</h4>
            <p className="text-sm text-slate-500 mt-1">Add team members to this project.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {collaborators.map((collab) => (
              <div
                key={collab.user_id}
                className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 bg-white"
                data-testid={`collaborator-${collab.user_id}`}
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium text-white",
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
                  <p className="text-xs text-slate-500">{collab.email}</p>
                </div>
                <span className={cn(
                  "text-xs px-2.5 py-1 rounded-full font-medium",
                  ROLE_BADGE_STYLES[collab.role] || 'bg-slate-100 text-slate-600'
                )}>
                  {collab.role}
                </span>
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCollaborator(collab.user_id)}
                    disabled={removing === collab.user_id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`remove-${collab.user_id}`}
                  >
                    {removing === collab.user_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Collaborator Dialog */}
        {showAddDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddDialog(false)}>
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
                    onClick={() => setShowAddDialog(false)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="mt-3">
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                    data-testid="search-users-input"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-auto p-4">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-slate-500">No users available to add</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.user_id}
                        onClick={() => handleAddCollaborator(user.user_id)}
                        disabled={adding}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                        data-testid={`add-user-${user.user_id}`}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white",
                          getAvatarColor(user.name)
                        )}>
                          {user.picture ? (
                            <img src={user.picture} alt={user.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            getInitials(user.name)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{user.name}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          ROLE_BADGE_STYLES[user.role] || 'bg-slate-100 text-slate-600'
                        )}>
                          {user.role}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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
  
  // Files and Notes state
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  
  // Meetings state
  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);

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
      setFiles(response.data.files || []);
      setNotes(response.data.notes || []);
      setCollaborators(response.data.collaborators || []);
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

  // Fetch meetings for this project
  const fetchMeetings = async () => {
    try {
      setLoadingMeetings(true);
      const response = await axios.get(`${API}/projects/${id}/meetings`, {
        withCredentials: true
      });
      setMeetings(response.data || []);
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoadingMeetings(false);
    }
  };

  // Fetch meetings when tab changes to meetings
  useEffect(() => {
    if (activeTab === 'meetings' && id) {
      fetchMeetings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

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
          <TabsTrigger 
            value="meetings" 
            className="data-[state=active]:bg-white"
            data-testid="tab-meetings"
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            Meetings
          </TabsTrigger>
          {user?.role !== 'PreSales' && (
            <TabsTrigger 
              value="financials" 
              className="data-[state=active]:bg-white"
              data-testid="tab-financials"
            >
              <IndianRupee className="w-4 h-4 mr-2" />
              Financials
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" data-testid="overview-tab">
          {/* Left Column - Timeline (25%) */}
          <Card className="border-slate-200 lg:col-span-1">
            <CardContent className="p-4">
              <TimelinePanel timeline={project?.timeline || []} currentStage={project?.stage} />
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
            <FilesTab 
              projectId={id}
              files={files}
              onFilesChange={setFiles}
              userRole={user?.role}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'notes' && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <NotesTab 
              projectId={id}
              notes={notes}
              onNotesChange={setNotes}
              userRole={user?.role}
              currentUserId={user?.user_id}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'collaborators' && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <CollaboratorsTabFull 
              projectId={id}
              collaborators={collaborators}
              onCollaboratorsChange={setCollaborators}
              userRole={user?.role}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'meetings' && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Project Meetings</h3>
              <Button 
                onClick={() => setShowMeetingModal(true)}
                className="bg-purple-600 hover:bg-purple-700"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
            </div>
            
            {loadingMeetings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CalendarDays className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p>No meetings scheduled for this project</p>
                <Button 
                  variant="link" 
                  onClick={() => setShowMeetingModal(true)}
                  className="text-purple-600 mt-2"
                >
                  Schedule your first meeting
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map(meeting => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    showProject={false}
                    onMarkCompleted={(meetingId) => handleMeetingStatusUpdate(meetingId, 'Completed')}
                    onCancel={(meetingId) => handleMeetingStatusUpdate(meetingId, 'Cancelled')}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Meeting Modal */}
      <MeetingModal
        open={showMeetingModal}
        onOpenChange={setShowMeetingModal}
        onSuccess={fetchMeetings}
        initialProjectId={id}
      />
    </div>
  );
};

export default ProjectDetails;
