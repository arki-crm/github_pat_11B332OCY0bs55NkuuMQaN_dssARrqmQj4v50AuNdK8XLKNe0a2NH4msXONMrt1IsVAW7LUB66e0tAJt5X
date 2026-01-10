import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Search, 
  Shield, 
  ChevronRight,
  Loader2,
  FileX2,
  Calendar,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Status badge styles
const STATUS_STYLES = {
  'Active': 'bg-green-100 text-green-700',
  'Expired': 'bg-red-100 text-red-700',
  'Voided': 'bg-slate-100 text-slate-700'
};

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const Warranty = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchWarranties();
  }, [statusFilter]);

  const fetchWarranties = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const response = await axios.get(`${API}/warranties?${params}`, {
        withCredentials: true
      });
      setWarranties(response.data);
    } catch (err) {
      console.error('Failed to fetch warranties:', err);
      toast.error('Failed to load warranties');
    } finally {
      setLoading(false);
    }
  };

  const filteredWarranties = warranties.filter(w => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      w.pid?.toLowerCase().includes(search) ||
      w.customer_name?.toLowerCase().includes(search) ||
      w.customer_phone?.includes(search) ||
      w.project_name?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="warranty-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Warranty Registry
          </h1>
          <p className="text-slate-500 mt-1">
            {filteredWarranties.length} warranties
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by PID, customer, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="warranty-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Expired">Expired</SelectItem>
            <SelectItem value="Voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Warranty List */}
      {filteredWarranties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileX2 className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No warranties found</h3>
            <p className="text-slate-500">Warranties are auto-created when projects reach Closed status</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">PID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Warranty Period</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarranties.map((warranty) => (
                  <tr
                    key={warranty.warranty_id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer group"
                    onClick={() => navigate(`/projects/${warranty.project_id}?tab=warranty`)}
                    data-testid={`warranty-row-${warranty.warranty_id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded">
                        {warranty.pid?.replace('ARKI-', '')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{warranty.customer_name}</p>
                      <p className="text-xs text-slate-500">{warranty.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{warranty.project_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(warranty.warranty_start_date)} - {formatDate(warranty.warranty_end_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_STYLES[warranty.warranty_status]
                      )}>
                        {warranty.warranty_status === 'Active' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {warranty.warranty_status === 'Expired' && <XCircle className="w-3 h-3 mr-1" />}
                        {warranty.warranty_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Warranty;
