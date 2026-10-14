# 05. Шаблоны и технологии
Status: done
Updated: 2026-10-14 15:40

## Resume notes
- Done: все разделы. Саб-агенты завершены: 05a-landing.md, 05b-shop.md, 05c-tma.md, 05d-admin.md, 05e-game.md (все Status: done).
- Next: ничего. При пересмотре решений пользователем обновить разделы 1, 4, 5.
- Sub-agent: 5 файлов выше, done. Версии пакетов в них сняты из npm registry 2026-10-14.

## Summary (≤ 15 lines)
1. Шаблонов пять: `landing`, `shop`, `tma`, `admin`, `game`. Блог/docs, PWA, i18n, аналитика, TON Connect, BFF — опции init, а не шаблоны.
2. Все шаблоны на React 19.3 + TypeScript + Tailwind 4.3 + общий kit (shadcn-подход на Base UI) + CSS-токены. Это единственное, что делает общий UI возможным.
3. Рендеринг расходится по делу: `landing` = Astro 7 static (React-острова); `shop` = Next.js 16.4 App Router (SSR/Cache Components, Node standalone); `tma`, `admin`, `game` = Vite 8 SPA, nginx static.
4. Сборщик: Vite 8 у четырёх шаблонов (Astro 7 тоже на Vite 8), Turbopack только у `shop`. Это главная точка расхождения тулинга.
5. Общее ядро: pnpm workspaces + catalog, Turborepo, ESLint flat + Prettier, Vitest 5, Playwright 1.64, Storybook 10 (в пакете kit), Zustand 5, TanStack Query 5, Hey API (`@hey-api/openapi-ts`) для клиентов из OpenAPI, React Hook Form + Zod 4, i18next.
6. Важный факт: `openapi-fetch` / `openapi-react-query` (стек xRocket) с 2025-12-29 в maintenance mode. Новый стандарт: Hey API (альтернатива Orval).
7. MobX MVVM + tsyringe по умолчанию не берём. Состояние: серверное → Query, URL → роутер, остальное → Zustand + хуки как view model. Правило «логика вне view» остаётся.
8. Telegram SDK: `@tma.js/sdk-react` 3 (не `@twa-dev/sdk`, он застрял на Bot API 8.0) только внутри `packages/telegram-platform`, общего для `tma` и `game`.
9. Игра: Phaser 4.2 + React-оверлей из kit, чистый TS-слой `logic/`. R3F (3D) только опция: peer `react <19.4` тормозит React всего монорепо.
10. Правила kit для совместимости: никаких `next/*` и `astro:*`, `'use client'` в каждом интерактивном файле, только stable React API, `Link`/`Image` передаются через `render`/слоты, работа без обязательных провайдеров, анимации kit на CSS.
11. Docker: два target — `static` (nginx + runtime `env.js`) для tma/admin/game/landing и `node` для shop (и опционально landing hybrid / admin BFF).
12. Главные риски совместимости: vendored canary React внутри Next; Tailwind через Vite-плагин и через PostCSS в Next; i18n (next-intl против i18next); контекст не переходит между Astro-островами; `minimumReleaseAge` блокирует свежие релизы при «обновить зависимости» в init.
13. Ключевые решения за пользователем: два meta-framework (Astro + Next) или один; отказ от MobX; Hey API или Orval; i18next везде или next-intl в shop; React Compiler.

## 1. Итоговый список шаблонов (для агента 06, init-скрипт)

