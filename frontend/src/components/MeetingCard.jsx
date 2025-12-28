import React from 'react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

const STATUS_STYLES = {
  'Scheduled': { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  'Completed': { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  'Missed': { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  'Cancelled': { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
};

const MeetingCard = ({ 
  meeting, 
  onMarkCompleted, 
  onCancel, 
  onViewProject,
  onViewLead,
  showProject = true,
  showLead = true,
  compact = false
}) => {
  const status = meeting.status || 'Scheduled';
  const styles = STATUS_STYLES[status] || STATUS_STYLES['Scheduled'];

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatMeetingDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-purple-200 transition-colors">
        <div className="flex items-center gap-3">
          <div className={cn("w-2 h-2 rounded-full", styles.dot)} />
          <div>
            <p className="text-sm font-medium text-slate-900">{meeting.title}</p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{formatMeetingDate(meeting.date)}</span>
              <span>•</span>
              <span>{formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}</span>
            </div>
          </div>
        </div>
        <Badge className={cn("text-xs", styles.bg, styles.text)}>
          {status}
        </Badge>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-slate-900">{meeting.title}</h4>
            <Badge className={cn("text-xs", styles.bg, styles.text)}>
              {status}
            </Badge>
          </div>
          {meeting.description && (
            <p className="text-xs text-slate-500 line-clamp-2">{meeting.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{formatMeetingDate(meeting.date)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span>{formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}</span>
        </div>
        {meeting.location && (
          <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span className="truncate">{meeting.location}</span>
          </div>
        )}
        {meeting.scheduled_for_user && (
          <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
            <User className="h-3.5 w-3.5 text-slate-400" />
            <span>{meeting.scheduled_for_user.name}</span>
          </div>
        )}
      </div>

      {/* Project/Lead Link */}
      {showProject && meeting.project && (
        <div className="mb-3 p-2 bg-slate-50 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Project</p>
              <p className="text-sm font-medium text-slate-700">{meeting.project.project_name}</p>
            </div>
            {onViewProject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewProject(meeting.project_id)}
                className="h-7 text-xs"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View
              </Button>
            )}
          </div>
        </div>
      )}

      {showLead && meeting.lead && (
        <div className="mb-3 p-2 bg-slate-50 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Lead</p>
              <p className="text-sm font-medium text-slate-700">{meeting.lead.customer_name}</p>
            </div>
            {onViewLead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewLead(meeting.lead_id)}
                className="h-7 text-xs"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {status === 'Scheduled' && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          {onMarkCompleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMarkCompleted(meeting.id)}
              className="flex-1 h-8 text-xs text-green-600 border-green-200 hover:bg-green-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Mark Completed
            </Button>
          )}
          {onCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCancel(meeting.id)}
              className="flex-1 h-8 text-xs text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      )}

      {status === 'Missed' && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>This meeting was missed</span>
        </div>
      )}
    </div>
  );
};

export default MeetingCard;
