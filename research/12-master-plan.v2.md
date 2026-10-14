# Frontend boilerplate — мастер-план

2026-10-14 · время чтения ~25 минут · ссылки вида [05b §6] ведут в `research/`

## Коротко

- Строим репозиторий, из которого одной командой получается рабочий фронтенд-проект: pnpm-монорепо с выбранными
  шаблонами, общим UI-китом и токенами, настроенным Claude Code, проверками, Docker и CI на GitHub. Бэкенд внешний по
  OpenAPI, деплой на своих серверах, только веб.
- Шаблоны: `landing` (Astro static), `blog` (Astro static, общий слой с landing), `shop` (Next 16 + headless
  commerce через адаптеры), `tma` (Vite SPA + `@tma.js`), `admin` (Vite SPA + TanStack Router/Table + OIDC),
  `game` (Vite + Phaser 4 + React-оверлей). Общее: React 19, Base UI kit, Tailwind через `tv()` в файлах-спутниках,
  MobX без DI + TanStack Query, i18next, Vitest/Playwright.
- AI-слой: корневой `CLAUDE.md` ≤ 200 строк, правила в `.claude/rules` по путям, 18 skills, 6 агентов, 4 хука, один
  гейт `pnpm verify` и drift-тест `pnpm ai:check`; память только в репо.
- Дизайн-система: режимы Operate/Persuade/Read/Experience, обязательный `DESIGN.md` на приложение, ~45 жёстких
  анти-слоп правил, почти все на lint уровня error.
- Init: `pnpm run setup` вычитает невыбранное по манифесту, проверяет сборку, умеет dry-run и откат; pixel-perfect по
  Figma — модуль, работающий со снимком макета в репо (бесплатный план Figma).
- Три волны поставки: ядро + tma + admin + AI + init → landing + blog + anti-slop → game + shop + Figma-модуль.
- От пользователя нужно 6 подтверждений (§12): Next рядом с Astro, Tailwind через `tv()`, тема TMA, auth админки,
  кто запускает Figma-экспортёр, язык человеческих доков.

## 1. Что это

| Слой | Содержимое | Откуда |
| --- | --- | --- |
| Шаблоны `apps/*` | 6 шаблонов, любое подмножество | [05], пользователь |
| Ядро `packages/*` | `ui`, `tokens`, `api` (клиент, маппинг ошибок, мост Query↔MobX), `i18n`, `config`, `telegram-platform`, `analytics`, `astro-shared` | [01 R1], [05 §5] |
| Правила | архитектура, код, компоненты, дизайн, безопасность; каждое с проверкой или пометкой `manual` | [03], [04], [07], [10], [11] |
| AI-слой | дерево `CLAUDE.md`, rules, skills, agents, hooks, settings, гейты | [08] |
| Init | выбор, вычитание по манифесту, проверка, откат | [06] |
| Инфраструктура | Dockerfile на приложение, общие nginx/security snippets, compose, GitHub Actions, runbooks | [05], [10], [11] |
| Модули | pixel-perfect по Figma, anti-slop enforcement, аналитика с consent | [07], [09] |

Сознательно нет: Nx, Tamagui/RNW/React Navigation, tsyringe и декораторов, Redux, второго генератора API,
werf-пайплайна в чужом репо [02], CRUD-фреймворков [05d], UI-библиотек со своим дизайн-языком [05 §5].

Критерий результата: после `git clone` и `pnpm run setup` любой агент на любой машине работает по одним правилам, проект
собирается и запускается, а человек без ИИ проходит «симптом → файл → правка → выкладка» за 30 минут [11 R1].

## 2. Шаблоны и опции

| id | Для чего | Рендеринг / рантайм | Чем жертвует |
| --- | --- | --- | --- |
| `landing` | промо, маркетинг | Astro 7 static, React-острова, nginx; опция `landing-node` | клиентское состояние, data grid, общий React-контекст между островами [05a] |
| `blog` | статьи, авторы, RSS; опция `docs` (Starlight) | Astro 7 static; общий слой в `packages/astro-shared` | то же |
| `shop` | headless commerce: каталог, PDP/PLP, корзина, чекаут через провайдера, аккаунт | Next 16.4 + Cache Components, Node standalone | игровая анимация, offline; цена: Turbopack и RSC-правила kit для всех [05b] |
| `tma` | Telegram Mini App, Stars, TON Connect (опция) | Vite 8 SPA, nginx | SSR, SEO, PWA (iOS WKWebView без SW) [05c] |
| `admin` | админка, дашборд, SaaS-кабинет | Vite 8 SPA, nginx; опция `bff` | SSR, тонкая оптимизация бандла [05d] |
| `game` | 2D casual/idle/puzzle в браузере и как TMA | Vite 8 + Phaser 4 + React-оверлей, nginx | SSR, SEO, роутер, большая часть a11y canvas [05e] |

Опции init (удаляются с кодом, пакетами, доками и skills): `content-cms` (landing, blog), `docs` (blog), `landing-node`,
`gsap`/`lenis` (landing, game), `pwa` (admin, game-web, landing; в tma не предлагается), `ton-connect` и `tg-analytics`
(tma, game), `bff` (admin), `search` и `commerce-shopify` (shop), `game-3d` (ставит потолок React на весь монорепо),
`analytics` (Umami по умолчанию / GA4 / Метрика / PostHog с consent), `figma` (§7) [05 §1]. Один выбранный шаблон всё
равно остаётся монорепо: общий kit нельзя «сплющить» в приложение.

## 3. Технологии

### 3.1 Общее ядро

