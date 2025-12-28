import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
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
  Bell, 
  CheckCheck, 
  Trash2,
  GitBranch,
  ListTodo,
  Clock,
  MessageSquare,
  Settings,
  Filter,
  Inbox
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Notification type icons
const TYPE_ICONS = {
  'stage-change': GitBranch,
  'task': ListTodo,
  'milestone': Clock,
  'comment': MessageSquare,
  'system': Settings
};

const TYPE_COLORS = {
  'stage-change': { bg: 'bg-blue-100', text: 'text-blue-600' },
  'task': { bg: 'bg-green-100', text: 'text-green-600' },
  'milestone': { bg: 'bg-orange-100', text: 'text-orange-600' },
  'comment': { bg: 'bg-purple-100', text: 'text-purple-600' },
  'system': { bg: 'bg-slate-100', text: 'text-slate-600' }
};

const TYPE_LABELS = {
  'stage-change': 'Stage Updates',
  'task': 'Tasks',
  'milestone': 'Milestones',
  'comment': 'Mentions',
  'system': 'System'
};

// Format relative time
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Notification Item Component
const NotificationItem = ({ notification, onMarkRead, onDelete, onClick }) => {
  const Icon = TYPE_ICONS[notification.type] || Bell;
  const colors = TYPE_COLORS[notification.type] || TYPE_COLORS.system;
  
  return (
    <div 
      className={cn(
        "flex items-start gap-3 p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors",
        !notification.is_read && "bg-blue-50/50"
      )}
      onClick={() => onClick(notification)}
    >
      {/* Icon */}
      <div className={cn("p-2 rounded-lg flex-shrink-0", colors.bg)}>
        <Icon className={cn("w-4 h-4", colors.text)} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={cn(
              "text-sm",
              !notification.is_read ? "font-semibold text-slate-900" : "text-slate-700"
            )}>
              {notification.title}
            </p>
            <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
              {notification.message}
            </p>
          </div>
          {!notification.is_read && (
            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
          )}
        </div>
        
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-slate-400">
            {formatRelativeTime(notification.created_at)}
          </span>
          <Badge variant="outline" className={cn("text-[10px]", colors.bg, colors.text)}>
            {TYPE_LABELS[notification.type] || notification.type}
          </Badge>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.is_read && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
          >
            <CheckCheck className="w-4 h-4" />
          </Button>
        )}
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
          onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('type', filter);
      
      const response = await axios.get(`${API_URL}/api/notifications?${params.toString()}`, { 
        withCredentials: true 
      });
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unread_count);
      setTotal(response.data.total);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (notificationId) => {
    try {
      await axios.put(`${API_URL}/api/notifications/${notificationId}/read`, {}, { 
        withCredentials: true 
      });
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.put(`${API_URL}/api/notifications/mark-all-read`, {}, { 
        withCredentials: true 
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await axios.delete(`${API_URL}/api/notifications/${notificationId}`, { 
        withCredentials: true 
      });
      const deletedNotif = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (deletedNotif && !deletedNotif.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setTotal(prev => Math.max(0, prev - 1));
    } catch (err) {
      toast.error('Failed to delete notification');
    }
  };

  const handleClearAll = async () => {
    try {
      await axios.delete(`${API_URL}/api/notifications/clear-all`, { 
        withCredentials: true 
      });
      setNotifications([]);
      setUnreadCount(0);
      setTotal(0);
      toast.success('All notifications cleared');
    } catch (err) {
      toast.error('Failed to clear notifications');
    }
  };

  const handleClick = async (notification) => {
    // Mark as read
    if (!notification.is_read) {
      await handleMarkRead(notification.id);
    }
    
    // Navigate to link
    if (notification.link_url) {
      navigate(notification.link_url);
    }
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="notifications-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 
            className="text-2xl font-bold tracking-tight text-slate-900"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Notifications
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'} • {total} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={handleClearAll}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Notifications</SelectItem>
                <SelectItem value="stage-change">Stage Updates</SelectItem>
                <SelectItem value="task">Tasks</SelectItem>
                <SelectItem value="milestone">Milestones</SelectItem>
                <SelectItem value="comment">Mentions</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="text-center py-16">
              <Inbox className="w-16 h-16 mx-auto mb-4 text-slate-200" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                You have no notifications yet
              </h3>
              <p className="text-sm text-slate-500">
                When you receive notifications, they&apos;ll appear here
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <NotificationItem 
                    key={notification.id}
                    notification={notification}
                    onMarkRead={handleMarkRead}
                    onDelete={handleDelete}
                    onClick={handleClick}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Notifications;
