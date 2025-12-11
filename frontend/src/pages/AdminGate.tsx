import { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../store/useAuthStore';
import { apiFetch } from '../services/api';
import { BookOpen, Lock, Mail, Loader2, AlertCircle, LogOut, Sun, Moon } from 'lucide-react';
import CategoriesTagsManager from './admin/CategoriesTagsManager';
import PostsManager from './admin/PostsManager';
import PostEditor from './admin/PostEditor';

export default function AdminGate() {
  const { user, setAuth, clearAuth, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Tab navigation states
  const [activeTab, setActiveTab] = useState<'posts' | 'taxonomy'>('posts');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  // Sync theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Check active session on mount (silent refresh token exchange)
  useEffect(() => {
    const checkSession = async () => {
      if (useAuthStore.getState().accessToken) {
        setCheckingSession(false);
        return;
      }
      try {
        const res = await apiFetch('/auth/refresh', {
          method: 'POST',
          skipAuth: true,
        });
        if (res.ok) {
          const data = await res.json();
          setAuth(data.accessToken, data.user);
        }
      } catch (err) {
        // Silent failure is expected if no cookie exists
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [setAuth]);

  // Render loading screen while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-sautuk-bg flex flex-col justify-center items-center font-sans text-sautuk-dark">
        <Loader2 className="w-10 h-10 animate-spin text-sautuk-accent mb-3" />
        <p className="text-sm font-semibold">अधिवेशन की पुष्टि की जा रही है...</p>
      </div>
    );
  }

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
        <header className="border-b border-sautuk-dark/10 bg-sautuk-bg/85 backdrop-blur-md px-4 lg:px-8 py-4 shadow-sm">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-sautuk-cta" />
              <span className="font-display text-xl font-black tracking-tight text-sautuk-dark">
                सौतुक एडमिन<span className="text-sautuk-accent">.</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-sautuk-muted font-bold hidden sm:inline-block">
                Logged in: <strong className="text-sautuk-dark">{user?.email}</strong>
              </span>
              
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full bg-sautuk-dark/5 dark:bg-white/5 hover:scale-105 transition-all text-sautuk-dark cursor-pointer"
                title="Toggle theme"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

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
      <div className="min-h-screen bg-sautuk-bg flex flex-col justify-center items-center font-sans p-4 relative">
        {/* Floating Theme Toggle */}
        <div className="absolute top-4 right-4">
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="p-2.5 rounded-full bg-sautuk-dark/5 dark:bg-white/5 hover:scale-105 transition-all text-sautuk-dark cursor-pointer"
            title="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Portal Container */}
        <div className="max-w-md w-full bg-white dark:bg-sautuk-card rounded-3xl p-8 shadow-lg border border-sautuk-dark/5">
          {/* Logo & Headline */}
          <div className="text-center mb-8">
            <div className="flex justify-center items-center gap-2 mb-2">
              <BookOpen className="w-8 h-8 text-sautuk-cta" />
              <span className="font-display text-2xl font-black tracking-tight text-sautuk-dark">
                सौतुक<span className="text-sautuk-accent">.</span>
              </span>
            </div>
            <h2 className="font-display font-black text-xl text-sautuk-dark">एडमिन एक्सेस गेट</h2>
            <p className="text-xs text-sautuk-muted mt-1">क्रेडेंशियल दर्ज करें या अपने Google खाते से लॉगिन करें</p>
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
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">ईमेल पता</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-sautuk-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sautuk.com"
                  className="w-full bg-slate-50 dark:bg-sautuk-bg/20 border border-slate-200 dark:border-sautuk-dark/15 text-sautuk-dark text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-sautuk-accent transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-sautuk-dark mb-1.5">पासवर्ड</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-sautuk-muted" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-sautuk-bg/20 border border-slate-200 dark:border-sautuk-dark/15 text-sautuk-dark text-sm rounded-xl pl-10 pr-4 py-3 outline-none focus:border-sautuk-accent transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sautuk-dark dark:bg-sautuk-accent text-sautuk-bg font-bold py-3 rounded-full hover:scale-[1.02] transition-all text-sm shadow-md flex justify-center items-center gap-1 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'डैशबोर्ड में प्रवेश करें'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-grow border-t border-slate-100 dark:border-sautuk-dark/15"></div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-sautuk-muted px-3">या इसके साथ जारी रखें</span>
            <div className="flex-grow border-t border-slate-100 dark:border-sautuk-dark/15"></div>
          </div>

          {/* Google OAuth Login Container */}
          <div className="flex justify-center">
            {googleClientId.startsWith('your-google-') ? (
              <div className="text-center p-3 border border-dashed border-amber-200 dark:border-amber-900/50 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 text-[10px] text-amber-800 dark:text-amber-300">
                ⚠️ स्थानीय वातावरण: Google Auth का परीक्षण करने के लिए .env में क्लाइंट आईडी बदलें
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('गूगल साइन-इन विफल रहा')}
                useOneTap
              />
            )}
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
