# 17b. Blog — глубокая проверка стека
Status: done
Updated: 2026-10-15 (финал)

## Resume notes
- Done: все разделы. Версии сняты `npm view` 2026-10-15; поддержка браузеров из `@mdn/browser-compat-data` 8.1.5
  (2026-10-08); исходник `astro-expressive-code@0.44.2` просмотрен (поддержка Sätteri); доки Astro/Starlight/Pagefind/ESLint/i18next.
- Next: ничего. Возможные доп. проверки при реализации — помечены «проверить» в тексте.
- Sub-agent: нет.

## Summary (≤ 15 lines)
1. База держится: **Astro 7.3.8** (2026-10-08) + Content Layer (`glob()`), `@astrojs/mdx` 8.0.3, `@astrojs/rss` 4.0.19,
   `@astrojs/sitemap` 3.7.4, `astro:assets` + sharp 0.35.5, Pagefind 1.5.2, Starlight 0.42.6 + `@astrojs/starlight-tailwind` 5 (Tailwind v4).
2. Markdown в Astro 7 по умолчанию на **Sätteri** (Rust). Remark/rehype-плагины требуют `unified()` — в шаблоне их не
   используем. Expressive Code 0.44.2 поддерживает Sätteri нативно (проверено по исходнику) → **EC берём** (его же тянет Starlight).
3. **Переходы:** не `ClientRouter`, а нативные cross-document View Transitions (`@view-transition { navigation: auto }`):
   Chrome/Edge/WebView 126+, Safari/iOS 18.2+, Samsung 28; **Firefox — нет** (BCD 2026-10-08). Фолбэк: fade-in `main`
   при загрузке, если нет `onpagereveal`. Механизм kit `ScreenTransition` (SPA) к MPA-блогу неприменим.
4. **Заменить:** `reading-time` (последний релиз 2021) → своя утилита на `Intl.Segmenter`; satori + `@resvg/resvg-js`
   (resvg без стабильного релиза с 2024-03) → **`astro-og-canvas` 0.13.2** по умолчанию (WASM, без нативных бинарей);
   `eslint-plugin-jsx-a11y` → `eslint-plugin-jsx-a11y-x` 0.2.0; `eslint-plugin-react` → `@eslint-react/eslint-plugin` 5.x (у старых нет peer ESLint 10);
   `i18next-parser` (deprecated) → `i18next-cli` 1.75; `strapi-community-astro-loader` (peer только astro ^6) → `@sensinum/astro-strapi-loader` или свой loader.
5. **ESLint 10.12** (не 9): `eslint-plugin-astro` 3.x требует `eslint >=10`. В ESLint 10 конфиг ищется от файла →
   per-package `eslint.config` работает из корня (снимает риск 05 §7.7).
6. **TypeScript для Astro-шаблонов ≤ 6.0.x**: `typescript-eslint` 8.71 peer `typescript <6.1.0`, `@astrojs/check` peer `^5||^6`.
   `typescript@latest` = 7.0.2 — ставить нельзя, пин через catalog.
7. i18next 26.4.5 + react-i18next 17.0.16 здоровы; Starlight сам зависит от `i18next ^26` (одна мажорная версия). Плюрали ru
   — штатные `_one/_few/_many/_other` через `Intl.PluralRules`; `i18next-icu` не нужен.
8. Локализованные слаги — через `getStaticPaths` + `translationKey` в схеме; `getAbsoluteLocaleUrlList()` для hreflang
   тут неверен (меняет только префикс). Custom locale paths Astro требуют `output: 'server'` — не используем.
9. Комментарии: по умолчанию нет; заметка в docs: Remark42 (self-host, 1.18.0 2026-10-11) или Giscus (стагнирует).
10. Риски 12 мес.: Astro 8 вероятен (мажоры 2024-12, 2026-03, 2026-06); Starlight 0.x ломается на минорах; `@lhci/cli`
    стоит на Lighthouse 12.6.1 (релиз 2025-06); Payload 4 в beta.

## Findings

### 1. Таблица технологий (проверено 2026-10-15)

Дата = дата публикации указанной версии в npm (или GitHub release). Health: A — активный (релиз ≤ 2 мес.), B —
живой, но медленный, C — стагнация/deprecated.

