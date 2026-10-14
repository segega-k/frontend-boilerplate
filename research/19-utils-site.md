# 19. Utils-сайт проекта и решение по Storybook
Status: done
Updated: 2026-10-15

## Resume notes
- Done: все разделы. Изучены xrocket-tools-master (весь код tools/tools-api, деплой), генератор и потребитель маппинга в
  xrocket-front, i18n xRocket (all/en/ru/zh, sync-i18n, Crowdin, проверки), Storybook xRocket (конфиг, история фиксов,
  покрытие), npm-реестр и доки Storybook 10.6 (MCP, peers). Решение и дизайн записаны, правки мастер-плана в конце.
- Next: ничего.
- Sub-agent: не использовался.

## Summary (≤ 15 lines)
1. **xrocket-tools** = Strapi 5.36 (Postgres) + react-admin 5.14/MUI SPA, NX, werf/helm на внутреннем ingress. Синкает
   Swagger раз в сутки, хранит `endpoint × status × error_type → notif_type/severity/support + texts_ru/en[]`, отдаёт
   готовый `<svc>.generated.ts` по `GET /swagger-endpoints/:id/export-ts`; фронт тянет его `pnpm xrocket-tools:<svc>`.
   Хорошо: алгоритм синка (oneOf/discriminator, миграционный fallback, soft delete, `change_status`), формат variants
   `METHOD_STATUS_type` + синтетические `ERR/NET/2xx`, типовая проверка `satisfies EndpointResponseMapping<VariantsOf<…>>`,
   рабочая страница-таблица с фильтрами «нет перевода», bulk-заполнение, аудит-лог. Плохо: источник истины вне репо
   (БД), второй словарь переводов мимо i18next и Crowdin (zh выключен), ключи из английского текста, ручные правки
   «AUTO-GENERATED» файла (`3d8e3fa82`), N+1 в экспорте, JWT в localStorage, пароль по умолчанию в скрипте.
2. **Решение по каталогу: гибрид, Storybook главный.** Один Storybook 10.6 (`@storybook/react-vite`) в `packages/ui` с
   `addon-vitest`, `addon-a11y`, `addon-mcp`; stories app-уровневых презентационных компонентов Vite-шаблонов
   подключаются тем же glob. Свой галерейный движок не пишем. Utils-сайт показывает каталог через встроенный
   Storybook (вкладка Catalog) и галерею экранов из VRT-снимков. 27 из 27 «Fix SB» в xRocket за год вызваны
   Tamagui/RNW/DI/Vite-8, в нашем стеке их нет; цена — ~7 devDeps и один конфиг.
3. **Utils-сайт:** `apps/utils` (Vite SPA на kit + маленький Hono-сервер), по умолчанию только локально на
   `127.0.0.1` с токеном; пишет файлы в репо (маппинг ошибок JSON, i18n-каталоги `all/`), дальше git diff и PR как
   обычно. Вкладки: Errors (редактор маппинга + OpenAPI-диф), Texts (i18n-редактор с missing, plural, плейсхолдерами),
   Catalog, Screens, Tokens. Тексты ошибок живут в i18n-неймспейсе `errors`, один словарь на всё.
4. Код xrocket-tools переносится как логика (синк, группировка, I18nParams, UI-идеи), не как стек (без Strapi,
   react-admin, MUI, NX). Деплой utils — опция `utils-deploy` в волне 3 (OIDC + внутренний ingress, правки только
   через PR).
5. Шаг 1 AI-дизайн-процесса = каталог компонентов: инвентарь → stories (States/Combinations/Edge/Matrix/Playground)
   → утверждение пользователем → только потом экраны; `catalog:coverage` в гейте.

## Findings

### 1. xrocket-tools-master: что это (проверено по коду)

**Структура и стек.** NX 22.6 (в CLAUDE.md написано «NX 20» — дока устарела), pnpm 10.11, 2 приложения, ~8.8k строк
своего кода (из них 1197 — сгенерированные типы Strapi):

