"use client";

import { useRef, useState } from "react";
import { APP_VERSION, BUDGET, formatMoney } from "@/lib/format";
import ConfirmDialog from "./ConfirmDialog";
import {
  backupFileName,
  serializeForExport,
  StorageError,
  type LedgerData,
} from "@/storage/ledger-storage";

interface SettingsViewProps {
  data: LedgerData;
  onImport: (json: string) => void;
  onClearAll: () => void;
  onNotice: (message: string) => void;
}

export default function SettingsView({
  data,
  onImport,
  onClearAll,
  onNotice,
}: SettingsViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const purchaseCount = data.periods.reduce((acc, p) => acc + p.purchases.length, 0);
  const storageKb = new Blob([JSON.stringify(data)]).size / 1024;

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
            <dt className="text-muted">Бюджет на период</dt>
            <dd className="font-semibold tabular">{formatMoney(BUDGET)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Периодов в истории</dt>
            <dd className="font-semibold tabular">{data.periods.length}</dd>
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
