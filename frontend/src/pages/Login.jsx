import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Mail, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Login = () => {
  const { isAuthenticated, loading, checkAuth } = useAuth();
  const navigate = useNavigate();
  
  // Local login state
  const [showLocalLogin, setShowLocalLogin] = useState(false);
  const [localEmail, setLocalEmail] = useState('');
  const [localPassword, setLocalPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    
    if (!localEmail || !localPassword) {
      toast.error('Please enter email and password');
      return;
    }
    
    try {
      setLocalLoading(true);
      const response = await axios.post(`${API_URL}/api/auth/local-login`, {
        email: localEmail,
        password: localPassword
      }, { withCredentials: true });
      
      if (response.data.success) {
        toast.success('Login successful!');
        // Refresh user context and navigate
        await checkAuth();
        // Force navigation after a short delay to ensure state is updated
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 100);
      }
    } catch (err) {
      console.error('Local login failed:', err);
      toast.error(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSetupLocalAdmin = async () => {
    try {
      setSetupLoading(true);
      const response = await axios.post(`${API_URL}/api/auth/setup-local-admin`, {}, { withCredentials: true });
      
      if (response.data.success) {
        toast.success('Local admin setup complete! You can now login.');
        setLocalEmail('thaha.pakayil@gmail.com');
        setLocalPassword('password123');
      }
    } catch (err) {
      console.error('Setup failed:', err);
      toast.error(err.response?.data?.detail || 'Failed to setup local admin');
    } finally {
      setSetupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" data-testid="login-loading">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4" data-testid="login-page">
      <Card className="w-full max-w-md shadow-lg border-slate-200">
        <CardHeader className="text-center pb-2">
          {/* Logo */}
          <div className="mx-auto mb-4 w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-2xl" style={{ fontFamily: 'Manrope, sans-serif' }}>A</span>
          </div>
          <CardTitle 
            className="text-2xl font-bold text-slate-900"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Welcome to Arkiflo
          </CardTitle>
          <CardDescription className="text-slate-500">
            Interior Design Workflow System
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Google OAuth Button */}
          <Button
            onClick={handleGoogleLogin}
            className="w-full h-11 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm"
            data-testid="google-login-button"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>
          
          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">Or</span>
            </div>
          </div>
          
          {/* Local Login Toggle */}
          <Button
            type="button"
            variant="ghost"
            className="w-full text-slate-600 hover:text-slate-900"
            onClick={() => setShowLocalLogin(!showLocalLogin)}
          >
            {showLocalLogin ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
            Local Admin Login
          </Button>
          
          {/* Local Login Form */}
          {showLocalLogin && (
            <form onSubmit={handleLocalLogin} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="thaha.pakayil@gmail.com"
                    value={localEmail}
                    onChange={(e) => setLocalEmail(e.target.value)}
                    className="pl-10"
                    data-testid="local-email-input"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={localPassword}
                    onChange={(e) => setLocalPassword(e.target.value)}
                    className="pl-10"
                    data-testid="local-password-input"
                  />
                </div>
              </div>
              
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={localLoading}
                data-testid="local-login-button"
              >
                {localLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Login with Email
              </Button>
              
              {/* Setup Local Admin Button */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2 text-center">
                  First time? Setup local admin account:
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-sm"
                  onClick={handleSetupLocalAdmin}
                  disabled={setupLoading}
                >
                  {setupLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Setup Local Admin
                </Button>
              </div>
            </form>
          )}
          
          <p className="mt-4 text-center text-xs text-slate-500">
            By signing in, you agree to our{' '}
            <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
