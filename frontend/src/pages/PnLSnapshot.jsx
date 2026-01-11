import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Loader2, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Users,
  Briefcase,
  Car,
  MoreHorizontal,
  AlertTriangle,
  Download,
  Info,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function PnLSnapshot() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '₹0';
    const sign = val < 0 ? '-' : '';
    return sign + new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.abs(val));
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      let url = `${API}/finance/pnl-snapshot?period=${period}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&start_date=${customStart}&end_date=${customEnd}`;
      }
      
      const res = await axios.get(url, { withCredentials: true });
      setData(res.data);
    } catch (error) {
      console.error('Failed to fetch P&L:', error);
      toast.error('Failed to load P&L snapshot');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== 'custom' || (customStart && customEnd)) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const handleCustomDateApply = () => {
    if (customStart && customEnd) {
      fetchData();
    } else {
      toast.error('Please select both start and end dates');
    }
  };

  const exportToCSV = () => {
    if (!data) return;
    
    const rows = [
      ['P&L Snapshot - ' + data.period_label],
      ['Period: ' + data.start_date + ' to ' + data.end_date],
      [''],
      ['REVENUE'],
      ['Revenue from Projects', data.revenue.from_projects],
      ['Other Income', data.revenue.other_income],
      ['Total Revenue', data.revenue.total],
      [''],
      ['EXECUTION COSTS'],
      ['Paid (Cashbook)', data.execution_costs.paid],
      ['Committed (Liabilities)', data.execution_costs.committed],
      ['Total Execution Exposure', data.execution_costs.total_exposure],
      [''],
      ['OPERATING EXPENSES'],
      ['Salaries', data.operating_expenses.salaries],
      ['Office', data.operating_expenses.office],
      ['Marketing', data.operating_expenses.marketing],
      ['Travel', data.operating_expenses.travel],
      ['Miscellaneous', data.operating_expenses.misc],
      ['Total Operating', data.total_operating],
      [''],
      ['PROFIT SUMMARY'],
      ['Gross Profit', data.gross_profit],
      ['Net Operating Profit', data.net_operating_profit],
      [''],
      ['CASH vs ACCOUNTING'],
      ['Cash Profit', data.cash_profit],
      ['Accounting Profit', data.accounting_profit],
      ['Difference', data.profit_difference]
    ];
    
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pnl_snapshot_${data.start_date}_${data.end_date}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6" data-testid="pnl-snapshot-page">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">P&L Snapshot</h1>
            <p className="text-slate-500 text-sm mt-1">
              Simplified profit & loss view • {data?.period_label}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV} disabled={!data} data-testid="export-pnl-btn">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Period Selector */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <Label className="text-sm text-slate-500">Period</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-[150px] mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {period === 'custom' && (
                <>
                  <div>
                    <Label className="text-sm text-slate-500">Start Date</Label>
                    <Input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-slate-500">End Date</Label>
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleCustomDateApply}>Apply</Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {data && (
          <>
            {/* Top Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <p className="text-sm text-slate-500">Total Revenue</p>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(data.revenue.total)}</p>
                </CardContent>
              </Card>
              
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-slate-500">Total Costs</p>
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(data.execution_costs.total_exposure + data.total_operating)}
                  </p>
                </CardContent>
              </Card>
              
              <Card className={cn("border-slate-200", data.net_operating_profit < 0 && "border-red-200 bg-red-50")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className={cn("w-4 h-4", data.net_operating_profit >= 0 ? "text-emerald-500" : "text-red-500")} />
                    <p className="text-sm text-slate-500">Net Profit</p>
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    data.net_operating_profit >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {formatCurrency(data.net_operating_profit)}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="border-slate-200 border-blue-200 bg-blue-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-blue-500" />
                    <p className="text-sm text-slate-500">Cash Profit</p>
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    data.cash_profit >= 0 ? "text-blue-600" : "text-red-600"
                  )}>
                    {formatCurrency(data.cash_profit)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Main P&L Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue & Costs */}
              <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-200 pb-3">
                  <CardTitle className="text-lg">Revenue & Costs</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      {/* Revenue Section */}
                      <tr className="bg-green-50 border-b">
                        <td colSpan={2} className="py-2 px-4 font-semibold text-green-800">
                          <TrendingUp className="w-4 h-4 inline mr-2" />
                          REVENUE
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-slate-600">Revenue from Projects</td>
                        <td className="py-2 px-4 text-right font-mono text-green-600">
                          {formatCurrency(data.revenue.from_projects)}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-slate-600">Other Income</td>
                        <td className="py-2 px-4 text-right font-mono text-green-600">
                          {formatCurrency(data.revenue.other_income)}
                        </td>
                      </tr>
                      <tr className="border-b bg-green-50">
                        <td className="py-2 px-4 font-semibold text-green-800">Total Revenue</td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-green-700">
                          {formatCurrency(data.revenue.total)}
                        </td>
                      </tr>

                      {/* Execution Costs */}
                      <tr className="bg-red-50 border-b">
                        <td colSpan={2} className="py-2 px-4 font-semibold text-red-800">
                          <Building2 className="w-4 h-4 inline mr-2" />
                          EXECUTION COSTS
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-slate-600">
                          Paid (Cashbook)
                          <span className="text-xs text-slate-400 ml-1">- actual spend</span>
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-red-600">
                          {formatCurrency(data.execution_costs.paid)}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-slate-600">
                          Committed (Liabilities)
                          <span className="text-xs text-slate-400 ml-1">- pending payment</span>
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-amber-600">
                          {formatCurrency(data.execution_costs.committed)}
                        </td>
                      </tr>
                      <tr className="border-b bg-red-50">
                        <td className="py-2 px-4 font-semibold text-red-800">Total Execution Exposure</td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-red-700">
                          {formatCurrency(data.execution_costs.total_exposure)}
                        </td>
                      </tr>

                      {/* Gross Profit */}
                      <tr className={cn("border-b", data.gross_profit >= 0 ? "bg-emerald-100" : "bg-red-100")}>
                        <td className="py-3 px-4 font-bold">Gross Profit</td>
                        <td className={cn(
                          "py-3 px-4 text-right font-mono font-bold text-lg",
                          data.gross_profit >= 0 ? "text-emerald-700" : "text-red-700"
                        )}>
                          {formatCurrency(data.gross_profit)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Operating Expenses */}
              <Card className="border-slate-200">
                <CardHeader className="border-b border-slate-200 pb-3">
                  <CardTitle className="text-lg">Operating Expenses</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="bg-slate-100 border-b">
                        <td colSpan={2} className="py-2 px-4 font-semibold text-slate-700">
                          <Briefcase className="w-4 h-4 inline mr-2" />
                          OPERATING EXPENSES
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-slate-600">
                          <Users className="w-3 h-3 inline mr-2 text-slate-400" />
                          Salaries
                        </td>
                        <td className="py-2 px-4 text-right font-mono">{formatCurrency(data.operating_expenses.salaries)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-slate-600">
                          <Building2 className="w-3 h-3 inline mr-2 text-slate-400" />
                          Office Expenses
                        </td>
                        <td className="py-2 px-4 text-right font-mono">{formatCurrency(data.operating_expenses.office)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-slate-600">
                          <TrendingUp className="w-3 h-3 inline mr-2 text-slate-400" />
                          Sales & Marketing
                        </td>
                        <td className="py-2 px-4 text-right font-mono">{formatCurrency(data.operating_expenses.marketing)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-slate-600">
                          <Car className="w-3 h-3 inline mr-2 text-slate-400" />
                          Travel
                        </td>
                        <td className="py-2 px-4 text-right font-mono">{formatCurrency(data.operating_expenses.travel)}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 text-slate-600">
                          <MoreHorizontal className="w-3 h-3 inline mr-2 text-slate-400" />
                          Miscellaneous
                        </td>
                        <td className="py-2 px-4 text-right font-mono">{formatCurrency(data.operating_expenses.misc)}</td>
                      </tr>
                      <tr className="border-b bg-slate-100">
                        <td className="py-2 px-4 font-semibold text-slate-700">Total Operating</td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-slate-700">
                          {formatCurrency(data.total_operating)}
                        </td>
                      </tr>

                      {/* Net Operating Profit */}
                      <tr className={cn("border-b", data.net_operating_profit >= 0 ? "bg-emerald-100" : "bg-red-100")}>
                        <td className="py-3 px-4 font-bold">Net Operating Profit</td>
                        <td className={cn(
                          "py-3 px-4 text-right font-mono font-bold text-lg",
                          data.net_operating_profit >= 0 ? "text-emerald-700" : "text-red-700"
                        )}>
                          {formatCurrency(data.net_operating_profit)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            {/* Cash vs Accounting Profit Explanation */}
            <Card className="border-slate-200 border-blue-200 bg-blue-50/30">
              <CardHeader className="border-b border-blue-200 pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-blue-600" />
                  Cash Profit vs Accounting Profit
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <p className="text-sm text-slate-500 mb-1">Cash Profit</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      data.cash_profit >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {formatCurrency(data.cash_profit)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Actual cash in - cash out</p>
                  </div>
                  
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <ArrowRight className="w-8 h-8 text-slate-300 mx-auto" />
                      <Badge variant="outline" className={cn(
                        "mt-2",
                        data.profit_difference >= 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200"
                      )}>
                        {data.profit_difference >= 0 ? '+' : ''}{formatCurrency(data.profit_difference)} difference
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <p className="text-sm text-slate-500 mb-1">Accounting Profit</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      data.accounting_profit >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {formatCurrency(data.accounting_profit)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Includes commitments</p>
                  </div>
                </div>

                {/* Explanation */}
                <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200">
                  <p className="text-sm font-medium text-slate-700 mb-2">Why the difference?</p>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>{data.difference_factors.advances_locked_pct}% of advances are locked for project execution</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400"></span>
                      <span>{formatCurrency(data.difference_factors.open_liabilities)} in open liabilities (obligations)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                      <span>{formatCurrency(data.difference_factors.committed_not_paid)} committed but not yet paid</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
