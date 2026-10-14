# 17e. Шаблон tma: глубокая проверка стека
Status: done
Updated: 2026-10-15

## Resume notes
- Done: все разделы. Версии сняты `npm view` 2026-10-15 (registry доступен), Bot API по core.telegram.org (webapps +
  api-changelog), движки webview Telegram Desktop по исходникам `desktop-app/lib_webview`, pnpm 11/12 по pnpm.io,
  TS 7 по devblogs.microsoft.com, Vaul README, Base UI Drawer docs, tma.js 4.0.0-rc.0 по tarball.
- Next: ничего. Не проверено (GitHub API rate limit): число мейнтейнеров tma.js за последние месяцы; поддержка View
  Transitions в WebKitGTK (Telegram Desktop на Linux, не целевая платформа).
- Sub-agent: нет.

## Summary (≤ 15 lines)
1. Ядро tma держится: Vite 8.3.4 (Rolldown внутри), React 19.3 (19.3.1 вышел вчера — пин 19.3.0 из-за `minimumReleaseAge`), `@vitejs/plugin-react` 6.1.2 (Oxc, без Babel), TanStack Router 1.170.44, Query 5.104.2, MobX 7.0.6, i18next 26.4.5, Base UI 1.9.0, Tailwind 4.3.3.
2. **tma.js: 11.10.2026 вышел `4.0.0-rc.0`** (sdk, sdk-react, bridge, init-data). v4 убирает `fp-ts`, `better-promises`, `@tma.js/signals` из зависимостей, добавляет `safe*`-варианты + `matchError`, `supports('feature')`. Старт на 3.3.0/3.0.23 (stable), миграция на 4.0 — одним PR внутри `packages/telegram-platform` в первые 1–2 месяца; вероятность breaking-изменения в 12 мес. — высокая (уже факт).
3. **Bot API 10.2 (14.07.2026): методы Mini App блокируются с origin, отличного от домена Mini App** (включено для всех 20.07.2026). Последствия: dev-туннель обязан отдавать приложение на том же домене, что в BotFather; редиректы на чужой домен и iframe с чужих origin теряют доступ к Telegram API.
4. **Vaul — официально unmaintained** (README). Заменить на **Base UI Drawer** (есть с ≤1.2; swipe-to-dismiss, snap points, вложенные, `--drawer-swipe-progress`, `VirtualKeyboardProvider`). Это ещё и один примитив-слой вместо Radix-зависимости Vaul.
5. **Telegram Desktop не на Qt WebEngine**: Windows — WebView2 (Edge Chromium, evergreen, fallback EdgeHTML на старых системах), macOS — WKWebView (системный WebKit), Linux — WebKitGTK. Все целевые клиенты, кроме iOS < 18 и EdgeHTML, умеют same-document View Transitions.
6. Переходы экранов: мастер-план выбрал `ScreenTransition` без VT API. Факт: официальный рецепт TanStack Router + Motion — только `AnimatePresence mode="wait"` (последовательно, не «нативный push»). Мнение: для одновременного push/pop нужен «замороженный» outlet — это самый рискованный кусок шаблона; держать волну 0 на прототипе на реальных iPhone/Android.
7. **TypeScript 7.0.2 GA (08.07.2026) без JS API**; typescript-eslint 8.71.2 требует `typescript <6.1.0`. Решение мастер-плана «TS 5.9 на старте» устарело: брать **TS 6.0.3 как `typescript`** + опционально `tsc` 7 через alias (`@typescript/native: npm:typescript@^7.0.2`) — рецепт Microsoft.
8. **pnpm 12 (26.08.2026) = переписан на Rust**, ежедневные фиксы install. pnpm 11.28.x — зрелая линия с нужными дефолтами (`minimumReleaseAge` 1 день, `blockExoticSubdeps`, `strictDepBuilds`, `allowBuilds`, конфиг только в `pnpm-workspace.yaml`). Мнение: стартовать на 11.28.x, 12 — после стабилизации (≥ 3 мес.).
9. Turborepo 2.11.8 (13.10.2026) живой, активно чинит парсинг pnpm-lockfile; поддержка lockfile pnpm 12 явно не заявлена — ещё один довод за pnpm 11.
10. `@telegram-apps/analytics` 1.6.4 (январь 2026) тянет legacy `@telegram-apps/sdk`, `@tonconnect/ui` 2.0.5 (вторая копия TON Connect), `http-server` и `@innerworks-me/iw-auth-sdk` в runtime-зависимостях. В опции `tg-analytics` — только CDN-скрипт `tganalytics.xyz` после `ready()`, не npm.
11. `cloudflared` из npm — community-обёртка с `postinstall`-загрузкой бинаря (нужен `allowBuilds`); лучше системный бинарь + Node-скрипт.

