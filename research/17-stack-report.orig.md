# 17. Стек по шаблонам: проверка на 2026-10-15
Status: done
Updated: 2026-10-15

## Resume notes
- Done: все разделы; под-агенты 17a–17g done (детали, даты релизов и URL источников там).
- Next: нет. Отчёт идёт в отдельный PDF.
- Sub-agent: 17a-landing, 17b-blog, 17c-site, 17d-shop, 17e-tma, 17f-admin, 17g-game — все done.

Версии сняты с npm registry 2026-10-15. Правило catalog: берём последний патч старше 7 дней (`minimumReleaseAge`), поэтому
часть пинов на патч ниже `latest`: React 19.3.0, Next 16.4.0, Playwright 1.64.0. `site` — шаблон на Next, `shop` — его
пресет `site` + `commerce` [16]. Альтернатива (отдельное Next-приложение shop) имеет смысл только для магазина на другом
домене со своим циклом релизов. Решение ждёт подтверждения пользователя.

## 1. Общее ядро

| Технология | Версия | Почему | Риск |
| --- | --- | --- | --- |
| Node | 24 LTS (24.22) → 26 LTS одним PR в Q1 2027 | 24 уходит в maintenance 2026-10-20; 26 станет LTS 2026-10-28, зависимости его уже принимают | низкий; `eslint-plugin-astro` требует ≥ 24.16 |
| TypeScript | **6.0.3** (не 5.9 и не 7) | `typescript-eslint` принимает TS < 6.1, `@astrojs/check` принимает ^5 \|\| ^6 | TS 7.0.2 без JS API; переход, когда его поддержит линт |
| pnpm | **11.28.x** + `catalog:`, `minimumReleaseAge`, `allowBuilds`, `blockExoticSubdeps` | всё нужное для supply chain уже есть в 11 | pnpm 12 переписан на Rust (2026-08), почти ежедневные фиксы; переход позже |
| Turborepo | 2.11.8 | активно развивается, нужны граф задач и кэш | поддержка lockfile pnpm 12 не заявлена |
| Vite | 8.3.4 + `@vitejs/plugin-react` 6.1.2 (Oxc) | одна сборка у SPA и Astro | Vite 9 ожидается ~2027 |
| React | 19.3.0 | stable; `<ViewTransition>` stable с 19.3 | Next рендерит vendored canary, поэтому kit пишется только на stable API |
| ESLint | **10.12** + typescript-eslint 8.71; `@eslint-react` 5 и `jsx-a11y-x` 0.2 вместо `eslint-plugin-react`/`jsx-a11y` | старые плагины не принимают ESLint 10; v10 ищет конфиг рядом с файлом, поэтому конфиги пакетов работают и из корня | `jsx-a11y-x` пока 0.x |
| Prettier, stylelint, knip | Prettier 3.9, stylelint 17.16, knip 6.41 | стабильны | Prettier 4 в alpha с 2025-11 |
| Стили | Tailwind 4.3.3, tailwind-variants 3.3.1, tailwind-merge 3.7, better-tailwindcss 4.9.1 | решение пользователя; линтер понимает `tv()` и `.astro` | у tv() один npm-мейнтейнер; код маленький, при необходимости форкнем |
| Kit | `@base-ui/react` 1.9.0 | 1.x, миноры раз в 4–7 недель, есть Drawer | preview-компоненты в kit не берём; `@base-ui-components/react` deprecated |
| Иконки | lucide-react 1.57 + simple-icons 16 для брендов | в lucide v1 удалены бренд-иконки | низкий |
| Состояние | MobX 7.0.6 + mobx-react-lite 5.1.0 | 7.0 вышел 2026-07-30; plain-классы почти без миграции | готовый `mobx-tanstack-query` требует MobX 6, поэтому свой `MobxQuery v2` |
| Server state | TanStack Query 5.104 | v6 для React не анонсирован | низкий |
| API-генератор | **Orval 8.43** (дефолт после smoke); Hey API 0.99 как альтернатива | у Hey API 4 мес. нет stable, нет semver, один ключевой мейнтейнер; Orval выпускает релизы каждые 2–5 дней, генерирует Query, Zod и моки MSW | Orval ESM-only, Node ≥ 22.18 |
| Формы | RHF 7.90 + Zod 4.6.7 | один паттерн во всех шаблонах | RHF 8 в beta: мигрировать одним PR |
| i18n | i18next 26.4 + react-i18next 17; `i18next-cli` вместо `i18next-parser` | живы; Starlight сам на i18next 26 | мажор примерно раз в год |
| Тесты | Vitest 5.0.4, Testing Library 16, MSW 3.0.3, Playwright 1.64 (образ той же версии) | риск «Storybook ↔ Vitest 5» снят | низкий |
| Storybook | 10.6.2 + addon-vitest | Vitest 5 официально в peer | Storybook 11 в alpha |
| Ошибки | Sentry 11.7 (`react`/`nextjs`/`astro`) | stable; для GlitchTip ставить `traceLifecycle: 'static'` | self-hosted Sentry должен быть ≥ 26.4.2 |
| Docker | build: `node:24-slim` (trixie, glibc); runtime: `nginxinc/nginx-unprivileged:1.30-alpine-slim` или `node:24-slim`; всё по digest | sharp и бинари pnpm на musl ломаются; non-root из коробки | brotli в официальном nginx нет, только `gzip_static` |

