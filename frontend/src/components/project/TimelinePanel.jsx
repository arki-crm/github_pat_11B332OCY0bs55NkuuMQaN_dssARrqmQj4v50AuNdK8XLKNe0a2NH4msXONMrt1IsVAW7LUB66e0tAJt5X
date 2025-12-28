import React from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Check, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { STAGES, STAGE_COLORS, groupTimelineByStage } from './utils';

export const TimelinePanel = ({ timeline, currentStage }) => {
  const groupedTimeline = groupTimelineByStage(timeline);
  const currentStageIndex = STAGES.indexOf(currentStage);

  // Format date for display (DD/MM/YYYY)
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusDotColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'delayed':
        return 'bg-red-500';
      default:
        return 'bg-slate-300';
    }
  };

  return (
    <div data-testid="timeline-panel">
      <h3 className="text-sm font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Milestones
      </h3>
      
      <ScrollArea className="h-[450px] pr-2">
        <div className="space-y-4">
          {STAGES.map((stage, stageIndex) => {
            const milestones = groupedTimeline[stage] || [];
            const isCurrentStage = stage === currentStage;
            const isCompletedStage = stageIndex < currentStageIndex;
            const stageColors = STAGE_COLORS[stage] || STAGE_COLORS['Design Finalization'];
            
            return (
              <div 
                key={stage} 
                className={cn(
                  "rounded-lg border p-3",
                  isCurrentStage ? `${stageColors.bg} border-current ${stageColors.text}` :
                  isCompletedStage ? "bg-green-50 border-green-200" : "bg-white border-slate-200"
                )}
                data-testid={`milestone-group-${stage.replace(/\s+/g, '-').toLowerCase()}`}
              >
                {/* Stage Header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center",
                    isCompletedStage ? "bg-green-500" : 
                    isCurrentStage ? stageColors.bg.replace('100', '500') : "bg-slate-200"
                  )}>
                    {isCompletedStage ? (
                      <Check className="w-3 h-3 text-white" />
                    ) : (
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        isCurrentStage ? "bg-white" : "bg-slate-400"
                      )} />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    isCurrentStage ? stageColors.text : 
                    isCompletedStage ? "text-green-700" : "text-slate-500"
                  )}>
                    {stage}
                  </span>
                  {isCurrentStage && (
                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded ml-auto">
                      Current
                    </span>
                  )}
                </div>
                
                {/* Milestones */}
                <div className="space-y-1.5 ml-2.5 pl-4 border-l border-slate-200">
                  {milestones.map((item, index) => (
                    <div 
                      key={item.id || index} 
                      className="flex items-start gap-2 py-1"
                      data-testid={`milestone-${item.id}`}
                    >
                      {/* Status dot */}
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1",
                        getStatusDotColor(item.status)
                      )} />
                      
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "text-xs block",
                          item.status === 'completed' ? 'text-slate-700' : 
                          item.status === 'delayed' ? 'text-red-600 font-medium' : 'text-slate-500'
                        )}>
                          {item.title}
                        </span>
                        
                        {/* Date display */}
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          {item.expectedDate && (
                            <span className={cn(
                              "text-[10px]",
                              item.status === 'delayed' ? 'text-red-500' : 'text-slate-400'
                            )}>
                              Expected: {formatDisplayDate(item.expectedDate)}
                            </span>
                          )}
                          {item.completedDate && (
                            <span className="text-[10px] text-green-600">
                              Completed: {formatDisplayDate(item.completedDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {milestones.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-1">No milestones</p>
                  )}
                </div>
              </div>
            );
          })};
        </div>
      </ScrollArea>
    </div>
  );
};