## Findings

Обозначения: **[факт]** — проверено 2026-10-15 по источнику; **[мнение]** — оценка автора.

### 1. Сводная таблица

Даты — даты публикации указанной версии в npm (registry `time`). Health: ● активно (релиз < 1 мес.), ◐ живо, ○ застой/unmaintained.

| Технология | Выбор + точная версия | Дата релиза | Health | Риск breaking 12 мес. | Вердикт | Источник |
| --- | --- | --- | --- | --- | --- | --- |
| Сборщик | `vite` 8.3.4 (Rolldown 1.2.x внутри) | 2026-10-08 | ● | средний (Vite 9 ~ 2027, годичный цикл: 7.0 06.2025, 8.0 03.2026) | берём | https://www.npmjs.com/package/vite |
| React plugin | `@vitejs/plugin-react` 6.1.2 (peer `vite ^8`, Oxc; Babel/Compiler опционально) | 2026-10-05 | ● | низкий | берём; Compiler выключен → `@rolldown/plugin-babel` не нужен | https://www.npmjs.com/package/@vitejs/plugin-react |
| React | `react`/`react-dom` **19.3.0** (19.3.1 от 14.10 блокируется порогом 7 дн.) | 2026-09-09 | ● | низкий в 19.x | берём, пин через catalog | https://www.npmjs.com/package/react |
| TMA SDK | `@tma.js/sdk-react` 3.0.23 + `@tma.js/sdk` 3.3.0; **`4.0.0-rc.0`** на теге `rc` | 3.x: 2026-07-14; rc: 2026-10-11 | ◐ (один основной мейнтейнер) | **высокий: v4 уже в RC** | берём 3.x, smoke 4.0-rc в волне 0, переход на 4.0 при GA | `npm view @tma.js/sdk dist-tags` |
| Платформа | Bot API Mini Apps до 10.2 (origin hardening), последние фичи: 9.5 `iconCustomEmojiId`, 9.6 `requestChat`, 10.1 join request Web App | 10.2: 2026-07-14 | ● | средний: Telegram ужесточает (10.2) | учитывать в dev/туннеле | https://core.telegram.org/bots/webapps, https://core.telegram.org/bots/api-changelog |
| Роутер | `@tanstack/react-router` 1.170.44 + `@tanstack/router-plugin` 1.168.46 | 2026-10-12 / 10-14 | ● (релизы почти ежедневно) | низкий (v1 стабилен), но высокая частота патчей | берём, пин | https://www.npmjs.com/package/@tanstack/react-router |
| Переходы | VT API через `defaultViewTransition` **или** Motion `AnimatePresence`; `motion` 14.2.0 | 2026-10-13 | ● | средний: 13.0 (08.2026) и 14.0 (10.2026) — мажоры, но мелкие (удаление внутренних API) | см. §4 | https://raw.githubusercontent.com/motiondivision/motion/main/CHANGELOG.md |
| Bottom sheet | **Base UI Drawer** (`@base-ui/react` 1.9.0) вместо `vaul` 1.1.2 | 1.9.0: 2026-10-09; vaul: 2024-12-14 | Base UI ●; vaul ○ (README: «This repo is unmaintained») | Base UI низкий (1.x, ежемесячные минорные) | Vaul — **не брать** | https://github.com/emilkowalski/vaul, https://base-ui.com/react/components/drawer |
| Стили | `tailwindcss` 4.3.3 + `tailwind-variants` 3.3.1 | 2026-07-16 / 2026-08-03 | ● | низкий | берём (решение пользователя) | npm |
| Состояние | `mobx` 7.0.6 + `mobx-react-lite` 5.1.0 (peer `react ^18 \|\| ^19`) | 2026-10-02 / 2026-09-24 | ● | низкий (7.0 вышел 30.07.2026) | берём (решение пользователя) | npm |
| Server state | `@tanstack/react-query` 5.104.2 | 2026-10-11 | ● | низкий (v6 не анонсирован в dist-tags) | берём | npm |
| API-генератор | `@hey-api/openapi-ts` 0.99.0 (exact pin), тег `next` от 2026-09-30 | 2026-06-22 | ◐ (stable-линия стоит 4 мес.) | высокий (0.x, 1.0 ожидается) | берём с exact pin (решение 17f важнее) | npm |
| Формы | `react-hook-form` 7.90.0 + `zod` 4.6.7 | 2026-10-11 / 10-12 | ● | **высокий: RHF 8.0.0-beta.4** | берём 7.x | npm |
| i18n | `i18next` 26.4.5 + `react-i18next` 17.0.16; язык из `initData.user.language_code` (свой detector, без `i18next-browser-languagedetector`) | 2026-10-14 / 10-06 | ● | средний (i18next — мажор ~раз в год, 26.0 в 03.2026) | берём; 26.4.3–26.4.5 моложе 7 дней → в catalog последний патч старше порога | npm |
| TON | `@tonconnect/ui-react` 5.0.1 (= ui 5.0.1), lazy | 2026-10-11 | ● | средний (5.0 = выравнивание мажоров, код 3.1) | опция; пин ≤ проверенной версии до 18.10 | https://raw.githubusercontent.com/ton-connect/sdk/main/packages/ui-react/CHANGELOG.md |
| Stars | `invoice.openUrl` (SDK) + `createInvoiceLink` на бэкенде | — | ● | низкий | опция `payments-stars` | https://core.telegram.org/bots/payments-stars |
| Аналитика каталога | `@telegram-apps/analytics` 1.6.4 → **CDN-скрипт `https://tganalytics.xyz/index.js`** | 2026-01-22 | ○ (9 мес. без релиза, legacy-зависимости) | средний | опция, только CDN, после `ready()` | npm README |
| Haptics | `hapticFeedback` из tma.js | — | ● | следует за SDK | через хелпер в адаптере | SDK README |
| Тесты | `@playwright/test` **1.64.0** (1.64.1 от 14.10 моложе порога) + `mockTelegramEnv`; `vitest` 5.0.4 | 2026-10-07 / 2026-10-12 | ● | Vitest низкий | берём | npm |
| Ошибки | `@sentry/react` 11.7.0, lazy | 2026-10-12 | ● | средний (11.0 — 09.2026, мажоры ~раз в год) | берём | npm |
| Dev-консоль | `eruda` 3.4.3 | 2025-06-15 | ○ (16 мес. без релиза, но стабилен) | низкий | только dev/staging, динамический import | npm |
| Туннель | системный `cloudflared` (named tunnel); npm-обёртка `cloudflared` 0.7.3 (JacobLinCool, `postinstall` качает бинарь) | 2026-08-10 | ◐ | низкий | системный бинарь + Node-скрипт; npm-обёртка только с `allowBuilds` | npm `scripts.postinstall` |
| HTTPS dev | `@vitejs/plugin-basic-ssl` 2.3.0 | 2026-03-24 | ◐ | низкий | только desktop/web; мобильные клиенты — туннель | npm |
| Deploy | nginx static + runtime `env.js`, CSP `frame-ancestors https://web.telegram.org` | — | — | — | берём | 05c §9 |
| pnpm | **11.28.x** (latest-11 11.28.2, `next-11` 11.28.5); latest = 12.11.2 (Rust) | 11.28.2: 2026-09-28; 12.0.0: 2026-08-26 | ● обе | 12: высокий (Rust-переписывание, ежедневные фиксы) | 11 на старте, 12 позже | https://pnpm.io/blog/releases/11.0, https://pnpm.io/blog/releases/12.0 |
| Turborepo | `turbo` 2.11.8 | 2026-10-13 | ● | низкий (v2 с 06.2024) | берём | https://releases.sh/vercel/turborepo-releases.md |
| TypeScript | **6.0.3** как `typescript`; опц. 7.0.2 через alias для `tsc` | 6.0.3: 2026-04-16; 7.0.2: 2026-07-08 | ● | высокий: 7.1 с новым API «ожидается»; typescript-eslint на 7 не готов | 6.0 + alias 7 | https://devblogs.microsoft.com/typescript/?p=5246 |
| Линтер TS | `typescript-eslint` 8.71.2, peer `typescript >=4.8.4 <6.1.0` | 2026-10-12 | ● | средний (поддержка TS 7 потребует нового API) | берём, с TS 6 | `npm view typescript-eslint peerDependencies` |