| Слой | Решение | Почему / риск |
| --- | --- | --- |
| Язык, Node | TS 5.9 на старте, TS 7 отдельным PR после smoke-сборок; Node 24 LTS в `.nvmrc`, `engines`, Docker | TS 7 с линтером и плагинами не проверен [05 §5]; xRocket расходился 22/24 [02 F0] |
| Пакеты | pnpm + `catalog:`, `minimumReleaseAge` 7 дней, `trustPolicy`, `blockExoticSubdeps`, `allowBuilds` | supply chain [10 §1.6] |
| Оркестратор, сборщик | Turborepo; Vite 8 у пяти шаблонов, Turbopack только у shop | Nx в xRocket платил цену без пользы [02 F1]; Turbopack — главная точка расхождения [05 §4] |
| Lint | ESLint flat + typescript-eslint + Prettier, конфиг у каждого пакета из `packages/config`; stylelint для `.css` | правила вложенного пакета из корня не применяются [tooling §4] |
| UI kit | `packages/ui`: shadcn-подход (код в репо) на Base UI | один примитив-слой; часть блоков ещё Radix-only [05b §4] |
| Стили | Tailwind v4.3, классы только через `tailwind-variants` `tv()` в `Name.styled.ts`; в `.tsx` только `className={button({ tone, size })}`; тема сброшена до токенов; плоские `.css` только в токенах и `styles/` под stylelint. Fallback: CSS Modules + `data-*`-варианты | аналог `styled()` + variants Tamagui при строгом файле-спутнике; официальные плагины для Next, Vite, Astro [13] |
| Токены | `packages/tokens` → `tokens.css`, `@theme inline`, `canvas.ts`; примитивы → роли → компонентные; TMA мапит `--tg-theme-*` на семантику | [03 U1], [13 R3] |
| Состояние | TanStack Query 5 + MobX 7 plain-классы, без DI/декораторов, без Zustand/Redux; мост `MobxQuery v2`; React Compiler выключен | решение пользователя; идея MVVM сильная, реализация на декораторах нет [01 §4] |
| API | генерация из OpenAPI: лидер Hey API (exact pin), выбор после smoke-сравнения с Orval и openapi-typescript + свой клиент; свой fetch-слой с request id и маппингом ошибок как данными | openapi-fetch в maintenance mode, Hey API без stable с июня [05d] |
| Формы, таблицы, графики | RHF 7 + Zod 4 (запрет `watch()`), TanStack Table v9 + Virtual, Recharts 3 | один паттерн форм [05 §5] |
| Роутинг SPA | TanStack Router code-based: `domains/<d>/routes.ts` + `app/router.ts`; типизированный `<Link>`; `goToX`-хук не переносится | «таблица роутов на домен» [architecture §1], [01 R5.4] |
| i18n | i18next везде, каталоги в `packages/i18n`, проверки полноты и сырых ключей; в shop серверный инстанс на запрос | [02 F5], [05b §7] |
| Telegram | `packages/telegram-platform` на `@tma.js/sdk-react` 3, единственное место импорта SDK, mock для dev/e2e | `@twa-dev/sdk` застрял [05c §2] |
| Тесты | Vitest 5, Testing Library, MSW 3, Playwright (скриншоты только в Docker), Storybook в `packages/ui`, Lighthouse CI для Astro | Vitest 5 ↔ Storybook addon не подтверждено [05d] |
| Ошибки, логи | Sentry 11 lazy, release = build-info, hidden sourcemaps с удалением, DSN SaaS или GlitchTip; `log.*` вместо `console` | [02 F7], [11 R7] |
| Docker, CI | Dockerfile на приложение + общие `docker/` snippets; `compose.yaml` генерирует init; non-root, BuildKit secrets, digest; GitHub Actions первые | инвариант владения [06 F3]; [10 §1.7] |

### 3.2 По шаблонам

| | landing / blog | shop | tma | admin | game |
| --- | --- | --- | --- | --- | --- |
| Данные | build-time, Content Layer, loader CMS | RSC через `CommerceProvider` + `'use cache'` + теги, вебхук → ревалидация; Query для интерактива | Query; `Authorization: tma <initDataRaw>` → сессия | Query, interceptors, маппинг с `field` для 422 | `logic/` чистый TS → `game/` → `bridge/` (MobX + типизированная шина) → `ui/` |
| Специфика | `<Seo>`, JSON-LD, OG на билде, Fonts API, View Transitions | адаптеры `mock` / `medusa` (RU/CIS через ЮKassa, международный через Stripe) / `shopify`; `PaymentStep` redirect или embedded; Redis cache handler по env | theme bridge, BackButton ↔ роутер, MainButton как слот, safe-area, `startapp` → маршрут | data-table с URL-состоянием, OIDC PKCE, `useCan`, real-time провайдер | атласы, аудио-спрайты, сейвы со `schemaVersion`, fullscreen, пауза на `deactivated` |
| Тесты | Playwright + axe, Lighthouse CI | e2e на `mock` | Playwright с mock Telegram, обе темы | Vitest + MSW, Storybook | Vitest для `logic/`, smoke canvas с seed |
| Образ | nginx static, сборка на окружение (build-time `site`) | Node, один образ на все окружения | nginx static, runtime `env.js` | nginx static (+ BFF) | nginx static, precompressed |

Правила kit для трёх сред (RSC, острова, SPA), на lint [05 §7]: нет импортов `next/*`, `astro:*`, SDK и движков;
`'use client'` в каждом интерактивном файле, без barrel с директивами; `exports` пофайлово; нет `window` на уровне
модуля; `Link`/`Image` через `render`-проп или слот; нет обязательных провайдеров; анимации kit на CSS.

### 3.3 Что берём из xRocket и что нет

