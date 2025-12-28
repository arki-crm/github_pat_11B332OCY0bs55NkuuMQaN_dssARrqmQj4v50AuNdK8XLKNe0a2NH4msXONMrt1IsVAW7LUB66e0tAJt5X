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
  ChevronRight
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

const SIDEBAR_STATE_KEY = 'arkiflo_sidebar_collapsed';

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

  const navItems = [
    { 
      path: '/dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      roles: ['Admin', 'Manager', 'PreSales', 'Designer']
    },
    { 
      path: '/presales', 
      label: 'Pre-Sales', 
      icon: UserPlus,
      roles: ['Admin', 'Manager', 'PreSales']
    },
    { 
      path: '/leads', 
      label: 'Leads', 
      icon: Users,
      roles: ['Admin', 'Manager']
    },
    { 
      path: '/projects', 
      label: 'Projects', 
      icon: FolderKanban,
      roles: ['Admin', 'Manager', 'Designer']
    },
    { 
      path: '/academy', 
      label: 'Academy', 
      icon: GraduationCap,
      roles: ['Admin']
    },
    { 
      path: '/settings', 
      label: 'Settings', 
      icon: Settings,
      roles: ['Admin']
    }
  ];

  const filteredNavItems = navItems.filter(item => 
    item.roles.includes(user?.role)
  );

  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path || 
      (item.path === '/projects' && location.pathname.startsWith('/projects/'));

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
          {filteredNavItems.map((item) => (
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
