import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { 
  Loader2, 
  Lock,
  CheckCircle,
  Calendar,
  TrendingUp,
  TrendingDown,
  Wallet,
  Target
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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MonthlySnapshot = () => {
  const { hasPermission } = useAuth();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [snapshots, setSnapshots] = useState([]);

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
    years.push(y);
  }

  const fetchData = async () => {
    try {
      setLoading(true);
      const [snapshotRes, listRes] = await Promise.all([
        axios.get(`${API}/finance/monthly-snapshots/${selectedYear}/${selectedMonth}`, {
          withCredentials: true
        }),
        axios.get(`${API}/finance/monthly-snapshots`, {
          params: { year: selectedYear },
          withCredentials: true
        })
      ]);
      setData(snapshotRes.data);
      setSnapshots(listRes.data);
    } catch (error) {
      console.error('Failed to fetch monthly snapshot:', error);
      toast.error('Failed to load monthly snapshot');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  const handleCloseMonth = async () => {
    try {
      setClosing(true);
      await axios.post(`${API}/finance/monthly-snapshots/${selectedYear}/${selectedMonth}/close`, {}, {
        withCredentials: true
      });
      toast.success(`${MONTHS[selectedMonth - 1]} ${selectedYear} has been closed`);
      fetchData();
    } catch (error) {
      console.error('Failed to close month:', error);
      toast.error(error.response?.data?.detail || 'Failed to close month');
    } finally {
      setClosing(false);
    }
  };

  const isCurrentOrFutureMonth = (year, month) => {
    if (year > now.getFullYear()) return true;
    if (year === now.getFullYear() && month >= now.getMonth() + 1) return true;
    return false;
  };

  const canCloseMonth = hasPermission('finance.monthly_snapshot') && 
    !data?.is_closed && 
    !isCurrentOrFutureMonth(selectedYear, selectedMonth);

  if (!hasPermission('finance.monthly_snapshot') && !hasPermission('finance.view_reports')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen" data-testid="monthly-snapshot-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Monthly Snapshot
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            End-of-month financial summary and closure
          </p>
        </div>
      </div>

      {/* Month/Year Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, idx) => (
                <SelectItem key={idx} value={(idx + 1).toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data?.is_closed && (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <Lock className="w-3 h-3 mr-1" />
            Closed
          </Badge>
        )}
        {!data?.is_closed && !isCurrentOrFutureMonth(selectedYear, selectedMonth) && (
          <Badge variant="outline" className="border-amber-300 text-amber-600">
            Open - Pending Closure
          </Badge>
        )}
        {isCurrentOrFutureMonth(selectedYear, selectedMonth) && !data?.is_closed && (
          <Badge variant="outline" className="text-slate-500">
            In Progress
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Closed Banner */}
          {data?.is_closed && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <Lock className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Month Closed</p>
                <p className="text-sm text-green-600">
                  Closed by {data.closed_by_name} on {new Date(data.closed_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-600 text-xs mb-1">
                  <TrendingUp className="w-3 h-3" /> Total Inflow
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(data?.total_inflow)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-600 text-xs mb-1">
                  <TrendingDown className="w-3 h-3" /> Total Outflow
                </div>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(data?.total_outflow)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 mb-1">Net Change</p>
                <p className={cn(
                  "text-2xl font-bold",
                  data?.net_change >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {data?.net_change >= 0 ? '+' : ''}{formatCurrency(data?.net_change)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-900">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Wallet className="w-3 h-3" /> Cash Position
                </div>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(data?.cash_position)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Transaction Summary */}
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-lg font-semibold">
                  {MONTHS[selectedMonth - 1]} {selectedYear} Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Total Transactions</span>
                  <span className="font-semibold text-slate-900">{data?.transaction_count || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Total Inflow</span>
                  <span className="font-semibold text-green-600">+{formatCurrency(data?.total_inflow)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Total Outflow</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(data?.total_outflow)}</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-slate-50 px-3 rounded-lg">
                  <span className="font-medium text-slate-700">Net Change</span>
                  <span className={cn(
                    "font-bold text-lg",
                    data?.net_change >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {data?.net_change >= 0 ? '+' : ''}{formatCurrency(data?.net_change)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Planned vs Actual */}
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Target className="w-5 h-5 text-slate-500" />
                  Planned vs Actual
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Total Planned Cost</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(data?.total_planned_cost)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600">Total Actual Cost</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(data?.total_actual_cost)}</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-slate-50 px-3 rounded-lg">
                  <span className="font-medium text-slate-700">Difference</span>
                  <span className={cn(
                    "font-bold text-lg",
                    data?.planned_vs_actual_diff >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {data?.planned_vs_actual_diff >= 0 ? 'Under by ' : 'Over by '}
                    {formatCurrency(Math.abs(data?.planned_vs_actual_diff))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Close Month Button */}
          {canCloseMonth && (
            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700" data-testid="close-month-btn">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Close Month
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Close {MONTHS[selectedMonth - 1]} {selectedYear}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently freeze the financial snapshot for this month. 
                      The data will become read-only and can be used for future comparisons.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleCloseMonth}
                      disabled={closing}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {closing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Confirm Close
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* Historical Snapshots */}
          {snapshots.length > 0 && (
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-lg font-semibold">
                  {selectedYear} Snapshots
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Month</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Inflow</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Outflow</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Net</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Cash Position</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {snapshots.map((snap) => (
                        <tr 
                          key={`${snap.year}-${snap.month}`}
                          className={cn(
                            "hover:bg-slate-50 cursor-pointer",
                            snap.month === selectedMonth && "bg-blue-50"
                          )}
                          onClick={() => {
                            setSelectedMonth(snap.month);
                            setSelectedYear(snap.year);
                          }}
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {snap.month_name}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-green-600">
                            +{formatCurrency(snap.total_inflow)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-red-600">
                            -{formatCurrency(snap.total_outflow)}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-right text-sm font-semibold",
                            snap.net_change >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {snap.net_change >= 0 ? '+' : ''}{formatCurrency(snap.net_change)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                            {formatCurrency(snap.cash_position)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {snap.is_closed ? (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                <Lock className="w-3 h-3 mr-1" />
                                Closed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-slate-500">
                                Open
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default MonthlySnapshot;
