# 22b. Smoke: kit + стилевой слой + Vite/Astro + Storybook

Status: done · 2026-10-15 · агент B волны 0 · ветка `worktree-agent-a6a159c4e0ad3b175` · спайк `spikes/kit/`

## Resume notes

- Всё из задания сделано и измерено; суб-агент не запускался.
- Спайк — отдельный pnpm 11 workspace в `spikes/kit/` (`packages/tokens`, `packages/ui`, `apps/spa`, `apps/astro`).
  Повторить: `corepack pnpm install` → `pnpm tokens` → `pnpm lint`, `pnpm lint:css`, `pnpm typecheck`,
  `pnpm --filter @kit/ui test`, `pnpm --filter @kit/ui test:stories`, `build` в каждом приложении.
- Скрипты замеров (Playwright-пробы, атрибуция бандла, размеры библиотек) лежали в scratchpad сессии и в репо не
  попали. Их логика описана ниже в разделе «Детали».
- Не сделано: прогон на реальных iOS/Android, HMR в Astro dev, проверка `addon-mcp` в живой сессии Claude Code
  (проверен только протокол через HTTP).

## Summary (≤ 15 lines)

1. Схема «Tailwind v4 + `tv()` только в `Name.styled.ts` + токены через CSS-переменные» работает в Vite 8, Astro 7
   (острова) и Storybook 10. Fallback на CSS Modules **не нужен**.
2. Kit как исходник: все классы kit есть в prod CSS обоих приложений. В Astro один общий CSS-файл на все страницы,
   острова CSS не импортируют, дублей нет.
3. **`tailwind-merge` по умолчанию ломает токены:** `twMerge('text-fg text-label-md')` → `text-label-md` (цвет
   теряется), а `rounded-control rounded-pill` не схлопывается. Лечится `twMergeConfig`, который генерируется из
   `packages/tokens`, и общим `createTV` в `@kit/ui/tv`. Юнит-тест закрепляет поведение.
4. Закрытый kit: `Omit<Base.Props, 'className' | 'style'>` убирает и строку, и функцию от state. `@ts-expect-error`
   тесты проходят. Состояния пишутся через `data-*`-варианты.
5. FOUC нет: инлайн-скрипт ставит `data-theme` до появления `<body>`. CSP-хэш в SPA считает Vite-плагин, в Astro
   — `security.csp: true`. Нарушений CSP нет. Негативный тест: с изменённым скриптом CSP блокирует его.
6. HMR правки рецепта kit и `tokens.css` в SPA срабатывает за 0,1–0,2 с без полной перезагрузки.
7. Storybook 10.6.1: сборка 3,1–3,5 с, preview в dev 1,3 с. `addon-vitest` + Vitest 5 + Edge: 9 story-тестов за
   5,7 с, a11y ловит нарушения. `addon-mcp` отдаёт 8 инструментов, `docs-list`/`docs-show`/`test-run` работают.
8. **Найден баг кириллического пути** в `@storybook/addon-vitest`: без патча 0 тестов («No test suite found»).
   Исправлено `pnpm patch` (1 строка, `decodeURIComponent`).
9. ESLint 10 + better-tailwindcss + `no-restricted-syntax` ловят все 12 классов нарушений из фикстуры (35 ошибок).
   **Ловушка:** без `tailwindcss` в корне плагин *молча выключает* свои правила, а exit-код остаётся 0.
10. JS: SPA initial 132,6 KB gz (бюджет tma 150). Astro: главная 110,9 KB gz, about ~87 KB gz. Любой React-остров
    ломает бюджет landing ≤ 50 KB gz, потому что только `react-dom/client` весит 64,8 KB gz.

## Results table

