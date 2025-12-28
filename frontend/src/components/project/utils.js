// Project-related utilities and constants

// Stage configuration - 6 main stages
export const STAGES = [
  "Design Finalization",
  "Production Preparation",
  "Production",
  "Delivery",
  "Installation",
  "Handover"
];

export const STAGE_COLORS = {
  'Design Finalization': { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-400' },
  'Production Preparation': { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-400' },
  'Production': { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-400' },
  'Delivery': { bg: 'bg-cyan-100', text: 'text-cyan-700', ring: 'ring-cyan-400' },
  'Installation': { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-400' },
  'Handover': { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-400' }
};

export const ROLE_BADGE_STYLES = {
  Admin: 'bg-purple-100 text-purple-700',
  Manager: 'bg-blue-100 text-blue-700',
  Designer: 'bg-pink-100 text-pink-700',
  PreSales: 'bg-orange-100 text-orange-700'
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
