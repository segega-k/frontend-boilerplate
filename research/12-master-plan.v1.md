# Frontend boilerplate: мастер-план

Status: draft v1 (шаг 2, ожидает ревью оркестратора)
Updated: 2026-10-14
Источники: отчёты [01]–[11] с саб-отчётами, [13] (стилевой слой), решения пользователя от 2026-10-14, ответы
оркестратора на `12-challenges.md`. Ссылки вида [05b §6] ведут в `research/`.

## 1. Что это и что оно умеет

Один репозиторий, из которого за одну команду получается рабочий фронтенд-проект: pnpm-монорепо с выбранными
шаблонами, общим UI-китом и токенами, настроенным Claude Code, проверками, Docker-сборкой и CI на GitHub. Бэкенд
всегда внешний и описан OpenAPI; своего бизнес-бэкенда и БД нет. Деплой на своих серверах через Docker, без привязки к
Vercel/Netlify. Только веб: без React Native и RNW-компромиссов xRocket [02 F2].

| Слой | Содержимое | Откуда |
| --- | --- | --- |
| Шаблоны `apps/*` | `landing`, `blog`, `shop`, `tma`, `admin`, `game`; любое подмножество | [05], пользователь |
| Ядро `packages/*` | `ui` (kit, props-only), `tokens`, `api` (клиент, маппинг ошибок, мост Query↔MobX), `i18n`, `config`, `telegram-platform`, `analytics`, `astro-shared` | [01 R1], [05 §5] |
| Правила | архитектура, код, компоненты, дизайн, безопасность; каждое с механизмом проверки или пометкой `manual` | [03], [04], [07], [10], [11] |
| AI-слой | дерево `CLAUDE.md`, `.claude/rules` с `paths`, skills, agents, hooks, settings, `pnpm verify`, `pnpm ai:check` | [08] |
| Init | `pnpm run setup`: выбор, вычитание по манифесту, проверка, откат | [06] |
| Инфраструктура | Dockerfile на приложение, общие nginx/security snippets, compose, GitHub Actions, runbooks | [05], [10], [11] |
| Модули | pixel-perfect по Figma (снимок в репо), anti-slop enforcement, аналитика с consent | [07], [09] |

Сознательно нет: Nx, Tamagui/RNW/React Navigation, tsyringe и декораторов, Redux, второго генератора API, Consta,
werf-пайплайна в чужом репо [02], CRUD-фреймворков Refine/React Admin [05d], UI-библиотек со своим дизайн-языком [05 §5].

Критерий результата: после `git clone` + `pnpm run setup` любой агент на любой машине работает по одним правилам,
проект собирается и запускается, а человек без ИИ проходит «симптом → файл → правка → выкладка» за 30 минут [11 R1].

## 2. Шаблоны и опции init

| id | Для чего | Рендеринг / рантайм | Чем жертвует |
| --- | --- | --- | --- |
| `landing` | промо, маркетинг | Astro 7 static (React-острова), nginx; опция `landing-node` | клиентское состояние, data grid, общий React-контекст между островами [05a] |
| `blog` | статьи, авторы, теги, RSS; опция `docs` (Starlight) | Astro 7 static; общий слой в `packages/astro-shared` | то же |
| `shop` | headless commerce: каталог, PDP/PLP, корзина, чекаут через провайдера, аккаунт | Next 16.4 App Router + Cache Components, standalone Node | игровая анимация, offline/PWA; цена: Turbopack и RSC-правила kit для всех [05b] |
| `tma` | Telegram Mini App, Stars, TON Connect (опция) | Vite 8 SPA, nginx | SSR, SEO, PWA (iOS WKWebView без SW) [05c] |
| `admin` | админка, дашборд, SaaS-кабинет: таблицы, формы, графики, RBAC, real-time | Vite 8 SPA, nginx; опция `bff` | SSR, тонкая оптимизация бандла [05d] |
| `game` | 2D casual/idle/puzzle в браузере и как TMA | Vite 8 + Phaser 4 + React-оверлей, nginx | SSR, SEO, роутер (экранная state-machine), большая часть a11y canvas [05e] |

Общее для всех: React 19.3 одной версией через catalog, один kit, одни токены, один API-слой, i18next, Vitest/
Playwright/Storybook, образ nginx или Node. Полная матрица приоритетов в [05 §3].

Опции init (удаляются вместе с кодом, пакетами, доками и skills) [05 §1], [06 F4]:

| Опция | Шаблоны | Что добавляет |
| --- | --- | --- |
| `content-cms` | landing, blog | loader внешней CMS (Strapi MIT / Directus BSL); по умолчанию MDX в репо |
| `docs` | blog | Starlight |
| `landing-node` | landing | `@astrojs/node`: Actions, прокси формы, preview; Node-образ |
| `gsap`, `lenis` | landing, game | GSAP 3.15; Lenis выключен по умолчанию (INP) |
| `pwa` | admin, game (веб), landing | `vite-plugin-pwa`; в tma не предлагается |
| `ton-connect`, `tg-analytics` | tma, game | lazy-чанк `@tonconnect/ui-react` 5; отложенный `@telegram-apps/analytics` |
| `bff` | admin | тонкий Node BFF, httpOnly cookie |
| `search`, `commerce-shopify` | shop | Meilisearch-адаптер; второй commerce-адаптер |
| `game-3d` | game | R3F 9: потолок `react <19.4` на весь монорепо |
| `analytics` | все веб | `packages/analytics`: схема событий, Umami (дефолт) / GA4 / Метрика / PostHog, consent |
| `figma` | все | pixel-perfect модуль (§7) |

Зависимости: `tma` или `game` → `telegram-platform`; `landing` или `blog` → `astro-shared`, Astro-плагины ESLint/
Prettier, `astro check`; `shop` → Turbopack-специфика, Node-target, Redis cache handler. Один выбранный шаблон всё равно
остаётся монорепо (`apps/x` + `packages/*`): общий kit нельзя «сплющить».

## 3. Технологии

### 3.1 Общее ядро

