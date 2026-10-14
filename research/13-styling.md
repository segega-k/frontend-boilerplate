# 13. Стилевой слой (styling approach)
Status: done
Updated: 2026-10-14 

## Resume notes
- Done: все разделы. Версии проверены через registry.npmjs.org 2026-10-14, статус интеграций проверен по changelog, докам и
  GitHub issues.
- Next: ничего. Пункты из «Риски для smoke-сборки» должен проверить агент, который строит `packages/ui` и первый шаблон.
- Sub-agent: нет.

## Summary (≤ 15 lines)
1. **Tailwind v4 остаётся, но в другой форме.** Классы пишем не в JSX, а через `tailwind-variants` (`tv()`) в
   соседнем файле `Button.styles.ts`. В `.tsx` только `className={button({ tone, size })}`. Это прямой аналог
   `Name.styled.ts` + `variants` из Tamagui. Правило «в JSX нет стилей» проверяет ESLint, а не ревью.
2. Почему Tailwind, а не «чистый» CSS-in-TS. У него официальные стабильные плагины для всех трёх сборщиков
   (`@tailwindcss/postcss` 4.3.3 для Next 16 + Turbopack, `@tailwindcss/vite` 4.3.3 с peer `vite ^8`). Агенты пишут его
   надёжнее всего (137 млн загрузок в неделю против 2,6 млн у vanilla-extract). shadcn-реестр на Base UI можно брать
   как исходник для kit. Ранний runtime и проблем с RSC нет.
3. **Место 2: CSS Modules + CSS-переменные + варианты через `data-*`, под stylelint.** Риск минимальный, машинные
   запреты самые сильные. Это запасной вариант, если пользователь отвергнет utility-классы вообще.
4. **Место 3: vanilla-extract (`Button.css.ts` + recipes).** По форме ближе всего к Tamagui, токены типизированы. Но в
   Next 16 Turbopack поддержка экспериментальная (`unstable_turbopack`). Плюс открыт issue #1786: в dev память доходит
   до 22 ГБ. Сейчас не брать, пересмотреть, когда Turbopack-плагин выйдет из 0.1.x.
5. Panda 2.2 (strictTokens удобен, но codegen, статическая экстракция ломается на динамике, один npm-мейнтейнер),
   StyleX (нет API вариантов, Windows-баг гидратации в Next/Turbopack #1924), Linaria (Turbopack только через
   сторонний `next-with-linaria`): ниже. Pigment CSS проект «on hold», исключён. styled-components и emotion исключены
   (runtime, не работают в RSC без `'use client'`; emotion не выпускался с 2024-12).
6. Конвенция: `Button/Button.tsx` + `Button.styles.ts` + `types.ts` + `consts.ts` + `index.ts` + `Button.stories.tsx`.
   Переименовать в docs `Name.styled.ts` → `Name.styles.ts` (`styled()` больше нет).
7. Проверка: тема Tailwind сброшена до наших токенов. `eslint-plugin-better-tailwindcss` 4.9.1 с правилами
   `no-unknown-classes`, `no-restricted-classes` (произвольные `[..]`, `transition`/`transition-all`, `dark:`, анти-AI
   список из 07) и `no-conflicting-classes`. ESLint `no-restricted-syntax` запрещает строковый `className` и `style` в
   `.tsx`. stylelint 17 проверяет все `.css` (токены, тема TMA, `@utility`).
8. Токены: источник `packages/tokens` (TS) → `tokens.css` (`:root` / `[data-theme=dark]`) + `@theme inline` для Tailwind +
   `canvas.ts` для игры. TMA мапит `--tg-theme-*` на семантические переменные в одном CSS-файле. Utility-классы
   ссылаются на `var()`, поэтому тема меняется без пересборки.

## Findings

### 1. Исходные условия
- Решение в `research/12-frame.md`: «Tailwind v4 with default theme reset… stylelint for plain CSS». Его же предлагали
  05 и 07. Правило пользователя (`docs/code-style.md`, `docs/library-notes.md`): стили в соседнем файле,
  `types.ts`/`consts.ts`/`utils.ts` отдельно, в `.tsx` только разметка. В xRocket стили жили в `Name.styled.ts` через
  Tamagui `styled()` + `variants`.
