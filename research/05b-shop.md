# 05b. Шаблон `shop` (storefront на headless commerce)
Status: done
Updated: 2026-10-14 (финал)

## Resume notes
- Done: все разделы 0–12, рекомендации, сводная таблица, открытые вопросы.
- Next: — (отчёт завершён; при фиксации версий в boilerplate перепроверить breaking changes мажоров из раздела 0).
- Sub-agent: нет (запрещено задачей).

## Summary (≤ 15 lines)
1. Фреймворк: **Next.js 16.4 App Router + Cache Components** (`cacheComponents`, `partialPrefetching`, `ensureStatic`),
   `output: 'standalone'` в Docker. Альтернатива — TanStack Start 1.169 (единый Vite-тулчейн, но RSC ранние, нет ISR).
2. Next.js в нескольких подах требует: Redis `cacheHandler` + `cacheHandlers` с `refreshTags`/`updateTags`, общий
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, единый `deploymentId`. OpenNext для Docker не нужен.
3. Провайдер: слой-адаптер `packages`-уровня внутри шаблона (`src/commerce/` с интерфейсом `CommerceProvider`),
   эталонная реализация — **Medusa v2** (MIT, self-host, OpenAPI 3.0 store-спека 2.21.2 → `openapi-fetch`), второй
   адаптер — `mock` (in-memory) для e2e/Storybook. Shopify — опциональный адаптер (не работает для РФ).
4. Данные: чтение каталога в RSC через адаптер + `'use cache'` + `cacheTag`; корзина/аккаунт — мутации через
   Server Actions/route handler, клиент — TanStack Query только для мини-корзины и интерактива.
5. UI: Tailwind 4.3 + shadcn (CLI 4.21) на **Base UI** (`@base-ui/react` 1.9, дефолт shadcn с июля 2026); общий kit —
   чистые React-компоненты с `'use client'` пофайлово, без `next/*` импортов; `Link`/`Image` инжектируются.
6. Поиск/фильтры: провайдерский поиск по умолчанию; Meilisearch (MIT) как опция; URL-состояние — `nuqs` 2.10.
7. Формы: React Hook Form 7.90 + Zod 4.6; чекаут — платёж через провайдера (Medusa payment providers: Stripe,
   YooKassa-плагин; Shopify — hosted checkout). Embedded Stripe Payment Element — по флагу.
8. i18n: `next-intl` 4.14 (RSC, `next/root-params`, cache-ключи) — расходится с i18next других шаблонов; общий формат
   каталогов — ICU JSON. Валюта — от провайдера (регион/market), форматирование через `Intl`.
9. Тесты: Vitest 5 + RTL, Playwright 1.64 против `COMMERCE_PROVIDER=mock`; MSW 3 — для unit/компонентов; серверные
   fetch в Next MSW не перехватывает без experimental testmode.