### 2. tma.js: 3.x против 4.0 RC

- **[факт]** dist-tags: `@tma.js/sdk` `latest 3.3.0`, `rc 4.0.0-rc.0` (2026-10-11 21:46 UTC); то же у `sdk-react`, `bridge`. Зависимости 3.3.0: `fp-ts`, `valibot`, `error-kid`, `@tma.js/{types,bridge,signals,toolkit,transformers}`, `better-promises`. Зависимости 4.0.0-rc.0: только `valibot ^1.5`, `error-kid ^3.1`, `@tma.js/bridge`, `@tma.js/init-data` — заметно меньше графа (минус `fp-ts`).
- **[факт]** README 4.0-rc: `init()` обязателен, иначе `NotInitializedError`; компоненты — plain objects с `mount()` (у `viewport` async); реактивные значения — computed с `subscribe(next, prev)`, совместимы с `useSyncExternalStore`; `isSupported()` + новый `supports('rgb' | 'iconCustomEmojiId' | 'tryBrowser' …)`; `safe*`-варианты возвращают `{ok, error}` с исчерпывающим `matchError`; `ConcurrentCallError`, `CSSVarsBoundError`, `timeout`/`signal` у async. Компоненты: back/main/secondary/settings button, closingBehavior, swipeBehavior, miniApp, themeParams, viewport, initData, hapticFeedback, popup, invoice, qrScanner, biometry, locationManager, cloud/device/secure storage, **`serverless`** (новое). Есть `hideKeyboard`, `requestChat` (Bot API 9.6). `sdk-react` 4: peer `react ^18 || ^19` (17 убрали), хуки `useComputed`, `useLaunchParams`, `useRawInitData`, `useAndroidDeviceData`.
- **[мнение]** Публичная модель 3.x → 4.0 близка (объекты-компоненты, computed, `isSupported`), основной breaking — ошибки (`safe*`/`matchError` вместо fp-ts Either) и `init()`. В адаптере это ~1 день работы. Брать 3.x на старте реализации, в волне 0 собрать ветку на 4.0-rc; если 4.0 GA выйдет до релиза бойлерплейта — стартовать сразу с 4.0.
- **[факт]** Риск «один мейнтейнер» остаётся (05c). Изоляция SDK в `packages/telegram-platform` + `no-restricted-imports` — достаточное смягчение.