| Технология | Выбор + точная версия | Релиз | Health | Breaking-риск 12 мес. | Вердикт | Источник |
| --- | --- | --- | --- | --- | --- | --- |
| Фреймворк | `astro` 7.3.8 (beta 7.4.0-beta.1) | 2026-10-08 | A | Высокий: Astro 8 вероятен (5.0 2024-12-03 → 6.0 2026-03-10 → 7.0 2026-06-22) | keep, пин `~7.3` в catalog | https://www.npmjs.com/package/astro , https://docs.astro.build/en/guides/upgrade-to/v7/ |
| Контент | Content Layer: `src/content.config.ts`, `glob()`, `z` из `astro/zod` (Zod 4) | в составе astro | A | Низкий (стабилен с 5/6) | keep | https://docs.astro.build/en/guides/content-collections/ |
| MDX | `@astrojs/mdx` 8.0.3 (peer astro ^7.2.10, Node ≥22.12) | 2026-10-06 | A | Средний (вместе с мажором Astro) | keep | https://www.npmjs.com/package/@astrojs/mdx |
| Markdown-процессор | Sätteri по умолчанию (`@astrojs/markdown-satteri` 0.4.3); `unified()` не включаем | 2026-10-06 | A | Средний: Sätteri 0.x, API плагинов `mdastPlugins/hastPlugins` молодой | keep default, без remark/rehype | https://docs.astro.build/en/guides/markdown-content/ |
| Код-блоки | `astro-expressive-code` 0.44.2 (Shiki 4 внутри; встроенный Shiki `shiki` 4.5.0 — фолбэк) | 2026-08-31 | A | Средний (0.x) | keep EC | https://expressive-code.com/ ; исходник `dist/index.js` (isSatteriProcessor) |
| RSS | `@astrojs/rss` 4.0.19 | 2026-06-30 | A/B (редкие патчи — стабилен) | Низкий | keep | https://docs.astro.build/en/recipes/rss/ |
| Sitemap | `@astrojs/sitemap` 3.7.4 (опция `i18n`) | 2026-08-31 | A | Низкий | keep | https://docs.astro.build/en/guides/integrations-guide/sitemap/ |
| Поиск | `pagefind` 1.5.2 (Component UI `@pagefind/component-ui` 1.5.2); `astro-pagefind` 2.0.1 не нужен | 2026-04-12 | B (6 мес. без релиза, коммиты 2026-10-08) | Низкий (2.0 не анонсирован) | keep `pagefind` CLI напрямую | https://github.com/Pagefind/pagefind/releases , https://pagefind.app/docs/multilingual/ |
| OG-картинки | **`astro-og-canvas` 0.13.2** (CanvasKit WASM) | 2026-09-15 | A | Средний (0.x) | replace satori+resvg → astro-og-canvas; satori 0.57.2 + sharp — опция для JSX-шаблонов | https://www.npmjs.com/package/astro-og-canvas , https://www.npmjs.com/package/@resvg/resvg-js |
| Время чтения | своя утилита (`Intl.Segmenter`, 200 слов/мин) | — | — | нет | replace `reading-time` 1.5.0 (2021-09-10) | https://www.npmjs.com/package/reading-time |
| Изображения | `astro:assets` + `sharp` 0.35.5 (astro dep `^0.35.4`) | 2026-09-27 | A | Низкий | keep; билд-стадия на glibc (Debian slim) | https://docs.astro.build/en/guides/images/ |
| Комментарии | нет в базе; заметка: Remark42 1.18.0 (self-host) / Giscus (`@giscus/react` 3.1.0 2024-12-31) | 2026-10-11 / 2024-12-31 | A / C | — | none by default | https://github.com/umputun/remark42/releases , https://github.com/giscus/giscus |
| CMS loader | свой loader-интерфейс в `packages/astro-shared`; Strapi: `@sensinum/astro-strapi-loader` 1.4.0; Directus: `@directus/sdk` 27.0.0 в своём loader; Sanity: `@sanity/client` в своём loader | 2026-07-26 / 2026-10-07 | A/B | Средний: Payload 4 beta, Directus SDK мажоры часто (27) | keep «пример + интерфейс», без вшитой CMS | npm (см. §6) |
| Docs (опция) | `@astrojs/starlight` 0.42.6 + `@astrojs/starlight-tailwind` 5.0.0 (peer tailwindcss ^4) | 2026-10-08 / 2026-03-11 | A | Высокий: 0.x, 7 миноров за 13 мес. (0.36→0.42) | keep как опцию, пин `~0.42` | https://starlight.astro.build/guides/css-and-tailwind/ |
| i18n строки | `i18next` 26.4.5 + `react-i18next` 17.0.16 (peer i18next ≥26.2) | 2026-10-14 / 2026-10-06 | A | Низкий/средний (мажор i18next ≈ раз в год: 25 → 2025-04, 26 → 2026-03) | keep | https://www.i18next.com/misc/migration-guide |
| i18n роутинг | `astro:i18n` (`prefixDefaultLocale: true`), локализованные слаги через `getStaticPaths` | в составе astro | A | Низкий | keep; custom locale paths не использовать (нужен `output: 'server'`) | https://docs.astro.build/en/guides/internationalization/ |
| i18n извлечение | `i18next-cli` 1.75.3 | 2026-10-12 | A | Низкий | replace `i18next-parser` 9.4.0 (deprecated: «use i18next-cli instead») | https://www.npmjs.com/package/i18next-cli |
| Переходы | нативные cross-document VT (CSS) + fade-фолбэк; без `<ClientRouter />` | — | — | Низкий; Firefox может включить — станет только лучше | replace ClientRouter/«View Transitions» из 05a → native | MDN BCD 8.1.5; https://docs.astro.build/en/guides/view-transitions/ |
| E2E | `@playwright/test` 1.64.1 + `@axe-core/playwright` 4.13.0 | 2026-10-14 / 2026-08-11 | A | Низкий | keep | npm |
| Перф-гейт | `@lhci/cli` 0.15.1 (внутри lighthouse 12.6.1; актуальный lighthouse 13.5.0) | 2025-06-25 | B/C | Средний: отставание от Lighthouse 13 | keep с пометкой; план Б: `lighthouse` 13 CLI + свой скрипт бюджетов или `unlighthouse` 0.19.1 | https://github.com/GoogleChrome/lighthouse-ci/releases |
| Ссылки | `linkinator` 8.1.0 в `pnpm verify` (внутренние, по `dist`); `lycheeverse/lychee` v0.24.2 (GitHub Action, внешние, по расписанию); docs: `starlight-links-validator` 0.27.0 | 2026-08-29 / 2026-05-01 / 2026-10-09 | A | Низкий | add (в мастер-плане не было) | https://github.com/lycheeverse/lychee |
| Аналитика | Umami v3.4.0 self-host, скрипт с нашего домена | 2026-09-17 [05a] | A | Низкий | keep | https://github.com/umami-software/umami/releases |
| Ошибки | `@sentry/astro` 11.7.0, только клиент, lazy, при заданном DSN | 2026-10-12 | A | Средний (мажоры Sentry ежегодно) | keep, выключен без DSN | https://www.npmjs.com/package/@sentry/astro |
| Образ | build: `node:24-*-slim` (glibc); runtime: nginx static (версию задаёт 17c) | — | A | Низкий | keep; не Alpine на билд-стадии | — |
| Lint | `eslint` 10.12.0, `@eslint/js` 10.0.1 | 2026-10-02 | A | Низкий (v11 не анонсирован) | keep v10 (не v9: 9.x = maintenance 9.39.5) | https://eslint.org/blog/2026/02/eslint-v10.0.0-released/ |
| TS-линт | `typescript-eslint` 8.71.2 (peer TS `<6.1.0`, ESLint ^8.57/^9/^10) | 2026-10-12 | A | Средний: v9 / поддержка TS 7 не объявлены | keep; TS ≤ 6.0.x | https://www.npmjs.com/package/typescript-eslint |
| Astro-линт | `eslint-plugin-astro` 3.2.1 (peer `eslint >=10`, Node ^22.22.3/^24.16) + `astro-eslint-parser` 3.2.0 | 2026-09-17 | A | Низкий | keep | https://www.npmjs.com/package/eslint-plugin-astro |
| a11y-линт | `eslint-plugin-jsx-a11y-x` 0.2.0 (peer eslint ^9/^10) | 2026-05-10 | B | Средний (0.x) | replace `eslint-plugin-jsx-a11y` 6.10.2 (2024-10, peer до ^9) | https://github.com/es-tooling/eslint-plugin-jsx-a11y-x |
| React-линт | `@eslint-react/eslint-plugin` 5.26.7 + `eslint-plugin-react-hooks` 7.1.1 (peer ^10) | — | A | Средний | replace `eslint-plugin-react` 7.37.5 (2025-04, peer до ^9.7) — сверить с 17d | npm |
| MDX-линт | `eslint-plugin-mdx` 3.8.1 (peer eslint ≥8) | 2026-05-31 | B | Низкий | keep (опционально) | npm |
| Формат | `prettier` 3.9.10; `prettier-plugin-astro` 1.1.1 (peer prettier ^3.5.3); `eslint-config-prettier` 10.1.8 | 2026-10-10 / 2026-10-09 / 2025-07-18 | A | Низкий: Prettier 4 в alpha.13 с 2025-11-18, без движения | keep v3 | https://github.com/prettier/prettier/releases |
| CSS-линт | `stylelint` 17.16.0 + `stylelint-config-standard` 40.0.0; at-rules Tailwind v4 — через `ignoreAtRules` вручную | 2026-10-01 | A | Низкий | keep | https://www.npmjs.com/package/stylelint |
| Мёртвый код | `knip` 6.41.0 (плагины `astro`, `starlight`, `mdx`, `astro-og-canvas`, `playwright`, `stylelint`, `tailwind`) | 2026-10-09 | A | Низкий | keep | https://unpkg.com/knip@6.41.0/dist/plugins/ |
| Проверка типов | `@astrojs/check` 0.9.10 (peer TS ^5/^6) | 2026-07-27 | A | Средний: TS 7 не поддержан | keep | npm |

