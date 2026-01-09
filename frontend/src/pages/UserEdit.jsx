import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { cn } from '../lib/utils';
import axios from 'axios';
import { 
  User, 
  ArrowLeft, 
  Mail, 
  Phone, 
  Shield,
  Save,
  Camera,
  UserCheck,
  UserX,
  Clock,
  Key,
  RefreshCw,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// V1 SIMPLIFIED RBAC - 7 Core Roles
const ROLES = ['Admin', 'PreSales', 'SalesManager', 'Designer', 'DesignManager', 'ProductionOpsManager', 'Technician'];
const MANAGER_ALLOWED_ROLES = ['Designer', 'PreSales', 'Technician'];

// Avatar component with initials fallback
const UserAvatar = ({ user, size = 'lg', showEditOverlay = false, onClick }) => {
  const sizeClasses = {
    sm: 'w-12 h-12 text-lg',
    md: 'w-16 h-16 text-xl',
    lg: 'w-24 h-24 text-2xl'
  };
  
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };
  
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
  const colorIndex = user?.name ? user.name.charCodeAt(0) % colors.length : 0;
  
  return (
    <div className="relative group cursor-pointer" onClick={onClick}>
      {user?.picture ? (
        <img 
          src={user.picture} 
          alt={user.name} 
          className={cn("rounded-full object-cover", sizeClasses[size])}
        />
      ) : (
        <div className={cn(
          "rounded-full flex items-center justify-center text-white font-medium",
          sizeClasses[size],
          colors[colorIndex]
        )}>
          {user?.initials || getInitials(user?.name)}
        </div>
      )}
      {showEditOverlay && (
        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera className="w-6 h-6 text-white" />
        </div>
      )}
    </div>
  );
};

