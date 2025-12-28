import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { LayoutDashboard, Users, FolderKanban, TrendingUp } from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();

  const stats = [
    { label: 'Active Projects', value: '12', icon: FolderKanban, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Leads', value: '48', icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Conversion Rate', value: '24%', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Welcome Section */}
      <div>
        <h1 
          className="text-3xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Welcome back, {user?.name?.split(' ')[0] || 'User'}
        </h1>
        <p className="text-slate-500 mt-1">
          Here's what's happening with your projects today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {stat.label}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Placeholder Content */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <LayoutDashboard className="w-5 h-5 text-blue-600" />
            Dashboard Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            <p>Dashboard content will be added in the next phase.</p>
            <p className="text-sm mt-2">This is a placeholder for the main dashboard view.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
