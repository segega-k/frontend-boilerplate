# 05c. Шаблон `tma` — Telegram Mini App: технологии
Status: done
Updated: 2026-10-14

## Resume notes
- Done: все разделы (1–10), сводная таблица, рекомендации, открытые вопросы.
- Next: ничего; оркестратору — свести с 05a/05b/05d/05e (общий UI kit, роутер, query-слой).
- Sub-agent: нет (запрещено брифом для 05c).

## Summary (≤ 15 lines)
1. TMA = клиентский SPA: Vite 8 + React 19 + TypeScript, статическая сборка, nginx в Docker. SSR/SEO не нужны: launch params (`tgWebAppData`) приходят в URL hash и на сервер не попадают, тема/пользователь известны только на клиенте. Next.js (официальный шаблон tma.js) — лишний слой.
2. SDK: `@tma.js/sdk-react` 3.0.23 + `@tma.js/sdk` 3.3.0 (актуальная линия, июль 2026). `@telegram-apps/*` — legacy (часть пакетов уже deprecated с указанием на `@tma.js/*`), `@twa-dev/sdk` 8.0.2 застрял на Bot API 8.0 (февраль 2025), а прошлый проект xRocket сидел именно на нём.
3. Все вызовы SDK — в одном адаптере `platform/telegram` (init, mount, bindCssVars, back/main/secondary button, haptics); для браузера — `mockTelegramEnv` в dev и e2e.
4. Роутинг: TanStack Router (типобезопасные search params для `startapp`, `defaultViewTransition` с `types`), один глобальный хук связывает нативный BackButton с историей роутера.
5. UI: общий kit (Tailwind v4 + Base UI/shadcn-подход), токены — CSS-переменные; в TMA слой «theme bridge» мапит `--tg-theme-*` на семантические токены kit-а. `@telegram-apps/telegram-ui` не брать: последний релиз 2.1.13 (окт. 2025), peer `react ^18.2`, свой стиль, не шарится с другими шаблонами.
6. Данные: TanStack Query 5 + openapi-fetch/openapi-react-query (общие для всех шаблонов); авторизация — `Authorization: tma <initDataRaw>` → бэкенд валидирует HMAC/Ed25519 и (рекомендация) выдаёт короткую сессию.
7. Клиентское состояние: Zustand по умолчанию (мало, просто, общий для шаблонов); MobX MVVM не тащить в boilerplate по умолчанию — честно: в TMA почти всё состояние серверное или платформенное.
8. Анимации: CSS + View Transitions для страниц, Motion (`LazyMotion`/`m`) точечно, Vaul для bottom sheet; на слабых Android снижать анимации по `performanceClass` из User-Agent.
9. Платежи: Stars через `createInvoiceLink` на бэкенде + `invoice.openUrl` на клиенте; TON Connect `@tonconnect/ui-react` (5.0.1 вышел 11.10.2026, код = 3.1.0) — только lazy-чанком (~160 KB gz).
10. Аналитика каталога `@telegram-apps/analytics` 1.6.4 — опция (тяжёлая, ~145 KB gz по esm.sh), обязательность для каталога не подтверждена; Sentry `@sentry/react` 11.x — да, с lazy-загрузкой.
11. Dev: Vite с HTTPS (`@vitejs/plugin-basic-ssl`/mkcert) для desktop/web; для мобильных клиентов — туннель (cloudflared) или test environment Telegram (HTTP без TLS разрешён); eruda только в dev/staging.
12. PWA/offline внутри Telegram — не нужен (на iOS WKWebView service worker у сторонних приложений фактически недоступен); кэш через Query + DeviceStorage/CloudStorage.

## Findings

Обозначения: **[факт]** — проверено по источнику/npm registry 2026-10-14; **[мнение]** — оценка автора.

### 0. Платформа на октябрь 2026