### 2. Astro 7 и контент (факты)
- Astro 7.0 (2026-06-22): Rust-компилятор `.astro` (строже: незакрытые теги — ошибка, нет автокоррекции `<div>` в `<p>`),
  Vite 8, `compressHTML: 'jsx'` (схлопывает пробел между inline-элементами — нужен `{" "}`), удалены константы событий
  `astro:transitions` (строки вместо `TRANSITION_AFTER_SWAP` и т.п.), `src/fetch.ts` зарезервирован. 7.3.8 убрал esbuild
  (Oxc/Rolldown) и починил `astro add`, стиравший `allowBuilds` в pnpm. https://docs.astro.build/en/guides/upgrade-to/v7/ ,
  https://github.com/withastro/astro/releases
- `astro@7.3.8` deps: `vite ^8.3.1`, `shiki ^4.4.3`, `sharp ^0.35.4`, `zod ^4.6.5`, engines Node ≥22.12 → Node 24 LTS ок.
- Markdown: Sätteri — дефолт для `.md`/`.mdx`; плагины `satteri({ mdastPlugins, hastPlugins })`; для remark/rehype нужен
  `@astrojs/markdown-remark` + `processor: unified()`; recma только через unified. Heading IDs встроены (`github-slugger`).
  Вычисляемый frontmatter — через `ctx.data.astro.frontmatter` (Sätteri) / `file.data.astro` (unified).
