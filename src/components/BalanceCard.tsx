"use client";

import AnimatedNumber from "./AnimatedNumber";
import { formatDayCount, formatMoney, formatPeriodStart } from "@/lib/format";
import { getDayNumber, sumPurchases, type LedgerPeriod } from "@/lib/periods";

interface BalanceCardProps {
  period: LedgerPeriod;
}

export default function BalanceCard({ period }: BalanceCardProps) {
  const spent = sumPurchases(period);
  const balance = period.budget - spent;
  const overBudget = balance < 0;
  // Progress of money spent; stays full past 100% instead of growing wildly.
  const progress = Math.min(100, Math.max(0, (spent / Math.max(1, period.budget)) * 100));

  return (
    <section
      aria-label="Текущий баланс"
      className="rounded-3xl border border-line bg-gradient-to-b from-surface-2 to-surface p-6 sm:p-7 shadow-xl shadow-black/30 animate-fade-up"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
        Текущий баланс
      </p>

      <div className="mt-3">
        <AnimatedNumber
          value={balance}
          format={formatMoney}
          className={`text-[44px] leading-none font-extrabold tracking-tight sm:text-5xl ${
            overBudget ? "text-negative" : "text-text"
          }`}
        />
        <p className="mt-2 text-sm text-muted tabular">из {formatMoney(period.budget)}</p>
      </div>

      <p className="mt-4 text-xs font-medium tracking-wide text-muted">
        Начало с {formatPeriodStart(period.startDate)} · {formatDayCount(getDayNumber(period))}
      </p>

      <div
        className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-accent-dim"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Доля потраченного бюджета"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            overBudget ? "bg-negative" : "bg-accent"
          }`}
          style={{ width: `${overBudget ? 100 : progress}%` }}
        />
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            Потрачено
          </p>
          <p className="mt-1 text-lg font-semibold tabular">{formatMoney(spent)}</p>
        </div>
        {overBudget ? (
          <p className="text-sm font-medium text-negative">перерасход</p>
        ) : null}
      </div>
    </section>
  );
}
