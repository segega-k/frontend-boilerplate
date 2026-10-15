# 22c. Wave 0 — smoke шаблона `site` (Next.js)

Status: paused (по запросу пользователя, 2026-10-15) · Агент C · Spike: `spikes/site/` (свой pnpm 11 workspace)

## Resume notes

Сделано: workspace (`packages/ui` + `apps/site`), prod-сборка standalone, e2e Playwright (Edge + WebKit) — 8 тестов
зелёные в Edge, в WebKit всё кроме сессии (см. ниже), замеры бюджета и TTFB, ключ Server Actions, Docker-образ на
`node:24-slim` собран и отвечает, CSP-варианты (strict / SRI) проверены. Правило координатора «шаблон не привязан к
контракту бэкенда» внесено в код (адаптеры, `examples/`).

Осталось (не начато из-за паузы):
1. Прогнать полный e2e ещё раз после последних правок (proxy с оптимистичным 307, тест «без VT API», `/bare`):
   `powershell -File spikes/site/apps/site/scripts/with-server.ps1 -Build corepack pnpm@11.22.0 exec playwright test`
   (скрипт сам ставит PATH на Node 24, собирает, поднимает mock-бэкенд :4010 и сервер :3100, останавливает их).
2. Эмпирически проверить runtime-переопределение `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (действие с замыканием, рендер на
   ключе X, вызов на ключе Y) — пока вывод по коду Next.
3. WebKit-сессию прогнать по HTTPS (`next dev --experimental-https` или Caddy) — по http WebKit не шлёт Secure-cookie.
4. Реальные устройства (iOS Safari, Telegram WebView, Android WebView) — в волне 0 не делалось.
5. Удалить локальный образ `site-spike:wave0`, если не нужен (`docker image rm site-spike:wave0`).

## Summary

- Стек `site` работает на Next 16.4.0 + Cache Components + Partial Prefetching + standalone + Node 24: kit как исходник
  (`transpilePackages` + `@source`), `tv()` в `Button.styled.ts` и в RSC без `'use client'`, Tailwind v4.
- MobX 7 только в клиентских компонентах (стор через `useState`, `enableStaticRendering`) + RSC `prefetchQuery` +
  `HydrationBoundary` + мини-`MobxQuery`: **ровно один** запрос к бэкенду на страницу, 0 клиентских запросов после гидрации.
- next-i18next 16.3.1: `[locale]` (en, ru), один инстанс на процесс (`createServerI18next`), язык из root param;
  `/en`, `/ru` пререндерятся. `'use cache'` + `cacheTag` в `api.server.ts`, `revalidateTag` обновляет страницу.
- BFF: `__Host-session` (iron-session, HttpOnly, Secure, Lax), DAL `getSession()`, адаптерный auth без допущений о
  бэкенде (`api-login`/`credentials` через конфиг, `oidc` заглушка, `none` по умолчанию), BFF-прокси по allowlist.
- View Transitions: `<Link transitionTypes>` → `startViewTransition` с типами `nav-forward`/`nav-back` в Edge и WebKit 27.
  **`app/template.tsx` ломает переходы** — fallback-fade перенесён внутрь `PageTransition`.
- CSP: nonce + `strict-dynamic` работает только если сегмент целиком динамический (`connection()` + `instant = false`);
  PPR-страница под nonce-профилем ломается (проверено). Статика работает только с `'unsafe-inline'`; SRI не спасает.
- **Бюджет 130 KB gz недостижим**: голый Next 16.4 (страница с одним клиентским компонентом) = 133 KB gz; наши страницы
  177–193 KB gz (154–168 KB brotli). Предлагаю бюджет ≤ 200 KB gz (≤ 175 br) и отдельный бюджет «приложение сверх
  фреймворка ≤ 65 KB gz».
- TTFB (локально): пререндер p50 1.5 мс, динамика p50 2.0 мс (стриминг), полный ответ динамики 16–46 мс.
- Ключ Server Actions вшивается в `server-reference-manifest.json` и **влияет на ID действий**; но рантайм берёт
  `process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY || manifest.encryptionKey` — образ на окружение не обязателен.
- Docker: образ на `node:24-slim` собирается за 33 с из кириллического пути, non-root, 389 MB (93.7 MB сжато).

## Results table

| Механизм | Итог | Примечание |
| --- | --- | --- |
| Next 16.4.0 App Router + `cacheComponents` + `partialPrefetching` + standalone, Node 24.18 | работает | без `partialPrefetching` Next печатает предупреждение — включать явно |
| kit как исходник: `transpilePackages` + `@source` + `'use client'` пофайлово | работает | `tailwind-variants`/`tailwind-merge` нужны и в зависимостях приложения (иначе `Module not found` в RSC) |
| `tv()` в RSC без клиентской директивы | работает | `Layout.styled.ts` в layout |
| Tailwind v4 через `@tailwindcss/postcss` | работает | класс из kit (`bg-brand`) попал в CSS, проверено `toHaveCSS` |
| MobX 7 + mobx-react-lite 5.1 под vendored React `19.3.0-canary-278794d7-20261002` | работает | **MobX 7: `observable.ref` удалён → `observableRef`** (именованный экспорт) |
| RSC prefetch + `HydrationBoundary` + MobxQuery без двойного запроса | работает | 1 upstream-запрос на страницу, 0 клиентских; refetch идёт через BFF ровно 1 раз |
| next-i18next 16.3.1, `[locale]` en/ru, один инстанс, язык на запрос | работает | редирект `/` по Accept-Language, `lang` на `<html>` |
| `'use cache'` + `cacheTag` в `api.server.ts`, `revalidateTag(tag, {expire:0})` | работает | одноаргументный `revalidateTag` устарел |
| Корневой layout `[locale]` при cacheComponents | обход | без `export const instant = false` каждая навигация логирует `NEXT_STATIC_GEN_BAILOUT` для общего шелла `/[locale]`; `dynamicParams` с cacheComponents запрещён |
| BFF-сессия `__Host-` (iron-session 9.0.1) + DAL | работает (Edge) / обход (WebKit) | WebKit не отправляет Secure-cookie по `http://localhost` → e2e сессии только по HTTPS |
| iron-session под cacheComponents | обход | `Date.now()` в iron-session → в DAL `await connection()` перед чтением cookie |
| `redirect()` из защищённой страницы | обход | при стриминге отвечает 200 + клиентский редирект; оптимистичный 307 в `proxy.ts` по наличию cookie, DAL остаётся проверкой |
| Auth как адаптер (credentials/oidc/none) | работает (credentials), oidc — заглушка | без допущений о контракте, см. «Backend contract surface» |
| `<ViewTransition>` + `<Link transitionTypes>` | работает в Edge 155 и WebKit 27.2 (Playwright) | **с `app/[locale]/template.tsx` переходы не запускаются вообще** |
| Навигация без View Transitions API | работает | тест удаляет `startViewTransition`; CSS-fade через `@supports not` проверен только кодом |
| CSP nonce + `strict-dynamic` из `proxy.ts` (динамическая зона) | работает | все `<script>` в HTML с nonce, 0 нарушений; сегмент обязан быть полностью динамическим |
| nonce-CSP на PPR-странице | не работает (ожидаемо) | 15 нарушений, гидрации нет — правило: nonce-зона = `connection()` в layout зоны |
| Статический CSP на пререндере, `'unsafe-inline'` | работает | 0 нарушений, гидрация есть |
| Статический CSP без `'unsafe-inline'` (с SRI и без) | не работает | inline `self.__next_f.push` блокируются; `experimental.sri` добавляет `integrity` только внешним скриптам |
| First-load JS ≤ 130 KB gz | не выполняется | см. замеры; фреймворк сам 133 KB gz |
| Ключ Server Actions вшит при сборке | подтверждено, но с нюансом | рантайм-переменная имеет приоритет над вшитым ключом |
| Docker standalone на `node:24-slim` | работает | 33 с, non-root `node`, HEALTHCHECK, `data-dpl-id` = DEPLOYMENT_ID |
| Кириллический путь | работает с обходом | `fs.cpSync` в Node 24.18 падал с `0xC0000409` → ручное копирование в `copy-static.mjs` |

