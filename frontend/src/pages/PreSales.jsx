import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Search, 
  UserPlus,
  ChevronRight,
  Loader2,
  FileX2,
  Phone,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Status filter tabs
const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
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

// Helper to mask phone number
const maskPhone = (phone) => {
  if (!phone || phone.length < 4) return phone;
  const first2 = phone.slice(0, 2);
  const last2 = phone.slice(-2);
  return `${first2}****${last2}`;
};

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
        : "New leads will appear here."
      }
    </p>
  </div>
);

const PreSales = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [seeding, setSeeding] = useState(false);

  // Redirect if Designer
  useEffect(() => {
    if (user?.role === 'Designer') {
      toast.error('Access denied');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Fetch leads
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeFilter !== 'all') {
        params.append('status', activeFilter);
      }
      
      // Use /api/presales endpoint for pre-sales leads only
      const response = await axios.get(`${API}/presales?${params.toString()}`, {
        withCredentials: true
      });
      setLeads(response.data);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'Designer') {
      fetchLeads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

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

  // Navigate to pre-sales detail (NOT leads)
  const handleLeadClick = (leadId) => {
    navigate(`/presales/${leadId}`);
  };

  if (user?.role === 'Designer') {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="presales-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 
              className="text-3xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Pre-Sales
            </h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              {user?.role === 'PreSales' 
                ? 'Your assigned leads'
                : 'Manage all pre-sales leads'
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
          {/* Create New Lead Button - Main action for Pre-Sales */}
          {['Admin', 'SalesManager', 'PreSales'].includes(user?.role) && (
            <Button 
              onClick={() => navigate('/presales/create')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="create-presales-lead-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Lead
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
          data-testid="presales-search-input"
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
              <table className="w-full" data-testid="presales-table">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                      Assigned To
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Created
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
                        <p className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                          {lead.customer_name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600 font-mono flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {maskPhone(lead.customer_phone)}
                        </span>
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
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          STAGE_STYLES[lead.stage] || 'bg-slate-100 text-slate-600'
                        )}>
                          {lead.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-slate-600">
                          {lead.assigned_to_details?.name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500">
                          {formatDate(lead.created_at)}
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

export default PreSales;
