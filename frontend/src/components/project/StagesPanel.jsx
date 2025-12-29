import React, { useState } from 'react';
import { Check, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { STAGES, STAGE_COLORS } from './utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

export const StagesPanel = ({ currentStage, onStageChange, canChangeStage, isUpdating, userRole }) => {
  const currentIndex = STAGES.indexOf(currentStage);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, targetStage: null });
  
  // Check if stage is in the past
  const isPastStage = (stage) => {
    const stageIndex = STAGES.indexOf(stage);
    return stageIndex < currentIndex;
  };
  
  // Check if this is the next valid stage
  const isNextStage = (stage) => {
    const stageIndex = STAGES.indexOf(stage);
    return stageIndex === currentIndex + 1;
  };
  
  // Can click on a stage
  const canClickStage = (stage) => {
    if (!canChangeStage || isUpdating) return false;
    const stageIndex = STAGES.indexOf(stage);
    if (stageIndex === currentIndex) return false; // Current stage
    if (stageIndex < currentIndex) return userRole === 'Admin'; // Only Admin can rollback
    return true; // Future stages allowed
  };
  
  const handleStageClick = (stage) => {
    if (!canClickStage(stage)) return;
    setConfirmDialog({ open: true, targetStage: stage });
  };
  
  const confirmStageChange = () => {
    if (confirmDialog.targetStage) {
      onStageChange(confirmDialog.targetStage);
    }
    setConfirmDialog({ open: false, targetStage: null });
  };

  return (
    <div data-testid="stages-panel">
      <h3 className="text-sm font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Project Stage
      </h3>
      
      {/* Forward-only notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4">
        <p className="text-xs text-blue-600 flex items-center gap-1">
          <ChevronRight className="w-3 h-3" />
          Forward-only progression
        </p>
      </div>
      
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200" />
        
        <div className="space-y-3">
          {STAGES.map((stage, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isNext = isNextStage(stage);
            const stageColors = STAGE_COLORS[stage];
            const canClick = canClickStage(stage);
            
            return (
              <button
                key={stage}
                onClick={() => canClick && handleStageClick(stage)}
                disabled={!canClick}
                className={cn(
                  "relative flex items-center gap-3 w-full p-3 rounded-lg transition-all text-left",
                  canClick ? "cursor-pointer hover:bg-slate-50" : "cursor-not-allowed",
                  isCurrent && "ring-2 ring-offset-2",
                  isCurrent && stageColors.ring,
                  isCompleted && "opacity-60"
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
                    <span className="text-xs text-slate-400">{index + 1}</span>
                  )}
                </div>
                
                {/* Label */}
                <div className="flex-1">
                  <span className={cn(
                    "text-sm font-medium",
                    isCompleted && "line-through text-slate-500",
                    isCurrent ? stageColors.text : !isCompleted && "text-slate-600"
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
                {isNext && canChangeStage && !isUpdating && (
                  <ChevronRight className="w-4 h-4 text-blue-500" />
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
      
      {/* Stage Change Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, targetStage: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ChevronRight className="w-5 h-5 text-blue-500" />
              Update Project Stage
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update the stage to <strong className="text-blue-600">&quot;{confirmDialog.targetStage}&quot;</strong>?
              <br /><br />
              <span className="text-amber-600 text-sm">
                ⚠️ This action cannot be undone. Stage progression is forward-only.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStageChange}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