## 2. Шаблоны

Сквозное изменение для всех шаблонов. Пункт мастер-плана «`ScreenTransition` без View Transitions API» в шаблонах с
многостраничной навигацией не работает: старая страница не может анимированно уйти. Новый подход — один API
`ScreenTransition`, внутри два уровня:
1. View Transitions там, где браузер их поддерживает: Chrome/WebView 111+, Safari/iOS 18+, кросс-документные с 18.2.
2. CSS-fade 200–240 мс как запасной вариант. При reduced motion переход мгновенный.

### landing (Astro static)

| Технология | Выбор + версия | Почему |
| --- | --- | --- |
| Фреймворк | Astro 7.3.8 + `@astrojs/react` 7.0.1; опция `@astrojs/node` 11.1.7 | 0 JS, React-острова; Compiler по умолчанию выключен |
| Роутинг | файловый + `astro:i18n` | встроено |
| Стили, kit | `@tailwindcss/vite` 4.3.3; острова без импорта CSS, составные Base UI в одном острове | без дублирования CSS |
| Состояние | без стора (props + local state); nanostores 1.5.5 только если ≥ 2 острова делят живое состояние | MobX в Astro исключён по решению пользователя |
| Данные | build-time, Content Layer | статика |
| Формы | остров с RHF + Zod, ALTCHA 3.3 + honeypot | self-hosted антиспам |
| i18n | i18next только на сервере в `.astro`; в острова передаются уже готовые строки | `react-i18next` не нужен |
| Переходы | `@view-transition { navigation: auto }` + fade при загрузке; без `<ClientRouter />` | ClientRouter ломает `security.csp` и превращает сайт в SPA |
| SEO | sitemap 3.7.4, schema-dts 2.1, OG через satori 0.57 + sharp 0.35 | resvg без релизов с 2024-03 |
| Тесты | Vitest 5, Playwright + axe 4.13, Lighthouse CI 0.15.1 | бюджеты CWV |
| Наблюдаемость | Umami 3.4; `@sentry/astro` 11.7 выключен без DSN | cookieless |
| Образ | nginx-unprivileged 1.30-alpine-slim, `gzip_static` | non-root |

