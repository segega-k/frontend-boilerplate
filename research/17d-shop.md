# 17d. Шаблон shop (= пресет `site` + опция `commerce`): глубокая проверка стека
Status: done
Updated: 2026-10-15

## Resume notes
- Done: версии npm (registry, 2026-10-15), Next 16.4 блог и встроенные доки `next@16.4.1/dist/docs`, React 19.3 блог,
  next-i18next 16.3.1 (README + исходник `dist/appRouter/server.mjs`), cache handlers (README fortedigital/trieb,
  официальный пример Next), Sentry v11 MIGRATION.md, Medusa (js-sdk, starter, 2.20 breaking, Stripe provider),
  ЮKassa-плагин, MobX 7 / mobx-react-lite 5, Meilisearch, Stripe. Учтено сообщение оркестратора: 16 предлагает
  shop = `site` + `commerce`; базовый Next-стек детально проверяет 17c, здесь он кратко, фокус на commerce.
- Next: — (отчёт завершён).
- Sub-agent: нет (запрещено).

## Summary (≤ 15 lines)
1. Рамка: shop = пресет `site` (Next 16.4 App Router + Cache Components, standalone) + опция `commerce`. Альтернатива
   (отдельное Next-приложение shop) — только если магазин и сайт живут на разных доменах/командах; цена — два Next.
2. Next: latest 16.4.1 (2026-10-14), но из-за `minimumReleaseAge` 7 дней на старте пинить **16.4.0** (2026-10-06).
   Cache Components официально рекомендованы для всех и станут дефолтом в Next 17 (даты нет; 15 и 16 вышли в октябре —
   мнение: 17 вероятен в ближайшие 0–6 мес.). Мы уже на новой модели — главный breaking Next 17 поглощён заранее.
3. **Главная поправка: готовые Redis-пакеты.** `@neshca/cache-handler` мёртв (1.9.0, 2024-11, peer next < 15);
   `@fortedigital/nextjs-cache-handler` 3.3.0 **не поддерживает** `cacheHandlers`/`'use cache'`/`cacheComponents`
   (своя матрица в README). Для нашей модели годятся: официальный пример Next `examples/cache-handler-redis`
   (без зависимостей, обе ветки) или `@trieb.work/nextjs-turbo-redis-cache` 1.18.1 (Cache Components поддержаны, но
   peer `redis` 4.7.0 ровно, тесты до Next 16.3.0). Рекомендация: свой handler по официальному примеру в опции
   `multi-instance`, trieb — запасной.
4. **i18next работает с RSC + Cache Components** через `next-i18next` 16.3.1: `getT()` читает `[lng]` из
   `next/root-params` (Next 16.3+), что не делает маршрут динамическим; в `'use cache'` прочитанные root params
   становятся частью ключа. Инстанс i18next на сервере — **один на процесс** + `getFixedT(lng)`, а не «инстанс на
   запрос» (как написано в мастер-плане). next-intl не нужен.
5. Medusa: 2.21.2 (2026-09-28), минор каждые 3–6 недель, **breaking в минорах** (2.20: лимит глубины relations в
   store API, удалён `search-local`). Пинить exact, обновлять осознанно. Клиент — официальный `@medusajs/js-sdk`
   (та же версия, что бэкенд, 2 зависимости), а не генерация из OpenAPI. Официальный Next-starter устарел (Next 15.3,
   React 19.0, Stripe 8) — только референс auth/корзины.
6. «Hosted checkout по умолчанию» с Medusa выполним только частично: ЮKassa — redirect на `confirmation_url`
   (hosted); Stripe-провайдер Medusa работает на PaymentIntents → на нашей странице Payment Element (iframe Stripe),
   не Stripe Checkout redirect. Hosted Stripe Checkout = свой payment provider в Medusa (бэкенд, не наш скоуп).
7. ЮKassa: `@gorgo/medusa-payment-yookassa` 2.0.4 (2026-09-24, 54-ФЗ, вебхуки, peer Medusa ^2.17.2) — живой, но
   один вендор-разработчик; старый `medusa-payment-yookassa` 1.0.2 заморожен.
