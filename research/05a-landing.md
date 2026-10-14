# 05a. Шаблон `landing` — технологии
Status: done
Updated: 2026-10-14

## Resume notes
- Done: все 10 разделов, сводная таблица, рекомендации, открытые вопросы. Версии сняты из npm registry 2026-10-14
  (`registry.npmjs.org/<pkg>/latest`), даты релизов там, где указаны, — из поля `time`.
- Next: ничего; оркестратору — свести с 05b–05e (особенно: какой фреймворк у `shop`, чтобы не было двух SSR-стеков без
  причины).
- Sub-agent: нет (запрещено брифом для 05a).

## Summary (≤ 15 lines)
1. **Фреймворк: Astro 7 (7.3.8) + `@astrojs/react` (7.0.1), `output: 'static'` по умолчанию, nginx в Docker.** Ноль JS по
   умолчанию, React-острова из общего UI-кита, официальная поддержка shadcn в Astro-монорепо (`@workspace/ui`), Vite 8 —
   тот же сборщик, что у SPA-шаблонов (admin, TMA, game). Опционально `@astrojs/node` (11.1.7) для гибридных маршрутов
   (прокси формы, live-CMS, preview) — тогда Node-образ.
2. **Альтернатива — Next.js 16.4** (если `shop` выбирает Next и хочется один SSR-стек). Минусы для лендинга: больше JS
   (RSC-рантайм + роутер на каждой странице), `output: 'export'` теряет image optimization/redirects/headers/ISR,
   а self-hosted ISR на >1 реплике требует shared cache handler. React Router 8 / TanStack Start — хуже по контенту/SEO-тулингу.
3. **i18n:** маршрутизация — нативный `i18n` Astro (`/ru/`, `/en/`, `prefixDefaultLocale: true`); строки — i18next
   (26.4.4) с JSON-каталогами, общими с другими шаблонами, в `.astro` — через серверный `t()`, в остров передаются уже
   переведённые строки или минимальный namespace.
4. **Стили:** Tailwind v4.3 + CSS-переменные-токены из общего пакета, `@source` на пакет кита; шрифты — Astro Fonts API
   (self-host, preload, fallback-метрики против CLS).
5. **Контент:** Content Layer + MDX в репозитории по умолчанию; внешняя CMS — через loader (Strapi 5 MIT или Directus
   BSL; Payload 3 — MIT, но это Next-приложение и куплен Figma). SaaS (Sanity, Storyblok) допустимы как провайдер, не self-host.
6. **Анимации:** CSS-first (transitions, нативные cross-document View Transitions, scroll-driven animations как
   progressive enhancement — в Firefox stable ещё за флагом); GSAP 3.15 (полностью бесплатен с 2025) — только по
   требованию дизайна, в острове; Lenis 1.3 — опция, не по умолчанию.
7. **Формы:** остров с React Hook Form 7.90 + Zod 4 (как в остальных шаблонах), POST во внешний API (CORS) или через
   Astro Action при node-адаптере; антиспам — honeypot + ALTCHA (self-hosted PoW).
8. **SEO:** `@astrojs/sitemap` с i18n, свой `<Seo>`-компонент (canonical, hreflang, OG), JSON-LD через `schema-dts`,
   OG-картинки на билде (satori / `astro-og-canvas`).
9. **Тесты:** Vitest 5 (юниты острова), Playwright 1.64 (e2e + `toHaveScreenshot` в Docker), Lighthouse CI 0.15 с бюджетами CWV.
10. **Аналитика:** Umami 3.4 (MIT, cookieless) self-hosted по умолчанию + `vanilla-cookieconsent` 3.1 только если
    подключаются GA4/Метрика/пиксели.
11. **Общее с другими шаблонами:** React-кит, токены, Tailwind, i18next-каталоги, Zod-схемы, openapi-клиент, Vitest/Playwright.
    **Расхождение:** `astro:assets`/`<Image>` и `astro:i18n` — только в `.astro`; кит не должен импортировать
    `next/*`/`astro:*`, контекст-провайдеры не пересекают границы островов.

## Findings

### 0. Версии (npm registry, 2026-10-14)

