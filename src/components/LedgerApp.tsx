"use client";

import { useCallback, useState } from "react";
import BalanceCard from "./BalanceCard";
import HistoryView from "./HistoryView";
import PurchaseList from "./PurchaseList";
import PurchaseSheet from "./PurchaseSheet";
import SettingsView from "./SettingsView";
import Snackbar from "./Snackbar";
import { useLedger } from "@/lib/useLedger";
import type { Purchase } from "@/storage/ledger-storage";

type Tab = "home" | "history" | "settings";

interface SheetState {
  mode: "add" | "edit";
  periodId?: string;
  purchase?: Purchase;
}

interface UndoState {
  periodId: string;
  purchase: Purchase;
  index: number;
}

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "home",
    label: "Главная",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "История",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Настройки",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="4" x2="20" y1="7" y2="7" />
        <line x1="4" x2="20" y1="12" y2="12" />
        <line x1="4" x2="20" y1="17" y2="17" />
        <circle cx="9" cy="7" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="8" cy="17" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

export default function LedgerApp() {
  const ledger = useLedger();
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [snackbar, setSnackbar] = useState<{
    message: string;
    undo?: UndoState;
  } | null>(null);

  const ready = ledger.ready;
  const currentPeriod = ledger.getCurrentPeriod();
  // History is the immutable snapshot of completed periods.
  const pastPeriods = (ledger.data?.periods ?? []).filter(
    (p) => p.status === "completed"
  );

  const onNoticeMessage = useCallback((message: string) => {
    setSnackbar({ message });
  }, []);

  const handleDelete = useCallback(
    (purchase: Purchase) => {
      if (!currentPeriod) return;
      const result = ledger.deletePurchase(currentPeriod.id, purchase.id);
      if (result) {
        setSnackbar({
          message: "Покупка удалена",
          undo: {
            periodId: result.periodId,
            purchase: result.purchase,
            index: result.index,
          },
        });
      }
    },
    [currentPeriod, ledger]
  );

  const handleSheetSubmit = useCallback(
    (title: string, amount: number) => {
      if (!sheet) return;
      if (sheet.mode === "edit" && sheet.periodId && sheet.purchase) {
        ledger.editPurchase(sheet.periodId, sheet.purchase.id, { title, amount });
      } else {
        ledger.addPurchase({ title, amount });
      }
      setSheet(null);
    },
    [sheet, ledger]
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5">
      {/* Header */}
      <header className="flex items-center gap-3 pt-8 pb-6 animate-fade-up">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-accent"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="5" x2="19" y1="6" y2="6" />
            <line x1="5" x2="19" y1="12" y2="12" />
            <line x1="5" x2="13" y1="18" y2="18" />
          </svg>
        </span>
        <div>
          <h1 className="text-lg font-extrabold leading-tight tracking-tight">Ledger</h1>
          <p className="text-xs text-muted">Финансовый регистр</p>
        </div>
      </header>

      <main className="flex-1 pb-36">
        {!ready || !currentPeriod ? (
          <div className="space-y-4" aria-hidden="true">
            <div className="h-64 rounded-3xl border border-line bg-surface/60" />
            <div className="h-14 rounded-xl bg-accent-dim" />
            <div className="h-24 rounded-2xl border border-line bg-surface/60" />
          </div>
        ) : tab === "home" ? (
          <div className="space-y-6">
            {/* Keyed by period id so completing a period animates the new one in. */}
            <BalanceCard key={currentPeriod.id} period={currentPeriod} />

            <button
              type="button"
              onClick={() => setSheet({ mode: "add" })}
              className="h-14 w-full rounded-2xl bg-accent text-base font-bold text-[#062033] shadow-lg shadow-accent/20 transition hover:bg-accent-strong active:scale-[0.98] animate-fade-up [animation-delay:60ms]"
            >
              + Добавить покупку
            </button>

            <PurchaseList
              purchases={currentPeriod.purchases}
              onEdit={(purchase) =>
                setSheet({ mode: "edit", periodId: currentPeriod.id, purchase })
              }
              onDelete={handleDelete}
            />
          </div>
        ) : tab === "history" ? (
          <div className="space-y-6">
            <div className="animate-fade-up">
              <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                История
              </h2>
              <HistoryView periods={pastPeriods} />
            </div>
          </div>
        ) : (
          <SettingsView
            data={ledger.data!}
            currentPeriod={currentPeriod}
            nextBudget={ledger.data!.nextBudget}
            onBudgetChange={ledger.setNextBudget}
            onCompletePeriod={() => {
              const previous = ledger.completeCurrentPeriod();
              if (previous) {
                onNoticeMessage("Расчётный период завершён — начат новый");
              }
            }}
            onImport={ledger.importData}
            onClearAll={ledger.clearAllData}
            onNotice={onNoticeMessage}
          />
        )}
      </main>

      {/* Bottom navigation */}
      <nav
        aria-label="Разделы"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur-md"
      >
        <div className="mx-auto flex w-full max-w-[480px] items-stretch justify-around pt-1.5">
          {NAV_ITEMS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1 text-[11px] font-semibold transition-colors active:scale-95 ${
                  active ? "text-accent" : "text-muted hover:text-text"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Purchase form sheet (keyed so each open starts from fresh state) */}
      <PurchaseSheet
        key={sheet ? `${sheet.mode}-${sheet.purchase?.id ?? "new"}` : "closed"}
        open={sheet !== null}
        editing={sheet?.mode === "edit" ? sheet.purchase : null}
        onClose={() => setSheet(null)}
        onSubmit={handleSheetSubmit}
      />

      {/* Undo / notices */}
      {snackbar ? (
        <Snackbar
          message={snackbar.message}
          actionLabel={snackbar.undo ? "Отменить" : undefined}
          onAction={
            snackbar.undo
              ? () =>
                  ledger.undoDelete(
                    snackbar.undo!.periodId,
                    snackbar.undo!.purchase,
                    snackbar.undo!.index
                  )
              : undefined
          }
          onDismiss={() => setSnackbar(null)}
        />
      ) : null}

      {/* Storage failure banner */}
      {ledger.storageError ? (
        <div className="fixed inset-x-0 top-0 z-70 flex justify-center px-4 pt-3">
          <div className="flex w-full max-w-[480px] items-center justify-between gap-3 rounded-xl border border-negative/30 bg-surface-2 px-4 py-3 shadow-xl">
            <p className="text-sm text-negative">{ledger.storageError}</p>
            <button
              type="button"
              onClick={ledger.dismissStorageError}
              aria-label="Скрыть сообщение об ошибке"
              className="shrink-0 text-sm font-bold text-muted hover:text-text"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