8. Переходы: React `<ViewTransition>` стабилен в React 19.3, в App Router работает без конфига, `<Link
   transitionTypes>`; без поддержки браузера просто не анимирует. Для shop это основной механизм `ScreenTransition`.
9. Sentry: `@sentry/nextjs` 11.7.0 (мажор 11 от 2026-09-23). v11 по умолчанию шлёт **span streaming**; совместимость
   GlitchTip с этим не подтверждена → для GlitchTip `traceLifecycle: 'static'` (или только ошибки). `withSentryConfig`
   переехал в `@sentry/nextjs/config`. Turbopack поддержан.
10. Поиск: Meilisearch-клиент 0.62 ок, но `@meilisearch/instant-meilisearch` 0.31.4 имеет peer `meilisearch ^0.57`
    (несовместим с 0.62) → поиск на сервере через адаптер + nuqs, без InstantSearch.

## Findings

### 0. Метод
- Факты: `registry.npmjs.org` (версия latest, дата, peers), unpkg-исходники пакетов, `next@16.4.1/dist/docs` (доки,
  поставляемые с пакетом), блоги nextjs.org / react.dev, MIGRATION.md Sentry, README пакетов. GitHub API недоступен
  (rate limit, нет `gh`) — звёзды/issues не сняты, «здоровье» оценено по частоте релизов npm.
- Мнения помечены «мнение».

### 1. Сводная таблица

