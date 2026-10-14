# 16. Универсальный SSR-шаблон `site`
Status: done
Updated: 2026-10-15

## Resume notes
- Done: все разделы (минимальный набор, выбор фреймворка, связь с shop, переходы, структура, CLAUDE.md, опции init,
  безопасность и CSP, бюджеты, тесты, волны, правки мастер-плана).
- Next: — (при реализации в волне 0 проверить пункты «не проверено» из §2.4 и §8).
- Sub-agent: не запускался.

## Summary (≤ 15 lines)
1. **Фреймворк `site`: Next.js 16.4 App Router + Cache Components, `output: 'standalone'`, Node 24 в Docker.** Единственный
   кандидат со стабильными RSC, стримингом, частичным пререндером (`'use cache'` + `ensureStatic`) и встроенными в роутер
   View Transitions (React 19.3, `<Link transitionTypes>`) без конфигурации. Второе место: React Router 8 framework mode.
2. **`shop` перестаёт быть отдельным приложением: `shop` = `site` + опция `commerce`.** В монорепо одно Next-приложение,
   один набор Next-правил, одна точка обновления Next; в init `shop` остаётся пресетом-алиасом.
3. Минимум `site`: вложенные layouts и route groups, SSR/стриминг + статика по сегментам, Metadata API, sitemap/robots/
   JSON-LD/OG, BFF-сессия в httpOnly cookie (`__Host-`), DAL-проверки, RSC-fetch + гидрация TanStack Query, MobX только в
   клиентских компонентах, error/not-found/loading, i18next с `[locale]`, RHF + Zod + Server Actions, точка подключения
   real-time, медиа-слоты, consent-аналитика, тема без FOUC, переходы, env в рантайме, `/api/health`, `/api/ready`,
   `/version.json`.
4. Опции init для `site`: `auth-bff` (вкл. по умолчанию), `i18n-routing` (вкл.), `realtime`, `video`, `commerce`
   (= shop), `multi-instance` (Redis cache handler), общая `analytics`. Всё прочее — не входит (§1.3).
5. Переходы: уровень 1 — React `<ViewTransition>` + `transitionTypes` (Chrome/Edge 111+, Safari/iOS 18+, Firefox 144+,
   Android WebView по версии Chromium); уровень 2 — CSS-fallback через `@supports not (view-transition-name: x)` и
   `template.tsx`; `prefers-reduced-motion` гасит движение, оставляя кроссфейд. Real-time обновления никогда не идут через
   `startTransition` внутри анимируемых границ.
6. CSP двумя профилями: nonce + `strict-dynamic` через `proxy.ts` для динамической зоны (аккаунт, торговля, чекаут) и
   статический заголовок для пререндеренных публичных страниц (nonce несовместим с PPR/статикой — по докам Next).
7. Kit, MobX, Query, i18next, Tailwind `tv()` не меняются; новый пакет только `packages/realtime` (второй потребитель —
   admin). Волны: `site` в волне 2, опции `realtime`/`video`/`commerce`/`multi-instance` в волне 3.

## Findings

### 0. Версии (npm registry, проверено 2026-10-15)

next 16.4.1 (2026-10-14; App Router рендерит vendored `19.3.0-canary-278794d7-20261002`) · react/react-dom 19.3.1 ·
react-router 8.4.0 (2026-09-15) · @tanstack/react-start 1.169.2 · @tanstack/react-router 1.170.44 · astro 7.3.8 ·
@astrojs/node 11.1.7 · vike 0.4.267 (2026-09-28) · vike-react 0.6.29 · @tanstack/react-query 5.104.2 ·
@tanstack/react-query-next-experimental 5.104.2 · mobx 7.0.6 · mobx-react-lite 5.1.0 (peer mobx ^7, react ^18||^19) ·
i18next 26.4.5 · react-i18next 17.0.16 · react-hook-form 7.90.0 · @hookform/resolvers 5.9.1 · zod 4.6.7 · motion 14.2.0 ·
schema-dts 2.1.0 · tailwindcss 4.3.3 · tailwind-variants 3.3.1 · @base-ui/react 1.9.0 · nuqs 2.10.2 · iron-session 9.0.1 ·
jose 6.2.12 · openid-client 6.8.8 · oauth4webapi 3.8.8 · @t3-oss/env-core 0.13.11 · vanilla-cookieconsent 3.1.0 ·
video.js 10.1.0 / @videojs/react 10.1.0 (stable 10.0.0 вышел 2026-10-01, Apache-2.0) · @vidstack/react 1.15.7 ·
media-chrome 4.19.3 · hls.js 1.7.3 · shaka-player 5.2.13 · lightweight-charts 5.2.1 · partysocket 1.3.0 ·
@sentry/nextjs 11.7.0 · @playwright/test 1.64.1 · vitest 5.0.4 · msw 3.0.3 · @mswjs/http-middleware 0.10.3 ·
@axe-core/playwright 4.13.0 · @lhci/cli 0.15.1 · sharp 0.35.5 · isomorphic-dompurify 4.5.0 · @hey-api/openapi-ts 0.99.0.

Свежие релизы под `minimumReleaseAge` 7 дней: next 16.4.1 (вчера), video.js 10.1.0 (3 дня). Каталог pnpm должен пинить
16.4.0 / 10.0.x до истечения порога.

### 1. Минимальный набор функций

Принцип: «база, без которой любой из трёх целевых сайтов (курсы, видеохостинг, биржа) не обойдётся», каждая часть с
одной точкой расширения. Всё, что нужно только одному из трёх, — опция или рецепт.

#### 1.1 Входит в ядро шаблона