| Слой | Решение | Почему / риск |
| --- | --- | --- |
| Язык, Node | TS 5.9.x в catalog на старте, TS 7 отдельным PR после smoke-сборок; Node 24 LTS в `.nvmrc`, `engines`, Docker | TS 7 с typescript-eslint, Vite, `astro check` не проверен [05 §5]; xRocket расходился 22/24 [02 F0] |
| Пакеты | pnpm + `catalog:`, `minimumReleaseAge 10080`, `trustPolicy: no-downgrade`, `blockExoticSubdeps`, `strictDepBuilds`, `allowBuilds` | supply chain [10 §1.6], практики xRocket [02 F1] |
| Оркестратор | Turborepo (граф, кэш, `--affected`, `prune --docker`); без Nx | Nx в xRocket платил цену без пользы [02 F1] |
| Сборщик | Vite 8 у пяти шаблонов (Astro 7 на Vite 8), Turbopack только у shop | главная точка расхождения [05 §4] |
| Lint | ESLint flat + typescript-eslint + Prettier, `eslint.config` у каждого пакета из `packages/config`; stylelint 17 для `.css` | правила вложенного пакета из корня не применяются [tooling §4] |
| UI kit | `packages/ui`: shadcn-подход (код в репо) на Base UI `@base-ui/react` 1.9 | один примитив-слой; часть блоков ещё Radix-only [05b §4] |
| Стили | Tailwind v4.3, классы только через `tailwind-variants` `tv()` в `Name.styled.ts`; в `.tsx` только `className={button({ tone, size })}`; тема сброшена до токенов; плоские `.css` только в `tokens`, `ui/src/styles`, `apps/*/src/styles` под stylelint. Fallback: CSS Modules + CSS-переменные + `data-*`-варианты | аналог `styled()` + variants Tamagui при строгом файле-спутнике; официальные плагины для Next/Turbopack, Vite 8, Astro; vanilla-extract под Turbopack экспериментален [13] |
| Токены | `packages/tokens` (TS) → `tokens.css` (`:root` / `[data-theme=dark]`), `@theme inline`, `canvas.ts`; три слоя примитивы → роли → компонентные; TMA мапит `--tg-theme-*` на семантику; DTCG + Style Dictionary при модуле `figma` | [03 U1], [13 R3], [09 R3] |
| Состояние | TanStack Query 5 + MobX 7 plain-классы `makeAutoObservable`, без tsyringe/DI/декораторов, без Zustand/Redux; мост `MobxQuery v2` в `packages/api` | решение пользователя; идея MVVM сильная, реализация на декораторах нет [01 §4] |
| React Compiler | выключен (совместимость `observer`) | пользователь |
| API | генерация из OpenAPI: лидер Hey API (exact pin), финальный выбор после smoke-сравнения с Orval 8 и openapi-typescript + свой клиент; свой fetch-слой с interceptors, `X-Request-Id`, маппинг ошибок как данные в репо | openapi-fetch в maintenance mode; Hey API без stable с июня [05d] |
| Формы | RHF 7 + Zod 4; ESLint-запрет `watch()` | один паттерн; оба кандидата готовят мажор [05 §5] |
| Роутинг SPA | TanStack Router code-based: `domains/<d>/routes.ts` + `app/router.ts`; типизированный `<Link to>`; один helper для внешних и legal-ссылок; `goToX`-хук не переносится | сохраняет «таблица роутов на домен» [architecture §1]; [01 R5.4] |
| i18n | i18next 26 везде, каталоги в `packages/i18n`, проверки полноты, плейсхолдеров, сырых ключей; в shop серверный инстанс на запрос, locale явным аргументом в `'use cache'` | [02 F5], [05b §7] |
| Иконки | `lucide-react` через одну точку | Tabler ломал SSR [03 §4] |
| Telegram | `packages/telegram-platform` на `@tma.js/sdk-react` 3.x, единственное место импорта SDK, `mockTelegramEnv` | `@twa-dev/sdk` застрял [05c §2]; tma.js 4 в RC [05e §1] |
| Тесты | Vitest 5 (`projects`), Testing Library, MSW 3, Playwright 1.64 (скриншоты только в Docker), Storybook 10 в `packages/ui`, Lighthouse CI для Astro | Vitest 5 ↔ `addon-vitest` не подтверждено [05d] |
| Ошибки, логи | `@sentry/react` 11 lazy, release = build-info, hidden sourcemaps с удалением, DSN SaaS или GlitchTip; `log.*` вместо `console` | [02 F7], [11 R7] |
| Docker | Dockerfile на приложение + `docker/{nginx.conf,security-headers.conf,env.sh}`; `turbo prune --docker`; `compose.yaml` генерирует init; `nginx-unprivileged` / `USER node`, BuildKit secrets, digest | владение [06 F3]; [10 §1.7] |
| CI | GitHub Actions: `verify --all`, init-matrix, образы, деплой по тегу; GitLab позже | пользователь |

### 3.2 По шаблонам

| | landing / blog | shop | tma | admin | game |
| --- | --- | --- | --- | --- | --- |
| Фреймворк | Astro 7.3, `@astrojs/react`, MDX, sitemap; blog: RSS, коллекции | Next 16.4, `cacheComponents`, `ensureStatic` на PLP/PDP | Vite 8 + React 19 | Vite 8 + React 19 | Vite 8 + React 19 + Phaser 4.2 (exact pin) |
| Данные | build-time, Content Layer, loader CMS | RSC через `CommerceProvider` + `'use cache'` + `cacheTag`, вебхук → `revalidateTag`; Query для интерактива | Query; `Authorization: tma <initDataRaw>` → сессия | Query, interceptors, маппинг с `field` для 422 | `logic/` чистый TS → `game/` → `bridge/` (MobX store + типизированная шина) → `ui/` |
| Специфика | `<Seo>`, JSON-LD, OG через satori, Fonts API, View Transitions | адаптеры `mock` / `medusa` (RU/CIS ЮKassa, международный Stripe) / `shopify`; `PaymentStep` `{kind: redirect \| embedded}`; Redis cache handler по env; `deploymentId` = SHA | theme bridge, BackButton ↔ роутер, MainButton как слот `PrimaryAction`, safe-area алиасы, `startapp` → маршрут | TanStack Table v9 + Virtual, Recharts 3 (ECharts опция), `oidc-client-ts` PKCE, `useCan`/`<Can>`, `RealtimeProvider` | атласы, аудио-спрайты, сейвы DeviceStorage/IndexedDB со `schemaVersion`, fullscreen, пауза на `deactivated` |
| Анимации | CSS, View Transitions; GSAP/Lenis опции | Motion `LazyMotion`, `<ViewTransition>` | View Transitions, Motion точечно, Vaul | CSS | Phaser tweens |
| Тесты | Playwright + axe, Lighthouse CI | Playwright на `COMMERCE_PROVIDER=mock` | Playwright с `mockTelegramEnv`, обе темы | Vitest + MSW 3, Storybook | Vitest для `logic/`, smoke canvas с seed |
| Docker | nginx static, сборка на окружение (build-time `site`) | Node standalone, один образ | nginx static, `env.js` | nginx static (+ BFF) | nginx static, precompressed |

Правила kit для трёх сред (RSC, острова, SPA), проверяемые lint [05 §7]: нет импортов `next/*`, `astro:*`,
`@tma.js/*`, `phaser`; `'use client'` в каждом интерактивном файле, без barrel с директивами; `exports` пофайлово; нет
`window`/`document` на уровне модуля; `Link`/`Image` через `render`-проп или слот; нет обязательных провайдеров
(контекст не пересекает острова); анимации kit на CSS.

### 3.3 Что берём из xRocket и что нет

| Берём | Адаптируем | Не берём |
| --- | --- | --- |
| доменные вертикали, тонкая страница + VM с derived `pageState` [01] | VM только для экранов с оркестрацией, явное создание без контейнера [01 R5.3], [11 T3] | RN, Tamagui, RNW, React Navigation на вебе, моки reanimated [02 F2] |
| генерация из OpenAPI, фабрики query/mutation, маппинг ошибок `endpoint × status × problem → toast/modal/silent` + i18n [01 §5] | маппинг как данные в репо, не из Strapi | tsyringe, `reflect-metadata`, legacy-декораторы, Redux, два генератора API [02 F3–F4] |
| «баг → ESLint-правило с message почему», ratchet-тесты с baseline [04 §7] | правило, выключенное > 10 раз, чинится или удаляется [11 R5] | `eslint-disable` пачками (227 файлов) [01 §8] |
| pnpm-практики, runtime `env.js`, build-info/`X-Build`, Sentry без PII, visual-тесты в Docker [02] | pre-commit лёгкий, typecheck на pre-push и в CI | Nx, werf + Helm по умолчанию, CI в чужом репо [02 F9] |
| 12-ступенчатая шкала с ролями, тон ≠ вариант, union состояний, скелетон из тех же пропсов, actions как данные, один список пресетов движения [03] | текстовые стили, фокус-кольцо, reduced-motion, одна opacity disabled | одноразовые hex-токены, два источника брейкпоинтов, вторая библиотека иконок [03] |
| Plan → Approval → Impl → Review, сниппеты `*.template`, output style Human, CI-ревьюер с hook-guard [04] | один гейт `pnpm verify`, одна копия правил, drift-тесты доков | 61 КБ CLAUDE.md, `.codex`-зеркала, memory как хранилище правил, `CONTEXT.md` на папку [04] |
| грамматика имён Figma, baseline = самый узкий фрейм, ⚠️-гейт, Name map [09 F1] | снимок макета в репо вместо MCP (§7) | сверка «на глаз», pixel-diff как блокирующий гейт [09] |

## 4. Архитектура и правила кода

**Дерево приложения** (одно для всех; Astro/Next хранят маршруты по правилам фреймворка, домены те же):

```
apps/<id>/src/
  app/          composition root: провайдеры, init-пайплайн, router.ts, observability, ErrorBoundary, flags
  domains/<d>/  вертикаль: routes.ts, pages/<Page>/ (<Page>.tsx + model/ + компоненты плоско), components/, api.ts, index.ts
  shared/       без бизнес-знаний: lib, config (env, flags), i18n-каталоги, model (глобальные сторы)
packages/       ui  tokens  api  i18n  config  telegram-platform  analytics  astro-shared
tools/          checks/ (один раннер: arch, ai, manifest, markers, doc-paths, slop), init/, eslint-rules/, figma/
```

