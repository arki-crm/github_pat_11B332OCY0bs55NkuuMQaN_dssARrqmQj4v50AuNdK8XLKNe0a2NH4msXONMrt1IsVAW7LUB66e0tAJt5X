import React, { useState } from 'react';
import { Check, Loader2, ChevronRight, ChevronDown, Lock, Circle, Percent } from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  MILESTONE_GROUPS, 
  getGroupProgress, 
  canCompleteSubStage,
  getCurrentMilestoneGroup 
} from './utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
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

export const StagesPanel = ({ 
  currentStage, 
  completedSubStages = [], 
  percentageSubStages = {},
  onSubStageComplete, 
  onPercentageUpdate,
  canChangeStage, 
  isUpdating,
  userRole,
  holdStatus = 'Active'  // New prop for hold status
}) => {
  const [expandedGroups, setExpandedGroups] = useState(() => {
    // Auto-expand the current active group
    const currentGroup = getCurrentMilestoneGroup(completedSubStages);
    return currentGroup ? { [currentGroup.id]: true } : { design_finalization: true };
  });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, subStage: null, groupName: null });
  const [percentageDialog, setPercentageDialog] = useState({ 
    open: false, 
    subStage: null, 
    groupName: null,
    currentPercentage: 0 
  });
  const [newPercentage, setNewPercentage] = useState(0);
  const [percentageComment, setPercentageComment] = useState('');
  
  // Check if progression is blocked due to hold status
  const isProgressionBlocked = holdStatus === 'Hold' || holdStatus === 'Deactivated';

  // Update expanded groups when completedSubStages changes
  React.useEffect(() => {
    const currentGroup = getCurrentMilestoneGroup(completedSubStages);
    if (currentGroup) {
      setExpandedGroups(prev => ({
        ...prev,
        [currentGroup.id]: true
      }));
    }
  }, [completedSubStages]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const handleSubStageClick = (subStage, groupName) => {
    if (!canChangeStage || isUpdating || isProgressionBlocked) return;
    if (!canCompleteSubStage(subStage.id, completedSubStages)) return;
    
    // Check if this is a percentage-type sub-stage
    if (subStage.type === 'percentage') {
      const currentPct = percentageSubStages[subStage.id] || 0;
      setNewPercentage(currentPct);
      setPercentageComment('');
      setPercentageDialog({ open: true, subStage, groupName, currentPercentage: currentPct });
    } else {
      setConfirmDialog({ open: true, subStage, groupName });
    }
  };

  const confirmComplete = () => {
    if (confirmDialog.subStage && onSubStageComplete) {
      onSubStageComplete(confirmDialog.subStage.id, confirmDialog.subStage.name, confirmDialog.groupName);
    }
    setConfirmDialog({ open: false, subStage: null, groupName: null });
  };

  const confirmPercentageUpdate = () => {
    if (percentageDialog.subStage && onPercentageUpdate) {
      onPercentageUpdate(
        percentageDialog.subStage.id, 
        percentageDialog.subStage.name, 
        percentageDialog.groupName,
        newPercentage,
        percentageComment
      );
    }
    setPercentageDialog({ open: false, subStage: null, groupName: null, currentPercentage: 0 });
    setNewPercentage(0);
    setPercentageComment('');
  };

  // Check if entire group is complete
  const isGroupComplete = (group) => {
    return group.subStages.every(s => completedSubStages.includes(s.id));
  };

  // Check if group is locked (previous group not complete)
  const isGroupLocked = (groupIndex) => {
    if (groupIndex === 0) return false;
    const prevGroup = MILESTONE_GROUPS[groupIndex - 1];
    return !isGroupComplete(prevGroup);
  };

  // Get the currently active group
  const currentGroup = getCurrentMilestoneGroup(completedSubStages);

  return (
    <div data-testid="stages-panel">
      <h3 className="text-sm font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Project Milestones
      </h3>
      
      {/* Hold status warning */}
      {isProgressionBlocked && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-700 font-medium flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {holdStatus === 'Hold' 
              ? 'Project is on HOLD - Milestone progression is paused'
              : 'Project is DEACTIVATED - Milestone progression is disabled'}
          </p>
          <p className="text-xs text-amber-600 mt-1">
            {holdStatus === 'Hold' 
              ? 'Reactivate the project to continue milestone updates.'
              : 'This project has been deactivated.'}
          </p>
        </div>
      )}
      
      {/* Forward-only notice */}
      {!isProgressionBlocked && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4">
          <p className="text-xs text-blue-600 flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            Forward-only • Complete each step in order
          </p>
        </div>
      )}
      
      <div className="space-y-2">
        {MILESTONE_GROUPS.map((group, groupIndex) => {
          const progress = getGroupProgress(group.id, completedSubStages);
          const isComplete = isGroupComplete(group);
          const isLocked = isGroupLocked(groupIndex);
          const isActive = currentGroup?.id === group.id;
          const isExpanded = expandedGroups[group.id];

          return (
            <div 
              key={group.id}
              className={cn(
                "rounded-lg border transition-all",
                isComplete && "border-green-300 bg-green-50",
                isActive && !isComplete && `border-2 ${group.color.ring.replace('ring', 'border')}`,
                isLocked && "border-slate-200 bg-slate-50 opacity-60",
                !isComplete && !isActive && !isLocked && "border-slate-200"
              )}
              data-testid={`milestone-group-${group.id}`}
            >
              {/* Group Header */}
              <button
                onClick={() => !isLocked && toggleGroup(group.id)}
                disabled={isLocked}
                className={cn(
                  "w-full flex items-center gap-3 p-3 text-left",
                  !isLocked && "cursor-pointer hover:bg-slate-50/50",
                  isLocked && "cursor-not-allowed"
                )}
              >
                {/* Status indicator */}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  isComplete && "bg-green-500",
                  isActive && !isComplete && group.color.accent,
                  isLocked && "bg-slate-300",
                  !isComplete && !isActive && !isLocked && "bg-slate-200"
                )}>
                  {isComplete ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : isLocked ? (
                    <Lock className="w-3 h-3 text-slate-500" />
                  ) : (
                    <span className="text-xs font-bold text-white">{groupIndex + 1}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-semibold",
                      isComplete && "text-green-700",
                      isActive && !isComplete && group.color.text,
                      isLocked && "text-slate-400",
                      !isComplete && !isActive && !isLocked && "text-slate-600"
                    )}>
                      {group.name}
                    </span>
                    {isComplete && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                        Complete
                      </span>
                    )}
                  </div>
                  
                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isComplete ? "bg-green-500" : group.color.accent
                        )}
                        style={{ width: `${progress.percentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                      {progress.completed}/{progress.total}
                    </span>
                  </div>
                </div>

                {/* Expand icon */}
                {!isLocked && (
                  <div className="text-slate-400">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                )}
              </button>

              {/* Sub-stages (expandable) */}
              {isExpanded && !isLocked && (
                <div className="px-3 pb-3">
                  <div className="ml-4 pl-4 border-l-2 border-slate-200 space-y-1">
                    {group.subStages.map((subStage, subIndex) => {
                      const isSubComplete = completedSubStages.includes(subStage.id);
                      const canComplete = canCompleteSubStage(subStage.id, completedSubStages);
                      const isNextStep = canComplete && canChangeStage;
                      const isPercentageType = subStage.type === 'percentage';
                      const currentPct = percentageSubStages[subStage.id] || 0;

                      return (
                        <button
                          key={subStage.id}
                          onClick={() => isNextStep && handleSubStageClick(subStage, group.name)}
                          disabled={!isNextStep || isUpdating}
                          className={cn(
                            "w-full flex items-center gap-2 p-2 rounded-md text-left transition-all",
                            isSubComplete && "bg-green-50",
                            isNextStep && !isSubComplete && "cursor-pointer hover:bg-blue-50 border border-transparent hover:border-blue-200",
                            !isSubComplete && !isNextStep && "opacity-50 cursor-not-allowed"
                          )}
                          data-testid={`substage-${subStage.id}`}
                        >
                          {/* Sub-stage indicator */}
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border",
                            isSubComplete && "bg-green-500 border-green-500",
                            isNextStep && !isSubComplete && "bg-white border-blue-400",
                            !isSubComplete && !isNextStep && "bg-white border-slate-300"
                          )}>
                            {isSubComplete ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : isPercentageType && isNextStep ? (
                              <Percent className="w-2.5 h-2.5 text-amber-500" />
                            ) : isNextStep ? (
                              <Circle className="w-2 h-2 text-blue-500 fill-blue-500" />
                            ) : (
                              <span className="text-[9px] text-slate-400">{subIndex + 1}</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <span className={cn(
                              "text-xs",
                              isSubComplete && "text-green-700 line-through",
                              isNextStep && !isSubComplete && "text-slate-700 font-medium",
                              !isSubComplete && !isNextStep && "text-slate-400"
                            )}>
                              {subStage.name}
                            </span>
                            
                            {/* Percentage progress bar for percentage-type sub-stages */}
                            {isPercentageType && !isSubComplete && isNextStep && (
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-amber-500 rounded-full transition-all"
                                    style={{ width: `${currentPct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-amber-600 font-medium">{currentPct}%</span>
                              </div>
                            )}
                          </div>

                          {isNextStep && !isSubComplete && !isUpdating && (
                            isPercentageType ? (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                                Update
                              </span>
                            ) : (
                              <ChevronRight className="w-3 h-3 text-blue-500" />
                            )
                          )}
                          {isUpdating && isNextStep && (
                            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!canChangeStage && (
        <p className="text-xs text-slate-500 mt-4 text-center">
          You don&apos;t have permission to update milestones
        </p>
      )}

      {/* Standard Confirmation Dialog */}
      <AlertDialog 
        open={confirmDialog.open} 
        onOpenChange={(open) => !open && setConfirmDialog({ open: false, subStage: null, groupName: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Mark Step as Completed
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to mark <strong className="text-slate-700">&quot;{confirmDialog.subStage?.name}&quot;</strong> as completed?
              </p>
              <p className="text-sm text-slate-500">
                Milestone Group: <span className="font-medium">{confirmDialog.groupName}</span>
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                <p className="text-amber-700 text-sm font-medium">⚠️ This action cannot be undone.</p>
                <p className="text-amber-600 text-xs mt-1">
                  Once marked as complete, you cannot roll back to this step.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmComplete}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirm Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Percentage Update Dialog */}
      <AlertDialog 
        open={percentageDialog.open} 
        onOpenChange={(open) => {
          if (!open) {
            setPercentageDialog({ open: false, subStage: null, groupName: null, currentPercentage: 0 });
            setNewPercentage(0);
            setPercentageComment('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-amber-500" />
              Update Non-Modular Dependency Work Progress
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Current progress: <strong className="text-slate-700">{percentageDialog.currentPercentage}%</strong>
                </p>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">New Percentage (0-100)</label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={percentageDialog.currentPercentage}
                      max={100}
                      value={newPercentage}
                      onChange={(e) => setNewPercentage(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-24"
                    />
                    <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${newPercentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-amber-600 w-12">{newPercentage}%</span>
                  </div>
                  {newPercentage < percentageDialog.currentPercentage && (
                    <p className="text-xs text-red-500">
                      ⚠️ Cannot decrease progress below {percentageDialog.currentPercentage}%
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Comment (optional)</label>
                  <Textarea
                    value={percentageComment}
                    onChange={(e) => setPercentageComment(e.target.value)}
                    placeholder="Add a note about this progress update..."
                    rows={2}
                  />
                </div>

                {newPercentage >= 100 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-green-700 text-sm font-medium">✅ This will auto-complete the sub-stage</p>
                    <p className="text-green-600 text-xs mt-1">
                      Setting to 100% will mark this step as complete and unlock the next step.
                    </p>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-amber-700 text-sm font-medium">⚠️ Progress is forward-only</p>
                  <p className="text-amber-600 text-xs mt-1">
                    You cannot decrease the percentage once updated.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPercentageUpdate}
              disabled={newPercentage < percentageDialog.currentPercentage || newPercentage === percentageDialog.currentPercentage}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {newPercentage >= 100 ? 'Complete Step' : 'Update Progress'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
