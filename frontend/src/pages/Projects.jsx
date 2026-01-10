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
  FolderKanban, 
  ChevronRight,
  Loader2,
  FileX2,
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

// Stage filter tabs - updated to 6 stages
const STAGE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Design Finalization', label: 'Design' },
  { key: 'Production Preparation', label: 'Prep' },
  { key: 'Production', label: 'Production' },
  { key: 'Delivery', label: 'Delivery' },
  { key: 'Installation', label: 'Installation' },
  { key: 'Handover', label: 'Handover' }
];

// Hold status filter tabs
const HOLD_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Active', label: 'Active' },
  { key: 'Hold', label: 'On Hold' },
  { key: 'Deactivated', label: 'Deactivated' }
];

// Stage badge styles
const STAGE_STYLES = {
  'Design Finalization': 'bg-slate-100 text-slate-600',
  'Production Preparation': 'bg-amber-100 text-amber-700',
  'Production': 'bg-blue-100 text-blue-700',
  'Delivery': 'bg-cyan-100 text-cyan-700',
  'Installation': 'bg-purple-100 text-purple-700',
  'Handover': 'bg-green-100 text-green-700'
};

// Role badge styles
const ROLE_BADGE_STYLES = {
  Admin: 'bg-purple-100 text-purple-700',
  Manager: 'bg-blue-100 text-blue-700',
  Designer: 'bg-pink-100 text-pink-700',
  PreSales: 'bg-orange-100 text-orange-700'
};

// Helper to mask phone number: 98****21
const maskPhone = (phone) => {
  if (!phone || phone.length < 4) return phone;
  const first2 = phone.slice(0, 2);
  const last2 = phone.slice(-2);
  return `${first2}****${last2}`;
};

// Helper to format relative time
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

// Collaborator Avatar Stack Component
const CollaboratorStack = ({ collaborators, maxShow = 3 }) => {
  const displayCollabs = collaborators.slice(0, maxShow);
  const remaining = collaborators.length - maxShow;

  return (
    <div className="flex items-center -space-x-2">
      {displayCollabs.map((collab, idx) => (
        <div
          key={collab.user_id || idx}
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white border-2 border-white",
            getAvatarColor(collab.name)
          )}
          title={collab.name}
        >
          {collab.picture ? (
            <img 
              src={collab.picture} 
              alt={collab.name} 
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            getInitials(collab.name)
          )}
        </div>
      ))}
      {remaining > 0 && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-slate-200 text-slate-600 border-2 border-white">
          +{remaining}
        </div>
      )}
    </div>
  );
};

// Empty State Component
const EmptyState = ({ hasSearch, hasFilter }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
      <FileX2 className="w-8 h-8 text-slate-400" />
    </div>
    <h3 className="text-lg font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
      No projects here yet!
    </h3>
    <p className="text-sm text-slate-500 max-w-xs">
      {hasSearch || hasFilter 
        ? "Try another filter or search term."
        : "Projects assigned to you will appear here."
      }
    </p>
  </div>
);

const Projects = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [seeding, setSeeding] = useState(false);

  // Fetch projects
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeFilter !== 'all') {
        params.append('stage', activeFilter);
      }
      
      const response = await axios.get(`${API}/projects?${params.toString()}`, {
        withCredentials: true
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]);

  // Client-side search filtering
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    
    const query = searchQuery.toLowerCase();
    return projects.filter(project => 
      project.project_name.toLowerCase().includes(query) ||
      project.client_name.toLowerCase().includes(query) ||
      project.client_phone.replace(/\s/g, '').includes(query.replace(/\s/g, ''))
    );
  }, [projects, searchQuery]);

  // Seed sample data (Admin/Manager only)
  const handleSeedData = async () => {
    try {
      setSeeding(true);
      await axios.post(`${API}/projects/seed`, {}, {
        withCredentials: true
      });
      toast.success('Sample projects created!');
      fetchProjects();
    } catch (error) {
      console.error('Failed to seed projects:', error);
      toast.error('Failed to create sample projects');
    } finally {
      setSeeding(false);
    }
  };

  // Navigate to project detail
  const handleProjectClick = (projectId) => {
    navigate(`/projects/${projectId}`);
  };

  return (
    <div className="space-y-6" data-testid="projects-page">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 
              className="text-3xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              My Projects
            </h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              {user?.role === 'Designer' 
                ? 'Projects assigned to you'
                : 'All projects in the system'
              }
            </p>
          </div>
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

        {/* Seed button for Admin/Manager when no projects */}
        {(user?.role === 'Admin' || user?.role === 'Manager') && projects.length === 0 && !loading && (
          <Button 
            onClick={handleSeedData}
            disabled={seeding}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="seed-projects-btn"
          >
            {seeding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              '+ Add Sample Projects'
            )}
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search by project, client, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white border-slate-200 focus:border-blue-500"
          data-testid="projects-search-input"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STAGE_FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              activeFilter === filter.key
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
            data-testid={`filter-${filter.key.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Projects Table/List */}
      <Card className="border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <EmptyState 
              hasSearch={searchQuery.trim().length > 0} 
              hasFilter={activeFilter !== 'all'} 
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="projects-table">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Project Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Collaborators
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Client Phone
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                      Summary
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Updated
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => (
                    <tr
                      key={project.project_id}
                      onClick={() => handleProjectClick(project.project_id)}
                      className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors group"
                      data-testid={`project-row-${project.project_id}`}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            {project.pid && (
                              <span className="font-mono text-xs font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded">
                                {project.pid}
                              </span>
                            )}
                            <p className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                              {project.project_name}
                            </p>
                            {/* Hold Status Badge */}
                            {project.hold_status && project.hold_status !== 'Active' && (
                              <span 
                                className={cn(
                                  "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                  project.hold_status === 'Hold' && 'bg-amber-100 text-amber-700',
                                  project.hold_status === 'Deactivated' && 'bg-red-100 text-red-700'
                                )}
                                data-testid={`hold-status-${project.project_id}`}
                              >
                                {project.hold_status === 'Hold' && <Pause className="w-2.5 h-2.5 mr-0.5" />}
                                {project.hold_status === 'Deactivated' && <Power className="w-2.5 h-2.5 mr-0.5" />}
                                {project.hold_status}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {project.client_name}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {project.collaborators && project.collaborators.length > 0 ? (
                          <CollaboratorStack collaborators={project.collaborators} />
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span 
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                            STAGE_STYLES[project.stage] || 'bg-slate-100 text-slate-600'
                          )}
                          data-testid={`stage-badge-${project.project_id}`}
                        >
                          {project.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600 font-mono">
                          {maskPhone(project.client_phone)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell max-w-xs">
                        <p className="text-sm text-slate-500 truncate">
                          {project.summary || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500">
                          {formatRelativeTime(project.updated_at)}
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

      {/* Project count */}
      {!loading && filteredProjects.length > 0 && (
        <p className="text-xs text-slate-500 text-center">
          Showing {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      )}
    </div>
  );
};

export default Projects;
