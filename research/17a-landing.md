# 17a. Шаблон `landing`: глубокая проверка стека
Status: done
Updated: 2026-10-15

## Resume notes
- Done: все разделы. Версии и даты взяты из registry.npmjs.org (поле `time`, скрипт через `fetch`) 2026-10-15,
  загрузки из api.npmjs.org за 2026-10-06…12, репозитории из api.github.com. Дополнительно проверены: блог и релизы
  Astro, changelog `@astrojs/react`, MDN BCD для `@view-transition`, Bugzilla 1860854, Astro docs (VT, CSP, fonts,
  testing), Base UI quick start, релизы lucide v1 / tailwind-variants / Tailwind / Base UI / LHCI / Umami, теги nginx
  на Docker Hub.
- Next: ничего. Пункты из R-раздела проверяет smoke-сборка при реализации `apps/landing`.
- Sub-agent: нет (запрещено).

## Summary (≤ 15 lines)
1. **Astro 7.3.8 + `@astrojs/react` 7.0.1, static, оставляем.** Проект здоровый: 7,3 млн загрузок в неделю, релизы
   каждые 1–2 недели, лицензия MIT в репозитории. Риск: мажоры стали частыми (6.0 в 2026-03, 7.0 в 2026-06, 7.4 уже
   в beta), так что **Astro 8 в ближайшие 12 месяцев вероятен**. Пиним через catalog, обновляем одним PR.
2. Покупка Cloudflare (2026-01-16) на static-сборку не влияет: на выходе обычный HTML/CSS/JS для nginx. Перекос в
   сторону Cloudflare виден только в адаптерах и кэш-провайдерах, а их мы не используем.
3. **Переходы экранов: нативные cross-document View Transitions (`@view-transition { navigation: auto }`) плюс
   CSS-fallback (fade-in при загрузке). `<ClientRouter />` и React-`ScreenTransition` не берём.** Поддержка: Chrome 126+,
   Safari и iOS 18.2+, Firefox нет (bug 1860854 открыт, входит в Interop 2026). `<ClientRouter />` несовместим с
   `security.csp` Astro и требует переинициализации скриптов. Это расхождение с мастер-планом (там «без VT API»).
4. **Стили и kit:** Tailwind 4.3.3 (`@tailwindcss/vite`), `tailwind-variants` 3.3.1, `tailwind-merge` 3.7.0,
   `eslint-plugin-better-tailwindcss` 4.9.1 (`tv()` и `.astro` поддерживаются из коробки), `@base-ui/react` 1.9.0
   (минорный релиз каждые 4–7 недель, 8 мейнтейнеров). Всё оставляем. Обязательные правила: один глобальный CSS в
   layout (тогда CSS между островами не дублируется), compound-компоненты Base UI собираются целиком внутри одного
   `.tsx`-острова, `isolation: isolate` на корне страницы.
5. **Иконки:** `lucide-react` 1.57.0 оставляем. В v1 (2026-03-23) удалены **все бренд-иконки**, а лендингу нужны
   соцсети. Добавляем `simple-icons` 16.35 (SVG-данные, рендер в `.astro`, без JS).
6. **Состояние:** без MobX и без стора по умолчанию: пропсы и локальный `useState`. Если два и более острова делят
   живое состояние, берём `nanostores` 1.5.5 + `@nanostores/react` 2.0.1 (так советует Astro). Сначала проверяем,
   нельзя ли слить острова в один.
7. **Формы:** RHF 7.90 + Zod 4.6 + honeypot + ALTCHA 3.3. Риск: RHF 8 в beta (8.0.0-beta.4). Astro Actions только в
   опции `landing-node`.
8. **Замены:** `@resvg/resvg-js` (последний релиз 2024-03) → `sharp` 0.35.5 для SVG→PNG в OG-картинках (sharp уже
   стоит у Astro). Базовый образ `nginx:1.29-alpine` из 05a устарел → `nginxinc/nginx-unprivileged:1.30-alpine-slim`
   (stable 1.30.6, non-root, пин по digest).
