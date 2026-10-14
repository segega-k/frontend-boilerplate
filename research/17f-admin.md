# 17f. admin: глубокая проверка стека + срез ядра (MobX, Query, API-генератор, тесты)
Status: done
Updated: 2026-10-15 (вечер)

## Resume notes
- Done: прочитаны 00-brief, 12-frame §5–6, 12-master-plan §3–4, §13, 05d, 05 §4–7; версии сняты скриптом с
  registry.npmjs.org (2026-10-15), релизы и issues с GitHub API, Docker Hub теги; таблица, замены, дельта к плану.
- Next: ничего. При реализации — smoke-проверки из раздела «Рекомендации» (virtual file routes + autoCodeSplitting,
  Storybook 10.6 + Vitest 5, Hey API vs Orval на реальной спеке).
- Sub-agent: нет.

## Summary (≤ 15 lines)

1. **MobX 7 реален**: `mobx@7.0.6` (7.0.0 вышел 2026-07-30), `mobx-react-lite@5.1.0`. Breaking: только Proxy,
   удалены legacy-декораторы, `trace`, и неймспейсы (`observable.ref` → `observableRef`, `action.bound` → `actionBound`,
   `comparer.*` → `compare*`). Для plain-классов с `makeAutoObservable` миграции почти нет. Брать.
2. **Готовый мост `mobx-tanstack-query` 7.3.0 НЕ совместим с MobX 7** (peer `mobx ^6.12.4`; issue #91 «Support MobX 7»
   открыт с 2026-07-31, автор обещает только «следующим мажором»). 1 мейнтейнер, ~3.2k загрузок/нед., тянет свою
   util-библиотеку `yummies`. Решение плана «свой MobxQuery v2» подтверждается фактами; библиотеку использовать как
   референс API. `mobx-utils` 6.1.1 тоже peer `mobx ^6` — не брать.
3. **Hey API — главный риск ядра**: `@hey-api/openapi-ts` latest = 0.99.0 от 2026-06-22, почти 4 месяца без stable
   при открытых PR; TS 7 только в `next`-сборках; peer `typescript <7`; один ключевой мейнтейнер (mrlubos, 2453
   коммита), в коде появился запрос финансирования. Orval 8.43.0 (2026-10-14) релизится каждые 2–5 дней, генерирует
   `getXQueryOptions`/`getXQueryKey`, Zod, MSW+faker. **Предлагаю сменить дефолт на Orval** (или выбрать по smoke).
4. **TanStack Query 5.104.2** — стабилен; v6 сейчас только у Solid (6.0.0-rc.5, из-за Solid 2), React-v6 не анонсирован.
5. **Риск «Vitest 5 ↔ Storybook» снят**: `@storybook/addon-vitest@10.6.2` peer `vitest ^3||^4||^5`,
   `@vitest/browser-playwright ^4||^5`. Storybook 11 в alpha.6 — мажор вероятен в 12 мес.
6. Router: в доках прямо — авто-code-splitting **только** при file-based. План «code-based `domains/<d>/routes.ts`»
   теряет его; замена — **virtual file routes** (`routes.ts` на домен через `physical()`/`__virtual.ts`).
7. Остальное подтверждено: Vite 8.3.4, Router 1.170.44, Table 9.3.1, Virtual 3.14.19, Recharts 3.10.1, ECharts 6.1.0,
   RHF 7.90.0 (v8 в beta год), Zod 4.6.7, oidc-client-ts 3.5.0, react-oidc-context 3.3.1, MSW 3.0.3, Playwright
   1.64.1, Sentry 11.7.0. BFF: Hono 5 в RC (2026-10-10) — пин 4.x или ждать 5; альтернатива без кода — oauth2-proxy.

## Findings

### 0. Методика
Факты: `registry.npmjs.org/<pkg>` (dist-tags, `time`, peerDependencies последней версии), GitHub REST API
(releases, issues, commits), Docker Hub API, официальные доки TanStack. Скрипт в scratchpad, дата 2026-10-15.
Оценки «здоровье» и «риск» — мнение на основе этих фактов.

