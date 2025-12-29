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
  Clock,
  AlertCircle,
  Loader2,
  AlertTriangle,
  TrendingDown,
  Calendar,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STAGE_COLORS = {
  'Design Finalization': 'bg-slate-500',
  'Production Preparation': 'bg-amber-500',
  'Production': 'bg-blue-500',
  'Delivery': 'bg-cyan-500',
  'Installation': 'bg-purple-500',
  'Handover': 'bg-emerald-500'
};

const DelayReport = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.role && !['Admin', 'Manager'].includes(user.role)) {
      navigate('/reports');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/reports/delays`, {
        withCredentials: true
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch delay report:', err);
      setError(err.response?.data?.detail || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-red-600" />
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
  const maxDelayCount = Math.max(...(data?.stage_analysis?.map(s => s.delay_count) || [1]));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-red-600" />
            Delay Analytics
          </h1>
          <p className="text-sm text-slate-500">Delay patterns, stage analysis, and trends</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Total Delays</p>
            <p className="text-2xl font-bold text-red-600">{data?.total_delays || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Projects Affected</p>
            <p className="text-2xl font-bold text-amber-600">{data?.projects_with_delays || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Most Common Stage</p>
            <p className="text-lg font-bold text-slate-900 truncate">
              {data?.stage_analysis?.[0]?.stage || '-'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Avg Stage Delay</p>
            <p className="text-2xl font-bold text-blue-600">
              {data?.stage_analysis?.[0]?.avg_delay_days || 0} days
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Top Delayed Projects</p>
            <p className="text-2xl font-bold text-purple-600">
              {data?.top_delayed_projects?.length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stage Analysis & Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Analysis */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Delays by Stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.stage_analysis?.length > 0 ? (
              <div className="space-y-4">
                {data.stage_analysis.map((stage) => (
                  <div key={stage.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-3 h-3 rounded-full', STAGE_COLORS[stage.stage] || 'bg-slate-400')} />
                        <span className="text-sm text-slate-700">{stage.stage}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{stage.delay_count} delays</Badge>
                        <span className="text-xs text-slate-500">
                          avg {stage.avg_delay_days} days
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={(stage.delay_count / maxDelayCount) * 100} 
                      className="h-2" 
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No delay data by stage</p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Monthly Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.monthly_trend?.length > 0 ? (
              <div className="space-y-3">
                {data.monthly_trend.map((month) => (
                  <div key={month.month} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-700">{month.month}</span>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">{month.delay_count}</p>
                        <p className="text-xs text-slate-500">delays</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-700">{month.avg_delay_days}</p>
                        <p className="text-xs text-slate-500">avg days</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No monthly data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Designer Analysis & Delay Reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Designer Analysis */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Delays by Designer</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.designer_analysis?.length > 0 ? (
              <div className="space-y-3">
                {data.designer_analysis.map((designer) => (
                  <div key={designer.designer_id || designer.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{designer.name}</p>
                      <p className="text-xs text-slate-500">{designer.delay_percentage}% of all delays</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={cn(
                        'text-xs',
                        designer.delay_count > 5 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {designer.delay_count} delays
                      </Badge>
                      <span className="text-sm text-slate-600">
                        {designer.total_delay_days} days total
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No designer delay data</p>
            )}
          </CardContent>
        </Card>

        {/* Delay Reasons */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Common Delay Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.delay_reasons && Object.keys(data.delay_reasons).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(data.delay_reasons)
                  .sort(([,a], [,b]) => b - a)
                  .map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-700">{reason}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))
                }
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No delay reasons recorded</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projects with Delays Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Projects with Delays</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.top_delayed_projects?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Project</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Designer</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Delay Count</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Total Days</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Avg Delay</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_delayed_projects.map((project) => (
                    <tr 
                      key={project.project_id} 
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/projects/${project.project_id}`)}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{project.project_name}</span>
                          <ArrowUpRight className="w-3 h-3 text-slate-400" />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{project.designer || '-'}</td>
                      <td className="py-3 px-3 text-right">
                        <Badge className={cn(
                          'text-xs',
                          project.delay_count > 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        )}>
                          {project.delay_count}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-900">
                        {project.total_delay_days}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {project.avg_delay} days
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <TrendingDown className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
              <p>No project delays recorded!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DelayReport;
