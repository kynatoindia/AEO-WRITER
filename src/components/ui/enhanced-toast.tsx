'use client';

import { toast as sonnerToast } from 'sonner';
import { CheckCircle, AlertCircle, Info, X, Sparkles } from 'lucide-react';

interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const toast = {
  success: (message: string, options?: ToastOptions) => {
    return sonnerToast.custom((t) => (
      <div className="glass-card p-4 rounded-2xl border border-green-500/20 bg-gradient-to-r from-green-500/10 to-emerald-500/5 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-green-500/20 border border-green-500/30">
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-white">{options?.title || 'Success'}</p>
              <button
                onClick={() => sonnerToast.dismiss(t)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <p className="text-sm text-white/80 mt-1">{message}</p>
            {options?.action && (
              <button
                onClick={options.action.onClick}
                className="text-sm text-green-400 hover:text-green-300 mt-2 font-medium"
              >
                {options.action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    ), {
      duration: options?.duration || 4000,
    });
  },

  error: (message: string, options?: ToastOptions) => {
    return sonnerToast.custom((t) => (
      <div className="glass-card p-4 rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/10 to-pink-500/5 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-red-500/20 border border-red-500/30">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-white">{options?.title || 'Error'}</p>
              <button
                onClick={() => sonnerToast.dismiss(t)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <p className="text-sm text-white/80 mt-1">{message}</p>
            {options?.action && (
              <button
                onClick={options.action.onClick}
                className="text-sm text-red-400 hover:text-red-300 mt-2 font-medium"
              >
                {options.action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    ), {
      duration: options?.duration || 6000,
    });
  },

  info: (message: string, options?: ToastOptions) => {
    return sonnerToast.custom((t) => (
      <div className="glass-card p-4 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-cyan-500/5 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/30">
            <Info className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-white">{options?.title || 'Info'}</p>
              <button
                onClick={() => sonnerToast.dismiss(t)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <p className="text-sm text-white/80 mt-1">{message}</p>
            {options?.action && (
              <button
                onClick={options.action.onClick}
                className="text-sm text-blue-400 hover:text-blue-300 mt-2 font-medium"
              >
                {options.action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    ), {
      duration: options?.duration || 4000,
    });
  },

  magic: (message: string, options?: ToastOptions) => {
    return sonnerToast.custom((t) => (
      <div className="glass-card p-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-purple-500/5 backdrop-blur-sm relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 animate-gradient" />
        
        <div className="flex items-start gap-3 relative z-10">
          <div className="p-2 rounded-xl bg-primary/20 border border-primary/30">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gradient-primary">{options?.title || 'AI Magic'}</p>
              <button
                onClick={() => sonnerToast.dismiss(t)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <p className="text-sm text-white/80 mt-1">{message}</p>
            {options?.action && (
              <button
                onClick={options.action.onClick}
                className="text-sm text-primary hover:text-primary/80 mt-2 font-medium"
              >
                {options.action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    ), {
      duration: options?.duration || 5000,
    });
  },

  promise: <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return sonnerToast.promise(promise, {
      loading: (
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span>{loading}</span>
        </div>
      ),
      success: (data) => ({
        title: 'Success',
        description: typeof success === 'function' ? success(data) : success,
      }),
      error: (err) => ({
        title: 'Error',
        description: typeof error === 'function' ? error(err) : error,
      }),
    });
  },
};