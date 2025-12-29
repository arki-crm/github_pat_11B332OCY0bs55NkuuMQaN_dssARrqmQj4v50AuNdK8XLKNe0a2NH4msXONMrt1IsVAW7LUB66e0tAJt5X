import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import axios from 'axios';
import { 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  TrendingUp, 
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Phone,
  FileText,
  UserCheck,
  Calendar,
  ArrowRight,
  Filter,
  BarChart3
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ============ KPI CARD COMPONENT ============
const KPICard = ({ title, value, icon: Icon, trend, trendUp, onClick, color = 'blue', subtitle }) => {
  const colorClasses = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'hover:border-blue-300' },
    green: { bg: 'bg-green-50', text: 'text-green-600', border: 'hover:border-green-300' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'hover:border-purple-300' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'hover:border-orange-300' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'hover:border-red-300' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'hover:border-slate-300' }
  };
  
  const colors = colorClasses[color] || colorClasses.blue;
  
  return (
    <Card 
      className={cn(
        "border-slate-200 shadow-sm cursor-pointer transition-all duration-200",
        colors.border,
        onClick && "hover:shadow-md"
      )}
      onClick={onClick}
      data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {title}
        </CardTitle>
        <div className={cn("p-2 rounded-lg", colors.bg)}>
          <Icon className={cn("w-4 h-4", colors.text)} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-end gap-2">
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          {trend && (
            <div className={cn(
              "flex items-center text-xs font-medium mb-1",
              trendUp ? "text-green-600" : "text-red-500"
            )}>
              {trendUp ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {trend}
            </div>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
};

// ============ QUICK FILTER BUTTON ============
const QuickFilterButton = ({ label, onClick, active = false }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
      active 
        ? "bg-blue-600 text-white" 
        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    )}
  >
    {label}
  </button>
);

// ============ STAGE BAR CHART ============
const StageBarChart = ({ data, maxValue, colorClass = 'bg-blue-500' }) => {
  return (
    <div className="space-y-2">
      {Object.entries(data || {}).map(([stage, count]) => (
        <div key={stage} className="flex items-center gap-2">
          <div className="w-32 text-xs text-slate-600 truncate" title={stage}>{stage}</div>
          <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
            <div 
              className={cn("h-full rounded transition-all", colorClass)}
              style={{ width: `${(count / Math.max(maxValue, 1)) * 100}%` }}
            />
          </div>
          <div className="w-8 text-xs text-slate-600 text-right">{count}</div>
        </div>
      ))}
    </div>
  );
};

// ============ MILESTONE TABLE ============
const MilestoneTable = ({ milestones, title, showDaysDelayed = false }) => {
  const navigate = useNavigate();
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          {showDaysDelayed ? (
            <AlertTriangle className="w-4 h-4 text-red-500" />
          ) : (
            <Calendar className="w-4 h-4 text-blue-600" />
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {milestones?.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No milestones to show</p>
        ) : (
          <ScrollArea className="h-[200px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-slate-500 font-medium">Project</th>
                  <th className="text-left py-2 text-slate-500 font-medium">Milestone</th>
                  <th className="text-left py-2 text-slate-500 font-medium">Expected</th>
                  {showDaysDelayed && <th className="text-left py-2 text-slate-500 font-medium">Days</th>}
                  <th className="text-left py-2 text-slate-500 font-medium">Designer</th>
                  <th className="text-left py-2 text-slate-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {milestones?.slice(0, 10).map((m, idx) => (
                  <tr 
                    key={idx} 
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                    onClick={() => m.id?.startsWith('proj_') && navigate(`/projects/${m.id}`)}
                  >
                    <td className="py-2 text-slate-700 font-medium truncate max-w-[120px]" title={m.name}>
                      {m.name}
                    </td>
                    <td className="py-2 text-slate-600 truncate max-w-[120px]" title={m.milestone}>
                      {m.milestone}
                    </td>
                    <td className="py-2 text-slate-600">{formatDate(m.expectedDate)}</td>
                    {showDaysDelayed && (
                      <td className="py-2">
                        <span className="text-red-600 font-medium">{m.daysDelayed}d</span>
                      </td>
                    )}
                    <td className="py-2 text-slate-600">{m.designer || '-'}</td>
                    <td className="py-2">
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        m.status === 'delayed' ? 'border-red-200 text-red-600 bg-red-50' : 
                        'border-slate-200 text-slate-600'
                      )}>
                        {m.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

// ============ DESIGNER PERFORMANCE TABLE ============
const DesignerPerformanceTable = ({ designers }) => (
  <Card className="border-slate-200">
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-purple-600" />
        Designer Performance
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      {designers?.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No designers found</p>
      ) : (
        <ScrollArea className="h-[180px]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 text-slate-500 font-medium">Designer</th>
                <th className="text-center py-2 text-slate-500 font-medium">Active</th>
                <th className="text-center py-2 text-slate-500 font-medium">On-time</th>
                <th className="text-center py-2 text-slate-500 font-medium">Delayed</th>
              </tr>
            </thead>
            <tbody>
              {designers?.map((d, idx) => (
                <tr key={idx} className="border-b border-slate-50">
                  <td className="py-2 text-slate-700 font-medium">{d.name}</td>
                  <td className="py-2 text-center text-slate-600">{d.activeProjects}</td>
                  <td className="py-2 text-center text-green-600">{d.onTimeMilestones}</td>
                  <td className="py-2 text-center text-red-500">{d.delayedMilestones}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </CardContent>
  </Card>
);

// ============ PRESALES PERFORMANCE TABLE ============
const PreSalesPerformanceTable = ({ presales }) => (
  <Card className="border-slate-200">
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <Users className="w-4 h-4 text-green-600" />
        Pre-Sales Performance
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      {presales?.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No pre-sales users found</p>
      ) : (
        <ScrollArea className="h-[180px]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 text-slate-500 font-medium">Name</th>
                <th className="text-center py-2 text-slate-500 font-medium">Total</th>
                <th className="text-center py-2 text-slate-500 font-medium">Active</th>
                <th className="text-center py-2 text-slate-500 font-medium">Converted</th>
              </tr>
            </thead>
            <tbody>
              {presales?.map((p, idx) => (
                <tr key={idx} className="border-b border-slate-50">
                  <td className="py-2 text-slate-700 font-medium">{p.name}</td>
                  <td className="py-2 text-center text-slate-600">{p.totalLeads}</td>
                  <td className="py-2 text-center text-blue-600">{p.activeLeads}</td>
                  <td className="py-2 text-center text-green-600">{p.converted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </CardContent>
  </Card>
);

// ============ MAIN DASHBOARD COMPONENT ============
const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Role-based dashboard redirect
  useEffect(() => {
    if (user?.role === 'DesignManager') {
      navigate('/design-manager', { replace: true });
      return;
    }
    if (user?.role === 'ProductionManager') {
      navigate('/validation-pipeline', { replace: true });
      return;
    }
  }, [user, navigate]);
  
  useEffect(() => {
    // Don't fetch if redirecting
    if (user?.role === 'DesignManager' || user?.role === 'ProductionManager') return;
    fetchDashboardData();
  }, [user]);
  
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/dashboard`, { withCredentials: true });
      setDashboardData(response.data);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
  
  const navigateWithFilter = (path, params = {}) => {
    const searchParams = new URLSearchParams(params).toString();
    navigate(`${path}${searchParams ? `?${searchParams}` : ''}`);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="dashboard-loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12 text-red-500" data-testid="dashboard-error">
        {error}
      </div>
    );
  }
  
  const kpis = dashboardData?.kpis || {};
  const maxProjectStage = Math.max(...Object.values(dashboardData?.projectStageDistribution || {}), 1);
  const maxLeadStage = Math.max(...Object.values(dashboardData?.leadStageDistribution || {}), 1);
  
  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Welcome Section */}
      <div>
        <h1 
          className="text-2xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Welcome back, {user?.name?.split(' ')[0] || 'User'}
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          {user?.role === 'Admin' && "Here's your organization overview."}
          {user?.role === 'Manager' && "Here's your team performance summary."}
          {user?.role === 'PreSales' && "Here's your lead activity for today."}
          {user?.role === 'Designer' && "Here's your project status overview."}
        </p>
      </div>
      
      {/* ============ ADMIN DASHBOARD ============ */}
      {user?.role === 'Admin' && (
        <>
          {/* KPI Cards - 4 columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard 
              title="Total Leads" 
              value={kpis.totalLeads || 0} 
              icon={Users} 
              color="blue"
              trend="+12%"
              trendUp={true}
              onClick={() => navigate('/presales')}
            />
            <KPICard 
              title="Qualified Leads" 
              value={kpis.qualifiedLeads || 0} 
              icon={UserCheck} 
              color="green"
              trend="+8%"
              trendUp={true}
              onClick={() => navigateWithFilter('/presales', { status: 'Qualified' })}
            />
            <KPICard 
              title="Total Projects" 
              value={kpis.totalProjects || 0} 
              icon={FolderKanban} 
              color="purple"
              onClick={() => navigate('/projects')}
            />
            <KPICard 
              title="Conversion Rate" 
              value={`${kpis.bookingConversionRate || 0}%`} 
              icon={TrendingUp} 
              color="orange"
              trend="+3%"
              trendUp={true}
            />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard 
              title="Active Designers" 
              value={kpis.activeDesigners || 0} 
              icon={Users} 
              color="slate"
            />
            <KPICard 
              title="Avg Cycle (Days)" 
              value={kpis.avgTurnaroundDays || 0} 
              icon={Clock} 
              color="blue"
              subtitle="Lead → Booking"
            />
            <KPICard 
              title="Delayed Milestones" 
              value={kpis.delayedMilestonesCount || 0} 
              icon={AlertTriangle} 
              color="red"
              onClick={() => navigate('/projects')}
            />
            <KPICard 
              title="On Track" 
              value={`${Math.max(0, (kpis.totalProjects || 0) - (dashboardData?.delayedMilestones?.length || 0))}`} 
              icon={CheckCircle2} 
              color="green"
            />
          </div>
          
          {/* Quick Filters */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                Quick Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500 mr-2 self-center">Leads:</span>
                <QuickFilterButton label="All New" onClick={() => navigateWithFilter('/presales', { status: 'New' })} />
                <QuickFilterButton label="Qualified" onClick={() => navigateWithFilter('/presales', { status: 'Qualified' })} />
                <QuickFilterButton label="Waiting" onClick={() => navigateWithFilter('/presales', { status: 'Waiting' })} />
                <QuickFilterButton label="Dropped" onClick={() => navigateWithFilter('/presales', { status: 'Dropped' })} />
                
                <span className="text-xs text-slate-500 ml-4 mr-2 self-center">Projects:</span>
                <QuickFilterButton label="Design" onClick={() => navigateWithFilter('/projects', { stage: 'Design Finalization' })} />
                <QuickFilterButton label="Production" onClick={() => navigateWithFilter('/projects', { stage: 'Production' })} />
                <QuickFilterButton label="Installation" onClick={() => navigateWithFilter('/projects', { stage: 'Installation' })} />
                <QuickFilterButton label="Handover" onClick={() => navigateWithFilter('/projects', { stage: 'Handover' })} />
              </div>
            </CardContent>
          </Card>
          
          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900">Project Stage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <StageBarChart data={dashboardData?.projectStageDistribution} maxValue={maxProjectStage} colorClass="bg-blue-500" />
              </CardContent>
            </Card>
            
            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900">Lead Stage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <StageBarChart data={dashboardData?.leadStageDistribution} maxValue={maxLeadStage} colorClass="bg-green-500" />
              </CardContent>
            </Card>
          </div>
          
          {/* Milestone Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MilestoneTable 
              milestones={dashboardData?.upcomingMilestones} 
              title="Upcoming Milestones (Next 7 Days)" 
            />
            <MilestoneTable 
              milestones={dashboardData?.delayedMilestones} 
              title="Delayed Milestones" 
              showDaysDelayed={true}
            />
          </div>
          
          {/* Performance Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DesignerPerformanceTable designers={dashboardData?.designerPerformance} />
            <PreSalesPerformanceTable presales={dashboardData?.presalesPerformance} />
          </div>
        </>
      )}
      
      {/* ============ MANAGER DASHBOARD ============ */}
      {user?.role === 'Manager' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard 
              title="Total Leads" 
              value={kpis.totalLeads || 0} 
              icon={Users} 
              color="blue"
              onClick={() => navigate('/presales')}
            />
            <KPICard 
              title="Total Projects" 
              value={kpis.totalProjects || 0} 
              icon={FolderKanban} 
              color="purple"
              onClick={() => navigate('/projects')}
            />
            <KPICard 
              title="Delayed Milestones" 
              value={kpis.delayedMilestonesCount || 0} 
              icon={AlertTriangle} 
              color="red"
            />
            <KPICard 
              title="On Track" 
              value={`${Math.max(0, (kpis.totalProjects || 0) - (dashboardData?.delayedMilestones?.length || 0))}`} 
              icon={CheckCircle2} 
              color="green"
            />
          </div>
          
          {/* Quick Filters */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                Quick Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500 mr-2 self-center">Leads:</span>
                <QuickFilterButton label="All Leads" onClick={() => navigate('/presales')} />
                <QuickFilterButton label="Qualified" onClick={() => navigateWithFilter('/presales', { status: 'Qualified' })} />
                <QuickFilterButton label="Waiting" onClick={() => navigateWithFilter('/presales', { status: 'Waiting' })} />
                
                <span className="text-xs text-slate-500 ml-4 mr-2 self-center">Projects:</span>
                <QuickFilterButton label="All Projects" onClick={() => navigate('/projects')} />
                <QuickFilterButton label="Design" onClick={() => navigateWithFilter('/projects', { stage: 'Design Finalization' })} />
                <QuickFilterButton label="Production" onClick={() => navigateWithFilter('/projects', { stage: 'Production' })} />
              </div>
            </CardContent>
          </Card>
          
          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900">Projects by Stage</CardTitle>
              </CardHeader>
              <CardContent>
                <StageBarChart data={dashboardData?.projectStageDistribution} maxValue={maxProjectStage} colorClass="bg-blue-500" />
              </CardContent>
            </Card>
            
            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900">Leads by Stage</CardTitle>
              </CardHeader>
              <CardContent>
                <StageBarChart data={dashboardData?.leadStageDistribution} maxValue={maxLeadStage} colorClass="bg-green-500" />
              </CardContent>
            </Card>
          </div>
          
          {/* Milestone Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MilestoneTable 
              milestones={dashboardData?.upcomingMilestones} 
              title="Upcoming Milestones (Next 7 Days)" 
            />
            <MilestoneTable 
              milestones={dashboardData?.delayedMilestones} 
              title="Delayed Milestones" 
              showDaysDelayed={true}
            />
          </div>
          
          {/* Designer Performance */}
          <DesignerPerformanceTable designers={dashboardData?.designerPerformance} />
        </>
      )}
      
      {/* ============ PRE-SALES DASHBOARD ============ */}
      {user?.role === 'PreSales' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KPICard 
              title="My Leads" 
              value={kpis.myLeads || 0} 
              icon={Users} 
              color="blue"
              onClick={() => navigate('/presales')}
            />
            <KPICard 
              title="BC Call Done" 
              value={kpis.bcCallDone || 0} 
              icon={Phone} 
              color="green"
            />
            <KPICard 
              title="BOQ Shared" 
              value={kpis.boqShared || 0} 
              icon={FileText} 
              color="purple"
            />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KPICard 
              title="Waiting for Booking" 
              value={kpis.waitingForBooking || 0} 
              icon={Clock} 
              color="orange"
            />
            <KPICard 
              title="Follow-ups Today" 
              value={kpis.followupsDueToday || 0} 
              icon={Calendar} 
              color="red"
              subtitle="Action needed"
            />
            <KPICard 
              title="Lost (7 Days)" 
              value={kpis.lostLeads7Days || 0} 
              icon={TrendingDown} 
              color="slate"
            />
          </div>
          
          {/* Quick Filters */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                Quick Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-2">
                <QuickFilterButton label="All My Leads" onClick={() => navigate('/presales')} />
                <QuickFilterButton label="New Leads" onClick={() => navigateWithFilter('/presales', { status: 'New' })} />
                <QuickFilterButton label="Contacted" onClick={() => navigateWithFilter('/presales', { status: 'Contacted' })} />
                <QuickFilterButton label="Waiting" onClick={() => navigateWithFilter('/presales', { status: 'Waiting' })} />
                <QuickFilterButton label="Qualified" onClick={() => navigateWithFilter('/presales', { status: 'Qualified' })} />
              </div>
            </CardContent>
          </Card>
          
          {/* Lead Stage Distribution */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900">My Leads by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <StageBarChart data={dashboardData?.leadStageDistribution} maxValue={maxLeadStage} colorClass="bg-green-500" />
            </CardContent>
          </Card>
        </>
      )}
      
      {/* ============ DESIGNER DASHBOARD ============ */}
      {user?.role === 'Designer' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard 
              title="My Projects" 
              value={kpis.myProjects || 0} 
              icon={FolderKanban} 
              color="blue"
              onClick={() => navigate('/projects')}
            />
            <KPICard 
              title="Projects Delayed" 
              value={kpis.projectsDelayed || 0} 
              icon={AlertTriangle} 
              color="red"
            />
            <KPICard 
              title="Milestones Today" 
              value={kpis.milestonesToday || 0} 
              icon={Calendar} 
              color="orange"
              subtitle="Action needed"
            />
            <KPICard 
              title="On Track" 
              value={Math.max(0, (kpis.myProjects || 0) - (kpis.projectsDelayed || 0))} 
              icon={CheckCircle2} 
              color="green"
            />
          </div>
          
          {/* Quick Filters */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                Quick Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-wrap gap-2">
                <QuickFilterButton label="All My Projects" onClick={() => navigate('/projects')} />
                <QuickFilterButton label="Design Phase" onClick={() => navigateWithFilter('/projects', { stage: 'Design Finalization' })} />
                <QuickFilterButton label="Production" onClick={() => navigateWithFilter('/projects', { stage: 'Production' })} />
                <QuickFilterButton label="Installation" onClick={() => navigateWithFilter('/projects', { stage: 'Installation' })} />
                <QuickFilterButton label="Handover" onClick={() => navigateWithFilter('/projects', { stage: 'Handover' })} />
              </div>
            </CardContent>
          </Card>
          
          {/* Project Stage Distribution */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900">My Projects by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <StageBarChart data={dashboardData?.projectStageDistribution} maxValue={maxProjectStage} colorClass="bg-blue-500" />
            </CardContent>
          </Card>
          
          {/* Milestone Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MilestoneTable 
              milestones={dashboardData?.upcomingMilestones} 
              title="My Upcoming Milestones" 
            />
            <MilestoneTable 
              milestones={dashboardData?.delayedMilestones} 
              title="My Delayed Milestones" 
              showDaysDelayed={true}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