**Границы** (arch-правило в `tools/checks`, в `verify` и CI) [01 R2]: приложения не импортируют друг друга; `packages/*`
только через `exports`; `ui` и `tokens` не знают сторов, `api`, приложений; `shared/**` не импортирует `domains/**` и
`app/**` (включая `import type`); чужой домен только через его `index.ts`; относительные `../` между слайсами запрещены;
сгенерированный API только через барел; `index.ts` только у домена и пакета, без `export *`; глубина от `src/` ≤ 6,
`ui/X/ui/Y` запрещено [11 R5]. Пакет при втором потребителе, абстракция при третьем [11 R6.4].

**Состояние и VM** (пользователь + ответ на challenge 1): серверные данные только через `MobxQuery v2` (обёртка
`QueryObserver` → observable, статус читается из query, без `LoadingStatus` вручную); глобальные сторы создаются в
`app/` и передаются React-контекстом; VM создаётся явно в хуке `useViewModel(() => new XViewModel({ ordersStore }))`,
один провайдер VM на компонент; store тонкий, VM богатая, `pageState` как union `loading | error | unavailable | empty
| emptyFiltered | refreshing | ready` с exhaustive switch [03 U20]; простой экран обходится без VM. В SSR-шаблонах сторы
и VM только в клиентских компонентах, синглтонов на уровне модуля нет. VM не навигирует и не зовёт SDK: handler
возвращает результат, навигирует владелец кнопки. Правила docs/architecture.md §3–§5 переезжают в `.claude/rules/
architecture.md` и `data.md` с правками [01 R5].

**Ошибки**: один маппинг `operationId × status × problem.type → toast | modal | silent | field`, данные в репо с ручными
оверрайдами; page error guard только в page root и только для page-load GET; `X-Request-Id` (UUID v7) на каждом
запросе, в Sentry и в тексте ошибки; fatal-состояния (maintenance, no network) решает `app/`.

**Файлы компонента** (пользователь, lint-enforced): `Button/Button.tsx` + `Button.styled.ts` (все `tv()`-рецепты) +
`types.ts` (`ButtonProps = BaseProps & ButtonVariants`) + `consts.ts` (не-стилевые константы) + `utils.ts` + `index.ts`
+ `Button.stories.tsx` в kit [13 R2]. Типы и UPPER_CASE-константы в `.tsx` запрещены (`no-restricted-syntax`); `types.ts`
с одной `Props` считается нормой (в xRocket без lint конвенция держалась у 15 % [01 §3]). Строковый `className`,
template-литералы, `style` без CSS-переменной в `.tsx` запрещены; `tv`/`clsx`/`tailwind-merge` только в `*.styled.ts`;
kit закрыт для внешнего `className` (нет style-handles, [components §3]). Один компонент на файл; `.tsx` ≤ 200 строк,
любой файл ≤ 700 (`max-lines` error, baseline для унаследованного); подкомпоненты плоско рядом; имя файла = имя
экспорта; `export default` только у lazy page root. Комментарии: только где код без них не понять, и они описывают,
как работает механизм; пересказ строк и обоснования выбора запрещены (обоснование в ADR или отчёт). `log.*` вместо
`console`. Деньги только через decimal.

**Принуждение**: `tools/checks`; ESLint-набор из tooling.md §4 без RN/Tamagui; MobX-правила `observer-named-function`,
`require-mobx-default-values`, `no-i18n-in-getter`, `no-platform-globals-in-store`, `no-store-in-page-view` только на
`pages/**` с лимитом отключений ≤ 10; `eslint-comments/require-description`; knip `--max-issues 0`; i18n-проверки.
Правило без проверки помечено `manual`.

## 5. AI-практики

**Дерево инструкций** [08 §1–2]: корневой `CLAUDE.md` ≤ 200 строк (session start по выводу хука, карта «перед чем читать
→ что грузится само», команды, 25–30 правил одной строкой с механизмом, per-prompt checklist, делегирование, формат
отчёта); канон в `.claude/rules/{code-style,naming,components,design,architecture,data,testing,tooling,security,
agent-system}.md` с `paths:` (грузятся при Read/Edit/Write подходящего файла; одна копия; ~700 строк при работе над
`.tsx` против 61 КБ xRocket); `apps/<id>/CLAUDE.md` ≤ 150 строк (What it is, Map, Commands, Stack notes, Template
rules ❌/✅/Why, Security checklist, Recipes, Deliberate do not fix, Open work) и `packages/<pkg>/CLAUDE.md` ≤ 80;
`docs/ai/workflow.md` без `paths`. Шаблонных rule-файлов нет: всё про шаблон удаляется с его папкой. AI-доки на
английском. Codex не поддерживается; при необходимости корневой файл становится `AGENTS.md`, а `CLAUDE.md` начинается с
`@AGENTS.md` [08 §2.5].

**Skills** (18 core, триггеры в `description`) [08 §4.1]: `verify`, `plan-task`, `implement-plan`, `fresh-review`,
`debug-bug`, `new-page`, `new-component`, `figma-implement`, `figma-verify`, `tokens-sync`, `design-review`,
`security-check`, `record-decision`, `commit`, `setup-check`, `qa-handoff`, `frontend-design`, `init-project`.
Шаблонные с префиксом `<id>-` (`tma-payment`, `admin-crud`, `shop-provider`, `game-scene`, `landing-section`,
`blog-post`) удаляются манифестом. Побочные эффекты только `disable-model-invocation`.

**Агенты** `.claude/agents/`: `researcher` (замена Explore, не читающего CLAUDE.md), `implementer`, `code-reviewer`,
`rules-reviewer`, `design-reviewer`, `figma-section-inspector`; `model: opus`, `effort: medium`; Fable не используется.

**Settings** [08 §3.2], [10 §4.3]: `outputStyle: Human`, `autoMemoryEnabled: false`, `attribution` пустой,
`defaultMode: acceptEdits`, `disableBypassPermissionsMode`; deny на чтение секретов и разрушительные git/shell
(`push --force`, `reset --hard`, `clean`, `branch -D`, `--no-verify`, `HUSKY=0`, правка `.husky`, `.claude/settings*`,
hooks, `.mcp.json`, lockfile); ask на `git add/commit/push`, `pnpm add/install/update/dlx`, `npx`, `curl`; правила
продублированы для `PowerShell`. Sandbox-блок с сетью не коммитится (на Windows не работает, в WSL/CI блокирует Figma,
Sentry, GitHub); профиль для WSL2/devcontainer с полным allowlist документируется. `.mcp.json` только с Playwright через
`pnpm exec`; Figma MCP как опция модуля. Личное в `settings.local.json` и `CLAUDE.local.md`.

**Хуки** (Node, exec-форма) [08 §5.3]: `SessionStart` печатает `[session-check v1]` (версии Node/pnpm/Claude Code,
lockfile, husky, конфликтующие локальные настройки, незавершённые планы); `PreToolUse` `guard.mjs` (секреты,
разрушительные команды, защищённые пути, commit-сообщение одной английской строкой без `Co-Authored-By`, push ask) с
`exit 2`; `PostToolUse` форматирует и линтит тронутый файл; `Stop` сканирует diff на остатки (`console.*`, `.only`,
`debugger`, моки без маркера) и блокирует один раз. Тесты хуков в `verify`.

**Гейты**: `pnpm verify` = `turbo run typecheck lint test --affected` + i18n + knip + `tools/checks` + тесты хуков;
`--all` в CI; `--hotfix` = typecheck + unit + build. Pre-commit = lint-staged + secretlint + маркеры; typecheck на
pre-push и в CI. `pnpm ai:check` (13 проверок [08 §5.2]): размеры файлов, существование команд и путей, SKILL.md у
каждого skill, frontmatter rules и живые globs, обязательные заголовки дочерних CLAUDE.md, lint-правила из «enforced by»
реально включены, CI вызывает `verify --all`, нет кириллицы в AI-доках вне «…», маркеры init сбалансированы, в core
rules нет путей шаблонов. Правило: «fix the doc, not the test».