| # | Механизм | Итог | Доказательство |
| --- | --- | --- | --- |
| 1 | pnpm 11.28.5 через corepack, `catalog:`, `minimumReleaseAge`, `allowBuilds`, `patchedDependencies` | работает | install 18 с, повторный 2 с |
| 2 | `packages/tokens`: TS → `tokens.css` (`:root` / `[data-theme=dark]`) + `theme.css` (`@theme` reset + `@theme inline`) + `canvas.ts` + `twMergeConfig.ts` | работает | `node scripts/build.ts` (Node 24 type stripping, без tsx) |
| 3 | Сброс темы `--*: initial` + свои токены | работает | `bg-indigo-500`, `shadow-lg`, `text-white`, `animate-bounce` неизвестны линтеру; `transparent`/`current` живы |
| 4 | Kit как исходник в Vite 8 (rolldown) | работает | 14/14 проверенных классов kit в `dist/assets/*.css` |
| 5 | Kit как исходник в Astro 7 островах, без дублей CSS | работает | один `Base.*.css` на обе страницы, острова без CSS, `@layer theme` 1 раз |
| 6 | `@source '../'` в `kit.css` через workspace-симлинк | работает | Vite отдаёт kit по реальному пути `/@fs/.../packages/ui/src` |
| 7 | `tailwind-merge` + кастомные токены (R6.4) | **обход** | дефолт теряет `text-fg`; сгенерированный `twMergeConfig` чинит; тест `tv.test.ts` 5/5 |
| 8 | Base UI `className`-функция и `style` закрыты в типах (R6.6) | работает | `src/typetests/closedKit.tsx`, `tsc` exit 0 |
| 9 | Dialog с exit-анимацией (`data-starting/ending-style`) и возвратом фокуса | работает | story-тест видит `data-ending-style`, потом unmount, фокус на триггере; e2e в обоих приложениях |
| 10 | `ScreenTransition` SPA: TanStack `defaultViewTransition` | работает | Edge: `startViewTransition` вызван, CSS-fade при поддержке VT не дублируется (`animation-name: none`) |
| 11 | `ScreenTransition` Astro: нативный кросс-документный VT | работает | `pagereveal.viewTransition` есть после перехода `/` → `/about/` |
| 12 | Fallback-fade без VT + reduced motion | частично | CSS есть в сборке (`@supports not (view-transition-name:none)`, `motion-reduce:animate-none`, `::view-transition-*{animation:none}` под reduce); в браузере без VT не прогонялся |
| 13 | FOUC темы + CSP-хэш инлайн-скрипта (R6.7) | работает | `data-theme` выставлен до `<body>` в 4 комбинациях (dark/light × reduce), 0 CSP-нарушений; подмена скрипта → блок |
| 14 | Самохостинг шрифта Onest через токены | работает | `document.fonts.check('16px "Onest Variable"') === true` при `font-src 'self'` |
| 15 | HMR (SPA dev): рецепт kit и `tokens.css` | работает | 105 мс и 213 мс, `window`-маркер жив |
| 16 | Storybook 10 react-vite + Tailwind v4 | работает | build 3,1–3,5 с, dev preview 1,3 с |
| 17 | `addon-vitest` (Vitest 5, browser mode, Edge) | **обход** | баг кириллического пути, `pnpm patch`; после него 9/9 тестов |
| 18 | `addon-a11y` в тестах (`a11y.test: 'error'`) | работает | пустая кнопка → `button-name` валит тест |
| 19 | `addon-mcp` (`componentsManifest: true`) | работает (preview) | `tools/list` = 8; `docs-list`, `docs-show`, `test-run` отвечают |
| 20 | ESLint 10 flat + better-tailwindcss 4.9.0 | работает с оговоркой | 35 ошибок на фикстуре, 0 на коде; без `tailwindcss` в корне правила молча выключаются |
| 21 | stylelint 17 + токен-плагин | работает | 7 ошибок на фикстуре, 0 на коде |
| 22 | Бюджет JS SPA (tma ≤ 150 KB gz) | в бюджете | 132,6 KB gz |
| 23 | Бюджет JS Astro (landing ≤ 50 KB gz) | **превышен с React-островами** | главная 110,9 KB gz, about ~87 KB gz |

## Details

### Версии (exact, правило «последний патч старше 7 дней», cutoff 2026-10-08)