Что изменилось против плана: нативные кросс-документные VT вместо ClientRouter и ScreenTransition; resvg → sharp; базовый
образ nginx → nginx-unprivileged. Риски: Astro 8 вероятен в течение 12 месяцев (7.4-beta уже вышла); `@lhci/cli` не
обновлялся с 2025-06 и тянет Lighthouse 12 (план Б: Lighthouse 13 CLI и свой скрипт бюджетов); в Firefox переходов нет.

### blog (Astro static, общий `packages/astro-shared`)

| Технология | Выбор + версия | Почему |
| --- | --- | --- |
| Контент | Content Layer + `@astrojs/mdx` 8.0.3, Sätteri по умолчанию | стабильно с Astro 5–6 |
| Код | astro-expressive-code 0.44.2 | совместим с Sätteri (проверено по исходникам) |
| Фиды, поиск | `@astrojs/rss` 4.0.19, sitemap, Pagefind 1.5.2 (CLI, без обёртки) | есть русский стемминг |
| Картинки, OG | `astro:assets` + sharp; OG — тот же satori + sharp, что у landing | один конвейер; `next/og` в site тоже на satori |
| Время чтения | своя утилита на `Intl.Segmenter` | `reading-time` не обновлялся с 2021 |
| i18n | i18next + `astro:i18n`; локализованные слаги через `getStaticPaths`, hreflang по `translationKey` | custom locale paths требуют `output: 'server'` |
| CMS | свой интерфейс loader; Strapi через `@sensinum/astro-strapi-loader` 1.4; Directus/Sanity через свой loader (~50 строк) | community-loader Strapi не поддерживает Astro 7 |
| Docs (опция) | Starlight 0.42.6 + starlight-tailwind 5 | поддерживает Tailwind v4 |
| Переходы | как в landing | — |
| Тесты | Playwright + axe, LHCI; linkinator 8 в `verify`, lychee по расписанию | битые ссылки |
| Комментарии | в базе нет; в docs заметка про Remark42 или Giscus | Giscus не обновлялся с 2024-12 |

Что изменилось: добавлены link checker и своя утилита времени чтения; `i18next-parser` → `i18next-cli`. Риски: Starlight
0.x ломается на минорах (пин `~0.42`); Payload 4 в beta ломает loader.

### site (Next SSR; `shop` = site + `commerce`)

| Технология | Выбор + версия | Почему |
| --- | --- | --- |
| Фреймворк | Next 16.4.0 App Router + Cache Components, `standalone`, `deploymentId` = SHA | stable RSC, PPR, VT без настройки |
| Роутинг | App Router + nuqs 2.10.2 для URL-состояния | типовой путь |
| Стили, kit | `@tailwindcss/postcss` 4.3.3, kit через `transpilePackages` + `@source`, `'use client'` в каждом файле | Turbopack |
| Состояние | MobX 7 только в клиентских компонентах: стор через `useState` на запрос, `enableStaticRendering`; Query: клиент на запрос + `HydrationBoundary` | никаких синглтонов на уровне модуля |
| Данные | один сгенерированный SDK, два клиента: серверный (токен из сессии) и браузерный (через `/api/bff`) | нельзя ставить per-user interceptor на общий модульный клиент |
| Формы | RHF + Zod + Server Actions через свой хелпер `action()` | `next-safe-action` в ядро не берём |
| i18n | **next-i18next 16.3.1** (App Router, `root-params`, Cache Components) | своя интеграция не нужна; next-intl не нужен |
| Переходы | React `<ViewTransition>` + `<Link transitionTypes>`, CSS-fallback | без поддержки браузера страница просто сменится |
| Auth | openid-client 6.8.8 + iron-session 9.0.1, cookie `__Host-`, DAL-проверки; токены в Redis при нескольких подах | Auth.js 5 всё ещё beta; Better Auth требует свою БД |
| Real-time | `packages/realtime` (общий с admin), сокет напрямую к бэкенду | не через Next |
| Тесты | Vitest, Playwright против mock API (`@mswjs/http-middleware`) | MSW не перехватывает серверный fetch |
| Наблюдаемость | `@sentry/nextjs` 11.7 (`withSentryConfig` из `/config`), pino 10 | Turbopack поддержан |
| Образ | `node:24-slim`, один образ на все окружения; Redis — опция `multi-instance` | sharp на glibc |

