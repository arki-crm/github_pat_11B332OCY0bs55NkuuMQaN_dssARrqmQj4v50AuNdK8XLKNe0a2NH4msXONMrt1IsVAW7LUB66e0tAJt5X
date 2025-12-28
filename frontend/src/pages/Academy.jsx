import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { GraduationCap } from 'lucide-react';

const Academy = () => {
  return (
    <div className="space-y-6" data-testid="academy-page">
      <div>
        <h1 
          className="text-3xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Academy
        </h1>
        <p className="text-slate-500 mt-1">
          Training resources and learning materials for your team.
        </p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            Learning Center
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            <p>Academy module will be implemented in the next phase.</p>
            <p className="text-sm mt-2">Access training videos, documentation, and skill assessments.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Academy;