| # | Функция | Как реализуется в Next 16.4 | Зачем всем трём |
| --- | --- | --- | --- |
| 1 | Роутинг, вложенные layouts | `src/app/[locale]/(public)`, `(account)`, `(app)` route groups; layouts на группу; `[...rest]` → `notFound()` | публичная витрина + кабинет + «рабочий» экран (плеер, торговля) |
| 2 | SSR, стриминг, выборочная статика | `cacheComponents: true`, `partialPrefetching: true`; публичное в `'use cache'` + `cacheLife` + `cacheTag`; персональное в `<Suspense>`; `ensureStatic = 'navigation'` на маркетинговых страницах, `'shell'` на каталогах | SEO-страницы из кэша, кабинет стримом в одном ответе |
| 3 | SEO | `generateMetadata` (title, description, canonical, `alternates.languages` для hreflang, OG/Twitter), `sitemap.ts` (+ `generateSitemaps` для больших, поле `videos` для видео-sitemap), `robots.ts`, `opengraph-image.tsx`, компонент `JsonLd` на `schema-dts` + `serializeJsonForScript`; `SITE_INDEXING=false` на не-проде → `Disallow: /` и `X-Robots-Tag: noindex` в рантайме | у всех трёх органика: курсы (Course), видео (VideoObject), биржа (страницы монет) |
| 4 | Auth-ready shell | опция `auth-bff` (вкл. по умолчанию): сессия в зашифрованной cookie `__Host-session` (HttpOnly, Secure, SameSite=Lax), токены внешнего API только на сервере; `AuthStrategy` адаптеры `oidc` (openid-client 6, confidential client) / `api-login` (логин-эндпоинт бэкенда) / `mock`; `proxy.ts` делает только оптимистичный редирект, настоящая проверка в DAL `getSession()` в каждой странице, Server Action и route handler | кабинет есть у всех трёх; провайдер не навязан |
| 5 | Данные | серверные функции `domains/<d>/api.server.ts` (Hey API SDK + токен из сессии); клиентский интерактив на TanStack Query; при необходимости первой отрисовки — `prefetchQuery` в RSC + `<HydrationBoundary>`; MobX-сторы только в клиентских компонентах | одна модель для каталога, ленты и торгового экрана |
| 6 | Ошибки, загрузка, 404 | `error.tsx` на route group с блоком «Детали для поддержки» (request id), `global-error.tsx`, локализованный `not-found.tsx`, `loading.tsx` только где нужен скелетон сегмента, иначе точечный `<Suspense>` с kit `Skeleton` | правило [11 R7] |
| 7 | i18n-роутинг | опция `i18n-routing` (вкл.): сегмент `[locale]`, `proxy.ts` выбирает локаль (cookie → `Accept-Language` → дефолт) и редиректит; i18next: серверный инстанс на запрос в RSC, клиентский провайдер получает только нужные namespace; локаль явным аргументом во всех `'use cache'`-функциях | общий i18next с остальными шаблонами [12 §3.1] |
| 8 | Формы | RHF 7.90 + Zod 4 + `@hookform/resolvers`; отправка через Server Action `domains/<d>/actions.ts` (та же zod-схема на сервере, токен из сессии, без CORS) или через Query-mutation в BFF-эндпоинт для низколатентных действий | логин, профиль, комментарии, ордер |
| 9 | Real-time hook point | `packages/realtime`: интерфейс `RealtimeTransport` (адаптеры WebSocket и SSE), reconnect с backoff + jitter, heartbeat, пауза на `visibilitychange`, батч обновлений через `requestAnimationFrame`; `useRealtimeChannel()` пишет в MobX-стор или `queryClient.setQueryData`; одноразовый тикет через `app/api/realtime/ticket/route.ts`; сокет идёт напрямую к бэкенду, не через Next | биржа обязательно; курсы/видео — уведомления, чат, live-счётчики. В ядре только интерфейс и пустой провайдер, реализации в опции `realtime` |
| 10 | Медиа | обёртка `Media/Image` над `next/image` (обязательные `sizes`, `remotePatterns` строго, sharp в standalone; `loaderFile` на imgproxy для медиатяжёлых сайтов); слот `VideoPlayer`: в ядре нативный `<video>` (poster, `preload="none"`, `playsInline`, `<track>`), в опции `video` — Video.js 10 `@videojs/react` + HLS, лениво | превью курсов, ленты видео, логотипы монет |
| 11 | Аналитика и consent | `packages/analytics` (`track` + транспорты), consent-баннер на kit, трекеры грузятся после согласия; `useReportWebVitals` → `track` | [05b §10] |
| 12 | a11y | Base UI kit; skip link; встроенный route announcer Next; фокус на `h1` после навигации; `lang` из локали; axe в e2e | правило шаблонов [12 §6] |
| 13 | Тема | light/dark/system: cookie `theme` + статичный inline-скрипт до отрисовки (разрешён CSP-хешем, работает и на статических страницах; чтение `cookies()` в root layout сделало бы весь сайт динамическим) | без FOUC |
| 14 | Плавные переходы | §4 | требование пользователя |
| 15 | Env и конфиг | `shared/config/env.server.ts` (zod, читается в рантайме, `import 'server-only'`); публичный runtime-конфиг передаётся из root layout в клиентский провайдер; `NEXT_PUBLIC_*` только для значений, не зависящих от окружения; `deploymentId` = git SHA | один образ на все окружения [05b §1] |
| 16 | Health, version | `app/api/health/route.ts` (liveness, без внешних вызовов), `app/api/ready/route.ts` (ping API с таймаутом), `app/version.json/route.ts` (= Sentry release = тег образа) | [11 R7] |
| 17 | Docker | multi-stage `node:24-slim`, `pnpm deploy`/`turbo prune`, standalone + `.next/static` + `public`, non-root, `HOSTNAME=0.0.0.0`, healthcheck, drain по SIGTERM 10–30 с, `X-Accel-Buffering: no` в nginx/ingress | [05b §11] |
| 18 | Наблюдаемость | `instrumentation.ts` (Sentry 11 server init, lazy client), `X-Request-Id` из proxy в fetch-слой и в error UI, `log.*` | [11 R7] |

#### 1.2 Что ядро даёт для трёх целевых классов сайтов

| Класс | Публичная часть | Рабочая часть | Что добавить поверх ядра |
| --- | --- | --- | --- |
| Онлайн-курсы | каталог и страница курса: `'use cache'` + теги, JSON-LD `Course`, OG | кабинет, прогресс, уроки: динамика + Query | опция `video`; оплата через `commerce` или внешнюю ссылку |
| Видеохостинг | страница видео: SSR метаданных, `VideoObject`, видео-sitemap, лента на `useInfiniteQuery` с гидрацией | плеер, комментарии, подписки | опция `video` (HLS), imgproxy-loader для превью, `realtime` для live-счётчиков |
| Криптобиржа | страницы рынков/монет: `'shell'` статичен, цены стримом | `(app)/trade/[pair]`: динамический shell, снимок стакана из RSC, дальше MobX-сторы от WebSocket | опция `realtime`; график `lightweight-charts` 5.2 рецептом (лениво, Apache-2.0); деньги только decimal |

