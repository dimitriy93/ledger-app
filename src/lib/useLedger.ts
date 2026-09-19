"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearLedger,
  generateId,
  loadLedger,
  parseImport,
  saveLedger,
  SCHEMA_VERSION,
  type LedgerData,
  type LedgerPeriod,
  type Purchase,
} from "@/storage/ledger-storage";
import { ensureCurrentPeriod, getPeriodById, periodContainsDate } from "./periods";

export interface NewPurchaseInput {
  title: string;
  amount: number;
}

function commit(data: LedgerData): LedgerData {
  saveLedger(data);
  return data;
}

function makePurchase(input: NewPurchaseInput): Purchase {
  return {
    id: generateId(),
    title: input.title,
    amount: input.amount,
    createdAt: new Date().toISOString(),
  };
}

function addPurchaseToPeriod(period: LedgerPeriod, purchase: Purchase): LedgerPeriod {
  return {
    ...period,
    purchases: [purchase, ...period.purchases],
  };
}

/**
 * Holds the ledger state as a view over storage: every mutation is persisted
 * to localStorage synchronously before state updates are exposed. The current
 * period is rolled over automatically on load, on focus and every minute.
 */
export function useLedger() {
  const [data, setData] = useState<LedgerData | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const dataRef = useRef<LedgerData | null>(null);

  const update = useCallback((updater: (data: LedgerData) => LedgerData) => {
    const current = dataRef.current;
    if (!current) return;
    try {
      const next = commit(updater(current));
      dataRef.current = next;
      setData(next);
      setStorageError(null);
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "Не удалось сохранить данные."
      );
    }
  }, []);

  // Initial load: read storage, roll the period over if the date changed.
  useEffect(() => {
    const loaded = loadLedger();
    const { data: withCurrent, created } = ensureCurrentPeriod(loaded);
    if (created) {
      try {
        saveLedger(withCurrent);
      } catch {
        /* surfaced on next mutation */
      }
    }
    dataRef.current = withCurrent;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating state from localStorage on mount
    setData(withCurrent);

    // Re-check the period when the app regains focus or the day flips.
    const checkRollover = () => {
      const current = dataRef.current;
      if (!current) return;
      const { data: next, created: rolled } = ensureCurrentPeriod(current);
      if (rolled) update(() => next);
    };
    const interval = window.setInterval(checkRollover, 60_000);
    window.addEventListener("focus", checkRollover);
    document.addEventListener("visibilitychange", checkRollover);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkRollover);
      document.removeEventListener("visibilitychange", checkRollover);
    };
  }, [update]);

  const getCurrentPeriod = useCallback((): LedgerPeriod | null => {
    if (!data) return null;
    const now = new Date();
    return (
      data.periods.find((p) => periodContainsDate(p, now)) ??
      // Fallback for a just-created period not yet in state.
      data.periods[0] ?? null
    );
  }, [data]);

  const addPurchase = useCallback(
    (input: NewPurchaseInput) => {
      const periodId = getCurrentPeriod()?.id;
      if (!periodId) return;
      const purchase = makePurchase(input);
      update((current) => ({
        ...current,
        periods: current.periods.map((p) =>
          p.id === periodId ? addPurchaseToPeriod(p, purchase) : p
        ),
      }));
    },
    [getCurrentPeriod, update]
  );

  const editPurchase = useCallback(
    (periodId: string, purchaseId: string, input: NewPurchaseInput) => {
      update((current) => ({
        ...current,
        periods: current.periods.map((p) =>
          p.id === periodId
            ? {
                ...p,
                purchases: p.purchases.map((purchase) =>
                  purchase.id === purchaseId
                    ? // createdAt stays untouched on edit.
                      { ...purchase, title: input.title, amount: input.amount }
                    : purchase
                ),
              }
            : p
        ),
      }));
    },
    [update]
  );

  const deletePurchase = useCallback(
    (periodId: string, purchaseId: string) => {
      let removed: Purchase | undefined;
      let removedIndex = 0;
      update((current) => ({
        ...current,
        periods: current.periods.map((p) => {
          if (p.id !== periodId) return p;
          removedIndex = p.purchases.findIndex((purchase) => purchase.id === purchaseId);
          if (removedIndex === -1) return p;
          removed = p.purchases[removedIndex];
          return {
            ...p,
            purchases: p.purchases.filter((purchase) => purchase.id !== purchaseId),
          };
        }),
      }));
      return removed ? { periodId, purchase: removed, index: removedIndex } : null;
    },
    [update]
  );

  const undoDelete = useCallback(
    (periodId: string, purchase: Purchase, index: number) => {
      update((current) => {
        const target = getPeriodById(current, periodId);
        if (!target) return current;
        const purchases = [...target.purchases];
        purchases.splice(Math.min(index, purchases.length), 0, purchase);
        return {
          ...current,
          periods: current.periods.map((p) => (p.id === periodId ? { ...p, purchases } : p)),
        };
      });
    },
    [update]
  );

  const importData = useCallback(
    (json: string) => {
      const imported = parseImport(json);
      const { data: withCurrent } = ensureCurrentPeriod(imported);
      update(() => withCurrent);
    },
    [update]
  );

  const clearAllData = useCallback(() => {
    clearLedger();
    const fresh: LedgerData = { version: SCHEMA_VERSION, periods: [] };
    const { data: withCurrent } = ensureCurrentPeriod(fresh);
    update(() => withCurrent);
  }, [update]);

  return {
    data,
    ready: data !== null,
    storageError,
    dismissStorageError: () => setStorageError(null),
    getCurrentPeriod,
    addPurchase,
    editPurchase,
    deletePurchase,
    undoDelete,
    importData,
    clearAllData,
  };
}