9. **Под наблюдением:** `@lhci/cli` 0.15.1 (последний релиз 2025-06, внутри жёстко `lighthouse` 12.6.1, а актуальный
   13.5), `vanilla-cookieconsent` 3.1.0 (2025-02), `@astrojs/check` (peer только TS ^5 || ^6, с TS 7 пока не работает),
   `eslint-plugin-astro` 3.2.1 (нужны Node ≥ 24.16 и ESLint ≥ 10).

## Findings

### 1. Сводная таблица (проверено 2026-10-15)

«Здоровье»: дата последнего релиза, загрузки/нед, открытые issues+PR на GitHub, число npm-мейнтейнеров.
«Риск 12 мес»: вероятность breaking change, который затронет шаблон.

| Технология | Выбор + точная версия | Дата релиза | Здоровье | Риск 12 мес | Вердикт | Источник |
| --- | --- | --- | --- | --- | --- | --- |
| Фреймворк | `astro` 7.3.8 | 2026-10-08 | 7,3 млн/нед, 101 open, релиз каждые 1–2 нед; MIT | **высокий**: 7.4.0-beta.1 (2026-10-02); мажоры 6.0 (03-10) и 7.0 (06-22) → Astro 8 вероятен | keep | https://github.com/withastro/astro/releases , https://astro.build/blog/ |
| React в островах | `@astrojs/react` 7.0.1 | 2026-10-06 | тот же монорепо | средний: 7.0.0 (2026-09-22) убрал опцию `babel`, перешёл на Oxc | keep; `compiler` не включать (решение пользователя) | https://raw.githubusercontent.com/withastro/astro/main/packages/integrations/react/CHANGELOG.md |
| Адаптер (опция `landing-node`) | `@astrojs/node` 11.1.7 | 2026-10-06 | peer `astro ^7.2.1` | средний (мажор вместе с Astro 8) | keep | npm |
| Контент | Content Layer (в `astro`), `@astrojs/mdx` 8.0.3 | 2026-10-06 | — | средний: Markdown в 7.0 перешёл на Sätteri | keep | https://docs.astro.build/en/guides/upgrade-to/v7/ |
| Роутинг, i18n-URL | файловый роутинг + `astro:i18n` (встроены) | — | — | низкий | keep | https://docs.astro.build/en/guides/internationalization/ |
| Типчек | `@astrojs/check` 0.9.10 | 2026-07-27 | релиз раз в 1–4 мес | **TS 7 не в peer** (`^5 \|\| ^6`) | keep; блокирует переход на TS 7 | npm |
| Tailwind | `tailwindcss` / `@tailwindcss/vite` / `@tailwindcss/postcss` 4.3.3 | 2026-07-16 | 98k★, 96 open, 3 мейнтейнера; peer vite `^5.2…^8` | низкий: 4.4/5.0 не анонсированы | keep | https://github.com/tailwindlabs/tailwindcss/releases |
| Рецепты | `tailwind-variants` 3.3.1 | 2026-08-03 | 4,5 млн/нед, 5 open, org HeroUI, **1 npm-мейнтейнер**, паузы до 8 мес (3.2.2 → 3.3.0) | низкий | keep; при смерти проекта форк (код маленький) | https://github.com/heroui-inc/tailwind-variants/releases |
| Merge | `tailwind-merge` 3.7.0 | 2026-09-12 | 1 мейнтейнер, 26 open, активен | низкий | keep + `extendTailwindMerge` под токены | npm |
| Lint классов | `eslint-plugin-better-tailwindcss` 4.9.1 | 2026-10-13 | 1,4 млн/нед, 30 open, 1 мейнтейнер, релизы еженедельно | низкий-средний (быстрый темп) | keep | https://github.com/schoero/eslint-plugin-better-tailwindcss |
| Примитивы kit | `@base-ui/react` 1.9.0 | 2026-10-09 | 17,4 млн/нед, 8 мейнтейнеров, 482 open; минор каждые 31–47 дней | низкий-средний (1.6.0 переименовал preview-namespace; preview-компоненты меняются) | keep; preview-компоненты в kit не брать | https://github.com/mui/base-ui/releases |
| Иконки | `lucide-react` 1.57.0 | 2026-10-14 | 109 млн/нед, ISC, почти ежедневные миноры, 1 npm-мейнтейнер | низкий (v1 вышла 2026-03-23) | keep + `simple-icons` 16.35.0 для брендов | https://lucide.dev/guide/version-1 |
| Состояние | нет; при необходимости `nanostores` 1.5.5 + `@nanostores/react` 2.0.1 | 2026-10-06 / 2026-09-02 | 7,6k★, 23 open, 1 мейнтейнер | низкий | keep (опционально) | https://docs.astro.build/en/recipes/sharing-state-islands/ |
| Формы | `react-hook-form` 7.90.0, `@hookform/resolvers` 5.9.1, `zod` 4.6.7 | 2026-10-11 / 08-17 / 10-12 | активны | **средний**: RHF 8.0.0-beta.4 | keep (пин 7.x) | npm |
| Антиспам | `altcha` 3.3.0 (виджет), `altcha-lib` 2.6.0 (сервер) | 2026-10-05 | 2 open, 1 мейнтейнер, MIT | низкий | keep | https://altcha.org |
| i18n строк | `i18next` 26.4.5 (только на сервере, в `.astro`) | 2026-10-14 | 2 мейнтейнера, частые патчи | низкий | keep; `react-i18next` в островах не нужен | npm |
| Переходы экранов | CSS `@view-transition { navigation: auto }` + fallback | — (CSS) | Chrome 126+, Safari/iOS 18.2+, Firefox ✗ | низкий (стандарт) | **replace**: вместо `ScreenTransition`/`<ClientRouter />` | https://raw.githubusercontent.com/mdn/browser-compat-data/main/css/at-rules/view-transition.json |
| Анимации-опции | `gsap` 3.15.0, `lenis` 1.3.26 | 2026-04-13 / 2026-08-05 | живы | lenis 2.0.0-dev в работе | keep как опции init, выключены | npm |
| Sitemap | `@astrojs/sitemap` 3.7.4 | 2026-08-31 | — | низкий | keep | npm |
| JSON-LD | `schema-dts` 2.1.0 | 2026-10-02 | Google, только типы | низкий | keep | npm |
| OG-картинки | `satori` 0.57.2 + `sharp` 0.35.5 | 2026-10-14 / 2026-09-27 | satori 6 мейнтейнеров, 0.x (4 релиза за 1 день, пин exact) | средний (0.x) | keep satori; **replace `@resvg/resvg-js` 2.6.2 (2024-03-26) → sharp** | npm |
| Юнит-тесты | `vitest` 5.0.4 + `getViteConfig` | 2026-10-12 | 5 мейнтейнеров | низкий | keep | https://docs.astro.build/en/guides/testing/ |
| E2E, a11y | `@playwright/test` 1.64.1, `@axe-core/playwright` 4.13.0 | 2026-10-14 / 08-11 | активны | низкий | keep | npm |
| Перф-бюджет | `@lhci/cli` 0.15.1 (внутри `lighthouse` 12.6.1) | **2025-06-25** | репо: последний push 2026-03-27, 236 open | средний: отставание на мажор Lighthouse | keep с наблюдением; план B ниже | https://github.com/GoogleChrome/lighthouse-ci/releases |
| Аналитика | Umami v3.4.0 (self-host) | 2026-09-17 | 39k★, MIT, релиз раз в 1–2 мес | низкий | keep | https://github.com/umami-software/umami/releases |
| Ошибки | `@sentry/astro` 11.7.0 (peer `astro >=7.0.0-beta`) | 2026-10-12 | активен | низкий | опция, **по умолчанию выключено** | npm |
| Consent | `vanilla-cookieconsent` 3.1.0 | **2025-02-04** | репо: push 2026-07, 59 open | низкий | keep как опция, под наблюдением | npm |
| Lint `.astro` | `eslint-plugin-astro` 3.2.1, `prettier-plugin-astro` 1.1.1 | 2026-09-17 / 2026-10-09 | — | engines: Node `^22.22.3 \|\| ^24.16.0`, ESLint ≥ 10 | keep; Node в `.nvmrc` ≥ 24.16 | npm |
| Образ | `nginxinc/nginx-unprivileged:1.30-alpine-slim` (nginx 1.30.6 stable) | 2026-10-14 | официальный, теги обновляются | низкий | **replace** `nginx:1.29-alpine` из 05a | https://hub.docker.com/r/nginxinc/nginx-unprivileged |

