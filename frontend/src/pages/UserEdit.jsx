import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Core roles + Phase 15 Design Workflow roles
const ROLES = ['Admin', 'Manager', 'DesignManager', 'ProductionManager', 'OperationsLead', 'Designer', 'PreSales', 'HybridDesigner', 'Trainee'];
const MANAGER_ALLOWED_ROLES = ['Designer', 'PreSales', 'HybridDesigner', 'Trainee'];

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

  // Check permissions
  const isAdmin = user?.role === 'Admin';
  const isManager = user?.role === 'Manager';

  useEffect(() => {
    if (user && !['Admin', 'Manager'].includes(user.role)) {
      navigate('/dashboard');
      return;
    }
    fetchUser();
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
    } catch (err) {
      console.error('Error fetching user:', err);
      toast.error('Failed to load user');
      navigate('/users');
    } finally {
      setLoading(false);
    }
  };

  const canEditField = (field) => {
    if (!targetUser) return false;
    
    if (isAdmin) {
      return true;
    }
    
    if (isManager) {
      // Manager cannot edit Admin or other Managers
      if (['Admin', 'Manager'].includes(targetUser.role)) return false;
      
      // Manager cannot change status
      if (field === 'status') return false;
      
      // Manager can only assign certain roles
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
    <div className="max-w-2xl mx-auto space-y-6" data-testid="user-edit-page">
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

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <User className="w-5 h-5 text-blue-600" />
            Edit User
          </CardTitle>
          <CardDescription>
            Update user information and permissions
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
                <p className="text-xs text-slate-400">
                  Created: {formatDate(targetUser.created_at)}
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
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
                Phone Number
              </Label>
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
              <Label htmlFor="role" className="text-sm font-medium text-slate-700">
                Role
              </Label>
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
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!canEditField('role') && (
                <p className="text-xs text-slate-400">
                  You don&apos;t have permission to change this user&apos;s role
                </p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm font-medium text-slate-700">
                Status
              </Label>
              <div className="flex items-center gap-4">
                {canEditField('status') ? (
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => handleChange('status', value)}
                  >
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
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-sm",
                      formData.status === 'Active' 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    )}
                  >
                    {formData.status === 'Active' ? (
                      <UserCheck className="w-4 h-4 mr-1" />
                    ) : (
                      <UserX className="w-4 h-4 mr-1" />
                    )}
                    {formData.status}
                  </Badge>
                )}
              </div>
              {!canEditField('status') && (
                <p className="text-xs text-slate-400">
                  Only admins can change user status
                </p>
              )}
            </div>

            {/* Avatar URL */}
            <div className="space-y-2">
              <Label htmlFor="picture" className="text-sm font-medium text-slate-700">
                Avatar URL
              </Label>
              <div className="relative">
                <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="picture"
                  type="url"
                  placeholder="Enter avatar image URL"
                  value={formData.picture}
                  onChange={(e) => handleChange('picture', e.target.value)}
                  className="pl-9"
                  disabled={!canEditField('picture')}
                />
              </div>
              <p className="text-xs text-slate-500">
                Leave empty to use auto-generated initials avatar
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/users')}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 flex-1"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserEdit;