| Часть | Стек | Размер |
| --- | --- | --- |
| `apps/tools-api` | Strapi 5.36.1, `pg` или `better-sqlite3`, `undici` ProxyAgent, cron в Strapi, Vitest 3 (1 тест-файл, 392 строки на export-ts) | 2 сервиса: `swagger-endpoint.ts` (767 строк синка), `export-ts.ts` (562) |
| `apps/tools` | Vite 7 + React 19 + react-admin 5.14 + MUI 7 + RHF + zod 4, FSD | главная страница `SwaggerOverview.tsx` (365) + таблица, фильтры, EditModal (343), BulkEditModal, SchemaViewer, Dashboard, ConfigChangeLogList |
| Деплой | Dockerfile на приложение (tools → nginx + `env.sh`; api → Node `strapi start`), werf + helm, GitLab CI из чужого `infra/pipeline`, ingress `nginx-internal`, хосты `tools.xrocket.exchange`, `tools.st.xrocket.exchange` | 2 окружения main/st |

**Модель данных (Strapi content types).**

| Тип | Поля |
| --- | --- |
| `swagger-endpoint` | name, `json_url`, `doc_url`, `slug` (uid) |
| `endpoint-group` | name (тег Swagger) → swagger-endpoint |
| `endpoint` | path, method, `operation_id`, summary, `enum_config` (json) → group |
| `endpoint-response` | `status_code` (строка: `'400'` или синтетика `ERR`/`NET`), `error_type` (`/api/problems/x`), `ts_type`, `response_example`, `response_schema`, `change_status` (`unchanged/new/modified/deleted`), `notification_dismissed` |
| `notification-config` (1:1 к response) | `notif_type` (`toast/modal/custom/silent`), `severity` (`error/warning/info/success`), `support`, `figma_only`, `custom_description` (ссылка на Figma), `comment`, `texts_ru[]`, `texts_en[]`, `texts_zh[]` (массив строк: [title, body…]) |
| `config-change-log` | action, `user_name`, endpoint_path, status_code, error_type, `changes[{field,from,to}]` |

**Синк (`syncFromSwagger`)**: fetch JSON → теги в группы → `(path, method, group)` в endpoints → по каждому статусу
`extractResponseEntries` (oneOf + discriminator → `type.enum[0]` → `type.example` → `name.enum[0]`), матчинг по
`(status_code, error_type)` с миграционным fallback (одна старая запись с `null` → обновить вместо delete+create).
Только soft delete. Cron 02:00 ежедневно + кнопка Sync.

**Экспорт (`export-ts.ts`)**: строки → группировка по пути и по «отпечатку» конфига (тип + support + тексты), чтобы
одинаковые реакции слились в одну запись с несколькими `variants`; ключ перевода = `toCamelCase(английский текст)` +
`uniqueKey`; `{{param}}` в текстах → тип `I18nParams[path][method]`; плюс генерация MobX query/mutation-фабрик под
`@/common/shared/lib/mobxQuery` (жёсткая привязка к xRocket). `LANGS = ['en','ru']` захардкожен в двух местах (сервер
и `apps/tools/src/shared/const/lang.ts`), `zh` закомментирован.

**API для генератора фронта.** `xrocket-front/tools/scripts/xrocket-tools/xrocket-tools-generator.mjs` (117 строк):
`POST /api/auth/local` (логин/пароль из `.env`) → `GET /api/swagger-endpoints?filters[slug][$eq]=<svc>` →
`GET /api/swagger-endpoints/:documentId/export-ts` → пишет
`libs/main/src/common/shared/api/errors/mappings/<svc>.generated.ts` → prettier. 12 скриптов `xrocket-tools:<svc>` в
`package.json`. Потребитель: `responseMappings.ts` мёржит 12 файлов, `resolveApiResponse.ts` матчит exact →
`METHOD_2xx` (с fallback на любой 2xx, т.к. NestJS отдаёт 201 вместо задекларированного 200) → `METHOD_ERR`;
`resolveNetworkError` → `METHOD_NET`; `middleware.ts:109` переводит через собственный `responseTranslations`, не
через i18next. Объём: 8935 строк сгенерированных маппингов (p2p — 4241).