- Collections: build-time в `src/content.config.ts` (`glob()`, `file()`), live — `src/live.config.ts`, требуют адаптер и
  `prerender = false`, **не поддерживают MDX и оптимизацию картинок** → для статического блога live не используем.
  `z` импортировать из `astro/zod`. https://docs.astro.build/en/guides/content-collections/
- Мнение: схема поста — `title, description, pubDate, updatedDate?, draft, tags[], author: reference('authors'), cover: image(),
  lang, translationKey, slug?`; `readingMinutes` считать из `entry.body` в утилите, а не плагином (не привязываемся к процессору).

### 3. Код, OG, время чтения
- Expressive Code 0.44.2: в `dist/index.js` есть `isSatteriProcessor` → пушит `satteriExpressiveCodePlugin` в `hastPlugins`
  и выключает встроенный `syntaxHighlight`; при `unified()` — `rehypeExpressiveCode`; иначе предупреждение. Starlight
  0.42.6 зависит от `astro-expressive-code ^0.44.0` → блог и docs выглядят одинаково при одном пине в catalog. Тему
  привязать к нашему `[data-theme]` через `themeCssSelector` (мнение, проверить API при реализации).
- OG: `@resvg/resvg-js` последний stable 2.6.2 от 2024-03-26 (2.7.0-alpha.2 2026-01); `satori` активен (0.57.2 2026-10-14).
  `astro-og-canvas` 0.13.2 — CanvasKit WASM, нет нативных бинарей (Windows/macOS/Alpine одинаково), автор — мейнтейнер
  Starlight; есть плагин knip. Мнение: дефолт `astro-og-canvas` (шаблон из токенов: фон, логотип, заголовок); если нужен
  JSX-шаблон — satori → SVG → PNG через уже установленный `sharp` (без resvg). Для кириллицы шрифт OG должен содержать
  Cyrillic-subset (Inter/Fontsource ок). Takumi (`@takumi-rs/image-response` 2.16.2, Rust) — молодой, нативные бинари; не брать.
- `reading-time` 1.5.0 (2021-09-10), 2.0.0-1 так и не вышел. Своя утилита ~10 строк: `Intl.Segmenter(lang, {granularity:'word'})`,
  `isWordLike`, 200 слов/мин, округление вверх; тест на ru/en.

### 4. Поиск (Pagefind)
- 1.5.0 (2026-04-06): Component UI (`<pagefind-*>` web components), поиск в Web Worker, индекс −45%, поиск по метаданным,
  диакритика. Русский — со стеммингом; индекс делится по `<html lang>` автоматически.
  https://github.com/Pagefind/pagefind/releases , https://pagefind.app/docs/multilingual/
- Бинарь через optionalDependencies (`@pagefind/linux-x64`, `windows-x64`, `darwin-arm64`, …) — без postinstall, `allowBuilds` не нужен.
- Мнение: `astro-pagefind` 2.0.1 не брать — достаточно `pagefind --site dist` в `postbuild`; UI — Component UI в острове
  без React (web component), стили через наши токены. Starlight несёт свой Pagefind (dep `pagefind ^1.5.2`).
