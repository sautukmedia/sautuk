import { useToastStore } from '../store/useToastStore';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        let styles = '';
        let Icon = Info;

        switch (toast.type) {
          case 'success':
            Icon = CheckCircle2;
            styles = 'bg-emerald-50/95 border-emerald-200/60 text-emerald-900 dark:bg-emerald-950/95 dark:border-emerald-800/40 dark:text-emerald-100';
            break;
          case 'error':
            Icon = AlertCircle;
            styles = 'bg-rose-50/95 border-rose-200/60 text-rose-900 dark:bg-rose-950/95 dark:border-rose-800/40 dark:text-rose-100';
            break;
          default:
            Icon = Info;
            styles = 'bg-indigo-50/95 border-indigo-200/60 text-indigo-900 dark:bg-indigo-950/95 dark:border-indigo-800/40 dark:text-indigo-100';
        }

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 border p-4.5 rounded-2xl shadow-lg backdrop-blur-md transition-all duration-300 pointer-events-auto animate-slide-in hover:scale-[1.01] ${styles}`}
            style={{
              animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5 text-sautuk-accent" />
            <div className="flex-grow text-xs font-semibold leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded-lg text-sautuk-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%) translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateX(0) translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