### 1. Главная таблица

Health: A — активный релизный ритм, несколько мейнтейнеров/компания; B — жив, но медленно или 1 мейнтейнер;
C — стагнация/maintenance. Риск breaking в 12 мес.: низкий / средний / высокий.

| Технология | Выбор + точная версия | Дата релиза | Health | Риск 12 мес | Вердикт | Источник |
| --- | --- | --- | --- | --- | --- | --- |
| Vite | `vite` 8.3.4 (+ `@vitejs/plugin-react` 6.1.2) | 2026-10-08 (8.0: 2026-03-12) | A | низкий (v9 не анонсирован) | брать | https://registry.npmjs.org/vite |
| React | `react` 19.3.1 | 2026-10-14 | A | низкий | брать (свежий патч, `minimumReleaseAge` 7 дней) | https://registry.npmjs.org/react |
| TanStack Router | `@tanstack/react-router` 1.170.44, `@tanstack/router-plugin` 1.168.46 | 2026-10-12 / 10-14 | A | низкий (v1, ежедневные патчи) | брать; file-based/virtual вместо code-based | https://tanstack.com/router/latest/docs/framework/react/guide/code-splitting |
| Поиск-параметры | Zod 4 напрямую в `validateSearch` (Standard Schema); `@tanstack/zod-adapter` 1.167.0 peer `zod ^3` — не ставить | — | — | низкий | брать без адаптера | https://registry.npmjs.org/@tanstack/zod-adapter |
| Таблицы | `@tanstack/react-table` 9.3.1 | 2026-10-12 (9.0: 2026-08-04) | A | средний (молодой мажор, API features) | брать | https://tanstack.com/blog/announcing-tanstack-table-v9 |
| Виртуализация | `@tanstack/react-virtual` 3.14.19 | 2026-10-13 | A | низкий | брать | https://registry.npmjs.org/@tanstack/react-virtual |
| Графики (дефолт) | `recharts` 3.10.1 | 2026-07-25 (canary 3.11 2026-10-13) | A | низкий | брать (shadcn chart) | https://ui.shadcn.com/docs/components/chart |
| Графики (тяжёлые) | `echarts` 6.1.0, своя обёртка | 2026-05-19 | A (Apache) | низкий | опция; `echarts-for-react` 3.0.6 не брать | https://registry.npmjs.org/echarts |
| Формы | `react-hook-form` 7.90.0 + `@hookform/resolvers` 5.9.1 | 2026-10-11 / 08-17 | A | средний: `8.0.0-beta.4` (alpha с 2025-10) | брать 7; v8 мигрировать одним PR | https://github.com/react-hook-form/react-hook-form/releases |
| Формы (альт.) | `@tanstack/react-form` 1.33.5 | 2026-08-11 | A | средний: 2.0.0-alpha.2 | не брать (одна библиотека на монорепо, RHF уже у 4 шаблонов) | https://registry.npmjs.org/@tanstack/react-form |
| Схемы | `zod` 4.6.7 | 2026-10-12 | A | низкий | брать | https://registry.npmjs.org/zod |
| Auth SPA | `oidc-client-ts` 3.5.0 + `react-oidc-context` 3.3.1 | обе 2026-03-13 | B (7 мес. без релиза; коммиты до 2026-09-01; 160 open issues) | низкий | брать, но держать за своим адаптером `auth/` | https://github.com/authts/oidc-client-ts |
| BFF OIDC | `openid-client` 6.8.8 (panva) | 2026-09-05 | A | низкий | брать в BFF | https://registry.npmjs.org/openid-client |
| BFF сервер | `hono` 4.13.13 + `@hono/node-server` 2.1.5 | 2026-10-04 / 10-13 | A | **высокий: `hono` 5.0.0-rc.1 (2026-10-10, Node ≥ 22.12)** | брать Hono, пин 4.x до 5.0 + 7 дней; Fastify 5.12.7 (6.0 alpha) — равноценная замена | https://registry.npmjs.org/hono |
| BFF без кода | oauth2-proxy v7.15.5 (Go, контейнер) | 2026-10-01 | A | низкий | альтернатива своему BFF для «просто cookie-сессии» | https://github.com/oauth2-proxy/oauth2-proxy/releases |
| Real-time | нативный `WebSocket`/`EventSource` + `invalidateQueries`; `partysocket` 1.3.0 опц. | 2026-06-23 | B | низкий | свой провайдер; partysocket только если backoff писать лень | https://tkdodo.eu/using-web-sockets-with-react-query |
| Переходы экранов | свой `ScreenTransition` (CSS) + опц. `defaultViewTransition` Router; `motion` 14.2.0 вне kit | 2026-10-13 (14.0: 2026-10-02) | A | средний: Motion мажор каждые ~2 мес. (13.0 08-05, 14.0 10-02) | брать, пин мажора в catalog | https://tanstack.com/router/latest/docs/framework/react/examples/view-transitions |
| **MobX** | `mobx` 7.0.6 + `mobx-react-lite` 5.1.0 | 2026-10-02 / 09-24 (7.0: 2026-07-30) | A (релизы раз в 1–2 нед.) | низкий | **брать** | https://github.com/mobxjs/mobx/releases |
| Мост готовый | `mobx-tanstack-query` 7.3.0 | 2026-08-11 | B (1 автор, 75★, 3.2k/нед) | высокий (переход на MobX 7 = мажор) | **не брать**; peer `mobx ^6.12.4`, issue #91 | https://github.com/js2me/mobx-tanstack-query/issues/91 |
| Мост свой | `MobxQuery v2` на `QueryObserver` из `@tanstack/query-core` 5.104.2 | — | наш код | низкий | брать (≈150 строк + тесты) | https://tanstack.com/query/latest/docs/reference/QueryObserver |
| mobx-utils | 6.1.1 | 2025-06-15 | C | — | не брать (peer `mobx ^6`) | https://registry.npmjs.org/mobx-utils |
| eslint-plugin-mobx | 0.1.0 | 2026-09-22 | B | низкий | можно взять базовые правила; кастомные — свои | https://registry.npmjs.org/eslint-plugin-mobx |
| TanStack Query | `@tanstack/react-query` / `query-core` 5.104.2 | 2026-10-11 | A | низкий (v6 только Solid: 6.0.0-rc.5) | брать | https://registry.npmjs.org/@tanstack/solid-query |
| API-ген (план) | `@hey-api/openapi-ts` 0.99.0 | 2026-06-22; далее только `0.0.0-next-20260930…` | **B−** (4 мес. без stable, TS 7 не в stable, 1 ключевой мейнтейнер) | высокий (0.x, breaking в минорах + застой) | **понизить до альтернативы** | https://github.com/hey-api/hey-api/issues/4235 |
| API-ген (предлагаю) | `orval` 8.43.0 | 2026-10-14 (8.0: 2026-01-14) | A (релизы 10-04, 10-08, 10-13, 10-14) | средний (ESM-only, Node ≥ 22.18; v9 не анонсирован) | **дефолт** после smoke | https://github.com/orval-labs/orval/releases |
| API-ген (старый стек) | `openapi-typescript` 7.13.0, `openapi-fetch` 0.17.0, `openapi-react-query` 0.5.4 | все 2026-02-11 | C (maintenance с 2025-12-29) | — | не брать | https://github.com/openapi-ts/openapi-typescript/discussions/2559 |
| Unit/компоненты | `vitest` 5.0.4, `@vitest/browser-playwright` 5.0.4 | 2026-10-12 (5.0: 2026-09-03) | A | низкий | брать | https://github.com/vitest-dev/vitest/releases/tag/v5.0.0 |
| DOM-среда | `jsdom` 30.1.2 / `happy-dom` 21.0.1 | 10-04 / 10-12 (21.0: 10-11) | A | средний (happy-dom мажор 4 дня назад) | jsdom по умолчанию, браузерный режим для kit | https://registry.npmjs.org/happy-dom |
| Testing Library | `@testing-library/react` 16.3.3, `dom` 10.4.2, `user-event` 14.6.8 | 08-27 / 09-13 / 10-13 | A | низкий | брать | https://registry.npmjs.org/@testing-library/react |
| Моки | `msw` 3.0.3 (peer `typescript >=5.9`, `vite >=6`) | 2026-10-10 (3.0: 09-28) | A | низкий | брать | https://github.com/mswjs/msw/releases |
| E2E | `@playwright/test` 1.64.1 (образ `mcr.microsoft.com/playwright:v1.64.1-noble`) | 2026-10-14 | A (Microsoft) | низкий (минор/мес.) | брать, версия пакета = версия образа | https://registry.npmjs.org/@playwright/test |
| Storybook | `storybook` / `@storybook/react-vite` / `@storybook/addon-vitest` 10.6.2 | 2026-10-12 | A | средний: 11.0.0-alpha.6 | брать; Vitest 5 официально в peer | https://registry.npmjs.org/@storybook/addon-vitest |
| Ошибки | `@sentry/react` 11.7.0 (+ TanStack Router tracing integration) | 2026-10-12 (11.0: 09-23) | A | низкий | брать, lazy | https://registry.npmjs.org/@sentry/react |
| Метрики | `web-vitals` 6.2.3 | 2026-10-05 | A | низкий | брать (RUM в Sentry/свой endpoint) | https://registry.npmjs.org/web-vitals |
| React Compiler | `babel-plugin-react-compiler` 1.0.0 (OFF) | 2025-10-07 | A | — | выключен; `eslint-plugin-react-hooks` 7.1.1 содержит compiler-правила — включать выборочно | https://registry.npmjs.org/babel-plugin-react-compiler |
| Образ | `nginx:1.30.6-alpine` (stable; mainline 1.31.7) / `nginxinc/nginx-unprivileged:stable-alpine`; сборка `node:24.21.0-alpine` | 2026-10-14 / 09-18 | A | низкий | брать stable, пин digest | https://hub.docker.com/_/nginx |

