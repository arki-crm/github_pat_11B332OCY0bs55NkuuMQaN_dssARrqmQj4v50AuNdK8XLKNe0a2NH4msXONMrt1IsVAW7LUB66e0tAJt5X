import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  ClipboardList, 
  Plus, 
  Pencil, 
  Trash2, 
  Download, 
  FileSpreadsheet,
  Package,
  Wrench,
  Truck,
  Building,
  Hammer,
  Box,
  Loader2,
  Eye,
  Paperclip
} from 'lucide-react';
import AttachmentUploader from './AttachmentUploader';

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORY_ICONS = {
  "Modular Material": Package,
  "Hardware & Accessories": Wrench,
  "Factory / Job Work": Building,
  "Installation": Hammer,
  "Transportation / Logistics": Truck,
  "Non-Modular Furniture": Box,
  "Site Expense": ClipboardList
};

const CATEGORY_COLORS = {
  "Modular Material": "bg-blue-100 text-blue-800",
  "Hardware & Accessories": "bg-purple-100 text-purple-800",
  "Factory / Job Work": "bg-orange-100 text-orange-800",
  "Installation": "bg-green-100 text-green-800",
  "Transportation / Logistics": "bg-yellow-100 text-yellow-800",
  "Non-Modular Furniture": "bg-pink-100 text-pink-800",
  "Site Expense": "bg-slate-100 text-slate-800"
};