**Память и планы**: ничего не живёт только в memory; «запомни» → `/record-decision` пишет в rule, дочерний CLAUDE.md
«Deliberate, do not fix» или ADR и показывает diff; планы `.work/plans/YYYY-MM-DD-<slug>.md` со `Status`,
отслеживаются git, агент их не коммитит, доки на них не ссылаются.

**Процесс** [08 §6]: session check → контекст (rules + дочерние CLAUDE.md + код, список противоречий) → план со всеми ⚠️
одним сообщением → approval (`awaiting-approval` → `approved` с цитатой) → реализация по пунктам с `verify` после
каждого → `fresh-review` двумя свежими агентами (+ `design-reviewer` для визуального), находки проверяются вручную →
отчёт (итог, изменения, решения сам, вне задачи, вопросы номерами, verify, commit-статус) → ожидание. Коммит только
`/commit` по прямой просьбе.

## 6. Vibe-code дизайн-система

**Режимы** [07 F4]: Operate (admin, tma, кабинет, корзина и чекаут): привычность важнее выразительности, системный
стек или Inter, 0 входных анимаций, плотность, модалка не первый выбор. Persuade (landing, главная и PDP shop): одна
смелая вещь (первый экран показывает продукт в работе), остальное тихо, шрифты не из reflex-списков. Read (blog, docs):
ритм чтения, мера 65–75ch. Experience (game): UI из материала мира игры, HUD не из общего kit.

**Процесс** [07 F7]: `apps/<id>/DESIGN.md` до визуальной работы (режим и сцена, 3–5 референсов и антиреференсов,
палитра 4–6 ролей в OKLCH обеих тем, шрифты, шкалы, движение, «одна запоминающаяся вещь», copy voice, Exceptions с
причиной); токены приложения, включая `--font-sans`, пишутся из DESIGN.md, kit семейство не знает; тест на
шаблонность; после кода матрица скриншотов 2 темы × 390/1024/1440 (tma: 390/430 в темах Telegram) без входных
анимаций, чек-лист самокритики из 10 вопросов, `design:scan` и `lint:copy`, свежий `design-reviewer`, не больше двух
раундов. При наличии макета макет и словарь главнее анти-слоп эстетики.

**Жёсткие правила** (H1–H45 в [07], шаблонные L/S/T/A/G в [07a]):

| Группа | Правила |
| --- | --- |
| Цвет, глубина | нет градиентного текста и декоративных градиентов (исключения: скрим, маска, игра, брендовый токен); нет свечений и неоновых обводок; один акцент + нейтраль + статусы, ≤ 4 хроматических заливок крупных блоков; нет иконок в цветных плитках; стоп-палитры обеих волн (indigo/violet, default blue, cyan на тёмном, крем + терракота, near-black + acid); тёмная тема спроектирована (фон = ступень 1, не `#000`); цвет только по смыслу; тени только у плавающих слоёв |
| Типографика | 1–2 семейства, 2–3 начертания, ≤ 6 файлов; reflex-шрифты (Inter как display, Roboto, Space Grotesk, DM Sans, Plus Jakarta, Fraunces, Playfair, Orbitron…) запрещены как голос Persuade/Experience без записи в DESIGN.md; нет eyebrow-капса; нет выделенного слова в заголовке; трекинг из текстовых стилей; mono только для кода/хешей; кегли из шкалы, минимум 12px, поле 16px на мобиле; `tabular-nums`, без count-up |
| Раскладка | нет карточки в карточке и «всего в карточках»; радиусы 3–4 + pill с иерархией; нет цветной полоски-бордера; blur только у хрома, ≤ 2 на экран; выравнивание по содержанию; ритм отступов; нумерация только у последовательности; нет шаблонного hero и hero-метрики; модалка не первый выбор |
| Движение | нет fade-up у каждой секции (Operate 0, Persuade ≤ 1 момент); hover без подъёма, масштаба и тени, только в `@media (hover: hover)`; 100–300 мс и easing из токенов, ease-out, без bounce, без `transition: all`, без бесконечных декоративных анимаций; `prefers-reduced-motion` обязателен |
| Иконки, текст | одна библиотека, иконка только если кодирует смысл, нет ✨; нет стоковых «настроений»; em dash запрещён в EN-строках и в RU-ярлыках, кнопках, заголовках, в полных русских предложениях разрешён по грамматике; нет `A · B · C`, `→` в кнопках; стоп-слова EN/RU; заголовок экрана существительное, кнопка с глагола, sentence case, generic CTA ≤ 1; нет придуманных цифр, отзывов, бейджей без данных |
| Состояния | пустое = что пусто + действие, отдельный экран для пусто-из-за-фильтров; ошибка говорит что случилось, сохранены ли данные, что сделать; нет Lorem; оформлены `::selection`, каретка, фокус-кольцо 2px с offset |
| Касание, a11y | цели ≥ 40×40 (правило пользователя; 44 рекомендуется в DESIGN.md tma/game), фокус видим и в error, disabled одной opacity и с `aria-disabled`, реальные `h1–h3` |

**Enforcement: правило → механизм** (стилевой слой Tailwind v4 + `tv()` [13]; всё на `error`, `warn` = долг [03]):

| Правило | Механизм |
| --- | --- |
| только токены для цвета, кегля, радиуса, отступов, теней, длительностей | сброс темы в `@theme` (`--color-*: initial; --shadow-*; --animate-*; --font-*; --radius-*; --text-*; --ease-*`), токены через `@theme inline` → `var()`; `eslint-plugin-better-tailwindcss` `no-unknown-classes` (ловит `bg-indigo-500`), `no-restricted-classes` на произвольные `[..]`; в `*.styled.ts` `no-restricted-syntax` на hex/rgb/hsl/oklch; stylelint 17 на `.css` (`declaration-strict-value`, `color-no-hex`, `value-no-unknown-custom-properties` по `tokens.css`) [13 R4] |
| стили только в файле-спутнике | ESLint `no-restricted-syntax`: `className` только из рецепта, `style` только с CSS-переменной; `no-restricted-imports` для `tailwind-variants`, `clsx`, `tailwind-merge` в `.tsx`; `better-tailwindcss` проверяет строки внутри `tv()` |
| нет градиентов, blur, `uppercase`, `infinite`, bounce, `transition: all`, `dark:`, `vh` | `no-restricted-classes`: `transition(-all)?$`, `^dark:` (тема через `data-theme`), `bg-(linear\|radial\|conic)-`, `from-\|via-\|to-`, `backdrop-blur`, `uppercase`, `tracking-widest`, `animate-(pulse\|bounce\|ping)`, регулярка шага отступов; stylelint disallowed-lists на `.css`; allowlist Spinner/Skeleton/Scrim/StickyHeader/Kbd через `overrides` [07 F8] |
| hover без подъёма, масштаба, тени | `no-restricted-classes`: `hover:-?translate-`, `hover:scale-`, `hover:shadow-`, `group-hover:scale-` |
| reflex-шрифты | `--font-*: initial`, семейство только из токенов приложения по DESIGN.md; stylelint regex на `font-family` вне `tokens.css` |
| Figma Name map ↔ DOM | атрибут `data-figma` на узлах из Measurement plan, вырезается в prod (§7) |
| kit закрыт | `className` отсутствует в публичных пропсах `packages/ui`; layout-обёртки приложений берут классы из своего `*.styled.ts` |
| иконки и декор | ESLint: иконки через одну точку; запрет `Sparkles/Wand/Stars`, `react-countup`, `aos`, `span` с классом в `h1–h3`, эмодзи в JSX |
| текст | `lint:copy` по i18n-JSON: em dash, `·`, `→`, капс, Title Case, стоп-слова, придуманные цифры, повтор CTA ≥ 3, Lorem, «Oops» |
| структура, hero, карточки, центрирование, blur, мелкий текст, цели касания | `design:scan` (Playwright, DOM-эвристики с порогами, 2 темы × 3 ширины; отчётный режим на первых проектах, затем gate) |
| палитра и контраст | скрипт по `tokens.css`: ΔE в OKLCH к стоп-цветам, нейтральность теней, контраст пар ролей в обеих темах |
| процесс | CI требует `apps/*/DESIGN.md` с обязательными заголовками; `tokens.css` без значений вне DESIGN.md; PostToolUse-хук гоняет eslint/stylelint/`lint:copy` по изменённому файлу |