Пресет `commerce` (shop):

| Технология | Выбор + версия | Почему |
| --- | --- | --- |
| Провайдер | Medusa 2.21.2 + **`@medusajs/js-sdk`** (exact pin = версии бэкенда) вместо генерации из OpenAPI | Medusa ломает API в минорных релизах; ночной контрактный тест против staging |
| Оплата | ЮKassa: redirect (`@gorgo/medusa-payment-yookassa` 2.0.4); Stripe: Payment Element (`stripe-js` 10, `react-stripe-js` 7) | Stripe-провайдер Medusa работает на PaymentIntent, hosted redirect не поддерживает |
| Кэш нескольких подов | свой `cacheHandlers` по официальному `examples/cache-handler-redis`; запасной вариант `@trieb.work/nextjs-turbo-redis-cache` 1.18 | `@neshca` заброшен, `@fortedigital` без поддержки `'use cache'` |
| Поиск | Meilisearch 0.62 на сервере через адаптер + nuqs | InstantSearch-мост отстаёт (peer `^0.57`) |

Что изменилось: shop стал пресетом; next-i18next вместо «своего инстанса на запрос» (один инстанс на процесс,
язык на запрос); VT разрешены; js-sdk вместо Hey API для Medusa; свой Redis handler. Риски: Next 17 (вероятно в течение
12 месяцев, Cache Components станут дефолтом, мы уже на них); один ключ Server Actions на все окружения (вшивается при
сборке); пререндер ходит в API во время `next build`; минорные релизы Medusa.

### tma (Vite SPA)

| Технология | Выбор + версия | Почему |
| --- | --- | --- |
| Фреймворк | Vite 8.3.4 + React 19.3.0 | CSR, initData только на клиенте |
| SDK | `@tma.js/sdk-react` 3.0.23 / `sdk` 3.3.0 (exact) только в `telegram-platform` | 4.0.0-rc.0 вышел 2026-10-11: smoke в волне 0, переход после GA |
| Роутер | TanStack Router 1.170 (virtual file routes, `routes.ts` на домен) + хук BackButton | при code-based маршрутах нет авто-code-splitting |
| Переходы | `defaultViewTransition` с типами push/pop + CSS-fade | Desktop: WebView2 на Windows, WKWebView на macOS; без VT только iOS ≤ 17 и EdgeHTML |
| Шторки | **Base UI Drawer** (1.9.0) вместо Vaul | Vaul без поддержки (сказано в README), последний релиз 2024-12 |
| Стили | theme bridge `--tg-theme-*` → семантические токены, брендовый режим | решение пользователя |
| Состояние, данные | MobX + Query + сгенерированный клиент, `Authorization: tma <initDataRaw>` | — |
| i18n | i18next, свой детектор из `initData.user.language_code` | без browser-languagedetector |
| Платежи | Stars через `invoice.openUrl`; TON Connect `ui-react` 5.0.1 lazy (опция) | — |
| Аналитика | `tg-analytics` CDN-скриптом после `ready()` (опция) | npm-пакет тянет legacy SDK и вторую копию TON Connect |
| Dev | системный `cloudflared` named tunnel на домене dev-бота; eruda 3.4 только в dev/staging | Bot API 10.2 блокирует методы Mini App с чужого origin |
| Тесты, ошибки | Playwright + `mockTelegramEnv`, Vitest; Sentry lazy; `?perf=1` | — |
| Образ | nginx-unprivileged, runtime `env.js`, `frame-ancestors` для web.telegram.org | — |