#### 1.3 Что НЕ входит (сознательно)

- Свой auth-сервер и база пользователей (Better Auth, Auth.js с DB-адаптерами, Clerk/Supabase SDK как обязательная
  зависимость): бэкенд внешний; есть только адаптеры стратегии логина.
- CMS, редактор rich text, загрузка файлов (только рецепт: presigned URL напрямую в хранилище), email.
- Commerce, корзина, платежи — опция `commerce`; поисковый движок — опция `search` в составе commerce.
- Транскодинг, загрузка видео, DRM (EME/Widevine) — дело бэкенда/видеоплатформы; торговый движок и графики TradingView
  в ядре.
- PWA, service worker, offline, push-уведомления.
- Edge runtime, Vercel-специфика (`@vercel/*`, BotID, ISR-на-Vercel), OpenNext, adapters API.
- WebSocket-прокси через Next (route handlers не обслуживают upgrade; standalone-сервер не для этого).
- Сервис фича-флагов и A/B (только `/config.json`-рубильники [11]), GraphQL-клиент, мультитенантность и домены.
- Тяжёлые анимационные библиотеки по умолчанию (GSAP, Lenis — опции landing); Motion только микровзаимодействия.
- Data grid, RBAC-UI, графики аналитики — это `admin`.

### 2. Выбор фреймворка

#### 2.1 Факты по кандидатам (2025–2026)

