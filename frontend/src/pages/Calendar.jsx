import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { enUS } from 'date-fns/locale';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Badge } from '../components/ui/badge';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  ExternalLink,
  CheckCircle2,
  Milestone,
  ListTodo,
  X,
  MoreVertical,
  Trash2,
  CalendarDays
} from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Date-fns localizer setup
const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Color constants
const COLORS = {
  milestone: {
    upcoming: '#2563EB',
    completed: '#22C55E',
    delayed: '#EF4444'
  },
  task: {
    pending: '#EAB308',
    inProgress: '#F97316',
    completed: '#22C55E',
    overdue: '#EF4444'
  },
  meeting: {
    scheduled: '#9333EA',
    completed: '#22C55E',
    missed: '#EF4444',
    cancelled: '#6B7280'
  }
};

// Custom event component - defined outside main component
const CalendarEventComponent = ({ event }) => {
  const isMilestone = event.type === 'milestone';
  const isMeeting = event.type === 'meeting';
  
  return (
    <div
      className="flex items-center gap-1 px-1 py-0.5 rounded text-xs font-medium truncate"
      style={{ backgroundColor: event.color, color: '#fff' }}
    >
      {isMilestone ? (
        <Milestone className="w-3 h-3 flex-shrink-0" />
      ) : isMeeting ? (
        <CalendarDays className="w-3 h-3 flex-shrink-0" />
      ) : (
        <ListTodo className="w-3 h-3 flex-shrink-0" />
      )}
      <span className="truncate">{event.title}</span>
    </div>
  );
};

// Legend component - defined outside main component
const CalendarLegend = () => (
  <div className="flex flex-wrap items-center gap-4 mb-4 text-xs">
    <span className="font-medium text-slate-600">Legend:</span>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.milestone.upcoming }} />
      <span>Milestone (Upcoming)</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.milestone.completed }} />
      <span>Completed</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.milestone.delayed }} />
      <span>Delayed/Overdue</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.task.pending }} />
      <span>Task (Pending)</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.task.inProgress }} />
      <span>Task (In Progress)</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.meeting.scheduled }} />
      <span>Meeting (Scheduled)</span>
    </div>
  </div>
);

