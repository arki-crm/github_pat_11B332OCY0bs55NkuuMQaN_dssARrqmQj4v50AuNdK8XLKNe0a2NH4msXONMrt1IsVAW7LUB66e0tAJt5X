import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  ArrowLeft, 
  Loader2, 
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LEAD_SOURCES = ['Meta', 'Walk-in', 'Referral', 'Others'];

const CreateLead = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    customer_requirements: '',
    source: 'Others',
    budget: '',
    status: 'New'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.customer_name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!formData.customer_phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API}/leads`, {
        ...formData,
        budget: formData.budget ? parseFloat(formData.budget) : null
      }, {
        withCredentials: true
      });
      
      toast.success('Lead created successfully!');
      navigate(`/leads/${response.data.lead_id}`);
    } catch (err) {
      console.error('Failed to create lead:', err);
      toast.error(err.response?.data?.detail || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  // Check permissions
  if (!['Admin', 'SalesManager', 'PreSales'].includes(user?.role)) {
    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/leads')}
          className="text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Leads
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 text-center text-red-700">
            You don't have permission to create leads.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => navigate('/leads')}
        className="text-slate-600 hover:text-slate-900 -ml-2"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Leads
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Lead</h1>
        <p className="text-slate-500 mt-1">Add a new lead manually (referrals, imports, walk-ins)</p>
      </div>

      {/* Form */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Name */}
            <div className="space-y-2">
              <Label htmlFor="customer_name" className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                Customer Name *
              </Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                placeholder="Enter customer name"
                required
              />
            </div>

            {/* Phone and Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_phone" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  Phone Number *
                </Label>
                <Input
                  id="customer_phone"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                  placeholder="Enter phone number"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer_email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  Email
                </Label>
                <Input
                  id="customer_email"
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
                  placeholder="Enter email address"
                />
              </div>
            </div>

            {/* Source and Budget */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source" className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-slate-400" />
                  Lead Source
                </Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map(src => (
                      <SelectItem key={src} value={src}>{src}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  Budget (₹)
                </Label>
                <Input
                  id="budget"
                  type="number"
                  value={formData.budget}
                  onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                  placeholder="Enter budget"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="customer_address" className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                Address
              </Label>
              <Input
                id="customer_address"
                value={formData.customer_address}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_address: e.target.value }))}
                placeholder="Enter full address"
              />
            </div>

            {/* Requirements */}
            <div className="space-y-2">
              <Label htmlFor="customer_requirements" className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Customer Requirements / Brief
              </Label>
              <Textarea
                id="customer_requirements"
                value={formData.customer_requirements}
                onChange={(e) => setFormData(prev => ({ ...prev, customer_requirements: e.target.value }))}
                placeholder="Enter customer requirements or project brief"
                rows={4}
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/leads')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Lead'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateLead;