Что изменилось: Vaul → Base UI Drawer; VT вместо одного Motion; туннель на домене бота; tg-analytics только через CDN.
Риски: tma.js 4 меняет API, мейнтейнер в основном один; Telegram ужесточает правила для Mini App (10.2).

### admin (Vite SPA, опция `bff`)

| Технология | Выбор + версия | Почему |
| --- | --- | --- |
| Роутер | TanStack Router 1.170, virtual file routes; Zod 4 прямо в `validateSearch` | `@tanstack/zod-adapter` требует Zod 3 |
| Таблицы | TanStack Table 9.3.1 + Virtual 3.14 | v9 stable с 2026-08; shadcn data-table уже на v9 |
| Графики | Recharts 3.10 (shadcn chart); ECharts 6.1 как опция через свою обёртку | `echarts-for-react` не берём |
| Формы | RHF 7.90 + Zod 4 | TanStack Form не берём: одна библиотека форм на весь монорепо |
| Состояние | MobX 7 + свой `MobxQuery v2` (подписка через `onBecomeObserved`/`onBecomeUnobserved`) | готовые мосты требуют MobX 6 |
| Auth | oidc-client-ts 3.5.0 + react-oidc-context 3.3.1 за своим адаптером `auth/` | 7 месяцев без релиза, держим за адаптером |
| BFF (опция) | Hono 4.13 (пин 4.x) + openid-client 6.8; без своего кода — oauth2-proxy 7.15 | Hono 5 уже в RC |
| Real-time | `packages/realtime`: нативные WS/SSE + `invalidateQueries` | общий с site |
| Переходы | `ScreenTransition`: VT через Router + fade; Motion 14 вне kit | — |
| Тесты | Vitest 5, MSW 3, Playwright, Storybook 10.6 | — |
| Наблюдаемость | Sentry 11.7 + tracing TanStack Router, web-vitals 6 | RUM |

Что изменилось: code-based маршруты → virtual file routes; свой мост Query↔MobX обязателен. Риски: молодой мажор Table
v9; Hono 5; RHF 8.

### game (Vite SPA + DOM + Lottie)

| Технология | Выбор + версия | Почему |
| --- | --- | --- |
| Фреймворк, роутер | Vite 8 + React 19.3 + TanStack Router (как в tma) | одна структура с tma |
| Анимации | CSS/WAAPI на `transform`/`opacity`; motion 14.2.0 (exact) | у Motion 2 мажора за 2 месяца, изломы мелкие |
| Easing | WAAPI keyframes как база, `linear()` только при `CSS.supports` | `linear()` есть только с iOS 17.2 |
| Переходы | свой `ScreenTransition` (AnimatePresence или WAAPI); VT как улучшение | VT есть только с iOS 18 |
| Lottie | dotlottie-web 0.81.0 (exact) в `packages/lottie`: Worker + `setWasmUrl` + **`setWorkerUrl`** | `setWorkerUrl` позволяет `worker-src 'self'` без `blob:`; WASM 496 KB gz грузится лениво |
| Звук | свой Web Audio + `navigator.audioSession`; zzfx 1.4 как опция | howler не развивается с 2023 |
| Хаптика | Telegram `hapticFeedback`; вне TMA `navigator.vibrate` (только Android) | на iOS-вебе вибрации нет |
| Realtime | интерфейс транспорта, по умолчанию нативный WS; адаптер `@colyseus/sdk` 0.18 | `colyseus.js` переименован, версия клиента привязана к серверу |
| Telegram | tma.js 3.x; блокировка ориентации через `postEvent('web_app_toggle_orientation_lock')` | в SDK такого метода нет |
| Canvas (опция) | pixi.js 8.22, монтируем императивно | `@pixi/react` без релизов с 2025-12 |
| Тесты | Vitest для `logic/`, Playwright на прод-сборке, тест CSP-откатов | — |
| Образ | nginx: `application/wasm`, `video/mp4`, `immutable`, CSP `wasm-unsafe-eval` | — |