## 7. Pixel-perfect по Figma (модуль `figma`)

**Ограничение**: доступ к макетам обычно view-only, платных seats скорее всего нет (пользователь). На бесплатном плане
MCP и REST дают порядка 6–20 вызовов в месяц [09 F2, F4.1]; Code Connect и REST Variables API недоступны. Поэтому
единственный режим — **снимок макета в репозитории**; MCP в основном пути не используется.

| # | Этап | Механизм | Гейт |
| --- | --- | --- | --- |
| P0 | контракт с дизайнером | `docs/design-qa-contract.md`: брейкпоинты, допуски, иерархия источников, что не бывает pixel-perfect [09 R10] | подписан до вёрстки |
| P1 | экспорт макета | минимальный Figma-плагин «Export frame → JSON + PNG» (новый, Plugin API, v1 без линта): дерево узлов, геометрия, auto-layout, стили текста, `boundVariables`, strokes с выравниванием, PNG @2x, SVG, переменные → DTCG; запускает дизайнер или пользователь после запроса edit-доступа. Fallback: REST bulk (`/v1/files/:key/nodes` + `/v1/images`, 2 вызова на экран) и ручной ввод из Dev Mode в тот же JSON | `design/specs/<flow>-<state>@<bp>.figma-spec.json` + `design/frames/*.png` + `meta.json` закоммичены |
| P2 | токены | DTCG → Style Dictionary v5 → `tokens.css`, `@theme inline`, `canvas.ts`; `tokens:check` в CI (rebuild + `git diff --exit-code`); дизайнер ставит `codeSyntax WEB` = имя переменной | PR с diff токенов |
| P3 | карта компонентов | `design/component-map.json` (компонент Figma → kit + variant→props), заполняет `/new-component` | каждый инстанс в карте или ⚠️ |
| P4 | план | `/figma-implement` по снимку: Name map (слой · узел · файл · `data-figma`), Reuse map, Token mapping (нет токена → ⚠️, ближайший молча не подставлять), i18n-ключи, Responsive table по маркерам `@ <bp>-only` / `@ reorder`, baseline = самый узкий фрейм | approval по всем ⚠️ |
| P5 | вёрстка | блок за блоком с неизменяемого; маппинг [09 F3]: stroke inside → `inset box-shadow` или padding − stroke, явный `line-height`, `letter-spacing %` → em, hug/fill/fixed → flex, absolute только где в макете; тексты из словаря, Lucide с пересчётом stroke, те же файлы шрифтов | `figma:measure --node` зелёный после блока, кап 5 итераций |
| P6 | сверка | (a) `figma:measure`: Playwright в Docker, `getBoundingClientRect`/`getComputedStyle` по `data-figma` против spec, цвет по токену — блокирующий; (b) `figma:diff` против PNG с heatmap по узлам — advisory; (c) `figma-section-inspector` по секциям (≤ 8) по снимку и кропам | 0 fail вне `design/deviations.md` |
| P7 | приёмка | два свежих ревьюера, HTML-отчёт с overlay, запись отклонений, эталоны code-vs-code VRT из Docker | sign-off |

**Допуски** [09 R7]: padding/gap/радиус/обводка/размеры нетекстовых боксов 0 (±0.5); позиция ±1px; высота текстового
бокса ±1px на строку; ширина hug-текста ±2px или ±2 %; число строк точно; `font-size/weight/line-height/family` точно;
`letter-spacing` ±0.01em; цвет по токену (без токена ΔE2000 ≤ 1); тени/блюр advisory; pixel-diff кропа > 3 % →
«посмотри»; VRT `maxDiffPixelRatio 0.01`. Юзабилити выше пикселя (40×40, 16px в инпутах), в deviations.

**Не бывает pixel-perfect** (в контракт) [09 R10]: растеризация текста, переносы на реальных данных, ширины между
фреймами, нативные контролы и шапка Telegram, blur/тени/градиенты, дробные значения, другая версия шрифта, иконки
библиотеки, состояния без макета.

**Проверено** [09], [09a]: лимиты платных планов, инструменты MCP, Plugin API видит переменные на любом плане, Style
Dictionary v5 и DTCG 2025.10, платформенность эталонов Playwright. **Не проверено** (фаза модуля): запуск плагинов на
view-only; точные лимиты бесплатного плана на дату реализации; inspect Dev Mode без Dev seat; формат нативного экспорта
переменных. Без модуля остаются code-vs-code VRT и `frontend-design` для экранов без макета.

## 8. Init

`pnpm run setup` (не `pnpm init`) запускает закоммиченный бандл `tools/init/dist/init.mjs` до `pnpm install`; внутри
`@clack/prompts`, `node:util parseArgs`, `yaml` [06 F8]. Пути через `import.meta.dirname` (кириллица), pnpm через
`process.execPath` + `npm_execpath` (ловушка `.cmd`).

**Шаги** [06 F6]: preflight (Node по `.nvmrc`, pnpm, незавершённый журнал, грязное дерево, занятые `apps/*`) → ввод
(флаги, затем вопросы при TTY; валидация по манифесту) → план как список операций (`move`, `rm-node_modules`,
`edit-json`, `edit-yaml`, `strip-md`, `generate`, `write-state`) → `--dry-run` печатает и выходит → подтверждение →
применение с write-ahead журналом в `.init-backup/` → `pnpm install --no-frozen-lockfile` → чистка `pnpm-workspace.yaml`
(catalog, `allowBuilds`, overrides, patches) по новому lockfile → второй install при изменениях → обновление
зависимостей (`safe` по умолчанию в пределах диапазонов с учётом `minimumReleaseAge`; `none` / `latest`) → prettier по
изменённым → `pnpm verify --all` + knip + поиск `residue`-токенов удалённых модулей → `.boilerplate.json` (выбор, тег,
дата) → удаление `init-matrix.yml` и skill `init-project` → удаление бэкапа → итог с подсказкой команды коммита (init
никогда не коммитит). Init и манифест остаются (`--purge-init` убирает), поэтому `--remove <id>` работает и позже.

**Флаги**: `--templates a,b|all`, `--features x,y|none`, `--name`, `--scope`, `--update none|safe|latest`,
`--verify none|quick|full`, `--yes`, `--dry-run`, `--json` (NDJSON), `--plan-out`/`--from-plan`, `--list`, `--resume`,
`--rollback`, `--remove <id>`, `--keep-backup`, `--no-rollback`, `--purge-init`. Без TTY и без обязательных флагов код 2,
никаких зависаний. Коды: 0 успех/no-op, 1 проверка или применение упали (откат сделан), 2 аргументы, 3 preflight, 4
откат не удался, 130 отмена.

**Для агента**: `/init-project`: `--list --json` → вопрос пользователю (агент не выбирает сам) → `--dry-run --json
--plan-out` и сводка → после «да» `--from-plan --yes --json` → отчёт, коммита нет. Раздача: `git clone` / «Use this
template» / `pnpm dlx giget gh:<org>/frontend-boilerplate`; init работает и без `.git`.

## 9. Очистка невыбранных шаблонов

**Вычитание по манифесту** [06 F2]: исходный репо — рабочий монорепо со всеми шаблонами под обычным CI; init только
удаляет и перегенерирует несколько файлов. Сборка из частей и маркеры в коде отвергнуты.

**Инвариант владения**: у каждого файла ровно один владелец: core (`keepPackages`), модуль, граф пакетов или генератор.
Шаблон = `apps/<id>` целиком (Dockerfile, compose.yaml, deploy.json, `.env.example`, CLAUDE.md, DESIGN.md, README, e2e)
+ `docs/templates/<id>.md` + `.claude/skills/<id>-*`. Общие пакеты обрезаются по графу `workspace:*` от оставшихся
приложений, ручных списков нет. Конфиги без списков: CI находит приложения по `apps/*/deploy.json`, `exports` через
wildcard, ESLint/tsconfig у каждого пакета свои, корневой `package.json` без зависимостей шаблонов. Маркеры
`<!-- init:<id> -->` только в Markdown. Генерируемые файлы: `compose.yaml`, таблица шаблонов в README.