| Берём | Адаптируем | Не берём |
| --- | --- | --- |
| доменные вертикали, тонкая страница + VM с derived `pageState` [01] | VM только для экранов с оркестрацией, явное создание без контейнера [01 R5.3] | RN, Tamagui, RNW, React Navigation на вебе [02 F2] |
| генерация из OpenAPI, фабрики query, маппинг ошибок `endpoint × status × problem` [01 §5] | маппинг как данные в репо, не из CMS | tsyringe, декораторы, Redux, два генератора API [02 F3] |
| «баг → ESLint-правило с объяснением», ratchet-тесты с baseline [04 §7] | правило, выключенное > 10 раз, чинится или удаляется [11 R5] | `eslint-disable` пачками (227 файлов) [01 §8] |
| pnpm-практики, runtime env, build-info, Sentry без PII, visual-тесты в Docker [02] | pre-commit лёгкий, typecheck на pre-push и в CI | Nx, werf + Helm по умолчанию, CI в чужом репо [02 F9] |
| 12-ступенчатая шкала с ролями, тон ≠ вариант, union состояний, скелетон из тех же пропсов, actions как данные [03] | текстовые стили, фокус-кольцо, reduced-motion, одна opacity disabled | одноразовые hex-токены, два источника брейкпоинтов, вторая библиотека иконок [03] |
| фазовый процесс, сниппеты, output style Human, CI-ревьюер с hook-guard, грамматика имён Figma [04], [09] | один гейт, одна копия правил, снимок макета вместо MCP | 61 КБ CLAUDE.md, `.codex`-зеркала, memory как хранилище правил, сверка «на глаз» [04], [09] |

## 4. Архитектура и правила кода

**Дерево приложения** (одно для всех; Astro и Next хранят маршруты по правилам фреймворка, домены те же):

```
apps/<id>/src/
  app/          composition root: провайдеры, init-пайплайн, router.ts, observability, ErrorBoundary, flags
  domains/<d>/  вертикаль: routes.ts, pages/<Page>/ (<Page>.tsx + model/ + компоненты плоско), components/, api.ts, index.ts
  shared/       без бизнес-знаний: lib, config (env, flags), i18n-каталоги, model (глобальные сторы)
packages/       ui  tokens  api  i18n  config  telegram-platform  analytics  astro-shared
tools/          checks/ (один раннер проверок), init/, eslint-rules/, figma/
```

**Границы** (арх-правило в `tools/checks`, в гейте и CI) [01 R2]: приложения не импортируют друг друга; пакеты только
через `exports`; `ui` и `tokens` не знают сторов, `api`, приложений; `shared` не импортирует `domains` и `app`
(включая `import type`); чужой домен только через его `index.ts`; относительные `../` между слайсами запрещены;
сгенерированный API только через барел; `index.ts` только у домена и пакета, без `export *`; глубина от `src/` ≤ 6,
`ui/X/ui/Y` запрещено [11 R5]. Пакет при втором потребителе, абстракция при третьем [11 R6.4].

**Состояние и VM**: серверные данные только через `MobxQuery v2` (обёртка `QueryObserver` → observable, статус
читается из query); глобальные сторы создаются в `app/` и передаются React-контекстом; VM создаётся явно в хуке
`useViewModel(() => new XViewModel({ ordersStore }))`, один провайдер на компонент; store тонкий, VM богатая,
`pageState` как union состояний с exhaustive switch [03 U20]; простой экран обходится без VM. В SSR-шаблонах сторы и VM
только в клиентских компонентах, синглтонов на уровне модуля нет. VM не навигирует и не зовёт SDK: handler возвращает
результат, навигирует владелец кнопки. Ошибки: один маппинг `operationId × status × problem → toast | modal | silent |
field`, данные в репо; page error guard только в page root; `X-Request-Id` на каждом запросе, в Sentry и в тексте
ошибки.

**Файлы компонента** (решение пользователя, на lint): `Button/Button.tsx` + `Button.styled.ts` (все `tv()`-рецепты) +
`types.ts` + `consts.ts` + `utils.ts` + `index.ts` + stories в kit [13 R2]. Типы и UPPER_CASE-константы в `.tsx`
запрещены; `types.ts` с одной `Props` считается нормой (в xRocket без lint конвенция держалась у 15 % [01 §3]).
Строковый `className` и `style` без CSS-переменной в `.tsx` запрещены; склейка классов только в `*.styled.ts`; kit
закрыт для внешнего `className` [components §3]. Один компонент на файл; `.tsx` ≤ 200 строк, любой файл ≤ 700 (error,
baseline для унаследованного); подкомпоненты плоско рядом; имя файла = имя экспорта. Комментарии: только там, где код
без них не понять, и они описывают, как работает механизм; пересказ и обоснования выбора запрещены (обоснование в ADR
или отчёт). Деньги только через decimal.

**Принуждение**: ESLint-набор из tooling.md §4 без RN-правил; MobX-правила `observer-named-function`,
`require-mobx-default-values`, `no-i18n-in-getter`, `no-platform-globals-in-store`, `no-store-in-page-view` только на
`pages/**` с лимитом отключений ≤ 10; `require-description` на каждый disable; knip; i18n-проверки. Правило без
проверки помечено `manual`.

## 5. AI-практики

