import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
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
  Check, 
  FileText,
  StickyNote,
  Users,
  LayoutDashboard,
  Plus,
  X,
  CalendarDays,
  IndianRupee,
  Wallet,
  Receipt,
  Edit2,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import CustomerDetailsSection from '../components/CustomerDetailsSection';

// Import extracted components
import { 
  TimelinePanel, 
  CommentsPanel, 
  StagesPanel, 
  FilesTab, 
  NotesTab, 
  CollaboratorsTab,
  CustomPaymentScheduleEditor,
  STAGES,
  STAGE_COLORS,
  ROLE_BADGE_STYLES,
  formatRelativeTime 
} from '../components/project';
import MeetingModal from '../components/MeetingModal';
import MeetingCard from '../components/MeetingCard';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  
  // Sub-stage progression state
  const [completedSubStages, setCompletedSubStages] = useState([]);
  const [percentageSubStages, setPercentageSubStages] = useState({});
  
  // Files and Notes state
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  
  // Meetings state
  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  
  // Financials state
  const [financials, setFinancials] = useState(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [editingProjectValue, setEditingProjectValue] = useState(false);
  const [newProjectValue, setNewProjectValue] = useState('');
  const [newPayment, setNewPayment] = useState({
    amount: '',
    mode: 'Bank',
    reference: '',
    date: new Date().toISOString().split('T')[0]
  });

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
      setCompletedSubStages(response.data.completed_substages || []);
      setPercentageSubStages(response.data.percentage_substages || {});
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

  // Fetch financials for this project
  const fetchFinancials = async () => {
    try {
      setLoadingFinancials(true);
      const response = await axios.get(`${API}/projects/${id}/financials`, {
        withCredentials: true
      });
      setFinancials(response.data);
      setNewProjectValue(response.data.project_value?.toString() || '');
    } catch (err) {
      console.error('Failed to fetch financials:', err);
      toast.error('Failed to load financial data');
    } finally {
      setLoadingFinancials(false);
    }
  };

  // Fetch financials when tab changes to financials
  useEffect(() => {
    if (activeTab === 'financials' && id && user?.role !== 'PreSales') {
      fetchFinancials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  // Update project value
  const handleUpdateProjectValue = async () => {
    const value = parseFloat(newProjectValue);
    if (isNaN(value) || value < 0) {
      toast.error('Please enter a valid project value');
      return;
    }
    
    try {
      await axios.put(`${API}/projects/${id}/financials`, {
        project_value: value
      }, { withCredentials: true });
      
      toast.success('Project value updated');
      setEditingProjectValue(false);
      fetchFinancials();
    } catch (err) {
      console.error('Failed to update project value:', err);
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
  };

  // Add payment
  const handleAddPayment = async () => {
    const amount = parseFloat(newPayment.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    try {
      await axios.post(`${API}/projects/${id}/payments`, {
        amount,
        mode: newPayment.mode,
        reference: newPayment.reference,
        date: newPayment.date
      }, { withCredentials: true });
      
      toast.success('Payment added');
      setShowAddPaymentModal(false);
      setNewPayment({
        amount: '',
        mode: 'Bank',
        reference: '',
        date: new Date().toISOString().split('T')[0]
      });
      fetchFinancials();
    } catch (err) {
      console.error('Failed to add payment:', err);
      toast.error(err.response?.data?.detail || 'Failed to add payment');
    }
  };

  // Delete payment (Admin only)
  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) return;
    
    try {
      await axios.delete(`${API}/projects/${id}/payments/${paymentId}`, {
        withCredentials: true
      });
      
      toast.success('Payment deleted');
      fetchFinancials();
    } catch (err) {
      console.error('Failed to delete payment:', err);
      toast.error(err.response?.data?.detail || 'Failed to delete payment');
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

  // Update stage (legacy - kept for backward compatibility)
  const handleStageChange = async (newStage) => {
    if (newStage === project?.stage) return;
    
    try {
      setIsUpdatingStage(true);
      await axios.put(`${API}/projects/${id}/stage`,
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

  // Complete a sub-stage (new sub-stage progression system)
  const handleSubStageComplete = async (substageId, substageName, groupName) => {
    try {
      setIsUpdatingStage(true);
      const response = await axios.post(`${API}/projects/${id}/substage/complete`,
        { 
          substage_id: substageId,
          substage_name: substageName,
          group_name: groupName
        },
        { withCredentials: true }
      );
      
      // Update local state FIRST
      const newCompletedSubStages = response.data.completed_substages || [];
      setCompletedSubStages(newCompletedSubStages);
      
      // Also update the project state to include the new substages
      setProject(prev => prev ? {
        ...prev,
        completed_substages: newCompletedSubStages,
        stage: response.data.current_stage || prev.stage
      } : prev);
      
      // Show success message
      if (response.data.group_complete) {
        toast.success(`🎉 Milestone "${groupName}" completed!`);
      } else {
        toast.success(`✅ "${substageName}" completed`);
      }
      
      // Refetch to get updated comments (but preserve our substages)
      const commentsResponse = await axios.get(`${API}/projects/${id}`, {
        withCredentials: true
      });
      if (commentsResponse.data) {
        setProject(prev => prev ? {
          ...prev,
          comments: commentsResponse.data.comments || [],
          completed_substages: newCompletedSubStages // Keep our updated substages
        } : prev);
      }
    } catch (err) {
      console.error('Failed to complete sub-stage:', err);
      toast.error(err.response?.data?.detail || 'Failed to complete step');
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // Update a percentage-based sub-stage (Non-Modular Dependency Works)
  const handlePercentageUpdate = async (substageId, substageName, groupName, percentage, comment) => {
    try {
      setIsUpdatingStage(true);
      const response = await axios.post(`${API}/projects/${id}/substage/percentage`,
        { 
          substage_id: substageId,
          percentage: percentage,
          comment: comment
        },
        { withCredentials: true }
      );
      
      // Update local state
      const newPercentageSubStages = response.data.percentage_substages || {};
      setPercentageSubStages(newPercentageSubStages);
      
      // If auto-completed, also update completed substages
      if (response.data.auto_completed) {
        const newCompletedSubStages = response.data.completed_substages || [];
        setCompletedSubStages(newCompletedSubStages);
        
        setProject(prev => prev ? {
          ...prev,
          completed_substages: newCompletedSubStages,
          percentage_substages: newPercentageSubStages
        } : prev);
        
        if (response.data.group_complete) {
          toast.success(`🎉 Milestone "${groupName}" completed!`);
        } else {
          toast.success(`✅ "${substageName}" completed at 100%`);
        }
      } else {
        setProject(prev => prev ? {
          ...prev,
          percentage_substages: newPercentageSubStages
        } : prev);
        
        toast.success(`📊 Progress updated to ${percentage}%`);
      }
      
      // Refetch to get updated comments
      const commentsResponse = await axios.get(`${API}/projects/${id}`, {
        withCredentials: true
      });
      if (commentsResponse.data) {
        setProject(prev => prev ? {
          ...prev,
          comments: commentsResponse.data.comments || [],
          completed_substages: response.data.auto_completed ? response.data.completed_substages : prev.completed_substages,
          percentage_substages: newPercentageSubStages
        } : prev);
      }
    } catch (err) {
      console.error('Failed to update percentage:', err);
      toast.error(err.response?.data?.detail || 'Failed to update progress');
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // Update customer details on project (Admin/SalesManager only)
  const handleUpdateCustomerDetails = async (updatedData) => {
    try {
      await axios.put(`${API}/projects/${id}/customer-details`, updatedData, {
        withCredentials: true
      });
      toast.success('Customer details updated');
      fetchProject(); // Refresh project data
    } catch (err) {
      console.error('Failed to update customer details:', err);
      toast.error(err.response?.data?.detail || 'Failed to update customer details');
      throw err;
    }
  };
  
  // Can edit customer details on project (Admin/SalesManager only)
  const canEditProjectCustomerDetails = () => {
    return user?.role === 'Admin' || user?.role === 'SalesManager';
  };

  // Check if user can change stage
  const canChangeStage = () => {
    if (!user || !project) return false;
    if (user.role === 'Admin' || user.role === 'SalesManager') return true;
    if (user.role === 'Designer' || user.role === 'DesignManager') {
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
            {/* PID Badge - Always visible if exists */}
            {project?.pid && (
              <span 
                className="inline-flex items-center rounded-md bg-slate-900 px-2.5 py-1 text-sm font-mono font-bold text-white"
                data-testid="project-pid-badge"
              >
                {project.pid}
              </span>
            )}
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
            {project?.pid && <span className="font-medium text-slate-700">{project.pid} • </span>}
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

      {/* Customer Details Section - Visible on all project views */}
      <CustomerDetailsSection
        data={project}
        canEdit={canEditProjectCustomerDetails()}
        onSave={handleUpdateCustomerDetails}
        isProject={true}
      />

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
                showLeadHistory={!!project?.lead_id}
                leadId={project?.lead_id}
              />
            </CardContent>
          </Card>

          {/* Right Column - Milestones (25%) */}
          <Card className="border-slate-200 lg:col-span-1">
            <CardContent className="p-4">
              <StagesPanel 
                currentStage={project?.stage}
                completedSubStages={completedSubStages}
                percentageSubStages={percentageSubStages}
                onSubStageComplete={handleSubStageComplete}
                onPercentageUpdate={handlePercentageUpdate}
                canChangeStage={canChangeStage()}
                isUpdating={isUpdatingStage}
                userRole={user?.role}
                holdStatus={project?.hold_status || 'Active'}
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
            <CollaboratorsTab 
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

      {/* Financials Tab */}
      {activeTab === 'financials' && user?.role !== 'PreSales' && (
        <div className="space-y-6">
          {loadingFinancials ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : financials ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Project Value Card */}
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-500">Project Value</span>
                      {financials.can_edit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingProjectValue(true)}
                          className="h-7 text-xs"
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                    {editingProjectValue ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          <span className="text-lg font-bold text-slate-400 mr-1">₹</span>
                          <Input
                            type="number"
                            value={newProjectValue}
                            onChange={(e) => setNewProjectValue(e.target.value)}
                            className="w-32 h-8"
                            placeholder="0"
                          />
                        </div>
                        <Button size="sm" onClick={handleUpdateProjectValue} className="h-8">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingProjectValue(false)} className="h-8">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-2xl font-bold text-slate-900">
                        ₹{financials.project_value?.toLocaleString('en-IN') || '0'}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Total Collected Card */}
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-slate-500">Total Collected</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">
                      ₹{financials.total_collected?.toLocaleString('en-IN') || '0'}
                    </p>
                  </CardContent>
                </Card>

                {/* Balance Pending Card */}
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Receipt className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-slate-500">Balance Pending</span>
                    </div>
                    <p className={cn(
                      "text-2xl font-bold",
                      financials.balance_pending <= 0 ? "text-emerald-600" : "text-amber-600",
                      financials.balance_pending < 0 && "text-red-600"
                    )}>
                      ₹{Math.abs(financials.balance_pending)?.toLocaleString('en-IN') || '0'}
                      {financials.balance_pending < 0 && <span className="text-sm ml-1">(Overpaid)</span>}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Schedule */}
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <IndianRupee className="h-5 w-5 text-emerald-600" />
                      Payment Milestones
                    </CardTitle>
                    {financials.can_edit && (
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={financials.custom_payment_schedule_enabled || false}
                            onChange={async (e) => {
                              try {
                                await axios.put(`${API}/projects/${id}/financials`, {
                                  custom_payment_schedule_enabled: e.target.checked
                                }, { withCredentials: true });
                                toast.success(e.target.checked ? 'Custom schedule enabled' : 'Using default schedule');
                                fetchFinancials();
                              } catch (err) {
                                toast.error('Failed to update');
                              }
                            }}
                            className="rounded border-slate-300"
                          />
                          <span className="text-slate-600">Use Custom Schedule</span>
                        </label>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Default Schedule Display */}
                  {!financials.custom_payment_schedule_enabled && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {financials.payment_schedule?.map((milestone, index) => (
                          <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-sm font-semibold text-slate-700">{milestone.stage}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {milestone.type === 'fixed' && `Fixed: ₹${milestone.fixedAmount?.toLocaleString('en-IN')}`}
                              {milestone.type === 'percentage' && `${milestone.percentage}% of project value`}
                              {milestone.type === 'remaining' && 'Remaining balance'}
                            </p>
                            <p className="text-xl font-bold text-emerald-600 mt-2">
                              ₹{milestone.amount?.toLocaleString('en-IN') || '0'}
                            </p>
                          </div>
                        ))}
                      </div>
                      
                      {/* Edit Default Schedule for Admin/Manager */}
                      {financials.can_edit && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm font-medium text-blue-700 mb-3">
                            Edit Design Booking Type
                          </p>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="radio"
                                name="bookingType"
                                checked={financials.default_payment_schedule?.[0]?.type === 'fixed'}
                                onChange={async () => {
                                  const newSchedule = [...(financials.default_payment_schedule || [])];
                                  newSchedule[0] = { ...newSchedule[0], type: 'fixed' };
                                  try {
                                    await axios.put(`${API}/projects/${id}/financials`, {
                                      payment_schedule: newSchedule
                                    }, { withCredentials: true });
                                    toast.success('Changed to fixed ₹25,000');
                                    fetchFinancials();
                                  } catch (err) {
                                    toast.error('Failed to update');
                                  }
                                }}
                                className="text-emerald-600"
                              />
                              <span>Fixed ₹25,000</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="radio"
                                name="bookingType"
                                checked={financials.default_payment_schedule?.[0]?.type === 'percentage'}
                                onChange={async () => {
                                  const newSchedule = [...(financials.default_payment_schedule || [])];
                                  newSchedule[0] = { ...newSchedule[0], type: 'percentage' };
                                  try {
                                    await axios.put(`${API}/projects/${id}/financials`, {
                                      payment_schedule: newSchedule
                                    }, { withCredentials: true });
                                    toast.success('Changed to 10% of project value');
                                    fetchFinancials();
                                  } catch (err) {
                                    toast.error('Failed to update');
                                  }
                                }}
                                className="text-emerald-600"
                              />
                              <span>10% of Project Value</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Schedule Editor */}
                  {financials.custom_payment_schedule_enabled && (
                    <CustomPaymentScheduleEditor
                      schedule={financials.custom_payment_schedule || []}
                      projectValue={financials.project_value || 0}
                      canEdit={financials.can_edit}
                      onSave={async (newSchedule) => {
                        try {
                          await axios.put(`${API}/projects/${id}/financials`, {
                            custom_payment_schedule: newSchedule
                          }, { withCredentials: true });
                          toast.success('Custom schedule saved');
                          fetchFinancials();
                        } catch (err) {
                          toast.error(err.response?.data?.detail || 'Failed to save');
                        }
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Payment History */}
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-emerald-600" />
                      Payment History
                    </CardTitle>
                    {financials.can_edit && (
                      <Button 
                        size="sm"
                        onClick={() => setShowAddPaymentModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Payment
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {financials.payments?.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Receipt className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <p>No payments recorded yet</p>
                      {financials.can_edit && (
                        <Button 
                          variant="link" 
                          onClick={() => setShowAddPaymentModal(true)}
                          className="text-emerald-600 mt-2"
                        >
                          Record your first payment
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 px-3 text-slate-500 font-medium">Date</th>
                            <th className="text-right py-2 px-3 text-slate-500 font-medium">Amount</th>
                            <th className="text-left py-2 px-3 text-slate-500 font-medium">Mode</th>
                            <th className="text-left py-2 px-3 text-slate-500 font-medium">Reference</th>
                            <th className="text-left py-2 px-3 text-slate-500 font-medium">Added By</th>
                            {financials.can_delete_payments && (
                              <th className="text-center py-2 px-3 text-slate-500 font-medium">Actions</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {financials.payments?.map((payment) => (
                            <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-3 px-3 text-slate-700">
                                {new Date(payment.date).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="py-3 px-3 text-right font-medium text-emerald-600">
                                ₹{payment.amount?.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-3">
                                <Badge variant="secondary" className="text-xs">
                                  {payment.mode}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                {payment.reference || '-'}
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                {payment.added_by_name || 'Unknown'}
                              </td>
                              {financials.can_delete_payments && (
                                <td className="py-3 px-3 text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeletePayment(payment.id)}
                                    className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
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
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p>Unable to load financial data</p>
            </div>
          )}
        </div>
      )}

      {/* Add Payment Modal */}
      <Dialog open={showAddPaymentModal} onOpenChange={setShowAddPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
              Add Payment
            </DialogTitle>
            <DialogDescription>
              Record a new payment for this project
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="payment-amount">Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                <Input
                  id="payment-amount"
                  type="number"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0"
                  className="pl-8"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="payment-mode">Payment Mode</Label>
              <Select
                value={newPayment.mode}
                onValueChange={(value) => setNewPayment(prev => ({ ...prev, mode: value }))}
              >
                <SelectTrigger id="payment-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank">Bank Transfer</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="payment-date">Date</Label>
              <Input
                id="payment-date"
                type="date"
                value={newPayment.date}
                onChange={(e) => setNewPayment(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="payment-reference">Reference (Optional)</Label>
              <Input
                id="payment-reference"
                value={newPayment.reference}
                onChange={(e) => setNewPayment(prev => ({ ...prev, reference: e.target.value }))}
                placeholder="Transaction ID or cheque number"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPaymentModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPayment} className="bg-emerald-600 hover:bg-emerald-700">
              Add Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