- **Next.js 16.4** (2026-10-06, https://nextjs.org/blog/next-16-4): Cache Components рекомендованы «для любого
  приложения», включены по умолчанию в `create-next-app`, станут дефолтом в Next 17; `ensureStatic` (`navigation` |
  `prefetch` | `shell`) валит сборку, если в маршрут попал динамический компонент; `navigation()`/`prefetch()` исключают
  тяжёлое из prefetch; React 19.3 со стабильными View Transitions. `middleware` переименован в `proxy.ts`, работает на
  Node runtime (https://nextjs.org/docs/app/guides/authentication, обновлено 2026-09-16). View Transitions в App Router
  работают «with no configuration», `<Link transitionTypes>` и `router.push(..., { transitionTypes })`
  (https://nextjs.org/docs/app/guides/view-transitions, 2026-09-10). Self-host: standalone, runtime env, общий
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` и `deploymentId` на поды, Redis-handler для тегов в multi-pod [05b §1, §11].
- **React Router 8** (2026-06-17, https://remix.run/blog/react-router-v8; latest 8.4.0): ESM-only, Vite 7+, Node 22.22+,
  React 19.2.7+, middleware по умолчанию; RSC и Server Actions по-прежнему unstable, стабилизация «в минорном релизе».
  Стриминг через `defer`/Suspense и `viewTransition` у `<Link>` есть с v7 (по памяти, в посте v8 не упомянуто). Нет
  компонентного кэша: HTML-кэш через `Cache-Control`/CDN.
- **TanStack Start 1.169** (https://tanstack.com/blog/announcing-tanstack-start-v1): официальный пост v1 — Release
  Candidate (сентябрь 2025), сообщения о «1.0 stable» в марте 2026 только из вторичных источников; RSC — экспериментальные
  (https://blog.openreplay.com/tanstack-ecosystem-guide/); деплой через Nitro. Нет тегового серверного кэша [05b §1].
- **Astro 7.3** (`@astrojs/node` 11.1.7): острова; React-контекст не пересекает границы островов [05a], общий
  QueryClient/MobX-стор между островами через nanostores или глобальные синглтоны.
- **Vike 0.4.267** + vike-react 0.6.29: версия всё ещё 0.x после 5 лет, по сути один основной мейнтейнер; гибкий
  (SSR/SSG/SPA по странице), Vite. Нет RSC в основном пути.

#### 2.2 Сравнение по критериям

Оценка 1–5 (5 лучше); мнение на основе фактов выше.

| Критерий | Next 16.4 App Router | React Router 8 framework | TanStack Start 1.x | Astro 7 server | Vike |
| --- | --- | --- | --- | --- | --- |
| SSR и стриминг | 5: RSC + PPR, статичный shell + динамика в одном ответе | 4: SSR + стрим loader-ов | 4: стрим, RSC ранние | 3: стрим страниц, server islands | 3 |
| Ясность модели данных и кэша | 3: `'use cache'`/теги мощно, но новые правила, ловушки cookies/headers | 5: loader/action, проще всего объяснить | 4: loaders + Query встроен | 4 для контента, 2 для интерактива | 3 |
| Real-time, высокоинтерактивные страницы (биржа) | 4: клиентский компонент с MobX внутри RSC-shell; цена — граница `'use client'` | 5: обычный React SPA после гидрации | 5 | 2: острова, общий стор между ними неудобен | 4 |
| Видео-страницы | 4: SSR метаданных, плеер клиентским компонентом | 4 | 4 | 4 | 4 |
| Совместимость с kit | 4: правила kit уже обязательны из-за shop [12 §3.2] | 5 | 5 | 3: контекст не переходит между островами | 5 |
| MobX | 4: только в клиентских компонентах, `enableStaticRendering` на сервере | 5 | 5 | 2 | 5 |
| Бандл и TTFB | 3: ~100 KB gz рантайм; TTFB отличный из кэша shell | 4 | 4 | 5 | 4 |
| Docker self-host, один образ | 4: standalone; multi-pod требует Redis и общих ключей | 5: обычный Node-сервер | 4: Nitro | 5 | 5 |
| Здоровье проекта | 5 | 5 | 3: RC/свежий 1.x, RSC эксперимент | 5 (Cloudflare) | 2: 0.x, малый bus factor |
| Знакомство AI-агентов | 5 (+ официальные skills, `next upgrade --agent`) | 4 | 3 | 4 | 2 |
| Переиспользование с shop | 5: тот же фреймворк, одно приложение | 1: третий meta-framework | 1 | 2 (уже есть у landing) | 1 |
| View Transitions из коробки | 5: интеграция в роутер, `transitionTypes` | 4: `viewTransition` у Link | 3 | 5: cross-document для MPA | 3 |

#### 2.3 Решение

**Next.js 16.4 App Router.** Решающие причины:
1. Единственный вариант без нового meta-framework: Next уже в монорепо из-за shop, его цена (Turbopack, vendored canary
   React, `'use client'` пофайлово в kit, `transpilePackages`) уже заплачена [12 §13 риск 3–5]. React Router 8 или Start
   дали бы третий SSR-стек рядом с Astro и Next.
2. Лучший SSR для смешанных страниц: статичный shell страницы монеты или курса из кэша + персональные части стримом в
   одном ответе; `ensureStatic` как гард SEO-страниц.
3. View Transitions встроены в роутер (требование пользователя), без своей обвязки.
4. Агенты знают Next лучше всех; у Next есть официальные skills и `next upgrade --agent` (вписывается в AI-слой).

Что принимаем как цену: модель кэша сложнее loader-ов (лечится правилами в `apps/site/CLAUDE.md` и lint, §5.2);
nonce-CSP делает страницу динамической (§6); multi-pod требует Redis (опция `multi-instance`); бандл ~100 KB gz рантайма
против ~60–70 у RR8 (оценка, мерить в волне 0).

Когда пересмотреть: если пользователь откажется от shop/commerce вообще и захочет ядро на Vite — React Router 8
framework mode (тот же Vite, что у tma/admin/game, простые loaders, без RSC).

#### 2.4 Не проверено (проверить в волне 0)

- Размер first-load JS пустой страницы Next 16.4 с kit, MobX, Query, i18next (бюджет §7).
- MobX 7 + `mobx-react-lite` 5 в клиентских компонентах под vendored canary React (`observer`, `enableStaticRendering`).
- Гидрация Query: `prefetchQuery` в RSC + `HydrationBoundary` + `MobxQuery v2` поверх того же кэша без двойного запроса.
- Experimental SRI (`experimental.sri`) и inline-скрипты RSC payload (`self.__next_f.push`) под CSP без nonce (§6).
- View Transitions на реальных iOS 18 Safari, iOS WKWebView (Telegram), Android WebView.

### 3. Связь с shop

**Рекомендация: `shop` = `site` + опция `commerce`.** Отдельного `apps/shop` нет; в init `shop` остаётся пресетом
(`--templates shop` раскрывается в `site` + `commerce` (+ `search` по выбору)).

Почему:
1. У shop и site общий скелет на 80–90 %: Next-конфиг, proxy, сессия, SEO, i18n, ошибки, health, Docker, CSP, переходы,
   Cache Components. Два приложения означают две копии этого кода или ещё один пакет `packages/next-*` с публичным API,
   который нужно версионировать, — третий потребитель отсутствует, абстракция преждевременна [11 R6.4].
2. Целевые проекты (курсы с продажей, видео с подпиской) часто хотят commerce внутри того же сайта, а не рядом.
3. Один Next в монорепо по определению: нет риска разъезда мажоров, один `next upgrade`, одни правила.
4. Commerce уже спроектирован как модуль: `CommerceProvider` + адаптеры, кэш-контракт, `PaymentStep`, вебхук
   ревалидации [05b §2–§6]. Всё это ложится в `domains/commerce/`, `app/[locale]/(shop)/`, `app/api/revalidate/` и
   удаляется init целиком.

Цена и как её снять:
- Нельзя получить два отдельных Next-приложения (например, сайт и магазин на разных доменах с разными релизами). Это
  редкий случай; в v2 команда `add` может клонировать `site` во второе приложение. Записать в «Deliberate do not fix».
- Режим дизайна разный внутри одного приложения: Persuade для публичных страниц, Operate для кабинета/корзины/чекаута —
  `DESIGN.md` уже поддерживает режимы по зонам [07a].
- Тесты shop (`COMMERCE_PROVIDER=mock`) становятся e2e-проектом `site` с включённой опцией.

Эффект на init: шаблонов становится 6 (`landing`, `blog`, `site`, `tma`, `admin`, `game`) + пресет `shop`. Зависимости:
`commerce` требует `site` и `auth-bff` (аккаунт покупателя через сессию); `search` требует `commerce`; `multi-instance`
требует `site`. Манифест: владельцы файлов commerce — опция `commerce` (папки целиком, маркеров в коде нет). Матрица
nightly уменьшается (одно Next-приложение вместо двух; комбинации `site`×опции считаются как опции).

Эффект на сопровождение: одна точка обновления Next/React-canary, одно место CSP и security-headers для Node-ветки,
один Redis-handler. Отчёт [05b] остаётся источником для `commerce`.

### 4. Плавные переходы между экранами

#### 4.1 Поддержка платформ (факты)

| Платформа | Same-document View Transitions | Типы переходов / `view-transition-class` (нужно React) | Источник |
| --- | --- | --- | --- |
| Chrome / Edge desktop | 111+ | 125+ | https://caniuse.com/view-transitions, https://nextjs.org/docs/app/guides/view-transitions |
| Safari macOS / iOS | 18.0+ | «recent Safari», часть анимаций «may behave differently in Safari» | там же |
| Firefox | 144+ | свежие версии | там же |
| Android Chrome / WebView | WebView обновляется вместе с Chromium через Play, практически ≥ 111 | ≥ 125 | caniuse (WebView отдельно не указан — проверить на устройстве) |
| iOS WKWebView (Telegram, in-app браузеры) | тот же WebKit, что Safari iOS 18 (мнение, проверить) | — | — |
| Глобально | 92.9 % | — | caniuse |

Cross-document (`@view-transition { navigation: auto }`): Chrome 126+, Safari 18.2+, Firefox нет
(https://developer.chrome.com/docs/web-platform/view-transitions/cross-document). Для SPA-навигации Next не нужен, но
полезен для перехода на внешние страницы того же origin (например, landing → site на одном домене).

React 19.3: `<ViewTransition>` стабилен; анимирует только обновления внутри Transition (`startTransition`, раскрытие
`Suspense`, `useDeferredValue`); обычный `setState` не анимирует (https://react.dev/blog/2026/09/09/react-19-3). В Next
навигации — это transitions, поэтому анимация срабатывает автоматически. Без поддержки браузера приложение работает,
переход просто мгновенный.

#### 4.2 Схема для `site`

1. **Страничный переход** (каждая `page.tsx`): обёртка `PageTransition` из `shared/ui` (клиентский компонент над
   `<ViewTransition enter/exit={{ 'nav-forward', 'nav-back', default: 'none' }} default="none">`). Направление задаёт
   `<Link transitionTypes>` в `domains/<d>/routes.ts`-хелперах, а не вручную в каждом месте. Не в layout: layouts не
   перемонтируются.
2. **Shared element** (карточка → детальная): курс → курс, превью видео → постер плеера, монета → пара. Имена только из
   хелпера `vtName('video', id)` (уникальность на странице), пара `share="morph"` + `default="none"`. Морфинг
   срабатывает только если целевая страница отрисовалась в том же коммите (prefetch/кэш), иначе — enter-анимация.
3. **Раскрытие Suspense**: скелетон уходит вниз, контент приходит вверх; для стримящихся частей shell.
4. **Шапка** закреплена (`view-transition-name: site-header`, `animation: none`), `::view-transition { pointer-events:
   none }`, чтобы клики во время перехода не терялись.
5. **Fallback без API**: CSS `@supports not (view-transition-name: x)` включает короткий fade-in корня страницы через
   `template.tsx` (перемонтируется при навигации) — без JS и без inline-скрипта, совместимо с CSP. Касается iOS ≤ 17 и
   старых WebView.
6. **Reduced motion**: `@media (prefers-reduced-motion: reduce)` обнуляет сдвиги, оставляет кроссфейд ≤ 150 мс (опасен
   сдвиг, не прозрачность).
7. **Жесты «назад»**: системный back и свайп на iOS не несут типа → направленная анимация не играет (`default: 'none'`),
   нет двойной анимации поверх нативного свайпа Safari.
8. **Длительности из токенов**: exit 120 мс, enter 200 мс, move 280 мс, ease-out — в рамках правила 100–300 мс [12 §6]
   (примеры Next с 400 мс не копировать).

#### 4.3 Ловушки, которые фиксируются правилами

- Real-time: обновления стакана/счётчиков не оборачивать в `startTransition`/`useDeferredValue` внутри границ
  `<ViewTransition>` без `default="none"` — иначе каждое тиковое обновление запустит снимок экрана. Правило: у всех
  вложенных `ViewTransition` `default="none"`, анимируется только явный тип.
- Играющее `<video>` не делать именованным участником (снимок замораживает кадр); имя даётся контейнеру постера.
- Длинные списки и тяжёлые страницы: снимок всей страницы дорогой на слабых Android — именованных участников ≤ 5 на экран.
- Motion 14 (`LazyMotion`) — только микровзаимодействия (drawer, тосты), не страничные переходы; kit анимирует на CSS.

### 5. Структура, CLAUDE.md, опции

#### 5.1 Дерево `apps/site`

Next требует, чтобы маршруты лежали в `src/app/`; в общей схеме [12 §4] `app/` — composition root. Совмещаем: в `app/`
только файлы маршрутов (тонкие) и composition root в приватной папке `_root/` (папки с `_` не маршрутизируются).

```
apps/site/
  next.config.ts        cacheComponents, partialPrefetching, standalone, deploymentId, transpilePackages, headers()
  Dockerfile  deploy.json  env.example  CLAUDE.md  README.md  DESIGN.md  e2e/
  src/
    proxy.ts            locale, оптимистичный auth-редирект, nonce-CSP для динамической зоны, X-Request-Id
    instrumentation.ts  Sentry/OTel сервер
    app/
      _root/            providers.tsx ('use client': QueryClient, StoresProvider, UiProvider Link/Image, I18n),
                        theme-script.ts, fonts.ts, metadata.ts (дефолты)
      [locale]/
        layout.tsx      <html lang>, провайдеры, шапка/подвал
        (public)/page.tsx  about/  <d>/[slug]/page.tsx       ensureStatic 'navigation' | 'shell'
        (account)/layout.tsx  profile/page.tsx                динамика, getSession() в странице
        (app)/<workspace>/page.tsx                            торговля, плеер, урок: клиентский экран
        error.tsx  not-found.tsx  [...rest]/page.tsx
      api/
        auth/{login,callback,logout,session}/route.ts         опция auth-bff
        bff/[...path]/route.ts                               allowlist-прокси к API (опция auth-bff)
        realtime/ticket/route.ts                             опция realtime
        health/route.ts  ready/route.ts
      version.json/route.ts  sitemap.ts  robots.ts  manifest.ts  opengraph-image.tsx  global-error.tsx
    domains/<d>/
      routes.ts         path-хелперы, transitionTypes, vtName
      api.server.ts     'server-only': fetch через Hey API + сессия; 'use cache' только для публичного
      queries.ts        queryOptions для клиента (общие ключи с prefetch)
      actions.ts        'use server': мутации форм, getSession() первой строкой
      pages/<Page>/     <Page>.tsx (+ Page.styled.ts, types.ts, consts.ts) + model/<Page>ViewModel.ts
      components/  index.ts
    shared/
      config/           env.server.ts, public-config.ts, flags
      lib/              session/ (AuthStrategy, cookie, refresh single-flight), http/ (request id, error mapping),
                        seo/ (JsonLd, metadata builders), i18n/ (server instance), transitions/
      ui/               PageTransition, Media/Image, VideoPlayer (слот), ConsentBanner, ErrorDetails
      model/            глобальные клиентские сторы (SessionStore, ThemeStore)
```

Правило тонкого маршрута: `page.tsx` = `generateMetadata` + серверная выборка + `<XPage data={…} />` из домена, ≤ 60
строк, без `'use client'` (lint на `src/app/**/{page,layout}.tsx`).

#### 5.2 `apps/site/CLAUDE.md` (≤ 150 строк, разделы по [12 §5])

1. **What it is**: универсальный SSR-сайт, Next 16.4 App Router + Cache Components, Node standalone; включённые опции
   (маркеры init).
2. **Map**: дерево выше одним блоком; «хочу X → файл».
3. **Commands**: `pnpm --filter site dev | build | start | test | e2e | lhci`, `pnpm verify`.
4. **Template rules** (каждое с механизмом):
   - server/client граница: `*.server.ts` импортирует `server-only`; клиентский код их не импортирует (ESLint
     `no-restricted-imports` по шаблону); `'use client'` только в листьях, не в `page`/`layout`;
   - кэш: `'use cache'` только в `api.server.ts`, все входы аргументами (включая locale), `cacheTag` обязателен, никогда
     после `cookies()`/`headers()`/`getSession()`; персональное — в `<Suspense>`; `ensureStatic` на публичных маршрутах
     (custom lint по списку групп);
   - auth: `getSession()` в каждой странице `(account)`/`(app)`, Server Action и route handler; proxy только оптимистичен;
     проверки в layout запрещены (layout не перерисовывается при навигации — документация Next);
   - данные: на клиенте только TanStack Query или `MobxQuery v2`; общие ключи из `queries.ts`; ручной `fetch` в
     компонентах запрещён;
   - MobX: сторы создаются в клиентском провайдере на запрос (`useState(() => new Store())`), синглтонов на уровне модуля
     нет; `enableStaticRendering(typeof window === 'undefined')`;
   - env: `process.env` только в `shared/config`; `NEXT_PUBLIC_*` только для значений, не зависящих от окружения;
   - переходы: `PageTransition` в каждой `page.tsx`, имена через `vtName`, вложенные `default="none"`, real-time вне
     transitions;
   - SEO: `generateMetadata` в каждой публичной странице (тест), JSON-LD только через `JsonLd`;
   - медиа: только обёртки `Media/Image` и `VideoPlayer`, `sizes` обязателен.
5. **Security checklist** (§6).
6. **Recipes**: новая публичная страница с кэшем и тегом; страница кабинета; форма через Server Action; real-time канал в
   MobX-стор; shared-element переход; новая локаль; вебхук ревалидации; включить Redis.
7. **Deliberate do not fix**: нет WebSocket через Next; нет `NEXT_PUBLIC_API_URL` для окружений; одно Next-приложение
   (магазин — опция); нет edge runtime; `loading.tsx` не на каждом сегменте.
8. **Open work**: пункты §2.4.

Skills шаблона (префикс `site-`, удаляются с ним): `site-new-route` (страница + metadata + transition + e2e),
`site-cache-review` (проверка `'use cache'`/теги/динамика), `site-realtime-channel` (опция `realtime`).

#### 5.3 Опции init для `site`

| Опция | По умолчанию | Что добавляет | Что удаляется без неё |
| --- | --- | --- | --- |
| `auth-bff` | вкл. | `app/api/auth/*`, `app/api/bff/[...path]`, `shared/lib/session`, `(account)`, адаптеры `oidc`/`api-login`/`mock`, iron-session 9 или jose 6, openid-client 6 | группа `(account)`, proxy-редирект; остаётся публичный сайт |
| `i18n-routing` | вкл. | сегмент `[locale]`, выбор локали в proxy, hreflang, sitemap по локалям | без неё одна локаль, i18next-строки остаются |
| `realtime` | выкл. | `packages/realtime` (общий с admin), тикет-эндпоинт, `useRealtimeChannel`, mock WS в e2e | интерфейс-заглушка в `shared/lib` |
| `video` | выкл. | `@videojs/react` 10 + HLS в `VideoPlayer`, видео-sitemap, `VideoObject`, CSP `media-src` с `blob:` | нативный `<video>` |
| `commerce` | выкл. | всё из [05b]: `domains/commerce`, `(shop)`, `CommerceProvider` + `mock`/`medusa`, `PaymentStep`, `/api/revalidate`; подопции `search`, `commerce-shopify` | — |
| `multi-instance` | выкл. | Redis `cacheHandler` + `cacheHandlers` с `refreshTags`/`updateTags`, compose с Redis, документ про общие ключи | single-pod, кэш на volume |
| `analytics` | общая | [05b §10] | — |

Пресет `shop` = `site` + `auth-bff` + `commerce` (+ `multi-instance` вопросом).

### 6. Безопасность, CSP

#### 6.1 Чек-лист `site` (в `apps/site/CLAUDE.md`)

1. Токены внешнего API только на сервере; cookie `__Host-session`: HttpOnly, Secure, SameSite=Lax, Path=/, зашифрована;
   payload минимальный (id, роли), без ПДн (рекомендация доков Next).
2. Refresh токена в BFF с single-flight (один запрос на сессию), иначе гонки при параллельных RSC-запросах.
3. Проверка доступа в DAL у данных, а не в proxy/layout (урок CVE-2025-29927, обход middleware-авторизации,
   https://sec.okta.com/articles/nextjs-CVE-202529927/); Next держать на патч-версиях, `experimental.agentUpgrade:
   'security'`.
4. Server Actions и route handlers — публичные эндпоинты: zod-валидация входа, `getSession()`, авторизация. CSRF:
   встроенная проверка Origin у Server Actions (`serverActions.allowedOrigins` за прокси), у route handlers общий хелпер
   `assertSameOrigin` (Origin + `Sec-Fetch-Site`); мутаций по GET нет.
5. BFF-прокси: allowlist путей и методов, фиксированный upstream, вырезать `cookie`/hop-by-hop заголовки, никаких URL
   от пользователя (SSRF).
6. `returnTo` только относительный путь по allowlist (open redirect).
7. Кэш: персональное никогда в `'use cache'` (только `'use cache: private'` при необходимости); ответы с сессией
   `Cache-Control: private, no-store`; `taintUniqueValue` для секретов сессии.
8. HTML и JSON-in-script только через `SafeHtml`/`serializeJsonForScript` [10].
9. Multi-pod: общий `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `deploymentId`.
10. `poweredByHeader: false`; `X-Request-Id` наружу только как идентификатор.
11. Биржа: деньги и количества только decimal-строками; 2FA/подтверждения — бэкенд; `frame-ancestors 'none'`.
12. Видео: подписанные URL выдаёт бэкенд; ключи CDN на фронт не попадают.

#### 6.2 Профиль CSP

Факт (https://nextjs.org/docs/app/guides/content-security-policy, версия 16.4.0): nonce требует динамического
рендеринга; со статикой, ISR и PPR nonce несовместим; альтернатива — experimental SRI (хеши на сборке).

Поэтому два профиля:

| Зона | Как | Политика |
| --- | --- | --- |
| Динамическая: `(account)`, `(app)`, чекаут, `api/auth` | `proxy.ts` генерирует nonce на запрос по matcher этих групп (без prefetch-запросов) | `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…'; img-src 'self' data: blob: <img-cdn>; media-src 'self' blob: <video-cdn>; connect-src 'self' <api> <wss>; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` |
| Статическая/кэшируемая публичная | `headers()` в `next.config.ts` | то же, но `script-src 'self' 'unsafe-inline'` (inline RSC payload) до подтверждения SRI-варианта в волне 0; хеш theme-скрипта; строгий `connect-src` |

Оба сначала `Content-Security-Policy-Report-Only` с report-endpoint, затем enforce [10]. Остальные заголовки из общего
`security-headers.conf`: HSTS, nosniff, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
(camera/microphone/geolocation `()`, `fullscreen=(self)` и `picture-in-picture=(self)` при `video`), COOP `same-origin`;
e2e-тест заголовков на обе зоны.

### 7. Бюджет производительности (цели, мерить в волне 0)

| Метрика | Публичные страницы | Рабочие экраны (`(app)`) |
| --- | --- | --- |
| First-load JS (gz) | ≤ 130 KB (рантайм Next ~100 + kit + i18n) | ≤ 220 KB без лениво подгружаемых плеера/графика |
| Плеер (опция `video`) / график | лениво, не в первом чанке | лениво |
| LCP p75 | ≤ 2.0 s (кэшированный shell) | ≤ 2.5 s |
| INP p75 | ≤ 200 ms | ≤ 200 ms при 20 обновлениях/с стакана (rAF-батч) |
| CLS | ≤ 0.05 | ≤ 0.1 |
| TTFB | ≤ 200 ms из кэша shell; ≤ 600 ms динамика | ≤ 600 ms |
| Длительность перехода | ≤ 280 ms | ≤ 280 ms |

Проверка: Lighthouse CI на 3 страницах (главная, публичная детальная, страница кабинета под mock-сессией), Turbopack
Bundle Analyzer в CI как отчёт, `useReportWebVitals` в проде.

### 8. Тесты

- Vitest 5: домены, VM, MobX-сторы, `packages/realtime` (reconnect, backoff, батчинг), мапперы ошибок, `AuthStrategy`.
- Async RSC юнитами не тестируются [05b §9] → Playwright 1.64 e2e против mock-API: `@mswjs/http-middleware` 0.10 как
  отдельный HTTP-сервер, на который смотрит `API_URL` (серверные fetch Next MSW в процессе не перехватывает); WebSocket
  через `page.routeWebSocket` Playwright (есть с 1.48, по памяти).
- e2e-набор шаблона: SSR-HTML содержит title/canonical/hreflang/JSON-LD; `robots`/`sitemap`; защищённый маршрут без
  сессии → редирект, Server Action без сессии → 401; заголовки CSP обеих зон; переход с `transitionTypes` (наличие
  `::view-transition` в Chromium) и отсутствие анимации при reduced motion; 404/500 страницы с request id;
  `/api/health`, `/api/ready`, `/version.json`; axe на ключевых страницах; скриншоты только в Docker.
- Smoke образа в CI: `docker run` → health → одна SSR-страница (pnpm-симлинки в standalone [05b §11]).

### 9. Место в волнах

- **Волна 0**: smoke-сборка `site` с kit + `tv()` + MobX + Query-гидрацией + i18next; замер бюджета; View Transitions на
  iOS 18, Android WebView, Telegram WebView; проверка SRI/CSP-профиля статических страниц.
- **Волна 2**: `apps/site` с ядром и опциями `auth-bff`, `i18n-routing` (вместе с landing/blog: общая SEO-логика и
  Lighthouse CI); security-headers Node-ветки; skills `site-new-route`, `site-cache-review`.
- **Волна 3**: опции `realtime` (+ `packages/realtime`, общий с admin), `video`, `commerce` (бывший shop),
  `multi-instance`; пресет `shop`.

## Recommendations for the boilerplate

1. **Брать** Next.js 16.4 App Router для `site` с `cacheComponents`, `partialPrefetching`, `standalone`, `deploymentId`
   = SHA; `ensureStatic` на публичных группах.
2. **Слить shop в site**: `commerce` — опция, `shop` — пресет init. Один Next в монорепо.
3. **Брать** BFF-сессию в `__Host-` cookie с адаптерами `AuthStrategy` (`oidc`, `api-login`, `mock`); proxy только
   оптимистичен; DAL обязателен (lint + e2e).
4. **Брать** двухуровневые переходы: React `<ViewTransition>` + `transitionTypes` из route-хелперов, CSS-fallback через
   `@supports`, reduced motion; real-time вне transitions.
5. **Брать** `packages/realtime` (транспорт + reconnect + тикет + rAF-батч), общий для site и admin; сокет напрямую к
   бэкенду.
6. **Брать** Video.js 10 (`@videojs/react`) в опции `video`, но пин 10.0.x и smoke в волне 3: релиз свежий.
7. **Брать** два CSP-профиля (nonce в динамической зоне, статический заголовок для публичных), Report-Only сначала.
8. **Избегать**: auth-библиотек со своей БД, WebSocket через Next, `NEXT_PUBLIC_*` для окружений, `cookies()` в root
   layout (убивает статику), проверок доступа в layout, `loading.tsx` на каждом сегменте, анимаций 400 мс из примеров
   Next, именованного `<video>` в переходах.

### Точные правки мастер-плана (`12-master-plan.md`)

**«Коротко», пункт 2** — заменить список шаблонов:
> Шаблоны: `landing` (Astro static), `blog` (Astro static, общий слой с landing), `site` (Next 16 SSR: универсальный
> сайт с кабинетом; опции `auth-bff`, `i18n-routing`, `realtime`, `video`, `commerce`; пресет `shop` = `site` +
> `commerce`), `tma` (Vite SPA + `@tma.js`), `admin` (Vite SPA + TanStack Router/Table + OIDC), `game`.

**§1, строка «Ядро `packages/*`»** — добавить `realtime` (транспорт WS/SSE, общий для site и admin).

**§2, таблица шаблонов** — строку `shop` заменить на:

| `site` | универсальный SSR-сайт: курсы, видео, биржа, контент + кабинет; `commerce` превращает его в магазин | Next 16.4 App Router + Cache Components, Node standalone, один образ на окружения | вес рантайма Next (~100 KB gz), сложность модели кэша, nonce-CSP только в динамической зоне; два отдельных Next-приложения не поддерживаются [16] |

**§2, опции init** — заменить `search` и `commerce-shopify` (shop) и добавить:
> `auth-bff` (site, по умолчанию вкл.), `i18n-routing` (site, вкл.), `realtime` (site; admin уже имеет real-time
> провайдер — общий `packages/realtime`), `video` (site), `commerce` (site; подопции `search`, `commerce-shopify`),
> `multi-instance` (site: Redis cache handler). Пресет `shop` = `site` + `auth-bff` + `commerce`.

**§3.1, строка «Оркестратор, сборщик»** — «Turbopack только у shop» → «Turbopack только у `site`».

**§3.2, таблица по шаблонам** — столбец `shop` переименовать в `site (+commerce)`:
- Данные: RSC через `domains/<d>/api.server.ts` + `'use cache'`/теги для публичного; Query (+ гидрация из RSC) для
  интерактива; MobX только в клиентских компонентах; commerce: `CommerceProvider` + вебхук → ревалидация.
- Специфика: BFF-сессия `__Host-` + DAL; `[locale]` + i18next серверный инстанс; Metadata API, sitemap/robots/JSON-LD;
  `PageTransition` + `transitionTypes`; `packages/realtime` (опция); Video.js 10 (опция); commerce-адаптеры по [05b].
- Тесты: Vitest + Playwright против mock-API (`@mswjs/http-middleware`), `routeWebSocket`, e2e заголовков и SEO,
  Lighthouse CI.
- Образ: Node standalone, один на все окружения; Redis по `multi-instance`.

**§3.2, правила kit** — без изменений (уже покрывают RSC).

**§4, дерево** — добавить абзац:
> В `site` маршруты Next лежат в `src/app/` и тонкие (≤ 60 строк, без `'use client'`); composition root — `src/app/_root/`;
> `proxy.ts` и `instrumentation.ts` в `src/`. Серверный код домена — `api.server.ts` (`server-only`), клиентские ключи —
> `queries.ts`, мутации форм — `actions.ts`.

**§6, режимы** — Persuade: «landing, публичные страницы site»; Operate: «admin, tma, кабинет и рабочие экраны site,
корзина и чекаут».

**§9, по шаблонам** — строку shop заменить на:
> site: токены API только на сервере, сессия `__Host-` HttpOnly; доступ проверяет DAL у данных, не proxy и не layout;
> Server Actions и route handlers как публичные API (zod, сессия, Origin); BFF-прокси по allowlist; персональное не в
> `'use cache'`; CSP двумя профилями (nonce в динамической зоне, статический для пререндеренных). commerce: карта
> никогда не касается нашего кода, цену считает провайдер, `purchase` по вебхуку.

**§11, волны**:
- Волна 0: + «smoke `site` (kit + `tv()` + MobX + Query-гидрация + i18next), бюджет JS, View Transitions на iOS 18 /
  Android WebView / Telegram, CSP статических страниц».
- Волна 2: «landing + blog + **site (ядро, `auth-bff`, `i18n-routing`)** + anti-slop»; критерий выхода: + «site: SSR-HTML
  с метаданными, защищённые маршруты редиректят, переходы работают, образ отвечает `/version.json`».
- Волна 3: «game + **опции site: `realtime` (+ `packages/realtime`), `video`, `commerce` (пресет shop), `multi-instance`**
  + модули»; критерий: «e2e `commerce` на `mock` до оплаты» вместо «shop e2e».
- Порядок в §12: `core → tma → admin → landing → blog → site → game → commerce`.

**§12, решения** — добавить: «Шаблон `site` на Next 16.4; `shop` = `site` + `commerce` (одно Next-приложение)». В
подтверждения — вопросы ниже.

**§13, риски** — добавить строки:

| # | Риск | Мера |
| --- | --- | --- |
| 9 | Модель кэша Next (cookies в layout, `'use cache'` с персональными данными) — агенты ошибаются, утечка чужих данных или весь сайт динамический | правила в `apps/site/CLAUDE.md` с lint, skill `site-cache-review`, `ensureStatic` на публичных группах, e2e «два пользователя — разные ответы» |
| 10 | View Transitions различаются в Safari/WebView; real-time ломает переходы | CSS-fallback, `default="none"` по правилу, проверка на устройствах в волне 0 |
| 11 | nonce-CSP и статика несовместимы; RSC payload inline | два профиля CSP, Report-Only, проверка SRI в волне 0 |
| 12 | Video.js 10 только вышел (2026-10-01) | пин 10.0.x, опция выключена по умолчанию, fallback нативный `<video>` |

## Open questions for the user

1. `shop` становится опцией `commerce` шаблона `site` (одно Next-приложение, `shop` остаётся пресетом init). Согласны,
   или нужны два независимых Next-приложения в одном проекте?
2. `auth-bff` включён в `site` по умолчанию (кабинет есть у всех трёх примеров) — или публичный сайт без авторизации по
   умолчанию?
3. Для устройств без View Transitions (iOS ≤ 17, старые WebView) достаточно CSS-fade страницы, или нужен JS-движок
   переходов (Motion) ценой бандла?
4. Real-time подключается к бэкенду напрямую по одноразовому тикету (сокет не идёт через наш Node). Допустимо ли это для
   инфраструктуры бэкенда (отдельный WS-домен, CORS/Origin)?