Node 24.18.0, pnpm 11.28.5 (corepack 0.35.0), TypeScript 6.0.3, Vite 8.3.3, `@vitejs/plugin-react` 6.1.2, React /
React DOM 19.3.0, `@types/react` 19.3.0, `@tanstack/react-router` 1.170.41, Astro 7.3.7, `@astrojs/react` 7.0.1,
Tailwind / `@tailwindcss/vite` 4.3.3, tailwind-variants 3.3.1, tailwind-merge 3.7.0, `@base-ui/react` **1.8.0**,
`@fontsource-variable/onest` 5.3.1, Storybook и аддоны 10.6.1, Vitest и `@vitest/browser(-playwright)` 5.0.3,
Playwright 1.64.0 (браузер — системный Edge), ESLint 10.12.0, `@eslint/js` 10.0.1, typescript-eslint 8.71.1,
eslint-plugin-better-tailwindcss **4.9.0**, globals 17.13.0, stylelint 17.16.0, stylelint-config-standard 40.0.0,
stylelint-value-no-unknown-custom-properties 6.1.1, `@types/node` 24.19.1.

Отличия от отчётов 13/17 из-за правила 7 дней: Base UI 1.8.0 вместо 1.9.0 (вышел 2026-10-09), Astro 7.3.7 вместо
7.3.8, Vite 8.3.3 вместо 8.3.4, better-tailwindcss 4.9.0 вместо 4.9.1, Storybook 10.6.1 вместо 10.6.2, Vitest 5.0.3
вместо 5.0.4.

Глобально ничего не ставилось. corepack скачал pnpm 11.28.5 в свой кэш.

### Структура и правила компонента

`packages/ui/src/<Name>/`: `Name.tsx` + `Name.styled.ts` (только `tv()`) + `types.ts` + `consts.ts` + `index.ts`
(+ `utils.ts` у `ScreenTransition`, + `Name.stories.tsx`). Компоненты: `Button` (tone primary/neutral/ghost/danger ×
size sm/md/lg × fullWidth × loading; disabled; hover/active через `not-data-disabled:`; focus-visible), `Field`
(Base UI Field: label/description/error, invalid, disabled, size md/lg), `Dialog` (Base UI Dialog: Backdrop +
Viewport + Popup, exit через `data-ending-style`, `render`-проп для триггера и Close), `ScreenTransition` (+
`startScreenTransition()` и `supportsViewTransitions()`).

- Наружу только типизированные варианты и layout-пропы (`fullWidth`, `layout`). `className`/`style` в типах нет.
- Приложения стилизуют свои элементы так же: `Page.styled.ts` + `className={styles.slot()}`. Рецепты строятся
  через `@kit/ui/tv`, у которого общий `twMergeConfig`.
- Токены, которых нет в namespace Tailwind, сделаны через `@utility` в `kit.css`: `duration-fast`,
  `duration-base`, `transition-presence` (opacity + scale + translate), `opacity-disabled`, `bg-scrim`.
  `--default-transition-duration` и `--default-transition-timing-function` взяты из токенов, поэтому
  `transition-colors` без модификаторов уже токенный.
- `hover:` в Tailwind v4 сам оборачивается в `@media (hover: hover)`. Отдельные hover-токены под media не нужны.
- `@custom-variant no-vt` (`@supports not (view-transition-name: none)`) включает CSS-fade только там, где нет VT.
  Так fade не накладывается на View Transition.

### tailwind-merge (R6.4)

```
twMerge('text-fg text-label-md')          → "text-label-md"            (цвет потерян)
twMerge('rounded-control rounded-pill')   → "rounded-control rounded-pill" (конфликт не найден)
twMerge('bg-accent bg-surface-1')         → "bg-surface-1"             (ок)
```

Генератор пишет `twMergeConfig = { extend: { theme: { text: [...], color: [...], radius: [...], shadow: [...] } } }`.
`createTV({ twMergeConfig })` в `packages/ui/src/styles/tv.ts`. Тест `tv.test.ts` проверяет 5 случаев. Линтер
(`no-conflicting-classes`) находит конфликты сам, через CSS-свойства, и `twMerge` для этого не нужен.

### Кириллический путь: баг `@storybook/addon-vitest` 10.6.1

Симптом: `Error: No test suite found in file …/Button.stories.tsx` на каждом файле stories. Трансформ отрабатывает,
но сгенерированный код регистрирует тесты только при
`convertToFilePath(import.meta.url).includes(testPath)`. А `convertToFilePath` декодирует только `%20`
(`dist/vitest-plugin/test-utils.js:75`), поэтому `%D0%A0%D0%B0…` ≠ `Работа`. Патч
(`spikes/kit/patches/@storybook__addon-vitest@10.6.1.patch`) заменяет это на `decodeURIComponent(...)`. Нужно
завести issue в Storybook. Пока исправления нет, патч переносим в волну 1 и пиним Storybook exact.