## Details

### Версии (pin: последний патч старше 7 дней, `minimumReleaseAge: 10080`)

next 16.4.0 (16.4.1 от 2026-10-14 — вместе с 19.3.1/19.2.9/19.1.10/19.0.9 и next 15.5.28 в один день, похоже на
security-релиз: проверить advisory и, возможно, сделать исключение из правила 7 дней), react/react-dom 19.3.0 (App Router
рендерит vendored `19.3.0-canary-278794d7-20261002`), @types/react(-dom) 19.3.0, @types/node 24.19.1, typescript 6.0.3,
mobx 7.0.6, mobx-react-lite 5.1.0, @tanstack/react-query 5.104.1, next-i18next 16.3.1, i18next 26.4.2,
react-i18next 17.0.16, iron-session 9.0.1, tailwindcss + @tailwindcss/postcss 4.3.3, tailwind-variants 3.3.1,
tailwind-merge 3.7.0, server-only 0.0.1, @playwright/test 1.64.0. Node 24.18.0 локально, pnpm 11.22.0 через corepack.
Docker: `node:24-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5` (Node 24.22.0),
Docker 28.4.0. Браузеры: Edge 155 (`channel: 'msedge'`), WebKit 27.2 (playwright webkit v2370 — **скачан** в
`%LOCALAPPDATA%\ms-playwright\webkit-2370` командой `playwright install webkit`; глобальных инструментов не ставил).

