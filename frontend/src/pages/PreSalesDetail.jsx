import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  Send, 
  Check, 
  Clock, 
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  Tag,
  Upload,
  File,
  Trash2,
  Download,
  ArrowRightCircle,
  Edit2,
  X,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Pre-Sales Status stages
const PRESALES_STATUSES = ['New', 'Contacted', 'Waiting', 'Qualified', 'Dropped'];

const STATUS_STYLES = {
  'New': { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-500' },
  'Contacted': { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-500' },
  'Waiting': { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-500' },
  'Qualified': { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-500' },
  'Dropped': { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-500' }
};

const LEAD_SOURCES = ['Meta', 'Walk-in', 'Referral', 'Others'];
const SOURCE_COLORS = {
  'Meta': 'bg-blue-100 text-blue-700',
  'Walk-in': 'bg-green-100 text-green-700',
  'Referral': 'bg-orange-100 text-orange-700',
  'Others': 'bg-slate-100 text-slate-700'
};

// ============ CUSTOMER DETAILS PANEL ============
const CustomerDetailsPanel = ({ lead, canEdit, onSave, saving }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  const startEditing = () => {
    setEditData({
      customer_name: lead?.customer_name || '',
      customer_phone: lead?.customer_phone || '',
      customer_email: lead?.customer_email || '',
      customer_address: lead?.customer_address || '',
      customer_requirements: lead?.customer_requirements || '',
      source: lead?.source || 'Others',
      budget: lead?.budget || ''
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    await onSave(editData);
    setIsEditing(false);
  };

  const formatCurrency = (amount) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Customer Details</h3>
        {canEdit && !isEditing && (
          <Button variant="ghost" size="sm" onClick={startEditing}>
            <Edit2 className="w-3 h-3 mr-1" />
            Edit
          </Button>
        )}
        {isEditing && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              <X className="w-3 h-3" />
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Name *</label>
            <Input
              value={editData.customer_name}
              onChange={(e) => setEditData(prev => ({ ...prev, customer_name: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Phone *</label>
            <Input
              value={editData.customer_phone}
              onChange={(e) => setEditData(prev => ({ ...prev, customer_phone: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Email</label>
            <Input
              type="email"
              value={editData.customer_email}
              onChange={(e) => setEditData(prev => ({ ...prev, customer_email: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Address</label>
            <Input
              value={editData.customer_address}
              onChange={(e) => setEditData(prev => ({ ...prev, customer_address: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Budget</label>
            <Input
              type="number"
              value={editData.budget}
              onChange={(e) => setEditData(prev => ({ ...prev, budget: e.target.value ? parseFloat(e.target.value) : '' }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Source</label>
            <Select
              value={editData.source}
              onValueChange={(value) => setEditData(prev => ({ ...prev, source: value }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map(src => (
                  <SelectItem key={src} value={src}>{src}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Requirements</label>
            <Textarea
              value={editData.customer_requirements}
              onChange={(e) => setEditData(prev => ({ ...prev, customer_requirements: e.target.value }))}
              className="mt-1"
              rows={3}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="text-sm font-medium">{lead?.customer_name || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Phone</p>
              <p className="text-sm font-medium">{lead?.customer_phone || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="text-sm font-medium">{lead?.customer_email || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Address</p>
              <p className="text-sm">{lead?.customer_address || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <DollarSign className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Budget</p>
              <p className="text-sm font-medium">{formatCurrency(lead?.budget)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Tag className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500">Source</p>
              {lead?.source ? (
                <Badge className={cn("text-xs mt-0.5", SOURCE_COLORS[lead.source] || SOURCE_COLORS['Others'])}>
                  {lead.source}
                </Badge>
              ) : (
                <p className="text-sm">—</p>
              )}
            </div>
          </div>
          {lead?.customer_requirements && (
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500">Requirements</p>
                <p className="text-sm whitespace-pre-wrap">{lead.customer_requirements}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============ STATUS PANEL ============
const StatusPanel = ({ currentStatus, onStatusChange, canChange, isUpdating, onConvertToLead, canConvert }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Status</h3>
      
      <div className="space-y-2">
        {PRESALES_STATUSES.map((status) => {
          const isCurrent = currentStatus === status;
          const statusStyle = STATUS_STYLES[status] || STATUS_STYLES['New'];
          const isClickable = canChange && !isUpdating && status !== currentStatus;
          
          return (
            <button
              key={status}
              onClick={() => isClickable && onStatusChange(status)}
              disabled={!isClickable}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                isCurrent ? `${statusStyle.bg} border-2 ${statusStyle.ring.replace('ring', 'border')}` : "bg-white border-slate-200",
                isClickable && "cursor-pointer hover:bg-slate-50",
                !isClickable && "cursor-default opacity-60"
              )}
            >
              <div className={cn(
                "w-3 h-3 rounded-full",
                isCurrent ? statusStyle.bg.replace('100', '500') : "bg-slate-300"
              )} />
              <span className={cn(
                "text-sm font-medium",
                isCurrent ? statusStyle.text : "text-slate-600"
              )}>
                {status}
              </span>
              {isCurrent && isUpdating && (
                <Loader2 className="w-4 h-4 animate-spin ml-auto" />
              )}
              {isCurrent && !isUpdating && (
                <Check className="w-4 h-4 ml-auto text-current" />
              )}
            </button>
          );
        })}
      </div>

      {/* Convert to Lead Button */}
      {canConvert && currentStatus === 'Qualified' && (
        <div className="pt-4 border-t border-slate-200">
          <Button
            onClick={onConvertToLead}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <ArrowRightCircle className="w-4 h-4 mr-2" />
            Convert to Lead
          </Button>
          <p className="text-xs text-slate-500 text-center mt-2">
            Move to Leads section with all data
          </p>
        </div>
      )}
    </div>
  );
};

// ============ COMMENTS PANEL ============
const CommentsPanel = ({ comments, onAddComment, isSubmitting }) => {
  const [newComment, setNewComment] = useState('');
  const scrollRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await onAddComment(newComment.trim());
    setNewComment('');
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Activity</h3>
      
      <ScrollArea className="flex-1 pr-2" ref={scrollRef}>
        <div className="space-y-3">
          {comments?.length > 0 ? (
            [...comments].reverse().map((comment, idx) => (
              <div 
                key={comment.id || idx}
                className={cn(
                  "p-3 rounded-lg",
                  comment.is_system ? "bg-slate-50 border border-slate-200" : "bg-blue-50 border border-blue-200"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-xs font-medium",
                    comment.is_system ? "text-slate-600" : "text-blue-700"
                  )}>
                    {comment.user_name || 'System'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatTime(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{comment.message}</p>
              </div>
            ))
          ) : (
            <p className="text-center text-slate-400 text-sm py-4">No activity yet</p>
          )}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          disabled={isSubmitting}
          className="flex-1"
        />
        <Button type="submit" disabled={isSubmitting || !newComment.trim()} size="icon">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
};

// ============ FILES PANEL ============
const FilesPanel = ({ files, onUpload, onDelete, canEdit, uploading }) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      await onUpload(selectedFiles);
    }
    e.target.value = '';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Files</h3>
        {canEdit && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
              Upload
            </Button>
          </>
        )}
      </div>

      {files?.length > 0 ? (
        <div className="space-y-2">
          {files.map((file, idx) => (
            <div
              key={file.id || idx}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
            >
              <File className="w-5 h-5 text-slate-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
              </div>
              <div className="flex items-center gap-1">
                {file.url && (
                  <Button variant="ghost" size="icon" asChild>
                    <a href={file.url} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(file.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
          <File className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No files uploaded</p>
          {canEdit && (
            <Button
              variant="link"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="mt-1"
            >
              Upload files
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// ============ MAIN COMPONENT ============
const PreSalesDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  // Fetch pre-sales lead
  const fetchLead = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/presales/${id}`, {
        withCredentials: true
      });
      setLead(response.data);
    } catch (err) {
      console.error('Failed to fetch pre-sales lead:', err);
      if (err.response?.status === 403) {
        toast.error('Access denied');
        navigate('/presales', { replace: true });
      } else {
        setError(err.response?.data?.detail || 'Failed to load lead');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchLead();
    }
  }, [id]);

  // Update status
  const handleStatusChange = async (newStatus) => {
    try {
      setIsUpdatingStatus(true);
      await axios.put(`${API}/presales/${id}/status`, { status: newStatus }, {
        withCredentials: true
      });
      toast.success(`Status updated to ${newStatus}`);
      fetchLead();
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Add comment
  const handleAddComment = async (message) => {
    try {
      setIsSubmittingComment(true);
      await axios.post(`${API}/presales/${id}/comments`, { message }, {
        withCredentials: true
      });
      fetchLead();
    } catch (err) {
      console.error('Failed to add comment:', err);
      toast.error('Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Save customer details
  const handleSaveDetails = async (updatedData) => {
    try {
      setIsSavingDetails(true);
      await axios.put(`${API}/presales/${id}/customer-details`, updatedData, {
        withCredentials: true
      });
      toast.success('Details updated');
      fetchLead();
    } catch (err) {
      console.error('Failed to save details:', err);
      toast.error(err.response?.data?.detail || 'Failed to save details');
    } finally {
      setIsSavingDetails(false);
    }
  };

  // Upload files
  const handleUploadFiles = async (files) => {
    try {
      setIsUploading(true);
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      
      await axios.post(`${API}/presales/${id}/files`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Files uploaded');
      fetchLead();
    } catch (err) {
      console.error('Failed to upload files:', err);
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete file
  const handleDeleteFile = async (fileId) => {
    try {
      await axios.delete(`${API}/presales/${id}/files/${fileId}`, {
        withCredentials: true
      });
      toast.success('File deleted');
      fetchLead();
    } catch (err) {
      console.error('Failed to delete file:', err);
      toast.error('Failed to delete file');
    }
  };

  // Convert to Lead
  const handleConvertToLead = async () => {
    try {
      setIsConverting(true);
      const response = await axios.post(`${API}/presales/${id}/convert-to-lead`, {}, {
        withCredentials: true
      });
      toast.success('Converted to Lead successfully!');
      // Navigate to the new lead
      navigate(`/leads/${response.data.lead_id}`);
    } catch (err) {
      console.error('Failed to convert to lead:', err);
      toast.error(err.response?.data?.detail || 'Failed to convert to lead');
    } finally {
      setIsConverting(false);
    }
  };

  // Permission checks
  const canEdit = () => {
    if (!user || !lead) return false;
    if (user.role === 'Admin' || user.role === 'SalesManager') return true;
    if (user.role === 'PreSales') return lead.created_by === user.user_id || lead.assigned_to === user.user_id;
    return false;
  };

  const canConvert = () => {
    return user?.role === 'Admin' || user?.role === 'SalesManager' || user?.role === 'PreSales';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/presales')}
          className="text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Pre-Sales
        </Button>
        
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => navigate('/presales')}
        className="text-slate-600 hover:text-slate-900 -ml-2"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Pre-Sales
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {lead?.customer_name}
          </h1>
          <p className="text-slate-500 mt-1">
            Pre-Sales Lead • Created {new Date(lead?.created_at).toLocaleDateString('en-IN')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {lead?.status && (
            <Badge className={cn(
              "px-3 py-1",
              STATUS_STYLES[lead.status]?.bg,
              STATUS_STYLES[lead.status]?.text
            )}>
              {lead.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Already converted notice */}
      {lead?.is_converted && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-600" />
              <p className="text-green-700">This pre-sales lead has been converted to a Lead.</p>
            </div>
            {lead.lead_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/leads/${lead.lead_id}`)}
                className="text-green-700 border-green-300 hover:bg-green-100"
              >
                View Lead
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Layout - 3 columns */}
      {!lead?.is_converted && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Customer Details (25%) */}
          <Card className="border-slate-200 lg:col-span-1">
            <CardContent className="p-4">
              <CustomerDetailsPanel
                lead={lead}
                canEdit={canEdit()}
                onSave={handleSaveDetails}
                saving={isSavingDetails}
              />
            </CardContent>
          </Card>

          {/* Center Column - Comments (50%) */}
          <Card className="border-slate-200 lg:col-span-2 flex flex-col" style={{ minHeight: '500px' }}>
            <CardContent className="p-4 flex-1 flex flex-col">
              <CommentsPanel
                comments={lead?.comments || []}
                onAddComment={handleAddComment}
                isSubmitting={isSubmittingComment}
              />
            </CardContent>
          </Card>

          {/* Right Column - Status (25%) */}
          <Card className="border-slate-200 lg:col-span-1">
            <CardContent className="p-4">
              <StatusPanel
                currentStatus={lead?.status}
                onStatusChange={handleStatusChange}
                canChange={canEdit()}
                isUpdating={isUpdatingStatus}
                onConvertToLead={handleConvertToLead}
                canConvert={canConvert() && !isConverting}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Files Section */}
      {!lead?.is_converted && (
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <FilesPanel
              files={lead?.files || []}
              onUpload={handleUploadFiles}
              onDelete={handleDeleteFile}
              canEdit={canEdit()}
              uploading={isUploading}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PreSalesDetail;