**Откат без git**: удаляемое переносится в `.init-backup/` (`fs.rename`; `node_modules` удаляется заранее с retry для
Windows), изменённые файлы копируются туда же; автооткат по журналу при ошибке, `--resume`/`--rollback` при обрыве;
повторный запуск идемпотентен.

**Тесты** [06 F9]: на каждый PR в `tools/checks`: `manifest-coverage` (файл без владельца = ошибка), `isolation`,
`markers`, `generated-up-to-date` (compose, README, `dist/init.mjs`), юнит-тесты `plan()`. E2E `init-matrix.yml`
(удаляется при init): на PR 6 одиночных шаблонов на Linux; nightly 63 комбинации pairwise + одиночные на Windows в
`C:\Работа\тест init` и macOS, плюс `--update latest` как информационный job; тесты dry-run (хеш дерева), отказ на
каждом шаге через `BOILERPLATE_INIT_FAIL_AT`, идемпотентность, `--resume` после kill. После init `ai:check` ловит
висячие ссылки, `/context` в новой сессии не показывает удалённых файлов.

## 10. Безопасность и бэкапы

**База** [10 §1]: фронт не хранит секретов, всё с `VITE_`/`PUBLIC_`/`NEXT_PUBLIC_` публично; zod-схема env, серверная
схема не импортируется в клиент; HTML и JSON-in-script только через `SafeHtml` (DOMPurify) и `serializeJsonForScript`,
URL через `safeUrl()`; ESLint `no-unsanitized`, запрет `dangerouslySetInnerHTML` вне `SafeHtml`, `no-eval`, токенов в
`localStorage`, `postMessage('*')`; заголовки из одного `security-headers.conf` (CSP сначала Report-Only, nonce для
SSR, HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP) с include в каждом location и тем же набором в SSR
middleware, e2e-тест заголовков; токены: BFF + httpOnly cookie лучше всего, иначе access в памяти/`sessionStorage`,
никогда `localStorage`; CSRF при cookie через Fetch Metadata + Origin; sourcemaps `hidden`, nginx 404 на `*.map`; pnpm
из §3.1, `--frozen-lockfile`, `pnpm audit --prod`, Actions по SHA; Docker: BuildKit secrets вместо ARG, non-root, без
git/ssh/bash в рантайме, digest, `.dockerignore` с `.env*`, `.git`, `.claude`, `*.map`; `.gitignore`: `.env*` с
`!.env.example`.

**По шаблонам** (чек-лист в `apps/<id>/CLAUDE.md`) [10 §2]: landing/blog: HTML из CMS через `SafeHtml`, CMS-токен только
на сервере, ALTCHA/Turnstile + honeypot, redirect только относительные. shop: карта никогда не касается нашего кода
(redirect по умолчанию, embedded по флагу = строгий CSP и минимум сторонних скриптов на чекауте), цену считает
провайдер, `purchase` по вебхуку на бэкенде, COOP `same-origin-allow-popups`. tma: `initData` проверяет только бэкенд
(HMAC/Ed25519 + `auth_date`), фронт шлёт сырую строку и обменивает на короткую сессию, `initDataUnsafe` только для UI, не
логировать и не класть в URL аналитики, `frame-ancestors` для `web.telegram.org`, `postMessage` с явным origin,
`SecureStorage` для секретов, инвойс Stars создаёт бэкенд. admin: RBAC на клиенте только UX, CSV-injection экранируется,
`noindex`, `no-store` для персональных ответов. game: античит только на сервере (seed, реплей, лимиты), валюта и покупки
на сервере, обфускация не включается.

**Агент** [10 §4]: permissions не граница (документированные обходы), на нативном Windows sandbox нет → deny/ask +
guard + отсутствие push-прав + branch protection; автономные прогоны в WSL2/devcontainer с профилем sandbox; содержимое
инструментов (веб, Figma, комментарии PR, `node_modules`, вывод команд) — данные, не инструкции; не совмещать чтение
недоверенного контента и широкие права в одной сессии; MCP только официальные, write в ask, токены вне репо; CI-ревьюер
с отдельными settings: deny Bash/Edit/Write, хук ограничивает запись текущим PR.

**Бэкапы и инциденты** [10 §5]: protected branches на GitHub, подписанные коммиты рекомендуются, зеркало на второй
хостинг + еженедельный `git bundle` в версионируемое хранилище, секреты CI в менеджере паролей, immutable-теги образов.
Runbook инцидента: остановить сессию агента и процессы → зафиксировать транскрипт, `git reflog`, `status`, `stash
list` → оценить, что читалось, куда ходило, что пушилось и ставилось → восстановить код (`reflog`, `fsck`, зеркало,
ветку восстанавливает человек) → ротировать секреты, начиная с прав на запись → очистить окружение, переустановить с
известного lockfile → пересобрать артефакты → закрыть дыру правилом deny/hook/lint и записью в `security.md`. Ротация
секрета: выпустить новый → обновить в CI → перезапустить → отозвать старый → проверить логи.

## 11. Поддерживаемость человеком

**Две документации, один факт — один источник** [11 R1]: для людей (русский): `README.md` (≤ экран до «Запуск», первая
ссылка «Если прод упал»), `ARCHITECTURE.md` ≤ 300 строк (система, codemap, инварианты «через отсутствие», сквозной путь
запроса в 5 строк), `apps/<id>/README.md` с таблицей «хочу найти / где / как проверить», `docs/runbooks/*`,
`docs/adr/*`, `docs/incidents/*`; для ИИ (английский): `CLAUDE.md`-дерево, `.claude/rules`, `docs/ai/workflow.md`,
skills. Человеческие доки не содержат правил для агента; AI-доки ссылаются на runbooks и ADR, не пересказывают; пути
и команды проверяет `tools/checks`.

**Runbooks** (когда → проверить → сделать → убедиться → если не помогло; ≤ 1 экран; `Last drill` в шапке, прогон без ИИ
раз в квартал) [11 R3]: `EMERGENCY.md` (не чинить сразу → `/version.json` → откат, если совпало с выкладкой → мы или
API → Sentry по release → воспроизвести на прод-образе → hotfix → рубильник → запись инцидента → контакты),
`deploy.md` (тег → один образ с тегом = SHA → промоушен staging → production, env при старте), `rollback.md` (только
сменой образа на предыдущий SHA: `kubectl rollout undo` / `IMAGE_TAG=<sha> docker compose up -d`), `hotfix.md` (ветка
от прод-тега, `pnpm verify --hotfix`, ревью после, черри-пик в main), `dependency-broken.md`, `api-down.md` (рубильник
`maintenance`), `white-screen.md`, `config-env.md`, `secrets-leak.md`.

**Пределы магии** [11 R5]: нет DI-контейнера и декораторов (`experimentalDecorators` выключен, `reflect-metadata`
запрещён); нет шины событий на `document`; кодген только OpenAPI, иконки, токены; результат и схема коммитятся,
`linguist-generated`, `search.exclude`; ≤ 4 прыжка от страницы до сети (`Page` → VM/хук → `api/<service>` → generated);
путь ≤ 6; свои ESLint-правила с причиной и тестом; `max-lines` без ADR не отключается; barrels только у пакета и домена.

**Встроенная отладка** [11 R7]: `/version.json` = `<meta name="build">` = Sentry release = тег образа; ErrorBoundary на
маршрут с блоком «Детали для поддержки» (release, route, request id, «Скопировать»); `X-Request-Id` и `traceparent`;
`log.*` с уровнями и `?debug=1` (версия, флаги, маршрут); рубильники в `/config.json` (без кэша, без пересборки) с
реестром `flags.ts`: ключ, владелец, `expires`, CI падает на истёкшем; `maintenance` переключает в экран технических
работ. Внешний флаг-сервис не в v1.

