import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, CheckCircle,
  Download, RefreshCw, Loader2, Building, Filter, ArrowUpDown,
  ChevronRight, Target, XCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

const formatPercent = (value) => {
  return `${value >= 0 ? '+' : ''}${value?.toFixed(1) || 0}%`;
};

const ProjectProfitabilityReport = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState('margin_percent');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async (filters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.stage || stage) params.append('stage', filters.stage || stage);
      if (filters.status || status) params.append('status', filters.status || status);
      params.append('sort_by', filters.sortBy || sortBy);
      params.append('sort_order', filters.sortOrder || sortOrder);
      
      const response = await axios.get(
        `${API_URL}/api/finance/reports/project-profitability?${params.toString()}`,
        { withCredentials: true }
      );
      setReportData(response.data);
    } catch (error) {
      console.error('Failed to fetch report:', error);
      toast.error(error.response?.data?.detail || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { stage, status, sortBy, sortOrder };
    newFilters[key] = value;
    
    if (key === 'stage') setStage(value);
    if (key === 'status') setStatus(value);
    if (key === 'sortBy') setSortBy(value);
    if (key === 'sortOrder') setSortOrder(value);
    
    fetchReport(newFilters);
  };

  const handleExport = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/api/admin/export`,
        {
          data_type: 'project_finance',
          format: 'xlsx',
        },
        {
          withCredentials: true,
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project_profitability_report_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  const getStatusBadge = (profit_status, risk_level) => {
    if (profit_status === 'profitable') {
      return <Badge className="bg-green-100 text-green-700">Profitable</Badge>;
    } else if (profit_status === 'loss') {
      return <Badge className="bg-red-100 text-red-700">Loss</Badge>;
    } else {
      return <Badge variant="outline">Break Even</Badge>;
    }
  };

  const getRiskBadge = (risk_level) => {
    if (risk_level === 'high') {
      return <Badge className="bg-red-100 text-red-700">High Risk</Badge>;
    } else if (risk_level === 'medium') {
      return <Badge className="bg-amber-100 text-amber-700">Medium Risk</Badge>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const { summary, projects, top_profitable, top_loss } = reportData || {};

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="project-profitability-report">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Profitability Report</h1>
          <p className="text-gray-500 mt-1">
            Analyze profit margins and identify at-risk projects
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => fetchReport()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Total Projects</p>
            <p className="text-2xl font-bold">{summary?.total_projects || 0}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <p className="text-sm text-green-600">Profitable</p>
            <p className="text-2xl font-bold text-green-700">{summary?.profitable_projects || 0}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-4">
            <p className="text-sm text-red-600">Loss-Making</p>
            <p className="text-2xl font-bold text-red-700">{summary?.loss_projects || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">Total Profit</p>
            <p className={`text-2xl font-bold ${summary?.total_realized_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(summary?.total_realized_profit)}
            </p>
          </CardContent>
        </Card>
        
        <Card className={summary?.overall_margin_percent >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}>
          <CardContent className="pt-4">
            <p className={`text-sm ${summary?.overall_margin_percent >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              Overall Margin
            </p>
            <p className={`text-2xl font-bold ${summary?.overall_margin_percent >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {formatPercent(summary?.overall_margin_percent)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers & Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Profitable */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Top Profitable Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {top_profitable?.length > 0 ? (
              <div className="space-y-3">
                {top_profitable.map((project) => (
                  <div
                    key={project.project_id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100"
                    onClick={() => navigate(`/finance/project-finance/${project.project_id}`)}
                  >
                    <div>
                      <p className="font-medium text-sm">{project.project_name}</p>
                      <p className="text-xs text-gray-500">{project.pid}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-700">{formatCurrency(project.realized_profit)}</p>
                      <p className="text-xs text-green-600">{formatPercent(project.realized_margin_percent)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No profitable projects</p>
            )}
          </CardContent>
        </Card>

        {/* Top Loss */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              Loss-Making Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {top_loss?.length > 0 ? (
              <div className="space-y-3">
                {top_loss.map((project) => (
                  <div
                    key={project.project_id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100"
                    onClick={() => navigate(`/finance/project-finance/${project.project_id}`)}
                  >
                    <div>
                      <p className="font-medium text-sm">{project.project_name}</p>
                      <p className="text-xs text-gray-500">{project.pid}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-700">{formatCurrency(project.realized_profit)}</p>
                      <p className="text-xs text-red-600">{formatPercent(project.realized_margin_percent)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No loss-making projects</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-40">
              <Label className="text-sm">Stage</Label>
              <Select value={stage} onValueChange={(v) => handleFilterChange('stage', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Stages</SelectItem>
                  <SelectItem value="Design Finalization">Design Finalization</SelectItem>
                  <SelectItem value="Production Preparation">Production Preparation</SelectItem>
                  <SelectItem value="Production">Production</SelectItem>
                  <SelectItem value="Delivery">Delivery</SelectItem>
                  <SelectItem value="Installation">Installation</SelectItem>
                  <SelectItem value="Handover">Handover</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-40">
              <Label className="text-sm">Status</Label>
              <Select value={status} onValueChange={(v) => handleFilterChange('status', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  <SelectItem value="profitable">Profitable Only</SelectItem>
                  <SelectItem value="loss">Loss Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-40">
              <Label className="text-sm">Sort By</Label>
              <Select value={sortBy} onValueChange={(v) => handleFilterChange('sortBy', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="margin_percent">Margin %</SelectItem>
                  <SelectItem value="profit">Profit Amount</SelectItem>
                  <SelectItem value="contract_value">Contract Value</SelectItem>
                  <SelectItem value="actual_cost">Actual Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-32">
              <Label className="text-sm">Order</Label>
              <Select value={sortOrder} onValueChange={(v) => handleFilterChange('sortOrder', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">High to Low</SelectItem>
                  <SelectItem value="asc">Low to High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building className="w-5 h-5" />
            All Projects ({projects?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects?.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Contract Value</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Actual Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow 
                      key={project.project_id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/finance/project-finance/${project.project_id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{project.project_name}</p>
                          <p className="text-xs text-gray-500">{project.pid || project.client_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{project.stage}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(project.contract_value)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(project.total_received)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(project.actual_cost)}</TableCell>
                      <TableCell className={`text-right font-medium ${project.realized_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(project.realized_profit)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${project.realized_margin_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(project.realized_margin_percent)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(project.profit_status, project.risk_level)}
                          {getRiskBadge(project.risk_level)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No projects found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectProfitabilityReport;