| Технология | Выбор + точная версия | Дата релиза | Здоровье | Риск breaking за 12 мес. | Вердикт | Источник |
| --- | --- | --- | --- | --- | --- | --- |
| Next.js | `next` 16.4.0 (пин; latest 16.4.1) | 16.4.0 — 2026-10-06; 16.4.1 — 2026-10-14 | минор ~раз в 2–4 мес., патчи еженедельно; canary 16.5.0-canary.11 | высокий: Next 17 (дата не объявлена) сделает Cache Components дефолтом; мы уже на них | брать | https://nextjs.org/blog/next-16-4 |
| Cache Components | `cacheComponents: true`, `partialPrefetching: true`, `ensureStatic`, `cacheTag`, `navigation()`/`prefetch()` | stable с 16.0.0 (2025-10-22); `ensureStatic` 16.4 | ядро Next | средний: новые API 16.3–16.4 молодые | брать | `dist/docs/.../cacheComponents.md` |
| `cacheHandlers` (Redis) | свой handler по `examples/cache-handler-redis`; запасной `@trieb.work/nextjs-turbo-redis-cache` 1.18.1 | trieb — 2026-09-24 | официальный пример поддерживается командой Next; trieb активен | средний: сериализация `segmentData` уже ломалась в 16.3 | брать (опция `multi-instance`) | https://github.com/vercel/next.js/tree/canary/examples/cache-handler-redis |
| `@fortedigital/nextjs-cache-handler` | 3.3.0 | 2026-08-12 | активен | — | **не брать**: нет `cacheHandlers`/`'use cache'` | README пакета на unpkg |
| `@neshca/cache-handler` | 1.9.0 | 2024-11-26 | заброшен, peer next < 15 | — | **не брать** | npm |
| React (ядро) | `react`/`react-dom` 19.3.0 в catalog (19.3.1 от 2026-10-14 — после порога) | 19.3.0 — 2026-09-09 | минор раз в ~6–10 мес. + бэкпорт-патчи 19.0–19.2 | низкий: React 20 не анонсирован (в блоге 19.3 упоминаний нет) | брать | https://react.dev/blog/2026/09/09/react-19-3 |
| React в App Router | vendored `19.3.0-canary-278794d7-20261002` внутри next 16.4.0 и 16.4.1 | — | так устроено с Next 13 | постоянный: canary-фичи могут работать в shop и падать в Vite-шаблонах | kit писать на stable API | `unpkg.com/next@16.4.1/dist/compiled/react` |
| Turbopack + Tailwind | `@tailwindcss/postcss` 4.3.3, `tailwind-variants` 3.3.1 (+ `tailwind-merge` ≥ 3, latest 3.7.0) | 2026-07-16 / 2026-08-03 | стабильно | низкий | брать; kit через `transpilePackages` + `@source` | Next docs `turbopack.md` |
| UI kit | `@base-ui/react` 1.9.0 | 2026-10-09 | минор ежемесячно с 1.0 (2025-12-11) | средний (молодой 1.x, но semver) | брать | npm |
| URL-состояние | `nuqs` 2.10.2 | 2026-10-08 | активен | низкий | брать; парсить searchParams снаружи, передавать значения аргументами в `'use cache'` | npm |
| Клиентское состояние | `mobx` 7.0.6 + `mobx-react-lite` 5.1.0 | 2026-10-02 / 2026-09-24 | мажор 7 от 2026-07-30, патчи частые | средний: свежий мажор (удалены `observable.ref` → `observableRef` и т. п.) | брать, только в client-компонентах | `unpkg.com/mobx-react-lite@5.1.0/CHANGELOG.md` |
| Серверное состояние (клиент) | `@tanstack/react-query` 5.104.2 | 2026-10-11 | очень активен | низкий (v6 не анонсирован — не проверял) | брать для мини-корзины/автокомплита | npm |
| Commerce backend | Medusa `@medusajs/medusa` 2.21.2 | 2026-09-28 | минор каждые 3–6 недель | **высокий**: breaking в минорах (2.19 Node ≥ 20.19, 2.20 relations limit, search-local удалён) | брать как эталон, exact pin | https://newreleases.io/project/github/medusajs/medusa/release/v2.20.0 |
| Клиент Medusa | `@medusajs/js-sdk` 2.21.2 (+ `@medusajs/types` для типов) | 2026-09-28 | в lockstep с бэкендом | как у Medusa | брать вместо генерации из OpenAPI | npm, `dist/esm/types.d.ts` |
| ЮKassa | `@gorgo/medusa-payment-yookassa` 2.0.4 (плагин бэкенда) | 2026-09-24 | 13 релизов с 2026-06; Telegram-чат поддержки | средний: peer `@gorgo/medusa-integration <1.0` | брать (на стороне Medusa) | https://github.com/gorgojs/medusa-integrations |
| Stripe (фронт) | `@stripe/stripe-js` 10.0.0, `@stripe/react-stripe-js` 7.0.0 | 2026-10-01 / 2026-10-01 | мажор раз в ~6 мес. (9.0 — 2026-03-26) | высокий: вероятен 11.x весной 2027 | брать для Payment Element | npm |
| Формы | `react-hook-form` 7.90.0 + `@hookform/resolvers` 5.9.1 + `zod` 4.6.7 | 2026-10-11 / 2026-08-17 / 2026-10-12 | активно | **средний: RHF 8.0.0-beta.4 (2026-09-26)** — мажор вероятен в 12 мес. | брать; схемы zod общие для client и Server Action | npm |
| i18n | `i18next` 26.4.4 + `react-i18next` 17.0.16 + `next-i18next` 16.3.1 | 26.4.5 — 2026-10-14; next-i18next — 2026-09-13 | активно | низкий | **брать next-i18next 16** (App Router, root-params) | README `next-i18next@16.3.1` |
| next-intl | 4.14.9 | 2026-10-02 | активен | — | не брать (решение пользователя; техпричины больше нет) | npm |
| Переходы | React `<ViewTransition>` + `<Link transitionTypes>`; `motion` 14.x для микро | VT stable в 19.3; motion 14.0.0 — 2026-10-02, 14.2.0 — 2026-10-13 | — | motion: 3 мажора за 14 мес. (12→13→14) — высокий | брать VT как основу; motion пинить 14.0.x/14.1.x | `dist/docs/01-app/02-guides/view-transitions.md` |
| Поиск | `meilisearch` 0.62.0 (серверный клиент в адаптере) | 2026-09-09 | минор ~ежемесячно, 0.x | средний (0.x) | опция `search`; без InstantSearch | npm |
| InstantSearch-мост | `@meilisearch/instant-meilisearch` 0.31.4 | 2026-09-16 | отстаёт: peer `meilisearch ^0.57` | — | не брать | npm |
| Медуза ↔ Meili | `@rokmohar/medusa-plugin-meilisearch` 2.3.1 (бэкенд) | 2026-10-03 | комьюнити, peer `@medusajs/medusa ~2.21.1` (тильда) | высокий (жёсткая привязка к минору) | решение бэкенда; фронту не нужно | npm |
| Изображения | `next/image` + `sharp` 0.35.5 (optional dep next) | 2026-09-27 | — | низкий | брать; образ glibc (`node:24-slim`) | next `package.json` |
| E2E | `@playwright/test` 1.64.0 (1.64.1 — 2026-10-14) + `@axe-core/playwright` 4.13.0 | — | ежемесячно | низкий | брать, против `COMMERCE_PROVIDER=mock` | npm |
| MSW | `msw` 3.0.3 | 2026-10-10 | активен | низкий | только клиент/Vitest; серверный fetch RSC не перехватывает (Next testmode в доках 16.4 отсутствует) | npm, `dist/docs` |
| Ошибки | `@sentry/nextjs` 11.6.x/11.7.0 + `@sentry/react` 11.7.0 | 11.0.0 — 2026-09-23; 11.7.0 — 2026-10-12 | мажор ~раз в год | средний (12 вероятен осенью 2027) | брать; GlitchTip → `traceLifecycle: 'static'` | https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md |
| Env | `@t3-oss/env-nextjs` 0.13.11 | 2026-03-22 | редкие релизы | низкий | опционально; можно свой `env.ts` на zod | npm |