Что изменилось против [14]: `setWorkerUrl` вместо `blob:` в CSP; `@colyseus/sdk` вместо `colyseus.js`; добавлен полифил
`requestIdleCallback` (на iOS его нет). Риски: dotlottie 0.x ломает API между минорами; tma.js 4; нужно выбрать
минимальную версию iOS.

## 3. Изменения к мастер-плану

1. §2–§3: `shop` → шаблон `site` (Next 16.4) + пресет `commerce`; Turbopack только у `site` [16, 17c, 17d].
2. §3.1: TS 5.9 → **TS 6.0.3**; TS 7 после поддержки в typescript-eslint и `@astrojs/check` [17b, 17e].
3. §3.1: pnpm **11.28.x** (не 12); Node 24 сейчас, 26 LTS одним PR в Q1 2027 [17c, 17e].
4. §3.1: ESLint **10**; `eslint-plugin-react` → `@eslint-react`, `jsx-a11y` → `jsx-a11y-x`; риск «правила пакета не
   применяются из корня» снят [17b].
5. §3.1 API: дефолт **Orval 8** (после smoke в волне 0), Hey API как альтернатива; для Medusa `@medusajs/js-sdk` [17f, 17d].
6. §4: `MobxQuery v2` — свой код, обязателен (готовые мосты требуют MobX 6); MobX 7 подтверждён [17f].
7. Kit: `ScreenTransition` = VT, где есть поддержка, плюс CSS-fade как запасной вариант. Пункт «без View Transitions API»
   убрать. Astro: нативные кросс-документные VT, без ClientRouter; Next: `<ViewTransition>`; game: VT только как
   улучшение [17a–e, 17g].
8. tma: Vaul → Base UI Drawer; туннель на домене dev-бота (Bot API 10.2); `tg-analytics` только через CDN [17e].
9. Роутинг SPA: TanStack virtual file routes с `routes.ts` на домен вместо чистого code-based [17f].
10. site/shop i18n: `next-i18next` 16, «один инстанс на процесс, язык на запрос» вместо «инстанс на запрос» [17c, 17d].
11. shop: свой Redis `cacheHandlers` по официальному примеру; Stripe = Payment Element, ЮKassa = redirect [17d].
12. Astro: OG через satori + sharp (без resvg), своя утилита времени чтения, `i18next-cli`, link checker, CMS-loader
    через свой интерфейс [17a, 17b].
13. Docker: build-стадия `node:24-slim` (не Alpine), static-образ `nginx-unprivileged:1.30-alpine-slim`, всё по
    digest [17a, 17b, 17c].
14. game: `setWorkerUrl` вместо `blob:` в CSP, `@colyseus/sdk` вместо `colyseus.js`, без `@pixi/react` [17g].
15. Риски §13: убрать «Vitest 5 ↔ Storybook» (снят); добавить tma.js 4 RC, Astro 8, Next 17, Hono 5, RHF 8, Motion
    (мажор каждые ~2 мес.), Medusa (breaking в минорах), отставание `@lhci/cli` [все].
16. Init `--update`: последний патч старше 7 дней. Несколько `latest` (React, Next, Playwright) сейчас моложе этого
    порога [17e].

## Вопросы пользователю

1. Объединить shop и site в один шаблон (пресет `commerce`) или оставить shop отдельным приложением?
2. Устраивает ли, что в Firefox и на iOS ≤ 17 смена экрана будет простым fade (а в Astro-шаблонах без анимации)?
3. Минимальная версия iOS: 16.4 (Worker-Lottie, с запасными путями) или 17.2?
4. Orval вместо Hey API как генератор по умолчанию (по итогам smoke)?
5. Международный чекаут: Stripe Payment Element на нашей странице или hosted redirect (тогда нужен свой провайдер в Medusa)?
6. Один ключ Server Actions на stage и prod или отдельный образ site на каждое окружение?
