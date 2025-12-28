import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const AppLayout = () => {
  return (
    <div className="flex h-screen bg-white" data-testid="app-layout">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header />
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-slate-50/50">
          <div className="max-w-7xl mx-auto p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
