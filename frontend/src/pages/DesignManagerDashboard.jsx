import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import {
  Loader2,
  AlertTriangle,
  Clock,
  Users,
  FolderKanban,
  Calendar,
  FileText,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

const DesignManagerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role && !['Admin', 'Manager', 'DesignManager'].includes(user.role)) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/design-manager/dashboard`, {
        withCredentials: true
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name) => {
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500'];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const summary = data?.summary || {};
  const projectsByStage = data?.projects_by_stage || {};
  const bottlenecks = data?.bottlenecks || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-purple-600" />
            Design Manager Dashboard
          </h1>
          <p className="text-sm text-slate-500">Overview of all design projects</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FolderKanban className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-slate-500 uppercase">Active Projects</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{summary.total_active_projects || 0}</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-slate-200",
          summary.delayed_count > 0 && "border-red-200 bg-red-50"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-xs text-slate-500 uppercase">Delayed</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{summary.delayed_count || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-slate-500 uppercase">Meetings</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{summary.pending_meetings || 0}</p>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-slate-200",
          summary.missing_drawings > 0 && "border-amber-200 bg-amber-50"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-slate-500 uppercase">No Drawings</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{summary.missing_drawings || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-purple-600 uppercase">Referrals</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{summary.referral_projects || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects by Stage & Bottlenecks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects by Stage */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Projects by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DESIGN_STAGES.map((stage) => {
                const count = projectsByStage[stage] || 0;
                const maxCount = Math.max(...Object.values(projectsByStage), 1);
                return (
                  <div key={stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-600 truncate flex-1">{stage}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                    <Progress value={(count / maxCount) * 100} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Bottlenecks */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Bottleneck Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">Measurement Delays</p>
                    <p className="text-xs text-slate-500">Projects waiting for site measurement</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-amber-600">{bottlenecks.measurement || 0}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">Designer Delays</p>
                    <p className="text-xs text-slate-500">Tasks blocked by designers</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-blue-600">{bottlenecks.designer || 0}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">Validation Queue</p>
                    <p className="text-xs text-slate-500">Waiting for production validation</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-purple-600">{bottlenecks.validation || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Designer Workload & Delayed Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Designer Workload */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Designer Workload</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.designer_workload?.length > 0 ? (
              <div className="space-y-3">
                {data.designer_workload.map((designer) => (
                  <div 
                    key={designer.user_id} 
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      designer.is_behind ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium",
                      getAvatarColor(designer.name)
                    )}>
                      {designer.picture ? (
                        <img src={designer.picture} alt={designer.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        getInitials(designer.name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{designer.name}</p>
                      <p className="text-xs text-slate-500">
                        {designer.active_projects} active projects
                      </p>
                    </div>
                    {designer.is_behind ? (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {designer.overdue_tasks} overdue
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        On track
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">No designer data available</p>
            )}
          </CardContent>
        </Card>

        {/* Delayed Projects */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Delayed Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.delayed_projects?.length > 0 ? (
              <div className="space-y-3">
                {data.delayed_projects.map((project) => (
                  <div 
                    key={project.design_project_id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => navigate(`/design-board`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{project.project_name}</p>
                      <p className="text-xs text-slate-500">
                        {project.designer_name} • {project.stage}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive" className="text-xs">
                        {project.overdue_tasks} overdue
                      </Badge>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 ml-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-500">No delayed projects!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DesignManagerDashboard;