### 3. Bot API / платформа (на 2026-10-15)

- **[факт]** Mini App-фичи по версиям: 7.7 `disableVerticalSwipes`; 7.10 SecondaryButton, `setBottomBarColor`; 8.0 (17.11.2024) fullscreen, `safeAreaInset`/`contentSafeAreaInset`, `isActive`, home screen, `shareMessage`, `downloadFile`, LocationManager, акселерометр/гироскоп/ориентация, `lockOrientation`; 9.0 (11.04.2025) DeviceStorage (5 MB) и SecureStorage (10 элементов, Keychain/Keystore); 9.1 `hideKeyboard`; 9.5 (01.03.2026) `iconCustomEmojiId` у BottomButton; 9.6 (03.04.2026) `requestChat` + prepared keyboard buttons; 10.1 (11.06.2026) `chat_join_request_query_id`, `sendChatJoinRequestWebApp`; **10.2 (14.07.2026)** «disallowing the usage of Mini App methods from origins different from the original Mini App domain», включено автоматически 20.07.2026, opt-out через @BotFather; 10.3 (24.08.2026) — без Mini App-изменений. CloudStorage — до 1024 ключей.
- **[факт]** Официальные CSS-переменные скрипта: `--tg-theme-*` (15 цветов), `--tg-safe-area-inset-*`, `--tg-content-safe-area-inset-*`, `--tg-viewport-height`, `--tg-viewport-stable-height`, `--tg-color-scheme`. У tma.js `viewport.bindCssVars()` — `--tg-viewport-safe-area-inset-*` (другие имена). Токены ссылаются только на свои алиасы.
- **[мнение] Следствия 10.2:** (1) `pnpm tunnel` должен выдавать стабильный домен, совпадающий с URL dev-бота (named tunnel), quick tunnel с меняющимся доменом — только с обновлением BotFather; (2) нельзя открывать Mini App через редирект на другой домен (например, staging → CDN); (3) встраиваемые виджеты с чужого origin (платёжные iframe) не вызовут Telegram API — всё через родительское окно.