- Урок xRocket из отчёта 03: в `*.styled.ts` 591 сырое число против 270 токенов. Причина в том, что цветовое
  lint-правило не видело `styled({...})` и стояло на `warn`. Отсюда главный критерий: **запрет сырых значений
  проверяет машина на уровне error, и проверка видит именно тот синтаксис, на котором пишутся стили.**

### 2. Версии и здоровье проектов (npm registry, 2026-10-14; загрузки за неделю 2026-10-05…12)

| Пакет | latest | Дата | Загрузки/нед | Заметки |
| --- | --- | --- | --- | --- |
| `tailwindcss` / `@tailwindcss/vite` / `@tailwindcss/postcss` | 4.3.3 | 2026-07-16 | 137 млн | vite peer `^5.2 \|\| ^6 \|\| ^7 \|\| ^8`; insiders-сборки ежедневно |
| `tailwind-variants` | 3.3.1 | 2026-08-03 | — | peer `tailwind-merge >=3`; 1 мейнтейнер на npm |
| `tailwind-merge` | 3.7.0 | 2026-09-12 | — | 1 мейнтейнер |
| `class-variance-authority` | 0.7.1 | **2024-11-26** | — | релизов нет почти 2 года, хотя репозиторий живой |
| `eslint-plugin-better-tailwindcss` | 4.9.1 | 2026-10-13 | — | 1 мейнтейнер, очень активен |
| `@vanilla-extract/css` | 1.21.3 | 2026-10-08 | 2,6 млн | 5 мейнтейнеров, 10,4k★ |
| `@vanilla-extract/recipes` | 0.5.7 | 2025-06-12 | — | стабилен, редко меняется |
| `@vanilla-extract/next-plugin` | 2.5.2 | 2026-04-12 | — | зависит от `@vanilla-extract/turbopack-plugin` 0.1.4 |
| `@vanilla-extract/vite-plugin` | 5.2.6 | 2026-07-27 | — | peer `vite ^5…^8` |
| `@pandacss/dev` | 2.2.0 | 2026-10-09 | 0,54 млн | v2 на Oxc, ESM-only, Node ≥22; **1 мейнтейнер на npm** |
| `@stylexjs/stylex` | 0.19.1 | 2026-09-15 | 2,1 млн | 0.x, 232 открытых issue |
| `@linaria/core` / `@wyw-in-js/vite` | 8.2.0 / 2.5.1 | 2026-08/09 | 0,69 млн | Next только через сторонний `next-with-linaria` |
| `@pigment-css/react` | 0.0.31 | 2026-05-22 | — | README: «Alpha phase, currently, on hold» |
| `styled-components` | 6.6.0 (+7.0 prerelease) | 2026-10-12 | — | runtime |
| `@emotion/react` | 11.14.0 | 2024-12-09 | — | runtime, без релизов почти 2 года |
| `stylelint` | 17.16.0 | 2026-10-01 | — | |
| `stylelint-value-no-unknown-custom-properties` | 6.1.1 | — | — | проверяет `var(--x)` по файлу токенов |
| `@pandacss/eslint-plugin` | 2.2.0 | — | — | `no-hardcoded-color`, `no-escape-hatch`, `no-dynamic-styling` |
| `storybook` / `@storybook/react-vite` / `@storybook/nextjs-vite` | 10.6.2 | — | — | vite `^8` в peer, next `^16` |
| `@base-ui/react` | 1.9.0 | — | — | есть `./button`, `./toggle` и т. д. |
| Фреймворки | next 16.4.0, astro 7.3.8, vite 8.3.4 | | | |

