import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { cn } from '../lib/utils';
import axios from 'axios';
import { 
  Settings as SettingsIcon, 
  Building2, 
  Palette, 
  Clock, 
  ListChecks, 
  Activity,
  Save,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Info,
  Mail,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ============ SUB-NAVIGATION ============
const SettingsNav = ({ activeTab, setActiveTab, canEdit }) => {
  const navItems = [
    { id: 'company', label: 'Company Profile', icon: Building2 },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'tat', label: 'TAT Rules', icon: Clock },
    { id: 'stages', label: 'Stages & Milestones', icon: ListChecks },
    { id: 'emails', label: 'Email Templates', icon: Mail },
    { id: 'logs', label: 'System Logs', icon: Activity }
  ];

  return (
    <div className="w-56 border-r border-slate-200 pr-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
        Settings
      </h3>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          // Only show logs and emails to admin
          if ((item.id === 'logs' || item.id === 'emails') && !canEdit) return null;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-blue-50 text-blue-600" 
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
              {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

// ============ COMPANY SETTINGS ============
const CompanySettings = ({ canEdit }) => {
  const [settings, setSettings] = useState({
    name: '',
    address: '',
    phone: '',
    gst: '',
    website: '',
    support_email: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings/company`, { withCredentials: true });
      setSettings(response.data);
    } catch (err) {
      console.error('Error fetching company settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API_URL}/api/settings/company`, settings, { withCredentials: true });
      toast.success('Company settings saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Company Profile</h2>
        <p className="text-sm text-slate-500">Manage your company information</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Company Name</Label>
          <Input value={settings.name} onChange={(e) => handleChange('name', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={settings.phone} onChange={(e) => handleChange('phone', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Address</Label>
          <Input value={settings.address} onChange={(e) => handleChange('address', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label>GST Number (optional)</Label>
          <Input value={settings.gst} onChange={(e) => handleChange('gst', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label>Website URL</Label>
          <Input value={settings.website} onChange={(e) => handleChange('website', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label>Support Email</Label>
          <Input type="email" value={settings.support_email} onChange={(e) => handleChange('support_email', e.target.value)} disabled={!canEdit} />
        </div>
      </div>

      {canEdit && (
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      )}

      {!canEdit && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Info className="w-4 h-4" />
          Only administrators can edit company settings
        </div>
      )}
    </div>
  );
};

// ============ BRANDING SETTINGS ============
const BrandingSettings = ({ canEdit }) => {
  const [settings, setSettings] = useState({
    logo_url: '',
    primary_color: '#2563EB',
    secondary_color: '#64748B',
    theme: 'light',
    favicon_url: '',
    sidebar_default_collapsed: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings/branding`, { withCredentials: true });
      setSettings(response.data);
    } catch (err) {
      console.error('Error fetching branding settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API_URL}/api/settings/branding`, settings, { withCredentials: true });
      toast.success('Branding settings saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Branding</h2>
        <p className="text-sm text-slate-500">Customize your brand appearance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Logo URL</Label>
          <Input value={settings.logo_url} onChange={(e) => handleChange('logo_url', e.target.value)} placeholder="https://..." disabled={!canEdit} />
          {settings.logo_url && (
            <div className="mt-2 p-4 bg-slate-50 rounded-lg">
              <img src={settings.logo_url} alt="Logo preview" className="max-h-16 object-contain" />
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <Label>Favicon URL</Label>
          <Input value={settings.favicon_url} onChange={(e) => handleChange('favicon_url', e.target.value)} placeholder="https://..." disabled={!canEdit} />
        </div>

        <div className="space-y-2">
          <Label>Primary Color</Label>
          <div className="flex items-center gap-2">
            <Input type="color" value={settings.primary_color} onChange={(e) => handleChange('primary_color', e.target.value)} className="w-16 h-10 p-1" disabled={!canEdit} />
            <Input value={settings.primary_color} onChange={(e) => handleChange('primary_color', e.target.value)} className="flex-1" disabled={!canEdit} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Secondary Color</Label>
          <div className="flex items-center gap-2">
            <Input type="color" value={settings.secondary_color} onChange={(e) => handleChange('secondary_color', e.target.value)} className="w-16 h-10 p-1" disabled={!canEdit} />
            <Input value={settings.secondary_color} onChange={(e) => handleChange('secondary_color', e.target.value)} className="flex-1" disabled={!canEdit} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="theme" value="light" checked={settings.theme === 'light'} onChange={(e) => handleChange('theme', e.target.value)} disabled={!canEdit} />
              <span className="text-sm">Light</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="theme" value="dark" checked={settings.theme === 'dark'} onChange={(e) => handleChange('theme', e.target.value)} disabled={!canEdit} />
              <span className="text-sm">Dark</span>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Sidebar Default State</Label>
          <div className="flex items-center gap-2">
            <Switch checked={settings.sidebar_default_collapsed} onCheckedChange={(checked) => handleChange('sidebar_default_collapsed', checked)} disabled={!canEdit} />
            <span className="text-sm text-slate-600">{settings.sidebar_default_collapsed ? 'Collapsed' : 'Expanded'}</span>
          </div>
        </div>
      </div>

      {canEdit && (
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      )}
    </div>
  );
};

// ============ TAT SETTINGS ============
const TATSettings = ({ canEdit }) => {
  const [leadTAT, setLeadTAT] = useState({
    bc_call_done: 1,
    boq_shared: 3,
    site_meeting: 2,
    revised_boq_shared: 2
  });
  const [projectTAT, setProjectTAT] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [leadRes, projectRes] = await Promise.all([
        axios.get(`${API_URL}/api/settings/tat/lead`, { withCredentials: true }),
        axios.get(`${API_URL}/api/settings/tat/project`, { withCredentials: true })
      ]);
      setLeadTAT(leadRes.data);
      setProjectTAT(projectRes.data);
    } catch (err) {
      console.error('Error fetching TAT settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLeadTAT = async () => {
    try {
      setSaving(true);
      await axios.put(`${API_URL}/api/settings/tat/lead`, leadTAT, { withCredentials: true });
      toast.success('Lead TAT settings saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProjectTAT = async () => {
    try {
      setSaving(true);
      await axios.put(`${API_URL}/api/settings/tat/project`, projectTAT, { withCredentials: true });
      toast.success('Project TAT settings saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLeadTATChange = (field, value) => {
    setLeadTAT(prev => ({ ...prev, [field]: parseInt(value) || 0 }));
  };

  const handleProjectTATChange = (stage, field, value) => {
    setProjectTAT(prev => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        [field]: parseInt(value) || 0
      }
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>;
  }

  const leadTATLabels = {
    bc_call_done: 'BC Call Done',
    boq_shared: 'BOQ Shared',
    site_meeting: 'Site Meeting',
    revised_boq_shared: 'Revised BOQ Shared'
  };

  const projectTATLabels = {
    design_finalization: {
      label: 'Design Finalization',
      fields: {
        site_measurement: 'Site Measurement',
        site_validation: 'Site Validation',
        design_meeting: 'Design Meeting',
        design_meeting_2: 'Design Meeting 2',
        final_proposal: 'Final Proposal',
        sign_off: 'Sign-off',
        kickoff_meeting: 'Kickoff Meeting'
      }
    },
    production_preparation: {
      label: 'Production Preparation',
      fields: {
        factory_slot: 'Factory Slot',
        jit_plan: 'JIT Plan',
        nm_dependencies: 'NM Dependencies',
        raw_material: 'Raw Material'
      }
    },
    production: {
      label: 'Production',
      fields: {
        production_start: 'Production Start',
        full_confirmation: 'Full Confirmation',
        piv: 'PIV / Site Readiness'
      }
    },
    delivery: {
      label: 'Delivery',
      fields: {
        modular_delivery: 'Modular Delivery'
      }
    },
    installation: {
      label: 'Installation',
      fields: {
        modular_installation: 'Modular Installation',
        nm_handover_work: 'NM Handover Work'
      }
    },
    handover: {
      label: 'Handover',
      fields: {
        handover_with_snag: 'Handover with Snag',
        cleaning: 'Cleaning',
        handover_without_snag: 'Handover Without Snag'
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">TAT Rules</h2>
        <p className="text-sm text-slate-500">Configure turnaround time for milestones (in days)</p>
      </div>

      <Tabs defaultValue="lead" className="w-full">
        <TabsList>
          <TabsTrigger value="lead">Lead TAT</TabsTrigger>
          <TabsTrigger value="project">Project TAT</TabsTrigger>
        </TabsList>

        <TabsContent value="lead" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Lead Milestones</CardTitle>
              <CardDescription>Days from lead creation to each milestone</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(leadTATLabels).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <div className="flex items-center gap-1">
                      <Input 
                        type="number" 
                        min="0"
                        value={leadTAT[key] || 0} 
                        onChange={(e) => handleLeadTATChange(key, e.target.value)} 
                        className="w-20 text-center"
                        disabled={!canEdit}
                      />
                      <span className="text-xs text-slate-400">days</span>
                    </div>
                  </div>
                ))}
              </div>
              {canEdit && (
                <Button onClick={handleSaveLeadTAT} disabled={saving} className="mt-4 bg-blue-600 hover:bg-blue-700">
                  <Save className="w-4 h-4 mr-2" />
                  Save Lead TAT
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="project" className="space-y-4">
          <ScrollArea className="h-[500px] pr-4">
            {Object.entries(projectTATLabels).map(([stageKey, stageData]) => (
              <Card key={stageKey} className="border-slate-200 mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{stageData.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(stageData.fields).map(([fieldKey, fieldLabel]) => (
                      <div key={fieldKey} className="space-y-1">
                        <Label className="text-xs">{fieldLabel}</Label>
                        <div className="flex items-center gap-1">
                          <Input 
                            type="number" 
                            min="0"
                            value={projectTAT[stageKey]?.[fieldKey] || 0} 
                            onChange={(e) => handleProjectTATChange(stageKey, fieldKey, e.target.value)} 
                            className="w-20 text-center"
                            disabled={!canEdit}
                          />
                          <span className="text-xs text-slate-400">days</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </ScrollArea>
          {canEdit && (
            <Button onClick={handleSaveProjectTAT} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Project TAT
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ============ STAGES & MILESTONES SETTINGS ============
const StagesSettings = ({ canEdit }) => {
  const [projectStages, setProjectStages] = useState([]);
  const [leadStages, setLeadStages] = useState([]);
  const [milestones, setMilestones] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [stagesRes, leadStagesRes, milestonesRes] = await Promise.all([
        axios.get(`${API_URL}/api/settings/stages`, { withCredentials: true }),
        axios.get(`${API_URL}/api/settings/stages/lead`, { withCredentials: true }),
        axios.get(`${API_URL}/api/settings/milestones`, { withCredentials: true })
      ]);
      setProjectStages(stagesRes.data);
      setLeadStages(leadStagesRes.data);
      setMilestones(milestonesRes.data);
    } catch (err) {
      console.error('Error fetching stages settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStages = async () => {
    try {
      setSaving(true);
      await Promise.all([
        axios.put(`${API_URL}/api/settings/stages`, projectStages, { withCredentials: true }),
        axios.put(`${API_URL}/api/settings/stages/lead`, leadStages, { withCredentials: true })
      ]);
      toast.success('Stages saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMilestones = async () => {
    try {
      setSaving(true);
      await axios.put(`${API_URL}/api/settings/milestones`, milestones, { withCredentials: true });
      toast.success('Milestones saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleStageEnabled = (stages, setStages, index) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], enabled: !updated[index].enabled };
    setStages(updated);
  };

  const toggleMilestoneEnabled = (stageName, index) => {
    setMilestones(prev => {
      const updated = { ...prev };
      updated[stageName] = [...(updated[stageName] || [])];
      updated[stageName][index] = { ...updated[stageName][index], enabled: !updated[stageName][index].enabled };
      return updated;
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Stages & Milestones</h2>
        <p className="text-sm text-slate-500">Configure stages and their milestones</p>
      </div>

      <Tabs defaultValue="project-stages" className="w-full">
        <TabsList>
          <TabsTrigger value="project-stages">Project Stages</TabsTrigger>
          <TabsTrigger value="lead-stages">Lead Stages</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
        </TabsList>

        <TabsContent value="project-stages" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Project Stages</CardTitle>
              <CardDescription>Enable or disable project stages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {projectStages.map((stage, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">{index + 1}</Badge>
                      <span className="font-medium text-sm">{stage.name}</span>
                    </div>
                    <Switch 
                      checked={stage.enabled} 
                      onCheckedChange={() => toggleStageEnabled(projectStages, setProjectStages, index)}
                      disabled={!canEdit}
                    />
                  </div>
                ))}
              </div>
              {canEdit && (
                <Button onClick={handleSaveStages} disabled={saving} className="mt-4 bg-blue-600 hover:bg-blue-700">
                  <Save className="w-4 h-4 mr-2" />
                  Save Stages
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lead-stages" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Lead Stages</CardTitle>
              <CardDescription>Enable or disable lead stages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leadStages.map((stage, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">{index + 1}</Badge>
                      <span className="font-medium text-sm">{stage.name}</span>
                    </div>
                    <Switch 
                      checked={stage.enabled} 
                      onCheckedChange={() => toggleStageEnabled(leadStages, setLeadStages, index)}
                      disabled={!canEdit}
                    />
                  </div>
                ))}
              </div>
              {canEdit && (
                <Button onClick={handleSaveStages} disabled={saving} className="mt-4 bg-blue-600 hover:bg-blue-700">
                  <Save className="w-4 h-4 mr-2" />
                  Save Stages
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="space-y-4">
          <ScrollArea className="h-[500px] pr-4">
            {Object.entries(milestones).map(([stageName, stageMilestones]) => (
              <Card key={stageName} className="border-slate-200 mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{stageName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stageMilestones.map((milestone, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-6">{index + 1}.</span>
                          <span className="text-sm">{milestone.name}</span>
                        </div>
                        <Switch 
                          checked={milestone.enabled} 
                          onCheckedChange={() => toggleMilestoneEnabled(stageName, index)}
                          disabled={!canEdit}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </ScrollArea>
          {canEdit && (
            <Button onClick={handleSaveMilestones} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Milestones
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ============ SYSTEM LOGS ============
const SystemLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings/logs?limit=100`, { withCredentials: true });
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionLabel = (action) => {
    const labels = {
      company_settings_updated: 'Company Settings Updated',
      branding_settings_updated: 'Branding Settings Updated',
      lead_tat_updated: 'Lead TAT Updated',
      project_tat_updated: 'Project TAT Updated',
      stages_updated: 'Stages Updated',
      lead_stages_updated: 'Lead Stages Updated',
      milestones_updated: 'Milestones Updated',
      user_role_changed: 'User Role Changed',
      user_created: 'User Created',
      user_deactivated: 'User Deactivated',
      stage_changed: 'Stage Changed',
      project_created: 'Project Created',
      lead_converted: 'Lead Converted'
    };
    return labels[action] || action;
  };

  const getActionIcon = (action) => {
    if (action.includes('updated') || action.includes('changed')) {
      return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    }
    if (action.includes('created') || action.includes('converted')) {
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
    if (action.includes('deactivated')) {
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    }
    return <Activity className="w-4 h-4 text-slate-400" />;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">System Logs</h2>
        <p className="text-sm text-slate-500">Recent activity and changes ({total} total)</p>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Activity className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>No logs yet</p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                {getActionIcon(log.action)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{getActionLabel(log.action)}</p>
                  <p className="text-xs text-slate-500">
                    by {log.user_name} ({log.user_role}) • {formatDate(log.timestamp)}
                  </p>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <details className="mt-1">
                      <summary className="text-xs text-blue-600 cursor-pointer">View details</summary>
                      <pre className="mt-1 text-xs text-slate-500 bg-white p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

// ============ EMAIL TEMPLATES ============
const EmailTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editedTemplate, setEditedTemplate] = useState({ subject: '', body: '' });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings/email-templates`, { withCredentials: true });
      setTemplates(response.data);
      if (response.data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(response.data[0]);
        setEditedTemplate({ subject: response.data[0].subject, body: response.data[0].body });
      }
    } catch (err) {
      console.error('Error fetching email templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setEditedTemplate({ subject: template.subject, body: template.body });
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    
    try {
      setSaving(true);
      await axios.put(`${API_URL}/api/settings/email-templates/${selectedTemplate.id}`, editedTemplate, { 
        withCredentials: true 
      });
      toast.success('Template saved');
      
      // Update local state
      setTemplates(prev => prev.map(t => 
        t.id === selectedTemplate.id 
          ? { ...t, ...editedTemplate, updated_at: new Date().toISOString() } 
          : t
      ));
      setSelectedTemplate(prev => ({ ...prev, ...editedTemplate }));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedTemplate) return;
    
    try {
      setSaving(true);
      const response = await axios.post(`${API_URL}/api/settings/email-templates/${selectedTemplate.id}/reset`, {}, { 
        withCredentials: true 
      });
      toast.success('Template reset to default');
      
      // Update local state with reset template
      const resetTemplate = response.data.template;
      setTemplates(prev => prev.map(t => t.id === selectedTemplate.id ? resetTemplate : t));
      setSelectedTemplate(resetTemplate);
      setEditedTemplate({ subject: resetTemplate.subject, body: resetTemplate.body });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset template');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Email Templates</h2>
        <p className="text-sm text-slate-500">Customize email templates for notifications (templates are stored for future email integration)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Template List */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-500 uppercase">Templates</Label>
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-colors",
                selectedTemplate?.id === template.id
                  ? "bg-blue-50 border-blue-200"
                  : "bg-white border-slate-200 hover:bg-slate-50"
              )}
            >
              <p className={cn(
                "text-sm font-medium",
                selectedTemplate?.id === template.id ? "text-blue-700" : "text-slate-700"
              )}>
                {template.name}
              </p>
              {template.updated_at && (
                <p className="text-xs text-slate-400 mt-1">
                  Modified: {new Date(template.updated_at).toLocaleDateString()}
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Template Editor */}
        <div className="md:col-span-2 space-y-4">
          {selectedTemplate ? (
            <>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  value={editedTemplate.subject}
                  onChange={(e) => setEditedTemplate(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Email subject..."
                />
              </div>

              <div className="space-y-2">
                <Label>Email Body (HTML)</Label>
                <Textarea
                  value={editedTemplate.body}
                  onChange={(e) => setEditedTemplate(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Email body content..."
                  className="min-h-[250px] font-mono text-sm"
                />
              </div>

              {/* Variables Reference */}
              <div className="p-3 bg-slate-50 rounded-lg">
                <Label className="text-xs text-slate-500 uppercase">Available Variables</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedTemplate.variables?.map((variable) => (
                    <Badge key={variable} variant="outline" className="text-xs">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label className="text-xs text-slate-500 uppercase">Preview</Label>
                <div 
                  className="p-4 bg-white border border-slate-200 rounded-lg text-sm prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: editedTemplate.body }}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Template'}
                </Button>
                <Button variant="outline" onClick={handleReset} disabled={saving}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Default
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Mail className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>Select a template to edit</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-900">Email Integration Coming Soon</p>
          <p className="text-sm text-blue-700 mt-1">
            These templates are saved and will be used when email notifications are enabled in a future update.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============ MAIN SETTINGS COMPONENT ============
const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('company');

  // Redirect non-admin/manager users
  useEffect(() => {
    if (user && !['Admin', 'Manager'].includes(user.role)) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const canEdit = user?.role === 'Admin';

  return (
    <div className="space-y-6" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 
          className="text-2xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage system configuration and preferences
        </p>
      </div>

      {/* Settings Layout */}
      <div className="flex gap-6">
        <SettingsNav activeTab={activeTab} setActiveTab={setActiveTab} canEdit={canEdit} />
        
        <div className="flex-1">
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              {activeTab === 'company' && <CompanySettings canEdit={canEdit} />}
              {activeTab === 'branding' && <BrandingSettings canEdit={canEdit} />}
              {activeTab === 'tat' && <TATSettings canEdit={canEdit} />}
              {activeTab === 'stages' && <StagesSettings canEdit={canEdit} />}
              {activeTab === 'emails' && <EmailTemplates />}
              {activeTab === 'logs' && <SystemLogs />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
