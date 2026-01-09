import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { cn } from '../lib/utils';
import axios from 'axios';
import { 
  Users as UsersIcon, 
  Search, 
  Plus, 
  MoreVertical, 
  Edit, 
  UserCheck, 
  UserX,
  Trash2,
  Filter,
  Mail,
  Phone,
  Shield,
  Clock,
  Key,
  UserPlus,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// V1 SIMPLIFIED RBAC - 6 Core Roles Only
const ROLES = ['Admin', 'PreSales', 'SalesManager', 'Designer', 'DesignManager', 'ProductionOpsManager'];
const ROLE_COLORS = {
  Admin: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  PreSales: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  SalesManager: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  Designer: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' },
  DesignManager: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  ProductionOpsManager: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' }
};

// Avatar component with initials fallback
const UserAvatar = ({ user, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  };
  
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };
  
  if (user?.picture) {
    return (
      <img 
        src={user.picture} 
        alt={user.name} 
        className={cn("rounded-full object-cover", sizeClasses[size])}
      />
    );
  }
  
  // Generate color based on name
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
  const colorIndex = user?.name ? user.name.charCodeAt(0) % colors.length : 0;
  
  return (
    <div className={cn(
      "rounded-full flex items-center justify-center text-white font-medium",
      sizeClasses[size],
      colors[colorIndex]
    )}>
      {user?.initials || getInitials(user?.name)}
    </div>
  );
};

const Users = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Redirect non-admin/manager users
  useEffect(() => {
    if (user && !['Admin', 'Manager'].includes(user.role)) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchUsers();
  }, [statusFilter, roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      
      const response = await axios.get(`${API_URL}/api/users?${params.toString()}`, { 
        withCredentials: true 
      });
      setUsers(response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (targetUser) => {
    try {
      setActionLoading(true);
      await axios.put(`${API_URL}/api/users/${targetUser.user_id}/status`, {}, { 
        withCredentials: true 
      });
      toast.success(`User ${targetUser.status === 'Active' ? 'deactivated' : 'activated'} successfully`);
      fetchUsers();
    } catch (err) {
      console.error('Error toggling status:', err);
      toast.error(err.response?.data?.detail || 'Failed to update user status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      setActionLoading(true);
      await axios.delete(`${API_URL}/api/users/${selectedUser.user_id}`, { 
        withCredentials: true 
      });
      toast.success('User deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error(err.response?.data?.detail || 'Failed to delete user');
    } finally {
      setActionLoading(false);
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

  // Filter users by search query
  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query);
  });

  // Check if current user can edit target user
  const canEdit = (targetUser) => {
    if (user?.role === 'Admin') return true;
    if (user?.role === 'Manager') {
      return ['Designer', 'PreSales', 'Trainee'].includes(targetUser.role);
    }
    return false;
  };

  // Check if current user can delete target user
  const canDelete = (targetUser) => {
    return user?.role === 'Admin' && targetUser.user_id !== user.user_id;
  };

  // Check if current user can toggle status
  const canToggleStatus = (targetUser) => {
    return user?.role === 'Admin' && targetUser.user_id !== user.user_id;
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 
            className="text-2xl font-bold tracking-tight text-slate-900"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            User Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage team members, roles, and permissions
          </p>
        </div>
        {user?.role === 'Admin' && (
          <Button 
            onClick={() => navigate('/users/invite')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Invite User
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map(role => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-blue-600" />
            Team Members ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <UsersIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No users found</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="py-3 px-2 text-xs font-medium text-slate-500 uppercase tracking-wide">User</th>
                    <th className="py-3 px-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Role</th>
                    <th className="py-3 px-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="py-3 px-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Last Login</th>
                    <th className="py-3 px-2 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const roleColors = ROLE_COLORS[u.role] || ROLE_COLORS.Designer;
                    
                    return (
                      <tr 
                        key={u.user_id} 
                        className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      >
                        {/* User Info */}
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={u} size="md" />
                            <div>
                              <p className="font-medium text-slate-900 text-sm">{u.name}</p>
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {u.email}
                              </p>
                              {u.phone && (
                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {u.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        
                        {/* Role */}
                        <td className="py-3 px-2">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs font-medium",
                              roleColors.bg, 
                              roleColors.text, 
                              roleColors.border
                            )}
                          >
                            <Shield className="w-3 h-3 mr-1" />
                            {u.role}
                          </Badge>
                        </td>
                        
                        {/* Status */}
                        <td className="py-3 px-2">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              u.status === 'Active' 
                                ? 'bg-green-50 text-green-700 border-green-200' 
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            )}
                          >
                            {u.status === 'Active' ? (
                              <UserCheck className="w-3 h-3 mr-1" />
                            ) : (
                              <UserX className="w-3 h-3 mr-1" />
                            )}
                            {u.status}
                          </Badge>
                        </td>
                        
                        {/* Last Login */}
                        <td className="py-3 px-2">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(u.last_login)}
                          </span>
                        </td>
                        
                        {/* Actions */}
                        <td className="py-3 px-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEdit(u) && (
                                <DropdownMenuItem onClick={() => navigate(`/users/${u.user_id}`)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit User
                                </DropdownMenuItem>
                              )}
                              {canToggleStatus(u) && (
                                <DropdownMenuItem onClick={() => handleToggleStatus(u)}>
                                  {u.status === 'Active' ? (
                                    <>
                                      <UserX className="w-4 h-4 mr-2" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-4 h-4 mr-2" />
                                      Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                              {canDelete(u) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-red-600"
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete User
                                  </DropdownMenuItem>
                                </>
                              )}
                              {!canEdit(u) && !canToggleStatus(u) && (
                                <DropdownMenuItem disabled>
                                  No actions available
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedUser?.name}</strong>? 
              This action cannot be undone and will remove all their sessions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              disabled={actionLoading}
            >
              {actionLoading ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