### ESLint: что ловится (фикстура `lint-fixtures/`, `pnpm lint:fixtures`)

| Нарушение | Правило |
| --- | --- |
| `bg-indigo-500`, `text-white`, `shadow-lg`, `animate-bounce`, `#ffffff` как класс | `better-tailwindcss/no-unknown-classes` |
| `bg-[#ff00aa]`, `p-[13px]`, `w-[calc(...)]` | `no-restricted-classes` (`\[`) |
| `transition`, `transition-all` | `no-restricted-classes` + `no-conflicting-classes` |
| `dark:bg-surface-2` | `no-restricted-classes` (`(^\|:)dark:`) |
| `bg-linear-to-r`, `from-accent` | `no-restricted-classes` (градиенты) |
| `hover:scale-105`, `animate-bounce` | `no-restricted-classes` (anti-slop) |
| `p-5`, `gap-7`, `mt-13` | `no-restricted-classes` (шаг вне шкалы) |
| `text-fg text-fg-muted`, `p-5 … p-4` | `no-conflicting-classes` |
| `flex flex` | `no-duplicate-classes` |
| `'#ffffff'` в `*.styled.ts` | `no-restricted-syntax` (сырой цвет) |
| `className="flex gap-4"`, шаблонная строка, тернарник в `className` | `no-restricted-syntax` в `.tsx` |
| `style={{ marginTop: 13 }}` (а `--progress` разрешён) | `no-restricted-syntax` в `.tsx` |
| `import { tv } from 'tailwind-variants'`, `twMerge` в `.tsx` | `no-restricted-imports` |

На реальном коде 0 ошибок. Ложных срабатываний на токенах, `data-*`-вариантах Base UI, `@utility` и
`@custom-variant` нет. `entryPoint` задаётся на пакет: `kit.css` для ui, `app.css` и `site.css` для приложений
(`link-active:` известен только в SPA). Время: ~2,6 с на весь спайк.

**Ловушка:** если `tailwindcss` не резолвится из cwd ESLint, плагин пишет `⚠️ Tailwind CSS is not installed.
Disabling rule …` и выключает все 5 правил с exit 0. Нужен канареечный тест в гейте: фикстура обязана падать.

`.astro` этим набором не линтились (нужен `eslint-plugin-astro`). Рецепты для `.astro` живут в `*.styled.ts` и
проверяются, а атрибуты `class=` внутри `.astro` пока нет.

### stylelint (`pnpm lint:css`, `pnpm lint:css:fixtures`)

`stylelint-config-standard` + `at-rule-no-unknown` с исключениями для Tailwind (`theme`, `source`, `utility`,
`custom-variant`, `variant`, `apply`, `reference`, `slot`, `view-transition`), `color-no-hex`,
`function-disallowed-list` (rgb/hsl/oklch), `declaration-property-value-disallowed-list` (`transition: all`,
`transition-property: all`, список запрещённых шрифтов из 07), `csstools/value-no-unknown-custom-properties` по
сгенерированным `tokens.css` и `theme.css`. На фикстуре 7 ошибок: hex, `rgb()`, `transition: all`,
`transition-property: all`, `Space Grotesk`, `var(--space-unknown)`, длина hex. Для сгенерированных файлов
стилистические правила выключены override'ом.

### FOUC и CSP

- Скрипт в `<head>` до CSS: читает `localStorage.theme`, иначе `prefers-color-scheme`, и ставит
  `html[data-theme]`.
- SPA: Vite-плагин `theme-init-csp` (`apply: 'build'`) считает sha256 тела скрипта и вставляет
  `<meta http-equiv="Content-Security-Policy">` с `script-src 'self' 'sha256-…'; style-src 'self'; font-src 'self'`.
  В dev CSP нет: Vite вставляет свой инлайн-преамбул.
- Astro: `security: { csp: true }` хэширует `is:inline`-скрипт, скрипты островов и свой `<style>` для
  `astro-island`. Предупреждение про Shiki не мешает (markdown в спайке не используется).
