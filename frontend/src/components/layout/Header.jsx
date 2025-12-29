import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { Search, LogOut, Bell, User, X, Loader2, FileText, Users, FolderKanban, Shield, Wrench, UserPlus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { ScrollArea } from '../ui/scroll-area';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ROLE_BADGE_STYLES = {
  Admin: 'bg-purple-100 text-purple-700',
  Manager: 'bg-blue-100 text-blue-700',
  Designer: 'bg-pink-100 text-pink-700',
  PreSales: 'bg-orange-100 text-orange-700',
  Trainee: 'bg-green-100 text-green-700'
};

// Search result type icons
const SEARCH_ICONS = {
  lead: Users,
  presales: UserPlus,
  project: FolderKanban,
  warranty: Shield,
  service_request: Wrench,
  technician: User
};

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  
  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    fetchUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/notifications/unread-count`, { 
        withCredentials: true 
      });
      setUnreadCount(response.data.unread_count);
    } catch (err) {
      // Silently fail - user might not be authenticated yet
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const response = await axios.get(`${API_URL}/api/notifications?limit=10`, { 
        withCredentials: true 
      });
      setNotifications(response.data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleNotificationsToggle = (open) => {
    setNotificationsOpen(open);
    if (open) {
      fetchNotifications();
    }
  };

  // Smart search function
  const performSearch = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    try {
      setSearchLoading(true);
      setSearchOpen(true);
      
      const response = await axios.get(`${API_URL}/api/global-search`, {
        params: { q: query },
        withCredentials: true
      });
      
      setSearchResults(response.data || []);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Debounce search
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  };

  const handleSearchResultClick = (result) => {
    setSearchOpen(false);
    setSearchQuery('');
    
    switch (result.type) {
      case 'lead':
        navigate(`/leads/${result.id}`);
        break;
      case 'presales':
        navigate(`/presales/${result.id}`);
        break;
      case 'project':
        navigate(`/projects/${result.id}`);
        break;
      case 'warranty':
        navigate(`/projects/${result.project_id}?tab=warranty`);
        break;
      case 'service_request':
        navigate(`/service-requests/${result.id}`);
        break;
      case 'technician':
        navigate(`/technicians`);
        break;
      default:
        break;
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <header 
      className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50"
      data-testid="header"
    >
      <div className="h-full px-6 flex items-center justify-between">
        {/* Global Search Bar */}
        <div className="flex-1 max-w-md" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search leads, projects, PIDs, customers..."
              className="pl-9 pr-9 bg-slate-50 border-slate-200 focus:bg-white"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
              data-testid="global-search-input"
            />
            {searchQuery && (
              <button 
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            {/* Search Results Dropdown */}
            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm">No matching records found</p>
                    <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-80">
                    <div className="py-2">
                      {searchResults.map((result, index) => {
                        const Icon = SEARCH_ICONS[result.type] || FileText;
                        return (
                          <button
                            key={`${result.type}-${result.id}-${index}`}
                            onClick={() => handleSearchResultClick(result)}
                            className="w-full px-4 py-2.5 flex items-start gap-3 hover:bg-slate-50 text-left transition-colors"
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                              result.type === 'lead' && 'bg-blue-100',
                              result.type === 'presales' && 'bg-orange-100',
                              result.type === 'project' && 'bg-purple-100',
                              result.type === 'warranty' && 'bg-green-100',
                              result.type === 'service_request' && 'bg-amber-100',
                              result.type === 'technician' && 'bg-pink-100'
                            )}>
                              <Icon className={cn(
                                "w-4 h-4",
                                result.type === 'lead' && 'text-blue-600',
                                result.type === 'presales' && 'text-orange-600',
                                result.type === 'project' && 'text-purple-600',
                                result.type === 'warranty' && 'text-green-600',
                                result.type === 'service_request' && 'text-amber-600',
                                result.type === 'technician' && 'text-pink-600'
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 text-sm truncate">{result.title}</p>
                              <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                              {result.pid && (
                                <span className="inline-block mt-1 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{result.pid}</span>
                              )}
                            </div>
                            <span className="text-[10px] uppercase text-slate-400 font-medium flex-shrink-0">
                              {result.type.replace('_', ' ')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        </div>

        {/* User Profile Section */}
        <div className="flex items-center gap-3">
          {/* Notifications Dropdown */}
          <Popover open={notificationsOpen} onOpenChange={handleNotificationsToggle}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="relative h-9 w-9 p-0"
                data-testid="notifications-bell"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <ScrollArea className="max-h-80">
                {loadingNotifications ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-500">
                    <Bell className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        className={cn(
                          "px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors",
                          !notification.read && "bg-blue-50/50"
                        )}
                        onClick={() => {
                          setNotificationsOpen(false);
                          if (notification.link) navigate(notification.link);
                        }}
                      >
                        <p className="text-sm text-slate-900">{notification.message}</p>
                        <p className="text-xs text-slate-500 mt-1">{formatRelativeTime(notification.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="px-4 py-2 border-t border-slate-100">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    setNotificationsOpen(false);
                    navigate('/notifications');
                  }}
                >
                  View all notifications
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Role Badge */}
          {user?.role && (
            <span 
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                ROLE_BADGE_STYLES[user.role] || 'bg-slate-100 text-slate-700'
              )}
              data-testid="role-badge"
            >
              {user.role}
            </span>
          )}

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="relative h-9 w-9 rounded-full"
                data-testid="user-menu-trigger"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.picture} alt={user?.name} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-medium">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-slate-900">
                    {user?.name}
                  </p>
                  <p className="text-xs leading-none text-slate-500">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => navigate('/profile')}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                <span>My Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate('/notifications')}
                className="cursor-pointer"
              >
                <Bell className="mr-2 h-4 w-4" />
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="ml-auto text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                data-testid="logout-button"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