**Чек-лист ревью ИИ-кода** (в `rules-reviewer` и шаблоне PR) [11 R8]: данные находятся за 2 минуты через Go to
Definition; нет абстракций с одним потребителем и пробросов; нет дублей хелперов; нет защитного кода без причины; имена
о предмете; файлы по карте, глубина ≤ 6; неочевидное решение имеет ADR или комментарий-механизм; `eslint-disable` и
зависимости с причиной; diff ≤ 400 строк логики; сгенерированное не правилось; ошибки не теряются; удалённая фича
удалена целиком. ADR (MADR-lite, ≤ страницы) при выборе библиотеки уровня приложения, исключении из архитектурного
правила, решении дороже недели отката; стартовые 8–12 ADR описывают уже принятые решения.

## 12. Порядок работ

Все шесть шаблонов в объёме; волны задают порядок поставки, не отрезают функции.

| Волна | Deliverables | Критерий выхода |
| --- | --- | --- |
| **0. Фундамент** | проверка 12 пунктов [08 §7] на реальной установке Claude Code (`paths` с brace-glob, `enabledPlugins`, `onFailure`, `language`, `autoMemoryEnabled`, `.cmd`-MCP, `Read(!…)`, хуки на Windows); smoke-сравнение API-генераторов (Hey API / Orval / openapi-typescript + свой клиент) по спекам Medusa и реального бэкенда; smoke-сборка стилевого слоя (9 рисков [13 R6]: kit как исходник в Next/Turbopack, Astro-острова, Vite 8, `tailwind-merge` с токенами, `better-tailwindcss` в монорепо, Base UI `className`, FOUC темы, TMA theme bridge, вес `tailwind-variants`); ADR 0001–0012; шаблон `design-qa-contract.md` | таблица «механизм → работает/обход»; выбран генератор; стилевой слой подтверждён или включён fallback; ADR приняты |
| **1. Ядро + tma + admin + AI + init** | `packages/{config,tokens,ui,api (+MobxQuery v2, error mapping, request id),i18n,telegram-platform,analytics}`; `tools/checks`; `tools/verify.mjs`; `.claude/*` (CLAUDE.md-дерево, 10 rules, settings, guard + 3 хука с тестами, 10 core skills: verify, plan-task, implement-plan, fresh-review, debug-bug, new-page, new-component, record-decision, commit, setup-check; агенты researcher, implementer, code-reviewer, rules-reviewer); `apps/tma`, `apps/admin` с CLAUDE.md/README/DESIGN.md; Dockerfile на приложение + `docker/`; GitHub Actions `ci.yml`, `deploy.yml`; init с манифестом, бэкапом, `--dry-run`, `--json`, матрица для 2 шаблонов; runbooks EMERGENCY/deploy/rollback/hotfix/config-env; `ARCHITECTURE.md`, README; перенос docs в rules с исправлениями [01 R6], [05 §8] | `pnpm verify --all` зелёный; init любого подмножества {tma, admin} даёт зелёный `verify` и `pnpm dev`; образы отвечают `/version.json`; `ai:check` 0 ошибок; `/context` новой сессии показывает только нужные файлы; человек проходит `rollback.md` на staging без ИИ |
| **2. landing + blog + anti-slop** | `packages/astro-shared`; `apps/landing`, `apps/blog` (+ `content-cms`, `docs`, `landing-node`); anti-slop ESLint/stylelint на error; `lint:copy`; скрипт палитры; `design-reviewer` + skills `design-review`, `frontend-design` (режимы), `qa-handoff`, `security-check`; Lighthouse CI; runbooks dependency-broken/api-down/white-screen; матрица на 4 шаблона | kit собирается в островах без провайдеров; CWV-бюджеты проходят; `lint:copy` и lint 0 ошибок на эталонных экранах; матрица одиночных и пар с landing/blog зелёная |
| **3. game + shop + модули** | `apps/game` (Phaser 4, `logic/`, bridge на MobX, пайплайн ассетов, game-mode Telegram); `apps/shop` (Next 16, `CommerceProvider` `mock`/`medusa`/`shopify`, `PaymentStep`, Redis handler по env, i18next на запрос, вебхук ревалидации, compose с Medusa для dev); модуль `figma` (плагин-экспортёр, `figma:spec/measure/diff`, skills `figma-*`, `tokens-sync`, `figma-section-inspector`, Docker-образ тестов, `design:fidelity`); `design:scan` (отчётный); CI-ревьюер; `pnpm ai:sync --from <tag>`; команда `add`; GitLab CI; шаблонные skills | shop e2e на `mock` PLP → PDP → корзина → чекаут до оплаты; образ shop один на окружения; game smoke с seed; `figma:measure` зелёный на одном реальном экране из плагина; nightly 63 комбинации зелёные; `--update latest` сообщает о мажорах |

Внутри волны: пакет → шаблон → его CLAUDE.md/README/DESIGN.md → модуль в манифесте → матрица.

## 13. Решения и подтверждения

**Решения пользователя (2026-10-14)**: несколько шаблонов в одном монорепо; только фронтенд; Docker на своих серверах;
только веб; Consta игнорируется; Codex не приоритет; landing на Astro; MobX plain-классы без DI + TanStack Query, без
Zustand/Redux, React Compiler выключен; комментарии только там, где без них код не понять, и они объясняют, как работает
фича; `types.ts`/`consts.ts`/`utils.ts` и файл стилей всегда отдельно; GitHub первый; blog — шестой обязательный
шаблон на Astro; Figma обычно view-only, платных seats скорее всего нет; shop — оба рынка через адаптеры с одним
интерфейсом и mock-адаптером.

**Решения оркестратора** (можно оспорить любое):

| Область | Решение | Источник |
| --- | --- | --- |
| Шаблоны | 6: landing, blog, shop, tma, admin, game; остальное опции | [05], пользователь |
| Монорепо | pnpm workspaces + `catalog:` + Turborepo; без Nx | [02], [05] |
| Node, TS | Node 24 LTS; TS 5.9 на старте, TS 7 отдельным PR | [05], ch. 32 |
| Рендеринг | landing/blog Astro static (образ на окружение из-за build-time `site`); shop Next standalone, один образ; tma/admin/game Vite SPA, один образ | [05], ch. 9 |
| Стили | Tailwind v4.3 через `tv()` только в `Name.styled.ts`, тема сброшена, kit закрыт для `className`; fallback CSS Modules + `data-*` | [13] |
| Kit | Base UI, shadcn-подход, props-only, правила трёх сред | [05], [05b] |
| Состояние | MobX без DI + Query; `MobxQuery v2` на `QueryObserver` как core-deliverable; сторы через контекст из `app/`, VM явно в хуке; в SSR только клиентские компоненты | пользователь, ch. 1–2 |
| API | генератор после smoke-сравнения, лидер Hey API exact pin; маппинг ошибок как данные | [05], ch. 13 |
| Роутинг | TanStack Router code-based; типизированный `<Link>`; `goToX` не переносится; «VM не навигирует» остаётся | ch. 17, 25 |
| Формы, таблицы, графики | RHF 7 + Zod 4 (запрет `watch`), TanStack Table v9, Recharts 3 | [05 §5] |
| i18n | i18next везде, в shop серверный инстанс на запрос | [05] |
| Game | Phaser 4 только 2D; `game-3d` опция; мост на MobX | [05e], ch. 24 |
| TMA/game вне Telegram | браузер только для разработки; вторая auth-схема не в v1 | [05c] |
| Shop | `CommerceProvider` с `mock`/`medusa`/`shopify`; чекаут наш, карта у провайдера: redirect по умолчанию, embedded по флагу | [05b], ch. 12 |
| Аналитика | Umami по умолчанию; GTM только явной опцией | [05], [10] |
| Ошибки | Sentry SDK 11, DSN SaaS или GlitchTip | [02], [11] |
| Деплой | docker compose на VPS по умолчанию, Helm позже; теги `<env>-<timestamp>`; откат сменой образа | [02], [11] |
| Docker | Dockerfile на приложение + `docker/`; compose генерирует init; BuildKit secrets, non-root, digest | ch. 8, [10] |
| Касание | 40×40 по правилу пользователя; 44 рекомендуется в DESIGN.md tma/game | ch. 11 |
| Em dash | запрещён как декоративный разделитель и в EN; в русских полных предложениях по грамматике | [07] |
| Языки доков | человеческие на русском, AI на английском | [04], [11] |
| Правила | канон в `.claude/rules/*.md` с `paths`; шаблонное только в `apps/<id>/CLAUDE.md`; одна копия | [04], [08] |
| Skills | в репо; шаблонные с префиксом `<id>-`; без marketplace | [08] |
| Память | auto memory off; «запомни» → `/record-decision`; планы `.work/plans/` в git, агент не коммитит | [08], ch. 10 |
| Git агентом | commit и push только по прямой просьбе (ask + guard); force push и удаление веток deny; защита = branch protection + guard | [08], [10] |
| Permissions | `acceptEdits`; sandbox network-блок не коммитится, профиль WSL2/devcontainer документирован | [08], ch. 31 |
| Агенты | `model: opus`, `effort: medium`; Fable не используется | пользователь |
| Гейт | `pnpm verify` (+ `--all`, `--hotfix`); pre-commit лёгкий, typecheck на pre-push/CI; один раннер `tools/checks` | [08], ch. 23, 40, 42 |
| Секреты | secretlint в pre-commit, gitleaks в CI и по `dist/` | [10] |
| Изоляция | Windows: deny/ask + guard + branch protection; WSL2/devcontainer для автономных прогонов | [10] |
| Подписанные коммиты | рекомендованы, не обязательны | [10] |
| Figma | модуль `figma`, снимок в репо как единственный режим; MCP опционален; плагин-экспортёр в v1, линт/подпись позже; `data-figma` вырезается в prod | [09], ch. 7a, 29 |
| Anti-slop | lint на error с первого дня; `design:scan` отчётный на 1–2 проектах, потом gate | [07] |
| Init | `pnpm run setup`; init и манифест остаются (`--purge-init`); обновление `safe`; `add` в волне 3; не коммитит | [06], ch. 14 |
| Hotfix, флаги | `pnpm verify --hotfix` разрешён, ревью после; рубильники `/config.json` с владельцем и `expires` | [11] |
| CI и деплой-доки | в этом репо; GitHub Actions первые, GitLab в волне 3 | [11], пользователь |
| Порядок | core → tma → admin → landing → blog → game → shop | ch. 16 |

