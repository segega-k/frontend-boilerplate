# 17c. Шаблон `site` (универсальный SSR): глубокая проверка стека
Status: done
Updated: 2026-10-15

## Resume notes
- Done: все разделы. Версии сняты скриптом с registry.npmjs.org 2026-10-15 (dist-tags + `time`), Node — с
  nodejs.org/dist/index.json и github.com/nodejs/Release schedule.json, Docker — Docker Hub API и gcr.io distroless.
  Отчёт 16 перечитан в финальной версии (Status: done), выбор фреймворка выровнен с ним (Next 16.4, shop = site + commerce).
- Next: — (пункты «проверить в волне 0» в конце Findings).
- Sub-agent: нет.

## Summary (≤ 15 lines)
1. Фреймворк `site` = **Next.js 16.4 App Router + Cache Components, `output: 'standalone'`** (как в [16]); в pnpm catalog
   пинить `next 16.4.0` до истечения `minimumReleaseAge` у 16.4.1 (вышел 2026-10-14). Next 17 в ближайшие 12 месяцев
   вероятен (мнение: мажоры выходили в октябре 2023/2024/2025); Cache Components в нём станут дефолтом, мы их уже включаем.
2. Здоровье ядра хорошее: next, react 19.3.1, @sentry/nextjs 11.7, i18next 26.4.5, @tanstack/react-query 5.104, motion 14.2
   — релизы за последние 1–3 недели. Слабые места: Hey API (0.99.0 от 2026-06-22, без semver, exact pin), RHF 8 в beta.
3. MobX 7.0.6 / mobx-react-lite 5.1.0 (оба мажора 2026-07-30): только Proxy, нет legacy-декораторов, `Provider`/`inject`
   удалены, `useStaticRendering` удалён — остаётся `enableStaticRendering`. Наша модель (plain-классы, контекст React,
   стор на запрос в клиентском провайдере) с MobX 7 совпадает без адаптаций.
4. i18n: **next-i18next 16.3.1** (App Router, `proxy.ts`, `getT`, root params, режим `localeInPath: 'internal'` совместим
   с `cacheComponents`) закрывает «i18next в Next» без самописной интеграции. Серверный инстанс у него — module-level
   singleton с языком на запрос, а не «инстанс на запрос» из плана [12 §3.1].
5. Auth: **openid-client 6.8.8** (confidential client в route handlers) + **iron-session 9.0.1** (`__Host-` cookie, только
   sid/минимум) + Redis для токенов при multi-pod. Auth.js отклонён (next-auth latest всё ещё 4.24.15, v5 = beta.32,
   режим поддержки), Better Auth отклонён (свой DB-слой при внешнем бэкенде).
6. Переходы: React `<ViewTransition>` в Next работает без конфигурации, `<Link transitionTypes>`; без поддержки API —
   мгновенная смена (официально). Системный back/свайп iOS не несёт типа → двойной анимации нет. Это расходится с
   формулировкой плана «без View Transitions API из-за iOS < 18» — для Next-шаблона VT единственный путь анимировать уход
   страницы.
7. Node: 24.22.0 (Krypton) уходит из Active в **Maintenance 2026-10-20**, EOL 2028-04-30; **Node 26 становится LTS
   2026-10-28**, EOL 2029-04-30. Рекомендация: старт на 24 (как в плане), переход на 26 одним PR в январе 2027.
8. Docker: `node:24-slim` теперь = **trixie** (Debian 13); bullseye-теги прекращены после 24.20; runtime — `node:24-slim`
   по digest (glibc для sharp), опция hardened — `gcr.io/distroless/nodejs24-debian13:nonroot`; alpine не берём.