- Проба Playwright + Edge: `MutationObserver` фиксирует `data-theme` в момент добавления `<body>`. Результат во
  всех 4 контекстах (dark/light × reduced motion) по обоим приложениям: тема уже выставлена, фон правильный,
  `securitypolicyviolation` нет. Инлайн-стили Base UI (`style="--nested-dialogs:0"`) идут через CSSOM и под
  `style-src 'self'` не блокируются.

### Бюджеты и размеры (gzip -9)

| Артефакт | raw | gz |
| --- | --- | --- |
| SPA `index.js` (весь initial JS) | 414 546 | **132 589** |
| SPA CSS | 20 489 | 5 658 |
| Astro главная, весь JS (client 64 830 + Button-чанк 16 751 + CancelDialog 16 810 + CheckoutForm 5 621 + react 3 229 + react-dom 1 385 + прочее) | — | **110 940** |
| Astro about (client + react + Button + ThemeToggle, оценка) | — | ~87 000 |
| Astro CSS (один на сайт) | 19 552 | 5 521 |
| Шрифт Onest latin / cyrillic (woff2, грузится по unicode-range) | 33,8 KB / 15,9 KB | — |

Состав SPA по sourcemap (raw): react-dom 50 %, Base UI 17 %, TanStack Router ~17 %, tailwind-variants +
tailwind-merge 9,7 %, kit-код 1,2 %. Отдельные сборки, min+gz:

| Библиотека | gz |
| --- | --- |
| `tailwind-merge` | 8,5 KB |
| `tailwind-variants` (с merge) | 12,6 KB |
| `tailwind-variants/lite` (без merge) | 3,6 KB |
| `@base-ui/react/button` / `field` / `dialog` | 3,0 / 8,4 / 20,9 KB |

R6.9: стилевой рантайм стоит ~12,6 KB gz. Переход на `tv/lite` экономит ~9 KB, но тогда конфликт base ↔ variant
решает порядок CSS. Линтер такие конфликты между разными строками рецепта не видит. Рекомендация: оставить полный
`tv`. `lite` рассматривать только для landing.

### Время

| Операция | Время |
| --- | --- |
| `pnpm install` (холодный / повторный) | 18 с / 2 с |
| `vite build` SPA | 1,1 с wall (rolldown 189 мс) |
| `astro build` | 11,2 с wall, из них 2,4 с сборка (остальное sync/types/запуск) |
| Vite dev ready | 249 мс |
| `storybook build` (холодный / тёплый) | 3,5 с / 3,1 с, 8,6 МБ |
| `storybook dev` | manager 129 мс, preview 1,3 с; ~13 с от команды до первого ответа `iframe.html` (включая npx) |
| story-тесты (`vitest --project storybook`, 9 тестов) | 5,7 с |
| MCP `test-run` одной story | 4,6 с |
| ESLint всего спайка | ~2,6 с |

### Мелкие наблюдения

- `TaskStop` или Ctrl-C фоновой `npx storybook`/`vite` на Windows оставляет node-процесс на порту. Нужно убивать по
  порту (`Get-NetTCPConnection -LocalPort … | Stop-Process`). В `pnpm dev` стоит учесть kill-tree.
- Rolldown выводит десятки предупреждений `MODULE_LEVEL_DIRECTIVE "use client"` из Base UI. Это шум, его можно
  гасить через `onLog` в конфиге.
- MCP-манифест подсказывает импорт `import { Button, Matrix } from '@kit/ui'`, которого не существует (у нас
  subpath-экспорты, а `Matrix` — хелпер stories). Нужно либо добавить корневой барел `@kit/ui`, либо настроить
  import-путь в манифесте. Таблицы пропсов в `docs-show` нет.
- `addon-a11y` в тестах проверяет только светлую тему. Тёмную нужно гонять вторым проектом с `globals.theme=dark`.
- `@base-ui/react` содержит свои docs (`docs/react/components/*.md`) прямо в пакете. Их удобно давать агентам.

## What wave 1 should take as is

- `packages/tokens`: `src/tokens.ts` (примитивы → роли light/dark, text, spacing, container, radius, shadow, motion,
  opacity) и `scripts/build.ts` → `tokens.css`, `theme.css` (`--*: initial` + `@theme inline`), `canvas.ts`,
  **`twMergeConfig.ts`**. Запускается `node`, без tsx.