export default function ExecutionLedger({ projectId, userRole, transactions = [] }) {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({});
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [deletingEntry, setDeletingEntry] = useState(null);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Filter
  const [filterCategory, setFilterCategory] = useState('all');
  
  // Form state
  const [form, setForm] = useState({
    category: '',
    material_name: '',
    specification: '',
    brand: '',
    size_unit: '',
    quantity: '',
    rate_per_unit: '',
    vendor: '',
    execution_date: new Date().toISOString().split('T')[0],
    linked_cashbook_id: '',
    remarks: ''
  });

  const canEdit = ['Admin', 'Founder', 'ProjectManager'].includes(userRole);
  const canDelete = userRole === 'Admin';

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const url = filterCategory === 'all' 
        ? `${API}/api/finance/execution-ledger/project/${projectId}`
        : `${API}/api/finance/execution-ledger/project/${projectId}?category=${encodeURIComponent(filterCategory)}`;
      
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setSummary(data.summary_by_category || {});
        setTotalValue(data.total_value || 0);
      }
    } catch (err) {
      toast.error('Failed to fetch execution ledger');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API}/api/finance/execution-ledger/categories`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories');
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchEntries();
  }, [projectId, filterCategory]);

  const resetForm = () => {
    setForm({
      category: '',
      material_name: '',
      specification: '',
      brand: '',
      size_unit: '',
      quantity: '',
      rate_per_unit: '',
      vendor: '',
      execution_date: new Date().toISOString().split('T')[0],
      linked_cashbook_id: '',
      remarks: ''
    });
  };

  const handleSubmit = async () => {
    if (!form.category || !form.material_name || !form.quantity || !form.rate_per_unit) {
      toast.error('Please fill required fields: Category, Material Name, Quantity, Rate');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        project_id: projectId,
        category: form.category,
        material_name: form.material_name,
        specification: form.specification || null,
        brand: form.brand || null,
        size_unit: form.size_unit || null,
        quantity: parseFloat(form.quantity),
        rate_per_unit: parseFloat(form.rate_per_unit),
        vendor: form.vendor || null,
        execution_date: form.execution_date,
        linked_cashbook_id: form.linked_cashbook_id || null,
        remarks: form.remarks || null
      };

      const url = editingEntry
        ? `${API}/api/finance/execution-ledger/${editingEntry.execution_id}`
        : `${API}/api/finance/execution-ledger`;
      
      const res = await fetch(url, {
        method: editingEntry ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save');
      }

      toast.success(editingEntry ? 'Entry updated' : 'Entry created');
      setShowAddModal(false);
      setEditingEntry(null);
      resetForm();
      fetchEntries();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingEntry) return;
    
    try {
      const res = await fetch(`${API}/api/finance/execution-ledger/${deletingEntry.execution_id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to delete');
      }

      toast.success('Entry deleted');
      setDeletingEntry(null);
      fetchEntries();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleExport = async (format) => {
    try {
      const res = await fetch(`${API}/api/finance/execution-ledger/export/${projectId}?format=${format}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Execution_Ledger.${format === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setForm({
      category: entry.category,
      material_name: entry.material_name,
      specification: entry.specification || '',
      brand: entry.brand || '',
      size_unit: entry.size_unit || '',
      quantity: entry.quantity.toString(),
      rate_per_unit: entry.rate_per_unit.toString(),
      vendor: entry.vendor || '',
      execution_date: entry.execution_date,
      linked_cashbook_id: entry.linked_cashbook_id || '',
      remarks: entry.remarks || ''
    });
    setShowAddModal(true);
  };

  const formatCurrency = (amount) => `₹${(amount || 0).toLocaleString('en-IN')}`;
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const calculatedTotal = form.quantity && form.rate_per_unit 
    ? parseFloat(form.quantity) * parseFloat(form.rate_per_unit) 
    : 0;

  return (
    <Card className="border-slate-200" data-testid="execution-ledger">
      <CardHeader className="border-b border-slate-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            Execution Ledger
            <Badge variant="outline" className="ml-2 text-xs">
              {entries.length} entries • {formatCurrency(totalValue)}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]" data-testid="filter-category">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} data-testid="export-csv">
              <Download className="w-4 h-4 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')} data-testid="export-excel">
              <FileSpreadsheet className="w-4 h-4 mr-1" />
              Excel
            </Button>
            
            {canEdit && (
              <Button size="sm" onClick={() => { resetForm(); setShowAddModal(true); }} data-testid="add-entry-btn">
                <Plus className="w-4 h-4 mr-1" />
                Add Entry
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Summary by Category */}
        {Object.keys(summary).length > 0 && (
          <div className="p-4 border-b bg-slate-50 flex flex-wrap gap-2">
            {Object.entries(summary).map(([cat, data]) => {
              const IconComponent = CATEGORY_ICONS[cat] || ClipboardList;
              return (
                <Badge key={cat} variant="outline" className={`${CATEGORY_COLORS[cat] || 'bg-slate-100'} px-3 py-1`}>
                  <IconComponent className="w-3 h-3 mr-1" />
                  {cat}: {data.count} • {formatCurrency(data.total_value)}
                </Badge>
              );
            })}
          </div>
        )}
        
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading execution ledger...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            No execution entries yet
            {canEdit && <p className="text-sm mt-1">Click "Add Entry" to start tracking materials & services</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Category</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Material/Service</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Spec/Brand</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Rate</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Total</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Vendor</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry) => {
                  const IconComponent = CATEGORY_ICONS[entry.category] || ClipboardList;
                  return (
                    <tr key={entry.execution_id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {formatDate(entry.execution_date)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className={`${CATEGORY_COLORS[entry.category] || 'bg-slate-100'} text-xs`}>
                          <IconComponent className="w-3 h-3 mr-1" />
                          {entry.category}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-slate-700 font-medium">
                        {entry.material_name}
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs">
                        {entry.specification && <div>{entry.specification}</div>}
                        {entry.brand && <div className="text-slate-400">{entry.brand}</div>}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {entry.quantity} {entry.size_unit}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">
                        {formatCurrency(entry.rate_per_unit)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800">
                        {formatCurrency(entry.total_value)}
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs">
                        {entry.vendor || '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <Button variant="ghost" size="sm" onClick={() => setViewingEntry(entry)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canEdit && (
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(entry)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="sm" onClick={() => setDeletingEntry(entry)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100">
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-right font-medium text-slate-600">
                    Total:
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">
                    {formatCurrency(totalValue)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => { if (!open) { setShowAddModal(false); setEditingEntry(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Execution Entry' : 'Add Execution Entry'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="form-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Execution Date *</Label>
              <Input
                type="date"
                value={form.execution_date}
                onChange={(e) => setForm({ ...form, execution_date: e.target.value })}
                data-testid="form-date"
              />
            </div>
            
            <div className="col-span-2">
              <Label>Material / Service Name *</Label>
              <Input
                placeholder="e.g., BWP Plywood 18mm, Hettich Hinges, Kitchen Installation"
                value={form.material_name}
                onChange={(e) => setForm({ ...form, material_name: e.target.value })}
                data-testid="form-material"
              />
            </div>
            
            <div>
              <Label>Specification</Label>
              <Input
                placeholder="e.g., Marine Grade, Soft Close"
                value={form.specification}
                onChange={(e) => setForm({ ...form, specification: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Brand</Label>
              <Input
                placeholder="e.g., Century, Hettich, Hafele"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Quantity *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g., 10"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                data-testid="form-quantity"
              />
            </div>
            
            <div>
              <Label>Size / Unit</Label>
              <Input
                placeholder="e.g., sq ft, nos, sheets, kg"
                value={form.size_unit}
                onChange={(e) => setForm({ ...form, size_unit: e.target.value })}
              />
            </div>
            
            <div>
              <Label>Rate per Unit (₹) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g., 150"
                value={form.rate_per_unit}
                onChange={(e) => setForm({ ...form, rate_per_unit: e.target.value })}
                data-testid="form-rate"
              />
            </div>
            
            <div>
              <Label>Total Value</Label>
              <div className="h-10 px-3 py-2 bg-slate-100 rounded-md text-slate-700 font-medium">
                {formatCurrency(calculatedTotal)}
              </div>
            </div>
            
            <div className="col-span-2">
              <Label>Vendor</Label>
              <Input
                placeholder="e.g., Local Plywood Supplier, ABC Hardware"
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              />
            </div>
            
            <div className="col-span-2">
              <Label>Link to Cashbook Entry (optional)</Label>
              <Select 
                value={form.linked_cashbook_id} 
                onValueChange={(v) => setForm({ ...form, linked_cashbook_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select transaction (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {transactions.filter(t => t.transaction_type === 'outflow').slice(0, 50).map(txn => (
                    <SelectItem key={txn.transaction_id} value={txn.transaction_id}>
                      {formatDate(txn.created_at)} - {formatCurrency(txn.amount)} - {txn.remarks?.substring(0, 30) || txn.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">Reference only - does not affect accounting</p>
            </div>
            
            <div className="col-span-2">
              <Label>Remarks</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); setEditingEntry(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving} data-testid="save-entry-btn">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingEntry ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Entry Modal */}
      {viewingEntry && (
        <Dialog open={!!viewingEntry} onOpenChange={() => setViewingEntry(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Execution Entry Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-500">ID:</span> <span className="font-mono">{viewingEntry.execution_id}</span></div>
                <div><span className="text-slate-500">Date:</span> {formatDate(viewingEntry.execution_date)}</div>
              </div>
              <div>
                <span className="text-slate-500">Category:</span>
                <Badge className={`ml-2 ${CATEGORY_COLORS[viewingEntry.category]}`}>{viewingEntry.category}</Badge>
              </div>
              <div><span className="text-slate-500">Material/Service:</span> <strong>{viewingEntry.material_name}</strong></div>
              {viewingEntry.specification && <div><span className="text-slate-500">Specification:</span> {viewingEntry.specification}</div>}
              {viewingEntry.brand && <div><span className="text-slate-500">Brand:</span> {viewingEntry.brand}</div>}
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-slate-500">Qty:</span> {viewingEntry.quantity} {viewingEntry.size_unit}</div>
                <div><span className="text-slate-500">Rate:</span> {formatCurrency(viewingEntry.rate_per_unit)}</div>
                <div><span className="text-slate-500">Total:</span> <strong>{formatCurrency(viewingEntry.total_value)}</strong></div>
              </div>
              {viewingEntry.vendor && <div><span className="text-slate-500">Vendor:</span> {viewingEntry.vendor}</div>}
              {viewingEntry.remarks && <div><span className="text-slate-500">Remarks:</span> {viewingEntry.remarks}</div>}
              <div className="text-xs text-slate-400 pt-2 border-t">
                Created by {viewingEntry.created_by_name} on {formatDate(viewingEntry.created_at)}
              </div>
              
              {/* Attachments Section */}
              <div className="pt-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Attachments</span>
                </div>
                <AttachmentUploader
                  entityType="execution"
                  entityId={viewingEntry.execution_id}
                  canUpload={canEdit}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingEntry(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingEntry} onOpenChange={() => setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Execution Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry for "{deletingEntry?.material_name}"?
              This action cannot be undone.
              <br /><br />
              <strong>Note:</strong> This does NOT affect any cashbook entries or financial records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