### 2. Next 16.4 и Cache Components (кратко, детали у 17c)
- Факт: блог 16.4 — «Cache Components … will become the default in Next.js 17»; «Starting with Next.js 16.4, we're
  excited to recommend Cache Components as the best choice for every Next.js app»; `create-next-app` включает их по
  умолчанию. Включение: `cacheComponents: true` + `partialPrefetching: true`.
- Факт: `ensureStatic = 'navigation' | 'prefetch' | 'shell'` — сборка падает при динамике в маршруте (в посте прямо
  указано для e-commerce). `navigation()`/`prefetch()` из `next/cache` исключают части из prefetch.
- Факт: `cacheHandlers` стабилен с 16.0.0, `adapterPath` стабилен с 16.2.0 (для Docker не нужен).
- Факт: Node `engines >= 20.9.0`; `sharp ^0.35.5` — optional dependency next.
- Факт: в 16.4 `experimental.turbopackPluginRuntimeStrategy: 'workerThreads'` на Node ≥ 24.13.1 откатывается на
  процессы из-за бага Node — не включать.
- Факт: `experimental.turbopackAdditionalRoots` нужен только при pnpm global virtual store; при обычном
  `node_modules` в монорепо хватает `transpilePackages` + `outputFileTracingRoot`.
- Next 17: даты нет (поиск не нашёл анонса). Мнение: Next 15 (2024-10-21) и 16 (2025-10-22) вышли в октябре,
  16.x ещё получает миноры (16.5 canary) — 17 вероятен в ближайшие месяцы. Риск для нас: дефолты, удаление
  `unstable_cache`/старых флагов; `next upgrade --agent` есть.

### 3. Кэш в нескольких подах (что добавляет `commerce`/`multi-instance`)
- Факт (доки self-hosting 16.4): `revalidateTag` без общего хранилища инвалидирует только свой инстанс;
  координация — `refreshTags()` перед каждым запросом. Обязательны общий `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` и
  `deploymentId`. Durable-handler обязан сам сериализовать `Buffer` (`rscData`) и `Map` (`segmentData`) — иначе
  `segmentData.get is not a function` на prefetch.
- Факт: `@fortedigital/nextjs-cache-handler` 3.3.0, матрица: «`cacheHandlers` config … ❌ Not yet supported»,
  «`'use cache'` directive ❌», «`cacheComponents` ❌». Подходит только для ISR-ветки (`cacheHandler`), а с
  Cache Components основная масса данных идёт через `'use cache'` → пакет закрывает меньшую половину задачи.
- Факт: `@trieb.work/nextjs-turbo-redis-cache` 1.18.1: «Cache Components (Next.js 16+) are fully supported»,
  отдельный объект `redisCacheHandler` для `cacheHandlers`, синхронизация тегов Pub/Sub; протестирован до Next 16.3.0;
  peer `redis: "4.7.0"` (exact; актуальный `redis` 6.3.0), peer `next >=15.0.3 <17`.
