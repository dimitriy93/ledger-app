"use client";

import { useMemo, useRef, useState } from "react";
import { APP_VERSION, formatDayCount, formatMoney, formatPeriodStart } from "@/lib/format";
import { getBalance, getDayNumber, sumPurchases, type LedgerPeriod } from "@/lib/periods";
import ConfirmDialog from "./ConfirmDialog";
import {
  backupFileName,
  serializeForExport,
  StorageError,
  type LedgerData,
} from "@/storage/ledger-storage";

interface SettingsViewProps {
  data: LedgerData;
  currentPeriod: LedgerPeriod | null;
  /** "Бюджет на новый период" setting; applied only to periods created later. */
  nextBudget: number;
  onBudgetChange: (budget: number) => void;
  onCompletePeriod: () => void;
  onImport: (json: string) => void;
  onClearAll: () => void;
  onNotice: (message: string) => void;
}

/** Keeps digits only, capped so the value always fits a sane integer range. */
function stripDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 7);
}

export default function SettingsView({
  data,
  currentPeriod,
  nextBudget,
  onBudgetChange,
  onCompletePeriod,
  onImport,
  onClearAll,
  onNotice,
}: SettingsViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetRaw, setBudgetRaw] = useState(String(nextBudget));
  const [confirmingComplete, setConfirmingComplete] = useState(false);

  const spent = currentPeriod ? sumPurchases(currentPeriod) : 0;
  const balance = currentPeriod ? getBalance(currentPeriod) : 0;
  const completedCount = useMemo(
    () => data.periods.filter((p) => p.status === "completed").length,
    [data.periods]
  );
  const purchaseCount = data.periods.reduce((acc, p) => acc + p.purchases.length, 0);
  const storageKb = new Blob([JSON.stringify(data)]).size / 1024;

  const budgetValue = useMemo(() => Number(budgetRaw), [budgetRaw]);
  const budgetValid = Number.isFinite(budgetValue) && budgetValue >= 1;

  const startBudgetEdit = () => {
    setBudgetRaw(String(nextBudget));
    setEditingBudget(true);
  };

  const saveBudget = () => {
    if (!budgetValid) return;
    onBudgetChange(budgetValue);
    setEditingBudget(false);
    onNotice("Бюджет нового периода сохранён");
  };

  const handleExport = () => {
    const json = serializeForExport(data);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName();
    link.click();
    URL.revokeObjectURL(url);
    onNotice("Резервная копия сохранена");
  };

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const json = typeof reader.result === "string" ? reader.result : "";
      try {
        // Validate before asking for confirmation so obvious mistakes
        // (wrong file, corrupted JSON) are reported immediately.
        JSON.parse(json);
        setPendingImportJson(json);
      } catch {
        onNotice(
          "Не удалось прочитать файл. Убедитесь, что это резервная копия Ledger."
        );
      }
    };
    reader.onerror = () => {
      onNotice("Не удалось прочитать файл.");
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 animate-fade-up">
      <section aria-label="Бюджет" className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          Бюджет нового периода
        </h2>

        {editingBudget ? (
          <form
            className="mt-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveBudget();
            }}
          >
            <label
              htmlFor="next-budget"
              className="mb-1.5 block text-xs text-muted"
            >
              Сумма в рублях, целое число
            </label>
            <input
              id="next-budget"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={budgetRaw}
              onChange={(event) => setBudgetRaw(stripDigits(event.target.value))}
              aria-invalid={!budgetValid || undefined}
              className={`h-12 w-full rounded-xl border bg-surface-2 px-4 text-base text-text outline-none transition-colors focus:border-accent tabular ${
                budgetValid || budgetRaw === "" ? "border-line" : "border-negative"
              }`}
            />
            {!budgetValid && budgetRaw !== "" ? (
              <p className="mt-1.5 text-xs text-negative">
                Введите положительную сумму в рублях
              </p>
            ) : budgetValid ? (
              <p className="mt-1.5 text-xs text-muted">{formatMoney(budgetValue)}</p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setEditingBudget(false)}
                className="h-11 flex-1 rounded-xl border border-line-strong px-4 text-sm font-semibold text-text transition-colors hover:bg-surface-2 active:scale-[0.98]"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={!budgetValid}
                className={`h-11 flex-1 rounded-xl px-4 text-sm font-bold transition active:scale-[0.98] ${
                  budgetValid
                    ? "bg-accent text-[#062033] hover:bg-accent-strong"
                    : "bg-accent-dim text-muted cursor-not-allowed"
                }`}
              >
                Сохранить
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="mt-2 text-2xl font-extrabold tracking-tight tabular">
              {formatMoney(nextBudget)}
            </p>
            <button
              type="button"
              onClick={startBudgetEdit}
              className="mt-3 h-11 w-full rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold transition hover:border-line-strong active:scale-[0.99]"
            >
              Изменить
            </button>
            <p className="mt-2.5 text-xs leading-relaxed text-muted">
              Применится к периоду, который начнётся после завершения текущего.
              Текущий период и история не изменятся.
            </p>
          </>
        )}
      </section>

      {currentPeriod ? (
        <section
          aria-label="Текущий расчётный период"
          className="rounded-2xl border border-line bg-surface p-5"
        >
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            Текущий расчётный период
          </h2>
          <dl className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Начало</dt>
              <dd className="font-semibold">{formatPeriodStart(currentPeriod.startDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">День</dt>
              <dd className="font-semibold tabular">{formatDayCount(getDayNumber(currentPeriod))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Потрачено</dt>
              <dd className="font-semibold tabular">{formatMoney(spent)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Остаток</dt>
              <dd
                className={`font-semibold tabular ${balance < 0 ? "text-negative" : "text-text"}`}
              >
                {formatMoney(balance)}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => setConfirmingComplete(true)}
            className="mt-4 h-12 w-full rounded-xl bg-accent-dim px-4 text-sm font-bold text-accent-strong transition hover:bg-accent-dim/70 active:scale-[0.99]"
          >
            Закончить расчётный период
          </button>
          <p className="mt-2.5 text-xs leading-relaxed text-muted">
            Период будет сохранён в истории, и начнётся новый — с сегодняшнего
            дня и бюджетом {formatMoney(nextBudget)}.
          </p>
        </section>
      ) : null}

      <section aria-label="Данные" className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          Данные
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Все записи хранятся только в этом браузере. Регулярно сохраняйте
          резервную копию — при удалении приложения или очистке данных LocalStorage
          будет потерян.
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex h-12 w-full items-center justify-between rounded-xl border border-line bg-surface-2 px-4 text-left font-semibold transition hover:border-line-strong active:scale-[0.99]"
          >
            Экспорт данных
            <span className="text-xs font-medium text-muted">JSON-файл</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-12 w-full items-center justify-between rounded-xl border border-line bg-surface-2 px-4 text-left font-semibold transition hover:border-line-strong active:scale-[0.99]"
          >
            Импорт данных
            <span className="text-xs font-medium text-muted">Заменит текущие</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => {
              handleFileSelected(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            className="flex h-12 w-full items-center justify-between rounded-xl border border-negative/20 bg-negative/5 px-4 text-left font-semibold text-negative transition hover:border-negative/40 active:scale-[0.99]"
          >
            Очистить все данные
            <span className="text-xs font-medium text-negative/70">Безвозвратно</span>
          </button>
        </div>
      </section>

      <section aria-label="О приложении" className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          О приложении
        </h2>
        <dl className="mt-3 space-y-2.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Периодов в истории</dt>
            <dd className="font-semibold tabular">{completedCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Всего покупок</dt>
            <dd className="font-semibold tabular">{purchaseCount}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Размер хранилища</dt>
            <dd className="font-semibold tabular">
              {storageKb < 1 ? "< 1" : Math.round(storageKb)} КБ
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Версия приложения</dt>
            <dd className="font-semibold tabular">{APP_VERSION}</dd>
          </div>
        </dl>
      </section>

      {/* Completion confirmation: never complete on a bare click. */}
      {currentPeriod ? (
        <ConfirmDialog
          open={confirmingComplete}
          title="Закончить расчётный период?"
          confirmLabel="Закончить период"
          onConfirm={() => {
            setConfirmingComplete(false);
            onCompletePeriod();
          }}
          onCancel={() => setConfirmingComplete(false)}
        >
          <dl className="mt-3 space-y-2 rounded-xl border border-line bg-surface-2 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Начало</dt>
              <dd className="font-semibold">
                {formatPeriodStart(currentPeriod.startDate)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">День</dt>
              <dd className="font-semibold tabular">
                {formatDayCount(getDayNumber(currentPeriod))}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Потрачено</dt>
              <dd className="font-semibold tabular">{formatMoney(spent)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Остаток</dt>
              <dd
                className={`font-semibold tabular ${
                  balance < 0 ? "text-negative" : "text-positive"
                }`}
              >
                {formatMoney(balance)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            После завершения этот период будет сохранён в истории без права
            изменения, а Ledger начнёт новый расчётный период с бюджетом{" "}
            {formatMoney(nextBudget)}.
          </p>
        </ConfirmDialog>
      ) : null}

      <ConfirmDialog
        open={pendingImportJson !== null}
        title="Импортировать данные?"
        description="Текущие данные будут заменены содержимым выбранного файла. Это действие нельзя отменить."
        confirmLabel="Импортировать"
        destructive
        onConfirm={() => {
          if (pendingImportJson === null) return;
          try {
            onImport(pendingImportJson);
            onNotice("Данные успешно импортированы");
          } catch (error) {
            onNotice(
              error instanceof StorageError
                ? error.message
                : "Не удалось импортировать данные."
            );
          }
          setPendingImportJson(null);
        }}
        onCancel={() => setPendingImportJson(null)}
      />

      <ConfirmDialog
        open={confirmingClear}
        title="Очистить все данные?"
        description="Будут удалены все периоды и покупки. Сначала рекомендуем сделать экспорт резервной копии."
        confirmLabel="Очистить"
        destructive
        onConfirm={() => {
          setConfirmingClear(false);
          onClearAll();
          onNotice("Все данные удалены");
        }}
        onCancel={() => setConfirmingClear(false)}
      />
    </div>
  );
}
