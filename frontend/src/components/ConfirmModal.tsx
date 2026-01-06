import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'हां, सुनिश्चित करें (Confirm)',
  cancelText = 'रद्द करें (Cancel)',
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sautuk-dark/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-sautuk-card border border-sautuk-dark/10 dark:border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between mb-5">
            <div className={`p-3 rounded-2xl ${isDestructive ? 'bg-sautuk-cta/10 text-sautuk-cta' : 'bg-sautuk-accent/10 text-sautuk-accent'} dark:bg-opacity-20`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <button 
              onClick={onCancel}
              className="p-2 text-sautuk-muted hover:text-sautuk-dark dark:text-sautuk-dark hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <h2 className="text-xl font-display font-bold text-sautuk-dark dark:text-sautuk-dark mb-3">
            {title}
          </h2>
          <p className="text-sautuk-muted dark:text-sautuk-dark/80 text-sm leading-relaxed mb-8">
            {message}
          </p>
          
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-sautuk-dark dark:text-sautuk-dark bg-slate-100 hover:bg-slate-200 dark:bg-white/20 dark:hover:bg-white/30 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm hover-lift ${isDestructive ? 'bg-sautuk-cta hover:bg-red-600' : 'bg-sautuk-accent hover:bg-sautuk-accent/90'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