**Нужно подтвердить пользователю** (ответ номерами):

1. **Next.js для shop рядом с Astro или один стек.** Цена Next для всего монорепо: Turbopack только у shop, vendored
   canary React, правила kit (`'use client'` пофайлово, без barrel с директивами, `transpilePackages`, `@source`)
   обязательны для всех, ручная интеграция i18next с Cache Components, Redis handler и общий
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` при нескольких подах [05 §4], [05b]. Альтернатива: TanStack Start на Vite (RSC
   ранние, без тегового кэша) или Astro с `landing-node` для простого каталога.
2. **Стилевой слой: Tailwind v4 через `tv()` только в `Name.styled.ts`** (в `.tsx` ни одного строкового класса, kit
   закрыт для `className`) — подтвердить; fallback CSS Modules + CSS-переменные + `data-*`-варианты [13].
3. **Тема TMA**: нативная из `--tg-theme-*` + один брендовый акцент по DESIGN.md (дефолт) или брендовый режим со
   своими цветами [05c], [07a].
4. **Auth админки по умолчанию**: PKCE в статике с записанным порогом «ПДн, деньги, клиентский кабинет → опция `bff`»
   или BFF сразу [05d], [10].
5. **Кто запускает Figma-плагин-экспортёр**: дизайнер по handoff-процессу или пользователь после запроса edit-доступа;
   плюс проверка, запускаются ли плагины на view-only [09].
6. **Язык человеческих доков**: русский по умолчанию; английский, если придут нерусскоязычные подрядчики [11].

## 14. Риски и проверки на реальной установке

| # | Риск | Мера |
| --- | --- | --- |
| 1 | Механизмы Claude Code не проверены руками: `paths` с brace-glob, `enabledPlugins` из project, `onFailure: block` < 2.1.295, `language`, `autoMemoryEnabled`, stdio-MCP через `.cmd`, `Read(!.env.example)`, guard на Windows с кириллицей, SessionStart < 2 с, Stop без цикла [08 §7], [10a §6] | волна 0: таблица «механизм → работает/обход»; `ai:doctor` требует минимальную версию |
| 2 | `MobxQuery v2`: гонки гидрации и отписки, которые xRocket комментировал в 512 строках [02 F3] | явный API, тесты на `QueryObserver`, запрет SSR-использования, эталон в rules |
| 3 | Свежие мажоры: TS 7, Vitest 5 ↔ Storybook addon, MSW 3, Base UI 1.9, TanStack Table v9, MobX 7, Astro 7 под Cloudflare, Next 16 vendored canary, tma.js 4 RC, Hey API без stable | catalog пинит проверенные версии; smoke-сборки в волнах 0–1; `--update latest` nightly |
| 4 | Модели копируют старый паттерн: `LoadingStatus` руками (26 новейших файлов xRocket), Phaser 3 API, `@telegram-apps/*` | lint на запрещённые импорты и паттерны; правила в `apps/<id>/CLAUDE.md`; `node_modules/phaser/skills` как справка |
| 5 | Next в монорепо: Turbopack, RSC-правила kit, i18next с Cache Components, multi-pod | подтверждение 1; shop последним; `ensureStatic`, e2e на `mock` |
| 6 | Figma на бесплатном плане: плагины на view-only, лимиты, Dev Mode | волна 3: проверка на реальном файле; fallback REST bulk + ручной JSON; модуль не блокирует остальное |
| 7 | Стилевой слой [13 R6]: kit как исходник в Next/Turbopack (классы в prod CSS, HMR, нет двойного CSS); Astro-острова без дублирования; Vite 8 + `@tailwindcss/vite`; `tailwind-merge` с токенами (`text-fg` и `text-label-md` не вытесняют друг друга, иначе `twMergeConfig` из токенов); `better-tailwindcss` в монорепо; Base UI `className`-функция (сужаем до `string`, состояния через `data-*`); FOUC темы в SSR (инлайн-скрипт + CSP-хэш); TMA перекраска без перезагрузки; вес `tailwind-variants` + `tailwind-merge` в бюджете TMA | smoke-сборка kit + tma + landing в волне 0; при провале fallback CSS Modules (инфраструктурного риска нет, теряется shadcn-экосистема) |
| 8 | Объём: ~15 инструментов, 18 skills, 6 агентов, 6 шаблонов | волны с критериями выхода; один раннер `tools/checks`; ничего не заявляется «в CI», пока не вызвано из CI |
| 9 | Init на Windows: EBUSY/EPERM, длинные пути, `.cmd`, кириллица | retry, preflight-переименование, бэкап без `node_modules`, `npm_execpath`, матрица на Windows |
| 10 | Матрица 63 комбинации дорогая | PR: 6 одиночных; nightly pairwise; кэш pnpm store |
| 11 | Medusa требует эксплуатации (Node + Postgres + Redis) | compose для dev, `mock` для CI, контрактный прогон против staging ночью |
| 12 | Правила без механизма не живут (xRocket: 95 нарушений `shared → entities`, 315 сырых кеглей, 233 отключения) [01], [03] | каждое правило с `enforced by` или `manual`; `warn` запрещён; лимит отключений |
| 13 | Дрейф доков (CONTEXT.md на несуществующие файлы, «knip:ci», которого нет) [04] | `tools/checks`: пути, команды, CI-вызовы, размеры |
| 14 | Push-защита обходится через permissions (`git -C . push`) | branch protection, guard, нет push-токена у CI-агентов |

**Проверки на реальной установке** (сводно): 12 пунктов [08 §7]; smoke-сборка каждого шаблона с kit (бюджеты: tma
initial ≤ 150 KB gz, game ≤ 500 KB gz, landing главная ≤ 50 KB gz JS); стилевой слой в Next и Astro одновременно;
Storybook + Vitest 5 browser mode; генератор по спеке Medusa (`$ref`, нужен bundle); эталоны Playwright только из
Docker; Figma-плагин на view-only; `figma:measure` на реальном экране; init-матрица на Windows в `C:\Работа\тест
init`; `rollback.md` на staging руками; `/context` после init.