// Toolbar component - defined outside main component
const CalendarToolbar = ({ 
  currentDate, 
  onNavigate, 
  view, 
  onViewChange, 
  showFilters, 
  onToggleFilters, 
  userRole, 
  onCreateTask 
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onNavigate('TODAY')}
      >
        Today
      </Button>
      <div className="flex items-center border rounded-lg">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onNavigate('PREV')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 font-medium text-sm">
          {format(currentDate, 'MMMM yyyy')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onNavigate('NEXT')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
    
    <div className="flex items-center gap-2">
      <Select value={view} onValueChange={onViewChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="month">Month</SelectItem>
          <SelectItem value="week">Week</SelectItem>
          <SelectItem value="day">Day</SelectItem>
        </SelectContent>
      </Select>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onToggleFilters}
        className={showFilters ? 'bg-blue-50 border-blue-200' : ''}
      >
        <Filter className="h-4 w-4 mr-2" />
        Filters
      </Button>
      
      {['Admin', 'Manager', 'Designer', 'PreSales'].includes(userRole) && (
        <Button size="sm" onClick={onCreateTask}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      )}
    </div>
  </div>
);

// Filter panel component - defined outside main component
const CalendarFilterPanel = ({ 
  showFilters, 
  filters, 
  onFilterChange, 
  onClearFilters, 
  userRole, 
  projects, 
  designers 
}) => {
  if (!showFilters) return null;
  
  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Event Type</Label>
            <Select
              value={filters.eventType}
              onValueChange={(value) => onFilterChange('eventType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="milestone">Milestones Only</SelectItem>
                <SelectItem value="task">Tasks Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {userRole !== 'PreSales' && (
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Project</Label>
              <Select
                value={filters.projectId || 'all'}
                onValueChange={(value) => onFilterChange('projectId', value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.project_id} value={project.project_id}>
                      {project.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {['Admin', 'Manager'].includes(userRole) && (
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Designer</Label>
              <Select
                value={filters.designerId || 'all'}
                onValueChange={(value) => onFilterChange('designerId', value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Designers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Designers</SelectItem>
                  {designers.map(designer => (
                    <SelectItem key={designer.user_id} value={designer.user_id}>
                      {designer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => onFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="delayed">Delayed/Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex justify-end mt-4">
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Null toolbar for calendar
const NullToolbar = () => null;

const Calendar = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  
  // Filters
  const [filters, setFilters] = useState({
    eventType: 'all',
    projectId: '',
    designerId: '',
    status: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Data for filters
  const [projects, setProjects] = useState([]);
  const [designers, setDesigners] = useState([]);
  
  // Selected event modal
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  
  // Create task modal
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    project_id: '',
    assigned_to: '',
    priority: 'Medium',
    due_date: ''
  });
  const [creatingTask, setCreatingTask] = useState(false);
  
  // Active users for assignment
  const [activeUsers, setActiveUsers] = useState([]);

  // Fetch filter data
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [projectsRes, designersRes, usersRes] = await Promise.all([
          axios.get(`${API_URL}/api/projects`, { withCredentials: true }),
          axios.get(`${API_URL}/api/users/active/designers`, { withCredentials: true }),
          axios.get(`${API_URL}/api/users/active`, { withCredentials: true }).catch(() => ({ data: [] }))
        ]);
        
        setProjects(projectsRes.data || []);
        setDesigners(designersRes.data || []);
        setActiveUsers(usersRes.data || designersRes.data || []);
      } catch (error) {
        console.error('Error fetching filter data:', error);
      }
    };
    
    fetchFilterData();
  }, []);

  // Fetch calendar events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = startOfMonth(subMonths(currentDate, 1)).toISOString();
      const endDate = endOfMonth(addMonths(currentDate, 1)).toISOString();
      
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      });
      
      if (filters.eventType && filters.eventType !== 'all') {
        params.append('event_type', filters.eventType);
      }
      if (filters.projectId) {
        params.append('project_id', filters.projectId);
      }
      if (filters.designerId) {
        params.append('designer_id', filters.designerId);
      }
      if (filters.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }
      
      const response = await axios.get(`${API_URL}/api/calendar-events?${params}`, {
        withCredentials: true
      });
      
      // Transform events for react-big-calendar
      const transformedEvents = (response.data.events || []).map(event => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
        allDay: true
      }));
      
      setEvents(transformedEvents);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [currentDate, filters]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Navigate calendar
  const handleNavigate = (action) => {
    if (action === 'PREV') {
      setCurrentDate(prev => subMonths(prev, 1));
    } else if (action === 'NEXT') {
      setCurrentDate(prev => addMonths(prev, 1));
    } else if (action === 'TODAY') {
      setCurrentDate(new Date());
    }
  };

  // Event click handler
  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  // Mark task as completed
  const handleMarkTaskComplete = async () => {
    if (!selectedEvent || selectedEvent.type !== 'task') return;
    
    try {
      await axios.put(`${API_URL}/api/tasks/${selectedEvent.id}`, {
        status: 'Completed'
      }, { withCredentials: true });
      
      toast.success('Task marked as completed');
      setShowEventModal(false);
      fetchEvents();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  // Delete task
  const handleDeleteTask = async () => {
    if (!selectedEvent || selectedEvent.type !== 'task') return;
    
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/tasks/${selectedEvent.id}`, {
        withCredentials: true
      });
      
      toast.success('Task deleted');
      setShowEventModal(false);
      fetchEvents();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  // Handle create task button click
  const handleCreateTaskClick = () => {
    // Pre-fill assigned_to for self-assignment
    if (user?.role === 'Designer' || user?.role === 'PreSales') {
      setNewTask(prev => ({ ...prev, assigned_to: user.user_id }));
    }
    setShowCreateTaskModal(true);
  };

  // Create task
  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.assigned_to || !newTask.due_date) {
      toast.error('Please fill in required fields');
      return;
    }
    
    setCreatingTask(true);
    try {
      await axios.post(`${API_URL}/api/tasks`, {
        ...newTask,
        project_id: newTask.project_id || null
      }, { withCredentials: true });
      
      toast.success('Task created successfully');
      setShowCreateTaskModal(false);
      setNewTask({
        title: '',
        description: '',
        project_id: '',
        assigned_to: '',
        priority: 'Medium',
        due_date: ''
      });
      fetchEvents();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(error.response?.data?.detail || 'Failed to create task');
    } finally {
      setCreatingTask(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilters({
      eventType: 'all',
      projectId: '',
      designerId: '',
      status: 'all'
    });
  };

  // Event style getter
  const eventStyleGetter = (event) => ({
    style: {
      backgroundColor: event.color,
      borderRadius: '4px',
      opacity: 0.9,
      color: 'white',
      border: 'none',
      display: 'block'
    }
  });

  // Summary stats
  const stats = useMemo(() => {
    const milestones = events.filter(e => e.type === 'milestone');
    const tasks = events.filter(e => e.type === 'task');
    
    return {
      totalMilestones: milestones.length,
      delayedMilestones: milestones.filter(m => m.status === 'delayed').length,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      overdueTasks: tasks.filter(t => t.is_overdue).length
    };
  }, [events]);

  // Calendar components config
  const calendarComponents = useMemo(() => ({
    event: CalendarEventComponent,
    toolbar: NullToolbar
  }), []);

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-blue-600" />
            Calendar
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            View project milestones and tasks in one place
          </p>
        </div>
        
        {/* Quick Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
            <Milestone className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">{stats.totalMilestones} Milestones</span>
            {stats.delayedMilestones > 0 && (
              <Badge variant="destructive" className="text-xs">{stats.delayedMilestones} delayed</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg">
            <ListTodo className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">{stats.totalTasks} Tasks</span>
            {stats.overdueTasks > 0 && (
              <Badge variant="destructive" className="text-xs">{stats.overdueTasks} overdue</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <CalendarToolbar
        currentDate={currentDate}
        onNavigate={handleNavigate}
        view={view}
        onViewChange={setView}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        userRole={user?.role}
        onCreateTask={handleCreateTaskClick}
      />
      
      {/* Filters */}
      <CalendarFilterPanel
        showFilters={showFilters}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        userRole={user?.role}
        projects={projects}
        designers={designers}
      />
      
      {/* Legend */}
      <CalendarLegend />

      {/* Calendar */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="h-[600px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="h-[600px]">
              <BigCalendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                view={view}
                onView={setView}
                date={currentDate}
                onNavigate={setCurrentDate}
                onSelectEvent={handleSelectEvent}
                eventPropGetter={eventStyleGetter}
                components={calendarComponents}
                popup
                selectable={false}
                className="arkiflo-calendar"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Modal */}
      <Dialog open={showEventModal} onOpenChange={setShowEventModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                {selectedEvent?.type === 'milestone' ? (
                  <Milestone className="h-5 w-5 text-blue-600" />
                ) : (
                  <ListTodo className="h-5 w-5 text-amber-600" />
                )}
                {selectedEvent?.type === 'milestone' ? 'Milestone' : 'Task'} Details
              </DialogTitle>
              {selectedEvent?.type === 'task' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={handleDeleteTask}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Task
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <DialogDescription>
              {selectedEvent?.project_name && (
                <span className="text-slate-500">
                  Project: {selectedEvent.project_name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedEvent.title}
                </h3>
                {selectedEvent.description && (
                  <p className="text-sm text-slate-600 mt-1">
                    {selectedEvent.description}
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Status</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: selectedEvent.color }}
                    />
                    <span className="capitalize font-medium">
                      {selectedEvent.is_overdue ? 'Overdue' : selectedEvent.status}
                    </span>
                  </div>
                </div>
                
                <div>
                  <span className="text-slate-500">
                    {selectedEvent.type === 'milestone' ? 'Expected Date' : 'Due Date'}
                  </span>
                  <p className="font-medium mt-1">
                    {format(new Date(selectedEvent.start), 'dd MMM yyyy')}
                  </p>
                </div>
                
                {selectedEvent.stage && (
                  <div>
                    <span className="text-slate-500">Stage</span>
                    <p className="font-medium mt-1">{selectedEvent.stage}</p>
                  </div>
                )}
                
                {selectedEvent.designer && (
                  <div>
                    <span className="text-slate-500">Designer</span>
                    <p className="font-medium mt-1">{selectedEvent.designer}</p>
                  </div>
                )}
                
                {selectedEvent.assignee_name && (
                  <div>
                    <span className="text-slate-500">Assigned To</span>
                    <p className="font-medium mt-1">{selectedEvent.assignee_name}</p>
                  </div>
                )}
                
                {selectedEvent.priority && (
                  <div>
                    <span className="text-slate-500">Priority</span>
                    <Badge
                      variant={
                        selectedEvent.priority === 'High' ? 'destructive' :
                        selectedEvent.priority === 'Medium' ? 'default' : 'secondary'
                      }
                      className="mt-1"
                    >
                      {selectedEvent.priority}
                    </Badge>
                  </div>
                )}
                
                {selectedEvent.client_name && (
                  <div>
                    <span className="text-slate-500">Client</span>
                    <p className="font-medium mt-1">{selectedEvent.client_name}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-2 sm:gap-0">
            {selectedEvent?.type === 'task' && selectedEvent.status !== 'completed' && (
              <Button
                variant="outline"
                onClick={handleMarkTaskComplete}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Completed
              </Button>
            )}
            
            {selectedEvent?.project_id && (
              <Button
                onClick={() => {
                  window.location.href = `/projects/${selectedEvent.project_id}`;
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Go to Project
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Modal */}
      <Dialog open={showCreateTaskModal} onOpenChange={setShowCreateTaskModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Create New Task
            </DialogTitle>
            <DialogDescription>
              Add a new task to your calendar
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Title *</Label>
              <Input
                id="task-title"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter task title"
              />
            </div>
            
            <div>
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter task description"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="task-due-date">Due Date *</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value) => setNewTask(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="task-assignee">Assign To *</Label>
              <Select
                value={newTask.assigned_to}
                onValueChange={(value) => setNewTask(prev => ({ ...prev, assigned_to: value }))}
                disabled={user?.role === 'Designer' || user?.role === 'PreSales'}
              >
                <SelectTrigger id="task-assignee">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {activeUsers.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(user?.role === 'Designer' || user?.role === 'PreSales') && (
                <p className="text-xs text-slate-500 mt-1">Tasks are assigned to yourself</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="task-project">Link to Project (Optional)</Label>
              <Select
                value={newTask.project_id || 'none'}
                onValueChange={(value) => setNewTask(prev => ({ ...prev, project_id: value === 'none' ? '' : value }))}
              >
                <SelectTrigger id="task-project">
                  <SelectValue placeholder="Select project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Project (Standalone Task)</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.project_id} value={project.project_id}>
                      {project.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateTaskModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={creatingTask}
            >
              {creatingTask ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Calendar Styles */}
      <style>{`
        .arkiflo-calendar .rbc-calendar {
          font-family: inherit;
        }
        .arkiflo-calendar .rbc-header {
          padding: 8px 4px;
          font-weight: 600;
          font-size: 12px;
          color: #64748b;
          border-bottom: 1px solid #e2e8f0;
        }
        .arkiflo-calendar .rbc-month-view {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }
        .arkiflo-calendar .rbc-day-bg {
          background: #fff;
        }
        .arkiflo-calendar .rbc-day-bg + .rbc-day-bg {
          border-left: 1px solid #e2e8f0;
        }
        .arkiflo-calendar .rbc-month-row + .rbc-month-row {
          border-top: 1px solid #e2e8f0;
        }
        .arkiflo-calendar .rbc-off-range-bg {
          background: #f8fafc;
        }
        .arkiflo-calendar .rbc-today {
          background: #eff6ff;
        }
        .arkiflo-calendar .rbc-date-cell {
          padding: 4px 8px;
          font-size: 13px;
          font-weight: 500;
        }
        .arkiflo-calendar .rbc-date-cell.rbc-now {
          font-weight: 700;
          color: #2563eb;
        }
        .arkiflo-calendar .rbc-event {
          padding: 2px 4px;
          font-size: 11px;
          margin-bottom: 1px;
        }
        .arkiflo-calendar .rbc-event:focus {
          outline: none;
        }
        .arkiflo-calendar .rbc-show-more {
          color: #2563eb;
          font-size: 11px;
          font-weight: 600;
          background: transparent;
        }
        .arkiflo-calendar .rbc-overlay {
          border-radius: 8px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
          padding: 8px;
          max-width: 280px;
        }
        .arkiflo-calendar .rbc-overlay-header {
          font-weight: 600;
          padding: 4px 8px;
          margin-bottom: 4px;
          border-bottom: 1px solid #e2e8f0;
        }
      `}</style>
    </div>
  );
};

export default Calendar;
