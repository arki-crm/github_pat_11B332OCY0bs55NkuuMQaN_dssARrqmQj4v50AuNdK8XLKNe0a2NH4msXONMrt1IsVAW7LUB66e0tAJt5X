import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Settings as SettingsIcon, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLES = ['Admin', 'Manager', 'PreSales', 'Designer'];

const ROLE_BADGE_STYLES = {
  Admin: 'bg-purple-100 text-purple-700',
  Manager: 'bg-blue-100 text-blue-700',
  Designer: 'bg-pink-100 text-pink-700',
  PreSales: 'bg-orange-100 text-orange-700'
};

const Settings = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/auth/users`, {
        withCredentials: true
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingUserId(userId);
    try {
      await axios.put(`${API}/auth/users/${userId}/role`, {
        role: newRole
      }, {
        withCredentials: true
      });
      
      // Update local state
      setUsers(users.map(user => 
        user.user_id === userId ? { ...user, role: newRole } : user
      ));
      
      toast.success('Role updated successfully');
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 
          className="text-3xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Settings
        </h1>
        <p className="text-slate-500 mt-1">
          Manage users and system settings.
        </p>
      </div>

      {/* User Management Section */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Users className="w-5 h-5 text-blue-600" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No users found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div 
                  key={user.user_id}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-white"
                  data-testid={`user-row-${user.user_id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                      {user.picture ? (
                        <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium text-slate-600">
                          {user.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.user_id, value)}
                      disabled={updatingUserId === user.user_id}
                    >
                      <SelectTrigger 
                        className="w-32"
                        data-testid={`role-select-${user.user_id}`}
                      >
                        <SelectValue>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE_STYLES[user.role]}`}>
                            {user.role}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE_STYLES[role]}`}>
                              {role}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {updatingUserId === user.user_id && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Settings Placeholder */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <SettingsIcon className="w-5 h-5 text-blue-600" />
            System Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            <p>Additional system settings will be implemented in the next phase.</p>
            <p className="text-sm mt-2">Configure integrations, notifications, and company preferences.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
