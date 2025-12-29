// Project-related utilities and constants

// ============ MILESTONE GROUPS WITH SUB-STAGES ============
// Each milestone group contains ordered sub-stages that must be completed sequentially

export const MILESTONE_GROUPS = [
  {
    id: 'design_finalization',
    name: 'Design Finalization',
    color: { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-400', accent: 'bg-blue-500' },
    subStages: [
      { id: 'site_measurement', name: 'Site Measurement', order: 1 },
      { id: 'design_meeting_1', name: 'Design Meeting 1 – Layout Discussion', order: 2 },
      { id: 'design_meeting_2', name: 'Design Meeting 2 – First Draft of 3D Designs', order: 3 },
      { id: 'design_meeting_3', name: 'Design Meeting 3 – Final Draft of 3D Designs', order: 4 },
      { id: 'final_design_presentation', name: 'Final Design Presentation', order: 5 },
      { id: 'material_selection', name: 'Material Selection', order: 6 },
      { id: 'payment_collection_50', name: 'Payment Collection – 50%', order: 7 },
      { id: 'production_drawing_prep', name: 'Production Drawing Preparation', order: 8 },
      { id: 'validation_internal', name: 'Validation (Internal Check)', order: 9 },
      { id: 'kws_signoff', name: 'KWS Sign-Off Document Preparation', order: 10 },
      { id: 'kickoff_meeting', name: 'Kick-Off Meeting', order: 11 }
    ]
  },
  {
    id: 'production',
    name: 'Production',
    color: { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-400', accent: 'bg-amber-500' },
    subStages: [
      { id: 'vendor_mapping', name: 'Vendor Mapping', order: 1 },
      { id: 'factory_slot_allocation', name: 'Factory Slot Allocation', order: 2 },
      { id: 'jit_delivery_plan', name: 'JIT / Project Delivery Plan (By Operations Lead)', order: 3 },
      { id: 'non_modular_dependency', name: 'Non-Modular Dependency Works', order: 4, type: 'percentage' },
      { id: 'raw_material_procurement', name: 'Raw Material Procurement – Modular', order: 5 },
      { id: 'production_kickstart', name: 'Production Kick-Start', order: 6 },
      { id: 'modular_production_complete', name: 'Modular Production Completed (Factory)', order: 7 },
      { id: 'quality_check_inspection', name: 'Quality Check & Inspection', order: 8 },
      { id: 'full_order_confirmation_45', name: 'Full Order Confirmation — 45% Payment Collection', order: 9 },
      { id: 'piv_site_readiness', name: 'PIV / Site Readiness Check', order: 10 },
      { id: 'ready_for_dispatch', name: 'Ready For Dispatch', order: 11 }
    ]
  },
  {
    id: 'delivery',
    name: 'Delivery',
    color: { bg: 'bg-cyan-100', text: 'text-cyan-700', ring: 'ring-cyan-400', accent: 'bg-cyan-500' },
    subStages: [
      { id: 'dispatch_scheduled', name: 'Dispatch Scheduled', order: 1 },
      { id: 'installation_team_scheduled', name: 'Installation Team Scheduled', order: 2 },
      { id: 'materials_dispatched', name: 'Materials Dispatched', order: 3 },
      { id: 'delivery_confirmed', name: 'Delivery Confirmed at Site', order: 4 }
    ]
  },
  {
    id: 'installation',
    name: 'Installation',
    color: { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-400', accent: 'bg-purple-500' },
    subStages: [
      { id: 'installation_start', name: 'Installation Started', order: 1 },
      { id: 'installation_progress', name: 'Installation In Progress', order: 2 },
      { id: 'snag_list', name: 'Snag List Prepared', order: 3 },
      { id: 'snag_rectification', name: 'Snag Rectification', order: 4 },
      { id: 'installation_complete', name: 'Installation Completed', order: 5 }
    ]
  },
  {
    id: 'handover',
    name: 'Handover',
    color: { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-400', accent: 'bg-green-500' },
    subStages: [
      { id: 'final_inspection', name: 'Final Inspection', order: 1 },
      { id: 'cleaning', name: 'Cleaning', order: 2 },
      { id: 'handover_docs', name: 'Handover Documents Prepared', order: 3 },
      { id: 'project_handover', name: 'Project Handover Complete', order: 4 },
      { id: 'csat', name: 'CSAT (Customer Satisfaction)', order: 5 },
      { id: 'review_video_photos', name: 'Review Video / Photos', order: 6 },
      { id: 'issue_warranty_book', name: 'Issue Warranty Book', order: 7 },
      { id: 'closed', name: 'Closed', order: 8 }
    ]
  }
];

// Legacy STAGES for backward compatibility (parent group names)
export const STAGES = MILESTONE_GROUPS.map(g => g.name);

// Get all sub-stage IDs in order (flat list)
export const getAllSubStages = () => {
  const allSubStages = [];
  MILESTONE_GROUPS.forEach(group => {
    group.subStages.forEach(sub => {
      allSubStages.push({
        ...sub,
        groupId: group.id,
        groupName: group.name
      });
    });
  });
  return allSubStages;
};

// Get milestone group by sub-stage ID
export const getGroupBySubStage = (subStageId) => {
  return MILESTONE_GROUPS.find(g => g.subStages.some(s => s.id === subStageId));
};

// Get sub-stage progress for a group
export const getGroupProgress = (groupId, completedSubStages = []) => {
  const group = MILESTONE_GROUPS.find(g => g.id === groupId);
  if (!group) return { completed: 0, total: 0, percentage: 0 };
  
  const total = group.subStages.length;
  const completed = group.subStages.filter(s => completedSubStages.includes(s.id)).length;
  return { completed, total, percentage: Math.round((completed / total) * 100) };
};

// Check if a sub-stage can be completed (previous must be done)
export const canCompleteSubStage = (subStageId, completedSubStages = []) => {
  const allSubStages = getAllSubStages();
  const targetIndex = allSubStages.findIndex(s => s.id === subStageId);
  
  if (targetIndex === -1) return false;
  if (completedSubStages.includes(subStageId)) return false; // Already completed
  
  // First sub-stage can always be completed
  if (targetIndex === 0) return true;
  
  // Previous sub-stage must be completed
  const prevSubStage = allSubStages[targetIndex - 1];
  return completedSubStages.includes(prevSubStage.id);
};

// Get current active sub-stage (first incomplete)
export const getCurrentSubStage = (completedSubStages = []) => {
  const allSubStages = getAllSubStages();
  return allSubStages.find(s => !completedSubStages.includes(s.id));
};

// Get current milestone group based on completed sub-stages
export const getCurrentMilestoneGroup = (completedSubStages = []) => {
  for (const group of MILESTONE_GROUPS) {
    const allGroupComplete = group.subStages.every(s => completedSubStages.includes(s.id));
    if (!allGroupComplete) return group;
  }
  // All complete, return last group
  return MILESTONE_GROUPS[MILESTONE_GROUPS.length - 1];
};

export const STAGE_COLORS = {
  'Design Finalization': { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-400' },
  'Production': { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-400' },
  'Delivery': { bg: 'bg-cyan-100', text: 'text-cyan-700', ring: 'ring-cyan-400' },
  'Installation': { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-400' },
  'Handover': { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-400' }
};

export const ROLE_BADGE_STYLES = {
  Admin: 'bg-purple-100 text-purple-700',
  Manager: 'bg-blue-100 text-blue-700',
  Designer: 'bg-pink-100 text-pink-700',
  PreSales: 'bg-orange-100 text-orange-700',
  DesignManager: 'bg-indigo-100 text-indigo-700',
  ProductionOpsManager: 'bg-amber-100 text-amber-700',
  SalesManager: 'bg-cyan-100 text-cyan-700'
};

// Format date helper
export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
};

// Get initials from name
export const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Avatar colors based on name
export const getAvatarColor = (name) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
    'bg-amber-500', 'bg-cyan-500', 'bg-red-500', 'bg-indigo-500'
  ];
  const index = name ? name.charCodeAt(0) % colors.length : 0;
  return colors[index];
};

// Group timeline items by stage
export const groupTimelineByStage = (timeline) => {
  const groups = {};
  STAGES.forEach(stage => {
    groups[stage] = [];
  });
  
  timeline?.forEach(item => {
    const stage = item.stage_ref;
    if (groups[stage]) {
      groups[stage].push(item);
    }
  });
  
  return groups;
};