| Пакет | Версия | Пакет | Версия |
| --- | --- | --- | --- |
| `astro` | 7.3.8 (2026-10-08) | `next` | 16.4.0 (2026-10-06) |
| `@astrojs/react` | 7.0.1 (2026-10-06) | `react` | 19.3.0 (2026-09-09) |
| `@astrojs/mdx` | 8.0.3 | `react-router` | 8.4.0 (2026-09-15) |
| `@astrojs/node` | 11.1.7 | `@tanstack/react-start` | 1.169.1 |
| `@astrojs/sitemap` | 3.7.4 | `vite` | 8.3.4 |
| `@astrojs/rss` | 4.0.19 | `tailwindcss`, `@tailwindcss/vite` | 4.3.3 |
| `@astrojs/check` | 0.9.10 | `shadcn` (CLI) | 4.21.4 |
| `radix-ui` | 1.8.1 | `@base-ui/react` | 1.9.0 |
| `motion` | 14.2.0 | `gsap` | 3.15.0 |
| `lenis` | 1.3.26 | `nanostores` / `@nanostores/react` | 1.5.5 / 2.0.1 |
| `i18next` / `react-i18next` | 26.4.4 / 17.0.16 | `@inlang/paraglide-js` | 2.27.0 |
| `next-intl` | 4.14.9 | `zod` / `valibot` | 4.6.7 / 1.5.0 |
| `react-hook-form` / `@hookform/resolvers` | 7.90.0 / 5.9.1 | `@tanstack/react-form` | 1.33.5 |
| `schema-dts` | 2.1.0 | `satori` / `astro-og-canvas` | 0.56.1 / 0.13.2 |
| `sharp` | 0.35.5 | `@fontsource-variable/inter` | 5.3.0 |
| `vitest` | 5.0.4 | `@playwright/test` | 1.64.0 |
| `@lhci/cli` / `lighthouse` | 0.15.1 / 13.5.0 | `@storybook/react-vite` | 10.6.2 |
| `vanilla-cookieconsent` | 3.1.0 | `altcha` / `altcha-lib` | 3.3.0 / 2.6.0 |
| `payload` | 3.90.2 | `@directus/sdk` / `@strapi/client` | 27.0.0 / 1.6.2 |
| `@keystatic/core` | 0.6.9 | `@sentry/astro` | 11.7.0 |
| Umami (GitHub) | v3.4.0 (2026-09-17) | ALTCHA (GitHub) | v3.3.0 (2026-10-05) |

Внимание: `@base-ui-components/react` (1.0.0-rc.0) — старое имя, актуальный пакет `@base-ui/react`.

### 1. Фреймворк и режим рендеринга

**Факты (проверено):**

- **Astro 7.0** вышел 2026-06-22: Rust-компилятор `.astro`, Rust-пайплайн Markdown/MDX, Vite 8 (Rolldown), Advanced
  Routing (`src/fetch.ts`, Hono-совместимо), стабильный route caching (`Astro.cache`, `routeRules`), билды на 15–61%
  быстрее; 7.2 добавил experimental incremental static builds, 7.3 — 2026-09-03. https://astro.build/blog/astro-7/ ,
  https://astro.build/blog/
- Breaking в 7: компилятор строже (незакрытые теги — ошибка, пробелы между inline-элементами схлопываются как в JSX),
  Markdown по умолчанию Sätteri — remark/rehype-плагины требуют `@astrojs/markdown-remark`; `@astrojs/db` удалён;
  `compressHTML: 'jsx'`. https://docs.astro.build/en/guides/upgrade-to/v7/
- Astro 6 (2026-03-10) убрал legacy content collections (только Content Layer), отказался от Node 18/20, сделал Live
  Content Collections стабильными. https://releases.sh/release/rel_Cqdx9dg1EcrVmsPcNqVm_-astro-6-content-layer-required-node-18-20-dropped
- **Cloudflare купил команду Astro 2026-01-16**; лицензия MIT, заявлена поддержка всех deploy-таргетов.
  https://www.heise.de/en/news/Web-Development-Cloudflare-Acquires-Astro-Technology-Company-11145912.html . CDN cache
  providers в 7.0 — только для Netlify/Vercel/Cloudflare; для Node есть `memoryCache()`.
- React-контекст **не пересекает границы островов** — официально рекомендованы nanostores для общего состояния.
  https://docs.astro.build/en/recipes/sharing-state-islands/
- shadcn официально поддерживает Astro, включая монорепо: `pnpm dlx shadcn@latest init -t astro --monorepo`, импорты
  `@workspace/ui/components/*`, `@workspace/ui/globals.css`. https://ui.shadcn.com/docs/installation/astro
- **Next.js 16**: `output: 'standalone'` + `node server.js` в Docker; `next/image` работает self-hosted под `next start`
  (sharp); ISR/кеш по умолчанию на локальном диске инстанса — для нескольких реплик нужен shared `cacheHandler`
  (image cache в cacheHandler — с 16.2). Adapter API стабилен с 16.2 (2026-03-25).
  https://unpkg.com/next@16.3.8/dist/docs/01-app/02-guides/self-hosting.md ,
  https://dev.to/mr_manushukla/self-host-nextjs-without-vercel-in-2026-a-production-guide-to-the-stable-adapter-api-3ll6
