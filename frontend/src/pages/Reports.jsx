import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  BarChart3,
  TrendingUp,
  FolderKanban,
  Users,
  UserCircle,
  Clock,
  ArrowRight
} from 'lucide-react';

const reportCards = [
  {
    id: 'revenue',
    title: 'Revenue Forecast',
    description: 'Revenue projections, pending collections, and stage-wise breakdown',
    icon: TrendingUp,
    color: 'bg-emerald-500',
    path: '/reports/revenue',
    roles: ['Admin', 'Manager']
  },
  {
    id: 'projects',
    title: 'Project Health',
    description: 'Active projects, delay status, and completion tracking',
    icon: FolderKanban,
    color: 'bg-blue-500',
    path: '/reports/projects',
    roles: ['Admin', 'Manager']
  },
  {
    id: 'leads',
    title: 'Lead Conversion',
    description: 'Lead analytics, conversion rates, and source performance',
    icon: Users,
    color: 'bg-purple-500',
    path: '/reports/leads',
    roles: ['Admin', 'Manager', 'PreSales']
  },
  {
    id: 'designers',
    title: 'Designer Performance',
    description: 'Individual performance, milestones, and revenue contribution',
    icon: UserCircle,
    color: 'bg-amber-500',
    path: '/reports/designers',
    roles: ['Admin', 'Manager', 'Designer']
  },
  {
    id: 'delays',
    title: 'Delay Analytics',
    description: 'Delay patterns, stage analysis, and trend tracking',
    icon: Clock,
    color: 'bg-red-500',
    path: '/reports/delays',
    roles: ['Admin', 'Manager']
  }
];

const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Filter reports based on user role
  const accessibleReports = reportCards.filter(report => 
    report.roles.includes(user?.role)
  );

  if (accessibleReports.length === 0) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          Reports & Analytics
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Insights and analytics for your business
        </p>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accessibleReports.map((report) => (
          <Card 
            key={report.id}
            className="border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => navigate(report.path)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-lg ${report.color}`}>
                  <report.icon className="h-6 w-6 text-white" />
                </div>
                <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
              </div>
              <CardTitle className="text-lg mt-3">{report.title}</CardTitle>
              <CardDescription className="text-sm">
                {report.description}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Quick Stats Preview */}
      {user?.role === 'Admin' || user?.role === 'Manager' ? (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Reports Available</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{accessibleReports.length}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Your Role</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{user?.role}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Reports;