**Дерево инструкций** [08 §1–2]: корневой `CLAUDE.md` ≤ 200 строк (session start по выводу хука, карта «перед чем читать
→ что грузится само», команды, 25–30 правил одной строкой с механизмом, per-prompt checklist, делегирование, формат
отчёта); канон в `.claude/rules/*.md` с `paths:` (code-style, naming, components, design, architecture, data, testing,
tooling, security, agent-system; грузятся при касании подходящего файла, ~700 строк при работе над `.tsx` против 61 КБ
xRocket); `apps/<id>/CLAUDE.md` ≤ 150 строк с обязательными разделами (What it is, Map, Commands, Template rules,
Security checklist, Recipes, Deliberate do not fix, Open work) и `packages/<pkg>/CLAUDE.md` ≤ 80. Шаблонных
rule-файлов нет: всё про шаблон удаляется с его папкой. AI-доки на английском. Codex не поддерживается; при
необходимости корневой файл становится `AGENTS.md`, а `CLAUDE.md` начинается с `@AGENTS.md` [08 §2.5].

**Skills** (18 core) [08 §4.1]: `verify`, `plan-task`, `implement-plan`, `fresh-review`, `debug-bug`, `new-page`,
`new-component`, `figma-implement`, `figma-verify`, `tokens-sync`, `design-review`, `security-check`,
`record-decision`, `commit`, `setup-check`, `qa-handoff`, `frontend-design`, `init-project`; шаблонные с префиксом
`<id>-` удаляются манифестом; побочные эффекты только по вызову пользователя. **Агенты**: `researcher` (замена Explore,
не читающего CLAUDE.md), `implementer`, `code-reviewer`, `rules-reviewer`, `design-reviewer`,
`figma-section-inspector`; `model: opus`, `effort: medium`; Fable не используется.

**Settings и хуки** [08 §3, §5], [10 §4.3]: output style Human, auto memory выключена, `acceptEdits`; deny на чтение
секретов и разрушительные git/shell (force push, `reset --hard`, `clean`, удаление веток, обход хуков, правка настроек,
хуков, lockfile); ask на commit, push, установку пакетов, сеть; правила продублированы для PowerShell. Sandbox-блок с
сетью не коммитится (на Windows не работает, в WSL/CI блокирует Figma, Sentry, GitHub); профиль для WSL2/devcontainer
документируется. MCP только Playwright через `pnpm exec`; Figma MCP как опция модуля. Хуки на Node: SessionStart
печатает `[session-check v1]` (версии, lockfile, husky, конфликты локальных настроек, незавершённые планы); PreToolUse
`guard.mjs` блокирует секреты, разрушительные команды, защищённые пути, неверный формат коммита (одна английская
строка без `Co-Authored-By`); PostToolUse форматирует и линтит тронутый файл; Stop ловит остатки (`console.*`, `.only`,
`debugger`, моки без маркера) один раз. Тесты хуков в гейте.

**Гейты**: `pnpm verify` = typecheck + lint + tests затронутых проектов + i18n + knip + `tools/checks` + тесты хуков;
`--all` в CI; `--hotfix` = typecheck + unit + build. Pre-commit = lint-staged + secretlint + маркеры; typecheck на
pre-push и в CI. `pnpm ai:check` (13 проверок [08 §5.2]): размеры файлов, существование команд и путей, SKILL.md у
каждого skill, frontmatter rules и живые globs, заголовки дочерних CLAUDE.md, lint-правила из «enforced by» реально
включены, CI вызывает гейт, нет кириллицы в AI-доках вне «…», маркеры init сбалансированы, в core rules нет путей
шаблонов. Правило: «fix the doc, not the test».

**Память, планы, процесс** [08 §6]: ничего не живёт только в memory; «запомни» → `/record-decision` пишет в rule,
дочерний CLAUDE.md или ADR и показывает diff; планы `.work/plans/` со `Status`, в git, агент их не коммитит, доки на
них не ссылаются. Процесс: session check → контекст (rules, дочерние CLAUDE.md, код, список противоречий) → план со
всеми ⚠️ одним сообщением → approval → реализация по пунктам с гейтом после каждого → `fresh-review` двумя свежими
агентами, находки проверяются вручную → отчёт (итог, изменения, решения сам, вне задачи, вопросы номерами, гейт,
commit-статус) → ожидание. Коммит только по прямой просьбе.

## 6. Vibe-code дизайн-система

**Режимы** [07 F4]: Operate (admin, tma, кабинет, корзина и чекаут): привычность важнее выразительности, системный
стек или Inter, 0 входных анимаций, модалка не первый выбор. Persuade (landing, главная и PDP shop): одна смелая вещь
(первый экран показывает продукт в работе), остальное тихо, шрифты не из reflex-списков. Read (blog, docs): ритм
чтения, мера 65–75ch. Experience (game): UI из материала мира игры, HUD не из общего kit.

**Процесс** [07 F7]: `apps/<id>/DESIGN.md` до визуальной работы (режим и сцена, 3–5 референсов и антиреференсов,
палитра 4–6 ролей в OKLCH обеих тем, шрифты, шкалы, движение, «одна запоминающаяся вещь», copy voice, Exceptions с
причиной); токены приложения, включая шрифт, пишутся из DESIGN.md, kit семейство не знает; тест на шаблонность;
после кода матрица скриншотов 2 темы × 3 ширины без входных анимаций, чек-лист самокритики, сканы, свежий
`design-reviewer`, не больше двух раундов. При наличии макета макет и словарь главнее анти-слоп эстетики.

**Жёсткие правила** (H1–H45 в [07], шаблонные в [07a]):

