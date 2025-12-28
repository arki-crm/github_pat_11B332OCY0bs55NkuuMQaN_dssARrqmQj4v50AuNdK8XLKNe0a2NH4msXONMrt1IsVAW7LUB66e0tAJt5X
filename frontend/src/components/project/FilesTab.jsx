import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Upload, Download, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { formatRelativeTime } from './utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const FilesTab = ({ projectId, files, onFilesChange, userRole }) => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const fileInputRef = useRef(null);

  const canUpload = ['Admin', 'Manager', 'Designer'].includes(userRole);
  const canDelete = userRole === 'Admin';

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'image':
        return '🖼️';
      case 'pdf':
        return '📄';
      case 'doc':
        return '📝';
      default:
        return '📎';
    }
  };

  const getFileType = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'doc';
    return 'other';
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    try {
      setUploading(true);
      
      // Convert to base64 for storage (in production, use cloud storage)
      const reader = new FileReader();
      reader.onload = async () => {
        const fileUrl = reader.result;
        const fileType = getFileType(file.name);
        
        const response = await axios.post(`${API}/projects/${projectId}/files`, {
          file_name: file.name,
          file_url: fileUrl,
          file_type: fileType
        }, { withCredentials: true });
        
        onFilesChange([...files, response.data]);
        toast.success('File uploaded successfully');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId) => {
    try {
      setDeleting(fileId);
      await axios.delete(`${API}/projects/${projectId}/files/${fileId}`, {
        withCredentials: true
      });
      onFilesChange(files.filter(f => f.id !== fileId));
      toast.success('File deleted');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (file) => {
    const link = document.createElement('a');
    link.href = file.file_url;
    link.download = file.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div data-testid="files-tab">
      {/* Upload Button */}
      {canUpload && (
        <div className="mb-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="upload-file-btn"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Upload File
          </Button>
          <p className="text-xs text-slate-500 mt-2">Max file size: 10MB</p>
        </div>
      )}

      {/* Files Grid */}
      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <span className="text-3xl">📁</span>
          </div>
          <h4 className="text-base font-medium text-slate-900">No files uploaded yet</h4>
          <p className="text-sm text-slate-500 mt-1">Upload project files to share with the team</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="border border-slate-200 rounded-lg p-4 bg-white hover:border-slate-300 transition-colors"
              data-testid={`file-${file.id}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getFileIcon(file.file_type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{file.file_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {file.uploaded_by_name} • {formatRelativeTime(file.uploaded_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(file)}
                  className="flex-1"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
                {canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(file.id)}
                    disabled={deleting === file.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    {deleting === file.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