### Сборка

`pnpm exec next build` ≈ 4–6 с (Turbopack, compile 0.5–1 с). Next при первой сборке сам дописал в tsconfig
`allowJs`/`esModuleInterop`. При запуске сборки через пайп PowerShell дважды был код выхода `0xC0000409` — это падал
`node scripts/copy-static.mjs` (`fs.cpSync` поверх существующей папки, Node 24.18, кириллический путь); после замены на
ручное копирование падений нет. Повторный `next build` × 3 — exit 0.

### Замеры (`scripts/measure.mjs`, standalone на localhost, gzip -6 / brotli по умолчанию, noModule-полифиллы исключены)

| Страница | Скриптов | JS gz KB | JS br KB | inline gz | CSS gz | HTML gz | TTFB p50 / p95 мс | полный ответ p50 мс |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/bare` (голый Next, 1 клиентский компонент) | 8 | 133.1 | 114.4 | 1.5 | 0 | 1.7 | 1.4 / 1.8 | 1.5 |
| `/en` (пререндер, kit + MobX + i18n) | 12 | 190.2 | 165.5 | 2.4 | 2.6 | 3.1 | 1.5 / 2.2 | 1.5 |
| `/en/about` (пререндер, без kit-кнопки) | 10 | 177.3 | 154.2 | 2.3 | 2.6 | 2.8 | 1.4 / 1.8 | 1.4 |
| `/en/items` (динамика, Query + MobX + upstream) | 12 | 193.3 | 168.3 | 3.7 | 2.6 | 4.5 | 2.0 / 2.8 | 31–46 |
| `/en/login` (динамика, Server Action форма) | 12 | 190.5 | 165.7 | 3.1 | 2.6 | 3.9 | 1.9 / 2.3 | 16 |

Разбивка `/en` по чанкам (`scripts/chunks.mjs`): react-dom+next 70.3, next 35.1, runtime/прочее фреймворка ~28,
i18next 21.0, mobx 12.9, tailwind-merge+tailwind-variants 12.5, react-query+react-i18next 10.6. Polyfill-чанк core-js
(38.7 KB gz) грузится только как `noModule`. Эксперимент `tailwind-variants/lite` (без tailwind-merge): `/en` 181.4 KB gz
(−8.8). Провайдеры в корневом layout тянут MobX/Query/i18n на каждую страницу (about тоже).

### Server Actions key

`server-reference-manifest.json` содержит `encryptionKey`. Опыт: A → пересборка с живым `.next/cache` даёт тот же ключ и
те же ID действий; с `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` на сборке ключ = переданный и **ID действий меняются**; без
кэша — новый ключ и новые ID. Код рантайма (`next/dist/server/app-render/encryption-utils.js:78`):
`process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY || serverActionsManifest.encryptionKey`. Значит: ключ всегда лежит в
образе (секрет в слое образа), но рантайм-переменная его переопределяет, если одинакова на всех подах.

### Docker

`docker build -f apps/site/Dockerfile -t site-spike:wave0 --build-arg DEPLOYMENT_ID=wave0 .` из `spikes/site`:
exit 0 за 33 с, `pnpm install --frozen-lockfile --filter @spike/site...`, ключ — через BuildKit secret (опционально).
Контейнер: `/en` 200, статический CSP, `data-dpl-id="wave0"`, `/ru` по-русски, `uid=1000(node)`. Образ 389 MB на диске.

## What wave 1/2 should take as is

- `spikes/site/apps/site/src/proxy.ts` (композиция next-i18next `createProxy` + nonce-CSP + request id + оптимистичный
  307) и matcher без prefetch-запросов.
- Двухпрофильный CSP: `headers()` для статики, nonce для группы `(dynamic)` с `connection()` + `instant = false`.
- `PageTransition` (VT внутри `page.tsx`, fallback-fade внутри него, **без template.tsx**), CSS переходов с токенами.
- `shared/lib/session/*` (DAL с `connection()`), `shared/lib/auth/types.ts` + адаптеры, BFF-прокси по allowlist.
- `MobxQuery` (QueryObserver → `observableRef`, `getOptimisticResult(client.defaultQueryOptions(...))`, подписка в
  эффекте) как основа для `MobxQuery v2`.
- `i18n.server.ts` через `createServerI18next` (без порядка инициализации).
- Dockerfile (multi-stage, BuildKit secret для ключа, non-root, HEALTHCHECK) и `copy-static.mjs`.
- e2e-набор `e2e/smoke.spec.ts` как каркас (CSP обеих зон, без двойного запроса, сессия, VT-типы, revalidateTag).

## Plan changes proposed

1. **Бюджет site**: 130 KB gz → ≤ 200 KB gz (≤ 175 KB br) на публичную страницу, плюс «приложение сверх фреймворка ≤ 65 KB
   gz»; замер — свой скрипт (Next 16 не печатает First Load JS). Рассмотреть `tailwind-variants/lite` (kit закрыт для
   внешнего `className`, merge почти не нужен) и вынос MobX/Query-провайдеров из корневого layout в группы, где они нужны.
2. **Образ на окружение не обязателен** для ключа Server Actions: один образ + общий `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
   в рантайме (секрет вне образа); вшитый build-ключ считать несекретным. Образ на окружение остаётся нужен только для
   `NEXT_PUBLIC_*`. Требует пункта 2 из Resume notes для подтверждения.
3. В правила `apps/site/CLAUDE.md`: запрет `template.tsx` вместе с `PageTransition`; nonce-зона = layout с
   `connection()` + `instant = false`; корневой `[locale]/layout` с `instant = false`; DAL вызывает `connection()`;
   `revalidateTag` только с двумя аргументами; MobX 7 `observableRef`.
4. CSP статики: SRI не заменяет `'unsafe-inline'` (inline RSC payload) — оставить `'unsafe-inline'` + строгий
   `connect-src`/`frame-ancestors`; из плана убрать «SRI в волне 0» как путь к strict CSP.
5. Dev и e2e сессии — по HTTPS (WebKit не шлёт `Secure` cookie на `http://localhost`).
6. Проверить advisory к next 16.4.1 / react 19.3.1 (выпуск 2026-10-14 по всем веткам) — возможно исключение из правила 7 дней.

## Backend contract surface

Минимум, который шаблон ожидает от любого бэкенда: **ничего фиксированного**. Шаблон не знает путей, форматов тел,
заголовков авторизации и полей пользователя. Всё бэкенд-специфичное — конфигурация или адаптер:

| Точка | Где | Что задаёт проект |
| --- | --- | --- |
| `API_URL` | `src/shared/config/backend.server.ts` | базовый URL upstream (нет — бэкенда нет, BFF отвечает 503) |
| `BFF_ALLOW` | там же | allowlist `METHOD:/path` (`*` = один сегмент) для `/api/bff/*`; по умолчанию пусто = всё 404 |
| `AUTH_ADAPTER` | `src/auth.config.ts` | `none` (по умолчанию), `api-login`, `oidc`; init генерирует этот файл |
| `AuthAdapter` | `src/shared/lib/auth/types.ts` | `signIn` (credentials или redirect), `completeSignIn?`, `refresh?`, `signOut`, `authorize(session, headers)` — формат заголовка решает адаптер |
| credentials-маппинг | `examples/auth/credentials.example.ts` (**пример**) | URL логина, тело запроса, разбор ответа в `SessionData`, заголовок авторизации, логаут |
| OIDC | `src/shared/lib/auth/adapters/oidcAdapter.ts` (заглушка) | `OIDC_AUTHORIZE_URL`, `OIDC_CLIENT_ID`, `OIDC_REDIRECT_URI`; реальная реализация на openid-client |
| `SessionData` | `src/shared/lib/session/types.ts` | `subject`, `displayName?`, `credentials: Record<string,string>` (непрозрачно для шаблона), `expiresAt?` |
| `SESSION_PASSWORD` | `src/shared/lib/session/cookie.ts` | ключ шифрования cookie (в спайке есть dev-заглушка — в шаблоне сделать обязательным) |
| Пути данных | `domains/<d>/api.server.ts`, `queries.ts` | пути `/items` — только пример mock-бэкенда; в шаблоне — генерированный SDK `packages/api` |
| Mock-бэкенд | `examples/mock-backend/server.mjs` (**пример**) | только для e2e спайка |

BFF только проксирует allowlist на фиксированный upstream, пересылает `accept`/`content-type`/`accept-language`,
добавляет авторизацию через адаптер, отдаёт `cache-control: private, no-store`, держит cookie сессии.

## Open issues

- Реальные устройства (iOS 18 Safari, Telegram WKWebView, Android WebView) не проверены.
- Runtime-переопределение ключа Server Actions проверено только чтением кода.
- `/en/csp-shell`, `/en/vt-lab`, `/bare` — служебные маршруты спайка, в шаблон не переносить.
- `LoginForm` содержит поля `username/password` — в шаблоне форма должна приходить от адаптера.
- `refresh` single-flight и OIDC callback не реализованы.
