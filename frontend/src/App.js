import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthCallback from './components/auth/AuthCallback';
import AppLayout from './components/layout/AppLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PreSales from './pages/PreSales';
import PreSalesDetail from './pages/PreSalesDetail';
import CreatePreSalesLead from './pages/CreatePreSalesLead';
import Leads from './pages/Leads';
import LeadDetails from './pages/LeadDetails';
import CreateLead from './pages/CreateLead';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Academy from './pages/Academy';
import Settings from './pages/Settings';
import Users from './pages/Users';
import UserInvite from './pages/UserInvite';
import UserEdit from './pages/UserEdit';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Calendar from './pages/Calendar';
import Meetings from './pages/Meetings';
import Reports from './pages/Reports';
import RevenueReport from './pages/RevenueReport';
import ProjectReport from './pages/ProjectReport';
import LeadReport from './pages/LeadReport';
import DesignerReport from './pages/DesignerReport';
import DelayReport from './pages/DelayReport';

// V1 Simplified Design Workflow Pages
import DesignBoard from './pages/DesignBoard';
import DesignManagerDashboard from './pages/DesignManagerDashboard';
import ValidationPipeline from './pages/ValidationPipeline';
import CEODashboard from './pages/CEODashboard';
import OperationsDashboard from './pages/OperationsDashboard';
import SalesManagerDashboard from './pages/SalesManagerDashboard';
import ProductionOpsDashboard from './pages/ProductionOpsDashboard';

// Warranty & Service Module
import Warranty from './pages/Warranty';
import ServiceRequests from './pages/ServiceRequests';
import ServiceRequestDetails from './pages/ServiceRequestDetails';
import Technicians from './pages/Technicians';

// Finance/Accounting Module
import CashBook from './pages/CashBook';
import ProjectFinance from './pages/ProjectFinance';
import ProjectFinanceDetail from './pages/ProjectFinanceDetail';
import FounderDashboard from './pages/FounderDashboard';
import DailyClosing from './pages/DailyClosing';
import MonthlySnapshot from './pages/MonthlySnapshot';
import Receipts from './pages/Receipts';

import './App.css';

// Router component that handles session_id detection synchronously
const AppRouter = () => {
  const location = useLocation();

  // Check URL fragment (not query params) for session_id SYNCHRONOUSLY
  // This prevents race conditions by processing new session_id FIRST before checking existing session_token
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected Routes with Layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/presales" element={<PreSales />} />
        <Route path="/presales/create" element={<CreatePreSalesLead />} />
        <Route path="/presales/:id" element={<PreSalesDetail />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/leads/create" element={<CreateLead />} />
        <Route path="/leads/:id" element={<LeadDetails />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetails />} />
        <Route path="/academy" element={<Academy />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/users" element={<Users />} />
        <Route path="/users/invite" element={<UserInvite />} />
        <Route path="/users/:id" element={<UserEdit />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/revenue" element={<RevenueReport />} />
        <Route path="/reports/projects" element={<ProjectReport />} />
        <Route path="/reports/leads" element={<LeadReport />} />
        <Route path="/reports/designers" element={<DesignerReport />} />
        <Route path="/reports/delays" element={<DelayReport />} />
        
        {/* V1 Simplified Role-Based Routes */}
        <Route path="/design-board" element={<DesignBoard />} />
        <Route path="/design-manager" element={<DesignManagerDashboard />} />
        <Route path="/validation-pipeline" element={<ValidationPipeline />} />
        <Route path="/operations" element={<OperationsDashboard />} />
        <Route path="/sales-manager" element={<SalesManagerDashboard />} />
        <Route path="/production-ops" element={<ProductionOpsDashboard />} />
        <Route path="/ceo-dashboard" element={<CEODashboard />} />
        
        {/* Warranty & Service Routes */}
        <Route path="/warranty" element={<Warranty />} />
        <Route path="/service-requests" element={<ServiceRequests />} />
        <Route path="/service-requests/:id" element={<ServiceRequestDetails />} />
        <Route path="/technicians" element={<Technicians />} />
        
        {/* Finance/Accounting Routes */}
        <Route path="/finance/founder-dashboard" element={<FounderDashboard />} />
        <Route path="/finance/cashbook" element={<CashBook />} />
        <Route path="/finance/receipts" element={<Receipts />} />
        <Route path="/finance/project-finance" element={<ProjectFinance />} />
        <Route path="/finance/project-finance/:projectId" element={<ProjectFinanceDetail />} />
        <Route path="/finance/daily-closing" element={<DailyClosing />} />
        <Route path="/finance/monthly-snapshot" element={<MonthlySnapshot />} />
      </Route>

      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
