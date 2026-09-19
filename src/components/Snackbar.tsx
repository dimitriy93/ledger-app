"use client";

import { useEffect } from "react";

interface SnackbarProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export default function Snackbar({
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 5000,
}: SnackbarProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-50 flex justify-center px-4 pointer-events-none animate-snackbar-in">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-[440px] items-center justify-between gap-4 rounded-xl border border-line-strong bg-surface-2 px-4 py-3 shadow-xl shadow-black/50"
      >
        <p className="text-sm font-medium text-text">{message}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={() => {
              onAction();
              onDismiss();
            }}
            className="shrink-0 text-sm font-bold uppercase tracking-wide text-accent-strong transition-colors hover:text-accent active:scale-95"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