- Health B: 6 месяцев без релиза, но репо активен (push 2026-10-08), 5.5k звёзд, один основной автор (CloudCannon).

### 5. Переходы экранов (правило пользователя)
- Факты (MDN BCD 8.1.5, 2026-10-08): `@view-transition` (cross-document): Chrome/Edge/Android WebView 126, Safari и
  iOS/WKWebView 18.2, Samsung 28, **Firefox и Firefox Android — нет**. Same-document `startViewTransition`: Firefox 144.
  `pagereveal`/`pageswap`: Chrome 123/124, Safari 18.2, Firefox нет. caniuse: глобально ~88.8%.
- Астро-доки: `<ClientRouter />` не deprecated, но «станет менее нужным по мере зрелости браузерных API»; даёт фолбэк
  `animate` для всех браузеров, но: бандл-скрипты выполняются один раз, нужно `astro:page-load`/`data-astro-rerun`,
  re-init Pagefind, Umami, Sentry, острова. https://docs.astro.build/en/guides/view-transitions/
- Мнение (решение для blog и docs): CSS `@view-transition { navigation: auto }` в `packages/astro-shared/styles/transitions.css`,
  fade 200–240 мс (в тон kit), `view-transition-name` для обложки/заголовка карточка → статья; reduced-motion →
  `navigation: none`. Фолбэк: инлайн-скрипт в `<head>` ставит класс, если `!('onpagereveal' in window)`, и CSS
  анимирует появление `main` (opacity, 200 мс) — Firefox и iOS < 18.2 получают плавный вход без выхода. ClientRouter не
  включать: Starlight и Pagefind лучше живут в MPA, нет класса багов «скрипт не перезапустился».
- Это расходится с мастер-планом §3.1 («ScreenTransition … без View Transitions API из-за iOS < 18»): для MPA kit не
  может анимировать переход между документами; исключение для Astro-шаблонов нужно записать.

### 6. CMS-лоадеры (опция `content-cms`)
| Пакет | Версия, дата | Peer astro | Оценка |
| --- | --- | --- | --- |
| `@sensinum/astro-strapi-loader` (VirtusLab) | 1.4.0, 2026-07-26 | ^6 \|\| ^7 | живой, 2 мейнтейнера — ок для Strapi |
| `strapi-community-astro-loader` | 4.0.0, 2026-04-04 | **^6 only** | не совместим с Astro 7 по peer — не брать |
| `@strapi/client` (официальный) | 1.6.2, 2026-06-04 | — | для своего loader |
| `@directus/sdk` | 27.0.0, 2026-10-07 | — | официального Astro-loader нет; свой loader ~50 строк |
| `@sanity/astro` | 3.5.1, 2026-08-21 | ^2…^7 | тянет peer `sanity`, `styled-components` (Studio) — тяжело; для чтения хватит `@sanity/client` в своём loader |
| `@avovix/astro-loader-payload` | 0.4.0, 2026-07-09 | ^7, payload ^3 | один мейнтейнер; Payload 4.0.0-beta.1 уже в dist-tags → сломается |
| `@keystatic/astro` / `@tinacms/astro` | 6.0.0 / 0.7.1 | — | git-based; админка требует SSR/облако — вне базы |
Мнение: в `packages/astro-shared/content/` — `defineRestLoader({ name, fetchAll, schema, digest, incremental? })` поверх
Content Loader API + один пример (Strapi через `@strapi/client` или sensinum). Ребилд по webhook → CI (как в 05a).

### 7. Starlight (опция `docs`)
- 0.42.6 (2026-10-08), peer `astro ^7.2.10`, `@astrojs/markdown-remark ^7.3.0`; deps: `i18next ^26`, `pagefind ^1.5.2`,
  `astro-expressive-code ^0.44`, `@astrojs/mdx ^8`, `@astrojs/sitemap ^3.7.3`, Sätteri. 7 миноров 0.36–0.42 за 13 мес.,
  1.0 не вышел → минор = потенциальный breaking.
- Tailwind v4: `@astrojs/starlight-tailwind` 5.0.0; CSS: `@layer base, starlight, theme, components, utilities;` +
  `@import '@astrojs/starlight-tailwind'` + `tailwindcss/theme.css` и `utilities.css` в слоях; токены через `@theme`
  (`--color-accent-*`, `--color-gray-*`, `--font-sans/mono`). Совместимость-слой действует только на страницах Starlight.
  https://starlight.astro.build/guides/css-and-tailwind/