### 4. Переходы экранов в webview Telegram

- **[факт] Движки:** `desktop-app/lib_webview` (Telegram Desktop): Windows — `webview_windows_edge_chromium` (WebView2), fallback `edge_html` если WebView2 нет/система старая; macOS — `webview_mac.mm` на WKWebView; Linux — WebKitGTK. Telegram for macOS (нативный) и iOS — WKWebView; Android — системный Android WebView (Chromium, обновляется через Play). Qt WebEngine **не используется**.
- **[факт] Same-document VT** (`document.startViewTransition`): Chrome/Chromium 111+, Safari и Safari iOS **18.0+**, Firefox 144+ (caniuse). WKWebView использует системный WebKit → iOS 18+ / macOS с Safari 18+. Типы VT (`types`) — Chromium 125+, Safari 18.2+ (**[факт по памяти, не перепроверено]**); TanStack Router при отсутствии поддержки типов откатывается к VT без типов, при отсутствии VT — игнорирует опцию (docs RouterOptions).
- **[факт]** Официальный пример TanStack Router + Motion: `<AnimatePresence mode="wait" initial={false}>` с ключом `location.pathname` — последовательная анимация (уход → приход), без одновременного push/pop.
- **[мнение] Оценка вариантов:**

| | VT API (`defaultViewTransition` + CSS `::view-transition-*`) | Motion `AnimatePresence` (`ScreenTransition` мастер-плана) |
| --- | --- | --- |
| Охват целевых клиентов | Android, Windows (WebView2), macOS (Safari 18+), iOS 18+; iOS ≤ 17 и EdgeHTML → мгновенная смена | везде |
| Нативный push/pop (оба экрана одновременно, parallax) | да, снимки old/new из коробки | только `mode="popLayout"/"sync"` + «замороженный» outlet (уходящий экран рендерит старый match); официального рецепта нет → свой код, риск |
| Прерываемость, ввод во время перехода | не прерывается (новая навигация пропускает текущий), ввод блокируется на время анимации | прерывается |
| Вес | 0 KB | `motion` в initial (~15–20 KB gz с `LazyMotion`) |
| Слабый Android (`performanceClass=LOW`) | снимок всей страницы, можно выключить через `types`/флаг | контролируется |

  Рекомендация **[мнение]**: один механизм в API (`ScreenTransition`), но с двумя реализациями за ним: на клиентах с VT — VT с типами `push`/`pop` (направление из индекса history), без VT/на LOW/при reduced-motion — fade 150–240 мс через CSS. Это закрывает требование «native-feeling» дешевле, чем замороженный outlet на Motion. Решение «без VT из-за iOS < 18» из мастер-плана слишком строгое: на iOS < 18 откат — тот же fade. Проверить на iPhone (iOS 18 и 17), Android LOW, Windows, macOS в волне 0.
- **BackButton ↔ роутер [мнение, без изменений к 05c]:** один хук в root layout: `backButton.show()` при `router.history.canGoBack()` и не top-level маршруте; `onClick → router.history.back()`; стек локальных перехватчиков (Drawer/модалка закрывается первой). Направление перехода `pop` выставлять и для аппаратного Back Android (приходит как `back_button_pressed`).

### 5. UI: Drawer, тема, safe area