| Группа | Правила |
| --- | --- |
| Цвет, глубина | нет градиентного текста и декоративных градиентов; нет свечений и неоновых обводок; один акцент + нейтраль + статусы; нет иконок в цветных плитках; стоп-палитры обеих волн (indigo/violet, default blue, cyan на тёмном, крем + терракота, near-black + acid); тёмная тема спроектирована, не `#000`; цвет только по смыслу; тени только у плавающих слоёв |
| Типографика | 1–2 семейства, 2–3 начертания; reflex-шрифты (Inter как display, Space Grotesk, DM Sans, Plus Jakarta, Fraunces, Playfair, Orbitron…) запрещены как голос Persuade/Experience без записи в DESIGN.md; нет eyebrow-капса и выделенного слова в заголовке; mono только для кода; кегли из шкалы, минимум 12px, поле 16px на мобиле; `tabular-nums`, без count-up |
| Раскладка | нет карточки в карточке и «всего в карточках»; радиусы 3–4 + pill; нет цветной полоски-бордера; blur только у хрома; нет шаблонного hero и hero-метрики; модалка не первый выбор |
| Движение | нет fade-up у каждой секции; hover без подъёма, масштаба и тени; 100–300 мс, ease-out, без bounce, без `transition: all`, без бесконечных декоративных анимаций; `prefers-reduced-motion` обязателен |
| Иконки, текст | одна библиотека, иконка только если кодирует смысл, нет ✨; em dash запрещён в EN и в RU-ярлыках/кнопках/заголовках, в полных русских предложениях по грамматике; нет `A · B · C`, `→` в кнопках; стоп-слова; заголовок существительное, кнопка с глагола, sentence case; нет придуманных цифр и бейджей без данных |
| Состояния, касание | пустое = что пусто + действие; ошибка говорит что случилось и что сделать; цели ≥ 40×40 (правило пользователя; 44 рекомендуется в DESIGN.md tma/game); фокус-кольцо 2px; disabled одной opacity; реальные `h1–h3` |

**Enforcement: правило → механизм** (Tailwind v4 + `tv()` [13]; всё на `error`, `warn` = долг [03]):

| Правило | Механизм |
| --- | --- |
| только токены для цвета, кегля, радиуса, отступов, теней, длительностей | сброс темы в `@theme` (`--color-*: initial` и остальные namespace), токены через `@theme inline`; `eslint-plugin-better-tailwindcss`: `no-unknown-classes`, запрет произвольных `[..]`; в `*.styled.ts` запрет hex/rgb/oklch; stylelint на `.css` [13 R4] |
| стили только в файле-спутнике | ESLint: `className` только из рецепта, `style` только с CSS-переменной; импорт `tv`/`clsx`/`tailwind-merge` только в `*.styled.ts` |
| нет градиентов, blur, `uppercase`, `infinite`, bounce, `transition: all`, `dark:`, hover с подъёмом | `no-restricted-classes` по списку из [07 F8] и [13 R4]; allowlist Spinner/Skeleton/Scrim/StickyHeader/Kbd |
| reflex-шрифты | `--font-*: initial`, семейство только из токенов приложения; stylelint на `font-family` вне `tokens.css` |
| текст | `lint:copy` по i18n-JSON: em dash, `·`, `→`, капс, Title Case, стоп-слова, придуманные цифры, повтор CTA, Lorem |
| структура, hero, карточки, центрирование, мелкий текст, цели касания | `design:scan` (Playwright, DOM-эвристики с порогами; отчётный режим на первых проектах, затем gate) |
| палитра, контраст, процесс | скрипт по `tokens.css` (ΔE к стоп-цветам, нейтральность теней, контраст пар ролей); CI требует `DESIGN.md`; PostToolUse-хук гоняет lint по изменённому файлу |

## 7. Pixel-perfect по Figma (модуль `figma`)

Ограничение: доступ к макетам обычно view-only, платных seats скорее всего нет. На бесплатном плане MCP и REST дают
порядка 6–20 вызовов в месяц, Code Connect и REST Variables API недоступны [09 F2, F4]. Поэтому единственный режим —
**снимок макета в репозитории**; MCP в основном пути не используется.

| # | Этап | Механизм | Гейт |
| --- | --- | --- | --- |
| P0 | контракт | `docs/design-qa-contract.md`: брейкпоинты, допуски, иерархия источников, что не бывает pixel-perfect [09 R10] | подписан до вёрстки |
| P1 | экспорт | минимальный Figma-плагин «Export frame → JSON + PNG» (дерево узлов, геометрия, auto-layout, стили текста, переменные, strokes, PNG @2x, SVG; переменные → DTCG); запускает дизайнер или пользователь после запроса edit-доступа. Fallback: REST bulk (2 вызова на экран) и ручной ввод из Dev Mode в тот же JSON | `design/specs/*.json` + `design/frames/*.png` + `meta.json` в репо |
| P2 | токены | DTCG → Style Dictionary → `tokens.css`, `@theme inline`, `canvas.ts`; `tokens:check` в CI | PR с diff токенов |
| P3 | компоненты | `design/component-map.json` (компонент Figma → kit + variant→props) | каждый инстанс в карте или ⚠️ |
| P4 | план | `/figma-implement` по снимку: Name map с `data-figma`, Reuse map, Token mapping (нет токена → ⚠️, ближайший молча не подставлять), i18n-ключи, Responsive table, baseline = самый узкий фрейм | approval по всем ⚠️ |
| P5 | вёрстка | блок за блоком; маппинг [09 F3]: stroke inside → `inset box-shadow` или padding − stroke, явный `line-height`, `letter-spacing %` → em, hug/fill/fixed → flex; тексты из словаря, иконки из библиотеки, те же файлы шрифтов | `figma:measure` по блоку зелёный, кап 5 итераций |
| P6 | сверка | (a) `figma:measure`: DOM-замеры в Docker по `data-figma` против spec, цвет по токену — блокирующий; (b) `figma:diff` против PNG с heatmap по узлам — advisory; (c) агенты-инспекторы по секциям по снимку | 0 fail вне `design/deviations.md` |
| P7 | приёмка | два свежих ревьюера, HTML-отчёт с overlay, запись отклонений, эталоны code-vs-code VRT из Docker | sign-off |

