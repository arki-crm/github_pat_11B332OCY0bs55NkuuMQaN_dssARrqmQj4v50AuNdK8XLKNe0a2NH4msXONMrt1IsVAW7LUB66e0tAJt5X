import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FolderKanban,
  GraduationCap,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCog,
  User,
  Calendar,
  CalendarDays,
  BarChart3,
  Palette,
  ClipboardCheck,
  Crown,
  Truck
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

const SIDEBAR_STATE_KEY = 'arkiflo_sidebar_collapsed';

// Strict role-based navigation - each role sees ONLY their relevant items
const getRoleNavItems = (role) => {
  const commonItems = [
    { path: '/calendar', label: 'Calendar', icon: Calendar },
    { path: '/meetings', label: 'Meetings', icon: CalendarDays },
    { path: '/profile', label: 'My Profile', icon: User }
  ];

  switch (role) {
    case 'Admin':
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...commonItems,
        { path: '/presales', label: 'Pre-Sales', icon: UserPlus },
        { path: '/leads', label: 'Leads', icon: Users },
        { path: '/projects', label: 'Projects', icon: FolderKanban },
        { path: '/design-board', label: 'Design Board', icon: Palette },
        { path: '/design-manager', label: 'Design Manager', icon: ClipboardCheck },
        { path: '/validation-pipeline', label: 'Validation', icon: ClipboardCheck },
        { path: '/operations', label: 'Operations', icon: Truck },
        { path: '/ceo-dashboard', label: 'CEO View', icon: Crown },
        { path: '/reports', label: 'Reports', icon: BarChart3 },
        { path: '/users', label: 'Users', icon: UserCog },
        { path: '/academy', label: 'Academy', icon: GraduationCap },
        { path: '/settings', label: 'Settings', icon: Settings }
      ];

    case 'Manager':
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...commonItems,
        { path: '/presales', label: 'Pre-Sales', icon: UserPlus },
        { path: '/leads', label: 'Leads', icon: Users },
        { path: '/projects', label: 'Projects', icon: FolderKanban },
        { path: '/design-board', label: 'Design Board', icon: Palette },
        { path: '/design-manager', label: 'Design Manager', icon: ClipboardCheck },
        { path: '/validation-pipeline', label: 'Validation', icon: ClipboardCheck },
        { path: '/operations', label: 'Operations', icon: Truck },
        { path: '/reports', label: 'Reports', icon: BarChart3 },
        { path: '/users', label: 'Users', icon: UserCog }
      ];

    case 'DesignManager':
      // Design Manager lands on their dashboard - NO access to general dashboard
      return [
        { path: '/design-manager', label: 'My Dashboard', icon: LayoutDashboard },
        ...commonItems,
        { path: '/projects', label: 'Projects', icon: FolderKanban },
        { path: '/design-board', label: 'Design Board', icon: Palette },
        { path: '/validation-pipeline', label: 'Validation', icon: ClipboardCheck },
        { path: '/reports', label: 'Reports', icon: BarChart3 }
      ];

    case 'ProductionManager':
      // Production Manager lands on validation pipeline - NO access to design areas
      return [
        { path: '/validation-pipeline', label: 'My Dashboard', icon: LayoutDashboard },
        ...commonItems,
        { path: '/projects', label: 'Projects', icon: FolderKanban },
        { path: '/operations', label: 'Operations', icon: Truck }
      ];

    case 'OperationsLead':
      // Operations Lead lands on operations dashboard - NO access to design/validation
      return [
        { path: '/operations', label: 'My Dashboard', icon: LayoutDashboard },
        ...commonItems,
        { path: '/projects', label: 'Projects', icon: FolderKanban }
      ];

    case 'Designer':
    case 'HybridDesigner':
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...commonItems,
        { path: '/projects', label: 'Projects', icon: FolderKanban },
        { path: '/design-board', label: 'Design Board', icon: Palette },
        { path: '/reports', label: 'Reports', icon: BarChart3 },
        ...(role === 'HybridDesigner' ? [{ path: '/presales', label: 'Pre-Sales', icon: UserPlus }] : [])
      ];

    case 'PreSales':
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...commonItems,
        { path: '/presales', label: 'Pre-Sales', icon: UserPlus },
        { path: '/reports', label: 'Reports', icon: BarChart3 }
      ];

    case 'Trainee':
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...commonItems
      ];

    default:
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...commonItems
      ];
  }
};

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Get role-specific navigation items
  const navItems = getRoleNavItems(user?.role);

  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path || 
      (item.path === '/projects' && location.pathname.startsWith('/projects/')) ||
      (item.path === '/users' && location.pathname.startsWith('/users/')) ||
      (item.path === '/leads' && location.pathname.startsWith('/leads/')) ||
      (item.path === '/reports' && location.pathname.startsWith('/reports/'));

    const content = (
      <NavLink
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
          "hover:bg-slate-100 group",
          isActive && "bg-blue-50 text-blue-600 hover:bg-blue-50",
          !isActive && "text-slate-600"
        )}
        data-testid={`nav-${item.path.replace('/', '')}`}
      >
        <Icon 
          className={cn(
            "w-5 h-5 flex-shrink-0 transition-colors",
            isActive ? "text-blue-600" : "text-slate-500 group-hover:text-slate-700"
          )} 
        />
        {!isCollapsed && (
          <span className={cn(
            "text-sm font-medium transition-colors",
            isActive ? "text-blue-600" : "text-slate-700"
          )}>
            {item.label}
          </span>
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-slate-900 text-white">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <TooltipProvider>
      <aside 
        className={cn(
          "h-screen bg-slate-50/50 backdrop-blur-xl border-r border-slate-200",
          "flex flex-col sidebar-transition",
          isCollapsed ? "w-16" : "w-64"
        )}
        data-testid="sidebar"
      >
        {/* Logo Section */}
        <div className={cn(
          "h-14 border-b border-slate-200 flex items-center",
          isCollapsed ? "justify-center px-2" : "px-4"
        )}>
          {isCollapsed ? (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-semibold text-slate-900 text-lg tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Arkiflo
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </nav>

        {/* Collapse Button */}
        <div className="p-3 border-t border-slate-200">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
              "text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            )}
            data-testid="sidebar-toggle"
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 mx-auto" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
};

export default Sidebar;