- Факт: официальный `examples/cache-handler-redis` (README в canary): обе ветки, без сторонних адаптеров, `redis`
  клиент, `cacheMaxMemorySize: 0`, не подключается к Redis на `next build` (`NEXT_PHASE`), деградирует без Redis, но
  `revalidateTag`/`updateTags` бросают при недоступном Redis (намеренно). В примере подключён только `remote`
  handler — для shop нужно повесить его и на `default` (мнение).
- Мнение: брать свой handler (~2 файла) по официальному примеру в `packages/next-cache-redis` или внутри app,
  покрыть интеграционным тестом (2 инстанса + Redis в compose, вебхук → инвалидация на обоих). trieb — fallback,
  если свой не взлетит (но peer redis 4.7 конфликтует с другими пакетами, если они есть).

### 4. Данные и провайдеры
- Факт: `@medusajs/js-sdk` 2.21.2 — зависимости только `fetch-event-stream`, `qs`; auth `type: "jwt" | "session"`,
  `jwtTokenStorageMethod: "local" | "session" | "memory" | "custom" | "nostore"`. Версия совпадает с бэкендом.
- Факт: официальный `nextjs-starter-medusa` (main): `next 15.3.9`, `react 19.0.5`, `@stripe/stripe-js ^8.2`,
  `@medusajs/js-sdk: latest`; JWT в httpOnly cookie `_medusa_jwt` (`sameSite: strict`, 7 дней), заголовок
  `authorization: Bearer` собирается из cookie на сервере (`src/lib/data/cookies.ts`). Cache Components не использует.
- Мнение: внутри `commerce/medusa/` — `js-sdk` с `jwtTokenStorageMethod: 'nostore'`, токен передаётся заголовком
  на каждый вызов из cookie (`__Host-` по правилам 16); модульный инстанс SDK на сервере допустим, т. к. без
  состояния. Генерация из OpenAPI (Hey API) для Medusa не нужна: спеку надо бандлить из `$ref`, Hey API без 1.0, а
  SDK и типы обновляются вместе с бэкендом. Общий Hey API остаётся для прочих бэкендов (admin, site).
- Факт: Medusa 2.20 — «Store API routes now enforce a default relations limit», удалён `@medusajs/search-local`,
  появился `@medusajs/search-postgres` и провайдерная модель поиска. 2.19 — Node ^20.19 / ^22.12. → в адаптере
  явные `fields`, контрактный nightly-тест против staging Medusa (ловит breaking минора).
- Факт: Stripe-провайдер Medusa — вебхуки `payment_intent.*`, путь `{server_url}/hooks/payment/stripe_stripe`; про
  Checkout Sessions в доке ничего → это PaymentIntents + Payment Element на нашей странице.
- Факт: ЮKassa-плагин — одно/двухстадийная оплата, возвраты, вебхуки с проверкой подписи, чеки 54-ФЗ (ФФД 1.05/1.2),
  пример Next-storefront в репозитории gorgojs, конфиг через Admin (Integration module).
- Мнение (`PaymentStep`): `redirect` (ЮKassa `confirmation_url`, Shopify `checkoutUrl`) — дефолт для RU; `embedded`
  (Stripe Payment Element, `@stripe/react-stripe-js` 7) — дефолт для international с Medusa. «Hosted по умолчанию»
  формулировать как «платёжные данные никогда не проходят через наш код» (iframe Stripe тоже это даёт, PCI SAQ A).

### 5. Состояние: MobX в RSC-приложении
- Факт: mobx-react-lite 5: `enableStaticRendering(true)` для SSR сохраняется; удалены `useObserver`,
  `useLocalStore`, `useStaticRendering`; 5.1.0 чистит реакции из незакоммиченных (suspended) рендеров — важно для
  Suspense/стриминга. MobX 7 — только Proxy, без legacy-декораторов (совпадает с решением «без декораторов»).