- **[факт]** Последняя версия Bot API, упомянутая в документации Mini Apps, — **10.1 (11.06.2026)** (добавлен `chat_join_request_query_id` в `WebAppInitData`). Ключевые вехи: 7.7 — `disableVerticalSwipes`; 7.10 — SecondaryButton, `setBottomBarColor`; 8.0 (ноябрь 2024) — fullscreen, `safeAreaInset`/`contentSafeAreaInset`, home screen, `shareMessage`, `downloadFile`, LocationManager, акселерометр/гироскоп, кастомизация loading screen, данные железа Android в User-Agent, отладка на iOS; 9.0 — `DeviceStorage` (до 5 MB) и `SecureStorage` (до 10 элементов, Keychain/Keystore); 9.1 — `hideKeyboard`; 9.5 — `iconCustomEmojiId` у BottomButton; 9.6 — `requestChat`. Источник: https://core.telegram.org/bots/webapps
- **[факт]** Официальный `telegram-web-app.js`: ~120 KB raw / ~19 KB gzip, проверки версий до `'9.6'` внутри (скачан 2026-10-14).
- **[факт]** initData: HMAC-SHA-256 с ключом `HMAC("WebAppData", bot_token)` для бэкенда бота; для третьих сторон — Ed25519 подпись поля `signature` без токена бота (отдельные публичные ключи для test и prod). `initDataUnsafe` на сервере не доверять. Источник: https://core.telegram.org/bots/webapps
- **[факт]** Test environment: «you may use HTTP links without TLS to test your Mini App» — отдельный аккаунт и отдельный бот в тестовом @BotFather. Там же — инструкции по debug-режиму (iOS: 10 тапов по Settings + Safari Web Inspector; Android: USB debugging + WebView debug в скрытом меню + `chrome://inspect`; Windows/Linux Desktop beta: Experimental settings → webview inspection; macOS beta: 5 кликов по Settings → «Debug Mini Apps»).
- **[факт]** `startapp`: `[A-Za-z0-9_-]`, до **512** символов (https://docs.telegram-mini-apps.com/platform/start-parameter). В `docs/library-notes.md` записано «≤ 64» — это лимит параметра `start` у бота, не `startapp` (https://core.telegram.org/api/links). Расхождение в доке стоит исправить (с согласия пользователя). Параметр `mode=compact|fullscreen` в ссылке задаёт режим открытия.

### 1. Сборка и рендеринг

| Вариант | Плюсы | Минусы |
| --- | --- | --- |
| **Vite 8 + React 19 SPA** (рекоменд.) | Минимальный runtime, статический `dist` → nginx, официальный React-шаблон tma.js тоже на Vite (https://github.com/Telegram-Mini-Apps/reactjs-template), быстрый HMR, тот же тулчейн, что у admin SPA и game | Нет SSR (не нужен) |
| Next.js 16 (официальный `nextjs-template` tma.js) | Знаком многим | Почти весь код `'use client'`; Node-сервер в Docker ради ничего; App Router тянет лишний runtime; launch params в hash → SSR не знает ни пользователя, ни темы |
| Vike / React Router 8 framework mode | Гибко | SSR-сложность, которую пользователь уже нёс в xRocket (см. Vike-гочи в library-notes) |

- **[факт]** Версии: `vite` 8.3.4, `react`/`react-dom` 19.3.0, `@vitejs/plugin-react` 6.1.2, `typescript` 7.0.2 (npm registry).
- **[мнение] Полезен ли SSR для TMA когда-либо?** Почти никогда. Единственные случаи: (а) тот же домен одновременно служит публичным веб-сайтом с SEO — это задача шаблона `landing`/`shop`, а не `tma`; (б) OG-превью при шаринге ссылки — но шарятся `t.me/bot/app?startapp=…`, превью рисует Telegram по настройкам бота. Для cold start важнее: маленький initial chunk, inline критический CSS, кастомный loading screen бота (Bot API 8.0), ранний вызов `miniApp.ready()`, `preconnect` к API.
- **[мнение] Cold start бюджет:** initial JS ≤ ~150 KB gz (React+ReactDOM ~60 KB gz, роутер, Query, SDK). Всё тяжёлое (TON Connect, аналитика, Sentry replay, редакторы, графики) — `import()` по требованию. Включить `build.target` под Chromium ~111+/Safari 16.4+ (Android WebView и iOS WKWebView актуальны; старые Android 7–8 с не обновлённым WebView — риск, проверить по аудитории).

**Роутинг:**

| | TanStack Router 1.170.x (рекоменд.) | React Router 8.4 (data mode) |
| --- | --- | --- |
| Типизация путей/params | полная, включая search params со схемой (валидатор zod) | частичная (typegen в framework mode) |
| View Transitions | `defaultViewTransition` с `types(from,to)` → направление slide по history index (https://tanstack.com/router/latest/docs/framework/react/examples/view-transitions) | `viewTransition` у `Link`/`navigate` |
| Интеграция с Query | `loader` + `ensureQueryData`, preload on intent | loaders, без нативной интеграции |
| Риски | частые релизы (1.170 → нужен pin), больше API | v8 вышел 17.06.2026, ежегодные мажоры; v8 сделал middleware и ESM-only дефолтом (https://remix.run/blog/react-router-v8) |

- **[мнение]** TanStack Router — если admin SPA тоже на нём (одна модель роутинга в монорепо). Если оркестратор выберет RR8 для shop/landing (framework mode, SSR), TMA может жить на RR8 data mode — разница не критична; главное — один роутер на весь монорепо.
- **Back button (обязательно один механизм):** один хук на уровне root-layout: `backButton.show()` если `router.history.canGoBack()` и маршрут не top-level, `backButton.onClick(() => router.history.back())`. Локальные перехватчики (закрыть sheet/модалку вместо навигации) — стек обработчиков с `true = consumed` (паттерн из library-notes, проверен в xRocket). Аппаратный Back на Android приходит в TMA как событие `back_button_pressed` — только если кнопка показана; иначе закрывает приложение.
- **Deep link → маршрут:** `startapp` парсится один раз в launch context (`useLaunchParams().tgWebAppStartParam`), маппится на маршрут через `router.navigate({ replace: true })`. Формат: короткий кодированный путь (`p_123`, `ref_abc`), т.к. разрешены только `[A-Za-z0-9_-]`.

### 2. SDK

| Вариант | Версия / дата | Оценка |
| --- | --- | --- |
| **`@tma.js/sdk-react` + `@tma.js/sdk`** (рекоменд.) | 3.0.23 / 3.3.0, 2026-07-14 | Активная линия, покрывает fullscreen, safe areas, DeviceStorage/SecureStorage, `isSupported()`, `mockTelegramEnv`, bindCssVars; peer React 17–19 |
| `@telegram-apps/sdk-react` | 3.3.9, 2025-10-08 | Предшественник; `@telegram-apps/bridge` и `@telegram-apps/init-data-node` помечены в npm «not supported anymore, use @tma.js/…». Новый проект не начинать |
| `@twa-dev/sdk` | 8.0.2, 2025-02-05 | Тонкая обёртка над официальным скриптом, типы до Bot API 8.0 (нет DeviceStorage/SecureStorage 9.0, `hideKeyboard` 9.1). Использовался в xRocket. Не поддерживается активно |
| Сырой `window.Telegram.WebApp` (`telegram-web-app.js`) | всегда свежий | Внешний render-blocking скрипт с telegram.org (~19 KB gz), глобальный объект, нет типов (нужны свои), нет мока |

- **[факт]** Breaking changes tma.js 3.x относительно `@telegram-apps/sdk` 2.x: компоненты-объекты (`backButton.show()`), сигналы стали computed (`useComputed` вместо `useSignal`), `isSupported()` вместо `isAvailable/ifAvailable` (неподдерживаемый метод бросает `MethodUnsupportedError`), `invoice.openUrl/openSlug`, `viewport.safeAreaInsets()/contentSafeAreaInsets()`, CloudStorage `getItems` для нескольких ключей. https://docs.telegram-mini-apps.com/packages/tma-js-sdk/migrate-from-telegram-apps
- **[факт]** React-хуки: `useComputed`, `useLaunchParams`, `useRawLaunchParams`, `useRawInitData`, `useAndroidDeviceData` (разбор UA, включая performance class). Компоненты монтируются до `createRoot` (`backButton.mount()` и т.д.). https://docs.telegram-mini-apps.com/packages/tma-js-sdk-react
- **[факт]** `viewport.bindCssVars()` создаёт `--tg-viewport-height`, `--tg-viewport-stable-height`, `--tg-viewport-width`, `--tg-viewport-safe-area-inset-{top,bottom,left,right}`, `--tg-viewport-content-safe-area-inset-*`. Имена отличаются от переменных официального скрипта (`--tg-safe-area-inset-*`, `--tg-content-safe-area-inset-*`, записанных в library-notes) — в токенах ссылаться на свои алиасы, а не на сырые имена. https://docs.telegram-mini-apps.com/packages/tma-js-sdk/features/viewport
- **[факт]** `mockTelegramEnv({ launchParams, onEvent })` имитирует окружение без записи в BotFather; `onEvent` перехватывает вызовы методов (можно отвечать на `web_app_request_theme`, `web_app_request_viewport` и т.п.). https://docs.telegram-mini-apps.com/packages/tma-js-sdk/environment
- **[факт]** Размер (esm.sh, весь пакет без tree-shaking, gzip): `@tma.js/sdk` ~35 KB, `@twa-dev/sdk` ~13 KB (встраивает код официального скрипта в бандл). С tree-shaking tma.js меньше (импортируются только используемые компоненты) — **[мнение]**, не измерено.
- **Риск:** tma.js — проект одного основного мейнтейнера (heyqbnk), уже сделал одно переименование scope (`@telegram-apps` → `@tma.js`) с breaking API. Смягчение: SDK используется **только** в `platform/telegram/*` (ESLint `no-restricted-imports` везде кроме адаптера — это уже правило `no-platform-globals-in-store` из tooling.md), так что замена SDK = замена одного модуля.

**Структура адаптера (рекомендация):**
```
apps/tma/src/platform/telegram/
  init.ts           // init(), mount components, bindCssVars, miniApp.ready(), mock в dev
  launch-context.ts // снимок launch params: user, startParam, platform, version, initDataRaw
  back-button.ts    // стек обработчиков + хук синхронизации с роутером
  bottom-buttons.ts // main/secondary button как декларативный React-компонент <MainButton text onClick loading/>
  haptics.ts, closing-confirmation.ts, storage.ts (cloud/device/secure), theme-bridge.ts
```

### 3. UI и токены

| Вариант | Оценка |
| --- | --- |
| **Общий kit (Tailwind v4 4.3.x + Base UI 1.9 / Radix 1.8 headless + shadcn-подход) + theme bridge** (рекоменд.) | Один kit для всех шаблонов, токены как CSS-переменные (`@theme` в Tailwind v4), TMA лишь переопределяет значения семантических токенов из Telegram |
| `@telegram-apps/telegram-ui` 2.1.13 | Нативный вид iOS/Android «из коробки», но: последний релиз 2025-10-14, peer `react ^18.2.0` (React 19 — warning/риски), зависит от `@twa-dev/types` 7 и форка vaul; свой CSS, не шарится с landing/shop/admin; задачи pixel-perfect по Figma ломает |

- **Theme bridge [мнение, схема]:** Telegram передаёт `themeParams` (`bg_color`, `secondary_bg_color`, `section_bg_color`, `text_color`, `hint_color`, `subtitle_text_color`, `link_color`, `accent_text_color`, `button_color`, `button_text_color`, `destructive_text_color`, `header_bg_color`, `bottom_bar_bg_color`, `section_header_text_color`, `section_separator_color`). В TMA:
  ```css
  /* packages/tokens: семантические токены с дефолтами бренда */
  :root { --color-bg: #fff; --color-surface: #f4f4f5; --color-text: #111; --color-primary: #2b7fff; ... }
  /* apps/tma: режим "native" — подмена из Telegram (themeParams.bindCssVars → --tg-theme-*) */
  [data-tg-theme="native"] {
    --color-bg: var(--tg-theme-bg-color);
    --color-surface: var(--tg-theme-secondary-bg-color);
    --color-text: var(--tg-theme-text-color);
    --color-text-muted: var(--tg-theme-hint-color);
    --color-primary: var(--tg-theme-button-color);
    --color-on-primary: var(--tg-theme-button-text-color);
    --color-danger: var(--tg-theme-destructive-text-color);
  }
  ```
  Решение продукта: **брендированная тема** (свои цвета, только light/dark по `miniApp.isDark`/`colorScheme`, и вызов `miniApp.setHeaderColor/setBackgroundColor/setBottomBarColor` в цвет бренда) или **нативная** (цвета Telegram). xRocket делал первое — синхронизировал header/background с темой (library-notes). Kit должен поддерживать оба режима, компоненты используют только семантические токены.
- **Safe areas [факт + мнение]:** в fullscreen контент должен отступать на `safeAreaInset.top + contentSafeAreaInset.top` (системная шторка + кнопки Telegram «Close/…»). Токены: `--app-inset-top: calc(var(--tg-viewport-safe-area-inset-top,0px) + var(--tg-viewport-content-safe-area-inset-top,0px))`; в браузере — `env(safe-area-inset-top)`. Высота — `--tg-viewport-stable-height`, не `100vh`/`dvh` (правило `no-viewport-height` уже есть в tooling.md).
- **Клавиатура [факт из xRocket]:** `visualViewport` в мобильном клиенте не реагирует на клавиатуру → `viewportHeight`/`viewportStableHeight` + событие `viewportChanged`; `focus({ preventScroll: true })`; Bot API 9.1 даёт `hideKeyboard`.
- **Свайпы:** `swipeBehavior.disableVertical()` на экранах со своими вертикальными жестами (sheet, карты, игры), иначе свайп вниз сворачивает приложение. Включать обратно при уходе с экрана.
- **Что расходится с другими шаблонами:** только слой `apps/tma/src/platform/*` и theme bridge; компоненты, иконки, типографика, spacing — общие. Bottom bar нативных кнопок (Main/Secondary) заменяет в TMA «липкую» CTA-кнопку kit-а → в kit нужен компонент-слот `PrimaryAction`, который в TMA рендерит нативную кнопку, а в вебе — обычную (внедряется через пропсы/провайдер приложения, kit о Telegram не знает).

### 4. Данные и состояние

- **Server state [факт версий]:** `@tanstack/react-query` 5.104.2, `openapi-fetch` 0.17.0, `openapi-react-query` 0.5.4, `openapi-typescript` 7.13.0 — общий пакет `packages/api` для всех шаблонов. Гочи уже в library-notes (openapi-fetch не бросает на HTTP-ошибках и т.д.).
- **Авторизация [факт + мнение]:** middleware openapi-fetch ставит `Authorization: tma ${initDataRaw}` (конвенция tma.js; бэкенд валидирует `@tma.js/init-data-node` 2.0.8 или аналог на своём языке; `@telegram-apps/init-data-node` deprecated). Проверять `auth_date` (initData живёт, пока открыт webview — часы/сутки), поэтому **[мнение]** лучше один обмен initData → короткий access token бэкенда, особенно если тот же API обслуживает веб-версию. Ed25519-валидация нужна, если API принадлежит не владельцу бота.
- **Client state:** 

| | Zustand 5.0.15 (рекоменд.) | MobX 7.0.6 + mobx-react-lite 5.1 (MVVM) | Jotai 3.0.1 |
| --- | --- | --- | --- |
| Размер/порог | ~1 KB, хук-API | ~17 KB+, декораторы/DI (tsyringe), `makeAutoObservable`-гочи | ~3 KB, атомы |
| Подходит TMA | да: UI-флаги, черновики форм, корзина | да, но избыточно: в TMA ~80% — серверные данные (Query) и платформенные (SDK-сигналы) | да, для мелкой реактивности |
| Шаринг | одинаково в admin/shop/game | тащит DI-контейнер и правила VM во все шаблоны | — |

  **[мнение, честно]:** MobX MVVM пользователь знает и ценит (тестируемые VM, логика вне view). Но в boilerplate по умолчанию это добавляет DI, декораторы, кастомные ESLint-правила и TDZ-ловушки (library-notes) ради малого объёма клиентского состояния. Рекомендация: Zustand + «логика в хуках/чистых функциях» как дефолт; MobX — опциональный модуль, если проект реально тяжёлый по клиентской логике (кошелёк, торговля). Правило «логика вне view» сохраняется и без MobX (custom hooks = view model).
- **Persist:** `CloudStorage` (синхронизируется между устройствами пользователя, лимиты Telegram на число/размер ключей — проверить в доках при реализации), `DeviceStorage` (до 5 MB, локально, 9.0+), `SecureStorage` (до 10 элементов, Keychain/Keystore, 9.0+, для токенов). Всё асинхронно → один адаптер `storage.ts` с fallback на `localStorage` в браузере. Проверка `isSupported()` обязательна (старые клиенты).

### 5. Анимации и жесты

- **[факт]** `motion` 14.2.0: полный пакет ~51 KB gz (bundlephobia); `LazyMotion` + `m` + `domAnimation` — штатный способ уменьшить initial (https://motion.dev/docs/react-reduce-bundle-size).
- **Переходы страниц [мнение]:** View Transitions API через роутер (`defaultViewTransition` с типами `forward`/`back`) + CSS `::view-transition-old/new` — ноль JS-веса. Поддержка: Android WebView (Chromium 111+), iOS WKWebView (Safari 18+ для same-document); на старых — без анимации (graceful). Telegram Desktop на Windows использует WebView2 — Chromium. Не проверено на реальных клиентах — проверить.
- **Жесты:** `@use-gesture/react` 10.3.1 — давно без релизов (стабилен, но не развивается); для свайпа карточек/каруселей — Motion `drag` или CSS scroll-snap (предпочтительно, нативно и дёшево).
- **Bottom sheet:** `vaul` 1.1.2 (последний мажор давно; автор объявлял, что проект не активно развивается — **[мнение/риск]**, проверить статус); альтернатива — Base UI Drawer (если вышел в 1.x) или свой на Motion. Важно: при открытом sheet — `swipeBehavior.disableVertical()` и перехват BackButton.
- **Слабые Android:** с Bot API 8.0 Telegram Android пишет в User-Agent performance class (`LOW/AVERAGE/HIGH`) — `useAndroidDeviceData().performanceClass`. **[мнение]** На `LOW`: выключать blur/backdrop-filter, тени, параллакс, view transitions, длинные spring-анимации; уважать `prefers-reduced-motion`. Анимировать только `transform`/`opacity`.
- **Haptics:** `hapticFeedback.impactOccurred('light')` на нажатия ключевых CTA, `notificationOccurred('success'|'error')` на результат операций, `selectionChanged()` при смене табов/сегментов — через один хелпер, не напрямую.

### 6. Платежи

- **Telegram Stars [факт]:** цифровые товары — только Stars, валюта `XTR`, `provider_token` пустой (нужен только для физических товаров); `pre_checkout_query` — ответ ≤ 10 с, иначе отмена; возврат — `refundStarPayment`. Мобильным пользователям Telegram может скрывать продажу цифровых товаров иначе, чем за Stars (правила App Store/Play). https://core.telegram.org/bots/payments-stars
- **Поток:** фронт → API бэкенда «создать заказ» → бэкенд `createInvoiceLink` (Bot API) → фронт `invoice.openUrl(link)` → событие `invoice_closed` со статусом (`paid|cancelled|failed|pending`) → фронт инвалидирует query заказа; источник истины — бэкенд (`successful_payment` в webhook бота). Фронт только UI.
- **TON Connect [факт]:** `@tonconnect/ui-react` 5.0.1 (2026-10-11). 5.0.0 — выравнивание мажоров sdk/ui/ui-react, по коду = ui-react 3.1.0; 3.0.0 (июнь 2026) — «TON Connect V3»: `signMessage`, embedded requests, структурированные `items` (ton/jetton/nft). https://raw.githubusercontent.com/ton-connect/sdk/main/packages/ui-react/CHANGELOG.md. Peer React ≥17. Нужен `tonconnect-manifest.json` в `public/` (абсолютный URL в `manifestUrl`, корректные CORS).
- **Риски:** `@tonconnect/ui` ~164 KB gz (esm.sh целиком) → только lazy (`React.lazy` на экране кошелька + провайдер, монтируемый по требованию). 5.0.1 моложе 7 дней → `minimumReleaseAge: 7d` из tooling.md заблокирует установку до 18.10.2026; при init фиксировать проверенную версию. TON Connect — опциональная фича шаблона (init-скрипт удаляет, если не нужна).

### 7. Формы, i18n, аналитика, ошибки

- **Формы:** `react-hook-form` 7.90 + `zod` 4.6 (схемы можно генерировать/держать рядом с OpenAPI) — общий выбор с admin/shop. Альтернатива `@tanstack/react-form` 1.33. В TMA важно: `inputMode`, `enterKeyHint`, скрытие нативных кнопок/вызов `hideKeyboard` по submit, MainButton как submit (с `loading`/`disabled` из состояния формы).
- **i18n:** `i18next` 26.4 + `react-i18next` 17.0. Язык: `initData.user.language_code` (IETF, напр. `ru`, `en`, `pt-br`) → нормализовать к поддерживаемым, fallback `en`; сохранённый выбор пользователя (CloudStorage) приоритетнее. Пакет переводов и правила (library-notes) общие с другими шаблонами.
- **Telegram Mini Apps Analytics [факт]:** `@telegram-apps/analytics` 1.6.4 (2026-01-22); токен через TON Builders / @DataChief_bot; трекает запуски и TON Connect-взаимодействия, «used solely to rank applications in the catalog based on their performance and Streaks»; README требует init до рендера. https://github.com/telegram-mini-apps-dev/analytics. **Обязательность для попадания в каталог (Telegram Apps Center) не подтверждена** ни одним официальным источником — влияет на ранжирование. Размер ~145 KB gz (esm.sh, без tree-shaking) — **[мнение]** подключать опционально, после `ready()` через `requestIdleCallback`, мерить реальный вклад.
- **Продуктовая аналитика:** через общий интерфейс `analytics.track()` в `packages/analytics` (провайдер выбирается проектом: PostHog/Amplitude/свой), TMA добавляет контекст (platform, version, start_param).
- **Ошибки:** `@sentry/react` 11.7.0; tags: `tg.platform`, `tg.version`, `performanceClass`; **не отправлять initData/user** (PII); Replay — нет или lazy. Source maps загружать в CI, не публиковать в nginx.

### 8. Тестирование

- **Unit:** `vitest` 5.0.4 + Testing Library; SDK мокается на уровне адаптера (`platform/telegram`), а не глобально.
- **E2E/visual:** `@playwright/test` 1.64; `mockTelegramEnv` подключается при `VITE_TG_MOCK=1` (или query-флаге в staging-сборке) с фиксированными launch params и themeParams — тесты прогоняют обе темы (light/dark Telegram) и fullscreen/compact insets. Проверять: back button стек, main button state, deep link → маршрут.
- **Реальные клиенты (ручной чек-лист):** iOS, Android (включая слабый девайс), Desktop, Web K/A; debug-режимы — по инструкции core.telegram.org (см. §0). `eruda` 3.4.3 — динамический `import()` только при dev/staging флаге (в prod не грузить).
- **Test environment:** отдельный бот и аккаунт, HTTP без TLS разрешён — удобно для LAN-тестов без туннеля; Ed25519 ключи test-окружения отличаются — бэкенд должен знать окружение.

### 9. Docker и dev-инфраструктура

- **Prod:** multi-stage Dockerfile: build (Node, pnpm) → `nginx:alpine` (или `nginxinc/nginx-unprivileged`) со статикой; SPA fallback `try_files $uri /index.html`; `index.html` — `Cache-Control: no-cache`, хешированные ассеты — `immutable, max-age=31536000`; gzip/brotli. HTTPS обязателен для prod-клиентов (BotFather принимает только `https://` URL; TLS терминируется на reverse proxy/ingress). **[мнение]** CSP: разрешить `frame-ancestors` для `https://web.telegram.org` (Web-клиенты открывают Mini App в iframe) — не ставить `X-Frame-Options: DENY`.
- **Runtime env:** `env.js` генерируется entrypoint-ом контейнера из переменных (`window.__ENV__ = { API_URL, SENTRY_DSN, TONCONNECT_MANIFEST_URL, BOT_USERNAME }`) — уже принятая схема tooling.md §9. Не класть секреты (токен бота — только бэкенд).
- **Dev:** `vite --host` + HTTPS (`@vitejs/plugin-basic-ssl` 2.3 или `vite-plugin-mkcert` 2.1; официальный шаблон использует mkcert, но предупреждает: самоподписанные сертификаты не грузятся в Android/iOS клиентах). Для мобильных клиентов — туннель: **cloudflared** quick tunnel (бесплатно, без аккаунта, но случайный домен при каждом запуске → менять URL в BotFather или держать named tunnel с постоянным доменом), ngrok (стабильный бесплатный домен, interstitial-страница на бесплатном плане — **[мнение]** может мешать в webview, проверить), localtunnel (нестабилен). Рекомендация: named Cloudflare Tunnel на поддомене команды + отдельный dev-бот; скрипт `pnpm dev:tunnel` (Node, кроссплатформенно).
- `server.allowedHosts` в Vite нужно разрешить для домена туннеля (Vite блокирует чужие Host с 2025 г.).

### 10. PWA / offline

- **[факт, косвенно]** В WKWebView сторонних iOS-приложений service worker доступен только с App-Bound Domains (≤10 доменов, без wildcard) или browser-entitlement — Telegram не может так покрыть произвольные Mini Apps (https://developer.apple.com/forums/thread/722160, https://docs.median.co/docs/service-workers). Подтверждения от Telegram нет.
- **[мнение]** `vite-plugin-pwa` (2.0.0) в шаблон `tma` не включать: offline внутри Telegram бессмыслен (Telegram сам требует сеть), SW усложняет инвалидацию деплоев. Кэш данных — `persistQueryClient` в DeviceStorage/localStorage для мгновенного второго запуска. Если тот же код открывается как обычный веб/PWA — PWA это опция веб-сборки, а не TMA.

### 11. Запуск того же приложения в обычном браузере

- Три режима, определяемые в `platform/telegram/init.ts`: (1) реальный Telegram (`isTMA()`), (2) dev-mock (`mockTelegramEnv`, только `import.meta.env.DEV` или флаг staging), (3) «web fallback» — приложение без Telegram (если продукт этого хочет): back button → обычная кнопка в header, MainButton → кнопка kit-а, auth → Telegram Login Widget/OIDC на бэкенде. **[мнение]** Режим 3 — опция, не дефолт: для него нужна отдельная авторизация.
- Mock никогда не попадает в prod-бандл (dynamic import под `import.meta.env.DEV`).

### 12. Игра внутри TMA

- Шаблон `game` (05e) может запускаться как TMA: общий модуль `packages/telegram` (адаптер §2 вынести в пакет, если выбраны и `tma`, и `game`). Для игр: `requestFullscreen()`, `lockOrientation()`, `disableVerticalSwipes()`, акселерометр/гироскоп (8.0), `DeviceStorage` для сейвов, Stars для покупок. Значит адаптер Telegram лучше сразу делать пакетом `packages/telegram-platform`, а не папкой внутри `apps/tma`.

## Recommendations for the boilerplate

Приоритет P0 (ядро шаблона `tma`):
1. `apps/tma`: Vite 8 + React 19 + TS, SPA, без SSR. Initial JS-бюджет ~150 KB gz с проверкой в CI (`size-limit` или анализ Rollup/Rolldown).
2. `packages/telegram-platform` (шарится с `game`): `@tma.js/sdk-react` 3.x, единственное место импорта SDK (ESLint `no-restricted-imports`), mock для dev/e2e, адаптеры back button (стек обработчиков), main/secondary button (декларативный компонент), haptics, storage (cloud/device/secure + fallback), theme bridge, safe-area/viewport CSS-переменные с собственными алиасами.
3. Роутер — тот же, что выберет оркестратор для SPA-шаблонов (рекомендую TanStack Router: типизированные search params, view transitions с направлением); один глобальный хук BackButton ↔ history; deep link `startapp` → маршрут в одном месте.
4. Общие пакеты: `packages/ui` (Tailwind v4 + headless Base UI/Radix), `packages/tokens` (семантические CSS-переменные, режимы brand/native), `packages/api` (openapi-typescript + openapi-fetch + TanStack Query, middleware `Authorization: tma …`), `packages/i18n`.
5. Docker: static nginx image, runtime `env.js`, SPA fallback, кэш-заголовки, без `X-Frame-Options: DENY`.
6. Dev: HTTPS dev server + скрипт туннеля (Node), инструкция по dev-боту и test environment, eruda за флагом.

P1 (опции init-скрипта, удаляются если не выбраны):
7. `payments-stars` (клиентская часть: `invoice.openUrl` + обработка статусов + инвалидация).
8. `ton-connect` (`@tonconnect/ui-react`, lazy, manifest в `public/`).
9. `tg-analytics` (`@telegram-apps/analytics`, отложенная загрузка).
10. Sentry (общий модуль для всех шаблонов), без PII из initData.

Чего избегать:
- Next.js/Vike/SSR для TMA; `@telegram-apps/telegram-ui` как основа UI; `@twa-dev/sdk` и `@telegram-apps/*` в новом коде; прямой `window.Telegram` вне адаптера; `100vh`/`dvh` в экранах; PWA/service worker в TMA; MobX+DI как обязательный слой; синхронная загрузка TON Connect/аналитики.
- Исправить в `docs/library-notes.md` (после согласия пользователя): лимит `startapp` 512, а не 64; имена CSS-переменных зависят от SDK (`--tg-viewport-*` у tma.js); раздел переименовать с `@twa-dev/sdk` на нейтральный «Telegram Mini App».

### Сводная таблица

| Потребность | Рекомендация | Альтернатива | Риск |
| --- | --- | --- | --- |
| Сборка/рендер | Vite 8.3 + React 19.3 SPA, static | Next.js 16 (tma.js template) | Старые Android WebView без обновлений |
| SSR/SEO | не нужны (launch params в hash) | — | — |
| SDK | `@tma.js/sdk-react` 3.0.23 / `@tma.js/sdk` 3.3.0 | сырой `telegram-web-app.js`; `@twa-dev/sdk` 8.0.2 | один мейнтейнер, история breaking-переименований → изоляция в адаптере |
| Dev вне Telegram | `mockTelegramEnv` (dev/e2e only) | свой fake `window.Telegram` | мок ≠ реальные клиенты → ручной чек-лист |
| Роутинг + Back | TanStack Router 1.170 + глобальный BackButton-хук | React Router 8.4 data mode | частые релизы TanStack → pin |
| UI kit | общий Tailwind 4.3 + Base UI 1.9/Radix + theme bridge | `@telegram-apps/telegram-ui` 2.1.13 | ручная работа над «нативным» видом |
| Токены | семантические CSS vars, режимы brand/native ← `--tg-theme-*` | только бренд-тема | контраст в нестандартных темах Telegram |
| Safe area/viewport | `bindCssVars` + алиасы, `stable-height` | `env(safe-area-*)` | разные имена vars у SDK |
| Server state | TanStack Query 5.104 + openapi-fetch 0.17 + openapi-react-query 0.5 | orval / RTK Query | openapi-react-query 0.x API нестабилен |
| Auth | `Authorization: tma <initDataRaw>` → бэкенд HMAC/Ed25519 → сессия | initData на каждый запрос без обмена | истечение `auth_date`, утечка initData в логи |
| Client state | Zustand 5.0 | MobX 7 MVVM (опция), Jotai 3 | разрыв с привычками пользователя (MobX) |
| Анимации | View Transitions + CSS; Motion 14 (`LazyMotion`) точечно | только Motion | VT нет на старых webview; jank на LOW Android |
| Жесты/sheet | scroll-snap, Motion drag, Vaul 1.1 | @use-gesture 10.3 | vaul/@use-gesture слабо развиваются |
| Платежи Stars | backend `createInvoiceLink` + `invoice.openUrl` | — | статус только с бэкенда |
| TON | `@tonconnect/ui-react` 5.0.x lazy | `@tonconnect/sdk` headless | ~160 KB gz; свежий мажор; minimumReleaseAge |
| Формы | react-hook-form 7.90 + zod 4.6 | @tanstack/react-form 1.33 | — |
| i18n | i18next 26 + react-i18next 17, язык из `language_code` | — | нормализация кодов (`pt-br`) |
| Аналитика каталога | `@telegram-apps/analytics` 1.6.4 опционально, отложенно | нет / Telemetree | вес ~145 KB gz; требования каталога не ясны |
| Ошибки | `@sentry/react` 11.7 без PII | GlitchTip (self-host, Sentry-совместим) | утечка initData |
| Тесты | Vitest 5 + Playwright 1.64 с mock env | — | нет автотестов в реальных клиентах |
| Deploy | nginx static image + runtime `env.js` | Node static server | неверные заголовки кэша `index.html` |
| Dev в Telegram | named Cloudflare Tunnel + dev-бот; test env для HTTP | ngrok, localtunnel | смена URL в BotFather при quick tunnel |
| PWA/offline | не включать в TMA | `vite-plugin-pwa` 2.0 для web-сборки | SW недоступен в iOS webview |

## Open questions for the user

1. Тема TMA: брендированная (свои цвета, light/dark) или нативная (цвета Telegram), или обе через переключатель в токенах?
2. Должен ли тот же код TMA открываться как обычный веб-сайт вне Telegram (тогда нужна вторая схема авторизации) или браузер — только для разработки?
3. Клиентское состояние по умолчанию: Zustand (рекомендация) или сохранить MobX MVVM как стандарт всех шаблонов?
4. Нужны ли в шаблоне по умолчанию TON Connect и Telegram Mini Apps Analytics, или это опции init-скрипта (рекомендация — опции)?
5. Как бэкенд принимает авторизацию: initData на каждый запрос или обмен на собственный токен (влияет на `packages/api` middleware)?
6. Есть ли у команды постоянный домен для dev-туннеля (Cloudflare) и отдельный dev-бот?
