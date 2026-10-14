# 05d. Шаблон `admin` (админка / дашборд / SaaS-кабинет)
Status: done
Updated: 2026-10-14

## Resume notes
- Done: все 13 разделов Findings, рекомендации, итоговая таблица, открытые вопросы; версии сверены с npm.
- Next: ничего; при пересборке шаблона перепроверить Vitest 5 ↔ @storybook/addon-vitest и Oxc + emitDecoratorMetadata.
- Sub-agent: нет (запрещено брифом для 05d).

## Summary (≤ 15 lines)

1. **Фреймворк:** Vite 8 + React 19 SPA, без SSR. Next.js / TanStack Start для админки за логином не дают выгоды;
   Refine / React Admin не берём: React Admin = MUI (ломает общий kit), Refine навязывает свои data/router-провайдеры
   и ещё сидит на TanStack Table v8 (проверено: `@refinedev/react-table@6.0.1` → `@tanstack/react-table ^8`).
2. **Роутинг:** TanStack Router 1.170 (file-based, типизированные search params через Zod 4 без адаптера, loaders
   с `queryClient.ensureQueryData`). URL — единственный источник состояния фильтров/сортировки/пагинации таблиц.
3. **Data layer:** TanStack Query 5.104 + **генерация кода**. Важный факт: `openapi-fetch` и `openapi-react-query`
   (стек прошлого проекта) с 2025-12-29 официально в **maintenance mode** ("won't get future updates", discussion
   #2559). Рекомендация: `@hey-api/openapi-ts` 0.99 (типы + SDK на fetch + `queryOptions`/`mutationOptions` + Zod-схемы)
   с exact pin; альтернатива — Orval 8 (зрелые MSW+faker моки). Слой маппинга ошибок — свой, в interceptors клиента.
4. **Клиентское состояние:** Zustand 5 для немногих глобальных UI-сторов; основная «модель» — серверный кэш Query +
   URL. MobX MVVM не брать в общий kit (MobX 7 удалил legacy-декораторы; DI через tsyringe под Vite 8/Oxc и TS 7 — риск).
5. **UI kit:** shadcn (CLI 4.21) на **Base UI** (`@base-ui/react` 1.9, дефолт shadcn с июля 2026) + Tailwind 4.3,
   компоненты в `packages/ui`, токены в `packages/tokens`. Mantine 9 / AntD 6 / MUI — нет: второй дизайн-язык.
6. **Таблицы:** TanStack Table **v9** (стабилен с 2026-08-04, shadcn data-table уже на v9) + TanStack Virtual 3,
   manual pagination/sorting/filtering из URL. AG Grid Community — только как опция для «Excel-подобных» экранов.
7. **Формы:** TanStack Form 1.x + Zod 4 (Standard Schema, схемы из генератора) — или RHF 7.9 как безопасный выбор;
   решение зависит от React Compiler (RHF `watch` с ним несовместим).
8. **Графики:** shadcn charts (Recharts 3) по умолчанию; ECharts 6 — для тяжёлых/многоточечных графиков.
9. **Auth:** по умолчанию OIDC Authorization Code + PKCE через `oidc-client-ts` 3.5 + `react-oidc-context` 3.3;
   опционально тонкий **BFF** (Node, httpOnly cookie) — IETF draft прямо называет BFF «strongly recommended for business
   applications». Better Auth — нет (это серверная auth-библиотека, а у нас внешний IdP/бэкенд).
10. **Real-time:** нативный WebSocket/SSE + `invalidateQueries`/`setQueriesData` в одном `RealtimeProvider`.
11. **Тесты:** Vitest 5 + Testing Library 16, MSW **3** (ESM-only, вышел 2026-09-28), Playwright 1.64, Storybook 10.6 +
   `@storybook/addon-vitest`. **Деплой:** nginx static + `try_files` SPA fallback + `env.js` при старте контейнера.

## Findings

### 0. Проверенные версии (npm registry, 2026-10-14)

| Пакет | latest | Заметка |
| --- | --- | --- |
| `vite` | 8.3.4 | Rolldown/Oxc |
| `react` / `react-dom` | 19.3.0 | |
| `typescript` | 7.0.2 | major 7 с 2026-07-08 (Go-порт) |
| `@tanstack/react-router` / `@tanstack/router-plugin` | 1.170.44 / 1.168.45 | |
| `@tanstack/react-start` | 1.169.1 | |
| `react-router` | 8.4.0 | v8 с 2026-06-17 |
| `next` | 16.4.0 | |
| `@refinedev/core` / `@refinedev/react-table` | 5.0.12 / 6.0.1 | react-table → `@tanstack/react-table ^8.2.6` |
| `react-admin` | 5.15.4 | зависит от `@mui/material`, `react-router ^6 \|\| ^7` |
| `@tanstack/react-query` | 5.104.2 | |
| `openapi-fetch` / `openapi-react-query` / `openapi-typescript` | 0.17.0 / 0.5.4 / 7.13.0 | все последние релизы 2026-02-11; maintenance mode |
| `@hey-api/openapi-ts` | 0.99.0 | 0.x, breaking в минорах; latest от 2026-06-22, дальше только `next`-сборки (до 2026-09-30) — проверить темп релизов перед выбором |
| `oidc-client-ts` / `react-oidc-context` | 3.5.0 / 3.3.1 | оба релиза 2026-03-13 |
| `orval` | 8.42.0 | |
| `zustand` / `jotai` / `mobx` / `mobx-react-lite` | 5.0.15 / 3.0.1 / 7.0.6 / 5.1.0 | jotai 3 с 2026-09-08, mobx 7 с 2026-07-30 |
| `shadcn` (CLI) | 4.21.4 | |
| `@base-ui/react` | 1.9.0 | старое имя `@base-ui-components/react` заморожено на 1.0.0-rc.0 |
| `radix-ui` | 1.8.1 | |
| `tailwindcss` | 4.3.3 | |
| `@mantine/core` / `antd` / `@mui/x-data-grid` | 9.7.2 / 6.6.6 / 9.15.0 | для сравнения |
| `@tanstack/react-table` | 9.3.1 | v9 с 2026-08-04 |
| `@tanstack/react-virtual` | 3.14.19 | |
| `ag-grid-community` / `ag-grid-react` | 36.2.0 | |
| `@tanstack/react-form` | 1.33.5 | dist-tag alpha = 2.0.0-alpha.2 |
| `react-hook-form` / `@hookform/resolvers` | 7.90.0 / 5.9.1 | dist-tag beta = 8.0.0-beta.4 |
| `zod` / `valibot` | 4.6.7 / 1.5.0 | |
| `recharts` / `echarts` / `@visx/xychart` / `@nivo/core` | 3.10.1 / 6.1.0 / 4.0.0 / 0.99.0 | |
| `oidc-client-ts` / `react-oidc-context` | 3.5.0 / 3.3.1 | |
| `better-auth` | 1.7.7 | |
| `i18next` / `react-i18next` | 26.4.4 / 17.0.16 | |
| `date-fns` | 4.4.0 | |
| `vitest` | 5.0.4 | v5 с 2026-09-03 |
| `@testing-library/react` | 16.3.3 | |
| `msw` | 3.0.3 | v3 с 2026-09-28 |
| `@playwright/test` | 1.64.0 | |
| `storybook` / `@storybook/addon-vitest` | 10.6.2 | |
| `@faker-js/faker` | 10.6.0 | |
| `nuqs` | 2.10.2 | не нужен при TanStack Router |
| `sonner` / `cmdk` / `lucide-react` | 2.0.8 / 1.1.1 / 1.57.0 | toasts / command palette / иконки |
| `@tanstack/react-db` | 0.5.9 | 0.x, наблюдать |

Источник: `https://registry.npmjs.org/<pkg>` (dist-tags.latest и time), проверено скриптом 2026-10-14.

### 1. Фреймворк

| Вариант | За | Против |
| --- | --- | --- |
| **Vite 8 + React SPA** | Админка за логином: SEO не нужен, SSR не нужен. Статика на nginx — самый простой Docker. Тот же Vite, что у TMA/game. Нет серверного рантайма → нет request-scoped проблем (docs/architecture.md §8). | Нужен свой каркас (layout, guards, CRUD-паттерны). |
| TanStack Start 1.169 | Тот же TanStack Router; server functions можно использовать как BFF. Есть SPA mode и prerender. | Нужен Node-рантайм в проде; ценность только если нужен BFF. По данным июньского обзора 2026 Start — последний из TanStack-пакетов, ещё считавшийся RC (https://blog.openreplay.com/tanstack-ecosystem-guide/), хотя npm уже 1.169 — статус «1.0 stable» не подтверждён официально. |
| Next.js 16 | Огромная экосистема. | RSC/SSR — лишняя сложность для админки за логином; `output: 'export'` теряет middleware; хуже стыкуется с Vite-пакетами monorepo. |
| Refine 5 | Готовые CRUD-хуки, `useTable`, auth/access-control провайдеры, shadcn-registry (https://refine.dev/core/docs/ui-integrations/shadcn/introduction/). | Свой data provider поверх TanStack Query дублирует сгенерированный клиент; `@refinedev/react-table` на TanStack Table **v8** при shadcn data-table уже на **v9** (проверено npm); хуки Refine определяют форму компонентов → выход из Refine = переписывание UI. |
| React Admin 5 | Самый «из коробки». | Жёстко MUI + react-router 6/7 (не 8) + RHF → второй UI-язык в monorepo, общий kit не используется. |

**Вывод (мнение):** Vite SPA. Refine «не воюет» с kit напрямую (shadcn-компоненты копируются в проект), но воюет с
data layer (генерированные `queryOptions` vs `dataProvider`) и с версией Table. Для бойлерплейта ценнее свои 5–6
паттернов (resource list, form page, guard, permission gate), чем фреймворк. React Admin — исключить.

### 2. Роутинг

- **TanStack Router 1.170** (рекомендация): file-based (`@tanstack/router-plugin/vite`), автоматический code-splitting,
  типизированные `params`/`search`, `validateSearch` принимает Zod 4 напрямую (Standard Schema), адаптер
  `@tanstack/zod-adapter` для Zod 4 не нужен; дефолты через `.default()`/`.catch()`
  (https://tanstack.com/router/latest/docs/how-to/validate-search-params). `beforeLoad` для guard'ов
  (`context.auth`), `loader` + `queryClient.ensureQueryData(opts)` — данные стартуют параллельно с чанком.
  `search` middlewares (`retainSearchParams`, `stripSearchParams`) — для фильтров таблиц.
- **React Router 8.4** (v8 с 2026-06-17, ESM-only, Node 22.22+, React 19.2.7+; ежегодный мажор, v9 ~май 2027 —
  https://remix.run/blog/react-router-v8): зрелый, middleware по умолчанию. Но search params — строки без схемы,
  типизация через framework mode/typegen; для админки с десятками фильтров TanStack Router удобнее.
- **URL state:** при TanStack Router `nuqs` не нужен. Правило: фильтры/сорт/страница/выбранная вкладка — в URL
  (шаринг ссылок, back/forward), выделенные строки и открытые диалоги — нет.
- Конфликт с docs/architecture.md §6 («универсальный навигационный хук с `goToX`»): в TanStack Router типизированный
  `useNavigate({ to })`/`<Link to>` уже даёт проверку путей; отдельный `goToX`-хук для web-only излишен (мнение).
  Нужно согласовать с пользователем.

### 3. Data layer

**Факт:** 2025-12-29 мейнтейнер openapi-ts объявил: `openapi-fetch` и `openapi-react-query` «will be put into
maintenance mode and won't get future updates»; для openapi-react-query миграция «will, unfortunately, be more
painful» (https://github.com/openapi-ts/openapi-typescript/discussions/2559). npm подтверждает: последние релизы
2026-02-11. `openapi-typescript` (только типы) продолжает развиваться.

| Вариант | Что генерирует | Плюсы | Минусы |
| --- | --- | --- | --- |
| openapi-typescript + openapi-fetch + openapi-react-query | типы + тонкий рантайм | минимум кода, знаком пользователю | maintenance mode; ключ `['<method>','<path>']` |
| **`@hey-api/openapi-ts` 0.99** | типы, SDK (`@hey-api/client-fetch` встроен), `@tanstack/react-query` плагин (`xxxOptions()`, `xxxInfiniteOptions()`, `xxxMutation()`, `xxxQueryKey()`), Zod/Valibot схемы, transformers (даты) | один конфиг, плагины, используют крупные проекты; `queryOptions` идеально ложатся в router loaders | 0.x — breaking changes в минорах → exact pin + обновление осознанно; MSW-плагин «In Progress» (https://heyapi.dev/openapi-ts/plugins/msw) |
| Orval 8.42 | хуки/`queryOptions`, fetch по умолчанию (v8), Zod 4 по умолчанию, **MSW handlers + faker моки** | зрелые моки — сильная сторона для Storybook/тестов (https://orval.dev/docs/versions/v8) | ESM-only, Node 22.18+; генерирует хуки (меньше гибкости, чем options-фабрики) |

**Рекомендация:** Hey API (exact pin `0.99.x`, `api:generate` пересоздаёт всё вместе с маппингом ошибок, review diff
— как в docs/architecture.md §4). Моки: пока MSW-плагин Hey API не стабилен — свои MSW-хендлеры на типах
генератора + `@faker-js/faker`; если моки критичны — Orval. (Мнение: выбор Hey API vs Orval стоит сделать один на
весь monorepo — shop/TMA тоже ходят в OpenAPI.)

**Слой ошибок (переносим из прошлого проекта):** interceptors клиента: auth header → response → 401 (refresh/logout) →
маппинг `operationId × status × problem.type` → `toast | modal | silent | field` (новое для админки: ошибки
валидации 422/RFC 9457 `errors[]` → `form.setFieldMeta`/`setError` по полям). Ключ маппинга — `operationId` (у Hey API
он есть в ключах через `_id`), а не `['method','path']`. QueryClient `retry: false` если retry в middleware.

**Optimistic updates:** паттерн v5 «через `variables`» (UI показывает `mutation.variables` пока pending) для простых
случаев; `onMutate` + `setQueryData` + rollback для таблиц; `invalidateQueries({ queryKey })` в `onSettled`.
`placeholderData: keepPreviousData` для серверной пагинации. TanStack DB (`@tanstack/react-db` 0.5.9) — 0.x, только
наблюдать.

### 4. Клиентское состояние

Честное сравнение (мнение, опирается на опыт пользователя из docs/architecture.md §3 и library-notes):

| | Zustand 5 | Jotai 3 | MobX 7 (MVVM) |
| --- | --- | --- | --- |
| Роль в админке | глобальные UI-сторы (sidebar, тема, command palette, user prefs) | мелкое производное состояние, редакторы | VM на каждый экран |
| Плюсы | 1 KB, без провайдера, selectors, `persist` middleware, знаком любому агенту | атомарность, хорош для сложных редакторов | пользователь знает; реактивные getters; «логика вне view» |
| Минусы | нет computed «из коробки» | v3 вышел 2026-09-08 — свежий мажор | MobX 7 удалил legacy decorators (https://newreleases.io/project/github/mobxjs/mobx/release/mobx@7.0.0); DI через tsyringe требует `experimentalDecorators` + `emitDecoratorMetadata`, поддержка последнего в Oxc (Vite 8) не подтверждена — риск; дублирует кэш Query (`MobXQuery`-обёртка); ruleset прошлого проекта (13 кастомных правил) нужен именно потому, что паттерн легко нарушить |

В админке 80% состояния — серверный кэш (Query) и URL (Router). Остаётся мало: Zustand. Принцип «логика вне view»
сохраняется через **custom hooks как view model** (`usePageModel()` возвращает derived values + handlers), а не через
классы. **Рекомендация:** Zustand в бойлерплейте; MobX MVVM — не включать в общий kit (опционально в отдельном
шаблоне, если пользователь настаивает). Это расходится с docs/architecture.md §3 — вынесено в открытые вопросы.

### 5. UI kit

- **Факт:** shadcn поставляет каждый компонент в двух вариантах (Radix и Base UI); стили `base-*` (например
  `base-nova`) выбирают Base UI; с **июля 2026 новые проекты по умолчанию на Base UI**, Radix «fully supported»
  (https://ui.shadcn.com/docs/changelog). Основное различие API: Radix `asChild` vs Base UI `render` prop — блоки
  сторонних registry могут требовать base-версии (https://www.shadcnblocks.com/docs/blocks/base-ui).
- Пакет: `@base-ui/react` 1.9.0 (старое имя `@base-ui-components/react` остановилось на rc — не путать).
- Рекомендация: shadcn **base-** стиль, компоненты в `packages/ui` (monorepo-поддержка shadcn CLI через
  `components.json` в app и в `packages/ui`), Tailwind 4.3 с `@theme` из `packages/tokens` (CSS variables, light/dark
  через `.dark`/`data-theme`). Это общий kit для landing/shop/admin; TMA и game переиспользуют токены и простые
  примитивы.
- Админ-специфичные блоки (в `apps/admin` или `packages/ui/admin`, чтобы не тянуть их в landing): `sidebar`,
  `data-table`, `command` (cmdk), `chart`, `calendar` (react-day-picker 10), `sonner`, `field`.
- Mantine 9 / AntD 6 / MUI: богаче готовыми компонентами (даты, таблицы), но это **второй дизайн-язык и вторая
  токен-система**; shared kit перестаёт быть shared. Не брать.
- Доступность/клавиатура: Base UI/Radix дают фокус-ловушки, roving tabindex, ARIA; data-table нужно доделать
  (фокус по ячейкам не из коробки). Dark theme — токены + `prefers-color-scheme` + переключатель в Zustand persist.

### 6. Таблицы

- **Факт:** TanStack Table v9 stable 2026-08-04: явные tree-shakable `tableFeatures()`, состояние на TanStack Store,
  `useTable`, размер ядра ~25 KB (было ~14), до −86% retained heap на 1M строк
  (https://tanstack.com/blog/announcing-tanstack-table-v9); есть `useLegacyTable` для v8-стиля
  (https://tanstack.com/table/latest/docs/framework/react/guide/migrating.md). **shadcn data-table guide уже на v9**
  (`useTable`, `tableFeatures()`), но показывает только клиентскую пагинацию
  (https://ui.shadcn.com/docs/components/data-table).
- Рекомендация: `@tanstack/react-table` 9.3 + `@tanstack/react-virtual` 3.14; обёртка `DataTable` с `manualPagination/
  manualSorting/manualFiltering`, состояние ↔ URL search (TanStack Router), `placeholderData: keepPreviousData`,
  column visibility/order/size → Zustand persist по ключу таблицы, экспорт CSV — на клиенте для текущей выборки,
  полный экспорт — эндпоинт бэкенда (async job). Виртуализация строк только для «бесконечных» списков; для
  серверной пагинации с 25–100 строками не нужна.
- AG Grid Community 36: сильный грид (редактирование ячеек, Infinite Row Model бесплатно), но **Server-Side Row Model,
  группировка, pivot, Excel-экспорт — Enterprise** (https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise.md);
  свой Theming API ≠ наши токены (маппинг вручную). Опция для отдельных «spreadsheet»-экранов.
- MUI X Data Grid 9: тянет MUI/Emotion → против kit. Нет.

### 7. Формы

- **TanStack Form 1.33**: типы из `defaultValues`, Standard Schema (Zod 4/Valibot без резолвера), тонкие подписки —
  массивы полей не перерисовывают соседей; есть официальный shadcn-гайд (`Field` + TanStack Form). Риск: сообщается
  о несовместимости с React Compiler (непроверенный сторонний источник).
- **React Hook Form 7.90** + `@hookform/resolvers` 5.9 + Zod 4: крупнейшая экосистема; `watch` не мемоизируется
  React Compiler (React team помечает как incompatible), workaround `"use no memo"`/`useWatch`; v8 в beta с
  багами под Compiler (https://newreleases.io/project/npm/react-hook-form/release/7.79.0).
- Сравнение и цитаты: https://formisch.dev/blog/react-form-library-comparison/ (2026-04-09; автор конкурента — учитывать).
- Схемы из OpenAPI: Hey API `zod` плагин / Orval `client: 'zod'` генерируют Zod-схемы тел запросов → базовая схема
  формы = `generated.extend({...UI-правила})`. Wizard: один form-инстанс, шаги = подмножества полей + `step` в URL.
- Обе библиотеки готовят мажор (RHF 8.0.0-beta.4, TanStack Form 2.0.0-alpha.2 в npm dist-tags) — миграция в течение года вероятна.
- **Рекомендация (мнение):** TanStack Form, если React Compiler не включаем; иначе RHF. Нужно выбрать одно на monorepo
  (shop checkout использует тот же выбор).

### 8. Графики

- **shadcn charts = Recharts v3** (подтверждено: «The chart component now uses Recharts v3»; цвета `var(--chart-N)` из
  токенов, light/dark — https://ui.shadcn.com/docs/components/chart). SVG, хорошо стилизуется токенами,
  доступность в v3 включена по умолчанию (https://blog.logrocket.com/top-5-react-chart-libraries/). Потолок —
  тысячи точек.
- ECharts 6.1 (Apache-2.0, canvas, progressive rendering, 100k+ точек, карты, heatmap) — для аналитики/мониторинга;
  тема ECharts строится из тех же CSS-переменных вручную. Обёртку писать свою (`echarts-for-react` 3.0.6 —
  нечасто обновляется; мнение).
- visx/Nivo: visx — низкоуровневый (дорого), Nivo 0.99 — 0.x много лет. Не брать.

### 9. Auth

**Факт (IETF draft-ietf-oauth-browser-based-apps-26, декабрь 2025):** три архитектуры «in decreasing order of
security»: BFF (токены не попадают в браузер; «strongly recommended for business applications, sensitive
applications»), token-mediating backend, чистый browser client (уязвим ко «всем рассмотренным сценариям», включая
получение новых токенов злоумышленником; refresh tokens обязаны ротироваться или быть sender-constrained)
(https://www.ietf.org/archive/id/draft-ietf-oauth-browser-based-apps-26.txt). Статус RFC на октябрь 2026 не проверен.

| Вариант | Безопасность | Сложность | Подходит |
| --- | --- | --- | --- |
| `oidc-client-ts` 3.5 + `react-oidc-context` 3.3 (Code+PKCE, токены в памяти/`sessionStorage`, refresh rotation) | средняя: XSS = кража токена | низкая, чистая статика | внутренние админки, MVP |
| **BFF** (тонкий Node-сервис в том же образе/поде: `/auth/login`, `/auth/callback`, `/api/*` проксирует с токеном из server-side сессии; браузер видит только `HttpOnly; Secure; SameSite=Lax` cookie) | высокая | средняя: Node-рантайм, хранилище сессий (in-memory/Redis), CSRF | SaaS-кабинеты клиентов, финансы, ПДн |
| Better Auth 1.7 | — | — | **нет**: это auth-сервер (свой callback `/api/auth/oauth2/callback/:providerId`, `clientSecret` на сервере, БД или stateless cookie) — превращается в собственный auth-бэкенд, противоречит «frontend-only» |

Детали для варианта по умолчанию:
- Keycloak по умолчанию ротирует refresh token при каждом refresh (https://forum.keycloak.org/t/how-to-automatically-rotate-refresh-tokens-when-access-tokens-are-renewed-in-keycloak/31171);
  при `automaticSilentRenew` нужно подписаться на `events.addUserLoaded`, иначе в API-клиенте остаётся старый токен
  (реальный баг: https://community.ohif.org/t/fix-user-state-not-updating-during-token-refresh-in-oidc-with-keycloak-and-automaticsilentrenew-true-configuration/1065);
  `addSilentRenewError` → logout. Токен в клиент API берётся функцией `getAccessToken()` при каждом запросе, не
  копируется в стор.
- Route guard: `beforeLoad` корневого `_authenticated` layout → `redirect({ to: '/login', search: { redirect } })`;
  `auth` передаётся через router context.
- **RBAC в UI:** права — из claims (`realm_access.roles`/`permissions`) или эндпоинта `/me/permissions`; один
  `can(action, resource)` + `<Can>`/`useCan()`, проверка и в `beforeLoad` маршрута, и в навигации (скрыть пункт),
  и в кнопках. UI-проверки — только UX, авторизация — на бэкенде. CASL (`@casl/ability`) — если нужны условия по полям;
  иначе 30 строк своего кода (мнение).
- Внешние IdP: Keycloak, Zitadel, Auth0, Authentik — все стандартный OIDC; конфиг (`authority`, `client_id`) через
  runtime env.

### 10. Real-time

- Паттерн (https://tkdodo.eu/using-web-sockets-with-react-query): сообщение = сигнал → `invalidateQueries({ queryKey })`
  (сервер — источник истины); при полном payload — `setQueriesData` по фильтру на все списки; при сокетах —
  `staleTime` высокий.
- Реализация: один `RealtimeProvider` в app (opt-in на маршрутах), нативный `WebSocket` с reconnect/backoff и
  ресабскрайбом, или `EventSource` (SSE: проще через прокси/nginx, авто-reconnect, только server→client; заголовок
  Authorization не передать — cookie (BFF) или короткоживущий ticket в query). Библиотеки: `partysocket` 1.3
  (reconnecting WS, мало кода) — опционально; `react-use-websocket` 4.13 — не нужен.
- nginx: `proxy_http_version 1.1; Upgrade/Connection` для WS, `proxy_buffering off` для SSE.
- MSW 3 умеет мокать WebSocket (`ws.link`, событие переименовано в `websocket:connection`).

### 11. i18n и форматирование

- `i18next` 26.4 + `react-i18next` 17.0: v26 убрал `initImmediate` (→ `initAsync`) и legacy `interpolation.format`
  (→ встроенный Formatter `formatter.add()`); react-i18next 17 требует i18next ≥ 26.0.1, изменил вывод `Trans`
  (https://app.unpkg.com/react-i18next@17.0.15/files/CHANGELOG.md). Правила docs/architecture.md §7 переносятся как есть.
- Даты/числа: `Intl.*` через встроенный formatter i18next (`{{val, number}}`, `{{d, datetime}}`, `relativetime`);
  `date-fns` 4.4 для арифметики/парсинга (tz через `@date-fns/tz`). Деньги — decimal-библиотека (правило §12).
- Таблицы: форматирование в cell renderer, не в `select` запроса (язык меняется — кэш не трогать).

### 12. Тесты

- Vitest 5.0 (v5 с 2026-09-03) + `@testing-library/react` 16.3 + `@testing-library/user-event`; jsdom/happy-dom для
  юнитов, Vitest Browser Mode (Playwright) для компонентов.
- MSW 3.0 (2026-09-28): ESM-only, Node 22+, TS ≥ 5.9, `onUnhandledRequest` → `onUnhandledFrame`, `worker.stop()`
  async, cookies — только через resolver-аргумент, fake timers больше не патчатся
  (https://newreleases.io/project/github/mswjs/msw/release/v3.0.0). Хендлеры типизировать по сгенерированным
  типам; моки — faker. Общий пакет `packages/mocks`.
- Storybook 10.6 + `@storybook/addon-vitest`: stories = тесты в browser mode (Playwright Chromium); для Vitest ≥ 4
  отдельный test project (https://storybook.js.org/docs/writing-tests/integrations/vitest-addon). Совместимость с
  Vitest 5 официально **не подтверждена** — проверить при сборке шаблона (риск).
- Playwright 1.64: e2e против MSW-моков (dev) и smoke против stage; auth в e2e — `storageState` после логина в
  тестовом realm Keycloak или мок OIDC.
- Визуальные тесты 2 темы × 3 ширины в Docker (из docs/tooling.md §8) — переносятся.

### 13. Docker / деплой

- Multi-stage: `node:<pin>-alpine` + `pnpm deploy --filter admin` / `turbo prune` → `vite build` → `nginx:<pin>-alpine`
  (или `nginxinc/nginx-unprivileged` для k8s non-root).
- nginx: `try_files $uri $uri/ /index.html;`; `index.html` и `env.js` — `Cache-Control: no-store`; `/assets/*` —
  `immutable, max-age=31536000`; gzip/brotli; security headers (CSP с `connect-src` на API/IdP/WS, `frame-ancestors
  'none'`, `X-Content-Type-Options`).
- Runtime env: entrypoint (`/docker-entrypoint.d/40-env.sh` или `envsubst` по шаблону) пишет `/env.js` →
  `window.__ENV__ = {API_URL, OIDC_AUTHORITY, OIDC_CLIENT_ID, WS_URL}`; `index.html` грузит `<script src="/env.js">`
  до бандла; `config` модуль валидирует Zod-схемой. Один образ на все окружения (docs/tooling.md §9).
- Опциональный BFF: второй target в том же Dockerfile (Node 22/24, Hono/Fastify ~200 строк) — либо отдельный
  контейнер в поде, nginx проксирует `/api` и `/auth` на него.

## Recommendations for the boilerplate

Приоритет 1 (ядро шаблона `admin`):
1. `apps/admin`: Vite 8 + React 19 + TS + TanStack Router (file-based) + TanStack Query 5. Без SSR.
2. `packages/api` (общий для всех шаблонов): `@hey-api/openapi-ts` (exact pin), плагины `@hey-api/client-fetch`,
   `@tanstack/react-query`, `zod`; свой interceptor-стек и error mapping по `operationId`. Не использовать
   `openapi-fetch`/`openapi-react-query` в новом бойлерплейте (maintenance mode).
3. `packages/ui` + `packages/tokens`: shadcn base-стиль на `@base-ui/react`, Tailwind 4; admin-блоки (sidebar,
   data-table, command, chart) отдельно, чтобы init удалял их вместе с `admin`.
4. `DataTable` на TanStack Table v9 с URL-state и серверными sort/filter/pagination; пример CRUD-ресурса (list → detail
   → edit form → delete с optimistic update).
5. Auth: `oidc-client-ts` + `react-oidc-context`, `_authenticated` layout guard, `useCan`/`<Can>`; пример конфига для
   Keycloak (docker-compose с Keycloak для dev — опция).
6. Docker: nginx static + `env.js`; health endpoint; CSP.

Приоритет 2 (опции init):
7. `--bff`: тонкий Node BFF (cookie-сессия) — для клиентских SaaS-кабинетов.
8. `--realtime`: `RealtimeProvider` (WS/SSE) + invalidation-карта.
9. `--charts-heavy`: ECharts-обёртка с темой из токенов.
10. `--grid`: AG Grid Community с темой из токенов (только если нужны редактируемые таблицы).

Избегать: React Admin, MUI/Mantine/AntD, Refine (пока минимум — до перехода на Table v9 и если пользователь не хочет
CRUD-фреймворк), Better Auth, токены в `localStorage`, nuqs при TanStack Router, `@base-ui-components/react` (старое
имя пакета).

Общее с другими шаблонами: tokens, ui-примитивы, `packages/api`, error mapping, i18n-конфиг и правила, Vitest/MSW/
Playwright/Storybook конфиги, Docker nginx-target, ESLint/Prettier. Расходится: TanStack Router (landing/shop могут
быть на Astro/Next/Start), data-table/chart/command блоки, OIDC (TMA — initData, shop — провайдер), BFF.

### Итоговая таблица

| Потребность | Рекомендация | Альтернатива | Риск |
| --- | --- | --- | --- |
| Фреймворк | Vite 8 SPA + React 19 | TanStack Start 1.169 (если нужен BFF в одном рантайме) | свой каркас CRUD писать самим |
| Роутинг | TanStack Router 1.170, file-based | React Router 8.4 | частые минорные релизы; расхождение с правилом `goToX` |
| URL-state фильтров | `validateSearch` + Zod 4 | nuqs 2.10 (если RR) | — |
| API-клиент | `@hey-api/openapi-ts` 0.99 (exact pin) | Orval 8.42 | 0.x breaking в минорах |
| Server state | TanStack Query 5.104 | — | — |
| Ошибки | interceptors + маппинг по `operationId` | — | пробелы маппинга = нет UI (репорт) |
| Client state | Zustand 5.0 | Jotai 3 / MobX 7 MVVM | отход от привычного MVVM пользователя |
| UI kit | shadcn (base-стиль) + `@base-ui/react` 1.9 + Tailwind 4.3 | shadcn на Radix (`radix-ui` 1.8) | сторонние блоки под `asChild` |
| Таблицы | TanStack Table 9.3 + Virtual 3.14 | AG Grid Community 36 | v9 свежий (2 мес.), мало примеров server-side |
| Формы | TanStack Form 1.33 + Zod 4.6 | RHF 7.90 + resolvers 5.9 | Compiler-совместимость обеих |
| Графики | shadcn chart (Recharts 3.10) | ECharts 6.1 | Recharts на больших данных |
| Auth | oidc-client-ts 3.5 + react-oidc-context 3.3 (PKCE) | BFF с httpOnly cookie | XSS → кража токена (без BFF) |
| RBAC | `useCan`/`<Can>` + guard в `beforeLoad` | `@casl/ability` | рассинхрон с бэкендом |
| Real-time | нативный WS/SSE + invalidation | `partysocket` 1.3 | шторм refetch при частых событиях |
| i18n | i18next 26 + react-i18next 17 + Intl | — | breaking `Trans` в 17 |
| Unit/component | Vitest 5 + Testing Library 16 | — | Vitest 5 ↔ Storybook addon не подтверждено |
| Моки | MSW 3 + faker 10 (хендлеры на сген. типах) | Orval-моки | MSW 3 свежий мажор |
| E2E | Playwright 1.64 | — | auth в e2e |
| Storybook | 10.6 + addon-vitest | — | — |
| Деплой | nginx static + `env.js` | + Node BFF target | CSP/кэш `index.html` |

## Open questions for the user

1. Отказываемся ли от MobX MVVM + tsyringe в пользу Zustand + hooks-as-view-model (хотя бы для `admin`)? От этого
   зависят docs/architecture.md §3 и половина кастомных ESLint-правил.
2. API-клиент для всего monorepo: Hey API (рекомендация) или Orval? `openapi-fetch`/`openapi-react-query` — в
   maintenance mode, переносить их не предлагаю.
3. Auth по умолчанию: чистый SPA с PKCE или сразу BFF (Node в проде)? Какой IdP типичен — Keycloak, Zitadel, Auth0?
4. Включаем ли React Compiler? Это решает выбор TanStack Form vs RHF.
5. Нужен ли admin-шаблону CRUD-фреймворк (Refine) ради скорости, или достаточно своих примеров ресурса?
6. Правило «универсальный `goToX`-хук» (§6) оставляем для web-only шаблонов, или типизированного `<Link to>` достаточно?
