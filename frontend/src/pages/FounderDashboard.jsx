import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Loader2, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Wallet,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ArrowRight,
  RefreshCw,
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Target,
  DollarSign,
  BarChart3,
  TrendingUp as TrendUp,
  Ban,
  PiggyBank
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const FounderDashboard = () => {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [safeSpend, setSafeSpend] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [expenseStats, setExpenseStats] = useState(null);
  const [revenueReality, setRevenueReality] = useState(null);
  const [safeUseSummary, setSafeUseSummary] = useState(null);
  const [liabilitiesSummary, setLiabilitiesSummary] = useState(null);
  const [revenuePeriod, setRevenuePeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashRes, safeSpendRes, alertsRes, expenseStatsRes, safeUseRes, liabilitiesRes] = await Promise.all([
        axios.get(`${API}/finance/founder-dashboard`, { withCredentials: true }),
        axios.get(`${API}/finance/safe-spend`, { withCredentials: true }),
        axios.get(`${API}/finance/alerts`, { withCredentials: true }),
        axios.get(`${API}/finance/expense-requests/stats/summary`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/finance/safe-use-summary`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/finance/liabilities/summary`, { withCredentials: true }).catch(() => ({ data: null }))
      ]);
      setData(dashRes.data);
      setSafeSpend(safeSpendRes.data);
      setAlerts(alertsRes.data);
      setExpenseStats(expenseStatsRes.data);
      setSafeUseSummary(safeUseRes.data);
      setLastUpdated(new Date());
      
      // Fetch revenue reality check
      fetchRevenueReality();
    } catch (error) {
      console.error('Failed to fetch founder dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenueReality = async () => {
    try {
      const res = await axios.get(`${API}/finance/revenue-reality-check?period=${revenuePeriod}`, { withCredentials: true });
      setRevenueReality(res.data);
    } catch (error) {
      console.error('Failed to fetch revenue reality:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (data) {
      fetchRevenueReality();
    }
  }, [revenuePeriod]);

  if (!hasPermission('finance.founder_dashboard') && user?.role !== 'Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <ShieldX className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">This dashboard is restricted to Founders and Admins.</p>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-slate-400">Failed to load dashboard</p>
      </div>
    );
  }

  const healthColors = {
    healthy: { bg: 'bg-green-500', text: 'text-green-400', icon: ShieldCheck },
    warning: { bg: 'bg-amber-500', text: 'text-amber-400', icon: ShieldAlert },
    critical: { bg: 'bg-red-500', text: 'text-red-400', icon: ShieldX }
  };

  const HealthIcon = healthColors[data.health]?.icon || ShieldCheck;

  const alertIcons = {
    critical: XCircle,
    high: AlertTriangle,
    medium: AlertCircle,
    low: Bell
  };

  const alertColors = {
    critical: 'text-red-400 bg-red-500/20',
    high: 'text-amber-400 bg-amber-500/20',
    medium: 'text-blue-400 bg-blue-500/20',
    low: 'text-slate-400 bg-slate-500/20'
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6" data-testid="founder-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Financial Overview
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Can I safely spend money today?
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts && alerts.summary && (alerts.summary.critical > 0 || alerts.summary.high > 0) && (
        <div className="mb-6 bg-red-900/30 border border-red-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-300 font-medium">
              {alerts.summary.critical + alerts.summary.high} urgent alerts require attention
            </span>
          </div>
        </div>
      )}

      {/* Health Status + Safe Spend Answer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Health Status */}
        <Card className={cn(
          "border-0",
          data.health === 'healthy' && "bg-gradient-to-r from-green-900/50 to-green-800/30",
          data.health === 'warning' && "bg-gradient-to-r from-amber-900/50 to-amber-800/30",
          data.health === 'critical' && "bg-gradient-to-r from-red-900/50 to-red-800/30"
        )}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center",
              healthColors[data.health]?.bg
            )}>
              <HealthIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className={cn("text-2xl font-bold capitalize", healthColors[data.health]?.text)}>
                {data.health}
              </h2>
              <p className="text-slate-300">{data.health_message}</p>
            </div>
          </CardContent>
        </Card>

        {/* THE ANSWER - Can I Spend? */}
        <Card className={cn(
          "border-2",
          safeSpend?.can_spend_safely 
            ? "bg-green-900/30 border-green-600" 
            : "bg-red-900/30 border-red-600"
        )}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Can you spend safely today?</p>
                <p className={cn(
                  "text-3xl font-bold",
                  safeSpend?.can_spend_safely ? "text-green-400" : "text-red-400"
                )}>
                  {safeSpend?.can_spend_safely ? "YES" : "NO"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-xs">Daily Safe Limit</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(safeSpend?.daily_safe_spend)}
                </p>
              </div>
            </div>
            {safeSpend?.warnings?.length > 0 && (
              <div className="mt-4 space-y-1">
                {safeSpend.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-400">⚠️ {w}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Numbers */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-blue-400" />
              <span className="text-slate-400 text-xs">Total Cash</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(data.total_cash_available)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400 text-xs">Commitments</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">
              {formatCurrency(safeSpend?.remaining_commitments)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-slate-400 text-xs">Safe Surplus</span>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              data.safe_surplus >= 0 ? "text-green-400" : "text-red-400"
            )}>
              {formatCurrency(data.safe_surplus)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400 text-xs">Monthly Budget Left</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(safeSpend?.remaining_monthly_budget)}
            </p>
            <p className="text-xs text-slate-500">{safeSpend?.days_remaining} days left</p>
          </CardContent>
        </Card>
      </div>

      {/* Month to Date + Recommended Limits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="border-b border-slate-700 pb-3">
            <CardTitle className="text-lg text-white">
              Month to Date — {data.month_to_date?.month}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-green-400 mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Received
                </p>
                <p className="text-xl font-bold text-green-400">
                  {formatCurrency(data.month_to_date?.received)}
                </p>
              </div>
              <div>
                <p className="text-xs text-red-400 mb-1 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Spent
                </p>
                <p className="text-xl font-bold text-red-400">
                  {formatCurrency(data.month_to_date?.spent)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Net</p>
                <p className={cn(
                  "text-xl font-bold",
                  data.month_to_date?.net >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  {data.month_to_date?.net >= 0 ? '+' : ''}{formatCurrency(data.month_to_date?.net)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="border-b border-slate-700 pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Target className="w-5 h-5" />
              Spending Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Monthly Average</span>
              <span className="text-white font-medium">{formatCurrency(safeSpend?.monthly_average_spend)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Recommended Limit</span>
              <span className="text-blue-400 font-medium">{formatCurrency(safeSpend?.recommended_monthly_limit)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Spent This Month</span>
              <span className={cn(
                "font-medium",
                safeSpend?.month_to_date_spent > safeSpend?.recommended_monthly_limit ? "text-red-400" : "text-white"
              )}>
                {formatCurrency(safeSpend?.month_to_date_spent)}
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all",
                  safeSpend?.month_to_date_spent > safeSpend?.recommended_monthly_limit 
                    ? "bg-red-500" 
                    : "bg-green-500"
                )}
                style={{ 
                  width: `${Math.min(100, (safeSpend?.month_to_date_spent / safeSpend?.recommended_monthly_limit) * 100)}%` 
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Signals */}
      {alerts && alerts.alerts?.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader className="border-b border-slate-700 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Alerts & Signals
              </CardTitle>
              <div className="flex gap-2">
                {alerts.summary?.critical > 0 && (
                  <Badge className="bg-red-500/20 text-red-400">{alerts.summary.critical} Critical</Badge>
                )}
                {alerts.summary?.high > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-400">{alerts.summary.high} High</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-700 max-h-64 overflow-y-auto">
              {alerts.alerts.slice(0, 10).map((alert, idx) => {
                const AlertIcon = alertIcons[alert.severity] || Bell;
                return (
                  <div key={idx} className="p-4 hover:bg-slate-800/50">
                    <div className="flex items-start gap-3">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", alertColors[alert.severity])}>
                        <AlertIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{alert.title}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{alert.message}</p>
                      </div>
                      {alert.project_id && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/finance/project-finance/${alert.project_id}`)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expense Control Panel */}
      {expenseStats && (
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader className="border-b border-slate-700 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Expense Control
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/finance/expense-requests')}
                className="text-blue-400 hover:text-blue-300"
              >
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-amber-900/30 rounded-lg p-3">
                <p className="text-amber-400 text-xs mb-1">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-300">{expenseStats.total_pending_approval || 0}</p>
              </div>
              <div className="bg-green-900/30 rounded-lg p-3">
                <p className="text-green-400 text-xs mb-1">Approved (Unrecorded)</p>
                <p className="text-2xl font-bold text-green-300">{expenseStats.total_approved_unrecorded || 0}</p>
              </div>
              <div className="bg-purple-900/30 rounded-lg p-3">
                <p className="text-purple-400 text-xs mb-1">Pending Refunds</p>
                <p className="text-2xl font-bold text-purple-300">{expenseStats.pending_refunds_count || 0}</p>
              </div>
              <div className="bg-red-900/30 rounded-lg p-3">
                <p className="text-red-400 text-xs mb-1">Money at Risk</p>
                <p className="text-2xl font-bold text-red-300">{formatCurrency(expenseStats.money_at_risk || 0)}</p>
              </div>
            </div>
            {expenseStats.over_budget_count > 0 && (
              <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {expenseStats.over_budget_count} over-budget expense requests pending
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Advance Cash Lock & Safe Use Summary */}
      {safeUseSummary && (
        <Card className="bg-slate-800/50 border-slate-700" data-testid="safe-use-summary">
          <CardHeader className="border-b border-slate-700 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-emerald-400" />
                Advance Cash Lock
              </CardTitle>
              <Badge 
                className={cn(
                  "text-xs",
                  safeUseSummary.safe_use_warning 
                    ? "bg-red-900/50 text-red-300 border-red-700" 
                    : "bg-emerald-900/50 text-emerald-300 border-emerald-700"
                )}
              >
                {safeUseSummary.safe_use_months} months runway
              </Badge>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {safeUseSummary.default_lock_percentage}% locked by default • Operating baseline: {formatCurrency(safeUseSummary.monthly_operating_expense)}/month
            </p>
          </CardHeader>
          <CardContent className="p-4">
            {/* Warning Banner */}
            {safeUseSummary.safe_use_warning && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <div>
                    <p className="text-red-300 font-medium">Low Safe Cash Warning</p>
                    <p className="text-red-400 text-sm">
                      Safe to use ({formatCurrency(safeUseSummary.project_safe_to_use)}) is below monthly operating expense
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Main Metrics - 4 Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Total Received */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <p className="text-slate-400 text-xs">Total Received</p>
                </div>
                <p className="text-2xl font-bold text-white">{formatCurrency(safeUseSummary.total_project_received)}</p>
                <p className="text-xs text-slate-500 mt-1">From all projects</p>
              </div>
              
              {/* Locked Amount */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <p className="text-slate-400 text-xs">Locked</p>
                </div>
                <p className="text-2xl font-bold text-amber-400">{formatCurrency(safeUseSummary.total_locked)}</p>
                <p className="text-xs text-slate-500 mt-1">Reserved for execution</p>
              </div>
              
              {/* Commitments Made */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-orange-400" />
                  <p className="text-slate-400 text-xs">Commitments</p>
                </div>
                <p className="text-2xl font-bold text-orange-400">{formatCurrency(safeUseSummary.total_commitments)}</p>
                <p className="text-xs text-slate-500 mt-1">Spent + approved requests</p>
              </div>
              
              {/* Safe to Use */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-emerald-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <Unlock className="w-4 h-4 text-emerald-400" />
                  <p className="text-slate-400 text-xs">Safe to Use</p>
                </div>
                <p className={cn(
                  "text-2xl font-bold",
                  safeUseSummary.safe_use_warning ? "text-red-400" : "text-emerald-400"
                )}>
                  {formatCurrency(safeUseSummary.project_safe_to_use)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Available for operations</p>
              </div>
            </div>

            {/* Top Projects by Lock */}
            {safeUseSummary.top_projects_by_lock?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400 mb-3">Top Projects by Locked Amount</p>
                <div className="space-y-2">
                  {safeUseSummary.top_projects_by_lock.slice(0, 3).map((project) => (
                    <div 
                      key={project.project_id}
                      className="flex items-center justify-between bg-slate-700/30 rounded-lg p-3"
                    >
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium truncate">{project.project_name}</p>
                        <p className="text-slate-500 text-xs">
                          {project.is_overridden ? `${project.effective_lock_pct}% (custom)` : `${project.effective_lock_pct}%`}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span className="text-amber-400 font-medium">{formatCurrency(project.net_locked)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Unlock className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 text-sm">{formatCurrency(project.safe_to_use)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Revenue Reality Check */}
      {revenueReality && (
        <Card className="bg-slate-800/50 border-slate-700" data-testid="revenue-reality-check">
          <CardHeader className="border-b border-slate-700 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Revenue Reality Check
              </CardTitle>
              <Select value={revenuePeriod} onValueChange={setRevenuePeriod}>
                <SelectTrigger className="w-32 h-8 bg-slate-700 border-slate-600 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="month" className="text-white hover:bg-slate-700">Month</SelectItem>
                  <SelectItem value="quarter" className="text-white hover:bg-slate-700">Quarter</SelectItem>
                  <SelectItem value="year" className="text-white hover:bg-slate-700">Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-slate-400 text-sm mt-1">{revenueReality.period_label}</p>
          </CardHeader>
          <CardContent className="p-4">
            {/* Main Metrics - 4 Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Booked Value */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <p className="text-slate-400 text-xs">Total Booked</p>
                </div>
                <p className="text-2xl font-bold text-white">{formatCurrency(revenueReality.total_booked_value)}</p>
                <p className="text-xs text-slate-500 mt-1">{revenueReality.booked_count} projects</p>
              </div>
              
              {/* Active Project Value */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendUp className="w-4 h-4 text-emerald-400" />
                  <p className="text-slate-400 text-xs">Active Value</p>
                </div>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(revenueReality.active_project_value)}</p>
                <p className="text-xs text-slate-500 mt-1">{revenueReality.active_count} projects</p>
              </div>
              
              {/* Revenue Realised */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-green-400" />
                  <p className="text-slate-400 text-xs">Cash Received</p>
                </div>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(revenueReality.revenue_realised)}</p>
                <p className="text-xs text-slate-500 mt-1">{revenueReality.realisation_rate}% realised</p>
              </div>
              
              {/* Lost Value */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Ban className="w-4 h-4 text-red-400" />
                  <p className="text-slate-400 text-xs">Lost Value</p>
                </div>
                <p className="text-2xl font-bold text-red-400">{formatCurrency(revenueReality.lost_value)}</p>
                <p className="text-xs text-slate-500 mt-1">{revenueReality.lost_count} cancelled</p>
              </div>
            </div>
            
            {/* Gap Insight */}
            {revenueReality.booking_to_realised_gap > 0 && (
              <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <p className="text-sm text-amber-300">
                    <span className="font-semibold">{formatCurrency(revenueReality.booking_to_realised_gap)}</span> gap between booked and realised revenue
                  </p>
                </div>
              </div>
            )}
            
            {/* Top Cancellation Reasons */}
            {revenueReality.top_cancellation_reasons?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400 mb-3">Top Cancellation Reasons</p>
                <div className="flex flex-wrap gap-2">
                  {revenueReality.top_cancellation_reasons.map((reason, idx) => (
                    <div 
                      key={reason.reason}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs flex items-center gap-2",
                        idx === 0 ? "bg-red-900/40 text-red-300" : "bg-slate-700 text-slate-300"
                      )}
                    >
                      <span className="capitalize">{reason.reason.replace(/_/g, ' ')}</span>
                      <Badge variant="secondary" className="text-xs bg-slate-600 text-slate-200">
                        {reason.count}
                      </Badge>
                    </div>
                  ))}
                </div>
                {revenueReality.loss_rate > 10 && (
                  <p className="text-xs text-red-400 mt-3">
                    ⚠️ Loss rate at {revenueReality.loss_rate}% - consider reviewing sales qualification process
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Risky Projects */}
      {data.risky_projects?.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="border-b border-slate-700 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Projects Requiring Attention ({data.risky_project_count})
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/finance/project-finance')}
                className="text-blue-400 hover:text-blue-300"
              >
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-700">
              {data.risky_projects.map((project) => (
                <div 
                  key={project.project_id}
                  className="p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/finance/project-finance/${project.project_id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                          {project.pid}
                        </span>
                        <Badge 
                          variant={project.risk_level === 'red' ? 'destructive' : 'outline'}
                          className={cn(
                            "text-xs",
                            project.risk_level === 'amber' && "border-amber-500 text-amber-400"
                          )}
                        >
                          {project.risk_level === 'red' ? 'At Risk' : 'Tight'}
                        </Badge>
                        {project.is_over_budget && (
                          <Badge variant="destructive" className="text-xs">Over Budget</Badge>
                        )}
                      </div>
                      <p className="font-medium text-white">{project.project_name}</p>
                      <p className="text-sm text-slate-400">{project.client_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Surplus</p>
                      <p className={cn(
                        "text-lg font-bold",
                        project.surplus >= 0 ? "text-slate-300" : "text-red-400"
                      )}>
                        {formatCurrency(project.surplus)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Issues */}
      {(!data.risky_projects || data.risky_projects.length === 0) && (!alerts || alerts.alerts?.length === 0) && (
        <Card className="bg-green-900/20 border-green-800">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <p className="text-green-400 font-medium">All systems healthy. No alerts.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FounderDashboard;
