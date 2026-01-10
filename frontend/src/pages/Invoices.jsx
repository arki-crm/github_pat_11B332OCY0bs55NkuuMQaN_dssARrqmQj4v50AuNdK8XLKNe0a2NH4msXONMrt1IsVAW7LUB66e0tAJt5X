import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { cn } from '../lib/utils';
import { 
  FileText, 
  Loader2, 
  Plus, 
  Eye, 
  Download,
  Search,
  CheckCircle,
  AlertTriangle,
  Building2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Invoices = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [creating, setCreating] = useState(false);

  const hasPermission = (perm) => {
    if (user?.role === 'Admin') return true;
    return user?.permissions?.includes(perm);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invoicesRes, projectsRes] = await Promise.all([
        axios.get(`${API}/finance/invoices`, { withCredentials: true }),
        axios.get(`${API}/projects`, { withCredentials: true }).catch(() => ({ data: [] }))
      ]);
      setInvoices(invoicesRes.data || []);
      // Filter to only show projects that are GST applicable or have no invoices yet
      setProjects(projectsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleCreateInvoice = async () => {
    if (!selectedProjectId) {
      toast.error('Please select a project');
      return;
    }

    try {
      setCreating(true);
      await axios.post(`${API}/finance/invoices?project_id=${selectedProjectId}`, {}, { withCredentials: true });
      toast.success('Invoice created successfully');
      setIsCreateDialogOpen(false);
      setSelectedProjectId('');
      fetchData();
    } catch (error) {
      console.error('Failed to create invoice:', error);
      toast.error(error.response?.data?.detail || 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  const handleViewInvoice = async (invoiceId) => {
    try {
      const res = await axios.get(`${API}/finance/invoices/${invoiceId}`, { withCredentials: true });
      setViewInvoice(res.data);
    } catch (error) {
      toast.error('Failed to load invoice details');
    }
  };

  const handleDownloadPDF = async (invoiceId, invoiceNumber) => {
    try {
      toast.info('Generating PDF...');
      const res = await axios.get(`${API}/finance/invoices/${invoiceId}/pdf`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded');
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error('Failed to download PDF');
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(search) ||
      inv.project?.client_name?.toLowerCase().includes(search) ||
      inv.project?.project_name?.toLowerCase().includes(search)
    );
  });

  // Get projects that are GST applicable for create dropdown
  const gstProjects = projects.filter(p => p.is_gst_applicable);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="invoices-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Tax Invoices
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            GST invoices for applicable projects
          </p>
        </div>
        {hasPermission('finance.create_invoice') && (
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700"
            data-testid="create-invoice-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search invoices by number, client, or project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
              data-testid="search-invoices-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">GST Invoices Only</p>
            <p className="text-xs text-amber-600 mt-1">
              Invoices are only generated for projects marked as GST applicable. 
              Receipts are issued for all payments regardless of GST status.
            </p>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-lg">All Invoices</CardTitle>
          <CardDescription>{filteredInvoices.length} invoice(s) found</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No invoices found</p>
              <p className="text-xs text-slate-400 mt-1">Create your first invoice for a GST-applicable project</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoice #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Project</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Gross</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">GST</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Balance Due</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.invoice_id} className="hover:bg-slate-50" data-testid={`invoice-row-${invoice.invoice_id}`}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-indigo-600">{invoice.invoice_number}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(invoice.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-900">{invoice.project?.project_name}</span>
                        <span className="text-xs text-slate-400 ml-2">({invoice.project?.pid?.replace('ARKI-', '')})</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{invoice.project?.client_name}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(invoice.gross_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {invoice.is_gst_applicable ? (
                          <span className="text-slate-600">{formatCurrency(invoice.total_gst)}</span>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          "font-semibold",
                          invoice.balance_due > 0 ? "text-amber-600" : "text-green-600"
                        )}>
                          {formatCurrency(invoice.balance_due)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleViewInvoice(invoice.invoice_id)}
                            data-testid={`view-invoice-${invoice.invoice_id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDownloadPDF(invoice.invoice_id, invoice.invoice_number)}
                            data-testid={`download-invoice-${invoice.invoice_id}`}
                          >
                            <Download className="w-4 h-4 text-indigo-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Create Tax Invoice
            </DialogTitle>
            <DialogDescription>
              Generate a GST invoice for a project. Only GST-applicable projects are shown.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {gstProjects.length === 0 ? (
              <div className="p-4 bg-amber-50 rounded-lg text-center">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm text-amber-700">No GST-applicable projects found</p>
                <p className="text-xs text-amber-600 mt-1">
                  Mark a project as GST applicable first to create invoices
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Select Project *</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger data-testid="select-project-for-invoice">
                    <SelectValue placeholder="Choose a GST-applicable project" />
                  </SelectTrigger>
                  <SelectContent>
                    {gstProjects.map((proj) => (
                      <SelectItem key={proj.project_id} value={proj.project_id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span>{proj.project_name}</span>
                          <span className="text-xs text-slate-400">({proj.pid?.replace('ARKI-', '')})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Invoice will include 18% GST (CGST 9% + SGST 9%) and adjust for advances received.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateInvoice}
              disabled={creating || !selectedProjectId}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="confirm-create-invoice-btn"
            >
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={!!viewInvoice} onOpenChange={(open) => !open && setViewInvoice(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Invoice {viewInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {viewInvoice && (
            <div className="space-y-4 py-4">
              {/* Project Info */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-500">Bill To</p>
                <p className="font-medium text-slate-900">{viewInvoice.project?.client_name}</p>
                <p className="text-sm text-slate-600">{viewInvoice.project?.project_name}</p>
              </div>

              {/* Amount Breakdown */}
              <div className="space-y-2">
                {viewInvoice.is_gst_applicable && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Base Amount</span>
                      <span className="text-slate-900">{formatCurrency(viewInvoice.base_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">CGST @ 9%</span>
                      <span className="text-slate-900">{formatCurrency(viewInvoice.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">SGST @ 9%</span>
                      <span className="text-slate-900">{formatCurrency(viewInvoice.sgst)}</span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between text-sm">
                      <span className="text-slate-600">Gross Amount</span>
                      <span className="font-medium text-slate-900">{formatCurrency(viewInvoice.gross_amount)}</span>
                    </div>
                  </>
                )}
                {!viewInvoice.is_gst_applicable && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Gross Amount</span>
                    <span className="font-medium text-slate-900">{formatCurrency(viewInvoice.gross_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Less: Advances Received</span>
                  <span className="text-green-600">({formatCurrency(viewInvoice.advances_received)})</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between">
                  <span className="font-medium text-slate-700">Balance Due</span>
                  <span className={cn(
                    "font-bold text-lg",
                    viewInvoice.balance_due > 0 ? "text-amber-600" : "text-green-600"
                  )}>
                    {formatCurrency(viewInvoice.balance_due)}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                  {viewInvoice.is_gst_applicable ? `GST @ ${viewInvoice.gst_rate}%` : 'Non-GST'}
                </Badge>
                <Badge variant="outline" className="bg-slate-50 text-slate-600">
                  {viewInvoice.status}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewInvoice(null)}>Close</Button>
            {viewInvoice && (
              <Button 
                onClick={() => handleDownloadPDF(viewInvoice.invoice_id, viewInvoice.invoice_number)}
                className="bg-indigo-600 hover:bg-indigo-700"
                data-testid="download-invoice-pdf-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;
