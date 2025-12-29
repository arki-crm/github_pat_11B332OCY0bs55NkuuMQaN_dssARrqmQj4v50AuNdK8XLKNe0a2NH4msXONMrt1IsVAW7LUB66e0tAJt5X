import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import {
  ArrowLeft,
  UserCircle,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  FolderKanban,
  IndianRupee,
  CalendarCheck,
  ListTodo
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DesignerReport = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.role && !['Admin', 'Manager', 'Designer'].includes(user.role)) {
      navigate('/reports');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/reports/designers`, {
        withCredentials: true
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch designer report:', err);
      setError(err.response?.data?.detail || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '₹0';
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name) => {
    const colors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500',
      'bg-amber-500', 'bg-cyan-500', 'bg-red-500', 'bg-indigo-500'
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/reports')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Reports
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

  const summary = data?.summary || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCircle className="h-6 w-6 text-amber-600" />
            Designer Performance
          </h1>
          <p className="text-sm text-slate-500">Individual performance metrics and revenue contribution</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Designers</p>
            <p className="text-2xl font-bold text-slate-900">{summary.total_designers || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Total Projects</p>
            <p className="text-2xl font-bold text-blue-600">{summary.total_projects || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(summary.total_revenue)}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">On-Time %</p>
            <p className="text-2xl font-bold text-purple-600">{summary.on_time_percentage || 0}%</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Delayed Milestones</p>
            <p className="text-2xl font-bold text-red-600">{summary.total_delayed_milestones || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Designer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.designers?.map((designer) => (
          <Card key={designer.user_id} className="border-slate-200 hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              {/* Designer Header */}
              <div className="flex items-center gap-3 mb-4">
                {designer.picture ? (
                  <img 
                    src={designer.picture} 
                    alt={designer.name} 
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-white font-medium',
                    getAvatarColor(designer.name)
                  )}>
                    {getInitials(designer.name)}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-slate-900">{designer.name}</h3>
                  <p className="text-xs text-slate-500">{designer.project_count} projects</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-1 mb-1">
                    <IndianRupee className="w-3 h-3 text-emerald-600" />
                    <span className="text-xs text-slate-500">Revenue</span>
                  </div>
                  <p className="font-semibold text-emerald-600 text-sm">
                    {formatCurrency(designer.revenue_contribution)}
                  </p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-1 mb-1">
                    <FolderKanban className="w-3 h-3 text-blue-600" />
                    <span className="text-xs text-slate-500">Project Value</span>
                  </div>
                  <p className="font-semibold text-blue-600 text-sm">
                    {formatCurrency(designer.total_value)}
                  </p>
                </div>
              </div>

              {/* Milestone Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">Milestones On-Time</span>
                  <span className="text-xs font-medium">
                    {designer.on_time_milestones + designer.delayed_milestones > 0 
                      ? Math.round((designer.on_time_milestones / (designer.on_time_milestones + designer.delayed_milestones)) * 100)
                      : 100}%
                  </span>
                </div>
                <Progress 
                  value={
                    designer.on_time_milestones + designer.delayed_milestones > 0 
                      ? (designer.on_time_milestones / (designer.on_time_milestones + designer.delayed_milestones)) * 100
                      : 100
                  } 
                  className="h-2" 
                />
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-emerald-600">
                    <CheckCircle2 className="w-3 h-3 inline mr-1" />
                    {designer.on_time_milestones} on-time
                  </span>
                  <span className="text-red-600">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {designer.delayed_milestones} delayed
                  </span>
                </div>
              </div>

              {/* Tasks & Meetings */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="text-xs text-slate-500">Tasks</p>
                    <p className="text-sm font-medium">
                      {designer.tasks_completed}/{designer.tasks_total}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-cyan-600" />
                  <div>
                    <p className="text-xs text-slate-500">Meetings</p>
                    <p className="text-sm font-medium">
                      {designer.meetings_completed}/{designer.meetings_total}
                    </p>
                  </div>
                </div>
              </div>

              {/* Avg Delay */}
              {designer.avg_delay_days > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <Badge variant="outline" className="text-red-600 border-red-200">
                    <Clock className="w-3 h-3 mr-1" />
                    Avg delay: {designer.avg_delay_days} days
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {(!data?.designers || data.designers.length === 0) && (
        <Card className="border-slate-200">
          <CardContent className="text-center py-12">
            <UserCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No designer data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DesignerReport;
