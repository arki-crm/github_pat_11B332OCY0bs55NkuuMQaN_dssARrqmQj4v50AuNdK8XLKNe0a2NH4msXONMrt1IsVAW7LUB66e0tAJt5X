import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users } from 'lucide-react';

const Leads = () => {
  return (
    <div className="space-y-6" data-testid="leads-page">
      <div>
        <h1 
          className="text-3xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Leads
        </h1>
        <p className="text-slate-500 mt-1">
          Track and manage your potential clients.
        </p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Users className="w-5 h-5 text-blue-600" />
            Lead Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            <p>Lead management module will be implemented in the next phase.</p>
            <p className="text-sm mt-2">Capture, qualify, and convert leads into projects.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Leads;
