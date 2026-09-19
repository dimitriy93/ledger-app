# Ledger — персональный финансовый регистр

PWA-приложение для персонального учёта расходов: фиксированный бюджет **15 000 ₽**
на период, быстрый ввод покупок с главного экрана и постоянный контроль остатка.
Полностью клиентское приложение — данные хранятся только в LocalStorage устройства.

## Бюджетные периоды

- **5–19** и **20–4** число следующего месяца (включительно);
- новый период начинается автоматически, предыдущий остаётся в истории;
- корректно обрабатываются переходы месяца, года и високосный февраль.

## Возможности

- Добавление покупки с главного экрана: название + стоимость, без лишних шагов.
- Редактирование и удаление покупок (удаление — с отменой через snackbar).
- Живой баланс с плавной анимацией числа и индикатором расхода.
- Корректный показ перерасхода (отрицательный баланс не блокирует ввод).
- История периодов с деталями: бюджет, покупки, расходы, конечный остаток.
- Экспорт / импорт JSON-бэкапов, очистка данных с подтверждением.
- Версионированная схема данных (`version: 1`) с заделом под миграции.
- Единый слой хранения (`src/storage/ledger-storage.ts`) — LocalStorage легко
  заменить на другой бэкенд без изменения UI.
- PWA: manifest, service worker с offline shell, иконки, standalone-режим на iOS.

## Стек

Next.js (static export) · React · TypeScript · Tailwind CSS · LocalStorage · GitHub Pages

## Разработка

```bash
npm install
npm run dev        # http://localhost:3000
```

## Сборка и деплой

```bash
npm run build      # static export в ./out
```

Деплой на GitHub Pages выполняется автоматически (`GitHub Actions`):
push в `main` → build → GitHub Pages. В CI basePath берётся из имени репозитория
(`NEXT_PUBLIC_BASE_PATH=/<repo-name>`), поэтому приложение корректно работает
по адресу `https://<user>.github.io/<repo-name>/`.

Для локальной проверки сборки с basePath:

```bash
NEXT_PUBLIC_BASE_PATH=/ledger npm run build
npx serve out
```

## Тесты

```bash
npx tsx src/lib/periods.test.ts   # календарь периодов
npm run lint                      # ESLint
npm run build                     # TypeScript + production build
```

## Структура

```text
src/
  app/                 # layout, страница, глобальные стили
  components/          # UI: баланс, форма, список, история, настройки
  lib/
    periods.ts         # календарь бюджетных периодов
    format.ts          # деньги и даты (ru-RU)
    useLedger.ts       # состояние с записью в хранилище на каждое изменение
  storage/
    ledger-storage.ts  # единственный слой доступа к LocalStorage
public/
  manifest.webmanifest, sw.js, icons/
scripts/
  generate-icons.mjs   # генерация PNG-иконок без зависимостей
```
