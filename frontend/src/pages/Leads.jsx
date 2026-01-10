import React, { useState, useEffect, useMemo } from 'react';
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
  Search, 
  ChevronRight,
  Loader2,
  FileX2,
  Users,
  Plus,
  Pause,
  Power,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Time filter options
const TIME_FILTERS = [
  { key: 'all', label: 'All Time' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' }
];

// Status filter tabs
const STATUS_FILTERS = [
  { key: 'all', label: 'All Leads' },
  { key: 'New', label: 'New' },
  { key: 'Contacted', label: 'Contacted' },
  { key: 'Waiting', label: 'Waiting' },
  { key: 'Qualified', label: 'Qualified' },
  { key: 'Dropped', label: 'Dropped' }
];

// Status badge styles
const STATUS_STYLES = {
  'New': 'bg-blue-100 text-blue-700',
  'Contacted': 'bg-amber-100 text-amber-700',
  'Waiting': 'bg-purple-100 text-purple-700',
  'Qualified': 'bg-green-100 text-green-700',
  'Dropped': 'bg-red-100 text-red-700'
};

// Stage badge styles
const STAGE_STYLES = {
  'BC Call Done': 'bg-slate-100 text-slate-600',
  'BOQ Shared': 'bg-amber-100 text-amber-700',
  'Site Meeting': 'bg-cyan-100 text-cyan-700',
  'Revised BOQ Shared': 'bg-blue-100 text-blue-700',
  'Waiting for Booking': 'bg-purple-100 text-purple-700',
  'Booking Completed': 'bg-green-100 text-green-700'
};

// Source badge styles
const SOURCE_STYLES = {
  'Meta': 'bg-blue-50 text-blue-600',
  'Walk-in': 'bg-green-50 text-green-600',
  'Referral': 'bg-orange-50 text-orange-600',
  'Others': 'bg-slate-50 text-slate-600'
};

const ROLE_BADGE_STYLES = {
  Admin: 'bg-purple-100 text-purple-700',
  Manager: 'bg-blue-100 text-blue-700',
  Designer: 'bg-pink-100 text-pink-700',
  PreSales: 'bg-orange-100 text-orange-700'
};

// Format relative time
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
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// Get initials
const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Avatar color
const getAvatarColor = (name) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
    'bg-amber-500', 'bg-cyan-500', 'bg-red-500', 'bg-indigo-500'
  ];
  const index = name ? name.charCodeAt(0) % colors.length : 0;
  return colors[index];
};

// Empty State
const EmptyState = ({ hasSearch, hasFilter }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
      <FileX2 className="w-8 h-8 text-slate-400" />
    </div>
    <h3 className="text-lg font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
      No leads found
    </h3>
    <p className="text-sm text-slate-500 max-w-xs">
      {hasSearch || hasFilter 
        ? "Try another filter or search term."
        : "Leads will appear here."
      }
    </p>
  </div>
);

const Leads = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [seeding, setSeeding] = useState(false);

  // Fetch leads
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeFilter !== 'all') {
        params.append('status', activeFilter);
      }
      if (timeFilter !== 'all') {
        params.append('time_filter', timeFilter);
      }
      
      const response = await axios.get(`${API}/leads?${params.toString()}`, {
        withCredentials: true
      });
      setLeads(response.data);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
      if (error.response?.status === 403) {
        toast.error('Access denied');
        navigate('/dashboard', { replace: true });
      } else {
        toast.error('Failed to load leads');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, timeFilter]);

  // Client-side search
  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    
    const query = searchQuery.toLowerCase();
    return leads.filter(lead => 
      lead.customer_name.toLowerCase().includes(query) ||
      lead.customer_phone.replace(/\s/g, '').includes(query.replace(/\s/g, ''))
    );
  }, [leads, searchQuery]);

  // Seed sample data
  const handleSeedData = async () => {
    try {
      setSeeding(true);
      await axios.post(`${API}/leads/seed`, {}, { withCredentials: true });
      toast.success('Sample leads created!');
      fetchLeads();
    } catch (error) {
      console.error('Failed to seed leads:', error);
      toast.error('Failed to create sample leads');
    } finally {
      setSeeding(false);
    }
  };

  // Navigate to lead detail
  const handleLeadClick = (leadId) => {
    navigate(`/leads/${leadId}`);
  };

  return (
    <div className="space-y-6" data-testid="leads-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 
              className="text-3xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Leads
            </h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              {user?.role === 'Designer' 
                ? 'Leads assigned to you'
                : 'All leads in the system'
              }
            </p>
          </div>
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

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Create Lead Button */}
          {['Admin', 'SalesManager', 'PreSales'].includes(user?.role) && (
            <Button 
              onClick={() => navigate('/leads/create')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="create-lead-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Lead
            </Button>
          )}
          
          {/* Seed button */}
          {(user?.role === 'Admin' || user?.role === 'SalesManager') && leads.length === 0 && !loading && (
            <Button 
              onClick={handleSeedData}
              disabled={seeding}
              variant="outline"
              data-testid="seed-leads-btn"
            >
              {seeding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                '+ Add Sample Leads'
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white border-slate-200 focus:border-blue-500"
          data-testid="leads-search-input"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              activeFilter === filter.key
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
            data-testid={`filter-${filter.key.toLowerCase()}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Leads Table */}
      <Card className="border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <EmptyState 
              hasSearch={searchQuery.trim().length > 0} 
              hasFilter={activeFilter !== 'all'} 
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="leads-table">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Lead Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Designer
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Updated
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr
                      key={lead.lead_id}
                      onClick={() => handleLeadClick(lead.lead_id)}
                      className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors group"
                      data-testid={`lead-row-${lead.lead_id}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {lead.pid && (
                            <span className="font-mono text-xs font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded">
                              {lead.pid}
                            </span>
                          )}
                          <p className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                            {lead.customer_name}
                          </p>
                          {/* Hold Status Badge */}
                          {lead.hold_status && lead.hold_status !== 'Active' && (
                            <span 
                              className={cn(
                                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                lead.hold_status === 'Hold' && 'bg-amber-100 text-amber-700',
                                lead.hold_status === 'Deactivated' && 'bg-red-100 text-red-700'
                              )}
                              data-testid={`hold-status-${lead.lead_id}`}
                            >
                              {lead.hold_status === 'Hold' && <Pause className="w-2.5 h-2.5 mr-0.5" />}
                              {lead.hold_status === 'Deactivated' && <Power className="w-2.5 h-2.5 mr-0.5" />}
                              {lead.hold_status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          STAGE_STYLES[lead.stage] || 'bg-slate-100 text-slate-600'
                        )}>
                          {lead.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {lead.designer_details ? (
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white",
                              getAvatarColor(lead.designer_details.name)
                            )}>
                              {getInitials(lead.designer_details.name)}
                            </div>
                            <span className="text-sm text-slate-600">{lead.designer_details.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          SOURCE_STYLES[lead.source] || 'bg-slate-50 text-slate-600'
                        )}>
                          {lead.source}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          STATUS_STYLES[lead.status] || 'bg-slate-100 text-slate-600'
                        )}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500">
                          {formatRelativeTime(lead.updated_at)}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lead count */}
      {!loading && filteredLeads.length > 0 && (
        <p className="text-xs text-slate-500 text-center">
          Showing {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      )}
    </div>
  );
};

export default Leads;
