import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { cn } from '../lib/utils';
import axios from 'axios';
import { 
  User, 
  Mail, 
  Phone, 
  Shield,
  Save,
  Camera,
  Clock,
  Calendar,
  Settings,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ROLE_COLORS = {
  Admin: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  Manager: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  Designer: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  PreSales: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  Trainee: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' }
};

// Avatar component with edit overlay
const ProfileAvatar = ({ user, onImageChange }) => {
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };
  
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
  const colorIndex = user?.name ? user.name.charCodeAt(0) % colors.length : 0;
  
  return (
    <div className="relative group">
      {user?.picture ? (
        <img 
          src={user.picture} 
          alt={user.name} 
          className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg"
        />
      ) : (
        <div className={cn(
          "w-28 h-28 rounded-full flex items-center justify-center text-white text-3xl font-medium border-4 border-white shadow-lg",
          colors[colorIndex]
        )}>
          {user?.initials || getInitials(user?.name)}
        </div>
      )}
      <button
        type="button"
        onClick={onImageChange}
        className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      >
        <Camera className="w-8 h-8 text-white" />
      </button>
    </div>
  );
};

const Profile = () => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    picture: ''
  });
  const [showAvatarInput, setShowAvatarInput] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/profile`, { 
        withCredentials: true 
      });
      setProfile(response.data);
      setFormData({
        name: response.data.name || '',
        phone: response.data.phone || '',
        picture: response.data.picture || ''
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
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
      
      const updateData = {};
      
      if (formData.name !== profile.name) {
        updateData.name = formData.name.trim();
      }
      
      if (formData.phone !== profile.phone) {
        updateData.phone = formData.phone.trim() || null;
      }
      
      if (formData.picture !== profile.picture) {
        updateData.picture = formData.picture || null;
      }
      
      if (Object.keys(updateData).length === 0) {
        toast.info('No changes to save');
        return;
      }
      
      await axios.put(`${API_URL}/api/profile`, updateData, { 
        withCredentials: true 
      });
      
      toast.success('Profile updated successfully');
      fetchProfile();
      
      // Refresh auth context if available
      if (refreshUser) {
        refreshUser();
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error(err.response?.data?.detail || 'Failed to update profile');
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

  const roleColors = ROLE_COLORS[profile?.role] || ROLE_COLORS.Designer;

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="profile-page">
      {/* Header */}
      <div>
        <h1 
          className="text-2xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          My Profile
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage your personal information and preferences
        </p>
      </div>

      {/* Profile Card */}
      <Card className="border-slate-200 overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-blue-600 to-blue-400" />
        
        <CardContent className="pt-0 relative">
          {/* Avatar */}
          <div className="-mt-14 mb-4">
            <ProfileAvatar 
              user={{ ...profile, name: formData.name, picture: formData.picture }} 
              onImageChange={() => setShowAvatarInput(!showAvatarInput)}
            />
          </div>
          
          {/* User Info */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{profile?.name}</h2>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Mail className="w-4 h-4" />
                {profile?.email}
              </p>
            </div>
            <Badge 
              variant="outline" 
              className={cn(
                "text-sm font-medium px-3 py-1",
                roleColors.bg, 
                roleColors.text, 
                roleColors.border
              )}
            >
              <Shield className="w-4 h-4 mr-1" />
              {profile?.role}
            </Badge>
          </div>
          
          {/* Meta Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg">
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Last Login</p>
                <p className="text-sm font-medium text-slate-700">{formatDate(profile?.last_login)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg">
                <Calendar className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Member Since</p>
                <p className="text-sm font-medium text-slate-700">{formatDate(profile?.created_at)}</p>
              </div>
            </div>
          </div>
          
          <Separator className="my-6" />
          
          {/* Edit Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Settings className="w-4 h-4 text-blue-600" />
              Edit Profile
            </h3>
            
            {/* Avatar URL (toggle) */}
            {showAvatarInput && (
              <div className="space-y-2 p-4 bg-blue-50 rounded-lg">
                <Label htmlFor="picture" className="text-sm font-medium text-slate-700">
                  Avatar Image URL
                </Label>
                <div className="relative">
                  <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="picture"
                    type="url"
                    placeholder="Enter image URL or leave empty for initials"
                    value={formData.picture}
                    onChange={(e) => handleChange('picture', e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Your Google profile picture is used by default. Enter a URL to override it.
                </p>
              </div>
            )}
            
            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                Display Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={`pl-9 ${errors.name ? 'border-red-500' : ''}`}
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
                  placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Email (Read-only) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="email"
                  value={profile?.email || ''}
                  className="pl-9 bg-slate-50"
                  disabled
                />
              </div>
              <p className="text-xs text-slate-400">
                Email cannot be changed. It&apos;s linked to your Google account.
              </p>
            </div>

            {/* Role (Read-only) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Role
              </Label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={profile?.role || ''}
                  className="pl-9 bg-slate-50"
                  disabled
                />
              </div>
              <p className="text-xs text-slate-400">
                Contact an administrator to change your role.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700"
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

      {/* Authentication Card */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-900">
            Authentication
          </CardTitle>
          <CardDescription>
            You&apos;re signed in with Google OAuth
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Google Account</p>
                <p className="text-xs text-slate-500">{profile?.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled>
              <ExternalLink className="w-4 h-4 mr-2" />
              Connected
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Your account is secured with Google authentication. No password is stored.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
