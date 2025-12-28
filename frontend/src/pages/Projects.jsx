import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { FolderKanban, ArrowRight } from 'lucide-react';

const Projects = () => {
  const navigate = useNavigate();

  // Sample project placeholders
  const sampleProjects = [
    { id: '1', name: 'Modern Apartment Renovation', status: 'In Progress' },
    { id: '2', name: 'Villa Interior Design', status: 'Planning' },
    { id: '3', name: 'Office Space Makeover', status: 'Completed' },
  ];

  return (
    <div className="space-y-6" data-testid="projects-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 
            className="text-3xl font-bold tracking-tight text-slate-900"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Projects
          </h1>
          <p className="text-slate-500 mt-1">
            Manage and track all your interior design projects.
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="create-project-btn">
          + New Project
        </Button>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <FolderKanban className="w-5 h-5 text-blue-600" />
            Project List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sampleProjects.map((project) => (
              <div 
                key={project.id}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
                data-testid={`project-item-${project.id}`}
              >
                <div>
                  <p className="font-medium text-slate-900">{project.name}</p>
                  <p className="text-sm text-slate-500">{project.status}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </div>
            ))}
          </div>
          <div className="text-center py-6 text-slate-500 border-t border-slate-200 mt-6">
            <p className="text-sm">Full project management will be implemented in the next phase.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Projects;
