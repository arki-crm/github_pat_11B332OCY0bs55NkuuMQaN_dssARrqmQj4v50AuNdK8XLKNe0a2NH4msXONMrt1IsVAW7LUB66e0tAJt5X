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
  ChevronDown,
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
  GraduationCap,
  Wallet,
  Building2,
  Receipt,
  CreditCard,
  PieChart,
  CalendarCheck,
  CalendarRange,
  Gauge,
  RefreshCw,
  FileCheck,
  PiggyBank,
  TrendingUp,
  Banknote,
  FileUp,
  History,
  Database,
  Mail
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

const SIDEBAR_STATE_KEY = 'arkiflo_sidebar_collapsed';
const SIDEBAR_EXPANDED_KEY = 'arkiflo_sidebar_expanded_menus';

// Finance submenu items - only routes that exist
const financeSubItems = [
  { path: '/finance/founder-dashboard', label: 'Overview', icon: Gauge },
  { path: '/finance/project-finance', label: 'Project Finance', icon: FolderKanban },
  { path: '/finance/cashbook', label: 'Cash Book', icon: Wallet },
  { path: '/finance/liabilities', label: 'Liabilities', icon: FileText },
  { path: '/finance/expense-requests', label: 'Expense Requests', icon: FileCheck },
  { path: '/finance/receipts', label: 'Receipts', icon: Receipt },
  { path: '/finance/salaries', label: 'Salaries', icon: Banknote },
  { path: '/finance/pnl-snapshot', label: 'P&L Snapshot', icon: TrendingUp },
  { path: '/finance/reports', label: 'Reports', icon: BarChart3 },
  { path: '/finance/forecast', label: 'Forecast', icon: TrendingUp },
  { path: '/finance/budgets', label: 'Budgets', icon: PiggyBank },
  { path: '/finance/invoices', label: 'Invoices', icon: FileText },
  { path: '/finance/refunds', label: 'Refunds', icon: RefreshCw },
  { path: '/finance/payment-reminders', label: 'Payment Reminders', icon: Mail },
  { path: '/finance/recurring-transactions', label: 'Recurring', icon: RefreshCw },
  { path: '/finance/daily-closing', label: 'Daily Closing', icon: CalendarCheck },
  { path: '/finance/monthly-snapshot', label: 'Monthly Snapshot', icon: CalendarRange },
  { path: '/finance/settings', label: 'Settings', icon: Settings },
];