- Next `output: 'export'` не поддерживает: image optimization с дефолтным loader, redirects, rewrites, headers, proxy
  (middleware), ISR, Server Actions, cookies, draft mode. https://nextjs.org/docs/app/guides/static-exports
  (lastUpdated 2026-08-09). Cache Components (`use cache`) требуют сервер — со static export не работают (по гайду
  Vercel agent-skill, не официальная дока — проверить).
- **React Router 8** вышел 2026-06-17 (годовой цикл мажоров; v9 ~ май 2027), «улучшения SPA mode и pre-rendering».
  https://remix.run/blog/react-router-v8
- **TanStack Start** — prerender через `tanstackStart({ prerender: { enabled, crawlLinks, ... } })`.
  https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering

**Сравнение (мнение, на основе фактов выше):**

| Критерий | Astro 7 (+React islands) | Next.js 16 App Router | React Router 8 / TanStack Start prerender |
| --- | --- | --- | --- |
| JS по умолчанию | 0 KB; JS только у островов с `client:*` | React + RSC payload + роутер на каждой странице (~100+ KB gz, оценка) | React + роутер + гидрация всей страницы |
| Общий React-кит | Да, как острова; shadcn-монорепо официально | Да; интерактивным компонентам нужен `"use client"` | Да, без ограничений |
| Контент/MDX | Content Layer, MDX, loaders, live collections — лучшее в классе | MDX через `@next/mdx`, коллекций нет | вручную |
| i18n-роутинг | встроенный (`astro:i18n`, fallback, домены) | вручную `[locale]` + `next-intl` + proxy | вручную |
| Изображения без Vercel | `astro:assets` + sharp на билде; `/_image` в SSR | `next/image` под `next start`; при export — свой loader | нет встроенного, `@unpic`/imgproxy |
| Docker | static → nginx (~20–50 MB образ), или `@astrojs/node` standalone | Node standalone; ISR multi-replica = shared cache | static → nginx или Node |
| Риски | Cloudflare-владелец; строгий Rust-компилятор; острова без общего контекста | тяжелее; vendor-центричный кеш; RSC-сложность | мало SEO/контент-тулинга, всё руками |

**Рекомендация:** Astro 7 static. Next.js — только если `shop` выбрал Next и пользователь хочет один meta-framework на
весь SSR (тогда лендинг = Next с `output: 'standalone'`, без ISR на нескольких репликах или с Redis cacheHandler).

### 2. Роутинг и i18n

- Astro i18n: `i18n: { locales: ['ru','en'], defaultLocale: 'ru', routing: { prefixDefaultLocale: true, redirectToDefaultLocale: true }, fallback: { en: 'ru' } }`.
  Хелперы `getRelativeLocaleUrl`, `getAbsoluteLocaleUrlList`, `Astro.currentLocale` работают и на prerendered
  страницах; `Astro.preferredLocale` (детект по Accept-Language) и `domains` — только on-demand/SSR; кастомные
  locale-пути требуют `output: 'server'`. **Перевод строк Astro не даёт** — только роутинг.
  https://docs.astro.build/en/guides/internationalization/
- Pitfall: со static + `prefixDefaultLocale: true` корень `/` — это HTML-редирект (meta refresh); лучше настроить
  301 `/` → `/ru/` (или по Accept-Language) в nginx. (мнение, проверить при реализации)
- Строки: в проекте пользователя уже i18next с правилами (namespaces, плюралы ru, CI-проверки ключей,
  docs/library-notes.md, docs/architecture.md §7). **Рекомендация:** те же JSON-каталоги и i18next 26: в `.astro`
  создаётся серверный инстанс (`i18next.cloneInstance({ lng })` на страницу), в острова передаются готовые строки
  пропсами (кит и так props-only) или `react-i18next` с одним маленьким namespace. Так переиспользуются CI-проверки
  ключей и Crowdin-процесс.
- Альтернатива Paraglide JS 2.27 (компилирует сообщения в tree-shakable функции, минимум JS в островах), но
  `@inlang/paraglide-js-adapter-astro` помечен deprecated, и формат каталогов расходится с остальными шаблонами.
  https://docs.astro.build/en/recipes/i18n , https://www.locize.com/blog/astro-i18n/
- Next-вариант: `next-intl` 4.14 (де-факто стандарт для App Router) — это второй i18n-стек в монорепо.
- hreflang/canonical: генерировать из `getAbsoluteLocaleUrlList()` в общем `<Seo>`-компоненте; `@astrojs/sitemap` имеет
  опцию `i18n: { defaultLocale, locales }` для `xhtml:link` альтернатив.

### 3. Стили, UI-кит, шрифты

