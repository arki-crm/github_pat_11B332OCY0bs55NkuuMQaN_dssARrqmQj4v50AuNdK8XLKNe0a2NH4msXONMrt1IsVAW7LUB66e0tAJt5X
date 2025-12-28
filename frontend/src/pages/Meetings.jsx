import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import MeetingModal from '../components/MeetingModal';
import MeetingCard from '../components/MeetingCard';
import {
  Calendar,
  Plus,
  Search,
  Filter,
  Loader2,
  CalendarDays,
  CalendarClock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Meetings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [filterType, setFilterType] = useState(searchParams.get('filter') || 'upcoming');
  const [statusFilter, setStatusFilter] = useState('all');
  const [designerFilter, setDesignerFilter] = useState('all');
  
  // Data for filters
  const [designers, setDesigners] = useState([]);
  
  // Modal state
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editMeeting, setEditMeeting] = useState(null);

  // Fetch designers for filter
  useEffect(() => {
    const fetchDesigners = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/users/active/designers`, {
          withCredentials: true
        });
        setDesigners(response.data || []);
      } catch (error) {
        console.error('Error fetching designers:', error);
      }
    };
    
    if (user?.role === 'Admin' || user?.role === 'Manager') {
      fetchDesigners();
    }
  }, [user]);

  // Fetch meetings
  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      // First, check for missed meetings
      await axios.post(`${API_URL}/api/meetings/check-missed`, {}, {
        withCredentials: true
      }).catch(() => {});

      const params = new URLSearchParams();
      
      if (filterType && filterType !== 'all') {
        params.append('filter_type', filterType);
      }
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (designerFilter && designerFilter !== 'all') {
        params.append('scheduled_for', designerFilter);
      }
      
      const response = await axios.get(`${API_URL}/api/meetings?${params}`, {
        withCredentials: true
      });
      
      setMeetings(response.data || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [filterType, statusFilter, designerFilter]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Update URL params when filter changes
  useEffect(() => {
    if (filterType && filterType !== 'upcoming') {
      setSearchParams({ filter: filterType });
    } else {
      setSearchParams({});
    }
  }, [filterType, setSearchParams]);

  // Mark meeting as completed
  const handleMarkCompleted = async (meetingId) => {
    try {
      await axios.put(`${API_URL}/api/meetings/${meetingId}`, {
        status: 'Completed'
      }, { withCredentials: true });
      
      toast.success('Meeting marked as completed');
      fetchMeetings();
    } catch (error) {
      console.error('Error updating meeting:', error);
      toast.error('Failed to update meeting');
    }
  };

  // Cancel meeting
  const handleCancelMeeting = async (meetingId) => {
    if (!window.confirm('Are you sure you want to cancel this meeting?')) return;
    
    try {
      await axios.put(`${API_URL}/api/meetings/${meetingId}`, {
        status: 'Cancelled'
      }, { withCredentials: true });
      
      toast.success('Meeting cancelled');
      fetchMeetings();
    } catch (error) {
      console.error('Error cancelling meeting:', error);
      toast.error('Failed to cancel meeting');
    }
  };

  // Filter meetings by search
  const filteredMeetings = meetings.filter(meeting => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      meeting.title?.toLowerCase().includes(query) ||
      meeting.description?.toLowerCase().includes(query) ||
      meeting.location?.toLowerCase().includes(query) ||
      meeting.project?.project_name?.toLowerCase().includes(query) ||
      meeting.lead?.customer_name?.toLowerCase().includes(query) ||
      meeting.scheduled_for_user?.name?.toLowerCase().includes(query)
    );
  });

  // Count stats
  const stats = {
    total: meetings.length,
    scheduled: meetings.filter(m => m.status === 'Scheduled').length,
    completed: meetings.filter(m => m.status === 'Completed').length,
    missed: meetings.filter(m => m.status === 'Missed').length
  };

  const isAdminOrManager = user?.role === 'Admin' || user?.role === 'Manager';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-purple-600" />
            Meetings
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage your scheduled meetings
          </p>
        </div>
        
        <Button 
          onClick={() => {
            setEditMeeting(null);
            setShowMeetingModal(true);
          }}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Schedule Meeting
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CalendarDays className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                <p className="text-xs text-slate-500">Total Meetings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CalendarClock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.scheduled}</p>
                <p className="text-xs text-slate-500">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.completed}</p>
                <p className="text-xs text-slate-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.missed}</p>
                <p className="text-xs text-slate-500">Missed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
        <Tabs value={filterType} onValueChange={setFilterType} className="flex-1">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="today" className="data-[state=active]:bg-white">
              Today
            </TabsTrigger>
            <TabsTrigger value="this_week" className="data-[state=active]:bg-white">
              This Week
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="data-[state=active]:bg-white">
              Upcoming
            </TabsTrigger>
            <TabsTrigger value="missed" className="data-[state=active]:bg-white">
              Missed
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-white">
              All
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          
          {isAdminOrManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-purple-50 border-purple-200' : ''}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          )}
        </div>
      </div>

      {/* Additional Filters */}
      {showFilters && isAdminOrManager && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Missed">Missed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Designer</label>
                <Select value={designerFilter} onValueChange={setDesignerFilter}>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meetings List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : filteredMeetings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No meetings found</h3>
            <p className="text-sm text-slate-500 mb-4">
              {searchQuery ? 'Try adjusting your search' : 'Schedule your first meeting to get started'}
            </p>
            <Button 
              onClick={() => setShowMeetingModal(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Schedule Meeting
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeetings.map(meeting => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onMarkCompleted={handleMarkCompleted}
              onCancel={handleCancelMeeting}
              onViewProject={(projectId) => navigate(`/projects/${projectId}`)}
              onViewLead={(leadId) => navigate(`/leads/${leadId}`)}
            />
          ))}
        </div>
      )}

      {/* Meeting Modal */}
      <MeetingModal
        open={showMeetingModal}
        onOpenChange={setShowMeetingModal}
        onSuccess={fetchMeetings}
        editMeeting={editMeeting}
      />
    </div>
  );
};

export default Meetings;