**Auth и безопасность.** Strapi users-permissions, JWT в `localStorage`, права роли `authenticated` выставляет
bootstrap из списка `AUTHENTICATED_PERMISSIONS` (забыл добавить — 403). В `scripts/fetch-generated-ts.sh` пароль по
умолчанию `Admin123!`. Сетевая защита — только внутренний ingress.

**Качество.** Хорошо: подробные CLAUDE.md на каждое приложение (алгоритм синка, матрица матчинга, gotchas), тест
экспорта, knip, аудит-лог. Плохо: один тест-файл, N+1 запросов в `loadRows` (группа → эндпоинты → ответы → конфиг по
одному), устаревшие доки, `tools-api` на React 18 (админка Strapi) рядом с React 19.

**Что болело (по истории xrocket-front, 33 коммита в `errors/mappings` за 12 месяцев):**
- источник истины в БД: ревью в PR видит только сгенерированный TS; правка текста требует доступа к стенду tools;
- ручная правка «AUTO-GENERATED» файла (`3d8e3fa82 [DEV-3406] Add modal subtitles…`, +15 строк в `swap.generated.ts`
  после регенерации) — следующая регенерация её затрёт;
- второй словарь переводов: тексты ошибок не попадают в Crowdin и i18n-проверки, `zh` выключен целиком;
- ключи из английского текста: правка английской фразы меняет ключ, коллизии решаются суффиксом `2`;
- экспорт генерирует ещё и query-фабрики (второй генератор API рядом с openapi-typescript — мастер-план это запрещает).

### 2. Переводы в xRocket

- `libs/main/src/common/shared/i18n/translations/{en,ru,zh}/<ns>.json` + `all/<ns>.json`, 15 неймспейсов по доменам
  (`p2p` 568 ключей, `wallet` 498, `notSorted` 365 — это `defaultNS`, `common`). `all/` — объединённый формат
  `"key": { "en": "…", "ru": "…", "zh": "…" }`, удобный для правки всех языков рядом. Объём: all 440 КБ.
- `tools/scripts/sync-i18n.mjs` (753 строки): `merge` (языки → all), `split` (all → языки), `sync` (оба, в
  pre-commit). `all/` — источник истины: ключ, удалённый только из `en/ru/zh`, вернётся. Валидации: автозамена
  кириллических гомоглифов в en/zh, запрет кириллицы в en/zh, удаление zh-дублей en, обязательный en, баланс и
  совпадение `<tag>` и `{{var}}` между языками. Ключи не сортируются, порядок — порядок вставки.
- `check-i18n-completeness.mjs` (+ baseline `tools/i18n-completeness-baseline.json`, учёт plural-категорий en
  `one/other` vs ru `one/few/many/other`), `check-i18n-web.mjs`, `namespaceUsage.test.ts`, ESLint
  `require-i18n-namespace`, smoke «нет сырых ключей в DOM».
- Crowdin: `crowdin.yml` в корне без токена, 14 файлов `en/<ns>.json` → проект 631028; флоу `crowdin upload` →
  ждать → `crowdin download` → commit. Заметки переводчику — ключ `CROWDIN_NOTE` в JSON.
- Вывод для utils: редактор должен работать поверх `all/` и вызывать ту же логику split/validate, иначе правка из UI
  разойдётся с pre-commit.

### 3. Storybook в xRocket и его цена

- Один Storybook в корне (`.storybook/`, `apps/storybook/nginx.conf` для образа), `@storybook/react-native-web-vite`
  10.3.5, переиспользует `apps/mobile/vite.config.mts`; 13 пакетов `@storybook/*` (включая 4 on-device для RN).
- `main.ts` (104 строки): babel-плагины декораторов для tsyringe, `dedupe` и `optimizeDeps.exclude` 7 пакетов Tamagui
  (две копии `use-presence` ломали exit-анимации), абсолютный glob в `optimizeDeps.entries` (6k deep-импортов
  tabler-иконок → «Failed to fetch dynamically imported module»), вырезание дубля SWC refresh-плагина.
- `preview.tsx`: `@abraham/reflection`, `container.resolve(AppStore)`, `NavigationContainer`, `TamaguiProvider`,
  тема через тулбар; **нет i18n-провайдера** (отсюда правило «shared UI только на props»), шрифты Inter через
  `preview-head.html` (164 строки `@font-face` из `staticDirs: ../assets`; в сессиях превью показывало fallback-шрифт).
