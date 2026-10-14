# 02. Технологии xRocket: аудит и применимость к бойлерплейту
Status: done
Updated: 2026-10-14

## Resume notes
- Done: все разделы F0–F10, рекомендации, открытые вопросы; версии сверены с npm registry 2026-10-14.
- Next: —
- Sub-agent: не использовался.

## Summary (≤ 15 lines)
1. xRocket = Nx-монорепо из 3 таргетов: `apps/mobile` (TMA, Vite SPA через **React Native Web**), `apps/web` (лендинг/SEO-сайт на **Vike + Hono SSR**, Strapi CMS) и почти пустой нативный RN-клиент (`Routes.native.tsx` — 29 строк против 1196 в `Routes.tsx`). Почти вся цена стека — плата за этот RN, которого у нас не будет.
2. **Тянуть в бойлерплейт как есть (универсально):** pnpm-workspace с `minimumReleaseAge` + `allowBuilds` + overrides; openapi-typescript + openapi-fetch (+ TanStack Query); центральный маппинг API-ошибок; i18next с ленивыми неймспейсами + скрипты проверки полноты; Vitest; Playwright smoke + visual с baseline в Docker; knip (но в CI); husky/lint-staged (лёгкий pre-commit); Sentry с вырезанием PII; runtime-env injection в Docker; build-info/`X-Build`; многостадийный Dockerfile.
3. **Только для конкретных шаблонов:** Vike/Hono SSR (лендинг, магазин), TON Connect и Telegram SDK (TMA), bignumber.js (финансы/магазин), lightweight-charts/TradingView (админка/финансы), maskito (формы магазина/админки), обфускатор и антифрод (финтех).
4. **Вставит палки в колёса (не брать):** Tamagui + react-native-web + React Navigation на вебе; moti/reanimated-моки; MobX + tsyringe + `reflect-metadata` + legacy-декораторы (требуют SWC/Babel-хаков и inline-полифилла под Rolldown); Redux legacy; Consta; два OpenAPI-генератора (axios + fetch); Nx в режиме «обёртка над run-commands»; vike-photon (официально deprecated с 2026-04-21).
5. Счётчики боли (только исходники, без generated): 499 `eslint-disable` (222 — своё правило `no-store-in-page-view`), 152 `@ts-ignore/@ts-expect-error` (88 голых `@ts-ignore`), 85 `as any`, 10 mock-модулей для RN-пакетов на вебе, 5 patch-файлов (2 из них молча не применяются после перехода на pnpm 11), 8+ мёртвых зависимостей (socket.io-client, decimal.js, react-imask, @splinetool/*, react-router-dom, jsdom, raf, ssr-window).
6. **Замены:** стили — Tailwind CSS v4 (4.3.x) + CSS-переменные токенов и headless-примитивы (Radix/Base UI/React Aria); SSR — Vike 0.4.26x с `+server.ts` + `@vikejs/hono` (Universal Deploy) или React Router 8 framework mode; состояние — TanStack Query для серверного + Zustand/хуки для клиентского (без DI); TMA SDK — `@tma.js/sdk-react` 3.x вместо замершего `@twa-dev/sdk` (последний релиз 2025-02); монорепо — pnpm workspaces (+ Turborepo по желанию) вместо Nx.

## Findings

### F0. Карта репозитория (проверено)

| Что | Где | Факт |
|---|---|---|
| Монорепо | `nx.json`, `pnpm-workspace.yaml` | Nx 22.6.1, pnpm 11.1.2 (`packageManager`), Node `>=22.12` (`engines`), `.nvmrc` = 22.13.0, Docker = `node:24.11.1-alpine3.22` — три разных Node |
| TMA (SPA) | `apps/mobile` (package `@xrocket/mobile`) | Vite 8 + `@vitejs/plugin-react-swc` + `vite-plugin-react-native-web` + Tamagui; nginx-образ; 566-строчный `vite.config.mts` |
| Сайт (SSR) | `apps/web` (package называется `@xrocket/tma`, Nx-проект `@xrocket/web` — путаница имён) | Vike 0.4.247 + vike-photon + Hono 4.12; кастомный `renderer/+onRenderHtml.tsx` (vike-react используется только ради хуков) |
| Общий код | `libs/main` (≈2500 файлов), `libs/tamagui` (конфиг/токены/анимации), `libs/i18n/locales.ts` | `libs/main` импортируется исходниками (`exports` → `./src/index.ts`), без сборки |
| Нативный RN | `apps/mobile/android`, `ios`, `*.native.tsx` (20 файлов) | 16 коммитов за год, последний «[DEV-4077] Reanimate RN» (2026-10-02) — фактически заготовка |
| Зависимости | корневой `package.json` | ~120 deps + ~150 devDeps в ОДНОМ корневом файле; `apps/mobile/package.json` перечисляет ~100 пакетов со `"*"` (дубль ради Nx) |

Активность: 5307 коммитов за последние 12 месяцев; 88 из них прямо про tamagui/rnw/ssr/hydration (в т.ч. перевод лендинга со SCSS на Tamagui: DEV-3519, DEV-3523, DEV-3681).

### F1. Сборка и рантайм

**React 19.1.0** (сейчас 19.3.0). Используется стандартно. Боль: `@ts-ignore react 19 has issue with type here`, `@types/react-dom` 19.2 при `react-dom` 19.1 — мелкий рассинхрон. React Compiler не включён. → (a) универсально.

**Vite 8.0.8 (Rolldown)** (сейчас 8.3.4). Хорошее: `build.target: 'safari15'` (WebView Telegram на iOS), `esbuild.pure: ['console.log']`, `cssCodeSplit: false` на SSR-сайте с обоснованием (17 блокирующих CSS → 1), `buildInfoPlugin`, `rollup-plugin-visualizer`/`vite-bundle-analyzer` по флагу.
Плохое — почти всё из-за RN/DI:
- `apps/mobile/vite.config.mts:39–113` — свой резолвер `skipWebExtForSource`, чтобы `.web.ts` из `libs/main` не попадали в TMA (они для Vike), а `.web.js` из node_modules попадали.
- `:115–125` — inline-скрипт `@abraham/reflection` в `<head>`, потому что Rolldown не гарантирует порядок выполнения полифилла `Reflect.getMetadata` до тела `tsyringe` (DEV-2797).
- `useAtYourOwnRisk_mutateSwcOptions` → `legacyDecorator + decoratorMetadata` в обоих конфигах (нужно для tsyringe).
- `define: { global: 'window', __DEV__, DEV, 'process.env': {} }` — RN/Tamagui-окружение.
- 10 алиасов-моков: `apps/web/mock_modules/*` (reanimated, keyboard-controller, safe-area-context, normalize-color, is-edge-to-edge, validate-worklets-version, zoom-reanimated, react-navigation-native, `@twa-dev/sdk`, шрифт Consta).
- `ssr.noExternal` с 15 пакетами (`/^react-native.*/`, `/^@tamagui.*/`, redux, consta…), `ssr.optimizeDeps.rolldownOptions.external: ['react', …]`, иначе RNW вшивает вторую копию React и SSR падает на `useRef` (`apps/web/vite.config.mts`, комментарий в `ssr.optimizeDeps`).
- `globalThis.self = globalThis` в `apps/web/server/index.ts` — полифилл для reanimated на сервере.
- `isNxGraphBuildScan`: при сканировании графа Nx плагин Vike роняет резолв конфига, поэтому vike() отключается.
- Обфускатор `vite-plugin-javascript-obfuscator` точечно на `features/createSignature/**` с `domainLock` — нишевое (финтех).
→ Vite — (a); вся «обвязка» вокруг — (c).

**Vike 0.4.247 + vike-photon 0.1.21 + @photonjs/hono + Hono 4.12** (`apps/web/renderer/+config.ts`, `apps/web/server/index.ts`).
Хорошее: `stream: true`, `clientRouting`, `hydrationCanBeAborted`; Hono-middleware делает SEO-редиректы из CMS (301/302 до рендера), нормализацию слэшей, `/sitemap.xml` (склейка из Strapi), `/robots.txt` (скрывает выключенные локали), заголовки кэша (`/assets/` immutable на год, шрифты/картинки год), `X-Build` на каждом ответе, `Cache-Control: no-store` для `build-info.json`; ошибки стрима — в Sentry. Request-scoped DI-контейнер и QueryClient на каждый SSR-запрос (`libs/main/src/common/shared/lib/requestScope.ts`). Отложенная загрузка GTM по первому взаимодействию/4 с — заметный выигрыш TBT. Тесты на redirects/robots/sitemap.
Плохое:
- vike-photon **официально deprecated** (блог Vike «Universal Deploy», 2026-04-21): замена — `+server.ts` + `@vikejs/hono`; vike-server тоже устарел, но всё ещё в deps ([vike.dev/blog/universal-deploy](https://vike.dev/blog/universal-deploy), [vike.dev/migration/server](https://vike.dev/migration/server)).
- Хак `process.argv[1] = fileURLToPath(import.meta.url)` в `server/index.ts`, потому что vike-photon ищет client-статику относительно `argv[1]`.
- `+config.ts` транспилируется отдельным esbuild без алиаса `@/` → файлы, которые он импортирует, обязаны быть «без импортов» (`libs/i18n/locales.ts`, `apps/web/src/shared/lib/i18nNamespaces.ts`); вложенный `+config.ts` перетирает родительский по ключу (стоило сырых ключей i18n в проде, см. `libs/main/src/common/shared/i18n/README.MD`).
- Кастомный `onRenderHtml` (≈200 строк) собирает head руками: темы, шрифты-preload, runtime-env, GTM, preconnect — гибко, но всё на проекте.
- `apps/web/biome.json` и README от `create-vike --biome` — мусор от скаффолда, Biome не используется.
→ Vike/Hono — (b) для лендинга/магазина; при переносе — сразу на Universal Deploy.

**Hono** — (b) как сервер SSR/прокси; легко держать в Docker на своих серверах.

**Nx 22.6.1** (сейчас 23.3.0). Реально: `nx run-many -t test/lint`, `nx run web:build`/`mobile:build` в Dockerfile; почти все таргеты — `nx:run-commands` (`apps/web/project.json`), `useDaemonProcess: false`, нет `affected`, нет remote cache, `@nx/jest` плагин при том что тесты на Vitest, генераторы настроены на `scss`/`babel` (устарели), `analytics: false`. Корневой `pnpm lint` вообще делает `cd libs/main && eslint . && cd ../../apps/web …` в обход Nx. Боль из `docs/tooling.md` бойлерплейта: «`nx reset` лечит Maximum call stack size exceeded». `@nx/react-native` плагин тянется ради RN.
→ (c) в таком виде: польза (кэш, affected) не используется, цена (плагины, граф, хак в vite.config, дубль deps в `apps/mobile/package.json`) — платится. Для нас достаточно pnpm workspaces (`pnpm -r --filter`), опционально Turborepo 2.11 ради кэша.

**pnpm 11.1.2** (сейчас 12.11.2). Лучшее в репо:
- `pnpm-workspace.yaml`: `minimumReleaseAge: 10080` (7 дней, supply-chain), `minimumReleaseAgeExclude` с объяснением, `allowBuilds` (явный allowlist install-скриптов), overrides для CVE (`qs`, `lodash`, `hono`, `picomatch`…) и пины семейства `@tamagui/*`.
- Комментарий-находка: «pnpm 10+ читает настройки только отсюда: package.json#pnpm игнорируется (обнаружено 2026-07-10: patchedDependencies и overrides из package.json молча не применялись с перехода на pnpm 11, 2026-05-12)». В `package.json#pnpm` до сих пор лежат мёртвые overrides и патчи consta/moti.
- Комментарий к патчу `@tamagui/vite-plugin@2.4.6` («Sheet: фикс дёрганья… при переезде на 2.2+ удалить») не соответствует содержимому патча (он про резолв `@tamagui/react-native-svg` в ESM) и версии (2.4.6 > 2.2) — дрейф комментариев.
- `engines.pnpm >=10.33` vs `packageManager pnpm@11.1.2` — расхождение.
→ (a); брать практики, не версии.

**TypeScript 5.5.4** — сильно отстаёт (сейчас 7.0.2, нативный компилятор). Typecheck идёт четырьмя `tsc` в pre-commit (медленно). → (a), но на свежей версии.

### F2. UI и стили: Tamagui + React Native Web (главный компромисс)

Факты использования:
- Tamagui 2.4.6 (пины через overrides), 974 файла импортируют tamagui; `libs/tamagui/src/{tamagui.config,tokens,themes,fonts,animations*.ts}`; 245 файлов ещё на SCSS-модулях, 137 на Consta (legacy), 81 на `classnames`.
- 92 файла `from 'react-native'`, 140 — `@react-navigation/*`: **на вебе (TMA) навигация = React Navigation stack** (`libs/main/src/app/Routes.tsx`, `createStaticNavigation` в `App.tsx`), с `cardStyle: { flex: 1 }` как обходом бага react-navigation#4939.
- Два драйвера анимаций, которые «нельзя слить»: `@tamagui/animations-moti` (только с reanimated) и `@tamagui/animations-css` (мёртв в настоящем RN) → `animations.shared.ts` генерирует оба (`libs/tamagui/src/animations.shared.ts:1–20`).
- Компилятор Tamagui в TMA выключен (`disableExtraction: true`, `optimize: false` через `@ts-expect-error`), на SSR-сайте включён только в проде (ответ HTML 1400 → 1189 KB, комментарий в `apps/web/vite.config.mts`). Пустой `componentThemes` срезал inline CSS 549 → 165 KB (`docs/library-notes.md` бойлерплейта).
- Типы врут: `WEB_POSITION_FIXED = { position: 'fixed' as unknown as '-webkit-sticky' }` («still broken in @tamagui/web 2.7.4», `libs/main/src/common/shared/lib/platform/webStyles.ts`); 4× «Tamagui web style prop is available at runtime but missing in stack typings»; `libs/main/rnw-overrides.d.ts` дописывает RN-типы под RNW (`href`, `onClick`, `hovered`).
- Storybook: Vite отдавал две копии `@tamagui/use-presence` → `exitStyle` не проигрывался; лечится `dedupe` + `optimizeDeps.exclude` 7 пакетов (`.storybook/main.ts`).
- 61 `eslint-disable xrocket/no-inline-styles-tamagui-aware`, 34 `react-native/no-raw-text`; свои правила `tamagui-style-props.js`, `no-color-literals-tamagui-aware`, `no-transition-property-all`, `no-viewport-height`.
- Список RNW-ловушек (уже записан в `docs/library-notes.md` бойлерплейта): `ScrollView.scrollTo` с RN-сигнатурой, `className` выкидывается, `onLayout` через ResizeObserver, `keyboardType` игнорируется, `flex: 1` схлопывается и т.д. Всё это — отсутствующие на чистом вебе проблемы.
- Состояние экосистемы: Tamagui 3 вышел 2026-10-09 (новый native runtime, flat style props, React Strict DOM, Tailwind-синтаксис) — xRocket на major позади, миграция 2→3 снова на проекте ([tamagui.dev/blog](https://tamagui.dev/blog)). Сам Tamagui с v1 умеет web-only без RNW, но xRocket тащит RNW ради RN-компонентов и навигации.

Хорошее, что стоит перенять как идею (не библиотеку): токены `$color1..12` с дочерними темами, медиа-токены `$gtMobile/$gtTablet/...`, `*.styled.ts` рядом с компонентом, варианты вместо тернарников, критический CSS темы + `theme-init` скрипт до гидрации (без мигания темы).

Оценка: (c). Для web-only это чистый overhead: RNW-слой, моки, двойные драйверы анимаций, ложные типы, дубли пакетов, SSR-хаки. Замена — см. «Рекомендации» §1.

**Иконки:** `@tamagui/lucide-icons-2` + `@tabler/icons-react-native` + генератор `generate-tabler-icons.mjs` (6k deep-импортов, тормозили Storybook). На вебе — `lucide-react` или `@tabler/icons-react` напрямую. (a) как идея «иконки из библиотеки», (c) как RN-пакеты.

### F3. Состояние: MobX + tsyringe, Redux legacy, MobxQuery

- **MobX 6.13.7** (сейчас 7.0.6) в 611 файлах; MVVM: `@provide.singleton()` store, `@provide.transient()` VM (`libs/main/src/common/shared/lib/ioc.ts`). Своё правило `require-viewmodel-autobind`, `require-mobx-default-values`, `observer-named-function`, `no-store-in-page-view` (222 файла его отключают целиком — правило не прижилось).
- **tsyringe 4.10.0** — последний релиз 2025-04 (по npm `time.modified`), требует `reflect-metadata` + legacy-декораторы + `decoratorMetadata` (SWC/Babel-плагины, `babel-plugin-transform-typescript-metadata` для Storybook, inline-полифилл под Rolldown). Для SSR пришлось писать request-scope: `Lifecycle.ContainerScoped`, глобальная переменная `activeContainer` с push/pop и `WeakMap<container, QueryClient>` (`requestScope.ts`). Работает, но это ~100 строк инфраструктуры, понятной одному человеку.
- **MobxQuery/MobxMutation** (`libs/main/src/common/shared/lib/mobxQuery/*`, 512 строк) — мост `QueryObserver` → MobX atom; 255 использований против 151 прямого `$api.useQuery`. В файле длинные комментарии о гонках гидрации (`P2PMarketStore «pre-hydration race»`). Принцип «серверные данные только через query-слой, без зеркальных флагов» — ценный; реализация — дорогая.
- **Redux Toolkit 1.9.7 + redux-persist + react-redux 8** — legacy в 39 файлах (кошелёк: deposit/withdrawal/connectedWallets slices). `App.tsx` держит `TamaguiProvider → Redux Provider → PersistGate → PersistQueryClientProvider`. Два механизма persist (redux-persist и mobx-persist-store через своё SSR-safe API + правило `no-direct-persist-import`).
- `use-immer`, `use-local-storage-state`, `use-session-storage-state` — точечно.
→ MobX+DI — (c) для нас (декораторы, полифиллы, SSR-scope); Redux — (c) legacy. Принципы (VM без навигации, логика вне view, тесты VM через конструктор с фейками) — (a), но реализуемые на хуках/Zustand.

### F4. Данные и API

- **openapi-typescript 7.13 + openapi-fetch 0.14.1 + openapi-react-query 0.5.0** (`libs/main/src/common/shared/api/api.ts`): 9 клиентов (по сервису), `credentials: 'include'`, ленивый `fetch` (чтобы eruda могла перехватить). Генерация `tools/scripts/api/openapi-generator.sh` (curl swagger с поддельными браузерными заголовками → `openapi-typescript --root-types` → prettier → eslint). 45 724 строки в `generated/*.ts`.
- **Старый генератор** `openapi-generator-old.sh` → `@openapitools/openapi-generator-cli -g typescript-axios` (нужна Java), 11 папок `api/<service>/` с `git_push.sh` внутри, axios + axios-retry; 57 файлов всё ещё на axios, ~89 вызовов старого SDK. Два генератора параллельно = двойная цена.
- **Генератор маппинга ошибок** `tools/scripts/xrocket-tools/xrocket-tools-generator.mjs` (читает внутреннюю CMS по токену из `.env`) → `errors/mappings/*.generated.ts`: endpoint × method × status × problem type → toast/modal/silent + i18n-ключ; middleware в `errors/middleware.ts`. Лучшая идея репо в API-слое.
- Типы ошибок выводятся из `paths` (`api.ts`, `ExchangePathError`…) — но с `any`.
- **TanStack Query 5.59.15** (сейчас 5.104.x) + `query-persist-client` 5.100 (рассинхрон минорных версий внутри семейства) + `@tanstack/eslint-plugin-query`.
- **WebSocket**: `ExchangeSocketService` на нативном `WebSocket` с reconnect/ping/health-check и MobX-флагом. `socket.io-client` 4.8.3 в deps, но **не импортируется нигде** — мёртвая зависимость (в `CLAUDE.md` xRocket заявлен как «WebSocket communication»).
- Визуальные тесты типизируют моки из OpenAPI (`tests/visual/web/p2p/p2p.visual.spec.ts`: `Json200<'/api/v1/p2p/ads'>`) и ловят расхождение схемы с реальностью (комментарий «OpenAPI описывает один объект… а API ждёт массив»).
→ openapi-typescript/openapi-fetch/TanStack Query — (a). Альтернативы-генераторы: `@hey-api/openapi-ts` 0.99 (ещё 0.x) и `orval` 8.42 — генерируют сразу query-хуки/zod; для нас openapi-fetch проще и стабильнее, а маппинг ошибок — свой.

### F5. i18n

- **i18next 25.7.2 + react-i18next 16.4** (сейчас 26.4/17.0), `i18next-resources-to-backend` для ленивых неймспейсов; eager только `notSorted` (defaultNS) и `common`. 634 файла используют i18n.
- Каталоги `libs/main/src/common/shared/i18n/translations/{en,ru,zh}/*.json` (15 неймспейсов) + сводная папка `all/` («ключ: {en, ru, zh}») с `sync-i18n.mjs split/merge/sync` в pre-commit — удобно для ручной правки, но это третий формат рядом с Crowdin.
- **Crowdin** (`crowdin.yml`, 14 одинаковых блоков вместо glob `en/*.json`) — только для app-каталогов; сайт поддерживает 14 локалей (`libs/i18n/locales.ts`: `enabledWeb`/`enabledApp`, ru за runtime-флагом).
- Инварианты: правило `xrocket/require-i18n-namespace`, тест `namespaceUsage.test.ts`, `check-i18n-completeness.mjs` (с baseline-файлом известных пробелов), `check-i18n-web.mjs`, `measure-i18n-bundle.mjs`, smoke-тест «на странице нет сырого ключа», `pageNamespaces.test.ts` для Vike.
→ (a). Альтернативы с типобезопасностью ключей на этапе компиляции: Paraglide JS 2.27 (компилирует сообщения в функции, tree-shaking), Lingui 6.9. Для мультишаблонного бойлерплейта i18next остаётся самым безопасным выбором (экосистема, Crowdin/Locize, SSR); типизацию ключей даёт `i18next` `CustomTypeOptions`.

### F6. Качество: тесты, линт, хуки

- **Vitest 4.1.2** (сейчас 5.0.4), общий `vitest.preset.ts` (junit + cobertura в CI, lcov локально, мок `?react` SVG), 159 тестовых файлов. Тесты VM/стора через конструктор без DOM. (a)
- **Jest 30 + ts-jest + @nx/jest** — висят в devDeps ради RN (тесты RN), в вебе не нужны. (c)
- **Playwright 1.59** (сейчас 1.64): `tests/smoke/{web,mobile}-runtime.spec.ts` против собранного `dist` (реальный `node dist/apps/web/server/index.mjs`), системный Chromium в Alpine; visual — только 1 спека (p2p) × 2 темы × 3 ширины = 6 PNG, baseline генерится в Docker-образе поверх `web_builder` (`tools/visual/Dockerfile`, `update-web-visual-baselines.sh`) для побайтового совпадения с CI. Идея (a), покрытие мизерное.
- **Storybook 10.3.5** на `@storybook/react-native-web-vite` (+ on-device addons для RN), 66 stories на ≈2500 файлов, переиспользует `apps/mobile/vite.config.mts`; визуальный прогон stories (`run-storybook-visual.mjs`). Для веба — `@storybook/react-vite`. (a) как инструмент для UI-кита, (c) в RNW-варианте.
- **ESLint 9.39 flat config** + 21 своё правило в `tools/eslint-rules/*` (с тестами) + ~20 плагинов; GitLab-форматтер для code quality. Ценность высокая, цена: блоки flat-config перетирают друг друга (отчёт 06), 499 disable. `eslint-plugin-react-native` — (c).
- **knip 6.0.6** — два конфига (`knip.json` и `knip.jsonc`; knip берёт первый, второй — мёртвый), `knip:ci` есть в scripts, но в CI не вызывается (`.gitlab-ci.yml` запускает только lint/unit/runtime/visual) — отсюда 8+ мёртвых зависимостей. (a), но обязательно в CI.
- **husky 9 + lint-staged 16**: pre-commit делает лимит диффа 40k строк, `conflict-pile` (предупреждение о строках, правящихся в других открытых ветках), запрет PNG/JPG (только WebP), sync i18n + `git add`, lint-staged (eslint+prettier, `@prettier/plugin-xml` для SVG), **4 полных `tsc`** — медленно, на Windows особенно. `prepare-commit-msg` подставляет тикет. (a) идея, но typecheck перенести в CI/pre-push.
- `unplugin-turbo-console`, `react-dev-inspector` (клик по элементу → файл) по env-флагу — удобные DX-игрушки, (a) опционально.

### F7. Наблюдаемость и аналитика

- **@sentry/react 8.55.1** (сейчас 11.7.0 — три major позади) + `@sentry/vite-plugin` 5.1.1; бэкенд — self-hosted **GlitchTip** (комментарий в `vite.config.mts`). Хорошее: ленивый `import('@sentry/react')`, release = `buildInfo.release` синхронно с загрузкой sourcemaps и удалением `.map` после аплоада; фильтры шума (Telegram WebView логи, ResizeObserver, TON_CONNECT aborted, Amplitude fetch); вырезание Telegram `initData` из URL/breadcrumbs/spans (`stripInitData*`). Плохое: Session Replay с `maskAllText: false, maskAllInputs: false` в финансовом приложении — риск PII; `tracesSampleRate: 1.0` в проде. (a) с privacy-by-default.
- **Аналитика**: `analytics` 0.8.19 + `@analytics/google-tag-manager` (TMA, ленивый init за consent, `libs/main/src/common/shared/analytics/index.ts`), GTM inline-скрипт с отложенной загрузкой на сайте, Amplitude 2.5.1 (1 файл), Яндекс Метрика (CSP `frame-ancestors` для Webvisor в `server/index.ts`). `analytics` (DavidWells) почти не развивается; для нас — тонкий свой адаптер `track()` поверх GTM/dataLayer с consent-гейтом. (a) как адаптер, библиотеки — по шаблону.
- **@fingerprintjs/fingerprintjs 4.5**, CreepJS (481 KB в `public/creepjs`), `@marsidev/react-turnstile` (Cloudflare CAPTCHA) — антифрод, (b) финтех/магазин.

### F8. Платформенные интеграции и утилиты

| Пакет | Использование | Оценка |
|---|---|---|
| `@twa-dev/sdk` 8.0.1 | 79 файлов импортируют `WebApp` напрямую (нет адаптера, кроме `lib/tma/index.ts`); на SSR подменяется моком `twa-dev-sdk-mock.ts`. Пакет не обновлялся с 2025-02 | (b) TMA, но заменить на `@tma.js/sdk-react` 3.0.23 / `@tma.js/sdk` 3.3.0 (релизы 2026-10) и читать SDK в одном месте |
| `@tonconnect/ui-react` 2.3.1 | Опт-ин через HOC `withTonConnectUIProvider` (2 файла), манифест с `${VITE_MANIFEST_URL}` подставляется envsubst в контейнере | (b) TMA/web3; текущая 5.0.1 — 3 major позади |
| `@telegram-auth/react` | логин через Telegram на вебе | (b) |
| `bignumber.js` 11.0 | 43 файла, основной; `BigNumber.config` глобально в `formatNumber.ts` + `clone()` локально — глобальная конфигурация опасна | (b) финансы/магазин (деньги) |
| `decimal.js` | 0 импортов, хотя CLAUDE.md пишет «legacy, мигрируем» | мёртвая |
| `dayjs` 1.11.10 | 26 файлов, плагины utc/timezone/relativeTime/calendar/localizedFormat + локали en/ru/zh | (a); альтернатива `date-fns` 4.4 или `Intl.*` (14 файлов уже на Intl) |
| `@maskito/*` 1.9 | 3 инпута (Currency, MaskedDecimals) | (b) формы; текущая 5.6 — 4 major позади; `react-imask` в deps — мёртвый дубль |
| `react-hook-form` 7 + `zod` 4 | 8 и 4 файла — второй, недокументированный паттерн форм рядом с VM-state | (a) RHF+zod (или TanStack Form) как единственный паттерн |
| `lightweight-charts` 4.1, TradingView `charting_library` (vendor, 4 MB) | графики биржи | (b) админка/финансы |
| `swiper`, `embla-carousel-react` 8.0.0-rc15 | два карусельных пакета | (b) лендинг; выбрать один (Embla) |
| `lottie-react`, `@splinetool/*` | 9 файлов / 0 импортов | (b) лендинг; spline мёртв |
| QR: `react-qr-code`, `@yudiel/react-qr-scanner`, `zxing-wasm`, `barcode-detector` | 10 файлов | (b) TMA/кошелёк |
| `react-native-gifted-chat` (+патч), `@gorhom/bottom-sheet`, `react-native-reanimated`, `moti`, `react-navigation`, `solito`… | RN-пакеты, работающие на вебе через моки/патчи | (c) |
| `crypto-js`, `jose`, `base-x`, `murmurhash-js` | подписи/хеши | (b); `crypto-js` заменим на WebCrypto |
| `cheerio`, `jsdom` в `dependencies` | серверный парсинг (1 файл) / не используется | `jsdom` мёртв в prod-deps; раздувает Docker `web`-образ |
| `@consta/uikit` 5.19 | 137 файлов legacy + мок шрифта (930 KB в проде, комментарий в `apps/web/vite.config.mts`) | игнорируем по брифу |

### F9. Инфраструктура: Docker, werf, Helm, CI

- **Dockerfile** — многостадийный: `base` → `production_dependencies` → `development_dependencies` → `mobile_builder`/`web_builder` → итоговые `mobile` (nginx 1.29 + `env.sh`), `web` (Node, `entrypoint.sh` → `env.sh` → `node server/index.mjs`), `storybook` (nginx), `development` (образ для тестов в CI, с Chromium). Хорошо: build-args только в builder-стадиях (кэш зависимостей не инвалидируется), `setcap cap_net_bind_service` для порта 80, `NODE_OPTIONS=--max-old-space-size-percentage=80`.
- Плохо: `web`-образ = `production_dependencies` (полный prod-набор корневого `package.json`, включая react-native, tamagui, consta, jsdom) — тяжёлый образ, хотя Vike-сборка могла бы бандлить сервер; `apk upgrade` в base ломает воспроизводимость; приватный npm-реестр (`@xrocket:registry`) с токеном через build-arg (виден в истории слоёв — лучше `--mount=type=secret`).
- **Runtime env**: `vite-plugin-runtime-env` переписывает `import.meta.env.VITE_*` в `window.env.*`, в контейнере `env.sh` делает `envsubst` по allowlist `VITE_*` в `index.html` и `tonconnect-manifest.json`. Один образ на все стенды — (a). Боль: compile-time флаги приходится исключать (`ignoreEnv: ['VITE_XROCKET_WEB_APP']`), иначе `define` не срабатывает (комментарий в обоих vite-конфигах).
- **werf + Helm** (`werf.yaml`, `.helm/`, 4 окружения testnet/staging/pre-production/production, `.k8s-gitlab-ci/*.yaml`), деплой по git-тегам (`pnpm tag:production` → `production-YYYYMMDDHHMMSS`). CI полностью вынесен в чужой репо `infra/pipeline` (include-шаблоны) — локально не воспроизводится. Тонкость werf: build-args входят в digest, поэтому `PARENT_PIPELINE_IID` пробрасывается в дочерние пайплайны (комментарий в `werf.yaml`). → (b) для k8s; для VPS проще `docker compose` + GitHub Actions/GitLab CI.
- **build-info**: `tools/scripts/write-build-info.mjs` → `buildInfo.json` (версия, номер пайплайна, коммит) → `<meta name="build">`, `X-Build`, Sentry release. (a)
- В CI-тестовом образе нет отдельного typecheck и knip (lint:ci = eslint + i18n-проверки).

### F10. Версии на 2026-10-14 (npm registry, `npm view`)

| Пакет | xRocket | Сейчас | Комментарий |
|---|---|---|---|
| react | 19.1.0 | 19.3.0 | |
| vite | 8.0.8 | 8.3.4 | |
| vike / vike-react | 0.4.247 / 0.6.13 | 0.4.267 / 0.6.29 | vike-photon deprecated |
| hono | 4.12.12 | 4.13.13 | |
| nx / turbo | 22.6.1 / — | 23.3.0 / 2.11.8 | |
| pnpm | 11.1.2 | 12.11.2 | |
| typescript | 5.5.4 | 7.0.2 | |
| eslint | 9.39.4 | 10.12.0 | oxlint 1.88, Biome 2.5 — быстрые альтернативы |
| tamagui | 2.4.6 | 3.0.9 | v3 от 2026-10-09 |
| react-native-web | 0.21.2 | 0.21.4 | |
| tailwindcss | — | 4.3.3 | |
| mobx / tsyringe | 6.13.7 / 4.10.0 | 7.0.6 / 4.10.0 (без релизов с 2025-04) | |
| zustand | — | 5.0.15 | |
| @tanstack/react-query | 5.59.15 | 5.104.2 | |
| react-router | (react-router-dom 6.30, не используется) | 8.4.0 | |
| @tanstack/react-start | — | 1.169.1 | |
| openapi-fetch / openapi-react-query / openapi-typescript | 0.14.1 / 0.5.0 / 7.13.0 | 0.17.0 / 0.5.4 / 7.13.0 | |
| @hey-api/openapi-ts / orval | — | 0.99.0 / 8.42.0 | |
| i18next / react-i18next | 25.7.2 / 16.4.0 | 26.4.4 / 17.0.16 | |
| paraglide-js / lingui | — | 2.27.0 / 6.9.1 | |
| storybook | 10.3.5 | 10.6.2 | |
| vitest | 4.1.2 | 5.0.4 | |
| @playwright/test | 1.59.1 | 1.64.0 | |
| knip | 6.0.6 | 6.41.0 | |
| husky / lint-staged / lefthook | 9.1.5 / 16.4.0 / — | 9.1.7 / 17.6.0 / 2.2.2 | |
| @sentry/react | 8.55.1 | 11.7.0 | |
| @tonconnect/ui-react | 2.3.1 | 5.0.1 | |
| @twa-dev/sdk | 8.0.1 | 8.0.2 (2025-02) | заменить на @tma.js/sdk-react 3.0.23 |
| bignumber.js / dayjs / date-fns | 11.0.0 / 1.11.10 / — | 11.1.5 / 1.11.23 / 4.4.0 | |
| @maskito/core | 1.9.0 | 5.6.0 | |
| socket.io-client | 4.8.3 (не используется) | 4.8.4 | |
| radix-ui / @base-ui/react / react-aria-components / @ark-ui/react | — | 1.8.1 / 1.9.0 / 1.22.1 / 5.39.3 | Base UI переехал в пакет `@base-ui/react` (старый `@base-ui-components/react` застрял на rc) |
| motion | (moti 0.30) | 14.2.0 | анимации для веба вместо moti/reanimated |
| zod / valibot | 4.3.6 / — | 4.6.7 / 1.5.0 | |
| react-hook-form / @tanstack/react-form | 7.79.0 / — | 7.90.0 / 1.33.5 | |
| @tanstack/react-virtual | (react-viewport-list 7.1) | 3.14.19 | |
| astro | — | 7.3.8 | альтернатива для чисто контентного лендинга |

## Recommendations for the boilerplate

Классификация: **(a)** универсально, **(b)** только для отдельных шаблонов, **(c)** мешает при наших решениях.

### Сводная таблица решений

| Технология xRocket | Класс | Решение для бойлерплейта | Почему |
|---|---|---|---|
| React 19 | a | Брать, свежая 19.x, включить React Compiler (проверить на шаблонах) | стандарт |
| Vite 8 | a | Брать, без RN-обвязки | Rolldown, быстрый |
| Vike + Hono SSR | b (landing, shop) | Брать для SSR-шаблонов, сразу на `+server.ts` + `@vikejs/hono` (Universal Deploy), без vike-photon/vike-server | photon deprecated; Hono = свой SSR/прокси в Docker |
| Nx | c | Не брать. pnpm workspaces + `pnpm -r --filter`; Turborepo — опционально для кэша | в xRocket польза не использовалась, цена платилась |
| pnpm + workspace-настройки | a | Брать целиком: `minimumReleaseAge`, `allowBuilds`, overrides в `pnpm-workspace.yaml`, `packageManager`, `engine-strict`; один Node в `.nvmrc`/`engines`/Docker | supply-chain и воспроизводимость |
| Tamagui + RNW + React Navigation на вебе | c | Не брать. Tailwind v4 (CSS-переменные токенов + `@theme`) + headless-примитивы (Radix UI / Base UI / React Aria) в общем `packages/ui`; навигация — роутер фреймворка (Vike) или TanStack Router для SPA | убирает моки, полифиллы, двойные анимации, ложные типы, SSR-хаки; SSR-стили без рантайма |
| MobX + tsyringe + reflect-metadata | c | Не брать. TanStack Query для серверного состояния, Zustand (или контекст+хуки) для клиентского; MVVM-принцип через custom hooks | декораторы/полифиллы/SSR-scope не нужны |
| Redux + redux-persist | c | Не брать | legacy |
| TanStack Query + openapi-typescript + openapi-fetch (+ openapi-react-query) | a | Брать; один генератор, Node-скрипт (не `.sh`), спека из файла/URL в env, генерированные файлы в `.prettierignore`/knip-ignore | типобезопасный контракт с внешним API |
| Маппинг ошибок API (generated) | a | Брать идею: один middleware + таблица `endpoint×status×code → toast/modal/silent + i18n` (без привязки к CMS) | единая UX ошибок |
| axios + openapi-generator (Java) | c | Не брать | второй генератор |
| i18next + ленивые неймспейсы + проверки | a | Брать с проверками полноты/плейсхолдеров/сырого ключа; Crowdin — опционально (конфиг с glob) | переносимо на любой шаблон |
| Storybook | a (для UI-кита) | `@storybook/react-vite` для `packages/ui`, stories с обеими темами | на RNW-варианте не брать |
| Vitest | a | Брать, общий пресет | |
| Playwright smoke + visual в Docker | a | Брать: smoke по собранному артефакту, visual 2 темы × 3 ширины на ключевые экраны каждого шаблона, baseline только из Docker | детерминизм рендера |
| knip | a | Брать и **включить в CI** (один конфиг) | иначе копятся мёртвые deps |
| ESLint + свои правила | a (выборочно) | Минимальный набор + 3–5 своих правил (i18n namespace, токены вместо цветов, запрет прямого persist/SDK); рассмотреть oxlint для скорости | 21 правило и 499 disable — перебор |
| husky + lint-staged | a | Брать, но pre-commit лёгкий (lint-staged, WebP-проверка); typecheck — в CI/pre-push | 4×tsc на коммит дорого |
| Sentry | a | Брать (v11), ленивый init, release = build-info, удаление sourcemaps, фильтр PII по умолчанию, Replay с маскировкой | privacy-by-default |
| Аналитика | a (адаптер) | Свой `track()` поверх dataLayer/GTM с consent-гейтом и отложенной загрузкой GTM | библиотека `analytics` не нужна |
| Telegram SDK | b (TMA) | `@tma.js/sdk-react` 3.x, доступ к SDK через один модуль launch-context | `@twa-dev/sdk` не обновляется |
| TON Connect | b (TMA/web3) | Опт-ин модуль, `@tonconnect/ui-react` 5.x | |
| bignumber.js | b (shop/finance) | Брать для денег, без глобального `BigNumber.config` | |
| dayjs | a | Можно (или date-fns 4 / Intl) — выбрать одно | |
| maskito | b (shop/admin формы) | Брать свежую 5.x, один пакет масок | |
| RHF + zod | a | Единственный паттерн форм | в xRocket два конкурирующих |
| socket.io-client | — | Не брать; нативный WebSocket-сервис с reconnect как в `ExchangeSocketService` — опциональный модуль | в xRocket не используется |
| Runtime env (envsubst) + build-info + `X-Build` | a | Брать | один образ на все стенды |
| Docker multi-stage | a | Брать; `--mount=type=secret` для npm-токена, SSR-сервер с минимальным prod-набором зависимостей, без `apk upgrade` | |
| werf + Helm | b | Не по умолчанию; базово `docker compose` + CI-шаблоны GitHub/GitLab; Helm-чарт опционально для k8s | наши серверы ≠ обязательно k8s |
| Обфускатор, CreepJS, fingerprint, Turnstile | b | Опционально для финтех/магазина | |

### Приоритеты
1. **P0.** Убрать из стека весь RN-контур (Tamagui/RNW/React Navigation/reanimated/moti/RN-моки) — это главный источник хаков в xRocket. Перенести только идеи: токены 1..12 и дочерние темы, медиа-токены, `*.styled`/варианты, бутстрап темы до гидрации.
2. **P0.** Серверное состояние — TanStack Query поверх openapi-fetch с одним генератором и центральным маппингом ошибок; клиентское — без DI и декораторов.
3. **P1.** pnpm-workspace-практики (supply-chain), один Node, knip и typecheck в CI, лёгкий pre-commit.
4. **P1.** SSR-шаблоны — Vike на Universal Deploy (`+server.ts` + Hono); SPA-шаблоны (TMA, admin) — Vite SPA без SSR (TMA открывается внутри Telegram, SEO не нужен).
5. **P2.** Visual/smoke-тесты по шаблону из коробки, Storybook только для общего UI-кита.

### Чего избегать (анти-уроки xRocket)
- Зависимости в одном корневом `package.json` + дубль `"*"` в приложениях → init-скрипт не сможет чисто удалить шаблон. У каждого шаблона свой `package.json` со своими deps.
- Комментарии в конфигах, описывающие не то, что делает код (патч Tamagui), и мёртвые конфиги (`knip.jsonc`, `package.json#pnpm`, `biome.json`) — заявлять только реально работающее.
- Глобальные провайдеры для фич одного экрана (TonConnect сделан правильно — HOC опт-ин).
- Проверки, заявленные в документах, но не вызванные в CI (knip, typecheck).

## Open questions for the user
1. Стили UI-кита: Tailwind v4 + headless-примитивы (Radix/Base UI) — устраивает как замена Tamagui, или нужна CSS-in-TS с типизированными токенами (vanilla-extract / Panda)?
2. Клиентское состояние: принимаем «TanStack Query + Zustand/хуки, без DI и MVVM-классов» или нужен MobX (без tsyringe) как опция для сложных экранов (терминал, админка)?
3. Монорепо: достаточно pnpm workspaces, или нужен Turborepo ради кэша/affected в CI?
4. Деплой: целевой минимум — `docker compose` на VPS, а Helm/k8s — опциональный слой? Нужен ли werf?
5. TMA-шаблон: строго SPA (без SSR), а сайт/лендинг рядом — отдельное SSR-приложение, как в xRocket?
6. Наблюдаемость: Sentry SaaS или self-hosted GlitchTip по умолчанию?