- **[факт]** Vaul README: «This repo is unmaintained… not in the near future». Последний релиз 1.1.2 (14.12.2024), зависит от `@radix-ui/react-dialog` — второй примитив-слой рядом с Base UI.
- **[факт]** Base UI Drawer (в `@base-ui/react` с ≤1.2.0, 02.2026): `swipeDirection` (down по умолчанию), `snapPoints`, `snapToSequentialPoints`, вложенные drawer (`--nested-drawers`, `--drawer-height`), `--drawer-swipe-progress` для backdrop, `Drawer.SwipeArea` (swipe-to-open от края), `data-base-ui-swipe-ignore` для каруселей, `Drawer.VirtualKeyboardProvider` + `--drawer-keyboard-inset`. На странице нет пометки preview/stable.
- **[мнение]** `VirtualKeyboardProvider` почти наверняка опирается на `visualViewport`, который в мобильном Telegram не реагирует на клавиатуру (05c, опыт xRocket) → в TMA подать свой inset из `viewportChanged`/`viewportHeight` либо отключить; проверить на iOS. При открытом Drawer — `swipeBehavior.disableVertical()`, иначе свайп вниз сворачивает приложение.
- **Theme bridge [мнение, уточнение 05c под решение пользователя «Telegram по умолчанию, бренд возможен»]:** дефолт `data-tg-theme="native"` (семантические токены ← `--tg-theme-*`), бренд — переключатель в `apps/tma/src/theme.ts` (один объект цветов light/dark + флаг `syncTelegramChrome`, который вызывает `miniApp.setHeaderColor/setBackgroundColor/setBottomBarColor`). В fullscreen header прозрачный — Telegram сам советует `setHeaderColor`. В Tailwind — `@theme inline` ссылается на семантические переменные, не на `--tg-*` напрямую.

### 6. Данные, auth, i18n, платежи, аналитика, ошибки

- **Auth [мнение]:** fetch-слой ставит `Authorization: tma <initDataRaw>` только на эндпоинт обмена → бэкенд валидирует (HMAC или Ed25519) → короткая сессия в памяти. Сессию не персистить: initData доступен при каждом запуске, повторный обмен дешевле, чем хранить токен (SecureStorage не нужен для этого).
- **i18n [факт/мнение]:** `language_code` — IETF-тег (`pt-br`); нормализация к поддерживаемым, fallback `en`; выбор пользователя — DeviceStorage (локально) или CloudStorage (между устройствами). Детектор браузера не нужен.
- **Stars [факт, 05c подтверждено]:** `XTR`, пустой `provider_token`, `pre_checkout_query` ≤ 10 c; клиент — `invoice.openUrl` + обработка статуса, истина — бэкенд.
- **TON Connect [факт]:** 5.0.1 (11.10.2026), peer `react >=17`; моложе 7-дневного порога до 18.10.2026.
- **Аналитика каталога [факт]:** npm-пакет 1.6.4 зависит от `@telegram-apps/sdk ^3.9.2` (legacy-скоуп), `@tonconnect/ui 2.0.5` (точная версия → вторая копия TON Connect при опции `ton-connect` 5.x), `http-server 14.1.1` и `@innerworks-me/iw-auth-sdk` в `dependencies`. README даёт второй путь — CDN `https://tganalytics.xyz/index.js` + `window.telegramAnalytics.init({ token, appName })`. **[мнение]** опция `tg-analytics` = CDN-скрипт, грузится после `miniApp.ready()`; CSP `script-src`/`connect-src` дополняются только при выбранной опции.
- **Sentry [факт]:** 11.7.0; lazy через динамический `import()` после `ready()`; без initData/user (PII).

### 7. Dev, тесты, deploy

- **Туннель [факт]:** npm `cloudflared` 0.7.3 — `postinstall: node scripts/postinstall.mjs && node lib/cloudflared.js bin install` (качает бинарь); при pnpm 11 `strictDepBuilds: true` без `allowBuilds: { cloudflared: true }` установка упадёт. **[мнение]** `pnpm tunnel` = Node-скрипт, который ищет системный `cloudflared` (winget/brew/apt), запускает named tunnel к прод-сборке (`vite preview`/nginx-контейнер), сам дописывает `server.allowedHosts`/`preview.allowedHosts`; без бинаря печатает инструкцию.
- **Тесты [мнение]:** Playwright 1.64.0 против прод-сборки с `mockTelegramEnv` (флаг сборки staging), матрица: light/dark Telegram, brand, compact/fullscreen insets, LOW performance class (выключенные переходы), BackButton-стек, `startapp` → маршрут.
- **Deploy [без изменений к 05c]:** nginx static, `try_files … /index.html`, `index.html` no-cache, хешированные ассеты immutable, CSP `frame-ancestors 'self' https://web.telegram.org` без `X-Frame-Options: DENY`; runtime `env.js`.

### 8. Общее ядро (срез 17e)

