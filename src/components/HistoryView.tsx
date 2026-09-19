"use client";

import { useState } from "react";
import { formatMoney, formatPeriodRangeShort } from "@/lib/format";
import { getBalance, sumPurchases, type LedgerPeriod } from "@/lib/periods";
import type { Purchase } from "@/storage/ledger-storage";

interface HistoryViewProps {
  /** All periods, newest first; the current one is excluded by the caller. */
  periods: LedgerPeriod[];
}

export default function HistoryView({ periods }: HistoryViewProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (periods.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center animate-fade-up">
        <p className="font-semibold text-text">История пока пуста</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Здесь появятся завершённые периоды
          <br />
          и расходы за каждый из них.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {periods.map((period) => {
        const spent = sumPurchases(period);
        const balance = getBalance(period);
        const open = openId === period.id;

        return (
          <article
            key={period.id}
            className="overflow-hidden rounded-2xl border border-line bg-surface animate-fade-up transition-colors hover:border-line-strong"
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : period.id)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <div>
                <p className="font-semibold text-text tabular">
                  {formatPeriodRangeShort(period.startDate, period.endDate)}
                </p>
                <p className="mt-1 text-sm text-muted tabular">
                  Расходы {formatMoney(spent)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  Остаток
                </p>
                <p
                  className={`mt-1 font-semibold tabular ${
                    balance < 0 ? "text-negative" : "text-text"
                  }`}
                >
                  {formatMoney(balance)}
                </p>
              </div>
            </button>

            {open ? (
              <div className="border-t border-line px-5 py-4 animate-fade-in">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  Бюджет {formatMoney(period.budget)}
                </p>
                {period.purchases.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">В этом периоде не было покупок.</p>
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {[...period.purchases]
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .map((purchase: Purchase) => (
                        <li
                          key={purchase.id}
                          className="flex items-baseline justify-between gap-3 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate text-text">
                            {purchase.title}
                          </span>
                          <span className="shrink-0 text-muted tabular">
                            {formatMoney(purchase.amount)}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
                <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
                  <p className="text-sm font-semibold text-muted">Конечный остаток</p>
                  <p
                    className={`font-bold tabular ${
                      balance < 0 ? "text-negative" : "text-positive"
                    }`}
                  >
                    {formatMoney(balance)}
                  </p>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
