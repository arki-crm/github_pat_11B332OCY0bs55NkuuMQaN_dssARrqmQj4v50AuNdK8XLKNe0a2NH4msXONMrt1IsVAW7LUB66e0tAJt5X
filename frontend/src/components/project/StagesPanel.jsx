import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { STAGES, STAGE_COLORS } from './utils';

export const StagesPanel = ({ currentStage, onStageChange, canChangeStage, isUpdating }) => {
  const currentIndex = STAGES.indexOf(currentStage);

  return (
    <div data-testid="stages-panel">
      <h3 className="text-sm font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Project Stage
      </h3>
      
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200" />
        
        <div className="space-y-3">
          {STAGES.map((stage, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const stageColors = STAGE_COLORS[stage];
            
            return (
              <button
                key={stage}
                onClick={() => canChangeStage && !isUpdating && onStageChange(stage)}
                disabled={!canChangeStage || isUpdating}
                className={cn(
                  "relative flex items-center gap-3 w-full p-3 rounded-lg transition-all text-left",
                  canChangeStage && !isUpdating ? "cursor-pointer hover:bg-slate-50" : "cursor-default",
                  isCurrent && "ring-2 ring-offset-2",
                  isCurrent && stageColors.ring
                )}
                data-testid={`stage-${stage.replace(/\s+/g, '-').toLowerCase()}`}
              >
                {/* Circle indicator */}
                <div className={cn(
                  "relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2",
                  isCompleted ? "bg-green-500 border-green-500" :
                  isCurrent ? `${stageColors.bg} border-current ${stageColors.text}` :
                  "bg-white border-slate-300"
                )}>
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : isCurrent ? (
                    <div className={cn("w-2 h-2 rounded-full", stageColors.bg.replace('100', '500'))} />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                  )}
                </div>
                
                {/* Label */}
                <div className="flex-1">
                  <span className={cn(
                    "text-sm font-medium",
                    isCurrent ? stageColors.text : isCompleted ? "text-slate-700" : "text-slate-500"
                  )}>
                    {stage}
                  </span>
                  {isCurrent && (
                    <p className="text-xs text-slate-500 mt-0.5">Current stage</p>
                  )}
                </div>
                
                {isUpdating && isCurrent && (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      {!canChangeStage && (
        <p className="text-xs text-slate-500 mt-4 text-center">
          You don&apos;t have permission to change the stage
        </p>
      )}
    </div>
  );
};
