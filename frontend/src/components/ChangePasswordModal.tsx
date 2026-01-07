import { useState } from 'react';
import { Lock, X, Loader2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { useToastStore } from '../store/useToastStore';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToastStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPassword || !newPassword || !confirmPassword) {
      addToast('कृपया सभी फ़ील्ड भरें।', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast('नए पासवर्ड मेल नहीं खाते। (New passwords do not match)', 'error');
      return;
    }

    if (newPassword.length < 6) {
      addToast('नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'पासवर्ड बदलने में विफल');
      }

      addToast('पासवर्ड सफलतापूर्वक बदल दिया गया है!', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sautuk-dark/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-sautuk-card border border-sautuk-dark/10 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between mb-5">
            <div className="p-3 rounded-2xl bg-sautuk-accent/10 text-sautuk-accent dark:bg-opacity-20">
              <Lock className="w-6 h-6" />
            </div>
            <button 
              onClick={onClose}
              type="button"
              className="p-2 text-sautuk-muted hover:text-sautuk-dark dark:text-sautuk-dark hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <h2 className="text-xl font-display font-bold text-sautuk-dark dark:text-sautuk-dark mb-3">
            पासवर्ड बदलें
          </h2>
          <p className="text-sautuk-muted dark:text-sautuk-dark/80 text-sm leading-relaxed mb-6">
            अपने खाते को सुरक्षित रखने के लिए एक नया मजबूत पासवर्ड दर्ज करें।
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-sautuk-dark dark:text-sautuk-dark/90 mb-1.5 ml-1">
                पुराना पासवर्ड
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-white/10 text-sautuk-dark dark:text-white rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent/60 transition-colors"
                placeholder="अपना वर्तमान पासवर्ड दर्ज करें"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-sautuk-dark dark:text-sautuk-dark/90 mb-1.5 ml-1">
                नया पासवर्ड
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-white/10 text-sautuk-dark dark:text-white rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent/60 transition-colors"
                placeholder="नया पासवर्ड (कम से कम 6 अक्षर)"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-sautuk-dark dark:text-sautuk-dark/90 mb-1.5 ml-1">
                नए पासवर्ड की पुष्टि करें
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-black/10 border border-slate-200 dark:border-white/10 text-sautuk-dark dark:text-white rounded-xl px-4 py-3 outline-none focus:border-sautuk-accent/60 transition-colors"
                placeholder="नया पासवर्ड दोबारा दर्ज करें"
              />
            </div>
            
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end mt-6 pt-4 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-sautuk-dark dark:text-sautuk-dark bg-slate-100 hover:bg-slate-200 dark:bg-white/20 dark:hover:bg-white/30 transition-colors"
              >
                रद्द करें
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex justify-center items-center px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm hover-lift bg-sautuk-accent hover:bg-sautuk-accent/90 disabled:opacity-70 disabled:hover:bg-sautuk-accent min-w-[140px]"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'पासवर्ड बदलें'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