| id | Шаблон | Что покрывает | Рендеринг / рантайм в проде | Docker target |
| --- | --- | --- | --- | --- |
| `landing` | Лендинг / контентный сайт | промо, маркетинг, блог, docs | Astro 7 `output: 'static'` (опция: `@astrojs/node` hybrid) | `static` (опция `node`) |
| `shop` | Магазин (storefront) | headless commerce: каталог, поиск, корзина, чекаут через провайдера, аккаунт | Next.js 16.4 App Router, `output: 'standalone'` | `node` |
| `tma` | Telegram Mini App | SPA внутри Telegram, Stars, TON Connect (опция) | Vite 8 SPA | `static` |
| `admin` | Админка / дашборд / SaaS-кабинет | SPA за логином: таблицы, формы, графики, RBAC, real-time | Vite 8 SPA (опция: Node BFF) | `static` (+ опция `bff`) |
| `game` | Веб-игра | 2D casual/idle/puzzle, в браузере и как TMA | Vite 8 + Phaser 4 + React-оверлей | `static` |

Опции init (флаги, а не шаблоны). Каждая удаляется вместе с кодом, пакетами, доками и правилами, если не выбрана:

| Опция | К каким шаблонам | Что добавляет |
| --- | --- | --- |
| `content-cms` | landing | loader внешней CMS (Strapi MIT / Directus BSL), по умолчанию только MDX в репо |
| `docs` | landing | Starlight 0.42 (Astro) |
| `landing-node` | landing | `@astrojs/node` 11: Actions, прокси формы, preview CMS |
| `gsap` / `lenis` | landing, game | GSAP 3.15 (полностью бесплатен с 2025), Lenis 1.3 (по умолчанию выкл., риск для INP) |
| `pwa` | admin, game (web-сборка), landing | `vite-plugin-pwa` 2.0. В `tma` не предлагать: в iOS WKWebView SW недоступен |
| `ton-connect` | tma, game | `@tonconnect/ui-react` 5.0.1, ленивый чанк (~160 KB gz) |
| `tg-analytics` | tma, game | `@telegram-apps/analytics` 1.6.4, ленивый (~145 KB gz); обязательность для каталога не подтверждена |
| `bff` | admin | Node BFF (Hono/Fastify), OIDC-токены в httpOnly cookie |
| `search` | shop | Meilisearch-адаптер (по умолчанию поиск провайдера) |
| `commerce-shopify` | shop | второй адаптер (эталон: Medusa v2; Shopify не работает в РФ) |
| `game-3d` | game | three + R3F 9.8 + drei 10.7 (ставит потолок `react <19.4` на весь монорепо) |
| `analytics` | все веб | общий слой событий; провайдеры Umami (по умолчанию) / GA4 / Метрика / PostHog + consent |

Зависимости между выборами для init:
- `tma` и `game` вместе → общий `packages/telegram-platform` остаётся; без обоих удаляется.
- `shop` не выбран → удаляются Turbopack-специфика, `@next/eslint-plugin-next`, Node target (если не выбраны `landing-node`/`bff`), Redis cache handler.
- `landing` не выбран → удаляются `eslint-plugin-astro`, `prettier-plugin-astro`, `astro check` из `check`.
- Ни одного SSR-шаблона → в kit можно не держать проверку `'use client'` (правило остаётся безвредным, лучше оставить).

## 2. Почему именно этот список

| Кандидат | Решение | Почему |
| --- | --- | --- |
| Лендинг | **шаблон** | Отдельный профиль: SSG, SEO, CWV, ноль JS по умолчанию. Ни один SPA-стек это не даёт. |
| Блог / docs / контент | **в `landing`** | Тот же стек (Astro Content Layer + MDX, Starlight для docs). Отдельный шаблон дублировал бы 90% кода. |
| Магазин | **шаблон** | Уникальное: SSR/ISR каталога, кэш с ревалидацией по вебхукам, адаптер commerce-провайдера, чекаут, multi-currency. |
| TMA | **шаблон** | Уникальное: SDK, theme bridge, back/main button, initData-auth, Stars, отсутствие SSR и PWA. Исторически основной продукт пользователя. |
| Админка | **шаблон** | Уникальное: OIDC, RBAC, таблицы с серверной пагинацией, сложные формы, графики, real-time. |
| SaaS-кабинет | **в `admin`** | Тот же профиль (SPA за логином). Отличия (онбординг, биллинг-страницы) это экраны, не стек. BFF включается опцией. |
| Веб-игры | **шаблон** | Другой рантайм (canvas/WebGL, game loop, ассеты, аудио). Нужен даже в монорепо с TMA: игры в Telegram это массовый сценарий. |
| PWA | **опция** | Свойство сборки, а не тип приложения. В TMA вредна или бесполезна (iOS WKWebView). |