- Tailwind v4.3.3 через `@tailwindcss/vite` (Astro 7 = Vite 8). В CSS приложения: `@import "tailwindcss";`,
  `@import "@workspace/ui/globals.css";` и `@source "../../packages/ui";` — иначе классы кита не попадут в сборку
  (частый симптом: в Storybook работает, в приложении без стилей). https://nx.dev/blog/setup-tailwind-4-npm-workspace ,
  https://21st.dev/blog/shadcn-monorepo-setup
- Токены: CSS-переменные в общем пакете (`@theme` + `:root`/`[data-theme=dark]`), один источник для всех шаблонов.
- Кит: shadcn/ui поверх `radix-ui` 1.8 или `@base-ui/react` 1.9 (выбор — общий для монорепо, не для лендинга).
  На лендинге почти всё рендерится как статический HTML (Button, Card, Badge без `client:*` — 0 JS); гидрируются
  только Dialog/Sheet/Accordion/Tabs/форма. Мнение: для меню/аккордеона на лендинге предпочесть нативные
  `<details>`/`popover`/`<dialog>`, чтобы не гидрировать Radix.
- Тёмная тема в static: инлайн-скрипт в `<head>` до отрисовки (иначе FOUC/CLS).
- Шрифты: Astro Fonts API — `fonts: [{ provider: fontProviders.fontsource(), name: 'Inter', cssVariable: '--font-sans' }]`,
  `<Font cssVariable="--font-sans" preload />`; шрифты скачиваются и отдаются с нашего домена (`_astro/fonts`),
  генерируются метрико-совместимые fallback — против CLS. https://docs.astro.build/en/guides/fonts/ (статус stable/experimental
  на странице не указан — проверить в доке версии 7.3). Альтернатива, общая с SPA: `@fontsource-variable/*` 5.3 + ручной
  `size-adjust` fallback.
- Иконки: `lucide-react` 1.57 в кит; в `.astro` — тот же React-компонент рендерится в SVG без JS.

### 4. Контент: MDX, коллекции, headless CMS

- **По умолчанию:** Content Layer (`src/content.config.ts`, `glob()` loader, Zod-схемы) + `@astrojs/mdx` 8 для блога/доков;
  тексты в git, ревью через PR. Live Content Collections (stable с Astro 6) — `getCollection()` в рантайме из CMS без
  ребилда, но требуют SSR (node-адаптер).
- **Docs-раздел:** Starlight (Astro, 0.42 на 2026-09-02) — готовая документация с поиском и i18n; подключать только если
  нужен docs.
- **Внешние CMS (провайдер, наш фронт только читает API):**

| CMS | Лицензия / хостинг | Плюсы | Риски |
| --- | --- | --- | --- |
| Strapi 5 | MIT core (часть фич enterprise), self-host | крупнейшее сообщество, i18n-плагин, REST/GraphQL, `@strapi/client` | тяжелее в апгрейдах мажоров |
| Directus | BSL 1.1, бесплатно при выручке < $5M (по стороннему источнику — проверить), self-host | поверх любой SQL-БД, удобен контент-менеджерам, `@directus/sdk` 27 | лицензия не OSI |
| Payload 3 | MIT, self-host | TS-first, сильная типизация | это Next.js-приложение; куплен Figma (закрытие 2025-04-17), направление неясно |
| Sanity / Storyblok | SaaS (Sanity Studio можно хостить, данные — в облаке) | визуальный редактор, preview | не self-host, оплата |
| Keystatic / TinaCMS | git-based | контент остаётся в репо | Tina стал дефолтным шаблоном Astro (май 2026) — проверить зрелость |

  Источники: https://blog.elest.io/directus-vs-strapi-which-headless-cms-should-you-self-host-in-2026/ ,
  https://www.cmswire.com/digital-experience/when-cms-meets-ux-design-what-figmas-payload-deal-really-means ,
  https://www.sec.gov/Archives/edgar/data/1579878/000162828025037014/figma424b4.htm (Payload в S-1 Figma).
- **Рекомендация:** в бойлерплейте — MDX-коллекции + один пример loader'а для внешней CMS по OpenAPI/REST за интерфейсом
  (`src/content/loaders/<provider>.ts`), без вшитой CMS. Ребилд по webhook CMS → CI. Конкретную CMS выбирать на проекте
  (кандидаты по умолчанию: Strapi или Directus).

### 5. Анимации и smooth scroll

**Факты:**
- GSAP полностью бесплатен (включая бывшие Club-плагины SplitText, MorphSVG и т.д.) для коммерческого использования
  после покупки Webflow; standard license effective 2025-04-30. В лицензии есть «Prohibited Uses» — конкуренты
  визуального билдера Webflow. ScrollTrigger был бесплатен и раньше. https://webflow.com/blog/gsap-becomes-free ,
  https://gsap.com/community/standard-license/
