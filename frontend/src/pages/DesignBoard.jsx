import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import {
  Dialog,
  DialogContent,
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
  Loader2,
  Check,
  Upload,
  Calendar,
  ChevronRight,
  Clock,
  AlertTriangle,
  FileText,
  Video,
  Ruler,
  ArrowRight,
  GripVertical,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Design workflow stages
const DESIGN_STAGES = [
  "Measurement Required",
  "Floor Plan Creation",
  "Floor Plan Meeting",
  "First Design Presentation",
  "Corrections & Second Presentation",
  "Material Selection Meeting",
  "Final Design Lock",
  "Production Drawings Preparation",
  "Validation & Kickoff"
];

const STAGE_COLORS = {
  "Measurement Required": { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: Ruler },
  "Floor Plan Creation": { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: FileText },
  "Floor Plan Meeting": { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: Video },
  "First Design Presentation": { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', icon: FileText },
  "Corrections & Second Presentation": { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', icon: FileText },
  "Material Selection Meeting": { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: Video },
  "Final Design Lock": { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: Check },
  "Production Drawings Preparation": { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', icon: FileText },
  "Validation & Kickoff": { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: Check }
};

const DesignBoard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [designProjects, setDesignProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [meetingData, setMeetingData] = useState({
    meeting_type: 'floor_plan',
    date: '',
    start_time: '',
    end_time: '',
    notes: ''
  });
  const [uploadData, setUploadData] = useState({
    file_name: '',
    file_url: '',
    file_type: 'design'
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksRes, projectsRes] = await Promise.all([
        axios.get(`${API}/design-tasks`, { withCredentials: true }),
        axios.get(`${API}/design-projects`, { withCredentials: true })
      ]);
      setTasks(tasksRes.data);
      setDesignProjects(projectsRes.data);
    } catch (err) {
      console.error('Failed to fetch design data:', err);
      toast.error('Failed to load design board');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group tasks by status for Kanban
  const tasksByStatus = {
    'Pending': tasks.filter(t => t.status === 'Pending'),
    'In Progress': tasks.filter(t => t.status === 'In Progress'),
    'Completed': tasks.filter(t => t.status === 'Completed')
  };

  // 1-Click Complete
  const handleCompleteTask = async (taskId) => {
    try {
      await axios.put(`${API}/design-tasks/${taskId}`, 
        { status: 'Completed' },
        { withCredentials: true }
      );
      toast.success('Task completed!');
      fetchData();
    } catch (err) {
      console.error('Failed to complete task:', err);
      toast.error('Failed to complete task');
    }
  };

  // Start task
  const handleStartTask = async (taskId) => {
    try {
      await axios.put(`${API}/design-tasks/${taskId}`,
        { status: 'In Progress' },
        { withCredentials: true }
      );
      toast.success('Task started');
      fetchData();
    } catch (err) {
      console.error('Failed to start task:', err);
      toast.error('Failed to start task');
    }
  };

  // Schedule meeting
  const handleScheduleMeeting = async () => {
    if (!selectedProject || !meetingData.date || !meetingData.start_time) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      await axios.post(`${API}/design-projects/${selectedProject.id}/meeting`, {
        project_id: selectedProject.project_id,
        ...meetingData,
        generate_meet_link: true
      }, { withCredentials: true });
      
      toast.success('Meeting scheduled with Google Meet link!');
      setShowMeetingModal(false);
      setMeetingData({ meeting_type: 'floor_plan', date: '', start_time: '', end_time: '', notes: '' });
      fetchData();
    } catch (err) {
      console.error('Failed to schedule meeting:', err);
      toast.error('Failed to schedule meeting');
    }
  };

  // Upload file
  const handleUploadFile = async () => {
    if (!selectedProject || !uploadData.file_name) {
      toast.error('Please provide file details');
      return;
    }
    
    try {
      await axios.post(`${API}/design-projects/${selectedProject.id}/upload`, uploadData, {
        withCredentials: true
      });
      
      toast.success('File uploaded!');
      setShowUploadModal(false);
      setUploadData({ file_name: '', file_url: '', file_type: 'design' });
      fetchData();
    } catch (err) {
      console.error('Failed to upload file:', err);
      toast.error('Failed to upload file');
    }
  };

  // Advance stage
  const handleAdvanceStage = async (project) => {
    const currentIndex = DESIGN_STAGES.indexOf(project.current_stage);
    if (currentIndex >= DESIGN_STAGES.length - 1) {
      toast.info('Project is at final stage');
      return;
    }
    
    const nextStage = DESIGN_STAGES[currentIndex + 1];
    
    try {
      await axios.put(`${API}/design-projects/${project.id}/stage`, {
        stage: nextStage,
        notes: `Advanced from ${project.current_stage}`
      }, { withCredentials: true });
      
      toast.success(`Moved to ${nextStage}`);
      fetchData();
    } catch (err) {
      console.error('Failed to advance stage:', err);
      toast.error('Failed to advance stage');
    }
  };

  // Request measurement
  const handleRequestMeasurement = async (project) => {
    try {
      await axios.post(`${API}/design-projects/${project.id}/measurement-request`, {
        project_id: project.project_id,
        notes: 'Site measurement requested'
      }, { withCredentials: true });
      
      toast.success('Measurement requested!');
      fetchData();
    } catch (err) {
      console.error('Failed to request measurement:', err);
      toast.error('Failed to request measurement');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Design Board</h1>
          <p className="text-sm text-slate-500">Your design workflow at a glance</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {designProjects.length} Active Projects
        </Badge>
      </div>

      {/* Active Design Projects */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Active Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {designProjects.map((project) => {
            const stageConfig = STAGE_COLORS[project.current_stage] || STAGE_COLORS['Measurement Required'];
            const StageIcon = stageConfig.icon;
            const progress = ((DESIGN_STAGES.indexOf(project.current_stage) + 1) / DESIGN_STAGES.length) * 100;
            
            return (
              <Card 
                key={project.id} 
                className={cn('hover:shadow-md transition-shadow cursor-pointer', stageConfig.border)}
                onClick={() => navigate(`/projects/${project.project_id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {project.project?.project_name || 'Untitled'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {project.project?.client_name}
                      </p>
                    </div>
                    {project.is_referral && (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                        Referral
                      </Badge>
                    )}
                  </div>
                  
                  {/* Current Stage */}
                  <div className={cn('flex items-center gap-2 p-2 rounded-lg mb-3', stageConfig.bg)}>
                    <StageIcon className={cn('w-4 h-4', stageConfig.text)} />
                    <span className={cn('text-sm font-medium', stageConfig.text)}>
                      {project.current_stage}
                    </span>
                  </div>
                  
                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                  
                  {/* Task Stats */}
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-slate-500">
                      {project.tasks_completed}/{project.tasks_total} tasks
                    </span>
                    {project.has_delays && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {project.overdue_count} overdue
                      </Badge>
                    )}
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {project.current_stage === 'Measurement Required' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRequestMeasurement(project)}
                        className="flex-1 text-xs"
                      >
                        <Ruler className="w-3 h-3 mr-1" />
                        Request
                      </Button>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedProject(project);
                        setShowUploadModal(true);
                      }}
                      className="flex-1 text-xs"
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Upload
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedProject(project);
                        setShowMeetingModal(true);
                      }}
                      className="flex-1 text-xs"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Meet
                    </Button>
                    
                    <Button 
                      size="sm"
                      onClick={() => handleAdvanceStage(project)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {designProjects.length === 0 && (
            <Card className="col-span-full border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-slate-500">No active design projects</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Kanban Task Board */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Task Board</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* To Do Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
              <Clock className="w-4 h-4 text-slate-500" />
              <span className="font-medium text-slate-700">To Do</span>
              <Badge variant="secondary" className="ml-auto">{tasksByStatus['Pending'].length}</Badge>
            </div>
            <div className="space-y-2 min-h-[200px]">
              {tasksByStatus['Pending'].map((task) => (
                <Card key={task.id} className={cn(
                  'hover:shadow-sm transition-shadow',
                  task.is_overdue && 'border-red-200 bg-red-50'
                )}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-slate-300 mt-0.5 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                        <p className="text-xs text-slate-500 truncate">{task.project?.project_name}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {task.is_overdue && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                          <span className="text-xs text-slate-400">
                            Due: {formatDate(task.due_date)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full mt-2 text-xs"
                      onClick={() => handleStartTask(task.id)}
                    >
                      Start Task
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 rounded-lg">
              <Loader2 className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-700">In Progress</span>
              <Badge className="ml-auto bg-blue-600">{tasksByStatus['In Progress'].length}</Badge>
            </div>
            <div className="space-y-2 min-h-[200px]">
              {tasksByStatus['In Progress'].map((task) => (
                <Card key={task.id} className="border-blue-200 bg-blue-50 hover:shadow-sm transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-blue-300 mt-0.5 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                        <p className="text-xs text-slate-500 truncate">{task.project?.project_name}</p>
                        <span className="text-xs text-slate-400">
                          Due: {formatDate(task.due_date)}
                        </span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full mt-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleCompleteTask(task.id)}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Complete
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Completed Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-100 rounded-lg">
              <Check className="w-4 h-4 text-emerald-600" />
              <span className="font-medium text-emerald-700">Completed</span>
              <Badge className="ml-auto bg-emerald-600">{tasksByStatus['Completed'].length}</Badge>
            </div>
            <div className="space-y-2 min-h-[200px] max-h-[400px] overflow-y-auto">
              {tasksByStatus['Completed'].slice(0, 10).map((task) => (
                <Card key={task.id} className="border-emerald-200 bg-emerald-50 opacity-75">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-600 truncate line-through">{task.title}</p>
                        <p className="text-xs text-slate-400 truncate">{task.project?.project_name}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Meeting Modal */}
      <Dialog open={showMeetingModal} onOpenChange={setShowMeetingModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-600" />
              Schedule Meeting
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Meeting Type</label>
              <Select
                value={meetingData.meeting_type}
                onValueChange={(value) => setMeetingData(prev => ({ ...prev, meeting_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="floor_plan">Floor Plan Meeting</SelectItem>
                  <SelectItem value="presentation">Design Presentation</SelectItem>
                  <SelectItem value="review">Review Meeting</SelectItem>
                  <SelectItem value="material">Material Selection</SelectItem>
                  <SelectItem value="kickoff">Kickoff Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700">Date</label>
              <Input
                type="date"
                value={meetingData.date}
                onChange={(e) => setMeetingData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Start Time</label>
                <Input
                  type="time"
                  value={meetingData.start_time}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">End Time</label>
                <Input
                  type="time"
                  value={meetingData.end_time}
                  onChange={(e) => setMeetingData(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>
            
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Video className="w-3 h-3" />
              Google Meet link will be auto-generated
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMeetingModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleScheduleMeeting} className="bg-purple-600 hover:bg-purple-700">
              Schedule Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Upload File
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">File Type</label>
              <Select
                value={uploadData.file_type}
                onValueChange={(value) => setUploadData(prev => ({ ...prev, file_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="measurement">Measurement File</SelectItem>
                  <SelectItem value="floor_plan">Floor Plan</SelectItem>
                  <SelectItem value="design">Design File</SelectItem>
                  <SelectItem value="design_presentation">Design Presentation</SelectItem>
                  <SelectItem value="corrected_design">Corrected Design</SelectItem>
                  <SelectItem value="final_design">Final Design</SelectItem>
                  <SelectItem value="sign_off_document">Sign-off Document</SelectItem>
                  <SelectItem value="production_drawings">Production Drawings</SelectItem>
                  <SelectItem value="cutting_list">Cutting List</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700">File Name</label>
              <Input
                value={uploadData.file_name}
                onChange={(e) => setUploadData(prev => ({ ...prev, file_name: e.target.value }))}
                placeholder="Enter file name"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-700">File URL</label>
              <Input
                value={uploadData.file_url}
                onChange={(e) => setUploadData(prev => ({ ...prev, file_url: e.target.value }))}
                placeholder="Paste file URL or upload"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadFile} className="bg-blue-600 hover:bg-blue-700">
              Upload File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DesignBoard;