- Совместимость с нашими правилами (мнение): маппинг наших токенов на `--color-accent/gray-*` — одно место; наш запрет `dark:`
  не мешает (Starlight-слой сам маппит тёмную тему). Starlight — свой UI-язык; kit используется только в MDX-островах и в
  переопределённых компонентах (Header/Footer). Правило «tv() в Name.styled.ts» распространить на override-компоненты.
- Ссылки в docs: `starlight-links-validator` 0.27.0.

### 8. i18n
- i18next 26 (2026-03-28) breaking: удалён legacy `interpolation.format` (только Formatter `services.formatter.add`),
  удалены `initImmediate` (→ `initAsync`) и `showSupportNotice`. react-i18next 17 требует i18next ≥26.2.
  https://www.i18next.com/misc/migration-guide
- ru-плюрали: суффиксы `_one/_few/_many/_other` по `Intl.PluralRules` — штатно; `i18next-icu` 2.5.0 жив, но меняет формат
  каталогов на ICU → ломает общий `packages/i18n` (риск 05 §7.5) → не брать.
- Извлечение/проверка ключей: `i18next-parser` помечен deprecated в npm («use i18next-cli instead») → `i18next-cli` 1.75.3.
- `astro-i18next` мёртв (1.0.0-beta.21 от 2023-03) — не брать.
- Astro: `Astro.currentLocale` есть на prerender; `preferredLocale`, `domains`, custom locale paths — только SSR. Файловая
  структура должна совпадать с URL для всех языков → локализованные слаги делать в `src/pages/[locale]/blog/[slug].astro`
  через `getStaticPaths` из коллекции (`lang`, `slug`), hreflang — по `translationKey`, а не `getAbsoluteLocaleUrlList()`
  (мнение, вывод из доки). Sitemap: `i18n` опция `@astrojs/sitemap` + свои alternates для статей с разными слагами.
- Строки в `.astro`: серверный инстанс `i18next.cloneInstance({ lng })`; острова получают строки пропсами (kit props-only).

### 9. Изображения, Docker, sharp
- sharp 0.35.5 — prebuilt через optionalDependencies, включая `linuxmusl-x64/arm64` и `win32-arm64`. Риск (мнение по опыту
  pnpm): lockfile, созданный на Windows/macOS, не тянет musl/linux-варианты, если не задать в `pnpm-workspace.yaml`
  `supportedArchitectures: { os: [current, linux], cpu: [x64, arm64], libc: [glibc, musl] }`. Проще и надёжнее —
  билд-стадия `node:24-*-slim` (glibc), runtime nginx. В 05a указан `node:22-alpine` — устарело (Node 24 по мастер-плану).
- Кэш оптимизированных картинок: `node_modules/.astro` (настраивается `cacheDir`) → BuildKit cache mount в Dockerfile, иначе
  каждый билд заново жмёт картинки. `image.responsiveStyles` может конфликтовать со слоями Tailwind 4 (дока) → `false`.
- nginx (мнение): `build.format: 'directory'` + `try_files $uri $uri/index.html =404`, `error_page 404 /404.html`,
  `immutable` на `/_astro/*`, `no-cache` на HTML, `/pagefind/pagefind*.js` и entry JSON; `application/rss+xml` для `*.xml` фидов;
  `gzip_static`/precompressed. Корень `/` → 301 на локаль в nginx (в static Astro даёт meta refresh).

### 10. Тесты и наблюдаемость
- Playwright 1.64.1 + axe 4.13.0 (скриншоты в Docker, мастер-план). Lighthouse CI 0.15.1 работает, но вшит Lighthouse
  12.6.1 при актуальном 13.5.0; последний релиз 2025-06-26 → держать, но в docs записать план Б.
- Ссылки: `linkinator` 8.1.0 по `dist` в `pnpm verify` (работает на Windows без Rust); `lychee-action` для внешних ссылок
  по cron (внешние ссылки нестабильны — не в PR-гейте). Мнение.
- RSS-проверка: unit-тест на валидный XML и абсолютные URL (`site` обязателен). Мнение.
- Umami: скрипт с self-host, MPA → page view на каждой навигации без доп. кода (ещё один плюс отказа от ClientRouter).
- Sentry: для блога почти нет клиентского кода; `@sentry/astro` 11.7.0 только client-side, lazy, отключён без DSN.

### 11. Общее ядро (срез 17b)
- ESLint: 10.0.0 (2026-02-06), 10.12.0 (2026-10-02); 9.x — dist-tag `maintenance`. ESLint 10: только flat config,
  `.eslintrc`/`.eslintignore` не читаются, `/* eslint-env */` — ошибка, Node `^20.19 || ^22.13 || >=24`, jiti ≥2.2 для
  TS-конфигов, **конфиг ищется от директории файла** (вложенные `apps/*/eslint.config.ts` применяются при запуске из корня),
  JSX-идентификаторы считаются ссылками (меняет `no-unused-vars`). https://eslint.org/blog/2026/02/eslint-v10.0.0-released/