Допуски [09 R7]: геометрия нетекстовых боксов 0 (±0.5); позиция ±1px; высота текстового бокса ±1px на строку; ширина
hug-текста ±2 %; число строк и шрифт точно; цвет по токену; тени/блюр advisory; pixel-diff кропа > 3 % → «посмотри».
Юзабилити выше пикселя. Не бывает pixel-perfect (в контракт): растеризация текста, переносы на реальных данных,
ширины между фреймами, нативные контролы и шапка Telegram, blur/тени/градиенты, дробные значения, другая версия
шрифта. Проверено [09]: лимиты платных планов, Plugin API видит переменные на любом плане, Style Dictionary и DTCG.
Не проверено (фаза модуля): запуск плагинов на view-only, точные лимиты бесплатного плана, inspect Dev Mode без Dev
seat. Без модуля остаются VRT и `frontend-design` для экранов без макета.

## 8. Init и очистка

**Модель — вычитание по манифесту** [06]: исходный репо — рабочий монорепо со всеми шаблонами под обычным CI; init
только удаляет и перегенерирует несколько файлов. У каждого файла ровно один владелец: core, модуль, граф пакетов или
генератор. Шаблон = `apps/<id>` целиком (Dockerfile, compose, deploy.json, env.example, CLAUDE.md, DESIGN.md, README,
e2e) + `docs/templates/<id>.md` + `.claude/skills/<id>-*`. Общие пакеты обрезаются по графу `workspace:*`, ручных
списков нет. Конфиги без списков: CI находит приложения по `apps/*/deploy.json`, `exports` через wildcard, ESLint и
tsconfig у каждого пакета свои, корень без зависимостей шаблонов. Маркеры `<!-- init:<id> -->` только в Markdown;
генерируются `compose.yaml` и таблица README.

**Команда** `pnpm run setup` запускает закоммиченный Node-бандл до `pnpm install` (кириллица в пути и `.cmd`-шимы
учтены). Шаги: preflight (версии, незавершённый журнал, грязное дерево, занятые папки) → ввод (флаги, затем вопросы при
TTY) → план как список операций → `--dry-run` печатает и выходит → подтверждение → применение с write-ahead журналом,
удаляемое переносится в `.init-backup/` → install → чистка `pnpm-workspace.yaml` по новому lockfile → обновление
зависимостей (`safe` по умолчанию, в пределах диапазонов) → prettier → `pnpm verify --all` + knip + поиск остатков
удалённых модулей → `.boilerplate.json` → удаление матрицы и skill `init-project` → итог с подсказкой команды коммита
(init никогда не коммитит). Init и манифест остаются (`--purge-init` убирает), поэтому `--remove <id>` работает позже.
При любой ошибке автооткат из бэкапа, при обрыве `--resume` или `--rollback`; повторный запуск идемпотентен. Без TTY и
без обязательных флагов код 2, никаких зависаний. Флаги: `--templates`, `--features`, `--name`, `--scope`, `--update`,
`--verify`, `--yes`, `--dry-run`, `--json`, `--plan-out`/`--from-plan`, `--list`, `--resume`, `--rollback`,
`--remove`, `--purge-init`. Для агента skill `/init-project`: список → вопрос пользователю (агент не выбирает сам) →
dry-run и сводка → применение по сохранённому плану → отчёт. Раздача: `git clone`, «Use this template» или `giget`.

**Тесты** [06 F9]: на каждый PR статические проверки в `tools/checks` (`manifest-coverage`: файл без владельца =
ошибка; `isolation`; `markers`; `generated-up-to-date`) и юнит-тесты плана; e2e-матрица: на PR 6 одиночных шаблонов на
Linux, nightly 63 комбинации pairwise + одиночные на Windows с кириллическим путём и macOS, `--update latest` как
информационный job; тесты dry-run, отказа на каждом шаге, идемпотентности и `--resume`. После init `ai:check` ловит
висячие ссылки, `/context` новой сессии не показывает удалённых файлов.

## 9. Безопасность и бэкапы

**База** [10 §1]: фронт не хранит секретов, всё с публичным префиксом видно всем; zod-схема env, серверная не
импортируется в клиент; HTML и JSON-in-script только через `SafeHtml` и `serializeJsonForScript`, URL через `safeUrl`;
ESLint security-набор (`no-unsanitized`, запрет `dangerouslySetInnerHTML` вне `SafeHtml`, `no-eval`, токенов в
`localStorage`, `postMessage('*')`); заголовки из одного `security-headers.conf` (CSP сначала Report-Only, nonce для
SSR, HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP) и тот же набор в SSR middleware с e2e-тестом; токены:
BFF + httpOnly cookie лучше всего, иначе access в памяти, никогда `localStorage`; sourcemaps hidden; pnpm supply-chain
настройки, `--frozen-lockfile`, audit, Actions по SHA; Docker: BuildKit secrets, non-root, без git/ssh в рантайме,
digest, `.dockerignore` с `.env*`, `.git`, `.claude`; `.gitignore` `.env*` с `!.env.example`; secretlint в pre-commit,
gitleaks в CI и по `dist/`.

**По шаблонам** (чек-лист в `apps/<id>/CLAUDE.md`) [10 §2]: landing/blog: HTML из CMS через `SafeHtml`, CMS-токен
только на сервере, антибот + honeypot. shop: карта никогда не касается нашего кода (redirect по умолчанию, embedded по
флагу = строгий CSP на чекауте), цену считает провайдер, `purchase` по вебхуку. tma: `initData` проверяет только
бэкенд, фронт шлёт сырую строку и обменивает на сессию, `initDataUnsafe` только для UI, не логировать,
`frame-ancestors` для web-клиента Telegram, инвойс Stars создаёт бэкенд. admin: RBAC на клиенте только UX, CSV-injection
экранируется, `noindex`, `no-store`. game: античит и валюта только на сервере, обфускация не включается.

