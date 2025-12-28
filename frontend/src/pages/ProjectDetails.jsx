import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, FolderKanban } from 'lucide-react';

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="space-y-6" data-testid="project-details-page">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/projects')}
          className="text-slate-600 hover:text-slate-900"
          data-testid="back-to-projects-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>
      </div>

      <div>
        <h1 
          className="text-3xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Project Details
        </h1>
        <p className="text-slate-500 mt-1">
          Project ID: {id}
        </p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <FolderKanban className="w-5 h-5 text-blue-600" />
            Project Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            <p>Detailed project view will be implemented in the next phase.</p>
            <p className="text-sm mt-2">View project timeline, tasks, documents, and team assignments.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectDetails;