9. «Один образ на все окружения» для Next достижим с оговорками: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` **вшивается в
   сборку** (один ключ на все окружения), `NEXT_PUBLIC_*` запрещены для окружений, и пререндер `'use cache'`-страниц
   ходит в бэкенд **во время build** — нужен явный контракт, какой API доступен на сборке.

## Findings

### 1. Таблица технологий (факты: версии и даты с npm/официальных источников 2026-10-15; health и вердикт — мнение)

| Технология | Выбор + точная версия | Дата релиза | Health | Риск breaking 12 мес | Вердикт | Источник |
| --- | --- | --- | --- | --- | --- | --- |
| Node.js | 24.22.0 LTS Krypton (`.nvmrc` 24), переход на 26.x LTS | 2026-10-14 (26.12.0 — 2026-10-14) | отлично; 24 → maintenance 2026-10-20, EOL 2028-04-30; 26 LTS 2026-10-28, EOL 2029-04-30 | низкий для 24; плановый апгрейд на 26 | брать 24, 26 в Q1 2027 | https://github.com/nodejs/Release/blob/main/schedule.json, https://nodejs.org/dist/index.json |
| Docker build/runtime | `node:24-slim` (= `24-trixie-slim`), pin по digest | тег обновлён 2026-10-06 (24.21.0; 24.22.0 ещё не собран) | отлично | низкий (смена Debian уже прошла) | брать | https://hub.docker.com/_/node |
| Docker hardened (опция) | `gcr.io/distroless/nodejs24-debian13:nonroot` | постоянно пересобирается | хорошо | низкий | опция `hardened-image` | https://github.com/GoogleContainerTools/distroless |
| Reverse proxy (опция) | `nginxinc/nginx-unprivileged:1.30.6` (stable, alpine3.24 / trixie) | 2026-10-14 | отлично | низкий | брать для compose на VPS | https://hub.docker.com/r/nginxinc/nginx-unprivileged |
| Meta-framework | `next` 16.4.0 → 16.4.1 после 7 дней | 16.4.0: 2026-10-06; 16.4.1: 2026-10-14; canary 16.5.0-canary.11 | отлично; 16.x Active LTS | средний: Next 17 вероятен (мнение), Cache Components станут дефолтом — мы уже на них | брать | https://nextjs.org/blog/next-16-4, https://nextjs.org/support-policy |
| React | `react`/`react-dom` 19.3.1 (App Router рендерит vendored canary из `next`) | 2026-10-14 | отлично | низкий | брать через catalog | https://react.dev/blog/2026/09/09/react-19-3 |
| Стили | `tailwindcss` + `@tailwindcss/postcss` 4.3.3, `tailwind-variants` 3.3.1 | 2026-07-16 / 2026-08-03 | хорошо | низкий | брать (PostCSS-плагин, т.к. Turbopack) | npm |
| Kit | `@base-ui/react` 1.9.0 | 2026-10-09 | отлично | низкий | брать, `'use client'` пофайлово | npm |
| Клиентское состояние | `mobx` 7.0.6 + `mobx-react-lite` 5.1.0 | 2026-10-02 / 2026-09-24 (мажоры 2026-07-30) | хорошо | низкий (мажор только что прошёл) | брать, только в клиентских компонентах | https://unpkg.com/mobx@7.0.0/CHANGELOG.md |
| Серверное состояние | `@tanstack/react-query` 5.104.2 (+ `-next-experimental` 5.104.2 не брать) | 2026-10-11 | отлично | низкий (v6 не анонсирован — не найдено) | брать | npm |
| API-клиент | `@hey-api/openapi-ts` 0.99.0 exact pin, плагины `@hey-api/client-next` (встроен), `@tanstack/react-query`, `zod` | 2026-06-22 (next-тег 2026-09-30) | средний: 4 мес без latest, не следует semver | высокий (любой минор может ломать) | брать с exact pin, smoke при апгрейде | https://heyapi.dev/openapi-ts/clients/next-js |
| Формы | `react-hook-form` 7.90.0, `@hookform/resolvers` 5.9.1, `zod` 4.6.7 | 2026-10-11 / 2026-08-17 / 2026-10-12 | хорошо | средний: RHF 8.0.0-beta.4 | брать 7, RHF 8 отдельным PR | npm |
| Server Actions обёртка | `next-safe-action` 8.7.3 | 2026-09-07 | средне (сообщество) | средний | не в ядре; свой `action()`-хелпер на Zod | npm |
| i18n | `i18next` 26.4.5, `react-i18next` 17.0.16, `next-i18next` 16.3.1 | 2026-10-14 / 2026-10-06 / 2026-09-13 | хорошо; next-i18next App Router — с марта 2026 (вторичный источник) | средний (App Router-часть next-i18next молодая) | брать; fallback — свой `createInstance` | https://unpkg.com/next-i18next@16.3.1/README.md |
| URL-состояние | `nuqs` 2.10.2 | 2026-10-08 | хорошо | низкий | брать по месту (фильтры) | npm |
| OIDC-клиент (BFF) | `openid-client` 6.8.8 (panva; поверх `oauth4webapi` 3.8.8) | 2026-09-05 | отлично | низкий | брать | https://github.com/panva/openid-client |
| Сессия | `iron-session` 9.0.1 (engines node ≥ 22.13) | 2026-08-30 | хорошо; пример в официальных доках Next | низкий | брать | https://nextjs.org/docs/app/guides/authentication-with-cache-components |
| JWT/JWKS при нужде | `jose` 6.2.12 | 2026-09-05 | отлично | низкий | брать по месту | npm |
| Auth.js | `next-auth` 4.24.15 latest, 5.0.0-beta.32 | 2026-07-20 | поддержка только безопасности (вторичные источники) | высокий | не брать | npm, https://blog.logrocket.com/best-auth-library-nextjs-2026/ |
| Better Auth | `better-auth` 1.7.8 | 2026-10-14 | отлично | средний | не брать: свой user/session-слой в БД дублирует внешний бэкенд | npm |
| Переходы | React `<ViewTransition>` + `<Link transitionTypes>` (Next, без конфигурации) | React 19.3 (2026-09-09) | stable | низкий | брать + CSS-fallback [16 §4.2] | https://nextjs.org/docs/app/guides/view-transitions |
| Микроанимации | `motion` 14.2.0 (`LazyMotion`) | 2026-10-13 | отлично | низкий | брать вне kit | npm |
| Ошибки/трейсинг | `@sentry/nextjs` 11.7.0 (peer next ^16; Turbopack поддержан) | 2026-10-12 (мажор 11 — 2026-09-23) | отлично | низкий; v11 требует self-hosted Sentry ≥ 26.4.2 | брать | https://docs.sentry.io/platforms/javascript/guides/nextjs/migration/v10-to-v11/interactive/ |
| Логи | `pino` 10.4.0, JSON в stdout | 2026-10-02 | отлично | низкий | брать в серверном `log.*` | npm |
| Unit | `vitest` 5.0.4 (engines node ^22.12 ‖ ^24 ‖ ≥26) | 2026-10-12 | отлично | низкий | брать | npm |
| E2E | `@playwright/test` 1.64.1 | 2026-10-14 | отлично | низкий | брать | npm |
| Mock API | `msw` 3.0.3 + `@mswjs/http-middleware` 0.10.3 | 2026-10-10 | хорошо | низкий | брать (MSW как HTTP-сервер для серверных fetch) | [05b §9] |
| Env-валидация | `@t3-oss/env-core` / `-nextjs` 0.13.11 | 2026-03-22 | средне (7 мес без релиза) | низкий | можно; или свой zod-парсер `env.server.ts` | npm |
| Картинки | `sharp` 0.35.5 (Node-API, prebuilds glibc и musl) | 2026-09-27 | отлично | низкий | брать (зависимость next/image) | npm |

### 2. Отклонённые кандидаты (одной строкой; детальное сравнение — [16 §2])

- React Router 8.4.0 (2026-09-15): SSR стабилен, но RSC/Server Actions `unstable_`, третий meta-framework рядом с Astro и Next.
- TanStack Start 1.169.2: доки пишут «stable», блог v1 так и не обновлён с RC (2025-09-23), RSC «experimental».
- Astro 7.3.8 + `@astrojs/node` 11.1.7: острова не делят React-контекст — кабинет с MobX/Query неудобен; остаётся у landing/blog.
- Vike 0.4.267: 0.x, малый bus factor, нет RSC в основном пути.
- Альтернатива «отдельный `apps/shop` рядом с `apps/site`»: два Next-приложения = две копии конфига/proxy/сессии/CSP/Docker
  и риск разъезда версий; оправдано только если магазин живёт на другом домене с независимым релизным циклом (v2 `add`).

### 3. Роутер и структура

- Факт: App Router, `proxy.ts` (бывший middleware) работает на Node runtime; в standalone поддержан без настройки
  (https://nextjs.org/docs/app/guides/self-hosting).
- Факт: с `cacheComponents` чтение `cookies()` вне `<Suspense>` — ошибка сборки; сессию читать внутри границы, не на
  верхнем уровне layout (https://nextjs.org/docs/app/guides/authentication-with-cache-components).
- Мнение: route groups `(public)` с `ensureStatic = 'shell'`, `(account)`/`(app)` динамические; навигационные хелперы
  домена задают `transitionTypes` (как в [16 §4.2]).

### 4. Стили и kit в RSC

- Tailwind 4.3.3 подключается через `@tailwindcss/postcss` (Turbopack), `@source` на `packages/ui/src` [05 §7].
- `tv()`-рецепты в `Name.styled.ts` — чистые функции без React, их можно вызывать и в RSC, и в клиентских файлах
  (мнение: `tailwind-variants` 3.3.1 не зависит от React; проверить, что `tailwind-merge` не тянет `window`).
- Base UI 1.9.0 — клиентские компоненты; каждый интерактивный файл kit с `'use client'`, без barrel с директивой,
  `exports` пофайлово [05b §4]. Правила kit для RSC из [12 §3.2] достаточны, новых не нужно.

### 5. Состояние: MobX 7 и TanStack Query в SSR

Факты (CHANGELOG mobx 7.0.0, mobx-react-lite 5.0.0):
- Только Proxy (ES5-fallback, `configure({ useProxies })`, `{ proxy: false }` удалены); legacy-декораторы удалены;
  `observable.ref` → `observableRef`, `action.bound` → `actionBound`, `comparer.structural` → `compareStructural`; `trace`
  удалён.
- mobx-react-lite 5: React ≥ 18, удалены `Provider`, `inject`, `MobXProviderContext`, `useObserver`, `useLocalStore`,
  `useAsObservableSource`, `useStaticRendering`; рекомендованная поверхность — `observer`, `Observer`,
  `useLocalObservable`, `enableStaticRendering`, `isUsingStaticRendering`. 5.1.0 чинит очистку реакций от
  приостановленных (Suspense) рендеров — важно для стриминга.

Правила для `site` (мнение, согласовано с [16 §5]):
1. `enableStaticRendering(typeof window === 'undefined')` — один раз в клиентском модуле корневого провайдера.
2. Сторы/VM создаются в клиентском компоненте: `const [vm] = useState(() => new TradeVm(initialSnapshot, deps))`; никаких
   `export const store = new X()` в коде `site` (lint-правило `no-module-level-observable` в `apps/site`).
3. Через RSC → client границу передаются только сериализуемые DTO (класс-инстанс MobX не сериализуется RSC).
4. Query: `getQueryClient()` — на сервере новый на запрос (React `cache()`), в браузере синглтон; `prefetchQuery` в RSC +
   `<HydrationBoundary state={dehydrate(qc)}>`. `@tanstack/react-query-next-experimental` (стриминг без prefetch) не брать:
   экспериментальный пакет. Для чисто публичных страниц Query не нужен — данные пропсами из `'use cache'`-функций.
5. MobxQuery v2 поверх того же QueryClient — проверить в волне 0 отсутствие двойного запроса после гидрации [16 §2.4].

### 6. Данные: Hey API на сервере и клиенте

- Факт (https://heyapi.dev/openapi-ts/clients/next-js): плагин `@hey-api/client-next` (отдельные пакеты
  `@hey-api/client-next`/`client-fetch` deprecated — встроены в `openapi-ts` с 0.73); `runtimeConfigPath` →
  `createClientConfig()` работает и на сервере, и на клиенте; `auth` — строка или функция; в любой SDK-функции можно
  передать `client`; interceptors `use`/`eject`/`update`.
- Факт: npm-страница `@hey-api/openapi-ts`: «does NOT follow the semantic versioning strategy… pin an exact version».
- Правило (мнение): на сервере **не регистрировать interceptors с данными пользователя** на модульном клиенте — он общий
  для всех запросов процесса. Токен давать через `auth: async () => (await getSession()).accessToken` (`cookies()` в Next
  привязан к запросу через AsyncLocalStorage) или через отдельный `createClient()` в `api.server.ts`. В браузере клиент
  ходит только в наш BFF (`/api/bff/*`), не в внешний API с токеном.
- Два генерируемых клиента из одной спеки: `server` (baseUrl = внутренний URL API, токен из сессии) и `browser` (baseUrl =
  `/api/bff`, без токена). Генерация одна, конфиги два.

### 7. Формы и валидация

- RHF 7.90 + `zodResolver` + Zod 4.6; одна Zod-схема в `domains/<d>/schemas.ts` используется клиентом и Server Action.
- Отправка: `handleSubmit(data => startTransition(() => action(data)))`; action повторно валидирует, читает сессию,
  зовёт API, маппит 422 `field`-ошибки в `{ fieldErrors }` → `setError` на клиенте. Без JS (progressive enhancement) не
  гарантируем — мнение: для форм кабинета не нужно; для публичных форм (контакт, подписка) допустим `<form action>` +
  `useActionState` без RHF.
- Server Actions — публичные эндпоинты: встроенная проверка Origin, за прокси `serverActions.allowedOrigins` [16 §6.1].
- RHF 8 (beta.4): мигрировать отдельным PR после stable; ESLint-запрет `watch()` уже готовит к нему.

### 8. i18n

- Факт (README next-i18next 16.3.1): `createServerI18next(config)` → `{ getT, getResources, generateI18nStaticParams }`;
  `createProxy(config)` (cookie → `Accept-Language` → fallback, редирект на префикс, заголовок
  `x-i18next-current-language`); язык из root param `[lng]` на Next 16.3+; `localeInPath: true` (по умолчанию,
  пререндер на локаль), `false` (всё динамическое), `'internal'` (чистые URL + пререндер с `cacheComponents`);
  Route Handlers и Server Actions — `{ lng }` явно; клиент — `I18nProvider` + `useT`, ресурсы передаются сериализованными.
- Факт: на сервере «module-level singleton» i18next. Мнение: безопасно, пока никто не вызывает `changeLanguage` на общем
  инстансе (только `getFixedT(lng)`) — это lint/review-правило. План говорил «серверный инстанс на запрос»; формулировку
  поменять на «язык на запрос, общий инстанс, только `getT`».
- Каталоги остаются в `packages/i18n` (JSON i18next), плюрали ru проверяются общим скриптом — совпадает с остальными
  шаблонами. Это же снимает вопрос next-intl в commerce: commerce = опция `site`, значит тоже i18next.

### 9. Переходы и анимация

- Факты: см. таблицу и [16 §4.1]. Next: «View transitions work in the App Router with no configuration»; «Without browser
  support, your application works normally; the transitions do not animate»; «Browser-initiated back navigations… do not
  carry a transition type»; `::view-transition { pointer-events: none }` чтобы клики не терялись. React 19.3 changelog:
  «Fix a `<ViewTransition>` crash in Mobile Safari».
- Cross-document VT (Safari 18.2+, Chrome 126+, Firefox нет) для `site` не нужен (навигация клиентская); пригоден для
  перехода landing → site на одном origin.
- Мнение: длительности из токенов (≤ 280 мс), не 400 мс из примеров Next [16 §4.2]; Motion 14 только микровзаимодействия.

### 10. Auth (BFF)

- Схема (мнение, совпадает с [16 §6.1]): `app/api/auth/login` (openid-client `discovery()` + `buildAuthorizationUrl` с
  PKCE и `state`/`nonce` в временной sealed cookie), `callback` (`authorizationCodeGrant`), `logout` (end_session).
  Сессия: iron-session sealed `__Host-session` с sid + минимумом; access/refresh/id token — в Redis по sid при
  `multi-instance`, в sealed cookie при одном поде только если влезает в ~4 KB (id_token часто большой → по умолчанию
  хранить server-side). Refresh — single-flight на sid в DAL.
- `proxy.ts` — только оптимистичная проверка наличия cookie; авторизация в DAL (урок CVE-2025-29927) [16 §6.1].
- Факт: официальный пример Next с Cache Components использует iron-session и `'use cache: private'` для текущего
  пользователя; `use cache`/`use cache: remote` не могут читать `cookies()`; ключи и теги кэша хранятся открытым текстом —
  в них только стабильный id, без токенов и email.
- Admin остаётся на `oidc-client-ts` PKCE (public client) [12 §3.2]; общий только IdP и маппинг ролей.

### 11. Real-time

- Мнение: standalone-сервер Next не держит WebSocket в route handlers; сокет напрямую к бэкенду по одноразовому тикету
  из `app/api/realtime/ticket` [16 §1]; SSE через route handler (`ReadableStream`) возможен для лёгких уведомлений, но
  держит соединение в Node-поде и требует `X-Accel-Buffering: no`.

### 12. Тесты

- Vitest 5.0.4 (клиентские компоненты, VM, мапперы); async RSC — только e2e [05b §9].
- Playwright 1.64.1 против `next start` с `API_URL` → `@mswjs/http-middleware`; OIDC в e2e — mock-стратегия `AuthStrategy`
  (`mock`) по умолчанию, ночной прогон против Keycloak в compose (мнение).

### 13. Наблюдаемость

- `@sentry/nextjs` 11.7.0: `instrumentation.ts` (сервер), `instrumentation-client.ts` (клиент, lazy), `withSentryConfig`
  с hidden sourcemaps; Turbopack поддержан, webpack-only опции (`autoInstrumentServerFunctions`, `excludeServerRoutes`)
  под Turbopack не действуют — исключения через `beforeSendTransaction` (блог Sentry). v11: Node ≥ 20.19/22.12, self-hosted
  Sentry ≥ 26.4.2 — для GlitchTip совместимость проверить в волне 0 (не проверено).
- OTel: Sentry 11 сам построен на OpenTelemetry; второй провайдер (`@vercel/otel` 2.1.3) не регистрировать. Логи — pino в
  stdout с `requestId`.

### 14. Node, Docker, образ

**Node (факты):**

| Линия | Последняя | Статус на 2026-10-15 | Maintenance | EOL |
| --- | --- | --- | --- | --- |
| 22 Jod | 22.23.3 (2026-09-23) | Maintenance | с 2025-10-21 | 2027-04-30 |
| 24 Krypton | 24.22.0 (2026-10-14) | Active LTS | **с 2026-10-20** | 2028-04-30 |
| 26 | 26.12.0 (2026-10-14) | Current, **LTS с 2026-10-28** | 2027-10-20 | 2029-04-30 |
| 27 | — | alpha-канал с 2026-10-28, релиз 2027-04-22 | 2027-10-20 | 2030-04-30 |

- Ограничения экосистемы: react-router ≥ 22.22, msw/astro ≥ 22.12, Hey API ≥ 22.18, iron-session ≥ 22.13, vitest
  `^22.12 ‖ ^24 ‖ ≥26`, Sentry 11 `≥22.12 <23 ‖ ≥23.2` — **26 уже допускается всеми** проверенными пакетами.
- Факт (блог Next 16.4): `turbopackPluginRuntimeStrategy: 'workerThreads'` на Node ≥ 24.13.1 откатывается к child
  processes из-за бага Node (nodejs/node#65100) — экспериментальную опцию не включать.
- Мнение: `.nvmrc` = 24 на старте (риск ноль, maintenance до 2028-04); один PR «Node 26» в январе 2027 (после 2–3 месяцев
  LTS), меняет `.nvmrc`, `engines`, базовый образ, `@types/node` (сейчас 26.6.5 — пинить `@types/node` по мажору `.nvmrc`).

**Docker (факты Docker Hub 2026-10-15):**
- `node:24-slim`/`24-trixie-slim`/`24-bookworm-slim` — 24.21.0 (2026-10-06); `24-alpine` (alpine3.24) — 24.21.0
  (2026-09-18); bullseye-варианты последний раз 24.20.0 (2026-08-27). Образ 24.22.0 ещё не опубликован. `node:26-*`
  есть (26.11.1, 2026-10-08).
- distroless: `gcr.io/distroless/nodejs24-debian13` и `nodejs26-debian13` существуют (без shell; HEALTHCHECK только
  `CMD ["/nodejs/bin/node", "healthcheck.mjs"]`).
- nginx-unprivileged: stable 1.30.6 (`-alpine3.24`, `-trixie`) 2026-10-14.

**Мнение по выбору базы:** build и runtime — `node:24-slim@sha256:…` (glibc: sharp prebuilds, меньше сюрпризов с
нативными модулями; alpine/musl в Node — экспериментальный уровень поддержки по памяти, не перепроверено); `USER node`,
`init: true` в compose (корректный PID 1); hardened-вариант distroless как опция для k8s. Next standalone по [05b §11] /
[16 §1 п.17]; smoke образа в CI обязателен (pnpm-симлинки).

**Один образ на все окружения для SSR — условия (факты из https://nextjs.org/docs/app/guides/self-hosting + мнение):**
1. Факт: серверные env читаются в рантайме при динамическом рендере (`await connection()`); `NEXT_PUBLIC_*` инлайнятся при
   build → запрет `NEXT_PUBLIC_*` для окружений (lint), публичный конфиг — из сервера (динамический компонент или
   `/config.json` route handler).
2. Факт: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` «embedded in the build output» → один ключ на все окружения этого образа
   (мнение: приемлемо, ключ шифрует замыкания actions, не данные пользователя); секрет передаётся в build через
   BuildKit secret.
3. Факт: `deploymentId` задаётся на build (= git SHA) — совпадает с идеей «один образ».
4. Мнение, главный подводный камень: пререндер static shell и `'use cache'` без runtime-данных выполняется **на
   `next build`** и ходит в API тем URL, что был на сборке; значения env, прочитанные в пререндере, замораживаются в
   HTML. Контракт: на build доступен только prod-контент API (или build без сети: публичные страницы с бэкенд-данными
   рендерятся при первом запросе через пустой `generateStaticParams` / `connection()`), env-зависимое — только в
   динамических частях. Иначе — сборка на окружение (как у landing). Проверить в волне 0.
5. Multi-pod: Redis `cacheHandler` + `cacheHandlers` с `refreshTags` (опция `multi-instance`) [05b §11].

### 15. Проверить в волне 0 (не проверено)

- GlitchTip как DSN для Sentry 11 (v11 требует self-hosted Sentry ≥ 26.4.2; GlitchTip — отдельный продукт).
- next-i18next 16 `localeInPath: 'internal'` + `ensureStatic = 'shell'` на публичной группе; HMR каталогов в dev.
- Сборка без доступа к API (п. 14.4) и поведение `'use cache'` на первом запросе.
- MobX 7 `observer` под vendored canary React + стриминг Suspense; Query-гидрация + MobxQuery v2 [16 §2.4].
- `tailwind-merge`/`tv()` вызов в RSC без клиентской директивы.

## Recommendations for the boilerplate

1. **Брать** стек `site` по таблице §1; в catalog: `next 16.4.0` (16.4.1 после 2026-10-21), `react 19.3.1`, `mobx 7.0.6`,
   `mobx-react-lite 5.1.0`, `@tanstack/react-query 5.104.2`, `@hey-api/openapi-ts 0.99.0` (exact), `next-i18next 16.3.1`,
   `openid-client 6.8.8`, `iron-session 9.0.1`, `@sentry/nextjs 11.7.0`.
2. **Брать** next-i18next 16 вместо самописной интеграции i18next с Next; правило «только `getT`, никакого
   `changeLanguage` на сервере».
3. **Брать** два Hey API-клиента из одной генерации (server с токеном из сессии, browser → `/api/bff`); interceptors с
   пользовательскими данными на сервере запрещены.
4. **Брать** MobX-правила §5 (стор в `useState`, `enableStaticRendering`, lint на модульные observable в `apps/site`).
5. **Брать** `node:24-slim` по digest + `USER node` + `init`; distroless опцией; Node 26 одним PR в январе 2027.
6. **Записать** в docs Docker-ветки 4 условия «одного образа» (§14) и e2e «одна сборка, два env → разные публичные
   конфиги».
7. **Избегать**: Auth.js, Better Auth, `@tanstack/react-query-next-experimental`, `@vercel/otel` вместе с Sentry,
   alpine для Node-образа, `NEXT_PUBLIC_*` для окружений, `workerThreads`-стратегии Turbopack.

### Что изменилось относительно плана и отчёта 16

- План [12 §3.1] «переходы без View Transitions API из-за iOS < 18» не подходит Next-шаблону: в App Router без VT нельзя
  анимировать уход страницы; принять схему [16 §4] (VT + CSS-fallback), что и подтверждено официальными доками.
- План «i18next: серверный инстанс на запрос»: готовое решение next-i18next 16 использует общий инстанс + язык на запрос;
  формулировку поправить. Next-intl в commerce больше не нужен (commerce — опция `site`).
- Node 24 через 5 дней уходит в maintenance, Node 26 LTS через 13 дней — в план добавить дату перехода; `node:*-slim`
  теперь trixie.
- Отчёт 16 пишет «один образ на все окружения» без оговорок — добавить: ключ Server Actions вшит в сборку, пререндер
  ходит в API на build.
- 16 и 17c согласованы по фреймворку (Next 16.4), shop = site + commerce, MobX/Query/Auth/CSP; 17c добавляет версии,
  next-i18next, Hey API-правило для сервера, Node/Docker-даты.

## Open questions for the user

1. Допустим ли один `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` для stage и prod (цена «одного образа»), или собираем образ на
   окружение?
2. Доступен ли prod-API контента во время CI-сборки `site` (для пререндера публичных страниц), или публичные страницы с
   данными бэкенда рендерятся только в рантайме?
3. Sentry SaaS или GlitchTip: при GlitchTip нужна проверка совместимости с SDK 11 до выбора.