- Мнение (правила): `enableStaticRendering(typeof window === 'undefined')` в одном `'use client'`-модуле провайдеров;
  стор создаётся в `useState(() => new CartUiStore(initial))` внутри клиентского провайдера — на запрос/на вкладку, не
  модульный синглтон (иначе утечка между пользователями при SSR). RSC MobX не импортируют (lint). Корзина: confirmed
  state — сервер (RSC/Query), MobX — только UI (drawer, optimistic intent).

### 6. i18n: i18next в RSC + Cache Components (проверено по исходнику)
- Факт: README next-i18next 16.3.1: «On Next.js 16.3+ `getT()` resolves the language from the `[lng]` root param (via
  `next/root-params`)… Reading a root param does not opt the route out of static prerendering, so `getT()` is safe in
  prerendered routes (including with `cacheComponents: true`). Route Handlers and Server Actions have no root params —
  pass `{ lng }` explicitly there.»
- Факт: режим `localeInPath: 'internal'` — чистые URL + статический пререндер по локалям; `localeInPath: false`
  делает все маршруты динамическими (`headers()`/`cookies()`).
- Факт (исходник `dist/appRouter/server.mjs`): один `createInstance()` на процесс («module-level singleton that persists
  across requests»), язык определяется через `React.cache` (`detectLanguage`), перевод — фиксированный `t` по языку.
  Это безопасно: язык инстанса не переключается на запрос.
- Факт (`next-root-params.md`): root params недоступны в Client Components, Server Actions, Route Handlers; внутри
  `'use cache'` прочитанные root params входят в ключ (`use-cache.md`: «only the ones it actually reads become part
  of its cache key»); внутри `unstable_cache` — runtime error.
- Клиент: `I18nProvider` получает `getResources(i18n)` из layout. Next 16 `proxy.ts` (`createProxy`) — редирект,
  cookie; README предупреждает: изменённая cookie заставляет каждый Server Action ревалидировать страницу — cookie
  пишется только при смене языка.
- Вывод: решение пользователя «i18next везде» технически держится; next-intl не нужен. Формат каталогов — i18next JSON
  (общий `packages/i18n`). Валюта/регион — отдельно от языка, явным аргументом `ctx` в кэшируемых функциях.

### 7. Переходы и анимация
- Факт (React 19.3): `<ViewTransition>` stable; анимирует только Transition-обновления (startTransition, Suspense
  reveal, useDeferredValue); enter/exit/update/share; `addTransitionType`; исправлен краш в Mobile Safari.
- Факт (Next docs `view-transitions.md`): «View transitions work in the App Router with no configuration»;
  `<Link transitionTypes={['nav-forward']}>`, `router.push(..., { transitionTypes })`; «Without browser support, your
  application works normally; the transitions do not animate»; shared-element morph только если целевая страница
  рендерится в том же коммите (prefetched/cached) — аргумент за `'use cache'` на PDP.
- Мнение: в shop `ScreenTransition` = обёртка над `<ViewTransition>` (fade ~240 мс по токенам, slide по
  `transitionTypes`) + CSS-fallback из отчёта 16; Motion 14 только для микро (drawer, add-to-cart). Мастер-план
  «без View Transitions API из-за iOS < 18» для shop/site пересмотреть: деградация — мгновенная смена, это допустимо.
  Motion: 3 мажора за 14 месяцев — пинить минор.

### 8. Наблюдаемость (общий слой ядра)
- Факт (MIGRATION v10→v11): span streaming по умолчанию; откат `traceLifecycle: 'static'` («Transaction mode only
  exists for backwards compatibility and will be removed in a future major»); Node ≥ 20.19; Safari ≥ 15; Next ≥ 14;
  `withSentryConfig` → `@sentry/nextjs/config`; `@sentry/nextjs/loader` удалён (`node --import @sentry/nextjs/import`);
  `reactComponentAnnotation` работает и для Turbopack (Next 16+); совместим с self-hosted Sentry ≥ 26.4.2.
- GlitchTip 6.0 (2026-02-03) — о span streaming / SDK v11 в найденных источниках ничего. Мнение: для GlitchTip —
  ошибки + `traceLifecycle: 'static'` с низким sample rate; проверить smoke-тестом в волне 0. Риск: в Sentry 12
  transaction mode удалят → трейсинг в GlitchTip может отвалиться.