10. Аналитика: слой событий GA4-совместимой схемы (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`) +
    consent; адаптеры GTM / self-hosted PostHog / Яндекс Метрика. `purchase` — на стороне провайдера/вебхука.
11. Жертвуем: игровой анимацией, offline/PWA. Motion 14 — только микровзаимодействия; View Transitions (React 19.3).

## Findings

### 0. Версии (проверено `curl registry.npmjs.org/<pkg>/latest`, 2026-10-14)

next 16.4.0 (вышел 2026-10-06; canary 16.5.0-canary.10) · react/react-dom 19.3.0 · @tanstack/react-start 1.169.1 ·
react-router 8.4.0 (v7: 7.18.4) · astro 7.3.8 · @shopify/hydrogen 2026.10.1 · @shopify/storefront-api-client 2.0.1 ·
@medusajs/js-sdk 2.21.2 · @vendure/core 3.8.0 · @commercetools/platform-sdk 9.7.0 · @saleor/app-sdk 1.16.0 ·
openapi-fetch 0.17.0 · openapi-typescript 7.13.0 · gql.tada 1.11.4 · @graphql-codegen/cli 7.4.6 ·
@tanstack/react-query 5.104.2 · tailwindcss 4.3.3 · shadcn (CLI) 4.21.4 · radix-ui 1.8.1 · @base-ui/react 1.9.0 (MIT) ·
nuqs 2.10.2 (MIT) · meilisearch 0.62.0 (MIT, JS-клиент) · typesense 3.1.1 (Apache-2.0, JS-клиент) · algoliasearch
5.60.0 · react-instantsearch 7.52.0 · react-hook-form 7.90.0 · @tanstack/react-form 1.33.5 · zod 4.6.7 ·
@stripe/stripe-js 10.1.0 · @stripe/react-stripe-js 7.0.0 (peer: stripe-js >=10 <11, react <20) · next-intl 4.14.9
(peer: next ^12…^16) · next-i18next 16.3.1 · i18next 26.4.4 · react-i18next 17.0.16 · motion 14.2.0 · vitest 5.0.4 ·
@playwright/test 1.64.0 · msw 3.0.3 · @mswjs/http-middleware 0.10.3 · posthog-js 1.438.9 · @next/third-parties 16.4.0 ·
@t3-oss/env-nextjs 0.13.11 · @opennextjs/aws 4.1.10 · @opennextjs/cloudflare 1.20.11 ·
@fortedigital/nextjs-cache-handler 3.3.0 · @neshca/cache-handler 1.9.0.

Мажоры сдвинулись относительно «знаний по памяти» (react-router 8, astro 7, motion 14, vitest 5, msw 3, i18next 26,
stripe-js 10) — при фиксации версий в boilerplate перепроверить breaking changes каждого.

### 1. Meta-framework и рендеринг

**Факты (проверено):**
- Next.js 16.4 (https://nextjs.org/blog/next-16-4): Cache Components (`cacheComponents: true` + `partialPrefetching:
  true`) рекомендованы для всех приложений и включены по умолчанию в `create-next-app`; станут дефолтом в Next 17.
  Новое: `export const ensureStatic = 'navigation' | 'prefetch' | 'shell'` — build падает, если в маршрут попал
  динамический компонент (в посте прямо названо для e-commerce); `navigation()`/`prefetch()` из `next/cache` —
  исключить тяжёлые части из prefetch. Поставляется с React 19.3 (стабильные View Transitions, Fragment Refs).
  `experimental.turbopackAdditionalRoots` — для linked packages / pnpm global virtual store.
- Self-hosting (https://unpkg.com/next@16.3.8/dist/docs/01-app/02-guides/self-hosting.md):
  - `next/image` работает в `next start` без конфигурации (sharp); для glibc-образов — рекомендация по аллокатору
    памяти sharp; можно отдать оптимизацию внешнему loader (imgproxy) через `images.loaderFile`;
  - по умолчанию серверный кэш в памяти/на диске каждого инстанса; `revalidateTag()` инвалидирует **только инстанс,
    где вызван** — остальные поды отдают устаревшее;
  - `cacheHandler` (ед. число) — ISR, route handlers, оптимизированные изображения, вместе с `cacheMaxMemorySize: 0`;
    `cacheHandlers` (мн. число, стабильно с v16.0.0) — бэкенды для `'use cache'` (`default`), `'use cache: remote'`
    (`remote`) и именованных `'use cache: <name>'`; `'use cache: private'` не настраивается;
  - интерфейс `CacheHandler` (`next/cache`): `get(key, softTags)`, `set(key, pendingEntry)`, `refreshTags()` (раз на
    запрос — синхронизация тегов из общего хранилища), `getExpiration(tags)`, `updateTags(tags)`; в доках есть пример
    Redis-координации тегов (https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers).
    Eviction — на обработчике (TTL из `expire`); `get()` обязан ловить свои ошибки и возвращать `undefined`, иначе
    ошибка рендера;
  - на всех инстансах обязателен одинаковый `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (иначе «Failed to find Server
    Action») и один build ID (`generateBuildId` или `deploymentId`; последний даёт skew protection: `?dpl=` на ассетах
    и заголовок `x-deployment-id`, при расхождении — hard navigation);
  - runtime env: всё кроме `NEXT_PUBLIC_*` читается в рантайме; в App Router перед чтением `process.env` при
    динамическом рендере — `await connection()`; так один образ продвигается по окружениям. `NEXT_PUBLIC_*`
    инлайнится на build — в образ не класть окружение-зависимые публичные значения, отдавать их с сервера;
  - стриминг за nginx: заголовок `X-Accel-Buffering: no`; `after()` и graceful shutdown по SIGTERM поддерживаются
    (рекомендуемый drain 10–30 с);
  - Adapters API (`adapterPath`) — для платформ (PPR на CDN). В найденных источниках adapters помечены alpha
    (Next 15.4 / 16 beta), статус stable **не подтверждён**. Для Docker не нужен.
- OpenNext (`@opennextjs/aws`, `@opennextjs/cloudflare`) — под AWS Lambda / Cloudflare Workers. Для Docker/k8s не
  нужен: путь — `output: 'standalone'` + `node server.js`.
- React в Next: `next@16.4.0` peerDependencies `react ^18.2.0 || ^19.0.0`, но App Router рендерит встроенной сборкой
  `next/dist/compiled/react` — в 16.4.0 это **`19.3.0-canary-278794d7-20261002`** (проверено в пакете на unpkg).
  Установленный `react@19.3.0` используется Pages Router и тестами, но не App Router.
- Референс Vercel Shop (https://vercel.shop/llms.txt, обновлено 2026-10-08): открытый Next.js-шаблон для Shopify,
  beta; использует **framework-agnostic preview-SDK `@shopify/hydrogen`** (Hydrogen переписывается вместе с Vercel,
  https://vercel.com/blog/vercel-and-shopify-are-rebuilding-hydrogen). Паттерны, которые стоит перенять независимо от
  провайдера: публичные данные — Cache Components + теги, инвалидация вебхуком `POST /api/webhooks/shopify` с
  проверкой подписи (без секрета эндпоинт отдаёт 404); фильтры/поиск кэшируются только если все входы в ключе;
  корзина/сессия/кастомер — никогда в публичном кэше; мутации корзины через route handler `/api/cart`, а не Server
  Actions; URL — источник истины для фильтров; «confirmed state» корзины отдельно от optimistic intent; i18n
  опционально через next-intl; валюта приходит от провайдера, `locale` только форматирует. Шаблон заточен под деплой
  на Vercel (BotID, Vercel Analytics) — как код-референс годится, как основа — нет.
- TanStack Start 1.169.1: v1 RC с конца 2025; RSC добавлены в апреле 2026 («isomorphic-first», без `'use server'`),
  обозреватели называют их ранними (https://react.test.cooperpress.com/issues/470,
  https://blog.logrocket.com/?p=214242). Нет тегового серверного кэша/ISR уровня Next — HTML-кэш на CDN/`Cache-Control`.
- React Router 8.0.0 вышел 17 июня 2026 (latest 8.4.0): ESM-only, `react-router-dom` удалён, middleware по умолчанию;
  RSC в framework mode — `unstable_reactRouterRSC` поверх экспериментального `@vitejs/plugin-rsc`; в 8.3.0 закрыт
  CSRF-обход в unstable RSC (https://remix.run/blog/react-router-v8,
  https://reactrouter.com/8.3.0/how-to/react-server-components.md). Классический Hydrogen = RR framework mode + Oxygen.
- Astro 7.3.8 — острова; React-компоненты kit работают как islands (`client:*`), но корзина/фильтры/аккаунт — это
  много интерактива, общее состояние между островами (мини-корзина + PDP) уходит в nanostores.

**Мнение:** shop = Next.js 16.4 + Cache Components. Единственный кандидат со стабильными RSC и частичным
пререндером: статичный shell PDP/PLP из кэша + динамические наличие/персональная цена/корзина стримом в одном ответе
(хорошо для LCP/TTFB), тег-инвалидация по вебхуку, `ensureStatic` как гард SEO-страниц, самый большой пул
commerce-референсов (Vercel Shop, Medusa starter, Saleor storefront). Цена — сложность self-host в нескольких подах
(раздел 11) и vendored canary React. Альтернатива — TanStack Start, если важнее единый Vite-тулчейн с admin/TMA, а
SEO-страниц мало. React Router 8 / Hydrogen classic — только при жёстко Shopify. Astro — оставить шаблону `landing`.

### 2. Headless commerce: провайдеры и слой-адаптер

**Факты:**
- **Medusa v2** (`@medusajs/medusa` 2.21.2, MIT, Node, self-host): store API — REST; в репозитории лежит OpenAPI 3.0
  спека store API версии 2.21.2 (`www/apps/api-reference/specs/store/openapi.yaml`, разбита на `$ref`-файлы —
  перед генерацией бандлить через `redocly bundle`; проверено curl). Запросы к store API требуют заголовок
  `x-publishable-api-key`; аутентификация покупателя — `POST /auth/customer/emailpass` → JWT (`Authorization: Bearer`)
  или сессия `connect.sid` (https://docs.medusajs.com/api/store). Официальный Next.js starter (product, cart, checkout,
  accounts, Stripe) — https://docs.medusajs.com/resources/nextjs-starter; в README отмечено переименование env
  (`NEXT_PUBLIC_MEDUSA_BACKEND_URL` больше не используется — сверять с `.env.template`). Есть плагин ЮKassa для v2:
  старый `medusa-payment-yookassa` deprecated, преемник `@gorgo/medusa-payment-yookassa` (чеки 54-ФЗ, одно/двухстадийная
  оплата, вебхуки; https://unpkg.com/medusa-payment-yookassa@1.0.2/README.md) — версию преемника не проверял.
- **Shopify Storefront API** (GraphQL, версии по датам, напр. 2026-04): для реальных покупателей нет фикс. лимита
  RPS, у tokenless-доступа лимит сложности запроса 1000, нужен корректный buyer IP header
  (https://shopify.dev/docs/api/storefront/2026-04). Checkout — hosted (`cart.checkoutUrl`); Customer Account API —
  отдельный OAuth (PKCE) endpoint. Сторонние цифры лимитов противоречат друг другу — не опираться. Shopify не
  обслуживает РФ с 2022 (общеизвестно, в этой сессии не перепроверялось).
- **Vendure** 3.8 (NestJS, GraphQL): лицензия ядра с 2024 — GPLv3 + коммерческая (Vendure Platform); storefront,
  работающий через GraphQL API, под GPL не подпадает (https://raw.githubusercontent.com/vendurehq/vendure/HEAD/README.md,
  https://vendure.io/blog/license-change-announcement).
- **Saleor** (Python, GraphQL, BSD-3; по памяти) — есть официальный Next.js storefront; **commercetools** — SaaS
  enterprise, REST+GraphQL, `@commercetools/platform-sdk` 9.7.0; дорого, для boilerplate как референс избыточен.
- **Next.js Commerce** (vercel/commerce): оптимизирован под Shopify, другие провайдеры подключаются форком с заменой
  `lib/shopify` (https://docsearch.algolia.com/mcp/docs/repo/vercel/commerce) — т.е. «адаптер» там — это просто
  папка с функциями, без формального интерфейса. Новый Vercel Shop — Shopify-only.

**Рекомендуемый дизайн адаптера (мнение):**

```
apps/shop/src/commerce/
  types.ts          // доменные типы: Product, Variant, Money{amount: string, currencyCode}, Cart, CartLine,
                    // Collection, Facet, SearchResult, Customer, Order, Region/Market, CheckoutSession
  provider.ts       // interface CommerceProvider
  index.ts          // getCommerce(): выбор по env COMMERCE_PROVIDER = 'medusa' | 'mock' | 'shopify'
  medusa/           // эталон: openapi-fetch клиент из store OpenAPI + мапперы DTO -> domain
  mock/             // in-memory фикстуры, детерминированные; для e2e, Storybook, dev без бэкенда
  shopify/          // опционально, удаляется init-скриптом, если не выбран
```

Интерфейс по capability-группам (провайдер может не поддерживать часть — тогда `capabilities` флаги, а не throw):
`catalog` (`getProduct(handle, ctx)`, `listProducts(query, ctx)`, `getCollection`, `listFacets`), `search`,
`cart` (`getCart(id)`, `createCart`, `addLines`, `updateLines`, `removeLines`, `applyPromo`), `checkout`
(`startCheckout(cartId) -> {kind: 'redirect', url} | {kind: 'embedded', provider: 'stripe' | 'yookassa', clientSecret
| confirmationToken}`), `customer` (`login`, `logout`, `getMe`, `listOrders`), `regions`/`markets`, и
`webhooks.parse(request) -> {tags: string[]}` — чтобы роут `/api/revalidate` был провайдер-независимым. Контекст `ctx`
= `{locale, regionId|country, currency}` всегда явным аргументом (идёт в cache key). Деньги — строка/minor units, не
float. Все DTO провайдера не выходят за пределы папки адаптера (ESLint `no-restricted-imports`).

Эталон — **Medusa**: совпадает с решением «внешний API по OpenAPI», self-host в Docker рядом (своего бэкенда мы не
пишем — Medusa разворачивается как внешний сервис), MIT, работает для РФ/СНГ (ЮKassa), даёт регионы/валюты,
customer accounts, promotions. Риск: Medusa — отдельный Node-сервис + Postgres + Redis, кто-то должен его
эксплуатировать; при Shopify-клиенте адаптер shopify придётся довести самим (или взять Vercel Shop как источник).

### 3. Data layer

**Мнение (с опорой на факты из разделов 1–2):**
- Каталог/PDP/PLP/контент — чтение на сервере в RSC через адаптер; функции адаптера оборачиваются в `'use cache'` +
  `cacheLife('hours')` + `cacheTag('product:<id>', 'collection:<id>')`; вебхук провайдера → `revalidateTag`.
  TanStack Query на этих страницах не нужен.
- Корзина: `cartId` в httpOnly cookie; чтение корзины — динамическая часть страницы (в `Suspense`, не в
  `'use cache'`); мутации — Server Actions (Medusa) или route handler (как в Vercel Shop) + `useOptimistic` для
  мгновенного UI; держать confirmed state и optimistic intent раздельно. Server Actions требуют общего ключа шифрования
  в multi-pod (раздел 1).
- TanStack Query 5.104 — для клиентского интерактива: мини-корзина в шапке, автокомплит поиска, «наличие в
  магазинах», аккаунт. Совпадает с admin/TMA (единые правила query layer из `docs/architecture.md`). Правило
  «серверные данные только через query layer» для shop формулируется как «через адаптер + `'use cache'` на сервере
  или TanStack Query на клиенте; ручные fetch в компонентах запрещены».
- Типизированные клиенты: REST/OpenAPI — `openapi-typescript` 7.13 + `openapi-fetch` 0.17 (тот же стек, что для
  admin/TMA с OpenAPI-бэкендом — общий пакет `packages/api-client-utils` возможен). GraphQL (Shopify/Saleor/Vendure) —
  `gql.tada` 1.11 (без кодгена, типы из схемы через TS-плагин) или `@graphql-codegen/cli` 7.4 client-preset; для
  Shopify — встроенный `gql` из `@shopify/hydrogen` (типы выводятся из документа, по Vercel Shop). Предпочтение:
  gql.tada — меньше шагов сборки.
- Env-валидация: `@t3-oss/env-nextjs` 0.13 + zod — с учётом правила «runtime env только на сервере».

### 4. Стилизация и UI kit

**Факты:** Tailwind 4.3.3 (CSS-first `@theme`, токены как CSS variables). shadcn CLI 4.21: с 3 июля 2026 новые проекты
по умолчанию на **Base UI** (`npx shadcn init -b radix` — чтобы остаться на Radix); пакет `@base-ui/react` (старое
имя `@base-ui-components/react` deprecated); миграция Radix → Base UI: `asChild` → `render`, структура
Positioner/Popup (https://blog.openreplay.com/shadcn-ui-radix-base-ui-switch/ — сторонний блог,
https://www.pkgpulse.com/guides/shadcn-ui-vs-base-ui-vs-radix-components-2026).

**Мнение и правила для общего kit в монорепо:**
- `packages/ui` — исходники TSX (без сборки), потребляются через `transpilePackages: ['@repo/ui', '@repo/tokens']`
  в Next; Vite-шаблоны берут исходники напрямую. Tailwind v4 в приложении: `@import '@repo/tokens/theme.css';` и
  `@source '../../packages/ui/src';` — иначе классы kit не попадут в CSS.
- RSC-совместимость: каждый интерактивный компонент — свой файл с `'use client'` первой строкой; **нельзя** ставить
  `'use client'` на barrel `index.ts` (всё станет клиентским) и нельзя barrel без него реэкспортировать hooks-код в
  RSC без директив. Презентационные (Badge, Price, Card-обёртки, Typography) — без директивы, работают и в RSC, и в
  SPA. Экспорт через `package.json#exports` пофайлово (`"./button": "./src/button/button.tsx"`) — меньше бандл и нет
  проблем с директивами.
- Kit не импортирует `next/link`, `next/image`, `react-router`: ссылки — через `render`-prop Base UI / `asChild` или
  `LinkComponent` из контекста (`UiProvider`), картинки — `ImageComponent` пропом/контекстом. Тогда kit общий для
  Next shop и Vite-шаблонов.
- Base UI vs Radix: для нового монорепо — Base UI (дефолт shadcn, один пакет, активная разработка, MIT); Radix
  оправдан, только если переносится существующий Radix-kit.
- Commerce-специфичные компоненты (ProductCard, PriceTag с `Intl.NumberFormat`, VariantPicker, QuantityStepper,
  FacetList) — в `apps/shop/src/shared/ui` или `packages/ui-commerce`, не в базовом kit.

### 5. Поиск, фильтры, фасеты

- Провайдерский поиск: Medusa store API — базовый `q` по товарам; для фасетов/опечаток/ранжирования Medusa
  официально интегрируется с Meilisearch/Algolia (по памяти; проверить актуальный плагин для v2). Shopify — Search &
  Discovery даёт фасеты в Storefront API (`productFilters`), по Vercel Shop.
- Внешние движки: **Meilisearch** (JS-клиент 0.62, MIT; self-host в Docker; фасеты, typo tolerance; проверить, какие
  фичи в BUSL Enterprise Edition — по памяти, не проверено), **Typesense** (клиент 3.1.1 Apache-2.0, сервер GPLv3,
  self-host), **Algolia** (SaaS, `algoliasearch` 5.60 + `react-instantsearch` 7.52; лучший DX, дорого, данные за
  рубежом).
- URL-состояние: `nuqs` 2.10 (peer: next >=14.2, react-router 5–8, @tanstack/react-router 1) — один и тот же парсер
  фильтров годится для shop и admin. На PLP фильтры читаются на сервере (`createSearchParamsCache`/`createLoader`),
  `shallow: false` для серверной перерисовки; результаты — внутри `Suspense`, shell страницы статичен.
- SEO: canonical для отфильтрованных URL, `noindex` для комбинаций фильтров, кроме «посадочных» (например, бренд +
  категория); сортировка параметров в URL детерминирована (иначе кэш-промахи).

**Рекомендация:** по умолчанию — поиск провайдера за интерфейсом `search` адаптера; Meilisearch — опциональный
адаптер поиска (init-флаг). Algolia — только если заказчик платит и нет ограничений по хранению данных.

### 6. Формы, чекаут, платежи

- Формы: React Hook Form 7.90 + `@hookform/resolvers` + Zod 4.6 — совпадает с admin/TMA (одна библиотека форм в
  монорепо). TanStack Form 1.33 — сильнее с Server Actions (`useActionState`), но второй стандарт хуже первого.
  Server-side валидация в Server Action той же zod-схемой (схемы — в `packages/validation` при необходимости).
- Чекаут — **не пишем свой платёжный бэкенд**. Варианты в порядке простоты:
  1. hosted checkout провайдера (Shopify `checkoutUrl`) — PCI и платежи целиком у провайдера;
  2. checkout-шаги на нашем фронте (адрес, доставка, выбор метода), платёж через payment provider бэкенда commerce
     (Medusa создаёт payment session; фронт получает `clientSecret`/`confirmation_token`) и виджет платёжки;
  3. полностью кастомный Stripe Payment Element.
- Stripe: рекомендуемый API — Checkout Sessions; фронтенд-варианты: hosted redirect, embedded form, custom UI на
  Elements (`ui_mode: custom` добавлен 2025-03-31, `stripe.initCheckout`); в более новом гайде фигурирует
  `ui_mode: "elements"` и `CheckoutElementsProvider` — **точное имя для новых интеграций не подтверждено**
  (https://docs.stripe.com/payments/checkout-sessions,
  https://docs.stripe.com/changelog/basil/2025-03-31/add-checkout-session-custom-ui-mode,
  https://docs.stripe.com/payments/elements/build-a-payment-page). Пакеты `@stripe/stripe-js` 10.1 +
  `@stripe/react-stripe-js` 7.0. Создание сессии — на стороне commerce-бэкенда, не в нашем BFF.
- РФ/СНГ (кратко): ЮKassa (виджет `checkout-widget` или redirect на confirmation_url; плагин Medusa v2 — см. раздел 2),
  CloudPayments (JS-виджет), Т-Банк/Т-Касса — все с вебхуком на commerce-бэкенд; 54-ФЗ чеки формирует провайдер. На
  фронте — компонент `PaymentStep` с адаптерами под `{kind: 'redirect'|'embedded', provider}`. Stripe в РФ
  недоступен (общеизвестно).
- Express checkout (Apple/Google Pay) — через Stripe Express Checkout Element; Medusa даёт гайд
  https://docs.medusajs.com/resources/storefront-development/guides/express-checkout.
- Чекаут-страницы: полностью динамические, `noindex`, без `'use cache'`, CSP строже (раздел про безопасность — у
  агента 10).

### 7. i18n и мультивалютность

- `next-intl` 4.14.9: с Next 16.3 читает locale через `next/root-params` нативно — статический рендер без
  `setRequestLocale` и интеграция с `cacheComponents`; `[locale]` layout может быть root layout
  (https://next-intl.dev/blog/nextjs-root-params). Неофициальный skill Vercel Shop предупреждает: под
  `cacheComponents` не использовать `setRequestLocale` (делает рендер динамическим), при `app/layout.tsx` выше
  `app/[locale]/` `rootParams.locale()` = `undefined`, next-intl `Link` вместо `next/link` может давать prerender
  errors; `next/root-params` недоступен в Server Actions и Route Handlers — locale передаётся и валидируется явно
  (https://vercel.shop/llms.txt).
- i18next: `i18next` 26.4 / `react-i18next` 17.0 / `next-i18next` 16.3 (поддержка App Router — не проверял детально).
  В RSC i18next работает через отдельный серверный инстанс на запрос; интеграции с `next/root-params`/cache-ключами
  нет — придётся писать самим.
- **Мнение:** shop — next-intl (ICU MessageFormat). Остальные шаблоны на i18next → общий формат каталогов ICU JSON
  (`i18next-icu` в Vite-шаблонах) и общий скрипт проверки ключей. Общий kit текстов не содержит (правило «props
  only»), поэтому расхождение библиотек его не затрагивает. Альтернатива — i18next везде ради единообразия, ценой
  ручной интеграции с Cache Components.
- Валюта: берётся от провайдера по региону/market (Medusa region → currency; Shopify `@inContext(country, language)`).
  `locale` только форматирует (`Intl.NumberFormat`), конвертацию на фронте не делать. Регион/валюта — cookie + явный
  аргумент `ctx` во всех кэшируемых функциях (иначе отравление кэша чужой валютой). URL: `/{locale}/...`, регион —
  cookie или поддомен; язык и регион — разные селекторы.

### 8. Анимация

- `motion` 14.2 — только микровзаимодействия (добавление в корзину, drawer корзины, layout у фильтров); импорт
  `motion/react` в client-компонентах, `LazyMotion` + `domAnimation` для размера бандла. React 19.3 —
  стабильный `<ViewTransition>` (через Next 16.4) для переходов PLP → PDP (shared element изображения товара).
- Жертвуем: game-grade анимацией, параллаксами, offline/PWA (service worker кэш корзины опасен для консистентности
  цен). `prefers-reduced-motion` — обязательно.

### 9. Тестирование

- Vitest 5.0 + Testing Library — адаптеры (маппинг DTO → domain по фикстурам из реальных ответов), утилиты денег,
  client-компоненты. Async Server Components Vitest не рендерит — их покрывает e2e.
- Playwright 1.64 — e2e сценарии: PLP фильтр → PDP выбор варианта → add to cart → изменение количества → checkout до
  шага оплаты; аксессибилити через `@axe-core/playwright`. Сервер запускается с `COMMERCE_PROVIDER=mock`.
- MSW 3.0: в браузере/Vitest — для клиентских запросов. Серверные fetch App Router MSW из теста не перехватывает;
  Next даёт experimental `next/experimental/testmode/playwright` (+ `/msw`) с `next.onFetch` — экспериментально, есть
  жалобы на баги (https://safedep.io/end-to-end-test-nextjs-msw-playwright, https://zenn.dev/uyas/articles/bc58a4bed15ed4).
  Поэтому основной путь — `mock`-адаптер на уровне `CommerceProvider` (детерминированно, без сети); опционально —
  контрактный прогон против staging Medusa по ночам. Вариант с `@mswjs/http-middleware` (MSW как отдельный HTTP-сервер,
  на который указывает `MEDUSA_URL`) — если нужен тест именно HTTP-слоя адаптера.
- Платёжные виджеты в e2e не трогать (Stripe test mode — только ручной/ночной smoke).

### 10. Аналитика и consent

- Собственный тонкий слой `track(event)` со схемой GA4 e-commerce (`view_item_list`, `select_item`, `view_item`,
  `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`,
  `purchase`) — общий пакет `packages/analytics` для shop/landing/TMA; транспорты-адаптеры: GTM/GA4
  (`@next/third-parties` 16.4 `GoogleTagManager`), self-hosted PostHog (`posthog-js` 1.438) или Umami, Яндекс Метрика
  (электронная коммерция через `dataLayer`).
- `purchase` надёжнее слать с сервера (вебхук провайдера → Measurement Protocol / PostHog server) — клиент может не
  дойти до thank-you страницы. Vercel Shop делает server-side атрибуцию корзины по той же причине.
- Consent: без согласия трекеры не грузятся; для GA4 — Consent Mode v2 (по памяти — обязателен для EEA с 2024).
  Для РФ — 152-ФЗ: согласие на обработку ПДн, локализация, передача в зарубежные сервисы (GA) — юридический риск;
  дефолт для РФ — Метрика/self-hosted PostHog/Umami (мнение, требует юриста).
- Core Web Vitals: `useReportWebVitals` (next/web-vitals) → тот же `track`; сторонние скрипты — `next/script`
  `strategy="lazyOnload"`/после consent.

### 11. Docker-деплой

- `output: 'standalone'`, `outputFileTracingRoot` = корень монорепо (иначе workspace-пакеты не попадут в трассировку);
  в образе: `apps/shop/.next/standalone` (внутри путь `apps/shop/server.js`), плюс скопировать
  `apps/shop/.next/static` и `apps/shop/public` — standalone их не включает
  (https://nextjs.org/docs/app/api-reference/config/next-config-js/output). Известны проблемы pnpm-симлинков со
  standalone (https://github.com/vercel/next.js/discussions/38435, 2022; актуальность для 16.x не проверена) —
  smoke-тест образа в CI обязателен.
- Многостадийный Dockerfile: `node:<pinned>-slim` (glibc, для sharp), `corepack`/pnpm, `pnpm install --frozen-lockfile
  --filter shop...`, build, runtime-стадия non-root, `HOSTNAME=0.0.0.0`, `PORT=3000`, `NEXT_TELEMETRY_DISABLED=1`.
- Multi-pod: Redis для `cacheHandler` (ISR/изображения) и `cacheHandlers.default/remote` (`'use cache'`) с
  `refreshTags`/`updateTags`; готовые пакеты — `@fortedigital/nextjs-cache-handler` 3.3 (форк заброшенного
  `@neshca/cache-handler` 1.9), `@trieb.work/nextjs-turbo-redis-cache` 1.18 — **поддержку `cacheHandlers` (не только
  `cacheHandler`) у них проверить перед выбором**; иначе ~150 строк своего handler по примеру из доков Next.
  Общие `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `deploymentId` = git SHA. Single-pod/VPS — можно без Redis (кэш на
  volume `.next/cache`).
- CDN/кэш: `/_next/static/*` immutable на CDN; HTML с PPR — короткий `s-maxage` или без CDN-кэша (персональные части
  стримятся); `X-Accel-Buffering: no` в nginx/ingress, чтобы не ломать стриминг; изображения — `next/image` (sharp,
  кэш в Redis/volume) или внешний imgproxy через `loaderFile`.
- Env: один образ на все окружения — секреты и URL провайдера только серверные, читаются в рантайме; публичные
  значения (publishable key, GTM id) отдавать из server-компонента пропсами, а не через `NEXT_PUBLIC_*`, если образ
  продвигается между окружениями.
- Health: `app/api/health/route.ts` (liveness, без внешних вызовов) и `/api/ready` (readiness: ping провайдера и Redis с
  таймаутом); graceful shutdown по SIGTERM (Next дожидается in-flight и `after()`), `terminationGracePeriodSeconds`
  ≥ 30.
- Вебхук ревалидации: `POST /api/revalidate` с HMAC-проверкой подписи провайдера → `adapter.webhooks.parse` →
  `revalidateTag` (в multi-pod работает только с распределённым tag-хранилищем).

### 12. Что общее с другими шаблонами, а что расходится

| Аспект | Общее | Расходится / почему |
| --- | --- | --- |
| UI kit, токены | `packages/ui` (Base UI + Tailwind 4), `packages/tokens` | shop требует `'use client'` пофайлово, без `next/*` в kit; `transpilePackages` + `@source` |
| React | одна версия `react@19.3.x` в каталоге pnpm | App Router использует vendored `19.3.0-canary-…` внутри `next`; фичи canary могут работать в shop и не работать в Vite-шаблонах — kit писать на stable API |
| Сборщик | — | shop: Turbopack (Next); остальные: Vite. Разные конфиги, ESLint-плагины (`@next/eslint-plugin-next` только в shop) |
| Data | `openapi-fetch`/`openapi-typescript`, TanStack Query 5 (клиент), zod | shop читает в RSC + `'use cache'`, Query только для интерактива |
| Формы | RHF + zod | shop дополнительно Server Actions |
| URL state | `nuqs` (поддерживает Next, React Router, TanStack Router) | адаптер nuqs разный на приложение |
| i18n | ICU JSON каталоги, правила текстов | next-intl в shop vs i18next в остальных |
| Анимация | `motion`, токены длительностей/easing | — |
| Тесты | Vitest 5, Playwright 1.64, MSW 3 | RSC — только e2e; mock-адаптер провайдера |
| Аналитика | `packages/analytics` (`track` + транспорты) | e-commerce схема событий — специфика shop |
| Деплой | Docker, CI, healthcheck-конвенция | shop — Node-сервер (не статика за nginx), Redis для multi-pod |

## Recommendations for the boilerplate

1. **Брать** Next.js 16.4 App Router с `cacheComponents: true`, `partialPrefetching: true`, `output: 'standalone'`,
   `ensureStatic = 'shell'` на PLP/PDP и `'navigation'` на контентных страницах (политика, about) — как гард SEO.
2. **Брать** слой `CommerceProvider` с адаптерами `medusa` (эталон, openapi-fetch из store OpenAPI) и `mock`;
   `shopify` — опциональный (init-флаг), источник кода — Vercel Shop/Hydrogen SDK. DTO провайдера не выходят из
   папки адаптера (ESLint-гард). Контекст `{locale, region, currency}` — явный аргумент всех кэшируемых функций.
3. **Брать** кэш-контракт из Vercel Shop: публичное — `'use cache'` + теги + вебхук; фильтры — только с полным
   ключом; корзина/кастомер — никогда в публичном кэше; деньги — не float.
4. **Брать** готовый Redis cache handler (обе ветки: `cacheHandler` и `cacheHandlers` с `refreshTags`) в шаблоне, но
   включать по env (`CACHE_REDIS_URL`); без него — single-instance режим. В доках шаблона явно: общий
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `deploymentId`, `X-Accel-Buffering: no`.
5. **Брать** Base UI-вариант shadcn в общем kit; kit без `next/*`, `Link`/`Image` через провайдер компонентов;
   `'use client'` пофайлово, `exports` пофайлово, никаких barrel с директивами.
6. **Брать** RHF + zod, nuqs, TanStack Query (только клиент) — общие с admin/TMA.
7. **Брать** next-intl в shop + ICU-формат каталогов во всём монорепо (или вынести вопрос пользователю, см. ниже).
8. **Брать** checkout через провайдера: по умолчанию redirect/виджет payment provider'а commerce-бэкенда; Stripe
   Payment Element и ЮKassa-виджет — как два примера `PaymentStep`-адаптера.
9. **Брать** e2e на mock-адаптере + axe; не полагаться на experimental testmode Next для MSW.
10. **Брать** `packages/analytics` с GA4-схемой событий и consent-гейтом; серверный `purchase`.
11. **Избегать**: Vercel-специфики (`@vercel/*` analytics, BotID, ISR-на-Vercel допущений), OpenNext для Docker,
    `NEXT_PUBLIC_*` для окружение-зависимых значений, своего платёжного бэкенда, кэширования корзины, Algolia по
    умолчанию, тяжёлой анимации, PWA/offline для shop.
12. **Зафиксировать в правилах shop** (CLAUDE.md шаблона): где граница server/client, когда `'use cache'`, обязательный
    `cacheTag`, запрет `process.env` вне `env.ts`, запрет прямого fetch провайдера вне адаптера.

### Сводная таблица

| Потребность | Рекомендация | Альтернатива | Риск |
| --- | --- | --- | --- |
| Meta-framework / SSR/ISR | Next.js 16.4 App Router + Cache Components, standalone | TanStack Start 1.169 (SSR + CDN-кэш) | сложный multi-pod self-host; vendored canary React; Next 17 сменит дефолты |
| Кэш и ревалидация | `'use cache'` + `cacheTag` + вебхук → `revalidateTag`; Redis handler в multi-pod | single-pod с кэшем на volume | `revalidateTag` локален инстансу без `refreshTags`; готовые Redis-пакеты могут не поддерживать `cacheHandlers` |
| Commerce-провайдер | слой `CommerceProvider`, эталон Medusa v2 (OpenAPI, MIT) + mock | Shopify (Vercel Shop/Hydrogen SDK); Saleor/Vendure (GraphQL) | Medusa надо эксплуатировать отдельно; Shopify недоступен в РФ; Vendure GPLv3 |
| Типизированный клиент | openapi-typescript 7.13 + openapi-fetch 0.17 | gql.tada 1.11 / GraphQL Codegen 7.4 для GraphQL-провайдеров | спека Medusa разбита на `$ref` — нужен bundle-шаг |
| Клиентские данные | TanStack Query 5.104 (мини-корзина, автокомплит) | только Server Actions + `useOptimistic` | двойной источник правды корзины, если не разделить confirmed/optimistic |
| UI kit | Tailwind 4.3 + shadcn 4.21 на Base UI 1.9 | shadcn на Radix (`-b radix`) | `'use client'`/barrel-ошибки; часть shadcn-блоков ещё Radix-only |
| Поиск/фасеты | поиск провайдера за интерфейсом + nuqs 2.10 | Meilisearch (self-host) / Typesense / Algolia | кэш-промахи при недетерминированных URL; SEO-дубли фильтров |
| Формы | React Hook Form 7.90 + Zod 4.6 (+ Server Actions) | TanStack Form 1.33 | две схемы валидации, если не шарить zod |
| Чекаут/платежи | redirect/виджет payment provider commerce-бэкенда; Stripe Elements / ЮKassa как примеры | hosted checkout провайдера (Shopify) | имя `ui_mode` у Stripe для новых интеграций не подтверждено; плагины ЮKassa для Medusa — комьюнити |
| Auth покупателя | через адаптер (Medusa JWT/сессия в httpOnly cookie на нашем домене) | Shopify Customer Account API (OAuth PKCE) | токены нельзя класть в публичный кэш; CSRF для мутаций |
| i18n + валюта | next-intl 4.14 (root-params) + ICU каталоги; валюта от провайдера | i18next 26 везде | расхождение с остальными шаблонами; ловушки `setRequestLocale` под cacheComponents |
| Анимация | motion 14.2 (микро) + `<ViewTransition>` React 19.3 | только CSS transitions | лишний JS на PLP; reduced-motion |
| Тесты | Vitest 5 + Playwright 1.64 на mock-адаптере + axe; MSW 3 для клиента | Next experimental testmode + MSW | async RSC не тестируются юнитами; testmode экспериментален |
| Аналитика | `packages/analytics` (GA4-схема) + consent; GTM или PostHog/Umami/Метрика; серверный `purchase` | только GTM в клиенте | 152-ФЗ / GDPR; потеря `purchase` на клиенте |
| Docker-деплой | multi-stage `node:slim`, standalone, `/api/health` + `/api/ready`, общий ключ actions, `deploymentId` | OpenNext (только для Lambda/Workers) | pnpm-симлинки в standalone; буферизация стрима прокси |

## Open questions for the user

1. Какой commerce-провайдер эталонный: Medusa (self-host, РФ-совместим, нужен кто-то, кто его эксплуатирует) или
   Shopify (SaaS, не для РФ)? От этого зависит, какой адаптер init оставляет по умолчанию.
2. Целевой рынок магазинов — РФ/СНГ, международный или оба? Определяет дефолтные платёжки (ЮKassa/CloudPayments vs
   Stripe) и аналитику (Метрика/self-hosted vs GA4).
3. i18n: допускается next-intl в shop при i18next в остальных шаблонах (общий ICU-формат каталогов), или нужен один
   i18next везде ценой ручной интеграции с кэшем Next?
4. Деплой shop: один под/VPS (без Redis) по умолчанию, а Redis-кэш — опцией, или сразу k8s multi-pod с Redis?
5. Нужен ли в шаблоне внешний поисковый движок (Meilisearch) из коробки или достаточно поиска провайдера?
