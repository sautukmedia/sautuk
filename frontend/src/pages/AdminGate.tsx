import { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../store/useAuthStore';
import { apiFetch } from '../services/api';
import { BookOpen, Lock, Mail, Loader2, AlertCircle, LogOut } from 'lucide-react';
import CategoriesTagsManager from './admin/CategoriesTagsManager';
import PostsManager from './admin/PostsManager';
import PostEditor from './admin/PostEditor';

export default function AdminGate() {
  const { user, setAuth, clearAuth, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab navigation states
  const [activeTab, setActiveTab] = useState<'posts' | 'taxonomy'>('posts');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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

  // Render Admin Dashboard layout if Authenticated
  if (isAuthenticated()) {
    return (
      <div className="min-h-screen bg-sautuk-bg flex flex-col font-sans">
        {/* Admin Header */}
        <header className="border-b border-sautuk-dark/10 bg-white/80 backdrop-blur-md px-4 lg:px-8 py-4 shadow-sm">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-sautuk-cta" />
              <span className="font-display text-xl font-black tracking-tight text-sautuk-dark">
                SAUTUK ADMIN<span className="text-sautuk-accent">.</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-sautuk-muted font-bold hidden sm:inline-block">
                Logged in: <strong className="text-sautuk-dark">{user?.email}</strong>
              </span>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="flex items-center gap-1.5 bg-sautuk-cta/15 text-sautuk-cta hover:bg-sautuk-cta hover:text-white font-extrabold px-4.5 py-2 rounded-full text-xs transition-all disabled:opacity-50 hover:scale-105 active:scale-95 cursor-pointer"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 w-full flex-grow">
          {/* Navigation Tabs */}
          {!isCreating && !editingPostId && (
            <div className="flex gap-4 border-b border-sautuk-dark/10 mb-8 text-xs font-bold uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setActiveTab('posts')}
                className={`pb-3.5 border-b-2 px-1 transition-colors cursor-pointer ${
                  activeTab === 'posts'
                    ? 'border-sautuk-accent text-sautuk-accent'
                    : 'border-transparent text-sautuk-muted hover:text-sautuk-dark'
                }`}
              >
                Journal Columns
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('taxonomy')}
                className={`pb-3.5 border-b-2 px-1 transition-colors cursor-pointer ${
                  activeTab === 'taxonomy'
                    ? 'border-sautuk-accent text-sautuk-accent'
                    : 'border-transparent text-sautuk-muted hover:text-sautuk-dark'
                }`}
              >
                Taxonomy & Setup
              </button>
            </div>
          )}

          {/* Render Tab Contents */}
          {activeTab === 'posts' ? (
            isCreating || editingPostId ? (
              <PostEditor 
                postId={editingPostId}
                onClose={() => {
                  setIsCreating(false);
                  setEditingPostId(null);
                }}
              />
            ) : (
              <PostsManager 
                onCreateClick={() => setIsCreating(true)}
                onEditClick={(id) => setEditingPostId(id)}
              />
            )
          ) : (
            <div>
              <div className="mb-6 flex justify-between items-end">
                <div>
                  <h1 className="font-display font-black text-2xl lg:text-3xl text-sautuk-dark tracking-tight leading-tight">Taxonomy & Category Setup</h1>
                  <p className="text-xs text-sautuk-muted font-semibold">Manage site categories, tags, and indexing slugs</p>
                </div>
              </div>
              <CategoriesTagsManager />
            </div>
          )}
        </main>
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