Пять шаблонов, а не шесть: шестой кандидат (контент/docs) не даёт нового стека. Если пользователь захочет SSR-сайт с личным кабинетом, это `shop` без commerce или `landing-node`, а не новый шаблон.

## 3. Приоритеты по шаблонам

Обозначения: **К** = критично, **В** = важно, **О** = опционально, **—** = можно пожертвовать.

| Критерий | landing | shop | tma | admin | game |
| --- | --- | --- | --- | --- | --- |
| SSR / SSG | К (SSG) | К (SSR + кэш) | — (launch params в URL hash, серверу не видны) | — | — |
| SEO | К | К (каталог, PDP, JSON-LD) | — | — (noindex) | О (только страница-витрина) |
| Скорость загрузки / CWV | К (LCP, CLS) | К (LCP, INP на PLP) | К (cold start в webview, initial JS ~150 KB gz) | В | В (ассеты, прогресс загрузки) |
| Плавные анимации | В (scroll, View Transitions) | О (микро) | В (переходы, жесты, нативность) | — (сдержанно) | К (60 fps) |
| Offline / PWA | — | — | — (нельзя на iOS) | О | О (кэш ассетов в веб-сборке) |
| Real-time | — | — | О | В (WS/SSE) | В (если мультиплеер) |
| Размер бандла | К | В | К | — (в разумных пределах) | В (Phaser ~358 KB gz, не дробится) |
| Доступность (a11y) | К | К | В | К (клавиатура, таблицы) | О (обязательны: DOM-оверлей, mute, reduced-motion, пауза) |
| i18n | К (локализованные маршруты) | К (+ валюта) | В (язык из Telegram) | В | О (только оверлей) |
| Формы | В (лид-форма, антиспам) | К (чекаут, аккаунт) | В | К (сложные, wizard) | — |
| Таблицы | — | — | О | К | — |
| Платежи | — | К (через провайдера) | В (Stars, TON) | — | В (Stars) |
| Auth | — | В (аккаунт покупателя) | К (initData) | К (OIDC, RBAC) | В (Telegram / веб) |

Чем жертвуем осознанно: в `game` нет SSR, SEO и роутера (экранная state-machine); в `shop` нет игровой анимации и offline; в `admin` нет SSR и тонкой оптимизации бандла; в `tma` нет SSR и PWA; в `landing` нет тяжёлого клиентского состояния и data grid.

## 4. Стек по шаблонам

Версии из отчётов 05a–05e, сняты с npm 2026-10-14. Детали, источники и альтернативы в файлах саб-агентов.