- Motion (motion.dev, `motion` 14.2): полный `motion`-компонент 34 KB gz; `LazyMotion` + `m` 4.6 KB + `domAnimation`
  15 KB / `domMax` 25 KB; `useAnimate` mini 2.3 KB (WAAPI). https://motion.dev/docs/react-reduce-bundle-size
- CSS scroll-driven animations (`animation-timeline: view()/scroll()`): Chrome 115+, Safari 26 (сен 2025); Firefox
  stable на июнь 2026 — за флагом, в Interop 2026 → не Baseline. https://blog.codercops.com/blog/css-view-transitions-scroll-animations-2026
  (сторонний блог; перед фиксацией проверить caniuse).
- Cross-document View Transitions (`@view-transition { navigation: auto }`): Chrome 126+, Safari 18.2+, Firefox — в
  разработке; same-document — Baseline с Firefox 144. https://developer.chrome.com/blog/view-transitions-in-2025
- Lenis в native-режиме сохраняет нативный скроллбар, Ctrl+F и `position: sticky`; сглаживает только wheel; при
  совместной работе с GSAP нужен один rAF-цикл (`gsap.ticker`). https://gsap.com/community/forums/topic/34032-scrollsmoother-accessibility/

**Мнение / рекомендация (по стоимости для CWV):**
1. База — CSS: transitions из токенов (`--duration-*`, `--ease-*`, правило «нет `transition: all`» уже в линтере
   пользователя), cross-document View Transitions как progressive enhancement (MPA-навигация Astro без `<ClientRouter />`
   → 0 JS), `animation-timeline: view()` внутри `@supports` с fallback «без анимации». Всё в
   `@media (prefers-reduced-motion: no-preference)`.
2. Сложные таймлайны/пиннинг/SplitText — GSAP 3.15 + ScrollTrigger в одном острове `client:visible`, динамический импорт;
   не анимировать LCP-элемент (hero-заголовок/картинка видимы без JS, анимация только `transform/opacity`), иначе LCP
   откладывается до гидрации.
3. Motion — когда анимация — часть React-компонента кита (exit, layout, жесты); `LazyMotion` + `m` обязательно, правило
   линтера против `motion.*` в ките.
4. Lenis — опциональная фича (флаг init), не по умолчанию: добавляет JS на главный поток на каждый wheel-event,
   риск для INP на слабых Android, конфликтует с нативным `scroll-behavior` и якорями. Если нужен — `autoRaf: false`
   и привязка к `gsap.ticker`.

### 6. Формы (лид-формы)

- Одна схема Zod 4 (лучше — сгенерированная из OpenAPI контракта, как в других шаблонах) → валидация на клиенте и, при
  node-режиме, на сервере.
- Клиент: остров `client:visible` с `react-hook-form` 7.90 + `@hookform/resolvers` 5.9 (консистентно с admin/shop).
  TanStack Form 1.33 — нормальная альтернатива, но вводит второй form-стек в монорепо. Valibot 1.5 меньше по весу, но
  расходится со схемами остальных шаблонов — не брать ради нескольких KB.
- Отправка, два режима:
  - **static:** `fetch` прямо во внешний API (нужен CORS на бэке, публичный endpoint без секретов).
  - **node-адаптер:** Astro Actions (`astro:actions`, `defineAction({ accept: 'form', input: zodSchema })`) — работает и
    как нативная `<form method="POST">` без JS (progressive enhancement), прячет API-ключ, rate-limit/антиспам на нашей
    стороне. Actions требуют on-demand рендеринга.
