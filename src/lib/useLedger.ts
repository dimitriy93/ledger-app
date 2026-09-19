"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BUDGET } from "./format";
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
import {
  completeActivePeriod,
  ensureActivePeriod,
  getActivePeriod,
  getPeriodById,
} from "./periods";

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
 * to localStorage synchronously before state updates are exposed. Periods are
 * fully manual — nothing rolls over automatically; the active period simply
 * continues until the user completes it in Settings.
 */
export function useLedger() {
  const [data, setData] = useState<LedgerData | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const dataRef = useRef<LedgerData | null>(null);
  const lastCompletionAtRef = useRef(0);

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

  // Initial load: make sure exactly one active period exists (creates the
  // first one on a fresh start; a no-op while an active period is running).
  useEffect(() => {
    const loaded = loadLedger();
    const { data: withActive, created } = ensureActivePeriod(loaded);
    if (created) {
      try {
        saveLedger(withActive);
      } catch {
        /* surfaced on next mutation */
      }
    }
    dataRef.current = withActive;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating state from localStorage on mount
    setData(withActive);
  }, []);

  const getCurrentPeriod = useCallback((): LedgerPeriod | null => {
    if (!data) return null;
    return getActivePeriod(data) ?? null;
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

  // Completed periods are immutable snapshots — only the active period
  // accepts purchase mutations.
  const editPurchase = useCallback(
    (periodId: string, purchaseId: string, input: NewPurchaseInput) => {
      update((current) => {
        const target = getPeriodById(current, periodId);
        if (!target || target.status !== "active") return current;
        return {
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
        };
      });
    },
    [update]
  );

  const deletePurchase = useCallback(
    (periodId: string, purchaseId: string) => {
      let removed: Purchase | undefined;
      let removedIndex = 0;
      update((current) => {
        const target = getPeriodById(current, periodId);
        if (!target || target.status !== "active") return current;
        return {
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
        };
      });
      return removed ? { periodId, purchase: removed, index: removedIndex } : null;
    },
    [update]
  );

  const undoDelete = useCallback(
    (periodId: string, purchase: Purchase, index: number) => {
      update((current) => {
        const target = getPeriodById(current, periodId);
        if (!target || target.status !== "active") return current;
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

  /** Updates the "budget for new period" setting; never touches existing periods. */
  const setNextBudget = useCallback(
    (budget: number) => {
      update((current) => ({ ...current, nextBudget: budget }));
    },
    [update]
  );

  /**
   * Completes the active period and starts a new one (today, with the
   * "budget for new period" setting). Idempotent against fast repeated
   * presses: without an active period it is a no-op, and calls within
   * 500 ms of a completion are ignored, so a double click can never
   * complete two periods.
   */
  const completeCurrentPeriod = useCallback((): LedgerPeriod | null => {
    if (Date.now() - lastCompletionAtRef.current < 500) return null;
    let completedPeriod: LedgerPeriod | null = null;
    update((current) => {
      const result = completeActivePeriod(current);
      if (result.completed) {
        completedPeriod = result.previous ?? null;
        lastCompletionAtRef.current = Date.now();
      }
      return result.data;
    });
    return completedPeriod;
  }, [update]);

  const importData = useCallback(
    (json: string) => {
      const imported = parseImport(json);
      const { data: withActive } = ensureActivePeriod(imported);
      update(() => withActive);
    },
    [update]
  );

  const clearAllData = useCallback(() => {
    clearLedger();
    const fresh: LedgerData = { version: SCHEMA_VERSION, nextBudget: BUDGET, periods: [] };
    const { data: withActive } = ensureActivePeriod(fresh);
    update(() => withActive);
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
    setNextBudget,
    completeCurrentPeriod,
    importData,
    clearAllData,
  };
}