| Слой | landing | shop | tma | admin | game |
| --- | --- | --- | --- | --- | --- |
| Фреймворк | Astro 7.3 + `@astrojs/react` 7 | Next.js 16.4 App Router, Cache Components | Vite 8.3 + React 19.3 | Vite 8.3 + React 19.3 | Vite 8.3 + React 19.3 + Phaser 4.2.1 |
| Рендеринг | static (опц. hybrid node) | SSR + `'use cache'`/`cacheTag`, `ensureStatic` для SEO-страниц | CSR | CSR | CSR (canvas) |
| Роутинг | файловый Astro, `astro:i18n` | App Router, `nuqs` 2.10 для фильтров | TanStack Router + хук BackButton | TanStack Router (file-based, `validateSearch` + Zod) | нет, экранная state-machine |
| UI | kit-острова + `.astro` страницы | kit + RSC-страницы | kit + theme bridge `--tg-theme-*` → токены | kit + data-table | kit-оверлей; canvas-цвета из `tokens.ts` |
| Данные | build-time fetch / Content Layer | RSC через `CommerceProvider` (Medusa v2), Query для мини-корзины | Query + Hey API, `Authorization: tma <initDataRaw>` | Query + Hey API, interceptors, error mapping | `zustand/vanilla` + шина; API через Hey API |
| Клиентское состояние | нет (острова) | минимум (Zustand) | Zustand | Zustand + URL | `zustand/vanilla` |
| Формы | RHF 7.90 + Zod 4, honeypot + ALTCHA | RHF + Zod 4, Server Actions | RHF + Zod 4 | RHF + Zod 4 (схемы из генератора) | — |
| Анимации | CSS, View Transitions, scroll-driven (`@supports`); GSAP опция | Motion 14 (`LazyMotion`), `<ViewTransition>` | View Transitions, Motion `LazyMotion`, Vaul | CSS | Phaser tweens/particles; GSAP опция |
| Специфика | Content Layer + MDX, sitemap, JSON-LD (`schema-dts`), OG через satori | `CommerceProvider` + mock-адаптер, Redis cache handler при >1 поде | `@tma.js/sdk-react` 3.0.23, Stars через `createInvoiceLink`, `mockTelegramEnv` | TanStack Table v9 + Virtual 3, Recharts 3 (ECharts 6 опция), `oidc-client-ts` 3.5 + `react-oidc-context` | Phaser 4 (Arcade/Matter), слой `logic/` без движка, сейвы DeviceStorage/IndexedDB |
| i18n | i18next 26 (`t()` в `.astro`) | см. риск 5 (next-intl 4.14 или i18next) | i18next, язык из Telegram | i18next | i18next в оверлее |
| Аналитика | Umami 3.4 self-hosted | GA4-схема e-commerce событий + consent | Sentry, `tg-analytics` опция | Sentry | события в общий слой |
| Тесты | Vitest, Playwright screenshots, Lighthouse CI | Vitest, Playwright против `COMMERCE_PROVIDER=mock` | Vitest, Playwright с mock Telegram | Vitest, MSW 3, Playwright, Storybook | Vitest для `logic/`, Playwright smoke canvas |
| Docker | nginx static | Node standalone | nginx static | nginx static (+ BFF) | nginx static, precompressed br/gz |

## 5. Общее ядро (все шаблоны, один монорепо)