const UserEdit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: '',
    status: '',
    picture: ''
  });
  const [errors, setErrors] = useState({});
  
  // Permissions state
  const [availablePermissions, setAvailablePermissions] = useState({});
  const [defaultRolePermissions, setDefaultRolePermissions] = useState({});
  const [userPermissions, setUserPermissions] = useState([]);
  const [customPermissions, setCustomPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  
  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // Check permissions
  const isAdmin = user?.role === 'Admin';
  const isManager = ['Manager', 'SalesManager', 'DesignManager', 'ProductionOpsManager'].includes(user?.role);

  useEffect(() => {
    if (user && !['Admin', 'Manager', 'SalesManager', 'DesignManager', 'ProductionOpsManager'].includes(user.role)) {
      navigate('/dashboard');
      return;
    }
    fetchUser();
    if (isAdmin) {
      fetchAvailablePermissions();
    }
  }, [user, id, navigate]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/users/${id}`, { 
        withCredentials: true 
      });
      setTargetUser(response.data);
      setFormData({
        name: response.data.name || '',
        phone: response.data.phone || '',
        role: response.data.role || 'Designer',
        status: response.data.status || 'Active',
        picture: response.data.picture || ''
      });
      setUserPermissions(response.data.permissions || []);
      setCustomPermissions(response.data.custom_permissions || false);
    } catch (err) {
      console.error('Error fetching user:', err);
      toast.error('Failed to load user');
      navigate('/users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailablePermissions = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/permissions/available`, {
        withCredentials: true
      });
      setAvailablePermissions(response.data.permission_groups || {});
      setDefaultRolePermissions(response.data.default_role_permissions || {});
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  };

  const canEditField = (field) => {
    if (!targetUser) return false;
    
    if (isAdmin) {
      return true;
    }
    
    if (isManager) {
      if (['Admin', 'Manager'].includes(targetUser.role)) return false;
      if (field === 'status') return false;
      if (field === 'role') return true;
      return true;
    }
    
    return false;
  };

  const getAvailableRoles = () => {
    if (isAdmin) return ROLES;
    if (isManager) return MANAGER_ALLOWED_ROLES;
    return [];
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    try {
      setSaving(true);
      
      const updateData = {
        name: formData.name.trim()
      };
      
      if (formData.phone !== targetUser.phone) {
        updateData.phone = formData.phone.trim() || null;
      }
      
      if (canEditField('role') && formData.role !== targetUser.role) {
        updateData.role = formData.role;
      }
      
      if (canEditField('status') && formData.status !== targetUser.status) {
        updateData.status = formData.status;
      }
      
      if (formData.picture !== targetUser.picture) {
        updateData.picture = formData.picture || null;
      }
      
      await axios.put(`${API_URL}/api/users/${id}`, updateData, { 
        withCredentials: true 
      });
      
      toast.success('User updated successfully');
      navigate('/users');
    } catch (err) {
      console.error('Error updating user:', err);
      toast.error(err.response?.data?.detail || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handlePermissionToggle = (permissionId) => {
    setUserPermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(p => p !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
    setCustomPermissions(true);
  };

  const handleSavePermissions = async () => {
    try {
      setSavingPermissions(true);
      await axios.put(`${API_URL}/api/users/${id}/permissions`, {
        permissions: userPermissions,
        custom_permissions: customPermissions
      }, { withCredentials: true });
      toast.success('Permissions updated successfully');
    } catch (err) {
      console.error('Error saving permissions:', err);
      toast.error(err.response?.data?.detail || 'Failed to update permissions');
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleResetToRoleDefaults = async () => {
    try {
      setSavingPermissions(true);
      await axios.post(`${API_URL}/api/users/${id}/permissions/reset-to-role`, {}, { 
        withCredentials: true 
      });
      // Refresh user data
      const response = await axios.get(`${API_URL}/api/users/${id}`, { withCredentials: true });
      setUserPermissions(response.data.permissions || []);
      setCustomPermissions(false);
      toast.success('Permissions reset to role defaults');
    } catch (err) {
      console.error('Error resetting permissions:', err);
      toast.error(err.response?.data?.detail || 'Failed to reset permissions');
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    try {
      setResettingPassword(true);
      await axios.post(`${API_URL}/api/auth/reset-password`, {
        email: targetUser.email,
        new_password: newPassword
      }, { withCredentials: true });
      toast.success('Password reset successfully');
      setNewPassword('');
    } catch (err) {
      console.error('Error resetting password:', err);
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get effective permissions (custom or role defaults)
  const getEffectivePermissions = () => {
    if (customPermissions) {
      return userPermissions;
    }
    return defaultRolePermissions[formData.role] || [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="text-center py-12 text-slate-500">
        User not found
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="user-edit-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/users')}
          className="text-slate-600"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Users
        </Button>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {isAdmin && <TabsTrigger value="permissions">Permissions</TabsTrigger>}
          {isAdmin && <TabsTrigger value="security">Security</TabsTrigger>}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <User className="w-5 h-5 text-blue-600" />
                Edit User Profile
              </CardTitle>
              <CardDescription>
                Update user information and role
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Avatar & Basic Info */}
                <div className="flex items-start gap-6 pb-6 border-b border-slate-100">
                  <UserAvatar 
                    user={{ ...targetUser, name: formData.name, picture: formData.picture }} 
                    size="lg" 
                    showEditOverlay={canEditField('picture')}
                  />
                  <div className="flex-1 space-y-1">
                    <h3 className="text-lg font-semibold text-slate-900">{targetUser.name}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {targetUser.email}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last login: {formatDate(targetUser.last_login)}
                    </p>
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                    Display Name <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="name"
                      placeholder="Enter display name"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className={`pl-9 ${errors.name ? 'border-red-500' : ''}`}
                      disabled={!canEditField('name')}
                    />
                  </div>
                  {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-slate-700">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter phone number"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="pl-9"
                      disabled={!canEditField('phone')}
                    />
                  </div>
                </div>

                {/* Role */}
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm font-medium text-slate-700">Role</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10 pointer-events-none" />
                    <Select 
                      value={formData.role} 
                      onValueChange={(value) => handleChange('role', value)}
                      disabled={!canEditField('role')}
                    >
                      <SelectTrigger className="pl-9">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableRoles().map(role => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-medium text-slate-700">Status</Label>
                  <div className="flex items-center gap-4">
                    {canEditField('status') ? (
                      <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">
                            <span className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-green-600" />
                              Active
                            </span>
                          </SelectItem>
                          <SelectItem value="Inactive">
                            <span className="flex items-center gap-2">
                              <UserX className="w-4 h-4 text-slate-400" />
                              Inactive
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={cn("text-sm",
                        formData.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      )}>
                        {formData.status === 'Active' ? <UserCheck className="w-4 h-4 mr-1" /> : <UserX className="w-4 h-4 mr-1" />}
                        {formData.status}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => navigate('/users')}>Cancel</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
                    {saving ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab (Admin Only) */}
        {isAdmin && (
          <TabsContent value="permissions">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Key className="w-5 h-5 text-blue-600" />
                  User Permissions
                </CardTitle>
                <CardDescription>
                  Configure granular access permissions for this user
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Custom vs Role Defaults */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Permission Mode</p>
                    <p className="text-sm text-slate-500">
                      {customPermissions ? 'Using custom permissions' : `Using ${formData.role} role defaults`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleResetToRoleDefaults} disabled={savingPermissions}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reset to Role Defaults
                  </Button>
                </div>

                {/* Permission Groups */}
                <div className="space-y-6">
                  {Object.entries(availablePermissions).map(([groupKey, group]) => (
                    <div key={groupKey} className="border border-slate-200 rounded-lg p-4">
                      <h4 className="font-semibold text-slate-900 mb-3">{group.name}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.permissions.map((perm) => {
                          const isChecked = customPermissions 
                            ? userPermissions.includes(perm.id)
                            : getEffectivePermissions().includes(perm.id);
                          
                          return (
                            <div key={perm.id} className="flex items-start gap-3 p-2 rounded hover:bg-slate-50">
                              <Checkbox
                                id={perm.id}
                                checked={isChecked}
                                onCheckedChange={() => handlePermissionToggle(perm.id)}
                              />
                              <div className="flex-1">
                                <Label htmlFor={perm.id} className="text-sm font-medium text-slate-700 cursor-pointer">
                                  {perm.name}
                                </Label>
                                <p className="text-xs text-slate-500">{perm.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save Permissions */}
                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <Button onClick={handleSavePermissions} className="bg-blue-600 hover:bg-blue-700" disabled={savingPermissions}>
                    {savingPermissions ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Permissions</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Security Tab (Admin Only) */}
        {isAdmin && (
          <TabsContent value="security">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Lock className="w-5 h-5 text-blue-600" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Manage user password and authentication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Password Reset */}
                <div className="p-4 border border-slate-200 rounded-lg">
                  <h4 className="font-semibold text-slate-900 mb-2">Reset Password</h4>
                  <p className="text-sm text-slate-500 mb-4">Set a new password for this user</p>
                  <div className="flex gap-3">
                    <Input
                      type="password"
                      placeholder="Enter new password (min 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleResetPassword} 
                      variant="outline"
                      disabled={resettingPassword || !newPassword}
                    >
                      {resettingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Reset Password'}
                    </Button>
                  </div>
                </div>

                {/* User Info */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold text-slate-900 mb-2">Account Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500">Email:</span> <span className="text-slate-900">{targetUser.email}</span></p>
                    <p><span className="text-slate-500">Created:</span> <span className="text-slate-900">{formatDate(targetUser.created_at)}</span></p>
                    <p><span className="text-slate-500">Last Login:</span> <span className="text-slate-900">{formatDate(targetUser.last_login)}</span></p>
                    <p><span className="text-slate-500">Status:</span> <Badge variant="outline" className={targetUser.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}>{targetUser.status}</Badge></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default UserEdit;