- Сопровождение: **27 коммитов в `.storybook` за 12 месяцев**, из них ~12 «Fix SB / Fix Storybook / HOTFIX
  Storybook»; причины — Tamagui/RNW, DI, переезд на Vite 8, перенос `shared/lib`. Ничего из этого не относится к
  чистому React + Tailwind без DI.
- Покрытие: 66 файлов stories, из них ~25 — `Utils/*` (форматтеры, расчёты через `StoryTable`: «Вызов →
  Результат»); stories есть у 32 из 99 папок `shared/ui` [03]. Визуальный прогон stories
  (`run-storybook-visual.mjs` + `tests/storybook/playwright.config.ts`) — **1 спека** (`Button.visual.spec.ts`).
  Вывод: инструмент был, но «каталог первым» не практиковался и не принуждался.

### 4. Storybook 10.6 в нашем стеке: факты (npm, 2026-10-15)

| Пакет | Версия | Важное |
| --- | --- | --- |
| `storybook` | 10.6.2 | 17 зависимостей, 22 МБ unpacked, ESM-only |
| `@storybook/react-vite` | 10.6.2 | peer `vite ^5…^8`, `react ^16.8…^19` |
| `@storybook/nextjs-vite` | 10.6.2 | peer `next ^14…^16`, `vite …^8` |
| `@storybook/addon-vitest` | 10.6.2 | peer `vitest ^3 \|\| ^4 \|\| ^5` (риск «Vitest 5» снят, как в [17]) |
| `@storybook/addon-a11y` | 10.6.2 | axe |
| `@storybook/addon-mcp` | 10.6.2 | MCP на `localhost:6006/mcp`: `docs-list`, `docs-show`, `docs-show-story`, `stories-find-by-component`, `stories-changed`, `get-storybook-story-instructions`, `test-run` (тесты + a11y с инструкциями по починке); docs-набор требует `features.componentsManifest: true`, работает для всех React-фреймворков; статус preview, API может меняться ([docs](https://storybook.js.org/docs/ai/mcp/overview), [manifests](https://storybook.js.org/docs/ai/manifests)) |

- Официального фреймворка для `.astro`-компонентов нет; есть сторонний Astrobook (подмножество CSF3)
  ([npm](https://npmjs.com/package/astrobook)). Для нас не важно: kit — React, Astro-обёртки тонкие.
- Время сборки не измерялось на нашем коде. Оценка (мнение): dev-старт Storybook на Vite 8 — секунды, `build` ~100
  stories — порядка минуты. Проверить в волне 0.

### 5. Storybook vs своя галерея

| Критерий | Storybook 10.6 в `packages/ui` | Своя галерея в utils |
| --- | --- | --- |
| Стоимость старта | `storybook init` + ~7 devDeps + `main.ts`/`preview.tsx` ~80 строк; без RNW/DI нет 90 % проблем xRocket | реестр компонентов, матрица вариантов, контролы пропсов, тулбары темы/вьюпорта/RTL/локали, изоляция iframe, HMR, docs-страницы: оценка 1.5–3 тыс. строк и постоянная поддержка |
| Тесты | `addon-vitest`: каждая story — тест в браузерном режиме Vitest 5, `play`-взаимодействия, a11y-проверки в том же прогоне; VRT поверх `iframe.html?id=` | всё писать самим |
| Агентам | CSF3 массово в обучающих данных; `addon-mcp` отдаёт агенту список компонентов, пропсы, примеры, запускает тесты; JSDoc пропсов попадает в манифест | своё API, агент учится по нашим докам; MCP пришлось бы писать |
| Несколько шаблонов | один Storybook на kit покрывает все шаблоны; Vite-приложения могут добавить свои stories тем же glob | одна галерея на все — так же |
| Next-специфичные компоненты (`site`) | `nextjs-vite` поддерживает Next 16, но второй Storybook = второй конфиг. Не нужен: kit запрещает `next/*`, презентационные компоненты домена site тоже пишутся без `next/*`, роутинг через слот | то же ограничение |
| Риски | мажор раз в год (11 в alpha), MCP в preview | bus factor = мы |

**Решение (оркестратор):** гибрид с Storybook в центре.
1. Один Storybook в `packages/ui/.storybook` (`@storybook/react-vite`), stories из `packages/ui/src/**` и
   `apps/{tma,admin,game,site}/src/**/components/**/*.stories.tsx` (только компоненты без импорта фреймворка, это уже
   правило lint для kit, распространить на `components/` в доменах). Аддоны: `addon-docs`, `addon-vitest`,
   `addon-a11y`, `addon-mcp` (`componentsManifest: true`). Без per-app Storybook.
2. В `preview.tsx`: тот же `tokens.css` и те же файлы шрифтов, что в приложениях (импорт из `packages/tokens`, проверка
   `document.fonts.check` в тесте — против урока «fallback-шрифт»), декоратор i18next с тулбаром локали (en/ru + одна
   RTL для проверки зеркалирования), тулбар темы ставит `data-theme`, вьюпорты 360/390/430/768/1024/1440, `dir`
   переключатель. DI нет — провайдеры простые.
3. Utils-сайт **не реализует** свою галерею компонентов: вкладка Catalog встраивает Storybook (в dev — iframe на
   `localhost:6006`, в сборке — `storybook build` в `apps/utils/dist/catalog`). Своё в utils только то, чего
   Storybook не делает: **Screens** (галерея VRT-снимков экранов приложений: 2 темы × ширины, diff с baseline) и
   **Tokens**.
4. Для landing/blog-only проектов Storybook не ставится (опция `catalog` выключена), но может быть включён.

Почему не «страница в utils на раннем этапе»: в чистом стеке Storybook дешевле своей галереи уже в первый день, а
переезд с самописной галереи на Storybook позже — двойная работа над stories.

### 6. Utils-сайт для бойлерплейта (дизайн)

**Форма.** `apps/utils` в каждом проекте, где выбран хоть один шаблон кроме `landing`/`blog`. Это dev-инструмент:
нет `deploy.json`, нет в compose и прод-образах (проверка `tools/checks`). Запуск `pnpm utils` → Hono-сервер на
`127.0.0.1:4400` + Vite SPA, печатает URL с одноразовым токеном.

**Стек.** Vite 8 SPA + React 19 + `packages/ui` + `packages/tokens` + TanStack Router/Query/Table (как `admin`) +
Hono на Node для файловых операций. Без Strapi, БД, react-admin, MUI, NX. Логика — в `packages/devtools-core`
(или `tools/utils-core`) с unit-тестами, чтобы CLI, CI-проверки и UI использовали один код.

**Перенос из xrocket-tools (код как логика):**

| Берём | Куда |
| --- | --- |
| `extractResponseEntries` (oneOf + discriminator, приоритет `type`/`name`), миграционный fallback, soft delete, `change_status` | `mapping:sync <svc>`: сравнивает OpenAPI-спеку в репо (та же, что для Orval) с JSON маппинга, помечает `new/modified/deleted` |
| группировка по отпечатку конфига, формат variants `METHOD_STATUS_type`, синтетика `ERR/NET/2xx`, `I18nParams` из `{{param}}`, `VariantsOf<paths,…>` + `satisfies` | генератор `<svc>.mapping.generated.ts` |
| SwaggerOverview: группы со ссылкой на доку, фильтры по классам статусов и «нет перевода», покрытие языков, bulk-заполнение, модалка правки, SchemaViewer, аудит, дашборд «% перевода» | вкладка Errors |
| `sync-i18n.mjs`: формат `all/`, split/merge, гомоглифы, теги/переменные, обязательный en | `packages/i18n/tools`, вкладка Texts и pre-commit |

Не берём: БД как источник истины, генерацию query-фабрик, ключи из текста, отдельный словарь ошибок, JWT в
`localStorage`, пароли по умолчанию, NX/werf.

**Данные маппинга в репо** (мастер-план уже решил «маппинг как данные в репо»):

```jsonc
// packages/api/src/errors/<svc>.mapping.json — источник истины, правится руками, агентом или utils
{
  "$schema": "../mapping.schema.json",
  "service": "p2p",
  "spec": "../../openapi/p2p.json",
  "operations": {
    "createAd": {                       // operationId
      "path": "/api/v1/p2p/ads", "method": "POST",
      "responses": [
        { "variants": ["400:/api/problems/p2p_ads_limit", "409:/api/problems/p2p_duplicate"],
          "type": "toast", "severity": "error", "support": false,
          "i18n": { "title": "p2p.createAd.adsLimit.title", "subtitle": "p2p.createAd.adsLimit.subtitle" },
          "comment": "аналитик: лимит 10 объявлений", "figma": null },
        { "variants": ["ERR"], "type": "modal", "severity": "error", "support": true,
          "i18n": { "title": "common.serverError.title" } },
        { "variants": ["NET"], "type": "modal", "severity": "error", "i18n": { "title": "common.offline.title" } }
      ]
    }
  }
}
```

- Тексты — в i18n-неймспейсе `errors` (`all/errors.json` в формате xRocket) → идут в Crowdin, i18n-проверки и
  плюралы как все тексты. Ключ стабильный `<svc>.<operationId>.<slug>`, создаётся один раз, от правки текста не
  меняется.
- `pnpm api:generate:<svc>` = Orval + генерация `*.mapping.generated.ts` из JSON с `satisfies
  EndpointResponseMapping<VariantsOf<…>>`: исчезнувший из спеки variant ломает typecheck.
- `mapping:check` в гейте: zod-схема JSON; у каждой операции есть запись или явный default; все `i18n`-ключи есть в
  `errors` во всех языках; `{{param}}` совпадают между языками; нет `deleted` без решения.

**Вкладки utils:**

| Вкладка | Что делает | Пишет в |
| --- | --- | --- |
| Errors | дерево сервис → тег → операция → ответ; фильтры статуса, `new/modified/deleted`, «нет текста»/по языку; правка type/severity/support/comment; тексты всех языков рядом с превью настоящего `Toast`/`Modal` из kit в обеих темах; bulk; «Sync with OpenAPI» показывает диф спеки | `<svc>.mapping.json`, `all/errors.json` |
| Texts | приложение → неймспейс → ключ; колонки языков; фильтры missing/лишние/неиспользуемые (поиск использований по `src`); plural-формы по `Intl.PluralRules(lang).resolvedOptions().pluralCategories` (ru `one/few/many/other`); валидация `{{var}}`, `<tag>`, гомоглифов; `CROWDIN_NOTE`; превью длины против ширины 360px; создание/переименование ключа с обновлением `all/` | `apps/<id>/src/shared/i18n/translations/all/*.json` → split |
| Catalog | встроенный Storybook | — |
| Screens | VRT-снимки экранов по шаблонам: тема × ширина, diff с baseline, ссылка на маршрут | — |
| Tokens | роли и примитивы из `tokens.css` в обеих темах, контраст ролей, ΔE к стоп-палитрам (тот же скрипт, что в гейте) | — |

**Поток изменений.** UI → API сервера → атомарная запись JSON (стабильный порядок ключей, 2 пробела, `\n` в конце)
→ сразу `split` + валидаторы → UI показывает `git diff` изменённых файлов и кнопку «Run checks» (`mapping:check`,
`i18n:check`, `api:generate` при изменении маппинга). Коммит/PR — обычным путём (`/commit`, `/push`). Utils сам не
коммитит и не пушит.

**Безопасность.** Бинд только на `127.0.0.1`; токен в URL → cookie `SameSite=Strict`; проверка `Host` и `Origin`
(против DNS-rebinding и CSRF из чужих вкладок); запись только в allowlist путей (`packages/api/src/errors/*.mapping.json`,
`**/i18n/translations/all/*.json`), запрет `..`; никакого произвольного shell, только фиксированные npm-скрипты;
`tools/checks` проверяет, что utils нет в прод-образах и CI-деплое. Опция `utils-deploy` (волна 3): внутренний
ingress + OIDC (адаптер из `admin`) + GitHub App с `contents:write` только на этот репозиторий; каждое сохранение
создаёт ветку `utils/<user>/<date>` и PR, в `main` никогда; в UI видно, кто и что менял (аналог `config-change-log`
из xRocket через историю PR).

**Как агенты пользуются.** Агент не ходит в UI для правок: правит те же JSON и запускает CLI
(`pnpm mapping:sync <svc> --json`, `pnpm mapping:check`, `pnpm i18n:missing --json`, `pnpm i18n:check`). Для
компонентов — Storybook MCP (`docs-list` перед созданием нового компонента, `test-run` после правки). Utils —
интерфейс для человека (аналитик, переводчик, дизайнер) и для визуальной проверки пользователем. Skill
`/errors-map <svc>`: sync → список новых ответов → предложить type/severity по правилам → тексты не придумывать,
отметить missing → check.

**Init.** Модуль `utils` (вкл. по умолчанию, если выбран любой из `tma`, `admin`, `site`, `game`), владеет
`apps/utils`, `packages/devtools-core`, skill `/errors-map`, разделом в README. Модуль `catalog` (Storybook в
`packages/ui`) — тот же критерий. Для `landing`/`blog`-only оба удаляются; флаги `--with utils`, `--with catalog`
для принудительного включения. Вкладка Errors скрывается, если в проекте нет `packages/api`.

### 7. AI-дизайн-процесс: шаг 1 = каталог

1. Инвентарь: из `DESIGN.md` или снимка Figma (`design/component-map.json`) список компонентов и вариантов; через
   Storybook MCP `docs-list` найти существующие, не плодить дубли.
2. Для каждого нового или расширенного: компонент в kit (или `components/` домена) + stories по `docs/components.md
   §10` (States, Combinations, Edge cases, Matrix light/dark, Playground) + RTL и узкая ширина в Matrix.
3. Гейт: `addon-vitest` прогон stories (рендер + a11y) зелёный, VRT-снимки stories в Docker.
4. Пользователь проверяет каталог (Storybook или вкладка Catalog utils) и утверждает. До утверждения экраны не
   начинаются.
5. Экраны собираются только из каталога; новый визуальный элемент во время вёрстки экрана = возврат к шагу 2.
   Проверка `catalog:coverage`: у каждого экспортируемого компонента `packages/ui` и `apps/*/src/**/components` есть
   `*.stories.tsx` (в xRocket без проверки было 32 из 99).

## Recommendations for the boilerplate

**P0**
1. Storybook 10.6 одним экземпляром в `packages/ui` (`react-vite`) + `addon-vitest`, `addon-a11y`, `addon-mcp`
   (`componentsManifest: true`); preview с реальными токенами, шрифтами, i18n, темой, `dir`. Без per-app Storybook и
   без своей галереи компонентов.
2. Маппинг ошибок = `packages/api/src/errors/<svc>.mapping.json` по `operationId`, генерация TS с `satisfies`;
   тексты ошибок в i18n-неймспейсе `errors`; `mapping:check` в `pnpm verify`.
3. Формат `all/` + split/merge + валидаторы из `sync-i18n.mjs` переносятся в `packages/i18n/tools` одной
   библиотекой для CLI, pre-commit и utils.
4. Шаг 1 дизайн-процесса = каталог компонентов с утверждением пользователя; `catalog:coverage` в гейте.

**P1**
5. `apps/utils` v1 локально: Errors, Texts, Catalog, Tokens; Hono + Vite SPA на kit; безопасность по §6.
6. CLI-эквиваленты всех операций utils с `--json` для агентов; skill `/errors-map`.

**P2**
7. Вкладка Screens (VRT-снимки), Crowdin-интеграция как опция (`crowdin.yml` с glob по `en/*.json`).
8. Опция `utils-deploy`: OIDC + внутренний ingress + правки только через PR от GitHub App.

**Избегать:** источник истины в БД/CMS; второй словарь переводов; ключи из текста; ручные правки сгенерированных
файлов (lint/check: файл `*.generated.ts` совпадает с выводом генератора); пароли по умолчанию в скриптах; токены
в `localStorage`; генерация query-фабрик вторым генератором.

## Правки мастер-плана (точные)

1. **§1, таблица «Ядро»**: после `astro-shared` добавить «, `devtools-core` (логика utils: синк OpenAPI ↔ маппинг,
   i18n split/validate)». Добавить строку таблицы: `| Utils | apps/utils — локальный dev-сайт: маппинг ошибок,
   тексты всех языков, каталог (встроенный Storybook), снимки экранов, токены; не деплоится по умолчанию | [19] |`.
2. **§2, опции init**: добавить «`utils` и `catalog` (вкл., если выбран любой шаблон кроме landing/blog; для
   landing/blog-only выключены), `utils-deploy` (OIDC + PR-флоу, выкл.)».
3. **§3.1, строка «Тесты…»**: заменить «Storybook» на «Storybook 10.6 одним экземпляром в `packages/ui`
   (`react-vite`, `addon-vitest` + a11y + MCP; stories Vite-приложений тем же glob, своей галереи нет)».
4. **§3.1, строка «Роутинг, i18n»**: добавить «каталоги в формате xRocket `all/` + `en/ru/…` с split/merge и
   валидаторами (`packages/i18n/tools`); тексты ошибок в неймспейсе `errors`».
5. **§3.1, строка «API»**: «маппинг ошибок как данные: `packages/api/src/errors/<svc>.mapping.json` по `operationId`
   → генерируемый TS с `satisfies`; `mapping:sync`/`mapping:check`».
6. **§3.3, «Берём»**: добавить «алгоритм синка Swagger и формат variants xrocket-tools, i18n `all/` + валидаторы»;
   «Не берём»: «Strapi/react-admin как источник маппинга, отдельный словарь ошибок, ключи из текста».
7. **§4, абзац «Состояние и VM», фраза про ошибки**: «…данные в репо (`<svc>.mapping.json`), правятся в utils или
   руками, тексты в неймспейсе `errors`».
8. **§5, Skills**: добавить `errors-map`; гейт `pnpm verify` дополнить `mapping:check` и `catalog:coverage`.
9. **§6, «Процесс»**: начать с «Шаг 1 — каталог компонентов: инвентарь из DESIGN.md/снимка Figma, поиск
   существующих через Storybook MCP, stories (States, Combinations, Edge, Matrix light/dark + RTL, Playground),
   прогон `addon-vitest` + a11y, утверждение пользователем; экраны только после и только из каталога [19 §7]».
   Это действует и при готовом дизайне (каталог из макета), и без него.
10. **§8**: в список владельцев манифеста добавить модули `utils` и `catalog`; `tools/checks` проверяет, что
    `apps/utils` не попал в compose/CI-деплой без `utils-deploy`.
11. **§9, База**: «utils только на `127.0.0.1` с токеном и проверкой Host/Origin, запись по allowlist путей; при
    `utils-deploy` — OIDC, внутренний ingress, только PR».
12. **§11, волны**: волна 1 — `catalog` (Storybook в `packages/ui` с MCP), `packages/i18n/tools`, формат маппинга +
    генератор + `mapping:check`, `apps/utils` v1 (Errors, Texts, Catalog, Tokens), skill `errors-map`; критерий
    выхода: правка текста в utils даёт корректный diff `all/` + языков и зелёный `i18n:check`; новый ответ в спеке
    виден в `mapping:sync`. Волна 2 — вкладка Screens, Crowdin-опция. Волна 3 — `utils-deploy`.
    Волна 0 — замер `storybook dev`/`build` и `addon-vitest` на kit, проверка `addon-mcp` в Claude Code.
13. **§13, риски**: строка «Storybook MCP и manifests в preview (API может меняться), Storybook 11 в alpha | пин
    exact, MCP — ускоритель, не единственный путь (каталог читается и по файлам stories); smoke в волне 0». Строка
    «Utils пишет в репо: порча JSON, конфликт с pre-commit, локальный сервер как поверхность атаки | одна библиотека
    split/validate, атомарная запись, allowlist путей, токен + Host/Origin, нет в прод-образах».

## Open questions for the user

1. Кто правит тексты ошибок и переводы кроме разработчиков? Если аналитики/переводчики без локального репо — нужен
   `utils-deploy` (PR-флоу) раньше волны 3. По умолчанию принято: только локально.
2. Crowdin остаётся сервисом переводов по умолчанию (опция init) или переводы ведутся только в utils?
