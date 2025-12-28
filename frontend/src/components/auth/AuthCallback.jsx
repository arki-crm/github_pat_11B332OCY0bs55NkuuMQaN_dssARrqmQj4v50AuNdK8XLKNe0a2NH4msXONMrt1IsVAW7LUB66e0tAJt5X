import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { login, setUserFromCallback } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Get session_id from URL fragment
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.replace('#', ''));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          console.error('No session_id found in URL');
          navigate('/login', { replace: true });
          return;
        }

        // Exchange session_id for session_token
        const userData = await login(sessionId);
        
        // Set user data and redirect to dashboard
        setUserFromCallback(userData);
        
        // Clean URL and redirect
        window.history.replaceState({}, document.title, '/dashboard');
        navigate('/dashboard', { replace: true, state: { user: userData } });
        
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login', { replace: true });
      }
    };

    processAuth();
  }, [login, navigate, setUserFromCallback]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" data-testid="auth-callback">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-slate-600 text-sm">Signing you in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
