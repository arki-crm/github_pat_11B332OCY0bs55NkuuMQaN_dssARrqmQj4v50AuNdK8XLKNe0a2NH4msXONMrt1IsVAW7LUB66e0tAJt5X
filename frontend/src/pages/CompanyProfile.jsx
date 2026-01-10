import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { 
  Building2, 
  Save, 
  Loader2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  FileText,
  Upload,
  X,
  Palette
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CompanyProfile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    // Company Identity
    legal_name: '',
    brand_name: '',
    tagline: '',
    gstin: '',
    pan: '',
    
    // Address
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    
    // Contact
    primary_email: '',
    secondary_email: '',
    phone: '',
    website: '',
    
    // Branding
    logo_base64: null,
    favicon_base64: null,
    primary_color: '#1f2937',
    secondary_color: '#6b7280',
    
    // Document
    authorized_signatory: '',
    receipt_footer_note: 'This is a system-generated receipt.'
  });

  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API}/finance/company-settings`, { withCredentials: true });
      setSettings(prev => ({ ...prev, ...res.data }));
    } catch (error) {
      console.error('Failed to fetch company settings:', error);
      toast.error('Failed to load company settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.post(`${API}/finance/company-settings`, settings, { withCredentials: true });
      toast.success('Company profile updated successfully');
    } catch (error) {
      console.error('Failed to save company settings:', error);
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      if (type === 'logo') {
        handleChange('logo_base64', base64);
      } else {
        handleChange('favicon_base64', base64);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8" data-testid="access-denied">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">Admin access required to manage company profile</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="company-profile-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-slate-600" />
            Company Profile
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your company details for receipts and invoices
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-slate-800 hover:bg-slate-900"
          data-testid="save-settings-btn"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {/* Company Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            Company Identity
          </CardTitle>
          <CardDescription>Legal and brand information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="legal_name">Legal Name *</Label>
              <Input
                id="legal_name"
                value={settings.legal_name}
                onChange={(e) => handleChange('legal_name', e.target.value)}
                placeholder="e.g., Arki Dots Private Limited"
                data-testid="legal-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand_name">Brand / Display Name</Label>
              <Input
                id="brand_name"
                value={settings.brand_name}
                onChange={(e) => handleChange('brand_name', e.target.value)}
                placeholder="e.g., Arki Dots (if different from legal)"
                data-testid="brand-name-input"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline / Descriptor</Label>
            <Input
              id="tagline"
              value={settings.tagline}
              onChange={(e) => handleChange('tagline', e.target.value)}
              placeholder="e.g., Interior Design & Home Renovation"
              data-testid="tagline-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                value={settings.gstin}
                onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                placeholder="e.g., 29ABCDE1234F1Z5"
                maxLength={15}
                data-testid="gstin-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pan">PAN</Label>
              <Input
                id="pan"
                value={settings.pan}
                onChange={(e) => handleChange('pan', e.target.value.toUpperCase())}
                placeholder="e.g., ABCDE1234F"
                maxLength={10}
                data-testid="pan-input"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-slate-500" />
            Address
          </CardTitle>
          <CardDescription>Registered business address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address_line1">Address Line 1</Label>
            <Input
              id="address_line1"
              value={settings.address_line1}
              onChange={(e) => handleChange('address_line1', e.target.value)}
              placeholder="Street address, Building name"
              data-testid="address-line1-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_line2">Address Line 2</Label>
            <Input
              id="address_line2"
              value={settings.address_line2}
              onChange={(e) => handleChange('address_line2', e.target.value)}
              placeholder="Area, Landmark (optional)"
              data-testid="address-line2-input"
            />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={settings.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="City"
                data-testid="city-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={settings.state}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="State"
                data-testid="state-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pincode">PIN Code</Label>
              <Input
                id="pincode"
                value={settings.pincode}
                onChange={(e) => handleChange('pincode', e.target.value)}
                placeholder="PIN"
                maxLength={6}
                data-testid="pincode-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={settings.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="Country"
                data-testid="country-input"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="w-5 h-5 text-slate-500" />
            Contact Information
          </CardTitle>
          <CardDescription>Email, phone, and website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary_email" className="flex items-center gap-1">
                <Mail className="w-3 h-3" /> Primary Email
              </Label>
              <Input
                id="primary_email"
                type="email"
                value={settings.primary_email}
                onChange={(e) => handleChange('primary_email', e.target.value)}
                placeholder="accounts@company.com"
                data-testid="primary-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary_email">Secondary Email</Label>
              <Input
                id="secondary_email"
                type="email"
                value={settings.secondary_email}
                onChange={(e) => handleChange('secondary_email', e.target.value)}
                placeholder="support@company.com (optional)"
                data-testid="secondary-email-input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone Number
              </Label>
              <Input
                id="phone"
                value={settings.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+91 98765 43210"
                data-testid="phone-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website" className="flex items-center gap-1">
                <Globe className="w-3 h-3" /> Website
              </Label>
              <Input
                id="website"
                value={settings.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://www.company.com"
                data-testid="website-input"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="w-5 h-5 text-slate-500" />
            Branding
          </CardTitle>
          <CardDescription>Logo and colors for documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Upload */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Company Logo</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                {settings.logo_base64 ? (
                  <div className="relative inline-block">
                    <img 
                      src={settings.logo_base64} 
                      alt="Company Logo" 
                      className="max-h-20 max-w-full object-contain"
                      data-testid="logo-preview"
                    />
                    <button
                      onClick={() => handleChange('logo_base64', null)}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      data-testid="remove-logo-btn"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, 'logo')}
                      className="hidden"
                      data-testid="logo-upload-input"
                    />
                    <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span className="text-sm text-slate-500">Click to upload logo</span>
                    <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 2MB</p>
                  </label>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <Label>Favicon</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                {settings.favicon_base64 ? (
                  <div className="relative inline-block">
                    <img 
                      src={settings.favicon_base64} 
                      alt="Favicon" 
                      className="max-h-12 max-w-full object-contain"
                      data-testid="favicon-preview"
                    />
                    <button
                      onClick={() => handleChange('favicon_base64', null)}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      data-testid="remove-favicon-btn"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, 'favicon')}
                      className="hidden"
                      data-testid="favicon-upload-input"
                    />
                    <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span className="text-sm text-slate-500">Click to upload favicon</span>
                    <p className="text-xs text-slate-400 mt-1">32x32 or 64x64 recommended</p>
                  </label>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Primary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="primary_color"
                  value={settings.primary_color}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                  data-testid="primary-color-picker"
                />
                <Input
                  value={settings.primary_color}
                  onChange={(e) => handleChange('primary_color', e.target.value)}
                  className="w-28 font-mono text-sm"
                  data-testid="primary-color-input"
                />
                <Badge variant="outline" className="text-xs">Used subtly in documents</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary_color">Secondary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="secondary_color"
                  value={settings.secondary_color}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                  data-testid="secondary-color-picker"
                />
                <Input
                  value={settings.secondary_color}
                  onChange={(e) => handleChange('secondary_color', e.target.value)}
                  className="w-28 font-mono text-sm"
                  data-testid="secondary-color-input"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" />
            Document Settings
          </CardTitle>
          <CardDescription>Default settings for receipts and invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="authorized_signatory">Authorized Signatory Name</Label>
            <Input
              id="authorized_signatory"
              value={settings.authorized_signatory}
              onChange={(e) => handleChange('authorized_signatory', e.target.value)}
              placeholder="Name to appear on receipts"
              data-testid="signatory-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receipt_footer_note">Receipt Footer Note</Label>
            <Input
              id="receipt_footer_note"
              value={settings.receipt_footer_note}
              onChange={(e) => handleChange('receipt_footer_note', e.target.value)}
              placeholder="e.g., This is a system-generated receipt."
              data-testid="footer-note-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end pt-4">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          size="lg"
          className="bg-slate-800 hover:bg-slate-900"
          data-testid="save-settings-btn-bottom"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Company Profile
        </Button>
      </div>
    </div>
  );
};

export default CompanyProfile;