- `@sentry/react` 11.7.0: peer `react 17–19`, `react-router 6–8` — общий для Vite-шаблонов.

### 9. Деплой (что специфично для commerce)
- Standalone + `outputFileTracingRoot` на корень монорепо, копировать `.next/static` и `public`; образ glibc ради sharp.
- `multi-instance`: Redis (handler из §3), общий ключ Server Actions, `deploymentId` = SHA. Вебхук Medusa →
  `/api/revalidate` (HMAC) → `revalidateTag(tag, 'max')` (в Next 16 второй аргумент обязателен — по README fortedigital
  и докам) / `updateTag` в Server Action.
- Dev/CI: compose с Medusa + Postgres + Redis только для ручной проверки; CI — `mock`.

### 10. Тесты
- Playwright 1.64 против `COMMERCE_PROVIDER=mock` + axe; Vitest 5 для мапперов DTO → domain и денег. MSW 3 — только
  клиентские запросы; серверный fetch в RSC не перехватывается, а `testmode` в поставляемых доках 16.4 не найден
  (считать неподдерживаемым). Контрактный nightly против staging Medusa — обязателен из-за breaking в минорах.

## Recommendations for the boilerplate

1. Рамка: `commerce` — опция `site`; пресет `shop` = `site` + `auth-bff` + `commerce`. Отдельное Next-приложение
   shop — только по явному запросу (два Next, два набора обновлений).
2. Catalog на старте (с учётом `minimumReleaseAge` 7 дней): `next 16.4.0`, `react 19.3.0`, `@sentry/* 11.6.x` (11.7.0
   до 2026-10-19), `@stripe/stripe-js 10.0.0`, `@playwright/test 1.64.0`, `motion 14.0.x`; остальное — из таблицы.
3. Redis cache handler — свой по официальному примеру Next (обе ветки + `default`), тест на 2 инстанса; не брать
   fortedigital и neshca.
4. Medusa-адаптер на `@medusajs/js-sdk` (exact pin = версия бэкенда), явные `fields`, контрактный nightly.
5. `PaymentStep`: redirect (ЮKassa) и embedded (Stripe Payment Element через Medusa); Stripe Checkout redirect — не
   обещать без своего payment provider.
6. i18n: `next-i18next` 16.3 + `[lng]` root segment (или `localeInPath: 'internal'`), `lng` явно в Server Actions и
   Route Handlers; в мастер-плане заменить «серверный инстанс на запрос» на «один инстанс + `getFixedT` по языку».
7. MobX: стор в `useState` клиентского провайдера, `enableStaticRendering` на сервере, запрет импорта MobX в RSC.
8. Переходы: `<ViewTransition>` + `transitionTypes` + CSS-fallback; Motion — микро.
9. Sentry: `traceLifecycle: 'static'` при DSN GlitchTip (флаг из env), иначе streaming.
10. Поиск: опция `search` = Meilisearch-клиент на сервере за интерфейсом `search`; без InstantSearch.

### Что изменилось относительно мастер-плана
- shop → пресет `site + commerce` (по отчёту 16); Turbopack только у `site`.
- Redis: готовые пакеты (fortedigital/neshca) не подходят для `'use cache'` → свой handler по официальному примеру.
- i18next в shop подтверждён (next-i18next 16 + root-params), но «инстанс на запрос» → «один инстанс + fixed t».
- Hey API не для Medusa: официальный `js-sdk`; Medusa ломает API в минорах → exact pin + контрактный тест.
- «Без View Transitions API» неверно для Next: `<ViewTransition>` в App Router из коробки, деградация безопасна;
  Sentry 11 + GlitchTip требует `traceLifecycle: 'static'`.

## Open questions for the user
1. Международная оплата через Medusa = Stripe Payment Element на нашей странице (не redirect на Stripe Checkout).
   Допустимо, или нужен именно hosted redirect (тогда свой payment provider на стороне Medusa)?
2. Кто сопровождает Medusa и её обновления (миноры с breaking, плагины ЮKassa/Meilisearch привязаны к минору)?