**Агент** [10 §4]: permissions не граница, на нативном Windows sandbox нет → deny/ask + guard + branch protection + нет
push-прав; автономные прогоны в WSL2/devcontainer; содержимое инструментов — данные, не инструкции; CI-ревьюер только
с чтением и хуком на запись в текущий PR. **Бэкапы** [10 §5]: protected branches, подписанные коммиты рекомендуются,
зеркало на второй хостинг + еженедельный `git bundle`, секреты CI в менеджере паролей, immutable-теги образов.
**Инцидент**: остановить агента и процессы → зафиксировать транскрипт и `git reflog` → оценить, что читалось, куда
ходило, что пушилось и ставилось → восстановить код (reflog, зеркало, ветку восстанавливает человек) → ротировать
секреты, начиная с прав на запись → переустановить с известного lockfile → пересобрать артефакты → закрыть дыру
правилом и записью в `security.md`.

## 10. Поддерживаемость человеком

Две документации, один факт — один источник [11 R1]: для людей на русском `README.md` (первая ссылка «Если прод упал»),
`ARCHITECTURE.md` ≤ 300 строк (codemap, инварианты «через отсутствие», сквозной путь запроса), `apps/<id>/README.md`
с таблицей «хочу найти / где / как проверить», `docs/runbooks/`, `docs/adr/`; для ИИ на английском `CLAUDE.md`-дерево,
rules, skills. Человеческие доки не содержат правил для агента, AI-доки ссылаются на них, пути и команды проверяет
`tools/checks`. Runbooks (≤ экран, формат «когда → проверить → сделать → убедиться», `Last drill` в шапке, прогон без
ИИ раз в квартал) [11 R3]: EMERGENCY, deploy (тег → образ = SHA → промоушен), rollback (только сменой образа),
hotfix (от прод-тега, `pnpm verify --hotfix`, ревью после), dependency-broken, api-down (рубильник `maintenance`),
white-screen, config-env, secrets-leak.

Пределы магии [11 R5]: нет DI и декораторов; нет шины событий на `document`; кодген только OpenAPI, иконки, токены, с
коммитом результата и `linguist-generated`; ≤ 4 прыжка от страницы до сети; путь ≤ 6; свои ESLint-правила с причиной
и тестом; `max-lines` без ADR не отключается. Встроенная отладка [11 R7]: `/version.json` = Sentry release = тег
образа; ErrorBoundary на маршрут с блоком «Детали для поддержки» и request id; `log.*` и `?debug=1`; рубильники в
`/config.json` без пересборки с владельцем и `expires`, CI падает на истёкшем. Чек-лист ревью ИИ-кода из 13 пунктов
[11 R8] встроен в `rules-reviewer` и шаблон PR; ADR (MADR-lite) при выборе библиотеки уровня приложения, исключении
из правила или решении дороже недели отката; стартовые 8–12 ADR описывают уже принятые решения.

## 11. Порядок работ

Все шесть шаблонов в объёме; волны задают порядок, не отрезают функции.

| Волна | Deliverables | Критерий выхода |
| --- | --- | --- |
| **0. Фундамент** | проверка 12 механизмов Claude Code на реальной установке [08 §7]; smoke-сравнение API-генераторов по спекам Medusa и реального бэкенда; smoke-сборка стилевого слоя по 9 рискам [13 R6]; ADR 0001–0012; шаблон контракта с дизайнером | таблица «механизм → работает/обход»; выбран генератор; стилевой слой подтверждён или включён fallback |
| **1. Ядро + tma + admin + AI + init** | все `packages/*`, включая `MobxQuery v2` и маппинг ошибок; `tools/checks` и гейт; `.claude/*` (CLAUDE.md-дерево, 10 rules, settings, 4 хука с тестами, 10 core skills, 4 агента); `apps/tma`, `apps/admin` с CLAUDE.md/README/DESIGN.md; Dockerfile на приложение; GitHub Actions ci и deploy; init с манифестом, бэкапом, dry-run, матрица для 2 шаблонов; runbooks EMERGENCY/deploy/rollback/hotfix/config-env; `ARCHITECTURE.md`, README; перенос docs в rules с исправлениями [01 R6], [05 §8] | гейт зелёный; init любого подмножества {tma, admin} даёт зелёный гейт и `pnpm dev`; образы отвечают `/version.json`; `/context` новой сессии показывает только нужные файлы; человек проходит rollback на staging без ИИ |
| **2. landing + blog + anti-slop** | `packages/astro-shared`, `apps/landing`, `apps/blog` с опциями; anti-slop lint на error, `lint:copy`, скрипт палитры; `design-reviewer`, skills `design-review`, `frontend-design` с режимами, `qa-handoff`, `security-check`; Lighthouse CI; runbooks dependency-broken/api-down/white-screen; матрица на 4 шаблона | kit собирается в островах без провайдеров; CWV-бюджеты проходят; lint 0 ошибок на эталонных экранах; матрица одиночных и пар зелёная |
| **3. game + shop + модули** | `apps/game`; `apps/shop` с адаптерами и compose для Medusa; модуль `figma` (плагин-экспортёр, measure/diff, skills, инспектор, Docker-образ тестов); `design:scan`; CI-ревьюер; `ai:sync`; команда `add`; GitLab CI; шаблонные skills | shop e2e на `mock` до оплаты; образ shop один на окружения; game smoke с seed; `figma:measure` зелёный на реальном экране; nightly 63 комбинации зелёные |

## 12. Решения и подтверждения