- **pnpm [факт]:** 10.0 (07.01.2025), 11.0 (28.04.2026), 12.0 (26.08.2026, «a rewrite of pnpm in Rust», ставится без Node). Ветки 10 и 11 ещё получают релизы (10.34.6 и 11.28.2 — 28.09.2026; `next-11` 11.28.5). pnpm 11: Node 22+, pure ESM, `minimumReleaseAge` = 1440 мин по умолчанию, `minimumReleaseAgeStrict` = true при явной настройке, `blockExoticSubdeps` = true, `strictDepBuilds` = true, `allowBuilds` (map имя → bool) заменил `onlyBuiltDependencies`/`neverBuiltDependencies`, не-auth настройки из `.npmrc` не читаются (только `pnpm-workspace.yaml`), env-префикс `pnpm_config_*`. `trustPolicy: no-downgrade` с 10.21 (по умолчанию off), `trustPolicyExclude` 10.22, `trustPolicyIgnoreAfter` 10.27. pnpm 12: неизвестные ключи `pnpm-workspace.yaml` — ошибка при совпадении пина, lockfile пишет resolution settings (12.10), experimental `nodeLinker: loaded`. Источники: pnpm.io/blog/releases/11.0, /12.0, /settings/dependency-resolution.
- **[мнение] pnpm:** `packageManager: pnpm@11.28.x` + `minimumReleaseAge: 10080` (7 дн.), `trustPolicy: no-downgrade`, `allowBuilds` явным списком (esbuild не нужен Vite 8; `@parcel/watcher`/`cloudflared` по факту). Переход на 12 — отдельный PR после проверки `turbo prune` и CI на Windows.
- **Turborepo [факт]:** 2.11.8 (13.10.2026), 2.11.0 (18.09), 2.10.x переписали парсинг pnpm-lockfile, 2.11.8 — сохранение неизвестных настроек lockfile при prune, release-age исключения, catalog snapshots. Сообщений о сворачивании проекта Vercel не найдено. Явной поддержки pnpm 12 в changelog нет.
- **TypeScript [факт]:** 5.9.3 (30.09.2025), 6.0.2 (23.03.2026), 6.0.3 (16.04.2026), 7.0.1-rc (18.06), **7.0.2 latest (08.07.2026)**, `next` = 7.1.0-dev. Пакет `typescript@7` экспортирует только `./lib/version.cjs` и `./unstable/*` — классического `ts.createProgram` нет. Microsoft: «it does not ship with an API. We expect TypeScript 7.1 to ship with a new (and different) API»; рекомендованный `package.json`: `"@typescript/native": "npm:typescript@^7.0.2"`, `"typescript": "npm:@typescript/typescript6@^6.0.2"` (`@typescript/typescript6` даёт `tsc6` и API 6.0). В 7.0 ошибками стали `target: es5`, `moduleResolution: node/node10`, `baseUrl`, `downlevelIteration`.
- **[факт]** `typescript-eslint` 8.71.2 и `@typescript-eslint/parser`: peer `typescript >=4.8.4 <6.1.0`. `@hey-api/openapi-ts` 0.99: peer `typescript >=5.5.3 || >=6.0.0`. Vite 8 и Vitest 5 TypeScript-компилятор не используют (Oxc/Rolldown) → от TS 7 не зависят. Vitest 5.0.4: peer `vite ^6.4 || ^7 || ^8`, Node `^22.12 || ^24 || >=26`.
- **[мнение] TS:** в catalog `typescript: npm:@typescript/typescript6@6.0.3` (или просто `typescript@6.0.3`), `tsconfig` сразу без `baseUrl`/`node10`; `typecheck` через TS 7 alias как ускорение, когда smoke пройдёт. Переход на «чистый» 7 — после typescript-eslint с API 7.1.
- **Vite [факт]:** 8.0.0 (12.03.2026), 8.3.0 (10.09.2026), 8.3.4 (08.10.2026); тег `previous` 6.4.4. `@vitejs/plugin-react` 6.x peer только `vite ^8`, Node `^20.19 || >=22.12`. `@tanstack/router-plugin` peer `vite >=5…>=8`, Node ≥ 20.19.

### 9. Короткие заметки о заменах

