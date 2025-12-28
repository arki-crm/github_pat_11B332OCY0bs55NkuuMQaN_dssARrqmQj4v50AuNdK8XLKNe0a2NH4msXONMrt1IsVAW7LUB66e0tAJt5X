import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Role-based access control configuration
const ROLE_PERMISSIONS = {
  Admin: ['dashboard', 'presales', 'leads', 'projects', 'project-details', 'academy', 'settings'],
  Manager: ['dashboard', 'presales', 'leads', 'projects', 'project-details'],
  PreSales: ['dashboard', 'presales'],
  Designer: ['dashboard', 'projects', 'project-details']
};

const getRouteKey = (pathname) => {
  if (pathname === '/dashboard') return 'dashboard';
  if (pathname === '/presales') return 'presales';
  if (pathname === '/leads') return 'leads';
  if (pathname === '/projects') return 'projects';
  if (pathname.startsWith('/projects/')) return 'project-details';
  if (pathname === '/academy') return 'academy';
  if (pathname === '/settings') return 'settings';
  return null;
};

const ProtectedRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" data-testid="loading-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  const routeKey = getRouteKey(location.pathname);
  const userPermissions = ROLE_PERMISSIONS[user.role] || [];

  if (routeKey && !userPermissions.includes(routeKey)) {
    // Show access denied toast and redirect to dashboard
    toast.error('Access Denied', {
      description: `You don't have permission to access this page.`
    });
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
