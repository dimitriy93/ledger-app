"use client";

import { formatMoney, formatPurchaseDate } from "@/lib/format";
import type { Purchase } from "@/storage/ledger-storage";

interface PurchaseListProps {
  purchases: Purchase[];
  /** Used as the animation key so a newly added item animates in. */
  animationSeed?: string;
  onEdit: (purchase: Purchase) => void;
  onDelete: (purchase: Purchase) => void;
}

export default function PurchaseList({
  purchases,
  animationSeed,
  onEdit,
  onDelete,
}: PurchaseListProps) {
  return (
    <section aria-label="Покупки" className="animate-fade-up [animation-delay:120ms]">
      <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
        Покупки
      </h2>

      {purchases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
          <p className="font-semibold text-text">Пока нет покупок</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Добавляйте расходы,
            <br />
            чтобы видеть движение бюджета.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {purchases.map((purchase) => (
            <li
              key={animationSeed ? `${animationSeed}-${purchase.id}` : purchase.id}
              className="group rounded-2xl border border-line bg-surface px-4 py-3.5 animate-item-in transition-colors hover:border-line-strong"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
                {formatPurchaseDate(purchase.createdAt)}
              </p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="min-w-0 flex-1 truncate font-semibold text-text">
                  {purchase.title}
                </p>
                <p className="shrink-0 font-semibold tabular text-text">
                  {formatMoney(purchase.amount)}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Редактировать покупку «${purchase.title}»`}
                    onClick={() => onEdit(purchase)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-accent active:scale-90"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label={`Удалить покупку «${purchase.title}»`}
                    onClick={() => onDelete(purchase)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-negative active:scale-90"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" x2="10" y1="11" y2="17" />
                      <line x1="14" x2="14" y1="11" y2="17" />
                    </svg>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
