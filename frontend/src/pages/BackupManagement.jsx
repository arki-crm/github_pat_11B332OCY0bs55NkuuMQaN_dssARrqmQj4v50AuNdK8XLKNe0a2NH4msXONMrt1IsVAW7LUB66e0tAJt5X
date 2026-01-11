import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Database, Plus, RotateCcw, Calendar, User, AlertTriangle, CheckCircle, Loader2, Clock } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function BackupManagement() {
  const { token, user } = useAuth();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [schedulerStatus, setSchedulerStatus] = useState(null);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/backup/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to fetch backups');
      }
      
      const data = await res.json();
      setBackups(data.backups || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedulerStatus = async () => {
    try {
      const res = await fetch(`${API}/api/admin/backup/scheduler-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSchedulerStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch scheduler status:', err);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchSchedulerStatus();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/admin/backup/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create backup');
      }
      
      const data = await res.json();
      toast.success(`Backup created: ${data.backup_id} (${data.collections_backed_up} collections)`);
      fetchBackups();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreBackup = async (backupId) => {
    setRestoring(backupId);
    try {
      const res = await fetch(`${API}/api/admin/backup/restore/${backupId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to restore backup');
      }
      
      const data = await res.json();
      toast.success(`Restored ${data.restored_collections?.length || 0} collections from backup`);
      if (data.errors?.length > 0) {
        toast.warning(`${data.errors.length} collections had errors during restore`);
      }
      setConfirmRestore(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Access check
  if (!user || user.role !== 'Admin') {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">Access Denied. Only Admin can manage backups.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="backup-management-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-8 h-8 text-slate-700" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Backup Management</h1>
            <p className="text-sm text-slate-500">Create and restore database backups</p>
          </div>
        </div>
        <Button 
          onClick={handleCreateBackup} 
          disabled={creating}
          data-testid="create-backup-btn"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Create Backup
        </Button>
      </div>

      {/* Scheduler Status Card */}
      {schedulerStatus && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-green-600" />
                <div className="text-sm text-green-800">
                  <p className="font-medium">Automated Daily Backups</p>
                  <p>Schedule: Daily at midnight (00:00 server time)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {schedulerStatus.scheduler_running ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">Inactive</Badge>
                )}
                {schedulerStatus.next_run_time && (
                  <span className="text-xs text-green-700">
                    Next: {formatDate(schedulerStatus.next_run_time)}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Important Notes:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Backups include all finance, accounting, project, and CRM data</li>
                <li>Attachment files are not included in backups (only metadata)</li>
                <li>Restoring a backup will <strong>replace</strong> all current data</li>
                <li>Daily automatic backups run at midnight (server time)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backups List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Backups</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading backups...</div>
          ) : backups.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No backups found. Create your first backup above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-600">Backup ID</th>
                    <th className="text-left p-3 font-medium text-slate-600">Created At</th>
                    <th className="text-left p-3 font-medium text-slate-600">Created By</th>
                    <th className="text-center p-3 font-medium text-slate-600">Collections</th>
                    <th className="text-center p-3 font-medium text-slate-600">Status</th>
                    <th className="text-center p-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {backups.map((backup) => (
                    <tr key={backup.backup_id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-700">
                        {backup.backup_id}
                      </td>
                      <td className="p-3 text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatDate(backup.created_at)}
                        </div>
                      </td>
                      <td className="p-3 text-slate-600">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-slate-400" />
                          {backup.created_by_name || 'System'}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline">
                          {backup.collections_count} collections
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        {backup.status === 'completed' ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            {backup.status}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmRestore(backup.backup_id)}
                          disabled={restoring === backup.backup_id}
                          data-testid={`restore-${backup.backup_id}`}
                        >
                          {restoring === backup.backup_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <RotateCcw className="w-4 h-4 mr-1" />
                              Restore
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Modal */}
      {confirmRestore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="border-b bg-red-50">
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                Confirm Restore
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="text-sm text-slate-600">
                <p className="font-medium text-red-600 mb-2">Warning: This action cannot be undone!</p>
                <p>Restoring backup <code className="bg-slate-100 px-1 rounded">{confirmRestore}</code> will:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Delete all current data in the backed-up collections</li>
                  <li>Replace it with data from the backup</li>
                  <li>This includes all transactions, receipts, liabilities, etc.</li>
                </ul>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmRestore(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleRestoreBackup(confirmRestore)}
                  disabled={restoring}
                  data-testid="confirm-restore-btn"
                >
                  {restoring ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Yes, Restore
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