// CA (Chartered Accountant) - Read-only finance submenu
const caFinanceSubItems = [
  { path: '/finance/founder-dashboard', label: 'Overview', icon: Gauge },
  { path: '/finance/project-finance', label: 'Project Finance', icon: FolderKanban },
  { path: '/finance/cashbook', label: 'Cash Book', icon: Wallet },
  { path: '/finance/liabilities', label: 'Liabilities', icon: FileText },
  { path: '/finance/receipts', label: 'Receipts', icon: Receipt },
  { path: '/finance/pnl-snapshot', label: 'P&L Snapshot', icon: TrendingUp },
  { path: '/finance/reports', label: 'Reports', icon: BarChart3 },
  { path: '/admin/import-export', label: 'Export Data', icon: FileUp },
];

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

  // Finance parent menu item (for roles with finance access)
  const financeParentItem = { 
    path: '/finance', 
    label: 'Finance', 
    icon: Wallet, 
    isParent: true,
    children: financeSubItems
  };

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
        { path: '/academy', label: 'Academy', icon: GraduationCap },
        financeParentItem,
        { path: '/sales-manager', label: 'Sales Manager', icon: Target },
        { path: '/design-board', label: 'Design Board', icon: Palette },
        { path: '/design-manager', label: 'Design Manager', icon: ClipboardCheck },
        { path: '/production-ops', label: 'Production/Ops', icon: Truck },
        { path: '/ceo-dashboard', label: 'CEO View', icon: Crown },
        { path: '/reports', label: 'Reports', icon: BarChart3 },
        { path: '/admin/import-export', label: 'Import / Export', icon: FileUp },
        { path: '/admin/audit-trail', label: 'Audit Trail', icon: History },
        { path: '/admin/backup', label: 'Backup', icon: Database },
        { path: '/users', label: 'Users', icon: UserCog },
        { path: '/settings', label: 'Settings', icon: Settings },
        { path: '/settings/company-profile', label: 'Company Profile', icon: Building2 }
      ];

    // 2. PRE-SALES - Lead creation, qualification, handover (SEPARATE ROLE)
    case 'PreSales':
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/presales', label: 'Pre-Sales', icon: UserPlus },
        { path: '/leads', label: 'My Leads', icon: Users },
        { path: '/leads/create', label: 'Create Lead', icon: FileText },
        { path: '/academy', label: 'Academy', icon: GraduationCap },
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
        { path: '/academy', label: 'Academy', icon: GraduationCap },
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
        { path: '/academy', label: 'Academy', icon: GraduationCap },
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
        { path: '/academy', label: 'Academy', icon: GraduationCap },
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
        { path: '/academy', label: 'Academy', icon: GraduationCap },
        { path: '/reports', label: 'Reports', icon: BarChart3 },
        ...seniorManagerItems
      ];

    // 7. TECHNICIAN - Only assigned service requests
    case 'Technician':
      return [
        { path: '/service-requests', label: 'My Requests', icon: Wrench },
        { path: '/academy', label: 'Academy', icon: GraduationCap },
        ...commonItems
      ];

    // 8. ACCOUNTANT - Finance access
    case 'Accountant':
    case 'SeniorAccountant':
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...commonItems,
        financeParentItem,
        { path: '/reports', label: 'Reports', icon: BarChart3 }
      ];

    // 12. CHARTERED ACCOUNTANT - Read-only finance access for auditors
    case 'CharteredAccountant':
      // CA Finance parent menu item with restricted submenu
      const caFinanceParentItem = { 
        path: '/finance', 
        label: 'Finance', 
        icon: Wallet, 
        isParent: true,
        subItems: caFinanceSubItems
      };
      return [
        { path: '/finance/founder-dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...commonItems.filter(item => item.path === '/profile'), // Only profile, no calendar/meetings
        caFinanceParentItem
      ];

    // 13. FOUNDER - Full visibility, final override
    case 'Founder':
      return [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ...commonItems,
        financeParentItem,
        { path: '/ceo-dashboard', label: 'CEO View', icon: Crown },
        { path: '/reports', label: 'Reports', icon: BarChart3 }
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
  
  // Track expanded parent menus
  const [expandedMenus, setExpandedMenus] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(expandedMenus));
  }, [expandedMenus]);

  // Auto-expand Finance menu if on a finance route
  useEffect(() => {
    if (location.pathname.startsWith('/finance')) {
      setExpandedMenus(prev => ({ ...prev, '/finance': true }));
    }
  }, [location.pathname]);

  // Get role-specific navigation items with senior manager view permission
  const navItems = getRoleNavItems(user?.role, user?.senior_manager_view);

  const toggleMenu = (path) => {
    setExpandedMenus(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

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
        data-testid={`nav-${item.path.replace(/\//g, '-').replace(/^-/, '')}`}
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

  const ParentNavItem = ({ item }) => {
    const Icon = item.icon;
    const isExpanded = expandedMenus[item.path];
    const isAnyChildActive = item.children?.some(child => 
      location.pathname === child.path || location.pathname.startsWith(child.path + '/')
    );

    // For collapsed sidebar, show tooltip with submenu
    if (isCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => toggleMenu(item.path)}
              className={cn(
                "w-full flex items-center justify-center px-3 py-2.5 rounded-lg transition-all duration-200",
                "hover:bg-slate-100 group",
                isAnyChildActive && "bg-blue-50 text-blue-600"
              )}
              data-testid={`nav-${item.path.replace(/\//g, '-').replace(/^-/, '')}`}
            >
              <Icon 
                className={cn(
                  "w-5 h-5 flex-shrink-0 transition-colors",
                  isAnyChildActive ? "text-blue-600" : "text-slate-500 group-hover:text-slate-700"
                )} 
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-slate-900 text-white p-0">
            <div className="py-2">
              <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase">
                {item.label}
              </div>
              {item.children?.map(child => {
                const ChildIcon = child.icon;
                const isChildActive = location.pathname === child.path;
                return (
                  <NavLink
                    key={child.path}
                    to={child.placeholder ? '#' : child.path}
                    onClick={(e) => child.placeholder && e.preventDefault()}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                      isChildActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800",
                      child.placeholder && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <ChildIcon className="w-4 h-4" />
                    {child.label}
                    {child.placeholder && <span className="text-xs">(Soon)</span>}
                  </NavLink>
                );
              })}
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <div>
        <button
          onClick={() => toggleMenu(item.path)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
            "hover:bg-slate-100 group",
            isAnyChildActive && "bg-blue-50"
          )}
          data-testid={`nav-${item.path.replace(/\//g, '-').replace(/^-/, '')}`}
        >
          <Icon 
            className={cn(
              "w-5 h-5 flex-shrink-0 transition-colors",
              isAnyChildActive ? "text-blue-600" : "text-slate-500 group-hover:text-slate-700"
            )} 
          />
          <span className={cn(
            "text-sm font-medium transition-colors flex-1 text-left",
            isAnyChildActive ? "text-blue-600" : "text-slate-700"
          )}>
            {item.label}
          </span>
          <ChevronDown 
            className={cn(
              "w-4 h-4 text-slate-400 transition-transform duration-200",
              isExpanded && "rotate-180"
            )} 
          />
        </button>
        
        {/* Submenu */}
        <div className={cn(
          "overflow-hidden transition-all duration-200",
          isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="pl-4 py-1 space-y-0.5">
            {item.children?.map(child => {
              const ChildIcon = child.icon;
              const isChildActive = location.pathname === child.path;
              
              if (child.placeholder) {
                return (
                  <div
                    key={child.path}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 cursor-not-allowed"
                    title="Coming soon"
                  >
                    <ChildIcon className="w-4 h-4" />
                    <span className="text-sm">{child.label}</span>
                    <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">Soon</span>
                  </div>
                );
              }
              
              return (
                <NavLink
                  key={child.path}
                  to={child.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                    "hover:bg-slate-100 group",
                    isChildActive && "bg-blue-50 text-blue-600 hover:bg-blue-50",
                    !isChildActive && "text-slate-600"
                  )}
                  data-testid={`nav-${child.path.replace(/\//g, '-').replace(/^-/, '')}`}
                >
                  <ChildIcon 
                    className={cn(
                      "w-4 h-4 flex-shrink-0 transition-colors",
                      isChildActive ? "text-blue-600" : "text-slate-500 group-hover:text-slate-700"
                    )} 
                  />
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    isChildActive ? "text-blue-600" : "text-slate-700"
                  )}>
                    {child.label}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>
    );
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
            item.isParent ? (
              <ParentNavItem key={item.path} item={item} />
            ) : (
              <NavItem key={item.path} item={item} />
            )
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