**Решения пользователя (2026-10-14)**: несколько шаблонов в одном монорепо; только фронтенд; Docker на своих серверах;
только веб; Codex не приоритет; landing на Astro; MobX plain-классы без DI + TanStack Query, без Zustand/Redux, React
Compiler выключен; комментарии только там, где без них код не понять, и они объясняют, как работает фича;
`types.ts`/`consts.ts`/`utils.ts` и файл стилей всегда отдельно; GitHub первый; blog — шестой обязательный шаблон на
Astro; Figma обычно view-only, платных seats скорее всего нет; shop — оба рынка через адаптеры с одним интерфейсом и
mock-адаптером.

Все решения оркестратора отмечены по тексту (§2–§11) со ссылками на отчёты; оспорить можно любое. Те, что нигде больше
не названы: Umami как аналитика по умолчанию, GTM только явной опцией; Sentry SDK с DSN на SaaS или GlitchTip; теги
деплоя `<env>-<timestamp>`, Helm после compose; em dash запрещён как декоративный разделитель; подписанные коммиты
рекомендованы, не обязательны; `design:scan` отчётный на первых проектах, затем gate; `add` и GitLab CI в волне 3;
порядок core → tma → admin → landing → blog → game → shop.

**Нужно подтвердить** (ответ номерами):

1. **Next.js для shop рядом с Astro или один стек.** Цена Next для всего монорепо: Turbopack только у shop, vendored
   canary React, правила kit (`'use client'` пофайлово, без barrel с директивами, `transpilePackages`) обязательны для
   всех, ручная интеграция i18next с Cache Components, Redis handler и общий ключ Server Actions при нескольких подах
   [05 §4], [05b]. Альтернатива: TanStack Start на Vite (RSC ранние, без тегового кэша) или Astro с `landing-node`.
2. **Стилевой слой: Tailwind v4 через `tv()` только в `Name.styled.ts`** (в `.tsx` ни одного строкового класса, kit
   закрыт для `className`) — подтвердить; fallback CSS Modules + CSS-переменные + `data-*`-варианты [13].
3. **Тема TMA**: нативная из `--tg-theme-*` + один брендовый акцент по DESIGN.md (дефолт) или брендовый режим со
   своими цветами [05c], [07a].
4. **Auth админки по умолчанию**: PKCE в статике с записанным порогом «ПДн, деньги, клиентский кабинет → опция `bff`»
   или BFF сразу [05d], [10].
5. **Кто запускает Figma-экспортёр**: дизайнер по handoff-процессу или пользователь после запроса edit-доступа; плюс
   проверка, запускаются ли плагины на view-only [09].
6. **Язык человеческих доков**: русский по умолчанию; английский, если придут нерусскоязычные подрядчики [11].

## 13. Риски и проверки

| # | Риск | Мера |
| --- | --- | --- |
| 1 | Механизмы Claude Code не проверены руками: `paths` с brace-glob, плагины из project settings, `onFailure`, `autoMemoryEnabled`, MCP через `.cmd`, guard на Windows с кириллицей, Stop без цикла [08 §7] | волна 0: таблица «механизм → работает/обход»; `ai:doctor` требует минимальную версию |
| 2 | `MobxQuery v2`: гонки гидрации и отписки, на которые xRocket потратил 512 строк [02 F3] | явный API, тесты на `QueryObserver`, запрет в SSR, эталон в rules |
| 3 | Свежие мажоры: TS 7, Vitest 5 ↔ Storybook, MSW 3, Base UI, Table v9, MobX 7, Astro под Cloudflare, Next 16 canary React, tma.js 4 RC, Hey API без stable | catalog пинит проверенные версии; smoke-сборки; `--update latest` nightly |
| 4 | Стилевой слой [13 R6]: kit как исходник в Next/Turbopack, острова без дублирования CSS, `tailwind-merge` с токенами, `better-tailwindcss` в монорепо, Base UI `className`-функция, FOUC темы в SSR, перекраска TMA, вес `tailwind-variants` в бюджете TMA | smoke-сборка kit + tma + landing в волне 0; при провале fallback CSS Modules |
| 5 | Next в монорепо и Medusa, которую кто-то должен эксплуатировать (Node + Postgres + Redis) | подтверждение 1; shop последним; compose для dev, `mock` для CI |
| 6 | Figma на бесплатном плане: плагины на view-only, лимиты, Dev Mode | проверка на реальном файле в волне 3; fallback REST bulk + ручной JSON; модуль не блокирует остальное |
| 7 | Модели копируют старый паттерн (`LoadingStatus` руками, Phaser 3 API, `@telegram-apps/*`); правила без механизма не живут (xRocket: 95 нарушений слоёв, 315 сырых кеглей, 233 отключения) [01], [03] | lint на запрещённые импорты и паттерны; каждое правило с `enforced by` или `manual`; `warn` запрещён |
| 8 | Объём (6 шаблонов, ~15 инструментов, 18 skills) и дорогая матрица init; Windows-ловушки init | волны с критериями выхода; один раннер проверок; PR только одиночные шаблоны, nightly pairwise; retry и бэкап без `node_modules` |

Проверки на реальной установке: 12 механизмов Claude Code; smoke-сборка каждого шаблона с kit (бюджеты: tma ≤ 150 KB
gz initial, game ≤ 500 KB gz, landing ≤ 50 KB gz JS на главной); стилевой слой в Next и Astro одновременно; Storybook +
Vitest 5; генератор по спеке Medusa; эталоны Playwright только из Docker; Figma-плагин на view-only и `figma:measure`
на реальном экране; init-матрица на Windows с кириллическим путём; `rollback.md` на staging руками; `/context` после
init.
