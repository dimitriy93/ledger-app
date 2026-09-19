"use client";

import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** Rich dialog body (rendered instead of `description` when set). */
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "Отмена",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Закрыть диалог"
        className="absolute inset-0 bg-black/60 animate-fade-in cursor-default"
        onClick={onCancel}
        tabIndex={-1}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl shadow-black/50 animate-fade-up">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children ? (
          children
        ) : description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 rounded-xl border border-line-strong px-4 text-sm font-semibold text-text transition-colors hover:bg-surface-2 active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-11 flex-1 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] ${
              destructive
                ? "bg-negative/15 text-negative hover:bg-negative/25"
                : "bg-accent-dim text-accent-strong hover:bg-accent-dim/70"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
