import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { UserPlus } from 'lucide-react';

const PreSales = () => {
  return (
    <div className="space-y-6" data-testid="presales-page">
      <div>
        <h1 
          className="text-3xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Pre-Sales
        </h1>
        <p className="text-slate-500 mt-1">
          Manage your pre-sales activities and client inquiries.
        </p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <UserPlus className="w-5 h-5 text-blue-600" />
            Pre-Sales Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            <p>Pre-Sales module will be implemented in the next phase.</p>
            <p className="text-sm mt-2">Track inquiries, schedule consultations, and manage client communications.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PreSales;
