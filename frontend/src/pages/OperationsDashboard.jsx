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
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  ArrowRight,
  Wrench,
  ClipboardCheck,
  Home
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const OPERATIONS_STAGES = [
  { key: "Production", label: "Production", icon: Package, color: "blue" },
  { key: "Quality Check", label: "Quality Check", icon: ClipboardCheck, color: "purple" },
  { key: "Delivery", label: "Delivery", icon: Truck, color: "amber" },
  { key: "Installation", label: "Installation", icon: Wrench, color: "orange" },
  { key: "Handover", label: "Handover", icon: Home, color: "emerald" }
];

const OperationsDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role && !['Admin', 'Manager', 'OperationsLead'].includes(user.role)) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/operations/dashboard`, {
        withCredentials: true
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch operations dashboard:', err);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  const summary = data?.summary || {};
  const projectsByStage = data?.projects_by_stage || {};
  const delayedDeliveries = data?.delayed_deliveries || [];
  const upcomingDeliveries = data?.upcoming_deliveries || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-orange-600" />
            Operations Dashboard
          </h1>
          <p className="text-sm text-slate-500">Delivery & Installation tracking</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-slate-500 uppercase">In Production</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{summary.in_production || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-slate-500 uppercase">QC Pending</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">{summary.in_quality_check || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-slate-500 uppercase">In Delivery</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{summary.in_delivery || 0}</p>
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

        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-emerald-600 uppercase">This Month</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{summary.completed_this_month || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stage Pipeline */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Operations Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {OPERATIONS_STAGES.map((stage, index) => {
              const StageIcon = stage.icon;
              const count = projectsByStage[stage.key] || 0;
              const colorClasses = {
                blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
                purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
                amber: { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
                orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
                emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' }
              };
              const colors = colorClasses[stage.color];
              
              return (
                <React.Fragment key={stage.key}>
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center border-2",
                      colors.bg, colors.border
                    )}>
                      <StageIcon className={cn("w-6 h-6", colors.text)} />
                    </div>
                    <p className="text-xs font-medium text-slate-700 mt-2">{stage.label}</p>
                    <p className={cn("text-lg font-bold", colors.text)}>{count}</p>
                  </div>
                  {index < OPERATIONS_STAGES.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-slate-300" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delayed & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delayed Deliveries */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Delayed Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {delayedDeliveries.length > 0 ? (
              <div className="space-y-3">
                {delayedDeliveries.map((item, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => navigate(`/projects/${item.project_id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{item.project_name}</p>
                      <p className="text-xs text-slate-500">{item.client_name} • {item.milestone}</p>
                    </div>
                    <Badge variant="destructive" className="text-xs ml-2">
                      {item.days_delayed} days late
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-slate-400 ml-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-500">No delayed deliveries!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Deliveries */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Upcoming (Next 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingDeliveries.length > 0 ? (
              <div className="space-y-3">
                {upcomingDeliveries.map((item, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => navigate(`/projects/${item.project_id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{item.project_name}</p>
                      <p className="text-xs text-slate-500">{item.client_name} • {item.milestone}</p>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 text-xs ml-2">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDate(item.expected_date)}
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-slate-400 ml-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No upcoming deliveries</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OperationsDashboard;
