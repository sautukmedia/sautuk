import { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../store/useAuthStore';
import { apiFetch } from '../services/api';
import { BookOpen, Lock, Mail, Loader2, AlertCircle, LogOut, CheckCircle } from 'lucide-react';

export default function AdminGate() {
  const { user, accessToken, setAuth, clearAuth, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id.apps.googleusercontent.com';

  // Credentials Login Handler
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await res.json();
      setAuth(data.accessToken, data.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Success Handler
  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/auth/google-login', {
        method: 'POST',
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Google OAuth authentication failed');
      }

      const data = await res.json();
      setAuth(data.accessToken, data.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    setLoading(true);
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore logout error and clear auth anyway
    } finally {
      clearAuth();
      setLoading(false);
    }
  };

  // Render Admin Dashboard Placeholder if Authenticated
  if (isAuthenticated()) {
    return (
      <div className="min-h-screen bg-sautuk-bg flex flex-col justify-center items-center font-sans p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-lg border border-sautuk-dark/5 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h1 className="font-display font-black text-2xl text-sautuk-dark mb-2">Admin Session Active</h1>
          <p className="text-sautuk-muted text-sm mb-6">
            Welcome back, <strong className="text-sautuk-dark">{user?.email}</strong>.
            You are authenticated under the role <span className="bg-sautuk-accent/20 text-sautuk-dark text-xs font-bold uppercase px-2 py-0.5 rounded-full">{user?.role}</span>.
          </p>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-left text-xs mb-6 font-mono text-sautuk-dark break-all">
            <span className="block font-semibold uppercase tracking-wider text-[10px] text-sautuk-muted mb-1">Access Token:</span>
            {accessToken?.substring(0, 30)}...
          </div>

          <button
            onClick={handleLogout}
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 bg-sautuk-cta text-white font-bold py-3 rounded-full hover:bg-sautuk-cta/90 transition-all shadow-md shadow-sautuk-cta/10 text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Logout Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <div className="min-h-screen bg-sautuk-bg flex flex-col justify-center items-center font-sans p-4">
        {/* Portal Container */}
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-lg border border-sautuk-dark/5">
          {/* Logo & Headline */}
          <div className="text-center mb-8">
            <div className="flex justify-center items-center gap-2 mb-2">
              <BookOpen className="w-8 h-8 text-sautuk-cta" />
              <span className="font-display text-2xl font-black tracking-tight text-sautuk-dark">
                SAUTUK<span className="text-sautuk-accent">.</span>
              </span>
            </div>
            <h2 className="font-display font-black text-xl text-sautuk-dark">Admin Access Gate</h2>
            <p className="text-xs text-sautuk-muted mt-1">Provide credentials or sign in with your Google account</p>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="mb-5 bg-sautuk-cta/10 border border-sautuk-cta/20 text-sautuk-cta text-xs rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-sautuk-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sautuk.com"
                  className="w-full bg-slate-50 border border-slate-200 text-sautuk-dark text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-sautuk-accent transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-sautuk-muted" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 text-sautuk-dark text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-sautuk-accent transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sautuk-dark text-white font-bold py-3 rounded-full hover:bg-sautuk-dark/95 transition-all text-sm shadow-md flex justify-center items-center gap-1 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Access Dashboard'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-sautuk-muted px-3">Or continue with</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* Google OAuth Login Container */}
          <div className="flex justify-center">
            {googleClientId.startsWith('your-google-') ? (
              <div className="text-center p-3 border border-dashed border-amber-200 rounded-xl bg-amber-50/50 text-[10px] text-amber-800">
                ⚠️ Local environment: Replace client ID in `.env` to test Google Auth
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google Sign-In failed internally')}
                useOneTap
              />
            )}
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
