"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";
import type { Purchase } from "@/storage/ledger-storage";

interface PurchaseSheetProps {
  open: boolean;
  /** When set, the sheet edits this purchase instead of creating a new one. */
  editing?: Purchase | null;
  onClose: () => void;
  onSubmit: (title: string, amount: number) => void;
}

/** Groups digits with thin spaces while typing: "1290" -> "1 290". */
function groupDigits(raw: string): string {
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function stripDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 7);
}

export default function PurchaseSheet({
  open,
  editing,
  onClose,
  onSubmit,
}: PurchaseSheetProps) {
  // State is initialized from props; LedgerApp remounts this component with a
  // new key on every open, so no reset effect is needed.
  const [title, setTitle] = useState(() => (open ? (editing?.title ?? "") : ""));
  const [amountRaw, setAmountRaw] = useState(() => (open && editing ? String(editing.amount) : ""));
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const amount = useMemo(() => {
    const n = Number(amountRaw);
    return amountRaw && Number.isFinite(n) ? n : 0;
  }, [amountRaw]);

  useEffect(() => {
    if (!open) return;
    // Focus after the sheet starts animating in.
    const timer = window.setTimeout(() => titleRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const titleValid = title.trim().length > 0;
  const amountValid = amount > 0;
  const formValid = titleValid && amountValid;

  const handleSubmit = () => {
    setTouched(true);
    if (!formValid) return;
    onSubmit(title.trim(), amount);
  };

  const showTitleError = touched && !titleValid;
  const showAmountError = touched && !amountValid;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={editing ? "Редактировать покупку" : "Новая покупка"}>
      <button
        type="button"
        aria-label="Закрыть форму"
        tabIndex={-1}
        className="absolute inset-0 bg-black/60 animate-fade-in cursor-default"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[560px] rounded-t-3xl sm:rounded-3xl border border-line border-b-0 sm:border-b bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/60 animate-sheet-in">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line-strong sm:hidden" />

        <h2 className="text-xl font-bold">
          {editing ? "Редактировать покупку" : "Новая покупка"}
        </h2>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div>
            <label
              htmlFor="purchase-title"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted"
            >
              Что купили?
            </label>
            <input
              id="purchase-title"
              ref={titleRef}
              type="text"
              inputMode="text"
              enterKeyHint="next"
              autoComplete="off"
              maxLength={200}
              placeholder="Например, продукты"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  amountRef.current?.focus();
                }
              }}
              aria-invalid={showTitleError || undefined}
              className={`h-12 w-full rounded-xl border bg-surface-2 px-4 text-base text-text placeholder:text-muted/60 outline-none transition-colors focus:border-accent ${
                showTitleError ? "border-negative" : "border-line"
              }`}
            />
            {showTitleError ? (
              <p className="mt-1.5 text-xs text-negative">Введите название покупки</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="purchase-amount"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted"
            >
              Стоимость
            </label>
            <input
              id="purchase-amount"
              ref={amountRef}
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              autoComplete="off"
              placeholder="0 ₽"
              value={groupDigits(amountRaw)}
              onChange={(event) => setAmountRaw(stripDigits(event.target.value))}
              aria-invalid={showAmountError || undefined}
              className={`h-12 w-full rounded-xl border bg-surface-2 px-4 text-base text-text placeholder:text-muted/60 outline-none transition-colors focus:border-accent tabular ${
                showAmountError ? "border-negative" : "border-line"
              }`}
            />
            {showAmountError ? (
              <p className="mt-1.5 text-xs text-negative">
                Введите положительную стоимость в рублях
              </p>
            ) : amount > 0 ? (
              <p className="mt-1.5 text-xs text-muted">{formatMoney(amount)}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!formValid}
            className={`mt-2 h-13 w-full rounded-xl text-base font-bold transition active:scale-[0.98] ${
              formValid
                ? "bg-accent text-[#062033] hover:bg-accent-strong"
                : "bg-accent-dim text-muted cursor-not-allowed"
            }`}
          >
            {editing ? "Сохранить" : "Добавить"}
          </button>
        </form>
      </div>
    </div>
  );
}