- `packages/ui/src/styles/kit.css` (импорт Tailwind, шрифт, токены, `@source`, `no-vt`, `@utility` для motion и
  disabled, VT-CSS с reduced motion) и `styles/tv.ts` (общий `createTV`).
- Форма компонентов `Button`, `Field`, `Dialog`, `ScreenTransition` и `types.ts` через
  `Omit<Base.Props, 'className' | 'style'> & Variants`. Typetest `closedKit.tsx` как шаблон для каждого примитива.
- Storybook: `.storybook/main.ts` и `preview.tsx` (тема и `dir` тулбаром), `vitest.config.ts` с двумя проектами
  (unit + storybook, Edge-канал), хелпер `Matrix` + `Matrix.styled.ts`, Matrix-story на каждый компонент, плюс
  Overview.
- **Патч `addon-vitest`** (`patches/…`) и `patchedDependencies`, пока апстрим не исправит.
- `eslint.config.js` (наборы restricted-classes, `.tsx`-запреты, `entryPoint` на пакет) и `stylelint.config.js`.
  Обязательно `tailwindcss` в корневых devDependencies и канарейка «фикстура должна падать» в `tools/checks`.
- Vite-плагин `theme-init-csp` для SPA, `security.csp: true` + `is:inline`-скрипт для Astro.
- Шрифт по умолчанию — Onest Variable (`@fontsource-variable/onest`, самохостинг, кириллица, OFL, не из
  reflex-списка 07). Каждый шаблон может заменить его в `DESIGN.md` → токен `font.sans`.

## Plan changes proposed

1. **§3.1 «Стили»:** добавить «`tv` создаётся один раз через `createTV({ twMergeConfig })`, конфиг генерирует
   `packages/tokens`; импорт `tailwind-variants` вне `packages/ui/src/styles/tv.ts` запрещён lint'ом». Без этого
   `text-<color>` + `text-<size>` теряют один класс.
2. **§13 риск 5 → снят** для Vite и Astro (Next/Turbopack проверяет агент site). FOUC закрыт инлайн-скриптом с
   CSP-хэшем.
3. **§13 риск 1:** добавить «`@storybook/addon-vitest` ломается на не-ASCII путях; держим `pnpm patch` и pin;
   issue в апстрим».
4. **Бюджет landing ≤ 50 KB gz** несовместим с любым React-островом (рантайм React ≈ 69 KB gz). Варианты:
   (а) landing без React-островов: формы и тогглы — нативные `.astro` + маленький TS; kit-рецепты (`tv`) годятся и
   для `.astro`; (б) поднять бюджет landing до ~90 KB gz на страницу с островом; (в) Preact только для островов
   landing (риск совместимости с Base UI). Рекомендую (а) по умолчанию: остров только там, где нужен Base UI
   (диалог, форма с RHF), и бюджет на такие страницы ≤ 120 KB gz.
5. **Именование:** решение пользователя `Name.styled.ts` оставлено (отчёт 13 предлагал `.styles.ts`). Lint
   привязан к `*.styled.ts`.
6. **§11 волна 0 / §3.1:** добавить в гейт канареечный lint-тест. better-tailwindcss выключается молча.
7. Base UI в catalog — 1.8.0, пока 1.9.0 не станет старше 7 дней. На волну 1 это не влияет.

## Open issues

- Fallback-fade без View Transitions не проверен в браузере без VT (iOS 16.4–17, старый WebView). Нужен прогон на
  устройстве или в WebKit-сборке Playwright (не установлена).
- HMR в `astro dev` и kit-островах не мерился (SPA подтверждён, механизм тот же Vite).
- `addon-mcp` проверен по HTTP JSON-RPC. Регистрация как MCP-сервера в Claude Code (`.mcp.json`) — задача агента
  Claude Code-механизмов.
- Тёмная тема в a11y-тестах Storybook не гонялась, контраст тёмной палитры не измерен.
- `.astro`-файлы не линтятся на `class=` строки (нужен `eslint-plugin-astro` + `better-tailwindcss` для `.astro`).
- MCP-манифест предлагает несуществующий импорт `@kit/ui`. Решить барел или настройку манифеста в волне 1.
- Issue в Storybook про `convertToFilePath` не заведён (пуш и внешние действия вне рамок волны 0).