- Совместимость плагинов с ESLint 10 (peer): typescript-eslint 8.71 — да; eslint-plugin-astro 3.x — только ≥10;
  eslint-plugin-react-hooks 7.1.1 — да; eslint-plugin-jsx-a11y 6.10.2 — **нет** (до ^9); eslint-plugin-react 7.37.5 —
  **нет** (до ^9.7, последний publish 2025-04); jsx-a11y-x 0.2.0 — да; eslint-plugin-mdx 3.8.1 — да (≥8).
- TypeScript: latest = 7.0.2 (2026-07-08); 6.0.3 (2026-04-16); 5.9.3. Потолок для Astro-шаблонов: typescript-eslint
  `<6.1.0`, `@astrojs/check` `^5||^6`. Сторонний источник: запрос поддержки TS 7 в typescript-eslint закрыт как «not planned»,
  стабильный API ожидается в TS 7.1 (не проверено первично).
  https://www.digitalapplied.com/blog/typescript-7-native-compiler-early-adopter-migration-readiness
- Prettier 3.9.10 (2026-10-10), v4 — alpha.13 от 2025-11-18 без продолжения; `prettier-plugin-astro` 1.0.0 (2026-09-08,
  после 0.14.1 от 2024-07), 1.1.1 (2026-10-09), peer `^3.5.3` — при выходе Prettier 4 плагин будет блокером.
- stylelint 17.0.0 (2026-01-15) → 17.16.0; `stylelint-config-standard` 40.0.0; для `@theme/@utility/@source/@custom-variant`
  — `at-rule-no-unknown` с `ignoreAtRules` (или `stylelint-config-tailwindcss` 1.0.1, 2026-01-08 — редкие релизы).
- knip 6.0.0 (2026-03-20) → 6.41.0; плагины под весь blog-стек есть.

## Recommendations for the boilerplate
1. **P0** Пины в catalog: `astro ~7.3.8`, `@astrojs/mdx ^8.0.3`, `@astrojs/starlight ~0.42.6`, `astro-expressive-code ~0.44.2`,
   `pagefind ~1.5.2`, `astro-og-canvas ~0.13.2`, `typescript ~6.0.3` (или 5.9.3; не 7), `eslint ^10.12`, `prettier ^3.9`.
2. **P0** Переходы в Astro-шаблонах: нативные cross-document VT + фолбэк по `onpagereveal`; ClientRouter запрещён правилом
   (lint: запрет импорта `astro:transitions` в blog/landing без явного исключения). Записать в мастер-план исключение к ScreenTransition.
3. **P0** Markdown только на Sätteri, без remark/rehype; вычисления (reading time, excerpt) — утилиты над `entry.body`.
4. **P1** OG по умолчанию `astro-og-canvas`; satori только через sharp, без resvg.
5. **P1** ESLint-набор ядра на ESLint 10: `typescript-eslint`, `eslint-plugin-astro` 3, `eslint-plugin-jsx-a11y-x`,
   `@eslint-react/eslint-plugin`, `eslint-plugin-react-hooks` 7; `i18next-cli` вместо `i18next-parser`.
6. **P1** Docker: билд на `node:24-slim` (glibc) + cache mount `node_modules/.astro`; nginx-сниппет для trailing slash, 404,
   pagefind, rss.
7. **P1** Локализованные слаги: `translationKey` в схеме + свой hreflang; не использовать custom locale paths.
8. **P2** Комментарии вне базы: docs-заметка Remark42 (self-host) / Giscus. CMS — интерфейс loader + один пример (Strapi sensinum).
9. **P2** Ссылки: linkinator в verify, lychee по cron; LHCI с планом Б на Lighthouse 13.
10. Ежеквартальный «upgrade PR» для Astro/Starlight/EC (0.x и частые мажоры), с smoke-сборкой blog+docs.

### Короткие заметки по заменам
- `reading-time` → своя утилита: пакет без релиза 5 лет, ru-подсчёт через `Intl.Segmenter` точнее.
- satori+resvg → astro-og-canvas: нет нативных бинарей и стагнирующего resvg; один мейнтейнер с Starlight.
- ClientRouter → native VT: 0 JS, без re-init скриптов, совместимо со Starlight/Pagefind/Umami; цена — Firefox без cross-fade (фолбэк вход).
- jsx-a11y / eslint-plugin-react → `-x` / `@eslint-react`: peer не допускает ESLint 10.
- i18next-parser → i18next-cli: официальный deprecate.
- strapi-community loader → sensinum или свой: peer только astro ^6.