### 2. Фреймворк и рендеринг
- **Факты.** Свежие релизы Astro: 7.3.8 (10-08), 7.3.7 (10-07), 7.3.6 (10-06). В 7.3.8 внутренняя сборка перешла с
  esbuild на Oxc/Rolldown (`transformWithOxc`). Блог: 7.0 (06-22), 7.1 (07-16, CSP и content collections), 7.2 (08-06,
  experimental incremental builds), 7.3 (09-03). Про Astro 8 официально ничего не объявлено. Даты мажоров: 4.0 (2023-12),
  5.0 (2024-12), 6.0 (2026-03-10), 7.0 (2026-06-22). `engines.node >= 22.12.0`.
- **Факты по `@astrojs/react` 7.0.0** (2026-09-22): переход на `@vitejs/plugin-react` 6 и Oxc, опция `babel` удалена,
  появилась opt-in `react({ compiler: true })`. Пользователь решил React Compiler не включать, значит дефолт `false`
  нас устраивает. Peer `react ^17 || ^18 || ^19`, совместим с 19.3.1 (вышла 2026-10-14).
- **Cloudflare (факты):** команду купили 2026-01-16. Cloudflare обещает, что Astro останется открытым и будет работать
  вне Cloudflare (https://thenewstack.io/cloudflare-acquires-team-behind-open-source-framework-astro/). В LICENSE
  репозитория MIT. В 7.3 есть Cloudflare-специфичный `finalize()`. CDN cache providers в 7.0 есть только для
  Netlify, Vercel и Cloudflare.
  **Мнение:** static-сборка от этого не зависит. Если Astro свернут, выход дешёвый: страницы уже собраны в HTML, а
  kit остаётся React. Риск касается будущего (функции «лучше на Workers»), а не текущего выбора.
- **Опция `landing-node`:** `@astrojs/node` 11.1.7 (`mode: 'standalone'`). Нужна только для Actions, live collections,
  CMS preview и редиректа по Accept-Language. Статику `_astro/*` и в этом режиме лучше отдавать через nginx.
- **Вердикт:** keep. Пересматривать альтернативы (Next static export, React Router prerender) причин нет: 05a их уже
  сравнивал, и с тех пор ничего не изменилось.

### 3. Роутер и i18n
- Файловый роутинг + `astro:i18n` (`prefixDefaultLocale: true`). Редирект `/` → `/ru/` в static-сборке делается
  meta-refresh, поэтому 301 настраиваем в nginx (это совпадает с 05a).
- **i18next 26.4.5 только на сервере:** на каждую страницу во frontmatter создаётся `i18next.cloneInstance({ lng })`.
  В острова передаём уже переведённые строки пропсами. `react-i18next` в островах не используем: React-контекст не
  проходит между островами, и тогда каждому острову пришлось бы инициализировать i18next и тянуть каталог (мнение,
  вытекает из факта про контекст: https://docs.astro.build/en/recipes/sharing-state-islands/). Каталоги и CI-проверки
  ключей общие с другими шаблонами.

### 4. Стили и kit в островах
- **Подключение (факт):** `vite.plugins: [tailwindcss()]`, peer `vite ^8` есть. Классы kit попадают в сборку только с
  явным `@source` на `packages/ui/src` (см. 13).
- **Дублирование CSS между островами (мнение, проверить smoke-сборкой):** Tailwind v4 генерирует **один** stylesheet
  из всех просканированных исходников. Если kit-компоненты не импортируют `.css`, а `theme.css` подключён один раз в
  `Layout.astro`, дублирования нет: острова несут только JS. Правило для lint: в `packages/ui` запрещены импорты
  `*.css`, кроме `styles/`. В `<style>` внутри `.astro` с `@apply` нужен `@reference "../styles/theme.css"`, но лучше
  не писать там стилей совсем: рецепты лежат в `Name.styles.ts`, а в `.astro` пишется `class={hero()}`.
- **tailwind-variants в `.astro`:** `tv()` выполняется на сервере во frontmatter, в клиент ничего не попадает.
  `eslint-plugin-better-tailwindcss` 4.9.1 по умолчанию распознаёт callee `tv` и поддерживает парсер `.astro`. В
  монорепо `settings['better-tailwindcss'].cwd` задаётся на каждый пакет (README плагина).
- **tailwind-merge и токены:** после сброса темы `text-fg` (цвет) и `text-label-md` (кегль) могут конфликтовать в
  merge (риск R6.4 из 13). Нужен `extendTailwindMerge` с classGroups из `packages/tokens`.
- **Base UI в островах без провайдеров (факты и мнение):**
  - Base UI не требует провайдеров. Quick start просит две вещи: `isolation: isolate` на корне приложения (иначе
    порталы перекрываются) и, для iOS 26+ Safari, `position: absolute` у backdrop плюс `body { position: relative }`
    (https://base-ui.com/react/overview/quick-start). В Astro корень — обёртка в `Layout.astro`, а не остров.
  - Ограничение Astro: в гидрируемый остров нельзя передать функции и React-элементы из `.astro`, только сериализуемые
    пропсы, а слот приходит готовым статическим HTML. Поэтому **Dialog.Root / Trigger / Popup собираются целиком в
    одном `.tsx`** (например, `LeadFormDialog.tsx`), а `.astro` монтирует его с `client:visible` или `client:idle`.
    `render`-проп Base UI работает только внутри `.tsx`.
  - Статичные kit-компоненты (Button-ссылка, Card, Badge) рендерятся без `client:*`, то есть 0 KB JS. Для простых
    аккордеонов и меню на лендинге по-прежнему советуем нативные `<details>` / `popover` (05a).
  - React-рантайм (~react-dom) загружается один раз на страницу, Vite выносит его в общий чанк. Каждый остров —
    отдельный React-root.

### 5. Состояние (без MobX)
- По умолчанию: пропсы с сервера и локальный `useState`/`useReducer` внутри острова. Глобального стора нет.
- Связь острова со статикой: DOM-события (`CustomEvent` на `document`) или атрибуты. Пример: кнопка CTA в `.astro`
  открывает форму-остров через `data-open-lead-form` и событие. Ноль зависимостей.
- Если **два и более острова делят живое состояние** (счётчик избранного в шапке и карточки, мультишаговая форма,
  разбитая на острова), берём `nanostores` 1.5.5 + `@nanostores/react` 2.0.1. Это официальная рекомендация Astro, весит
  <1 KB, работает и в `<script>` `.astro`. **Оправдан редко** (мнение): сначала сливаем острова в один. Правило: стор
  лежит в `src/stores/<name>.ts`, хранит только примитивы и actions, без бизнес-логики. В kit nanostores не попадает.
- Факт: `@nanostores/react` 2.0 требует Node `^22 || ^24 || >=26`, это совместимо.

### 6. Данные
- Content Layer (`src/content.config.ts`, `glob()`, Zod-схемы) + MDX. Внешняя CMS подключается loader'ом на билде,
  ребилд по webhook. Live collections только в `landing-node`. В 7.3.7/7.3.8 исправлены баги `glob()` (`deferRender` +
  `layout`, extglob в dev), так что ставим ≥ 7.3.8.

### 7. Формы и валидация
- Остров `client:visible`: RHF 7.90.0 + `@hookform/resolvers` 5.9.1 + Zod 4.6.7. Факт: RHF 8 в beta (8.0.0-beta.4), так
  что мажор в течение 12 месяцев вероятен. Пиним `^7` в catalog.
  **Мнение:** если схема лендинга написана руками, а не сгенерирована, `zod/mini` даёт меньший бандл острова. Это
  проверить замером, по умолчанию не включать (два стиля Zod в монорепо).
- Антиспам: honeypot + ALTCHA. Виджет `altcha` 3.3.0 — web component, грузить лениво при фокусе формы (мнение).
  Проверка `altcha-lib` 2.6.0 идёт **на сервере**: в static-режиме это делает внешний бэкенд (контракт в OpenAPI), в
  `landing-node` — Astro Action.
- Astro Actions (`accept: 'form'`) только при on-demand рендеринге, то есть только в `landing-node`. Факт: в 7.3.7
  исправлен `security.checkOrigin`, который блокировал cross-origin JSON-запросы.

### 8. Анимации и переходы экранов
- **Факты:**
  - MDN BCD `@view-transition`: Chrome 126, Safari 18.2, iOS Safari 18.2, Firefox и Firefox Android не поддерживают.
    Bugzilla 1860854 (meta, cross-document VT): статус NEW, Interop 2026, размер XL. Часть подзадач закрыта
    (`@view-transition`, `pagereveal`, `activeViewTransition`), открыты pageswap, render-blocking и `rel=expect`.
    Версия выхода не назначена.
  - iOS: по данным Apple на 2026-06-07, 79% совместимых iPhone на iOS 26 и 14% на iOS 18
    (https://www.macrumors.com/2026/06/09/ios-26-adoption-stats-wwdc/). Устройств без VT (iOS < 18.2) остаётся
    несколько процентов.
  - Astro docs: `<ClientRouter />` превращает сайт в SPA. Модульные скрипты выполняются один раз, setup нужно
    оборачивать в `astro:page-load`, для островов есть `transition:persist`. Fallback для браузеров без поддержки:
    `animate | swap | none`. Docs пишут, что компонент «will increasingly become unnecessary». **`security.csp` не
    поддерживает `<ClientRouter />`** (configuration reference).
- **Решение (мнение на основе фактов):**
  1. В `Layout.astro` (CSS) прописываем `@view-transition { navigation: auto; }` и анимации
     `::view-transition-old(root)` / `::view-transition-new(root)` на токенах `--duration-screen` (~240 мс, как в
     мастер-плане) и `--ease-standard`. Всё внутри `@media (prefers-reduced-motion: no-preference)`. JS: 0 KB.
  2. Fallback для Firefox и старых iOS: CSS fade-in `main` при загрузке. Включается классом, который ставит инлайн-скрипт
     в `<head>` (тот же, что ставит `data-theme`): `if (!('onpageswap' in window)) root.dataset.noVt = ''`. Экран
     плавно появляется, плавного ухода нет. Это приемлемая деградация. Нужна smoke-проверка, что эвристика `onpageswap`
     верна для Safari 18.2+.
  3. `<ClientRouter />` не используем: он ломает CSP-хэши, вводит SPA-семантику (переинициализация скриптов,
     аналитики, ALTCHA) и добавляет JS. Включать только если продукт потребует состояния острова, переживающего
     навигацию (аудиоплеер), и тогда CSP задаётся заголовком nginx.
  4. Внутри страницы (модалки, аккордеоны) работают CSS-переходы kit на `data-*`-состояниях Base UI (`data-starting-style`
     / `data-ending-style`).
- Опции init: GSAP 3.15.0 (остров, dynamic import) и Lenis 1.3.26 (выключен; Lenis 2.0 в dev). Motion в лендинг по
  умолчанию не тянем.

### 9. SEO
- `@astrojs/sitemap` 3.7.4 (с `i18n`), свой `<Seo>.astro`, `schema-dts` 2.1.0 (типы, 0 KB в рантайме).
- OG-картинки на билде: `satori` 0.57.2 даёт SVG, `sharp` 0.35.5 делает PNG. **`@resvg/resvg-js` не брать:** последний
  релиз 2.6.2 вышел 2024-03-26, 77 открытых issues (факт), а sharp уже стоит как зависимость `astro:assets`.
  satori выпустил 4 версии за 2026-10-14, поэтому пин exact. Альтернатива `astro-og-canvas` 0.13.2 (peer `astro ^7`),
  если JSX-шаблон не нужен.

### 10. Auth
- Нет. Правило для lint: в `apps/landing` запрещены импорты auth-SDK.

### 11. Тесты
- Vitest 5.0.4 через `getViteConfig()` из `astro/config`. `experimental_AstroContainer` для `.astro` (Container API
  по-прежнему experimental, факт), используем точечно.
- Playwright 1.64.1 + `@axe-core/playwright` 4.13.0 против `astro build && astro preview`, а лучше против собранного
  nginx-образа. Скриншоты только в Docker. В тесте переходов проверяем, что при `reducedMotion: 'reduce'` VT нет.
- **LHCI (факт):** `@lhci/cli` 0.15.1 жёстко зависит от `lighthouse` 12.6.1, а актуальный Lighthouse 13.5.0
  (2026-09-18). Последний релиз LHCI вышел 2025-06-25, последний push в репозиторий был 2026-03-27.
  **Мнение:** CWV-метрики LH 12 для бюджетов годятся, поэтому keep. План B, если до 2027-Q1 релиза не будет: Playwright
  + `lighthouse` 13 через Node API и свой assert бюджетов (~50 строк) либо `unlighthouse` 0.19.1 (1 мейнтейнер).

### 12. Наблюдаемость
- Umami v3.4.0 self-host, скрипт проксируется через nginx на своём домене.
- `@sentry/astro` 11.7.0 совместим с Astro 7 (peer). **Мнение:** на статическом лендинге по умолчанию выключено:
  ошибок мало, а клиентский SDK ложится на каждую страницу. Флаг init включает Sentry лениво (loader после `load`).
  В `landing-node` подключается серверная часть.

### 13. Сборка и образ
- Node: Astro требует ≥ 22.12, `eslint-plugin-astro` 3.2.1 требует `^24.16.0` для 24-й линии. Значит в `.nvmrc`
  Node 24 LTS ≥ 24.16.
- Образ: `nginxinc/nginx-unprivileged:1.30-alpine-slim@sha256:…` (stable 1.30.6, mainline 1.31.7 на 2026-10-14).
  Non-root, порт 8080. Образ `nginx:1.29-alpine` из 05a устарел.
- Предсжатие: после `astro build` скрипт на `node:zlib` (gzip + brotli, без зависимостей) создаёт `.gz` и `.br` для
  `html|css|js|svg|xml|json`. В официальном nginx есть `gzip_static on;`. **Brotli-модуля в официальном образе нет**
  (факт поиска: только сторонние сборки вроде `georgjung/nginx-brotli`). Мнение: по умолчанию отдаём только
  `gzip_static`, а `.br` генерируем на случай CDN или Caddy перед nginx. Сторонний образ с `ngx_brotli` не берём
  (supply chain). Пакеты `astro-compress` / `@playform/compress` (1 мейнтейнер) не нужны.
- Кэш: `/_astro/*` immutable, HTML `no-cache`. CSP: `security.csp` Astro (стабилен с 6.0) кладёт `<meta>` с хэшами,
  это совместимо со static и с нашим решением не брать `<ClientRouter />`.

### 14. Shared core (мой срез)
- Tailwind 4.3.3: последние релизы 4.3.0 (05-08), 4.3.1 (06-12), 4.3.2 (06-29), 4.3.3 (07-16). Vite 8 поддерживается
  с 4.2.2. В 4.2.0 `start-*`/`end-*` объявлены устаревшими в пользу `inset-s-*`/`inset-e-*`, это нужно добавить в
  `no-deprecated-classes`. Анонсов 4.4/5.0 не нашёл.
- `tailwind-variants` 3.x: в 3.0.0 (2025-08-24) появилась `tailwind-variants/lite` без merge. В 3.2.0 появились `cx`,
  `cn` начал использовать tailwind-merge, `responsiveVariants` удалён. 3.3.1 исправил общее состояние slots (#305).
  Peer `tailwind-merge >=3`.
- `@base-ui/react` 1.9.0: зависимости `@base-ui/utils` 0.5.0 и `@floating-ui/*`. `date-fns` — опциональный peer (для
  date-компонентов). В 1.9.0 у Autocomplete/Combobox изменился автоматический unmount.
- `lucide-react` 1.x: бренд-иконки удалены, `aria-hidden` по умолчанию, контекст-провайдер дефолтов (в kit не
  используем: острова не делят контекст). `sideEffects: false`, тришейкинг работает.
  Альтернативы проверены: `@tabler/icons-react` 3.49 (жив, но ломал SSR в xRocket), `@phosphor-icons/react` 2.1.10
  (последний релиз 2025-05), `react-icons` 5.7 (сборник, тяжёлый), `@iconify/react` 6.0.2 (2025-09, рантайм-загрузка
  по сети, не для CSP). Замены не нужно.

## Recommendations for the boilerplate

1. **Оставить** Astro 7.3.8 / `@astrojs/react` 7.0.1 / `@astrojs/mdx` 8.0.3 / `@astrojs/sitemap` 3.7.4, `output: 'static'`.
   Пин в catalog. Отдельной задачей в плане держать «миграцию на Astro 8» на 2027 год.
2. **Переходы экранов в landing/blog:** нативный cross-document VT + fade-in fallback по флагу из инлайн-скрипта.
   `ScreenTransition` из kit для Astro-шаблонов не применяется. В `docs/` прямо записать: «`<ClientRouter />` запрещён
   без согласования (CSP, SPA-семантика)».
3. **Kit-правила для островов** (добавить в lint и docs): нет `*.css`-импортов в компонентах; compound Base UI только
   внутри одного `.tsx`-острова; `isolation: isolate` + `body { position: relative }` в layout; `client:visible` /
   `client:idle` по умолчанию, `client:load` по исключению.
4. **Иконки:** `lucide-react` + `simple-icons` для брендов (компонент `BrandIcon.astro`, SVG inline).
5. **Состояние:** без стора. nanostores только по правилу «≥ 2 острова делят живое состояние и слить нельзя».
6. **OG:** satori + sharp. `@resvg/resvg-js` убрать из рекомендаций.
7. **Образ:** `nginxinc/nginx-unprivileged:1.30-alpine-slim` по digest, `gzip_static`, предсжатие скриптом на
   `node:zlib`.
8. **Node 24 ≥ 24.16** (из-за `eslint-plugin-astro`). **TS 7 заблокирован** до выхода `@astrojs/check` с peer `^7`. Это
   нужно передать агенту ядра (TS).
9. **Наблюдать:** LHCI (lighthouse 12.6.1), `vanilla-cookieconsent` (2025-02), RHF 8, Lenis 2, Astro 7.4/8, Firefox
   cross-document VT (после выхода fallback можно упростить).
10. Sentry в landing выключен по умолчанию, это флаг init.

### Что поменялось относительно мастер-плана
- §3.1 «UI kit / ScreenTransition без View Transitions API из-за iOS < 18»: для Astro-шаблонов заменить на нативный
  cross-document VT (Chrome 126+, Safari/iOS 18.2+) + CSS fade-in fallback. `<ClientRouter />` не брать (CSP).
- §3.2 «Образ nginx static»: уточнить до `nginx-unprivileged:1.30-alpine-slim` + gzip_static; brotli только предсжатием.
- Иконки: к `lucide-react` добавить `simple-icons` (в lucide v1 нет бренд-иконок).
- OG: satori + sharp вместо resvg-js. Node ≥ 24.16; TS 7 блокируется `@astrojs/check`.
- Состояние landing: явно «без стора; nanostores по правилу», а не MobX (по решению пользователя).

## Open questions for the user
1. Устраивает ли деградация переходов в Firefox и на iOS < 18.2 (плавное появление новой страницы без анимации
   ухода)? Альтернатива — `<ClientRouter />` ценой CSP через заголовок и SPA-семантики.
2. Brotli нужен на уровне nginx? Это означает сторонний образ или модуль, а по умолчанию только gzip.