### 2. Детали по ключевым пунктам

**2.1 MobX 7 (факт).** Релиз 7.0.0 2026-07-30 (PR #4671, kubk): Proxy-only (ES5-фолбэк удалён — для всех целевых
браузеров не важно), legacy-декораторы удалены, `trace` удалён (вместо — `spy`, `getDependencyTree`, `mobx-log`),
неймспейсы → именованные экспорты (`observable.ref` → `observableRef`, `computed.struct` → `computedStruct`,
`action.bound` → `actionBound`, `comparer.structural` → `compareStructural`). Бандл 17.0 → 14.0 KiB gz.
mobx-react-lite 5: React ≥ 18, убраны batching-импорты; 5.1.0 (2026-09-24) чинит утечку реакций при прерванных
(suspended) рендерах. Последствия (мнение): (а) модели обучены на MobX 6 и будут писать `observable.ref` — это
ошибка типов, ловится `tsc`; добавить в rules таблицу замен; (б) с `makeAutoObservable` в plain-классах миграции нет;
(в) все сторонние MobX-пакеты проверять на peer `^7` (mobx-utils и mobx-tanstack-query — нет).

**2.2 Мост MobX ↔ Query.** Факты: `mobx-tanstack-query` 7.3.0 — классы `Query`/`Mutation`/`InfiniteQuery` поверх
`@tanstack/query-core`, peer `mobx ^6.12.4`, `@tanstack/query-core ^5.90.2`; deps `yummies`, `linked-abort-controller`;
unpacked 332 KB; автор в #91 (2026-08-02): поддержка MobX 7 сломает совместимость, будет «следующим мажором» после
фич. Мнение: свой `MobxQuery v2` дешевле зависимости. Минимальный контракт:
- конструктор `(queryClient, () => options)`; внутри `QueryObserver`; `result` хранится как `observableRef`;
- подписка `observer.subscribe` только в `onBecomeObserved`, отписка в `onBecomeUnobserved` (API ядра MobX 7) — это
  снимает класс гонок «подписались до монтирования / не отписались» из xRocket (риск #2 плана);
- `reaction(getOptions → observer.setOptions)` для зависимых ключей; `refetch()`, `dispose()`;
- `MobxMutation` на `MutationObserver` аналогично; входные options — прямо из генератора (`getXQueryOptions`).
Тесты: на `QueryClient` + MSW без React.

**2.3 API-генератор.** Факты: Hey API — 5.38 M загрузок/нед. (vs Orval 2.45 M), но latest 0.99.0 от 2026-06-22,
далее только `next`-теги (последний 2026-09-30); в issue #4235 (TS 7) с 2026-07 просят stable, 2026-10-13 снова
«any chance of getting a new release to latest?»; peer `typescript >=5.5.3 || >=6.0.0` (TS 7 не в диапазоне);
`@hey-api/client-fetch` как пакет deprecated (клиент встроен в openapi-ts — плагин остался). Orval 8.43.0: 4 релиза
за 10 дней, генерирует `getXQueryOptions`/`getXQueryKey` (плоские объекты — подходят и для `QueryObserver`, и для
router `loader`), Zod 4, MSW-хендлеры + faker (закрывает `packages/mocks`). Мнение: популярность Hey API выше, но
для бойлерплейта, который будут обновлять через `--update latest`, важнее ритм stable-релизов. Решение — smoke на
одной спеке (Medusa + тестовая admin-спека): размер кода, `operationId` в ключах, Zod, моки, TS 7.

**2.4 TanStack Router: code-based vs file-based.** Факт: «automatic code-splitting is ONLY available when you are
using file-based routing»; в code-based — ручной `createLazyRoute` + `.lazy()` (двойной файл на маршрут). Факт:
virtual file routes позволяют описать дерево в коде (`rootRoute`, `route`, `layout`, `physical`), в том числе
поддиректорией через `__virtual.ts`. Предложение (мнение, проверить smoke): `app/routes.ts` — virtual config, который
импортирует `domains/<d>/routes.ts` (каждый — `route('/orders', 'domains/orders/pages/OrdersList/route.tsx', …)`).
Так сохраняется «таблица роутов на домен», генерация типов и авто-split. Поиск: `validateSearch: zodSchema` напрямую,
`.catch()` для дефолтов, `retainSearchParams`/`stripSearchParams` middlewares.

**2.5 Формы с MobX VM.** Мнение: состояние полей держит RHF (не дублировать в MobX); VM даёт `defaultValues`
(computed), `submit(values)` возвращает результат/ошибки 422 → `setError` по `field` из маппинга. Запрет `watch()` в
пользу `useWatch` оставить (даже без Compiler — меньше перерисовок). RHF 8 (alpha с 2025-10-04, beta.4 2026-09-26)
— «год в пререлизе», stable в 12 мес. вероятен → средний риск. Resolver: `@hookform/resolvers/zod` (peer `zod ^4`).

**2.6 Графики.** Recharts 3 (SVG) — дефолт, тянется shadcn chart и токенами; на касании tooltip по тапу работает.
ECharts 6 (canvas) — 10k+ точек, `dataZoom` пинчем на тач-устройствах; обёртка своя (~60 строк, `useEffect` +
`ResizeObserver` + тема из CSS-переменных). Оба живы; замен не нужно.

**2.7 Auth.** oidc-client-ts: 1961★, последний релиз 2026-03-13, коммиты до 2026-09-01 — жив, но медленный (B).
Альтернатив с лучшим здоровьем для чистого SPA нет (мнение). BFF: `openid-client` 6.8.8 + Hono 4.13 (≈200 строк) или
oauth2-proxy 7.15.5 как контейнер-сайдкар (cookie-сессия, `--pass-access-token`/`--set-authorization-header` к API) —
меньше своего кода, но меньше контроля над refresh/CSRF. Порог BFF (из 05d, IETF draft-26): клиентские SaaS-кабинеты,
финансы, ПДн → BFF.

**2.8 Переходы экранов.** Факт: Router поддерживает `defaultViewTransition` (true или объект с `types` по индексу
истории — направление slide). Мнение: VT API — прогрессивное улучшение (нет поддержки → навигация без анимации);
план отказался от VT из-за iOS < 18. Предлагаю оставить свой `ScreenTransition` (CSS enter-анимация ~240 мс,
`prefers-reduced-motion`) как базу, а `defaultViewTransition` — флагом после замера на iOS 18+ (меньше кода для
exit-анимаций).

**2.9 Тесты.** Vitest 5 breaking: Node 22+, Vite ≥ 6.4, удалён `sequential` (→ `concurrent`), locator — объект,
`expect.poll` падает по таймауту, hoist-методы только на верхнем уровне. Storybook 10.6.2 addon-vitest принимает
Vitest 5 (peer). MSW 3 требует TS ≥ 5.9 — совпадает с планом «TS 5.9 на старте».

## Recommendations for the boilerplate

1. **Состояние**: `mobx` 7.0.x + `mobx-react-lite` 5.1.x; свой `MobxQuery v2`/`MobxMutation` на `query-core`
   с подпиской через `onBecomeObserved`; запрет импорта `mobx-tanstack-query` и `mobx-utils` (lint); таблица замен
   MobX 6→7 в rules.
2. **API-генератор**: smoke Orval 8.43 vs Hey API (`next` или 0.99) в волне 0; дефолт — Orval, если smoke не покажет
   блокеров (активность + моки). Hey API оставить вторым. Exact pin любого.
3. **Router**: virtual file routes вместо чистого code-based, чтобы не потерять авто-split; без `@tanstack/zod-adapter`.
4. **Таблицы/графики/формы**: как в плане (Table 9.3 + Virtual 3.14, Recharts 3.10 / ECharts 6.1 опц., RHF 7.90 +
   Zod 4.6). RHF 8 — отдельный PR при stable.
5. **Auth**: PKCE по умолчанию за адаптером `app/auth`; `--bff`: Hono 4.13 + openid-client 6.8 (пин 4.x до выхода
   Hono 5 + 7 дней) или oauth2-proxy как вариант без кода.
6. **Тесты**: Vitest 5.0.4 + browser-playwright, Storybook 10.6.2 + addon-vitest (риск снят), MSW 3.0.3, Playwright
   1.64.1 (образ той же версии), jsdom 30 по умолчанию.
7. **Образ**: `nginx:1.30.x-alpine` stable (или unprivileged) по digest; сборка на `node:24.21-alpine`.

## Open questions for the user

1. Готов ли сменить дефолтный генератор API с Hey API на Orval, если smoke подтвердит (Hey API 4 месяца без stable)?
2. BFF-опция: свой Hono-сервис (контроль) или oauth2-proxy (меньше кода)?
3. Разрешить View Transitions как прогрессивное улучшение (iOS 18+), оставив CSS-переход базой?

## Что изменилось против мастер-плана

- «MobX 7» подтверждён (7.0.6); готовый мост `mobx-tanstack-query` несовместим с MobX 7 → свой `MobxQuery v2` теперь
  обязателен, а не выбор; `mobx-utils` исключить.
- Hey API из «лидера» в «альтернативу»: застой stable с 2026-06-22; Orval предложен дефолтом (через smoke).
- Code-based routes теряют авто-code-splitting → virtual file routes с `routes.ts` на домен.
- Риск «Vitest 5 ↔ Storybook» снят (peer `^5` в addon-vitest 10.6.2); новые риски 12 мес.: Hono 5 (RC), RHF 8,
  Storybook 11, Motion мажоры каждые ~2 мес.