### Что изменилось vs мастер-план
- §3.1 «переходы без View Transitions API»: для blog/landing (MPA) — наоборот, нативные cross-document VT + фолбэк; kit-механизм только для SPA/островов.
- §3.1 Lint: зафиксировать **ESLint 10** и замены a11y/react-плагинов; TS-потолок 6.0.x из-за typescript-eslint и `@astrojs/check`.
- §3.2 «OG на билде через satori» → `astro-og-canvas` по умолчанию; `reading-time` не брать; Markdown на Sätteri без remark/rehype.
- Добавить: link-check (linkinator/lychee), `i18next-cli`, билд-стадия Docker на glibc; Starlight остаётся опцией с пином `~0.42`.

## Open questions for the user
1. Firefox без анимации перехода между страницами (только плавное появление) в blog/landing — приемлемо? Альтернатива —
   ClientRouter во всех браузерах ценой JS и класса багов с перезапуском скриптов.
2. Комментарии в блоге нужны в базе (Remark42 self-host как отдельный сервис в compose) или только заметкой в docs?

### Сырые версии (npm view, 2026-10-15)
astro 7.3.8 (10-08; beta 7.4.0-beta.1 10-02); @astrojs/mdx 8.0.3 (10-06, peer astro ^7.2.10, engines node>=22.12); @astrojs/markdown-remark 7.3.2; @astrojs/markdown-satteri 0.4.3; @astrojs/rss 4.0.19 (06-30); @astrojs/sitemap 3.7.4 (08-31); @astrojs/react 7.0.1 (10-06, deps vite ^8.3, @vitejs/plugin-react ^6.1); @astrojs/check 0.9.10 (07-27, peer TS ^5||^6); @astrojs/starlight 0.42.6 (10-08); @astrojs/starlight-tailwind 5.0.0 (2026-03-11); astro-expressive-code 0.44.2 (08-31); shiki 4.5.0 (10-01); pagefind 1.5.2 (2026-04-12); astro-pagefind 2.0.1 (07-03); satori 0.57.2 (10-14); @resvg/resvg-js 2.6.2 (2024-03-26; 2.7.0-alpha.2 2026-01); @resvg/resvg-wasm 2.6.2; astro-og-canvas 0.13.2 (09-15, canvaskit-wasm); @takumi-rs/image-response 2.16.2; reading-time 1.5.0 (2021-09-10); sharp 0.35.5 (09-27); @giscus/react 3.1.0 / giscus 1.6.0 (2024-12-31); @sentry/astro 11.7.0 (10-12); @astrojs/node 11.1.7; astro-seo 1.2.0.
Ядро: i18next 26.4.5 (10-14); react-i18next 17.0.16 (10-06); i18next-icu 2.5.0; intl-messageformat 12.1.3; i18next-cli 1.75.3; i18next-parser 9.4.0 (deprecated); astro-i18next 1.0.0-beta.21 (2023); eslint 10.12.0; @eslint/js 10.0.1; typescript-eslint 8.71.2; eslint-plugin-astro 3.2.1 (3.0.0 2026-07-12, 2.0.0 2026-06-22); astro-eslint-parser 3.2.0; eslint-plugin-jsx-a11y 6.10.2; eslint-plugin-jsx-a11y-x 0.2.0; eslint-plugin-react 7.37.5; @eslint-react/eslint-plugin 5.26.7; eslint-plugin-react-hooks 7.1.1; eslint-plugin-mdx 3.8.1; eslint-config-prettier 10.1.8; prettier 3.9.10 (next 4.0.0-alpha.13); prettier-plugin-astro 1.1.1; stylelint 17.16.0; stylelint-config-standard 40.0.0; stylelint-config-tailwindcss 1.0.1; knip 6.41.0; typescript 7.0.2 / 6.0.3 / 5.9.3.
Тесты: @playwright/test 1.64.1; @axe-core/playwright 4.13.0; @lhci/cli 0.15.1 (2025-06-25, lighthouse 12.6.1); lighthouse 13.5.0; unlighthouse 0.19.1; linkinator 8.1.0; lychee v0.24.2 (GitHub); starlight-links-validator 0.27.0.
CMS: @sensinum/astro-strapi-loader 1.4.0; strapi-community-astro-loader 4.0.0 (peer astro ^6); @strapi/client 1.6.2; @directus/sdk 27.0.0; @sanity/astro 3.5.1; @avovix/astro-loader-payload 0.4.0; payload 3.90.2 (4.0.0-beta.1); @keystatic/astro 6.0.0; @tinacms/astro 0.7.1; Remark42 1.18.0 (GitHub 2026-10-11).
