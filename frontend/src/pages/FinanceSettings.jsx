import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { cn } from '../lib/utils';
import { 
  Settings, 
  Loader2, 
  Plus, 
  Pencil,
  Trash2,
  Search,
  Building2,
  Wallet,
  FolderTree,
  Users,
  CheckCircle,
  XCircle,
  DollarSign,
  Briefcase,
  Wrench,
  HardHat,
  Package
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FinanceSettings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('accounts');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  
  // Dialog states
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  
  const [editingAccount, setEditingAccount] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingVendor, setEditingVendor] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
      const [accountsRes, categoriesRes, vendorsRes] = await Promise.all([
        axios.get(`${API}/accounting/accounts`, { withCredentials: true }),
        axios.get(`${API}/accounting/categories`, { withCredentials: true }),
        axios.get(`${API}/accounting/vendors`, { withCredentials: true }).catch(() => ({ data: [] }))
      ]);
      setAccounts(accountsRes.data || []);
      setCategories(categoriesRes.data || []);
      setVendors(vendorsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load finance settings');
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

  // ============ ACCOUNT HANDLERS ============
  const [accountForm, setAccountForm] = useState({
    account_name: '',
    account_type: 'bank',
    bank_name: '',
    branch: '',
    account_number: '',
    ifsc_code: '',
    category: 'operating',
    opening_balance: 0,
    opening_balance_date: new Date().toISOString().split('T')[0],
    is_active: true
  });

  const openAccountDialog = (account = null) => {
    if (account) {
      setEditingAccount(account);
      setAccountForm({
        account_name: account.account_name || '',
        account_type: account.account_type || 'bank',
        bank_name: account.bank_name || '',
        branch: account.branch || '',
        account_number: account.account_number || '',
        ifsc_code: account.ifsc_code || '',
        category: account.category || 'operating',
        opening_balance: account.opening_balance || 0,
        opening_balance_date: account.opening_balance_date || new Date().toISOString().split('T')[0],
        is_active: account.is_active !== false
      });
    } else {
      setEditingAccount(null);
      setAccountForm({
        account_name: '',
        account_type: 'bank',
        bank_name: '',
        branch: '',
        account_number: '',
        ifsc_code: '',
        category: 'operating',
        opening_balance: 0,
        opening_balance_date: new Date().toISOString().split('T')[0],
        is_active: true
      });
    }
    setIsAccountDialogOpen(true);
  };

  const handleSaveAccount = async () => {
    if (!accountForm.account_name.trim()) {
      toast.error('Account name is required');
      return;
    }

    try {
      setSubmitting(true);
      if (editingAccount) {
        await axios.put(`${API}/accounting/accounts/${editingAccount.account_id}`, accountForm, { withCredentials: true });
        toast.success('Account updated');
      } else {
        await axios.post(`${API}/accounting/accounts`, accountForm, { withCredentials: true });
        toast.success('Account created');
      }
      setIsAccountDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save account');
    } finally {
      setSubmitting(false);
    }
  };

  // ============ CATEGORY HANDLERS ============
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    category_type: 'expense',
    parent_id: null,
    description: '',
    is_active: true
  });

  const openCategoryDialog = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name || '',
        category_type: category.category_type || 'expense',
        parent_id: category.parent_id || null,
        description: category.description || '',
        is_active: category.is_active !== false
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        category_type: 'expense',
        parent_id: null,
        description: '',
        is_active: true
      });
    }
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    try {
      setSubmitting(true);
      if (editingCategory) {
        await axios.put(`${API}/accounting/categories/${editingCategory.category_id}`, categoryForm, { withCredentials: true });
        toast.success('Category updated');
      } else {
        await axios.post(`${API}/accounting/categories`, categoryForm, { withCredentials: true });
        toast.success('Category created');
      }
      setIsCategoryDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  // ============ VENDOR HANDLERS ============
  const [vendorForm, setVendorForm] = useState({
    vendor_name: '',
    vendor_type: 'material',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    pan: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    notes: '',
    is_active: true
  });

  const openVendorDialog = (vendor = null) => {
    if (vendor) {
      setEditingVendor(vendor);
      setVendorForm({
        vendor_name: vendor.vendor_name || '',
        vendor_type: vendor.vendor_type || 'material',
        contact_person: vendor.contact_person || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        address: vendor.address || '',
        gstin: vendor.gstin || '',
        pan: vendor.pan || '',
        bank_account_name: vendor.bank_account_name || '',
        bank_account_number: vendor.bank_account_number || '',
        bank_ifsc: vendor.bank_ifsc || '',
        notes: vendor.notes || '',
        is_active: vendor.is_active !== false
      });
    } else {
      setEditingVendor(null);
      setVendorForm({
        vendor_name: '',
        vendor_type: 'material',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        gstin: '',
        pan: '',
        bank_account_name: '',
        bank_account_number: '',
        bank_ifsc: '',
        notes: '',
        is_active: true
      });
    }
    setIsVendorDialogOpen(true);
  };

  const handleSaveVendor = async () => {
    if (!vendorForm.vendor_name.trim()) {
      toast.error('Vendor name is required');
      return;
    }

    try {
      setSubmitting(true);
      if (editingVendor) {
        await axios.put(`${API}/accounting/vendors/${editingVendor.vendor_id}`, vendorForm, { withCredentials: true });
        toast.success('Vendor updated');
      } else {
        await axios.post(`${API}/accounting/vendors`, vendorForm, { withCredentials: true });
        toast.success('Vendor created');
      }
      setIsVendorDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save vendor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivateVendor = async (vendorId) => {
    if (!confirm('Are you sure you want to deactivate this vendor?')) return;
    
    try {
      await axios.delete(`${API}/accounting/vendors/${vendorId}`, { withCredentials: true });
      toast.success('Vendor deactivated');
      fetchData();
    } catch (error) {
      toast.error('Failed to deactivate vendor');
    }
  };

  const getVendorTypeIcon = (type) => {
    switch (type) {
      case 'material': return <Package className="w-4 h-4 text-blue-500" />;
      case 'service': return <Briefcase className="w-4 h-4 text-green-500" />;
      case 'contractor': return <HardHat className="w-4 h-4 text-amber-500" />;
      case 'technician': return <Wrench className="w-4 h-4 text-purple-500" />;
      default: return <Users className="w-4 h-4 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="finance-settings-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-600" />
          Finance Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage accounts, expense categories, and vendors
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <FolderTree className="w-4 h-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="vendors" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Vendors
          </TabsTrigger>
        </TabsList>

        {/* ACCOUNTS TAB */}
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <div>
                <CardTitle className="text-lg">Bank & Cash Accounts</CardTitle>
                <CardDescription>Manage your bank accounts and petty cash</CardDescription>
              </div>
              {hasPermission('finance.manage_accounts') && (
                <Button onClick={() => openAccountDialog()} data-testid="add-account-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Account
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Account Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Bank/Branch</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Current Balance</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {accounts.map((account) => (
                      <tr key={account.account_id} className="hover:bg-slate-50" data-testid={`account-row-${account.account_id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {account.account_type === 'bank' ? 
                              <Building2 className="w-4 h-4 text-blue-500" /> : 
                              <Wallet className="w-4 h-4 text-green-500" />
                            }
                            <span className="font-medium text-slate-900">{account.account_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="capitalize">{account.account_type}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 capitalize">{account.category?.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {account.bank_name && `${account.bank_name}${account.branch ? `, ${account.branch}` : ''}`}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          <span className={account.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(account.current_balance)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {account.is_active ? (
                            <Badge className="bg-green-100 text-green-700">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500">Inactive</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {hasPermission('finance.manage_accounts') && (
                            <Button variant="ghost" size="sm" onClick={() => openAccountDialog(account)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CATEGORIES TAB */}
        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <div>
                <CardTitle className="text-lg">Expense Categories</CardTitle>
                <CardDescription>Organize transactions by category</CardDescription>
              </div>
              {hasPermission('finance.manage_categories') && (
                <Button onClick={() => openCategoryDialog()} data-testid="add-category-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Category
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {categories.map((cat) => (
                      <tr key={cat.category_id} className="hover:bg-slate-50" data-testid={`category-row-${cat.category_id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FolderTree className="w-4 h-4 text-amber-500" />
                            <span className="font-medium text-slate-900">{cat.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="capitalize">{cat.category_type || 'expense'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{cat.description || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          {cat.is_active !== false ? (
                            <Badge className="bg-green-100 text-green-700">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500">Inactive</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {hasPermission('finance.manage_categories') && (
                            <Button variant="ghost" size="sm" onClick={() => openCategoryDialog(cat)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VENDORS TAB */}
        <TabsContent value="vendors" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <div>
                <CardTitle className="text-lg">Vendor Master</CardTitle>
                <CardDescription>Manage vendors, contractors, and service providers</CardDescription>
              </div>
              {hasPermission('finance.manage_vendors') && (
                <Button onClick={() => openVendorDialog()} data-testid="add-vendor-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Vendor
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4">
              {/* Search */}
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search vendors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vendor Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">GSTIN</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {vendors
                      .filter(v => !searchTerm || v.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((vendor) => (
                      <tr key={vendor.vendor_id} className="hover:bg-slate-50" data-testid={`vendor-row-${vendor.vendor_id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getVendorTypeIcon(vendor.vendor_type)}
                            <span className="font-medium text-slate-900">{vendor.vendor_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="capitalize">{vendor.vendor_type}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {vendor.contact_person && <p className="text-slate-900">{vendor.contact_person}</p>}
                          {vendor.phone && <p className="text-slate-500">{vendor.phone}</p>}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 font-mono">{vendor.gstin || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          {vendor.is_active !== false ? (
                            <Badge className="bg-green-100 text-green-700">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500">Inactive</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {hasPermission('finance.manage_vendors') && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => openVendorDialog(vendor)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                {vendor.is_active !== false && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleDeactivateVendor(vendor.vendor_id)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {vendors.length === 0 && (
                  <div className="p-8 text-center">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No vendors added yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Account Dialog */}
      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Account' : 'Add Account'}</DialogTitle>
            <DialogDescription>Configure bank or cash account details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Name *</Label>
                <Input
                  value={accountForm.account_name}
                  onChange={(e) => setAccountForm(p => ({ ...p, account_name: e.target.value }))}
                  placeholder="e.g., Bank of Baroda - Current"
                  data-testid="account-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select value={accountForm.account_type} onValueChange={(v) => setAccountForm(p => ({ ...p, account_type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="cash">Cash / Petty Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {accountForm.account_type === 'bank' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <Input
                      value={accountForm.bank_name}
                      onChange={(e) => setAccountForm(p => ({ ...p, bank_name: e.target.value }))}
                      placeholder="e.g., Bank of Baroda"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <Input
                      value={accountForm.branch}
                      onChange={(e) => setAccountForm(p => ({ ...p, branch: e.target.value }))}
                      placeholder="e.g., Main Branch"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input
                      value={accountForm.account_number}
                      onChange={(e) => setAccountForm(p => ({ ...p, account_number: e.target.value }))}
                      placeholder="Account number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>IFSC Code</Label>
                    <Input
                      value={accountForm.ifsc_code}
                      onChange={(e) => setAccountForm(p => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))}
                      placeholder="e.g., BARB0VJKALY"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Account Category</Label>
              <Select value={accountForm.category} onValueChange={(v) => setAccountForm(p => ({ ...p, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operating">Operating Account</SelectItem>
                  <SelectItem value="collection">Collection Account</SelectItem>
                  <SelectItem value="expense">Expense Account</SelectItem>
                  <SelectItem value="petty_cash">Petty Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Opening Balance</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                  <Input
                    type="number"
                    value={accountForm.opening_balance}
                    onChange={(e) => setAccountForm(p => ({ ...p, opening_balance: parseFloat(e.target.value) || 0 }))}
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Balance Date</Label>
                <Input
                  type="date"
                  value={accountForm.opening_balance_date}
                  onChange={(e) => setAccountForm(p => ({ ...p, opening_balance_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={accountForm.is_active}
                onCheckedChange={(v) => setAccountForm(p => ({ ...p, is_active: v }))}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAccountDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAccount} disabled={submitting} data-testid="save-account-btn">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingAccount ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Office Expenses"
                data-testid="category-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Category Type</Label>
              <Select value={categoryForm.category_type} onValueChange={(v) => setCategoryForm(p => ({ ...p, category_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="project">Project Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={categoryForm.description}
                onChange={(e) => setCategoryForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={categoryForm.is_active}
                onCheckedChange={(v) => setCategoryForm(p => ({ ...p, is_active: v }))}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCategory} disabled={submitting} data-testid="save-category-btn">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Dialog */}
      <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
            <DialogDescription>Vendor details for project finance and payments</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor Name *</Label>
                <Input
                  value={vendorForm.vendor_name}
                  onChange={(e) => setVendorForm(p => ({ ...p, vendor_name: e.target.value }))}
                  placeholder="e.g., ABC Interiors"
                  data-testid="vendor-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor Type</Label>
                <Select value={vendorForm.vendor_type} onValueChange={(v) => setVendorForm(p => ({ ...p, vendor_type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Material Vendor</SelectItem>
                    <SelectItem value="service">Service Vendor</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input
                  value={vendorForm.contact_person}
                  onChange={(e) => setVendorForm(p => ({ ...p, contact_person: e.target.value }))}
                  placeholder="Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={vendorForm.phone}
                  onChange={(e) => setVendorForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={vendorForm.email}
                onChange={(e) => setVendorForm(p => ({ ...p, email: e.target.value }))}
                placeholder="vendor@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={vendorForm.address}
                onChange={(e) => setVendorForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Full address"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>GSTIN</Label>
                <Input
                  value={vendorForm.gstin}
                  onChange={(e) => setVendorForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                  placeholder="29ABCDE1234F1Z5"
                  maxLength={15}
                />
              </div>
              <div className="space-y-2">
                <Label>PAN</Label>
                <Input
                  value={vendorForm.pan}
                  onChange={(e) => setVendorForm(p => ({ ...p, pan: e.target.value.toUpperCase() }))}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-slate-700 mb-3">Bank Details (for payments)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Account Name</Label>
                  <Input
                    value={vendorForm.bank_account_name}
                    onChange={(e) => setVendorForm(p => ({ ...p, bank_account_name: e.target.value }))}
                    placeholder="Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Account Number</Label>
                  <Input
                    value={vendorForm.bank_account_number}
                    onChange={(e) => setVendorForm(p => ({ ...p, bank_account_number: e.target.value }))}
                    placeholder="Number"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">IFSC</Label>
                  <Input
                    value={vendorForm.bank_ifsc}
                    onChange={(e) => setVendorForm(p => ({ ...p, bank_ifsc: e.target.value.toUpperCase() }))}
                    placeholder="IFSC"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={vendorForm.notes}
                onChange={(e) => setVendorForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any additional notes"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={vendorForm.is_active}
                onCheckedChange={(v) => setVendorForm(p => ({ ...p, is_active: v }))}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVendorDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveVendor} disabled={submitting} data-testid="save-vendor-btn">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingVendor ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceSettings;
