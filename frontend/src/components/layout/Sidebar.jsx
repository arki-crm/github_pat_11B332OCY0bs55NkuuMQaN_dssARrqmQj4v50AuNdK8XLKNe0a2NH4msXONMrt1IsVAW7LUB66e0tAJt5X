import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FolderKanban,
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
  Truck,
  Target,
  FileText,
  Shield,
  Wrench,
  HardHat,
  GraduationCap
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

const SIDEBAR_STATE_KEY = 'arkiflo_sidebar_collapsed';

// ============ V1 SIMPLIFIED RBAC - 6 CORE ROLES ============
// Each role sees ONLY their relevant items - minimal, clean navigation

const getRoleNavItems = (role, hasSeniorManagerView = false) => {
  // Common items for all roles
  const commonItems = [
    { path: '/calendar', label: 'Calendar', icon: Calendar },
    { path: '/meetings', label: 'Meetings', icon: CalendarDays },
    { path: '/profile', label: 'My Profile', icon: User }
  ];

  // Senior Manager View - adds read-only access to all dashboards
  const seniorManagerItems = hasSeniorManagerView ? [
    { path: '/sales-manager', label: 'Sales View', icon: Target, readOnly: true },
    { path: '/design-manager', label: 'Design View', icon: ClipboardCheck, readOnly: true },
    { path: '/production-ops', label: 'Production View', icon: Truck, readOnly: true },
    { path: '/ceo-dashboard', label: 'CEO View', icon: Crown, readOnly: true }
  ] : [];

  switch (role) {
    // 1. ADMIN - Full access to everything
    case 'Admin':
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...commonItems,
        { path: '/presales', label: 'Pre-Sales', icon: UserPlus },
        { path: '/leads', label: 'Leads', icon: Users },
        { path: '/projects', label: 'Projects', icon: FolderKanban },
        { path: '/warranty', label: 'Warranty', icon: Shield },
        { path: '/service-requests', label: 'Service Requests', icon: Wrench },
        { path: '/technicians', label: 'Technicians', icon: HardHat },
        { path: '/sales-manager', label: 'Sales Manager', icon: Target },
        { path: '/design-board', label: 'Design Board', icon: Palette },
        { path: '/design-manager', label: 'Design Manager', icon: ClipboardCheck },
        { path: '/production-ops', label: 'Production/Ops', icon: Truck },
        { path: '/ceo-dashboard', label: 'CEO View', icon: Crown },
        { path: '/reports', label: 'Reports', icon: BarChart3 },
        { path: '/users', label: 'Users', icon: UserCog },
        { path: '/settings', label: 'Settings', icon: Settings }
      ];

    // 2. PRE-SALES - Lead creation, qualification, handover (SEPARATE ROLE)
    case 'PreSales':
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/presales', label: 'Pre-Sales', icon: UserPlus },
        { path: '/leads', label: 'My Leads', icon: Users },
        { path: '/leads/create', label: 'Create Lead', icon: FileText },
        ...commonItems,
        { path: '/reports', label: 'Reports', icon: BarChart3 },
        ...seniorManagerItems
      ];

    // 3. SALES MANAGER - All leads not booked, funnel, reassign
    case 'SalesManager':
      return [
        { path: '/sales-manager', label: 'Sales Dashboard', icon: LayoutDashboard },
        { path: '/leads', label: 'All Leads', icon: Users },
        { path: '/projects', label: 'Projects', icon: FolderKanban },
        { path: '/warranty', label: 'Warranty', icon: Shield },
        { path: '/service-requests', label: 'Service Requests', icon: Wrench },
        ...commonItems,
        { path: '/reports', label: 'Reports', icon: BarChart3 },
        ...seniorManagerItems
      ];

    // 4. DESIGNER - Assigned leads/projects, sales + design stages
    case 'Designer':
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...commonItems,
        { path: '/leads', label: 'My Leads', icon: Users },
        { path: '/projects', label: 'My Projects', icon: FolderKanban },
        { path: '/design-board', label: 'Design Board', icon: Palette },
        { path: '/reports', label: 'Reports', icon: BarChart3 },
        ...seniorManagerItems
      ];

    // 5. DESIGN MANAGER - All designers' tasks, delays, bottlenecks
    case 'DesignManager':
      return [
        { path: '/design-manager', label: 'My Dashboard', icon: LayoutDashboard },
        ...commonItems,
        { path: '/projects', label: 'All Projects', icon: FolderKanban },
        { path: '/design-board', label: 'Design Board', icon: Palette },
        { path: '/reports', label: 'Reports', icon: BarChart3 },
        ...seniorManagerItems
      ];

    // 6. PRODUCTION/OPS MANAGER - Validation, production, delivery, handover
    case 'ProductionOpsManager':
      return [
        { path: '/production-ops', label: 'My Dashboard', icon: LayoutDashboard },
        ...commonItems,
        { path: '/projects', label: 'Projects', icon: FolderKanban },
        { path: '/warranty', label: 'Warranty', icon: Shield },
        { path: '/service-requests', label: 'Service Requests', icon: Wrench },
        { path: '/technicians', label: 'Technicians', icon: HardHat },
        { path: '/reports', label: 'Reports', icon: BarChart3 },
        ...seniorManagerItems
      ];

    // 7. TECHNICIAN - Only assigned service requests
    case 'Technician':
      return [
        { path: '/service-requests', label: 'My Requests', icon: Wrench },
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

  // Get role-specific navigation items with senior manager view permission
  const navItems = getRoleNavItems(user?.role, user?.senior_manager_view);

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
