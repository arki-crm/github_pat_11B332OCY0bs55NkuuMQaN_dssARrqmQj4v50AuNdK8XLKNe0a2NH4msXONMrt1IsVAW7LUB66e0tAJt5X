import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { 
  Loader2, 
  Plus,
  Calendar,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit2,
  Lock,
  Unlock,
  BarChart3,
  PiggyBank
} from 'lucide-react';
import { toast } from 'sonner';
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

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_COLORS = {
  green: { bg: 'bg-green-100', text: 'text-green-700', progress: 'bg-green-500', label: 'On Track' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', progress: 'bg-amber-500', label: 'Warning' },
  red: { bg: 'bg-red-100', text: 'text-red-700', progress: 'bg-red-500', label: 'Over Budget' }
};

const BUDGET_STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700', icon: Edit2 },
  active: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-blue-100 text-blue-700', icon: Lock }
};

const Budgets = () => {
  const { hasPermission, user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [currentBudget, setCurrentBudget] = useState(null);
  const [budgetCategories, setBudgetCategories] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Create form state
  const [newBudget, setNewBudget] = useState({
    period_type: 'monthly',
    period_start: '',
    period_end: '',
    name: '',
    notes: '',
    allocations: []
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [budgetsRes, currentRes, categoriesRes, alertsRes] = await Promise.all([
        axios.get(`${API}/finance/budgets`, { withCredentials: true }),
        axios.get(`${API}/finance/budgets/current`, { withCredentials: true }),
        axios.get(`${API}/finance/budget-categories`, { withCredentials: true }),
        axios.get(`${API}/finance/budget-alerts`, { withCredentials: true })
      ]);
      
      setBudgets(budgetsRes.data);
      setCurrentBudget(currentRes.data.budget ? currentRes.data : null);
      setBudgetCategories(categoriesRes.data);
      setAlerts(alertsRes.data.alerts || []);
      
      // Initialize allocations for create form
      if (categoriesRes.data.length > 0 && newBudget.allocations.length === 0) {
        setNewBudget(prev => ({
          ...prev,
          allocations: categoriesRes.data.map(c => ({
            category_key: c.key,
            planned_amount: 0,
            notes: ''
          }))
        }));
      }
    } catch (error) {
      console.error('Failed to fetch budget data:', error);
      toast.error('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateBudget = async () => {
    if (!newBudget.period_start || !newBudget.period_end) {
      toast.error('Please select budget period dates');
      return;
    }
    
    const allocationsWithValues = newBudget.allocations.filter(a => a.planned_amount > 0);
    if (allocationsWithValues.length === 0) {
      toast.error('Please set at least one category budget');
      return;
    }
    
    try {
      setSubmitting(true);
      await axios.post(`${API}/finance/budgets`, {
        ...newBudget,
        allocations: allocationsWithValues
      }, { withCredentials: true });
      
      toast.success('Budget created successfully');
      setIsCreateDialogOpen(false);
      setNewBudget({
        period_type: 'monthly',
        period_start: '',
        period_end: '',
        name: '',
        notes: '',
        allocations: budgetCategories.map(c => ({ category_key: c.key, planned_amount: 0, notes: '' }))
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create budget');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateBudget = async (budgetId) => {
    try {
      await axios.post(`${API}/finance/budgets/${budgetId}/activate`, {}, { withCredentials: true });
      toast.success('Budget activated');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to activate budget');
    }
  };

  const handleCloseBudget = async (budgetId) => {
    if (!confirm('Are you sure you want to close this budget? This action cannot be undone.')) return;
    
    try {
      await axios.post(`${API}/finance/budgets/${budgetId}/close`, {}, { withCredentials: true });
      toast.success('Budget closed');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to close budget');
    }
  };

  const handleAllocationChange = (categoryKey, value) => {
    setNewBudget(prev => ({
      ...prev,
      allocations: prev.allocations.map(a => 
        a.category_key === categoryKey ? { ...a, planned_amount: parseFloat(value) || 0 } : a
      )
    }));
  };

  const getTotalPlanned = () => {
    return newBudget.allocations.reduce((sum, a) => sum + (a.planned_amount || 0), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="budgets-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Budget Management</h1>
          <p className="text-slate-500 text-sm mt-1">Plan, track, and control your monthly spending</p>
        </div>
        {hasPermission('finance.budget.create') && (
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="create-budget-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Budget
          </Button>
        )}
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <div 
              key={idx}
              className={cn(
                "flex items-center gap-3 p-4 rounded-lg border",
                alert.type === 'critical' ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
              )}
            >
              <AlertTriangle className={cn("w-5 h-5", alert.type === 'critical' ? "text-red-600" : "text-amber-600")} />
              <div className="flex-1">
                <p className={cn("font-medium", alert.type === 'critical' ? "text-red-800" : "text-amber-800")}>
                  {alert.category_name}: {alert.message}
                </p>
                <p className="text-sm text-slate-600">
                  Planned: {formatCurrency(alert.planned)} | Spent: {formatCurrency(alert.spent)}
                  {alert.over_by && ` | Over by: ${formatCurrency(alert.over_by)}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current Budget Overview */}
      {currentBudget && currentBudget.allocations && (
        <Card className="border-2 border-blue-200 bg-blue-50/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-blue-600" />
                  Current Budget: {currentBudget.name}
                </CardTitle>
                <CardDescription>
                  {formatDate(currentBudget.period_start)} - {formatDate(currentBudget.period_end)}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-900">
                  {formatCurrency(currentBudget.summary?.total_spent)} / {formatCurrency(currentBudget.summary?.total_planned)}
                </div>
                <Badge className={STATUS_COLORS[currentBudget.summary?.overall_status || 'green'].bg + ' ' + STATUS_COLORS[currentBudget.summary?.overall_status || 'green'].text}>
                  {STATUS_COLORS[currentBudget.summary?.overall_status || 'green'].label}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Overall Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Overall Progress</span>
                <span className="font-medium">{currentBudget.summary?.total_variance_pct || 0}%</span>
              </div>
              <Progress 
                value={Math.min(100, currentBudget.summary?.total_variance_pct || 0)} 
                className="h-3"
              />
            </div>
            
            {/* Category Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentBudget.allocations.map((alloc) => {
                const category = budgetCategories.find(c => c.key === alloc.category_key);
                const statusColor = STATUS_COLORS[alloc.status || 'green'];
                
                return (
                  <div 
                    key={alloc.category_key}
                    className={cn("p-4 rounded-lg border", statusColor.bg)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-800">{category?.name || alloc.category_key}</span>
                      <Badge className={statusColor.bg + ' ' + statusColor.text} variant="outline">
                        {alloc.variance_pct?.toFixed(0)}%
                      </Badge>
                    </div>
                    <Progress 
                      value={Math.min(100, alloc.variance_pct || 0)} 
                      className="h-2 mb-2"
                    />
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">
                        {formatCurrency(alloc.actual_spent)} / {formatCurrency(alloc.planned_amount)}
                      </span>
                      <span className={cn("font-medium", alloc.variance >= 0 ? "text-green-600" : "text-red-600")}>
                        {alloc.variance >= 0 ? '+' : ''}{formatCurrency(alloc.remaining)} left
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            All Budgets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {budgets.length === 0 ? (
            <div className="text-center py-12">
              <PiggyBank className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No budgets created yet</p>
              {hasPermission('finance.budget.create') && (
                <Button variant="outline" className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                  Create Your First Budget
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Budget Period</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Total Planned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((budget) => {
                  const statusConfig = BUDGET_STATUS_CONFIG[budget.status] || BUDGET_STATUS_CONFIG.draft;
                  const StatusIcon = statusConfig.icon;
                  const totalPlanned = budget.allocations?.reduce((sum, a) => sum + (a.planned_amount || 0), 0) || 0;
                  
                  return (
                    <TableRow key={budget.budget_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{budget.name}</p>
                          <p className="text-sm text-slate-500">
                            {formatDate(budget.period_start)} - {formatDate(budget.period_end)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{budget.period_type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(totalPlanned)}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {formatDate(budget.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {budget.status === 'draft' && hasPermission('finance.budget.edit') && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleActivateBudget(budget.budget_id)}
                            >
                              <Unlock className="w-4 h-4 mr-1" />
                              Activate
                            </Button>
                          )}
                          {budget.status === 'active' && hasPermission('finance.budget.close') && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleCloseBudget(budget.budget_id)}
                            >
                              <Lock className="w-4 h-4 mr-1" />
                              Close
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Budget Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Budget</DialogTitle>
            <DialogDescription>
              Set up your monthly or quarterly budget allocations.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Period Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period Type</Label>
                <Select 
                  value={newBudget.period_type} 
                  onValueChange={(v) => setNewBudget(p => ({ ...p, period_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Budget Name</Label>
                <Input
                  placeholder="e.g., January 2026 Budget"
                  value={newBudget.name}
                  onChange={(e) => setNewBudget(p => ({ ...p, name: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={newBudget.period_start}
                  onChange={(e) => setNewBudget(p => ({ ...p, period_start: e.target.value }))}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={newBudget.period_end}
                  onChange={(e) => setNewBudget(p => ({ ...p, period_end: e.target.value }))}
                />
              </div>
            </div>
            
            {/* Category Allocations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base">Category Allocations</Label>
                <span className="text-sm font-medium text-blue-600">
                  Total: {formatCurrency(getTotalPlanned())}
                </span>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {budgetCategories.map((category) => {
                  const alloc = newBudget.allocations.find(a => a.category_key === category.key);
                  return (
                    <div key={category.key} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{category.name}</p>
                        <p className="text-xs text-slate-500">{category.description}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {category.type}
                      </Badge>
                      <div className="w-36">
                        <Input
                          type="number"
                          placeholder="₹0"
                          value={alloc?.planned_amount || ''}
                          onChange={(e) => handleAllocationChange(category.key, e.target.value)}
                          className="text-right"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any notes about this budget period..."
                value={newBudget.notes}
                onChange={(e) => setNewBudget(p => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBudget} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Budgets;