| Слой | Решение | Обоснование / риск |
| --- | --- | --- |
| Язык | TypeScript strict, один `tsconfig.base.json` | Мажор (TS 6 / 7 native) зафиксировать при реализации; MSW 3 требует TS ≥ 5.9 (05d) |
| Node | одна версия в `.nvmrc`, `engines`, Docker base (Node 24 LTS) | MSW 3, Orval 8, React Router 8 требуют Node 22+; прошлый проект расходился 22 против 24 (docs/tooling.md) |
| Пакетный менеджер | pnpm (актуальный мажор) с `catalog:` для общих версий, `minimumReleaseAge` | catalog = одна версия React/TS/Vitest во всех apps |
| Монорепо-оркестратор | Turborepo (мнение) | Нужны только граф задач и кэш; Nx в xRocket давал проблемы (`nx reset`, выключенные правила), и его генераторы не используются. Решение может пересмотреть агент тулинга |
| Lint / format | ESLint flat config + typescript-eslint + Prettier (конфиг из docs/tooling.md) | Кастомные правила пользователя требуют ESLint. Плагины по шаблону: `@next/eslint-plugin-next`, `eslint-plugin-astro`, `prettier-plugin-astro` |
| Тесты | Vitest 5 (`projects`), Testing Library 16, MSW 3, Playwright 1.64 (скриншоты только в Docker) | Совместимость `@storybook/addon-vitest` с Vitest 5 официально не подтверждена (05d) |
| Каталог компонентов | Storybook 10 в `packages/ui` | Один Storybook на kit, не на приложение |
| UI kit | `packages/ui`: shadcn-подход (код в репо) на Base UI (`@base-ui/react` 1.9, дефолт shadcn с июля 2026) + Tailwind 4.3 | Radix тоже поддерживается shadcn, но в kit только один примитив-слой. Mantine/AntD/MUI/telegram-ui исключены: второй дизайн-язык |
| Токены | `packages/tokens`: CSS-переменные (light/dark), генерация `tokens.ts` для canvas | Tailwind 4 читает токены через `@theme`; TMA мапит `--tg-theme-*` на семантические токены |
| Иконки | `lucide-react` (выбор пользователя) | Tabler ломал SSR в xRocket |
| API | `packages/api`: Hey API (`@hey-api/openapi-ts` 0.99, exact pin) → типы, SDK, `queryOptions`, Zod-схемы; общий слой маппинга ошибок | `openapi-fetch`/`openapi-react-query` в maintenance mode (discussion openapi-typescript #2559). Hey API до 1.0, отсюда exact pin. Альтернатива Orval 8 (лучше моки MSW+faker) |
| Серверный кэш | TanStack Query 5 | В shop только для клиентского интерактива |
| Клиентское состояние | Zustand 5; view model = хук | Отказ от MobX MVVM требует правки docs/architecture.md и части кастомных ESLint-правил |
| Формы | React Hook Form 7 + Zod 4 + `@hookform/resolvers`; ESLint-запрет `watch()` в пользу `useWatch` | landing, shop, tma уже выбрали RHF; admin колебался. RHF `watch` несовместим с React Compiler, TanStack Form тоже имеет непроверенные сообщения о проблемах. Оба готовят мажор (RHF 8 beta, TanStack Form 2 alpha) |
| i18n | i18next 26 + react-i18next 17, общие JSON-каталоги в `packages/i18n`, проверка плюралей ru | См. риск 5 про shop |
| Telegram | `packages/telegram-platform`: `@tma.js/sdk-react` 3, единственное место импорта SDK | Один мейнтейнер, уже был rename scope с breaking API; изоляция в адаптере смягчает |
| Аналитика | `packages/analytics`: схема событий + провайдеры + consent | Провайдер выбирается в init |
| Docker | один multi-stage Dockerfile: `static` (nginx, SPA fallback, `env.js` при старте, immutable для хешированных ассетов, `no-cache` для `index.html`) и `node` (Next standalone / Astro node / BFF) | `turbo prune` или `pnpm deploy` для контекста сборки |

Структура:

```
apps/        landing  shop  tma  admin  game          (init удаляет невыбранные)
packages/    ui  tokens  api  i18n  analytics  telegram-platform  config (eslint, tsconfig)
tools/       init (Node .mjs), eslint-rules, scripts
docker/      Dockerfile (targets static | node), nginx.conf, env.sh
```

## 6. Где шаблоны обязаны расходиться

| Что | Почему нельзя унифицировать |
| --- | --- |
| Мета-фреймворк (Astro / Next / Vite SPA) | Требования к рендерингу противоположны: 0 JS и SSG у лендинга, SSR + кэш у магазина, чистый CSR у TMA/админки/игры. Next для всех даёт лишний рантайм в SPA; Vite SPA для всех убивает SEO магазина |
| Роутер | Astro и Next имеют свой файловый роутинг; TanStack Router только в Vite-SPA; в игре роутера нет |
| Картинки | `astro:assets` и `next/image` живут только в страницах своего фреймворка; в kit картинка приходит пропсом или слотом |
| Получение данных | RSC + `'use cache'` в shop; Query в SPA; build-time в landing |
| Сборщик и подключение Tailwind | `@tailwindcss/vite` в Vite/Astro, `@tailwindcss/postcss` в Next (Turbopack). Kit как source-пакет: в Next `transpilePackages`, `@source` на `packages/ui` везде |
| Auth | нет (landing), customer account провайдера (shop), initData (tma), OIDC PKCE / BFF (admin), Telegram или веб (game) |
| Анимационный движок | CSS/View Transitions в веб-шаблонах, движок Phaser в игре |
| Docker target | nginx static против Node |

## 7. Риски совместимости при нескольких шаблонах в одном монорепо

1. **Одна версия React.** `react@19.3.x` в pnpm catalog. Next App Router рендерит vendored `19.3.0-canary-…` внутри `next`, а не установленный React (05b). Фича canary может работать в shop и падать в Vite-шаблонах. Правило: kit только на stable API, тесты kit гоняются на установленном React.
2. **Потолки peer-зависимостей.** R3F 9.8: `react >=19 <19.4` (05e). `@telegram-apps/telegram-ui`: `react ^18.2` (отклонён). Init должен проверять peer-конфликты выбранного набора; `game-3d` помечать как ограничивающую опцию.
3. **Kit в трёх средах (RSC, Astro-острова, SPA).** Правила kit, проверяемые линтом:
   - запрет импортов `next/*`, `astro:*`, `@tma.js/*`, `phaser` в `packages/ui`;
   - `'use client'` в каждом интерактивном файле (иначе RSC падает в shop);
   - никакого `window`/`document` на уровне модуля (SSR);
   - `Link`/`Image` через `render`-проп Base UI или слот, а не импорт;
   - нет обязательных контекст-провайдеров: React-контекст не переходит между Astro-островами (05a); тема только через CSS-переменные и `data-theme`, i18n строками в пропсах.
4. **Анимации внутри kit.** Если компоненты kit зависят от Motion, каждый Astro-остров и SPA тянут его. Рекомендация: kit на CSS transitions + data-атрибутах состояний Base UI, Motion только на уровне приложений.
5. **i18n в shop.** Агент shop рекомендует `next-intl` 4.14 (лучшая интеграция с RSC и кэш-ключами), остальные шаблоны i18next. Два формата каталогов (ICU против i18next) ломают общий пакет `packages/i18n` и проверку плюралей. Рекомендация (мнение): i18next везде, в shop серверный инстанс на запрос с передачей ресурсов клиентскому провайдеру; next-intl только если пользователь примет два формата. Открытый вопрос.
6. **Два стека Tailwind-подключения** (Vite-плагин и PostCSS): общая `globals.css` с `@import "tailwindcss"`, `@theme` из `packages/tokens` и `@source` на kit. Проверить, что классы kit не теряются при tree-shaking в обоих.
7. **ESLint по приложениям.** Правило из docs/tooling.md: правила вложенного пакета не применяются при запуске из корня. Каждый app получает свой `eslint.config` из `packages/config` + плагины своего фреймворка.
8. **Сборка env.** SPA получают env при старте контейнера через `env.js`. Next инлайнит `NEXT_PUBLIC_*` при сборке, Astro `site` нужен при сборке для canonical/OG. Значит для landing и shop образ собирается на окружение (или серверный runtime-конфиг). Принцип «один образ на все окружения» в docs/tooling.md выполним только для SPA.
9. **Next в нескольких подах.** `revalidateTag` чистит кэш только своего инстанса: нужны Redis `cacheHandler` + `cacheHandlers`, общий `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, единый `deploymentId` (05b). По умолчанию один под без Redis, Redis опцией.
10. **Игра внутри TMA.** Phaser (~358 KB gz, не дробится) не должен попасть в бандл `tma`: игра собирается отдельным app или ленивым маршрутом. Общий только `telegram-platform`.
11. **`minimumReleaseAge` и «обновить зависимости» в init.** Свежие релизы (пример: TON Connect 5.0.1 от 11.10.2026) блокируются 7-дневным порогом. Init обновляет в пределах порога, а мажоры фиксирует catalog.
12. **Ожидаемые мажоры в течение года:** RHF 8, TanStack Form 2, Hey API 1.0, React Router 9 (не используется). Версии пинить через catalog, обновлять одним PR на монорепо.
13. **Две Docker-ветки** (nginx и Node): health checks и заголовки (CSP, кэш `index.html`, отсутствие `X-Frame-Options: DENY` для TMA, Permissions-Policy) вынести в общий nginx-конфиг с include по шаблону.

## 8. Исправления к существующим docs (найдены саб-агентами, не правились)

- docs/library-notes.md, TMA: лимит `startapp` 512 символов, а не 64 (64 это `start` у бота) (05c).
- docs/library-notes.md: `@twa-dev/sdk` устарел (Bot API 8.0); имена CSS-переменных safe area зависят от SDK (05c).
- docs/library-notes.md, TanStack Query: раздел про `openapi-fetch`/`openapi-react-query` (их ключ `['<method>','<path>']`) устареет при переходе на Hey API.
- docs/architecture.md: MobX MVVM как стандарт противоречит рекомендации Zustand + хуки (05c, 05d).

## Recommendations for the boilerplate

1. **Зафиксировать список из 5 шаблонов и опций (раздел 1)** как контракт для init-скрипта (агент 06).
2. **Первым строить общее ядро**: `packages/tokens`, `packages/ui` (Base UI + Tailwind 4.3, правила kit из риска 3 как ESLint), `packages/api` (Hey API + маппинг ошибок), `packages/i18n`, `packages/config`. Без него шаблоны разъедутся.
3. **Порядок шаблонов по сложности и ценности:** `tma` и `admin` (оба Vite SPA, проще всего, ближе всего к опыту пользователя) → `game` (тот же Vite + `telegram-platform`) → `landing` (Astro) → `shop` (Next, самый тяжёлый по инфраструктуре).
4. **Брать:** `@tma.js/sdk-react` 3 вместо `@twa-dev/sdk`; Hey API вместо `openapi-fetch`; TanStack Router в SPA; TanStack Table v9; Phaser 4 с чистым `logic/`; Medusa v2 как эталонный commerce-адаптер + mock-адаптер; Umami как аналитика по умолчанию.
5. **Не брать:** React Admin / Refine (ломают kit или data layer), `@telegram-apps/telegram-ui`, Mantine/AntD/MUI, Better Auth (это свой auth-сервер), токены в `localStorage` в admin, `log.js` из официального шаблона Phaser (телеметрия на gryzor.co), PWA в TMA, R3F по умолчанию.
6. **Двойной SSR-стек (Astro + Next) считать допустимым** только если оба шаблона реально нужны. Если пользователь хочет один SSR-фреймворк, лендинг переезжает на Next ценой JS по умолчанию.
7. **Каждую рекомендацию с пометкой «не проверено» в 05a–05e проверить smoke-сборкой** при создании шаблона (размеры бандлов, Tailwind в Next+kit, Storybook + Vitest 5, Hey API + Medusa spec).

## Open questions for the user

1. Допустимы ли в одном монорепо два meta-framework (Astro для `landing`, Next для `shop`), или нужен один SSR-стек (тогда лендинг на Next)?
2. Отказываемся ли от MobX MVVM + tsyringe в пользу Zustand + хуков как view model во всех шаблонах? От этого зависят docs/architecture.md и часть кастомных ESLint-правил.
3. API-клиент для всего монорепо: Hey API (рекомендация) или Orval?
4. i18n: i18next во всех шаблонах (рекомендация), или next-intl в `shop` с другим форматом каталогов?
5. Включаем ли React Compiler по умолчанию? Влияет на формы (RHF `watch`) и правила линта.
6. Целевой рынок `shop`: РФ/СНГ (Medusa + ЮKassa, Метрика), международный (Shopify/Stripe, GA4) или оба?
7. Игра: только 2D (Phaser) или нужна 3D-опция, которая ставит потолок версии React на весь монорепо?
8. TMA и игра должны работать и как обычный сайт вне Telegram (вторая схема авторизации), или браузер только для разработки?
9. Один Docker-образ на все окружения обязателен (тогда landing/shop требуют runtime-конфиг), или для SSR-шаблонов допустим образ на окружение?
