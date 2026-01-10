import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { 
  Search, 
  Wrench, 
  ChevronRight,
  Loader2,
  FileX2,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Stage badge styles
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

const PRIORITY_STYLES = {
  'High': 'bg-red-100 text-red-700',
  'Medium': 'bg-amber-100 text-amber-700',
  'Low': 'bg-green-100 text-green-700'
};

const ISSUE_CATEGORIES = [
  'Hardware Issue', 'Fitting Issue', 'Surface Damage', 'Hinge/Drawer Problem',
  'Water Damage', 'Electrical Issue', 'Door Alignment', 'Soft-close Issue',
  'General Maintenance', 'Other'
];

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const ServiceRequests = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  
  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRequest, setNewRequest] = useState({
    pid: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    issue_category: '',
    issue_description: '',
    priority: 'Medium'
  });

  useEffect(() => {
    fetchRequests();
  }, [stageFilter, priorityFilter]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (stageFilter && stageFilter !== 'all') params.append('stage', stageFilter);
      if (priorityFilter && priorityFilter !== 'all') params.append('priority', priorityFilter);
      const response = await axios.get(`${API}/service-requests?${params}`, { withCredentials: true });
      setRequests(response.data);
    } catch (err) {
      console.error('Failed to fetch service requests:', err);
      toast.error('Failed to load service requests');
    } finally {
      setLoading(false);
    }
  };

  const handlePIDLookup = async (pid) => {
    if (!pid) return;
    try {
      const response = await axios.get(`${API}/warranties/by-pid/${pid}`, { withCredentials: true });
      if (response.data) {
        setNewRequest(prev => ({
          ...prev,
          customer_name: response.data.customer_name || '',
          customer_phone: response.data.customer_phone || '',
          customer_email: response.data.customer_email || '',
          customer_address: response.data.customer_address || ''
        }));
        toast.success('Customer details auto-filled from PID');
      }
    } catch (err) {
      // PID not found, user can enter manually
    }
  };

  const handleCreateRequest = async () => {
    if (!newRequest.customer_name || !newRequest.customer_phone || !newRequest.issue_category || !newRequest.issue_description) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      setCreating(true);
      await axios.post(`${API}/service-requests`, newRequest, { withCredentials: true });
      toast.success('Service request created successfully');
      setShowCreateModal(false);
      setNewRequest({ pid: '', customer_name: '', customer_phone: '', customer_email: '', customer_address: '', issue_category: '', issue_description: '', priority: 'Medium' });
      fetchRequests();
    } catch (err) {
      console.error('Failed to create service request:', err);
      toast.error(err.response?.data?.detail || 'Failed to create service request');
    } finally {
      setCreating(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      r.service_request_id?.toLowerCase().includes(search) ||
      r.pid?.toLowerCase().includes(search) ||
      r.customer_name?.toLowerCase().includes(search) ||
      r.customer_phone?.includes(search)
    );
  });

  const canCreate = user?.role !== 'Technician';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="service-requests-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Service Requests
          </h1>
          <p className="text-slate-500 mt-1">
            {filteredRequests.length} requests
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="create-service-request-btn">
            <Plus className="w-4 h-4 mr-2" />
            Create Service Request
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by ID, PID, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="service-request-search"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="New">New</SelectItem>
            <SelectItem value="Assigned to Technician">Assigned</SelectItem>
            <SelectItem value="Technician Visited">Visited</SelectItem>
            <SelectItem value="Work In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Request List */}
      {filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileX2 className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No service requests found</h3>
            <p className="text-slate-500">Create a new service request to get started</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">ID / PID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Issue</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">SLA</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((sr) => {
                  const slaDate = new Date(sr.sla_visit_by);
                  const now = new Date();
                  const isSlaBreach = sr.stage !== 'Closed' && sr.stage !== 'Completed' && !sr.actual_visit_date && now > slaDate;
                  
                  return (
                    <tr
                      key={sr.service_request_id}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer group"
                      onClick={() => navigate(`/service-requests/${sr.service_request_id}`)}
                      data-testid={`service-request-row-${sr.service_request_id}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 group-hover:text-blue-600">{sr.service_request_id}</p>
                        {sr.pid && <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">{sr.pid.replace('ARKI-', '')}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-900">{sr.customer_name}</p>
                        <p className="text-xs text-slate-500">{sr.customer_phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-700">{sr.issue_category}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{sr.issue_description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", STAGE_STYLES[sr.stage])}>
                          {sr.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", PRIORITY_STYLES[sr.priority])}>
                          {sr.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isSlaBreach ? (
                          <span className="inline-flex items-center text-red-600 text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Breached
                          </span>
                        ) : sr.actual_visit_date ? (
                          <span className="inline-flex items-center text-green-600 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Visited
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-slate-500 text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        {formatRelativeTime(sr.updated_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Service Request</DialogTitle>
            <DialogDescription>Fill in the details to create a new service request</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>PID (optional)</Label>
                <Input
                  value={newRequest.pid}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, pid: e.target.value }))}
                  onBlur={(e) => handlePIDLookup(e.target.value)}
                  placeholder="ARKI-PID-XXXXX"
                />
              </div>
              <div>
                <Label>Priority *</Label>
                <Select value={newRequest.priority} onValueChange={(v) => setNewRequest(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Name *</Label>
                <Input value={newRequest.customer_name} onChange={(e) => setNewRequest(prev => ({ ...prev, customer_name: e.target.value }))} />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input value={newRequest.customer_phone} onChange={(e) => setNewRequest(prev => ({ ...prev, customer_phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Issue Category *</Label>
              <Select value={newRequest.issue_category} onValueChange={(v) => setNewRequest(prev => ({ ...prev, issue_category: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {ISSUE_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Issue Description *</Label>
              <Textarea
                value={newRequest.issue_description}
                onChange={(e) => setNewRequest(prev => ({ ...prev, issue_description: e.target.value }))}
                rows={3}
                placeholder="Describe the issue in detail..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateRequest} disabled={creating} className="bg-blue-600 hover:bg-blue-700">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceRequests;