- Vaul → Base UI Drawer (unmaintained против уже используемого kit-слоя).
- npm `@telegram-apps/analytics` → CDN-скрипт той же библиотеки (граф зависимостей, дубль TON Connect).
- npm `cloudflared` → системный бинарь (postinstall-загрузка, community-пакет).
- TS 5.9 → TS 6.0.3 (+ alias 7.0.2) (5.9 отстаёт на два мажора: 6.0 и 7.0; TS 7 без JS API).
- pnpm «актуальный мажор» → pnpm 11.28.x явно (12 — Rust-переписывание 7-недельной давности).
- Версии в таблице — `latest` на 15.10.2026; многие моложе 7 дней (React 19.3.1, TanStack Router 1.170.44, Query 5.104.2, Base UI 1.9.0, motion 14.2.0, Sentry 11.7.0, turbo 2.11.8, vitest 5.0.4, RHF 7.90.0, zod 4.6.7, i18next 26.4.3–26.4.5, Playwright 1.64.1, TON Connect 5.0.1). При `minimumReleaseAge: 10080` + `minimumReleaseAgeStrict` init должен брать последний патч старше порога, а не `latest` — это нормальный режим, не исключение.

### 10. Что изменилось относительно мастер-плана

1. Bottom sheet: Vaul (§4 таблицы 05) снят — unmaintained; Drawer из Base UI.
2. Переходы: «без View Transitions API из-за iOS < 18» (§3.1) заменить на «VT где есть, CSS-fade как откат, один API `ScreenTransition`» — Motion-вариант с одновременным push требует своего «замороженного» outlet.
3. Язык: «TS 5.9 на старте, TS 7 отдельным PR» → TS 6.0.3 (+ TS 7 через alias для `tsc`); typescript-eslint пока < 6.1.
4. tma.js 4 из «риска» (§13 п.3) стал фактом: 4.0.0-rc.0 вышел 11.10.2026 — запланировать миграцию в волне 0/1. Плюс Bot API 10.2 origin-hardening для туннеля и редиректов.
5. pnpm: фиксировать 11.28.x (12 = Rust, свежий); `tg-analytics` — CDN, а не npm.

## Recommendations for the boilerplate

P0:
1. `packages/telegram-platform` на `@tma.js/sdk` 3.3.0 / `sdk-react` 3.0.23; ветка smoke на `4.0.0-rc.0` в волне 0; при GA 4.0 до релиза бойлерплейта стартовать с 4.0. SDK импортируется только здесь.
2. `ScreenTransition` с двумя реализациями (VT с типами push/pop; CSS-fade откат для iOS ≤ 17, EdgeHTML, LOW, reduced-motion); один хук BackButton ↔ history, направление pop и для аппаратного Back. Прототип на реальных iPhone 17/18+, Android LOW, Windows, macOS — критерий выхода волны 0.
3. Bottom sheet = Base UI Drawer + свой keyboard inset из Telegram viewport + `swipeBehavior.disableVertical()` на время открытия. Vaul в зависимостях запретить (lint/`pnpm` overrides не нужны — просто не ставить).
4. Theme: native по умолчанию, brand через один конфиг-объект; `syncTelegramChrome` для header/background/bottom bar.
5. Ядро: pnpm 11.28.x, Turborepo 2.11.x, TS 6.0.3 (+ alias 7.0.2 опционально), Vite 8.3.4, `@vitejs/plugin-react` 6.1.2, React 19.3.0 — всё в `catalog:`.
6. Dev: named Cloudflare Tunnel на домене dev-бота (требование Bot API 10.2), системный бинарь, туннель к прод-сборке.

P1:
7. `tg-analytics` = CDN-скрипт после `ready()`; `ton-connect` lazy, пин проверенной 5.0.x; `payments-stars`.
8. Sentry lazy без PII; eruda только за флагом staging.

Избегать: Vaul, npm `@telegram-apps/analytics`, `@telegram-apps/*`/`@twa-dev/sdk`, TS 7 как единственный `typescript`, pnpm 12 на старте, quick tunnel с меняющимся доменом как основной путь, редиректы Mini App на другой домен.

## Open questions for the user

1. Переходы экранов: принять гибрид «VT где есть + fade-откат» (дешевле, нативный push на iOS 18+/Android/Desktop) или настаивать на одинаковой Motion-анимации везде (дороже, свой «замороженный» outlet)?
2. Стартовать сразу на tma.js 4 (если выйдет GA до реализации) или на 3.x с миграцией позже?
3. Есть ли у команды постоянный домен для dev-туннеля, совпадающий с URL dev-бота (обязательно после Bot API 10.2)?