- Антиспам: honeypot-поле + ALTCHA 3.3 (self-hosted proof-of-work, без кук и без внешних сервисов; https://altcha.org).
  Cloudflare Turnstile/hCaptcha — внешние сервисы, только если пользователь согласен.
- a11y: `<label>` к каждому полю, `aria-invalid` + `aria-describedby` на ошибку, фокус на первое ошибочное поле,
  `autocomplete`/`inputmode` (`tel`, `email`), статус отправки в `aria-live`.

### 7. SEO

- `site` в `astro.config` обязателен (canonical, sitemap, OG absolute URLs) — **это build-time значение** (см. раздел 10).
- `@astrojs/sitemap` 3.7 с `i18n`-опцией; `robots.txt` — эндпоинт `src/pages/robots.txt.ts` (prerender), указывает на
  `sitemap-index.xml`; на stage/preview — `Disallow: /` + `X-Robots-Tag: noindex` через nginx-переменную.
- Мета: свой `<Seo>`-компонент в `.astro` (title template, description, canonical, `hreflang` + `x-default`, OG/Twitter),
  данные — из frontmatter/коллекции. `astro-seo` 1.2 — можно, но обёртка из 30 строк проще и без зависимости (мнение).
- JSON-LD: `schema-dts` 2.1 для типов (`Organization`, `WebSite`, `BreadcrumbList`, `Article`, `FAQPage`, `Product` для
  промо), рендер `<script type="application/ld+json" set:html={JSON.stringify(ld)} />`; экранировать `</` .
- OG-изображения: на билде — `satori` 0.56 + `@resvg/resvg-js` в эндпоинте `src/pages/og/[...slug].png.ts` (JSX-шаблон,
  можно использовать токены) или `astro-og-canvas` 0.13 (проще, без JSX). `@vercel/og` — не нужен (Vercel-ориентирован).
- RSS для блога — `@astrojs/rss` 4.0.
- Проверка: Lighthouse SEO-категория в CI + Playwright-тест «у каждой страницы есть title, description, canonical,
  hreflang-пара, один h1».

### 8. Core Web Vitals и изображения

- `astro:assets`: `<Image>`/`<Picture>` с sharp на билде (AVIF/WebP, `srcset`/`sizes`, width/height → нет CLS),
  `layout` для responsive (с 5.10). Удалённые картинки CMS оптимизируются только из `image.domains`/`remotePatterns`.
  В static-режиме всё считается на билде (растёт время билда); в SSR — endpoint `/_image` в рантайме (нужен sharp в образе).
  https://docs.astro.build/en/guides/images/
- **Ограничение:** `<Image>`/`<Picture>` нельзя использовать внутри React-компонентов. Решения: рендерить картинку в
  `.astro` и передать в остров как `children`/slot; или `getImage()` во frontmatter и передать `src/srcset` пропсом.
  Отсюда правило для кита: компоненты с картинками принимают `ReactNode`-слот или `{src, srcSet, sizes, width, height}`,
  никогда не импортируют `next/image`/`astro:assets`.
- LCP: hero-картинка `loading="eager"` + `fetchpriority="high"`, остальные lazy; LCP-элемент не скрывать за анимацией;
  шрифты preload только для above-the-fold.
- INP: минимум островов, `client:visible`/`client:idle` вместо `client:load`; сторонние скрипты (пиксели) — после
  consent и `requestIdleCallback`; `@astrojs/partytown` 2.1 — опционально, ломает часть скриптов (мнение).
- CLS: размеры у всех медиа, fallback-метрики шрифтов, инлайн-скрипт темы, резерв места под cookie-баннер (оверлей,
  а не сдвиг контента).
- Бюджеты (предложение): LCP < 2.0 s, CLS < 0.05, TBT < 150 ms на mobile-профиле Lighthouse; JS на главной < 50 KB gz.

### 9. Тестирование

- Vitest 5.0 — юниты островов/утилит (jsdom/happy-dom), `experimental_AstroContainer` для рендера `.astro`-компонентов
  в тестах (container renderer теперь из `@astrojs/react/container-renderer`).
- Playwright 1.64: e2e по `astro preview`/собранному nginx-образу: навигация по локалям, форма (мок API через `page.route`),
  SEO-мета, a11y через `@axe-core/playwright`. Визуальная регрессия — `expect(page).toHaveScreenshot()` **только в Docker
  (официальный образ `mcr.microsoft.com/playwright`)**, иначе скриншоты Windows/macOS/Linux расходятся; анимации
  отключать (`reducedMotion: 'reduce'`, `animations: 'disabled'`).
- Lighthouse CI (`@lhci/cli` 0.15, lighthouse 13.5): `lhci autorun` по статике, assertions на CWV-бюджеты и SEO/a11y ≥ 0.95;
  хранение отчётов — `temporary-public-storage` или свой LHCI server (self-host). Медленные/шумные — 3 прогона, медиана.
- `astro check` (`@astrojs/check` 0.9) в typecheck-шаге.
- Storybook 10 живёт в пакете кита (общий), не в лендинге.

### 10. Аналитика и consent

- **Umami 3.4 (MIT)** — self-hosted (Node + Postgres), cookieless, события и воронки; легче Plausible.
  **Plausible CE** — AGPL-3.0, ClickHouse + Postgres, ~1 GB RAM. https://thegtmdirectory.com/compare/plausible-vs-umami
  **PostHog** — тяжёлый self-host (много сервисов), для лендинга избыточен, полезен если продукт уже в PostHog.
- Утверждение «cookieless = баннер не нужен» — маркетинг вендоров, юридически не подтверждено (для РФ — 152-ФЗ, для ЕС —
  ePrivacy/GDPR); решать с юристом проекта. Метрика/GA4/пиксели требуют consent однозначно.
- Consent: `vanilla-cookieconsent` 3.1 (без фреймворка, ~ десятки KB, категории, i18n, блокировка скриптов через
  `type="text/plain" data-category="analytics"`), Google Consent Mode v2 при GA4. Подключать как фичу, только когда есть
  не-cookieless счётчики.
- Скрипт аналитики — через наш домен (nginx `location /stats/` proxy_pass на Umami), чтобы не резали блокировщики и не
  нужен был отдельный CSP-источник.

### 11. Docker-деплой

**Static (по умолчанию):**
```dockerfile
FROM node:22-alpine AS build          # версия Node = .nvmrc = engines (docs/tooling.md §1)
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/landing/package.json apps/landing/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter landing...
COPY . .
ARG SITE_URL
RUN pnpm --filter landing build

FROM nginx:1.29-alpine
COPY apps/landing/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY apps/landing/env.js.template /etc/env/env.js.template
COPY --from=build /repo/apps/landing/dist /usr/share/nginx/html
```
(версия nginx-образа — проверить на момент реализации; `pnpm deploy`/`turbo prune` для меньшего контекста.)

- Кеш-заголовки: `/_astro/*` (хешированные) — `Cache-Control: public, max-age=31536000, immutable`; HTML, `sitemap*.xml`,
  `robots.txt`, `env.js` — `no-cache` (ревалидация по ETag); `gzip_static`/`brotli` (бротли требует модуль — проще
  предсжать на билде). Безопасность: CSP (Astro 7 умеет генерировать CSP-хеши для инлайн-скриптов — проверить
  `security.csp`), HSTS, `X-Content-Type-Options`, `Referrer-Policy`.
- Runtime env: `site` (canonical/sitemap/OG) и всё, что попадает в HTML на билде, — **build-time**; значит образ на
  окружение (stage/prod) или stage с `noindex`. Клиентские параметры (URL API формы, домен аналитики) — через
  `/env.js`, генерируемый при старте контейнера (`envsubst` в entrypoint nginx-образа из `/etc/env/*.template`) →
  `window.__ENV`, читается одной функцией `getPublicEnv()` с Zod-валидацией. `astro:env` public-client значения
  попадают в бандл на билде — для runtime-подмены в static не годится.
- Healthcheck: `GET /healthz` → 200 в nginx.

**Node (`@astrojs/node` `mode: 'standalone'`)** — если включены Actions, live collections, preview CMS, Accept-Language
редирект: `node ./dist/server/entry.mjs`, `HOST=0.0.0.0`, `PORT`; секреты через `astro:env/server` в рантайме;
prerender по умолчанию, `export const prerender = false` для серверных маршрутов; статические `_astro/*` всё равно лучше
отдавать nginx/CDN перед Node. Для i18n custom paths/domains прокси обязан передавать `X-Forwarded-Host/Proto`, иначе 404.

### 12. Что общее с другими шаблонами, что расходится

| Общее (пакеты `packages/*`) | Расходится в `landing` |
| --- | --- |
| UI-кит (React 19, shadcn, Radix/Base UI), токены CSS, Tailwind v4 preset/`globals.css` | страницы — `.astro`, а не `.tsx`; роутинг файловый Astro |
| i18next-каталоги и CI-проверки ключей | перевод в `.astro` через серверный `t()`; `astro:i18n` для URL |
| Zod-схемы/openapi-клиент, правила ESLint/Prettier, Vitest, Playwright | `astro check`, `eslint-plugin-astro`, Prettier `prettier-plugin-astro` |
| иконки `lucide-react` | `astro:assets` Image/Picture и Fonts API — только в `.astro` |
| Vite 8 как сборщик | React-контекст не сквозной: провайдеры (тема, i18n, query) не работают между островами → nanostores или пропсы |

Правила для общего кита, которые вытекают из лендинга (и из возможного Next в `shop`):
1. Никаких импортов `next/*`, `astro:*`, роутеров внутри кита; навигация — через `asChild`/`href`-проп.
2. Интерактивные компоненты помечены `"use client"` (нужно для Next RSC, безвредно для Vite/Astro).
3. Компонент рендерится без провайдеров (дефолты), тема — через CSS-переменные/`data-theme`, а не React-контекст.
4. Картинки — слот или пропсы `src/srcSet/sizes/width/height`.
5. SSR-безопасность: никаких `window`/`document` на уровне модуля (кит рендерится на билде Astro).

## Recommendations for the boilerplate

1. **Взять** Astro 7 + `@astrojs/react` + `@astrojs/mdx` + `@astrojs/sitemap`, `output: 'static'`, nginx-образ. Фича-флаг
   init `landing.server` добавляет `@astrojs/node`, Actions и Node-Dockerfile.
2. **Взять** нативный `astro:i18n` (ru/en, префикс у всех локалей) + i18next-каталоги из общего пакета; 301 с `/` в nginx.
3. **Взять** Tailwind v4 + общий `@workspace/ui` (shadcn monorepo-раскладка, официально поддержана для Astro) + `@source`;
   Fonts API для шрифтов.
4. **Взять** Content Layer + MDX; пример loader'а внешней CMS; Starlight — отдельной опцией только для docs.
5. **Анимации:** CSS-first + View Transitions (MPA) + scroll-driven в `@supports`; GSAP — опция (острова, dynamic import);
   Lenis — опция, выключена по умолчанию; Motion — только через `LazyMotion` в ките.
6. **Формы:** RHF + Zod (общие с другими шаблонами), honeypot + ALTCHA; Actions — при server-режиме.
7. **SEO:** свой `<Seo>`, JSON-LD через `schema-dts`, OG на билде через satori, robots/sitemap с noindex на stage.
8. **CI:** `astro check`, Vitest, Playwright (+axe, скриншоты в Docker), Lighthouse CI с бюджетами CWV.
9. **Аналитика:** Umami self-hosted через прокси на своём домене; cookie-consent — фича, включаемая вместе с GA4/Метрикой.
10. **Избегать:** `client:load` по умолчанию; `<ClientRouter />` (SPA-режим Astro) без нужды; анимации LCP-элемента;
    Next ISR на нескольких репликах без shared cache; Paraglide-адаптера Astro (deprecated); тяжёлого клиентского
    состояния и data-grid'ов (жертвуем — это зона admin).

### Сводная таблица

| Потребность | Рекомендация | Альтернатива | Риск |
| --- | --- | --- | --- |
| Фреймворк/рендер | Astro 7.3 static + React islands | Next.js 16.4 standalone (если `shop` на Next) | Astro под Cloudflare; строгий Rust-компилятор; острова без общего контекста |
| Деплой | nginx static image | `@astrojs/node` 11 standalone | build-time `site`/OG → образ на окружение |
| i18n-роутинг | `astro:i18n`, `/ru/` `/en/` | ручной `[locale]` | детект языка только в SSR/nginx |
| i18n-строки | i18next 26 (общие каталоги) | Paraglide 2.27 | over-shipping каталогов в острова |
| Стили | Tailwind 4.3 + CSS-токены + `@source` | CSS Modules | забытый `@source` → нет стилей кита |
| UI-кит | shadcn (monorepo) на Radix/Base UI | нативные `<details>/<dialog>/popover` для простого | гидрация Radix ради мелочей |
| Шрифты | Astro Fonts API | `@fontsource-variable/*` | статус API — проверить |
| Изображения | `astro:assets` + sharp | imgproxy (self-host) + свой loader | нельзя в React-островах; время билда |
| Контент | Content Layer + MDX | Strapi 5 / Directus через loader | Directus BSL; Payload = Next + Figma |
| Анимации | CSS + View Transitions + scroll-driven (`@supports`) | GSAP 3.15 / Motion 14 (LazyMotion) | Firefox без scroll-driven и cross-doc VT |
| Smooth scroll | нативный | Lenis 1.3 (опция) | INP, конфликт с якорями/GSAP rAF |
| Формы | RHF 7.90 + Zod 4, fetch во внешний API | Astro Actions (server), TanStack Form | CORS; спам → honeypot + ALTCHA |
| SEO | свой `<Seo>`, sitemap 3.7, `schema-dts`, satori OG | `astro-seo`, `astro-og-canvas` | hreflang-ошибки при fallback-локалях |
| Тесты | Vitest 5, Playwright 1.64 (скриншоты в Docker), LHCI 0.15 | Chromatic/Argos для визуалки (SaaS) | шумные LH-замеры |
| Аналитика | Umami 3.4 self-host, прокси на своём домене | Plausible CE (AGPL), PostHog | «без баннера» — не юридический факт |
| Consent | `vanilla-cookieconsent` 3.1 (по флагу) | свой баннер из кита | CLS от баннера; блокировка скриптов до согласия |

## Open questions for the user

1. Если `shop` выберет Next.js — допустимы ли в монорепо два meta-framework'а (Astro для лендинга, Next для магазина),
   или нужен один (тогда лендинг тоже на Next, с потерей «0 JS по умолчанию»)?
2. Лендинг по умолчанию чисто статический (nginx) с отправкой формы напрямую во внешний API — или нужен серверный режим
   (Node) для прокси формы, preview CMS и live-контента?
3. Нужен ли один Docker-образ на все окружения (тогда `site`/canonical/OG-URL придётся генерировать иначе или держать
   stage как noindex-копию прод-сборки), или допустим образ на окружение?
4. Какая CMS по умолчанию в примере — только MDX в репо, Strapi (MIT) или Directus (BSL)? Или CMS вообще не включать в
   бойлерплейт?
5. Аналитика: только self-hosted Umami, или в шаблоне нужны Яндекс.Метрика/GA4 (тогда обязательный cookie-баннер)?
6. Включать ли GSAP и Lenis в шаблон как опции init, или оставить только CSS-анимации + Motion из кита?
