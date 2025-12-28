import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft,
  TrendingUp,
  Wallet,
  Calendar,
  IndianRupee,
  Loader2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RevenueReport = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'Admin' && user?.role !== 'Manager') {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/reports/revenue`, {
        withCredentials: true
      });
      setData(response.data);
    } catch (error) {
      console.error('Error fetching revenue report:', error);
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)} Cr`;
    } else if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)} L`;
    }
    return `₹${value?.toLocaleString('en-IN') || '0'}`;
  };

  const getStatusColor = (color) => {
    switch (color) {
      case 'red': return 'bg-red-100 text-red-700 border-red-200';
      case 'orange': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'green': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusLabel = (color) => {
    switch (color) {
      case 'red': return 'Overdue';
      case 'orange': return 'Due Soon';
      case 'green': return 'Completed';
      default: return 'Upcoming';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">Failed to load report data</p>
        <Button onClick={fetchData} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-600" />
            Revenue Forecast Report
          </h1>
          <p className="text-slate-500 text-sm">
            Revenue projections and collection analysis
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-slate-200 bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Forecast</p>
                <p className="text-xl font-bold text-emerald-700">
                  {formatCurrency(data.total_forecast)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Expected This Month</p>
                <p className="text-xl font-bold text-blue-700">
                  {formatCurrency(data.expected_this_month)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Wallet className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Pending</p>
                <p className="text-xl font-bold text-amber-700">
                  {formatCurrency(data.total_pending)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <IndianRupee className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Active Projects</p>
                <p className="text-xl font-bold text-slate-700">
                  {data.projects_count}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage-wise Revenue Projection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Stage-wise Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(data.stage_wise_revenue || {}).map(([stage, info]) => {
                const maxValue = Math.max(...Object.values(data.stage_wise_revenue).map(s => s.weighted));
                const percentage = maxValue > 0 ? (info.weighted / maxValue) * 100 : 0;
                
                return (
                  <div key={stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{stage}</span>
                      <span className="text-sm text-slate-500">{info.count} projects</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-emerald-600 w-24 text-right">
                        {formatCurrency(info.weighted)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Milestone Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(data.milestone_projection || {}).map(([milestone, amount]) => {
                const maxAmount = Math.max(...Object.values(data.milestone_projection));
                const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                const colors = {
                  'Design Booking': 'from-blue-500 to-blue-400',
                  'Production Start': 'from-purple-500 to-purple-400',
                  'Before Installation': 'from-amber-500 to-amber-400'
                };
                
                return (
                  <div key={milestone}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{milestone}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full bg-gradient-to-r rounded-full transition-all duration-500", colors[milestone] || 'from-slate-500 to-slate-400')}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-700 w-24 text-right">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Collections Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-600" />
            Pending Collections
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.pending_collections?.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No pending collections</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 text-slate-500 font-medium">Project</th>
                    <th className="text-right py-3 px-3 text-slate-500 font-medium">Value</th>
                    <th className="text-right py-3 px-3 text-slate-500 font-medium">Collected</th>
                    <th className="text-right py-3 px-3 text-slate-500 font-medium">Pending</th>
                    <th className="text-left py-3 px-3 text-slate-500 font-medium">Next Stage</th>
                    <th className="text-left py-3 px-3 text-slate-500 font-medium">Expected</th>
                    <th className="text-center py-3 px-3 text-slate-500 font-medium">Status</th>
                    <th className="text-center py-3 px-3 text-slate-500 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pending_collections?.map((item) => (
                    <tr key={item.project_id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-3">
                        <p className="font-medium text-slate-900">{item.project_name}</p>
                        <p className="text-xs text-slate-500">{item.client_name}</p>
                      </td>
                      <td className="py-3 px-3 text-right font-medium">
                        {formatCurrency(item.project_value)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-600">
                        {formatCurrency(item.collected)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-amber-600">
                        {formatCurrency(item.pending)}
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        {item.next_stage || '-'}
                        {item.next_amount > 0 && (
                          <span className="text-xs text-slate-500 block">
                            {formatCurrency(item.next_amount)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {item.expected_date ? new Date(item.expected_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short'
                        }) : '-'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge className={cn("text-xs", getStatusColor(item.status_color))}>
                          {getStatusLabel(item.status_color)}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/projects/${item.project_id}`)}
                          className="h-7 text-xs"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenueReport;