### 3. Статус интеграций (самое важное: что реально работает в Next 16 + Turbopack)
- **Tailwind v4.** Next + Turbopack подключается через `@tailwindcss/postcss`: Turbopack поддерживает PostCSS, путь
  официальный и стабильный. Vite 8 и Astro 7 подключаются через `@tailwindcss/vite`. В монорепо классы kit не
  попадают в сборку без явного `@source "../../packages/ui/src"`, потому что автоскан идёт от cwd приложения
  (https://tailwindcss.com/docs/detecting-classes-in-source-files, Nx-гайд
  https://nx.dev/docs/kb/using-tailwind-css-in-react). Начиная с 4.1.8 по умолчанию игнорируются `.next` и `.turbo`.
- **vanilla-extract.** Turbopack добавлен в next-plugin 2.5.0 как *«experimental Turbopack support for Next.js >=
  16.0.0»*. Версия 2.5.1 сразу вышла как исправление «bad release»
  (https://github.com/vanilla-extract-css/vanilla-extract/blob/master/packages/next-plugin/CHANGELOG.md). Документация
  пишет: *«Turbopack support is experimental. Its API is unstable and may undergo breaking changes in non-major
  versions»*. По умолчанию `unstable_turbopack.mode: 'off'`
  (https://vanilla-extract.style/documentation/integrations/next/). Открыт issue #1786 (2026-09-04): turbopack-plugin
  жёстко включает `unstable_splitCssPerRule`, получается отдельный модуль на каждое CSS-правило. На реальном
  приложении (43 `.css.ts`, ~10,8k правил) `next dev` занимал 22 ГБ и компилировался 189 с, с патчем 3,4 ГБ и 51 с.
  Ответа мейнтейнеров нет (https://github.com/vanilla-extract-css/vanilla-extract/issues/1786). В Vite/Astro
  vanilla-extract работает стабильно.
- **Panda CSS 2.x.** Подключается через PostCSS, значит работает и в Turbopack, и в Vite. Есть codegen-папка
  `styled-system/`. В монорепо `include` каждого приложения должен покрывать исходники kit, иначе стили kit не
  извлекаются. ESLint-правило `file-not-included` ловит как раз это.
- **StyleX 0.19.** Рекомендованный путь: Babel-плагин + `@stylexjs/postcss-plugin` (https://stylexjs.com/docs/learn/installation/).
  Открыт issue #1924 «[Next.js/Turbopack][Windows] `data-style-src` path escaping causes hydration mismatch»
  (2026-10-01), а пользователь работает на Windows.
- **Linaria/wyw-in-js.** Для Next 16 нужен сторонний `next-with-linaria` ≥1.3.0 (https://unpkg.com/next-with-linaria@1.4.0/README.md).
  Официального плагина для Turbopack нет.
- **Pigment CSS.** «Alpha phase, currently, on hold», про Turbopack ничего (https://github.com/mui/pigment-css).
- **styled-components / emotion.** Нужен runtime и React context. В RSC работают только в клиентских компонентах,
  styled-components дополнительно требует style registry для SSR. Для shop на RSC это прямой проигрыш. Исключены.
- **CSS Modules.** Встроены в Next/Turbopack (Lightning CSS), Vite и Astro. Плагины не нужны, риска интеграции нет.

### 4. Сравнение по критериям
Шкала 0–3, больше лучше. Факты выше, оценка моя.

| Критерий | TW4 + tv в `*.styles.ts` | CSS Modules + vars | vanilla-extract | Panda 2 | StyleX | Linaria |
| --- | --- | --- | --- | --- | --- | --- |
| Отдельный файл стилей + варианты | 3 (`tv` variants/compound/slots) | 2 (варианты через `data-*`, compound через селекторы) | 3 (файл `.css.ts` обязателен, recipes) | 3 (`cva`/`sva`/`styled`) | 1 (вариантов нет, только условные `props`) | 2 |
| Типизированные токены | 2 (имена классов проверяет lint, не TS) | 1 (stylelint проверяет `var()` по списку) | 3 (`createThemeContract`) | 3 (`strictTokens`) | 3 (`defineVars`) | 1 |
| Zero-runtime / RSC | 3 (`tv` = склейка строк ~ несколько КБ) | 3 | 3 | 3 | 3 | 3 |
| Next 16 Turbopack | 3 официально | 3 встроено | 1 experimental + #1786 | 2 через PostCSS | 1 Windows-баг | 1 сторонний |
| Astro 7 + Vite 8 | 3 | 3 | 3 | 3 | 2 | 2 |
| Kit как исходник в 3 фреймворках | 2 (`@source` + `transpilePackages`) | 3 | 2 (transpile + плагин в каждом) | 1 (include каждого app, codegen) | 2 | 2 |
| Темы light/dark/TMA через vars | 3 | 3 | 3 | 3 | 2 | 3 |
| Запреты линтом (сырые значения, `transition: all`) | 3 (сброс темы + better-tailwindcss + stylelint для CSS) | 3 (stylelint, самый прямой) | 1 (stylelint не видит TS-объекты, нужны свои ESLint-селекторы) | 3 (strictTokens + eslint-plugin) | 1 | 2 |
| Надёжность AI-агентов | 3 (самый частый стиль в обучении; риск: тянет писать классы в JSX, лечится lint) | 3 | 2 | 1 (динамика молча не извлекается) | 1 | 1 |
| Экосистема (shadcn-подобные исходники) | 3 (shadcn на Base UI) | 1 | 1 | 2 (Park UI, Chakra) | 0 | 0 |
| Storybook 10 | 3 | 3 | 2 | 2 | 2 | 2 |
| Здоровье / bus factor | 3 компания Tailwind Labs; `tv`/`twMerge` по 1 автору | 3 (стандарт) | 2 | 1 | 2 (Meta, 0.x) | 2 |
| Знакомо пользователю Tamagui | 2 (variants-объект тот же, значения классами) | 1 | 3 | 3 | 1 | 2 |
| **Сумма** | **36** | **32** | **29** | **30** | **21** | **23** |

Panda по сумме выше vanilla-extract, но в итоге стоит ниже. Причины: codegen в каждом приложении, требования
статической экстракции, с которыми агенты систематически ошибаются, и один npm-мейнтейнер. vanilla-extract падает
только из-за Turbopack, а это временно.

### 5. Почему Tailwind не противоречит правилу «стили в отдельном файле»
- Обычный стиль Tailwind (классы прямо в JSX) правилу пользователя противоречит. Но `tailwind-variants` даёт тот же
  объект, что Tamagui `styled()`: `base`, `variants`, `compoundVariants`, `defaultVariants`, плюс `slots` для
  составных Base UI компонентов (Popover.Trigger/Popup/Arrow одним рецептом). Этот объект лежит в `*.styles.ts`.
- В `.tsx` остаётся вызов рецепта. Layout-классы (`flex gap-4`) тоже переносятся в рецепт (`layout: tv({...})` или
  slot). Так JSX остаётся композицией.
- Почему `tailwind-variants`, а не `cva`: у `cva` 0.7.1 последний релиз 2024-11. У `tv` есть slots и встроенное
  разрешение конфликтов через `tailwind-merge`. `better-tailwindcss` по умолчанию проверяет строки и внутри `tv()`, и
  внутри `cva()`, `cn()`, `clsx()` (README плагина).
- Состояния Base UI (`data-disabled`, `data-open`, `data-checked`) пишутся вариантами Tailwind v4 `data-disabled:`,
  `data-open:` в том же рецепте. В `.tsx` не нужны тернарники.

### 6. Токены, темы, TMA, canvas (от выбора стилевого слоя не зависит)
- Источник правды: `packages/tokens/src/*.ts` (примитивы → семантика). Генератор выдаёт:
  1. `tokens.css`: `:root { --bg: …; --fg: …; --accent: … }` и `[data-theme="dark"] { … }`;
  2. `theme.css` для Tailwind: сброс дефолтов + `@theme inline { --color-bg: var(--bg); … }`. `inline` нужен, чтобы
     utility-классы ссылались на `var(--bg)` и подхватывали смену темы и TMA-переопределения в runtime;
  3. `canvas.ts`: `{ light: { accent: 0x2f6bff, … }, dark: { … } }` для Phaser.
- Тёмная тема: `data-theme` на `<html>`, ставится инлайн-скриптом в `<head>` до отрисовки (Next/Astro), иначе будет
  FOUC. Вариант `dark:` в компонентах **запрещён**: тема меняется только через переменные. Так компонент не
  описывает тему дважды (в xRocket тона были записаны дважды, отчёт 03).
- TMA: `apps/tma/src/styles/tma-theme.css` содержит
  `:root[data-platform="tma"] { --bg: var(--tg-theme-bg-color, <fallback>); --accent: var(--tg-theme-button-color, …) }`,
  а SDK кладёт `--tg-theme-*` на `:root` (bindCssVars). Компоненты kit про Telegram ничего не знают.
- Игра в TMA: тема Telegram динамическая, поэтому `canvas.ts` годится только как fallback. В runtime цвет читается
  через `getComputedStyle(document.documentElement).getPropertyValue('--accent')` и переводится в число для Phaser.
  Перечитывать на событии смены темы.

### 7. Анти-AI правила (из 07) в выбранной схеме
- Палитры `indigo-500`, `shadow-lg`, `animate-bounce` исчезают после сброса `--color-*: initial; --shadow-*: initial;
  --animate-*: initial; --font-*: initial; --radius-*: initial; --text-*: initial; --ease-*: initial`
  (https://tailwindcss.com/docs/theme). Сам Tailwind неизвестный класс **молча игнорирует**, поэтому ошибку даёт
  `better-tailwindcss/no-unknown-classes`.
- Сырые значения `bg-[#fff]`, `p-[13px]` ловит `no-restricted-classes` по `\[` (кроме allowlist-файлов).
- `transition`/`transition-all` тоже ловит `no-restricted-classes`. Разрешены `transition-colors`,
  `transition-opacity`, `transition-transform`. В CSS-файлах это делает stylelint
  `declaration-property-value-disallowed-list` (`transition: /\ball\b/`, `transition-property: all`).
- Шаг отступов. В v4 `p-13` валиден, потому что шкала динамическая от `--spacing`. Регулярка в
  `no-restricted-classes` разрешает только шаги из токенов (0, 0.5, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24).

## Recommendations for the boilerplate

### R1. Решение (приоритет 1)
**Tailwind v4.3 + `tailwind-variants` 3.x в соседних `*.styles.ts`, сброшенная тема, токены через CSS-переменные.**
Один стилевой слой на все шаблоны. CSS Modules, vanilla-extract, Panda, StyleX, Linaria, styled-components, emotion
в kit и шаблонах не использовать. Плоские `.css` разрешены только в `packages/tokens`, `packages/ui/src/styles/`
(`@utility`, `@keyframes`, сложные селекторы) и `apps/*/src/styles/`. Все они под stylelint.

### R2. Конвенция файлов
```
packages/ui/src/Button/
├── Button.tsx          разметка и поведение; className только из рецепта
├── Button.styles.ts    все tv()-рецепты компонента (и layout-классы)
├── Button.stories.tsx
├── types.ts            ButtonProps = BaseProps & ButtonVariants
├── consts.ts           не-стилевые константы (aria-тексты, лимиты); НЕ таблицы тонов
├── utils.ts            при необходимости
└── index.ts            export { Button } и type ButtonProps
```
В `docs/code-style.md`, `docs/naming.md`, `docs/library-notes.md` заменить `Name.styled.ts` на `Name.styles.ts`, а
раздел Tamagui перенести в архив. Правило «больше двух inline-style пропов → в `.styled.ts`» становится строже: в
`.tsx` **ноль** строковых классов.

### R3. Пример компонента
```ts
// Button/Button.styles.ts
import { tv, type VariantProps } from 'tailwind-variants';

export const button = tv({
  base: [
    'inline-flex items-center justify-center gap-2 rounded-control font-medium',
    'transition-colors duration-fast ease-standard',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'data-disabled:pointer-events-none data-disabled:opacity-disabled',
  ],
  variants: {
    tone: {
      primary: 'bg-accent text-on-accent hover:bg-accent-hover',
      neutral: 'bg-surface-2 text-fg hover:bg-surface-3',
      danger: 'bg-danger text-on-danger hover:bg-danger-hover',
    },
    size: {
      sm: 'h-control-sm px-3 text-label-sm',
      md: 'h-control-md px-4 text-label-md',
    },
    fullWidth: { true: 'w-full' },
  },
  defaultVariants: { tone: 'primary', size: 'md' },
});

export type ButtonVariants = VariantProps<typeof button>;
```
```ts
// Button/types.ts
import type { Button as BaseButton } from '@base-ui/react/button';
import type { ButtonVariants } from './Button.styles';

export type ButtonProps = Omit<BaseButton.Props, 'className'> & ButtonVariants & { className?: string };
```
```tsx
// Button/Button.tsx
import { Button as BaseButton } from '@base-ui/react/button';
import { button } from './Button.styles';
import type { ButtonProps } from './types';

export function Button({ tone, size, fullWidth, className, ...props }: ButtonProps) {
  return <BaseButton className={button({ tone, size, fullWidth, className })} {...props} />;
}
```
```css
/* packages/ui/src/styles/theme.css (генерируется из packages/tokens) */
@import "tailwindcss";
@import "@repo/tokens/tokens.css";
@source "../";                       /* исходники kit; приложения добавляют свой @source */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme {
  --color-*: initial; --shadow-*: initial; --animate-*: initial; --font-*: initial;
  --radius-*: initial; --text-*: initial; --ease-*: initial;
  --spacing: 4px;
}
@theme inline {
  --color-bg: var(--bg);           --color-fg: var(--fg);
  --color-accent: var(--accent);   --color-on-accent: var(--on-accent);
  --radius-control: var(--radius-control);
  --text-label-md: var(--font-size-label-md);
  --ease-standard: var(--ease-standard);
}
```
`className` пропускается сквозь рецепт: вызывающий может добавить `w-full` в своём `*.styles.ts`, а
`tailwind-merge` уберёт конфликт.

### R4. Lint-сетап (всё на уровне error)
1. **ESLint, `**/*.{ts,tsx}`**: `eslint-plugin-better-tailwindcss`
   - `settings['better-tailwindcss'] = { entryPoint: 'packages/ui/src/styles/theme.css', cwd: <корень пакета> }`
     (в каждом пакете свой entryPoint);
   - `no-unknown-classes`, `no-conflicting-classes`, `no-duplicate-classes`, `no-deprecated-classes`,
     `enforce-canonical-classes`;
   - `no-restricted-classes`: `\[` (произвольные значения), `^(.*:)?transition(-all)?$`, `^dark:`,
     `^(.*:)?(bg-(linear|radial|conic)|from-|via-|to-)`, `backdrop-blur`, `uppercase`, `tracking-widest`,
     `hover:-?translate-`, `hover:scale-`, `animate-(pulse|bounce|ping)`, регулярка шага отступов. Allowlist-файлы
     (Spinner, Skeleton, Scrim и др. из 07) получают `overrides`.
2. **ESLint, `**/*.tsx`** (`no-restricted-syntax`):
   - `JSXAttribute[name.name='className'] > Literal` и
     `JSXAttribute[name.name='className'] > JSXExpressionContainer > TemplateLiteral`: «классы только из `*.styles.ts`»;
   - `JSXAttribute[name.name='style'] Property[key.value!=/^--/]`: в `style` можно передать только CSS-переменную для
     действительно динамического значения (`--progress`);
   - `no-restricted-imports` для `tailwind-variants`, `clsx`, `tailwind-merge` в `.tsx`: склейка классов только в
     `*.styles.ts`.
3. **ESLint, `**/*.styles.ts`**: `no-restricted-syntax` на `Literal[value=/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i]`
   как вторая линия обороны. В `*.styles.ts` разрешены только `export const x = tv(...)` и `export type`.
4. **stylelint 17** для `**/*.css`: пресет anti-slop из 07 плюс
   `stylelint-value-no-unknown-custom-properties` (`importFrom: packages/tokens/dist/tokens.css`),
   `color-no-hex` и `declaration-strict-value` (`stylelint-declaration-strict-value` 1.12.1) на цвета, отступы, радиусы,
   тени вне `packages/tokens`, `declaration-property-value-disallowed-list` для `transition: all`. В `at-rule-no-unknown`
   разрешить `theme`, `source`, `utility`, `custom-variant`, `variant`, `apply`, `reference`.
5. **Хук Claude Code** (PostToolUse на Edit/Write) запускает eslint/stylelint на изменённом файле. Агент видит ошибку
   сразу, а не только в CI.

### R5. Подключение по шаблонам
- `apps/shop` (Next 16): `postcss.config.mjs` → `@tailwindcss/postcss`; `transpilePackages: ['@repo/ui', '@repo/tokens']`;
  в `app/globals.css` `@import "@repo/ui/styles/theme.css"; @source "../../../packages/ui/src";`.
- `apps/landing`, `apps/blog` (Astro 7): `vite.plugins: [tailwindcss()]`. Для `.astro` компонентов то же правило:
  рецепт в `Hero.styles.ts`, импорт во frontmatter, `class={hero()}`.
- `apps/tma|admin|game` (Vite 8): `@tailwindcss/vite`, тот же глобальный CSS. В `tma` дополнительно `tma-theme.css`.
- `packages/ui` Storybook 10 (`@storybook/react-vite`) с тем же Vite-плагином. Переключение тем делается тулбаром,
  он ставит `data-theme`.

### R6. Риски, которые обязательно проверяет smoke-сборка
1. **Next 16.4 + Turbopack + `@tailwindcss/postcss` + kit как исходник.** Классы из `packages/ui` есть в prod CSS
   (`next build`), HMR при правке `Button.styles.ts` в kit работает, нет двойного CSS.
2. **Astro 7 + острова.** Kit-компонент в нескольких островах не дублирует CSS, порядок слоёв корректный.
3. **Vite 8 (Rolldown) + `@tailwindcss/vite` 4.3.3.** Сборка и HMR, размер CSS.
4. **`tailwind-merge` и кастомные токены.** После сброса темы `text-fg` (цвет) и `text-label-md` (кегль) должны оба
   остаться после merge. Если `twMerge` удаляет один из них, нужен `twMergeConfig` с `classGroups`, генерируемыми
   из `packages/tokens`. Проверить юнит-тестом рецепта.
5. **`better-tailwindcss` в монорепо.** `no-unknown-classes` находит `bg-indigo-500` после сброса и не даёт ложных
   срабатываний на наших токенах. Строки внутри `tv({ variants })` действительно проверяются.
6. **Base UI `className` как функция от state.** В kit сужаем тип до `string`, состояния пишем через `data-*`-варианты.
   Проверить типы на 3–4 компонентах (Button, Popover, Select, Dialog).
7. **FOUC темы** в Next SSR и Astro: инлайн-скрипт `data-theme` до первой отрисовки, CSP-хэш для него (связь с 10).
8. **TMA.** `--tg-theme-*` переопределяют семантику, смена темы в Telegram перекрашивает UI без перезагрузки. Canvas
   перечитывает цвета.
9. **Бандл `tailwind-variants` + `tailwind-merge`** в TMA. Записать базовую цифру. Если это заметная доля бюджета,
   проверить `tailwind-variants/lite` без merge и запрет внешнего `className`.

### R7. Когда пересмотреть
- Если vanilla-extract выпустит Turbopack-плагин без `unstable_`, а #1786 закроют, vanilla-extract становится
  серьёзной альтернативой: он ближе к Tamagui, а токены типизированы на уровне TS. Перед миграцией нужна smoke-сборка
  shop.
- Если пользователь отвергнет utility-классы вообще, перейти на CSS Modules: `Button.module.css` + варианты через
  `data-tone`/`data-size`, типы вариантов в `types.ts`, полный stylelint. Инфраструктурного риска нет, теряется
  только shadcn-экосистема и привычная агентам форма.

## Open questions for the user
1. Устраивает ли вас форма «Tailwind-классы, но только в `Name.styles.ts` через `tv()`»? Или принципиально нужны
   CSS-свойства объектом, как в Tamagui? Во втором случае ждём стабильного vanilla-extract + Turbopack, а сейчас
   берём CSS Modules.
2. Переименовываем ли `Name.styled.ts` → `Name.styles.ts` во всех docs? Старое имя напоминает `styled()`, которого
   больше нет.
3. Можно ли вызывающему передавать `className` в компоненты kit (гибко, но размывает дизайн-систему)? Или kit
   закрыт, и всё меняется только вариантами? Рекомендую закрытый kit для `packages/ui` и открытый `className` только
   для layout-обёрток.

Sources: https://tailwindcss.com/docs/theme ; https://tailwindcss.com/docs/detecting-classes-in-source-files ;
https://nx.dev/docs/kb/using-tailwind-css-in-react ; https://www.tailwind-variants.org/docs/getting-started ;
https://github.com/schoero/eslint-plugin-better-tailwindcss ; https://vanilla-extract.style/documentation/integrations/next/ ;
https://github.com/vanilla-extract-css/vanilla-extract/blob/master/packages/next-plugin/CHANGELOG.md ;
https://github.com/vanilla-extract-css/vanilla-extract/issues/1786 ; https://panda-css.com/docs/concepts/writing-styles ;
https://v2.panda-css.com/docs/get-started/upgrading-to-v2 ; https://github.com/chakra-ui/eslint-plugin-panda ;
https://stylexjs.com/docs/learn/installation/ ; https://github.com/facebook/stylex/issues/1924 ;
https://github.com/mui/pigment-css ; https://unpkg.com/next-with-linaria@1.4.0/README.md ; registry.npmjs.org и
api.npmjs.org/downloads (2026-10-14).
