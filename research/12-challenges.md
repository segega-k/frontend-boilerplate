# 12. Challenges к фрейму мастер-плана (соавтор, Fable)

Status: done (шаг 1)
Updated: 2026-10-14

Прочитано: 00-brief, 12-frame, отчёты 01–11 полностью, саб-отчёты 04a, 05a–05e, 07a, 09a, 10a, 11a (Summary,
Recommendations, Open questions, ключевые Findings), CLAUDE.md и docs/*.md бойлерплейта.

Учтены решения пользователя из сообщения оркестратора: landing на Astro; MobX (plain-классы, `makeAutoObservable`, без
tsyringe/DI/декораторов) + TanStack Query, без Zustand/Redux, React Compiler выключен; комментарии только там, где
код без них не понять, и они объясняют, как работает фича; `types.ts`/`consts.ts`/`utils.ts` и файл стилей всегда
отдельно; стилевой слой ждёт отчёт 13; GitHub первый; blog — шестой обязательный шаблон на стеке Astro; Figma —
обычно view-only, платных seats скорее всего нет (модуль должен жить в лимитах бесплатного плана); shop — оба рынка
через адаптеры с одним интерфейсом и mock-адаптером.

Формат: номер, суть, доказательство [отчёт], что предлагаю. Приоритет: **A** = влияет на архитектуру или на
выполнимость, **B** = надо решить до написания плана, **C** = уточнение формулировки.

## 1. Следствия решений пользователя, которые отчёты не покрывают

1. **(A) MobX + TanStack Query без DI возвращает проблему моста «Query → MobX», и его никто не сайзил.** docs/
   architecture.md §4 требует «серверные данные через query-слой, статусы читать из query, VM богатая»; в xRocket это
   делал `MobxQuery` (02 F3: 512 строк, комментарии о гонках гидрации, 255 использований) поверх DI-скоупа. Без него
   VM-класс не может держать запрос, а компонент не может читать `useQuery` и одновременно соблюдать «view читает
   только VM» (01 §4: `no-store-in-page-view` отключён в 227 файлах именно на этом шве). Варианты: (а) переписать
   мост на `QueryObserver` без DI (~250–300 строк + тесты, ядро core-фазы, нужен SSR-safe вариант для Astro-островов);
   (б) MobX только для клиентского состояния, серверные данные идут в компонент через `useQuery`, VM получает их
   аргументом хука. (б) проще, но ломает «thin store, rich VM» и `pageState`-геттеры из docs §3. Нужно решение
   оркестратора или пользователя; предлагаю (а) как «MobxQuery v2» с явным API и без скоупов, и записать в план как
   отдельный deliverable с рисками.

2. **(A) Как создаётся VM без контейнера.** 01 R5.3 и 11 T3: «явно, `new XViewModel(deps)` в хуке». Нужен один
   эталонный паттерн в rules (`useViewModel(() => new XViewModel({ store }))` + контекст на страницу, один провайдер
   на компонент как в docs §3), иначе агенты изобретут три. Для SSR-шаблонов (shop RSC, Astro-острова) правило: сторы
   и VM живут только в клиентских компонентах, синглтонов на уровне модуля нет (docs §8, 01 §7). Request-scope из
   xRocket (`requestScope.ts`) не переносится: без SSR-сторов он не нужен.

3. **(B) Какие MobX-правила ESLint возвращаются.** С отказом от Zustand снова нужны `observer-named-function`,
   `require-mobx-default-values`, `no-i18n-in-getter`, `no-platform-globals-in-store` (tooling.md §4). Спорные:
   `require-viewmodel-autobind` (только если VM без `autoBind` реально ловился) и `no-store-in-page-view`, который в
   xRocket отключён 233 раза (01 §8, 11 F1-4). Предлагаю второй вводить с узким scope (только `pages/**`) и лимитом
   отключений ≤ 10 (11 R5), иначе он повторит судьбу оригинала.

4. **(B) Строгое «файлы-спутники всегда» надо поставить на lint, иначе не выживет.** 01 §3: при той же конвенции в
   xRocket `types.ts` есть у 15 % новейших компонентов, `utils.ts` у 0 %, `consts.ts` у 4 %; 81 % инлайн-типов — одна
   `Props`. Решение принято, значит в план входит правило (ESLint `no-restricted-syntax`: `interface|type` и
   `const X = ` с UPPER_CASE в `.tsx` запрещены, кроме `export default`/`forwardRef`) и ответ на вопрос «`types.ts` с
   одной `Props` — норма». Записать явно, чтобы ревьюеры не считали это шумом.

5. **(A) Blog как отдельный шаблон: что в нём своё, а что общее с landing.** 05 §2 оценил блог как «90 % того же
   кода»; теперь это `apps/blog` на Astro. Чтобы не дублировать Astro-конфиг, SEO-компонент, i18n-роутинг и
   nginx-образ, их место — пакет (правило «≥ 2 потребителей», 11 R6.4): `packages/astro-shared` (или
   `packages/site-core`): `<Seo>`, sitemap/robots, Fonts, `astro.config` пресет, Content Layer схемы. Своё у blog:
   коллекции `posts`/`authors`, RSS, пагинация, теги, OG-картинки на пост, Starlight-docs (опцию `docs` логично
   перенести из landing в blog). Матрица init растёт до 2^6−1 = 63 комбинаций (06 F9 → pairwise nightly). Это надо
   зафиксировать в §2 и §9 плана.

6. **(A) Стилевой слой «pending» меняет 4 места плана.** Пока отчёт 13 не готов, план должен быть написан так, чтобы
   принять любой из кандидатов: (а) раскладка компонента `Name.tsx` + `Name.<styles>.ts|css` + спутники; (б)
   enforcement anti-slop: для CSS-based (CSS Modules, vanilla-extract, Panda) работает stylelint-пресет 07 F8.1, для
   Tailwind — сброс `@theme` + `no-restricted-classes` 07 F8.2; (в) инвариант Figma «каждый экспорт styled есть в
   Name map» (09 F1.3) переносится на `data-figma` (09 R0) и не зависит от стилевого слоя; (г) kit-правило «анимации
   на CSS, без Motion в kit» (05 риск 4). Предлагаю в §6 плана таблицу «правило → механизм при CSS-варианте /
   при Tailwind-варианте», а решение подставить после 13. Отмечу: 03 вопрос 1 и 07 вопрос 1 оба говорят, что оба пути
   закрывают одни и те же правила; разница в том, где живёт enforcement.

7a. **(A) Pixel-perfect без платного seat: пайплайн 09 надо перевернуть с «MCP по узлам» на «снимок в репо».**
   09 R1–R6 построен на Dev/Full seat (MCP 200/день, REST Tier 1); на view-only доступе это 6–20 вызовов в месяц
   (09 F2, F4.1), то есть один экран съедает месячный лимит. При этом 09 R6a уже кладёт spec в репо и пишет «агент и
   CI работают с кэшем». Предлагаю сделать это единственным режимом: (а) источник spec — одноразовый bulk-экспорт
   фрейма (дерево узлов, геометрия, стили, boundVariables, PNG @2x, SVG-ассеты) в `design/specs/`; (б) экспортёр —
   Figma-плагин (Plugin API видит коллекции и переменные на любом плане, 09 R3), запускает дизайнер или пользователь
   после запроса edit-доступа; (в) fallback — REST bulk (`GET /v1/files/:key/nodes?ids=…` + `GET /v1/images`: 2 вызова
   на экран, 09 R6a) в пределах бесплатного лимита, и ручной ввод значений из Dev Mode в тот же JSON; (г) MCP не
   используется в основном пути: `figma-preflight`/`get_metadata` убираются, Figma-плагин Claude Code уходит из
   `enabledPlugins` по умолчанию (08 §3.3) в опцию модуля; (д) `figma-implement`, `figma:measure`, `figma:diff`,
   `figma-section-inspector` читают только `design/specs/*.json` и PNG. Проверить на реальном файле (в план как
   «не проверено»): могут ли плагины запускаться на view-only доступе; точные лимиты MCP/REST бесплатного плана на
   дату реализации; доступен ли Dev Mode inspect без Dev seat. Code Connect и REST Variables API — вне плана (Org/
   Enterprise). Токены (09 R3): экспорт тем же плагином в DTCG → Style Dictionary, nightly-job по REST не делаем.

7. **(C) Комментарии решены, но формулировка нужна точная.** Решение пользователя: «только где код без них не понять;
   объясняют, как работает фича». Это не «why»-комментарии из 11 T1 и не «what». В rule-файл: разрешён комментарий-
   описание механизма (как работает нетривиальный алгоритм, порядок, инвариант), запрещены пересказ строк и
   обоснования выбора (они идут в ADR/отчёт). 08 черновик CLAUDE.md («No new comments that say what code does.
   Rationale goes to the report») под это почти подходит; поправить одну строку.

## 2. Несогласие с решениями фрейма

8. **(A) Один Dockerfile с targets `static`/`node` противоречит инварианту владения из 06.** 06 F3 п.2: «у каждого
   приложения свой Dockerfile, свой compose.yaml, свой deploy.json; никаких списков в общих файлах», иначе init
   должен править общий файл, а `manifest-coverage` теряет смысл. Фрейм берёт вариант 02/05. Предлагаю: Dockerfile на
   приложение (15–25 строк), общие куски (nginx.conf, security-headers.conf, env.sh) в `docker/`, копируются `COPY`;
   корневой `compose.yaml` генерируется init (06 F5). Тогда «удалил папку = удалил деплой».

9. **(A) «Один образ на все окружения только для SPA; для SSR образ на окружение» сформулировано наоборот.** 05b §11:
   Next читает всё, кроме `NEXT_PUBLIC_*`, в рантайме, публичные значения отдаются из server-компонента, то есть один
   образ для shop **возможен**. Проблема у **статических** landing и blog: `site` для canonical/OG/sitemap вычисляется
   на билде (05a §7, §11). Предлагаю правило: один образ обязателен для tma/admin/game/shop; исключение только
   Astro-static (сборка на окружение или `landing-node`). Это сохраняет docs/tooling.md §9 почти без исключений.

10. **(A) Планы `.work/plans/` в gitignore повторяют ошибку xRocket.** 04 §3: gitignored `docs/plans/` дал битые
    ссылки у всех, кроме автора, и план не переезжает на другую машину. 08 §6.3 сознательно предлагает «отслеживается
    git, агент не коммитит, решает пользователь», а `ai:check` запрещает ссылки на `.work/` из доков. Фрейм пишет
    «gitignored». Предлагаю вернуть вариант 08.

11. **(B) Цель касания 44px молча меняет задокументированное правило пользователя (40px).** docs/design.md §2 и
    components.md §7: «≥ 40×40», цитата «пальцу не удобно будет»; 09 F1.5: пользователь откатывал «точные» отступы ради
    зоны 40×40. 03 вопрос 4 просил решить у пользователя. Предлагаю оставить 40 дефолтом (44 как рекомендация для
    tma/game в DESIGN.md) или вынести в подтверждения, но не записывать как решение оркестратора.

12. **(B) «Shop: hosted checkout по умолчанию» несовместимо с «эталон Medusa v2» и с решением «оба рынка через
    адаптеры».** У Medusa нет hosted checkout: шаги чекаута (адрес, доставка, метод) живут у нас, провайдер даёт
    платёжную сессию → redirect на страницу платёжки (ЮKassa `confirmation_url`, Stripe Checkout) или виджет (05b §6).
    Hosted checkout целиком есть только у Shopify. Предлагаю формулировку: «шаги чекаута наши, карта только у
    провайдера: по умолчанию redirect, embedded-виджет по флагу» (SAQ A по 10 §2), и один интерфейс
    `CommerceProvider` (05b §2) с тремя адаптерами: `mock` (CI, Storybook), `medusa` (эталон, RU/CIS через ЮKassa-плагин
    и международный через Stripe), `shopify` (международный SaaS, опция init). Платёжный шаг — `PaymentStep` с
    `{kind: 'redirect' | 'embedded', provider}` (05b §6), аналитика и consent — по рынку (Метрика/Umami vs GA4 Consent
    Mode, 05b §10). Правила S1–S10 из 07a применяются ко всем адаптерам.

13. **(B) Hey API с exact pin рискованнее, чем выглядит.** 05d §0: последний stable 0.99.0 от 2026-06-22, дальше только
    `next`-сборки до 2026-09-30; 0.x ломает API в минорах; MSW-плагин «In Progress». 02 (не знал про maintenance mode
    openapi-fetch) считал openapi-fetch «проще и стабильнее». Реально нужны: типы (openapi-typescript 7.13 живёт),
    fetch-клиент (~150 строк свои: interceptors, request id, маппинг ошибок — всё равно свои), фабрики `queryOptions`.
    Предлагаю пометить «Hey API» как «после smoke-сравнения с Orval 8 и с openapi-typescript + свой клиент» в
    core-фазе. Критерий: стабильный релиз за последние 60 дней, генерация по спекам Medusa и реального бэкенда.

14. **(B) `tools/init` удаляет сам себя по умолчанию.** Это делает `--remove <id>` невозможным навсегда (06 F7) при
    цене хранения в один бандл и манифест. Предлагаю инвертировать: init и манифест остаются, удаляются только
    `init-matrix.yml` и skill `init-project`; `--purge-init` убирает всё.

15. **(C) Push агентом «ask».** 10 §4.4: «push-прав у агента нет вообще»; 08 смягчил до ask. С acceptEdits на Windows
    без sandbox ask-правило обходится (`git -C . push`, 10a §0.1), держит только guard. Согласен с ask, но в плане
    явно: защита = branch protection на GitHub + guard, а не permissions.

16. **(C) Порядок старта.** Фрейм: core → tma → admin → game → landing → shop. Landing (острова без общего
    React-контекста, `@source` на kit, `'use client'`) проверяет кросс-фреймворковые правила kit дёшево и рано; blog
    сразу после него переиспользует `astro-shared`; game почти ничего общего не берёт, кроме `telegram-platform`.
    Предлагаю core → tma → admin → landing → blog → game → shop.

## 3. Противоречия между отчётами, которые фрейм не закрыл

17. **(A) Файловая маршрутизация TanStack Router против «таблица роутов на домен, композиция в app/».** 05c/05d берут
    file-based (`src/routes/*`, генерируемый `routeTree.gen.ts`); docs/architecture.md §1 и 01 R1 требуют «routes
    table per domain, composed in app/». Предлагаю code-based routes: `domains/<d>/routes.ts` + `app/router.ts`
    (сохраняет правило пользователя, типизация TanStack остаётся, меньше генерируемого кода по 11 R5).

18. **(A) Три имени для доменного слоя и четыре состава пакетов.** 01 R1: `features/<domain>`; 11 R2 и docs:
    `domains/<d>/pages/<Page>`; docs ещё `common/{pages,entities,widgets,shared}`. Пакеты: 01 `platform-tma`; 05
    `telegram-platform`; 06 `telegram, commerce, game-kit, ui-data, api-client, eslint-config, tsconfig`; 08 `telegram,
    commerce, game-kit, ui-data`; 05b кладёт commerce-адаптер в `apps/shop/src/commerce/`. Предлагаю одно дерево:
    `apps/<id>/src/{app,domains/<d>,shared}` (слово `domains` — словарь пользователя; `common/entities|widgets` убрать
    по 01 §2), пакеты только при ≥ 2 потребителях: `ui, tokens, api, i18n, config, telegram-platform, analytics,
    astro-shared`; commerce, data-table, game bridge — внутри своих приложений, удаляются с ними.

19. **(B) Шаблонные правила `.claude/rules/<id>-*.md`.** 04 рек.10 и манифест 06 F4 их предусматривают, 08 §2.1 п.4
    запрещает. Фрейм выбрал 08; пример манифеста 06 надо обновить, иначе реализация заведёт оба механизма.

20. **(B) i18next в shop: решение принято, цена не названа.** 05b §7: у i18next нет интеграции с `next/root-params` и
    cache-ключами Cache Components, «придётся писать самим». Записать в план: серверный инстанс i18next на запрос +
    locale явным аргументом во все `'use cache'`-функции (как `ctx` в 05b §2), ~1–2 дня, пункт проверки на реальной
    сборке.

21. **(B) Память: 04 §17a «не выключать» против 08 «выключить».** Фрейм выбрал 08, согласен. Но «Заложи к себе в
    память» (workflow.md §11) должно иметь ответ в CLAUDE.md: `/record-decision` или `.work/`, чтобы не было «агент
    отказался запоминать».

22. **(C) `console.log`.** code-style.md §4 «только внутри catch», 11 R7.5 «только `log.*`». Выбрать второе.

23. **(C) Имя гейта.** tooling.md §7 `check`; 08 `verify`; 11 `check:hotfix`. Одно имя: `pnpm verify`,
    `pnpm verify --hotfix`.

24. **(C) Game-мост на `zustand/vanilla`** (05e §4) теперь не подходит: MobX вне React работает не хуже
    (`observable` store + `reaction` в сцене, отписка в `SHUTDOWN`). Переписать строку плана, правило «горячие данные
    не идут в store» остаётся.

## 4. Решения, которых нет в таблице фрейма, но без них план не написать

25. **(A) Роутер.** В таблице нет строки. 05: TanStack Router для tma/admin, в game роутера нет, landing/blog/shop —
    файловый роутинг фреймворка; `nuqs` не нужен. Плюс судьба «универсального хука `goToX`» (architecture.md §6): 01
    R5.4 и 05d вопрос 6 предлагают типизированный `<Link to>` + один helper для внешних/legal-ссылок. Правило «VM не
    навигирует, навигирует владелец кнопки» остаётся.

26. **(A) Auth-дефолт админки.** 05d: PKCE в браузере (`oidc-client-ts`), BFF опцией; 10 §1.3 и IETF BCP: чистый
    browser client «уязвим ко всем сценариям», BFF «strongly recommended for business applications». Предлагаю: дефолт
    PKCE (nginx static, без Node) с явным порогом в `security.md` «ПДн/деньги → `bff`»; кандидат в подтверждения.

27. **(A) Режим темы TMA: нативная (`--tg-theme-*`) или брендовая.** 05c вопрос 1, 07a вопрос 1; 07 T1 требует строго
    themeParams «как Wallet», 05c предлагает оба режима в токенах. Без ответа нельзя писать `packages/tokens` и
    `design.md` для TMA. Предлагаю дефолт «native + один брендовый акцент по DESIGN.md», режим `brand` переключателем;
    в подтверждения.

28. **(B) Библиотечные дефолты из 05 §5 внести одной строкой:** RHF 7 + Zod 4 (ESLint-запрет `watch()`), TanStack
    Table v9 + Virtual, Recharts 3 (ECharts опция), Motion только `LazyMotion` вне kit, `@tma.js/sdk-react` 3 (05e §1
    видит `4.0.0-rc.0`: миграция в течение года, адаптер обязателен), MSW 3, Vitest 5, Playwright 1.64.

29. **(B) Figma-плагин становится центральной частью модуля, и он внешний.** 09 F1.1: `figma-lint-plugin` живёт в
    репозитории xRocket; 09 R9.9: «отдельный репозиторий, не часть бойлерплейта». С бесплатным планом (п.7a) плагин
    нужен не только для линта и подписи, но и как экспортёр spec/токенов. Нужно решение: порт плагина xRocket (есть ли
    право) или новый минимальный плагин «Export frame → JSON + PNG» (~300–500 строк, Plugin API, без линта на старте).
    Предлагаю второе как v1 модуля, линт/подпись — v2; без плагина `figma-implement` работает в ветке UNVALIDATED по
    REST-снимку и ручному JSON.

30. **(B) Список подтверждений ≤ 8.** После решений пользователя закрыты: MobX, комментарии, спутники, GitHub, Astro,
    рынок shop (оба через адаптеры), Figma без платного плана. Остаются: (1) Next для shop при Astro у landing/blog
    (два meta-framework) или один стек; (2) мост Query↔MobX, вариант (а) или (б) из п.1; (3) Figma: порт плагина
    xRocket или новый экспортёр, и кто запускает его (дизайнер / запрос edit-доступа); (4) TMA-тема native/brand;
    (5) auth-дефолт админки PKCE/BFF; (6) цель касания 40/44; (7) язык человеческих доков при подрядчиках; (8) стилевой
    слой после отчёта 13 (место зарезервировано).

31. **(C) Sandbox-блок в коммитимом settings.json** (08 §3.2): `network.allowedDomains: ["registry.npmjs.org"]`. На
    Windows не действует, но в WSL2/devcontainer/CI заблокирует `tools/figma/fetch-spec.mjs` (api.figma.com), загрузку
    sourcemaps в Sentry, `git fetch` к GitHub, Playwright download. Либо полный allowlist, либо не коммитить блок.

## 5. Рискованные допущения для раздела «Риски»

32. **TypeScript 7.0.2 (нативный, июль 2026) как база.** Совместимость typescript-eslint, `@hey-api/openapi-ts`,
    Vite-плагинов, `astro check`, Next 16 с TS 7 не проверена (05 §5). Предлагаю: catalog фиксирует TS 5.9.x на
    старте, TS 7 — отдельный PR после smoke-сборок всех шаблонов.

33. **Свежие мажоры без подтверждённой совместимости:** Vitest 5 ↔ `@storybook/addon-vitest` (05d §12), MSW 3, Base UI
    1.9 (часть shadcn-блоков только Radix, 05b), TanStack Table v9, MobX 7 (вышел 2026-07-30, 05d §0), Node 24 vs
    Dockerfile `node:22-alpine` в 05a §11 (tooling.md §1 запрещает расхождение). Каждому — строка «проверить
    smoke-сборкой» в core-фазе.

34. **Next в монорепо — налог на всех.** 05 §4: Turbopack только у shop; vendored canary React (05b §1); правила kit
    (`'use client'` пофайлово, без barrel с директивами, `transpilePackages`, `@source`) нужны из-за shop, но соблюдать
    обязаны все. Показать в §2/§3 как цену варианта, чтобы подтверждение (1) было информированным.

35. **Matrix init в CI.** 06 F9 + шестой шаблон: 63 комбинации nightly; на PR 7–8 прогонов по 2–5 мин + Windows.
    Предлагаю на PR — 6 одиночных на Linux; пары, Windows с кириллицей и `all` — nightly (pairwise).

36. **Непроверенные механизмы Claude Code, на которых держится 08** (08 §7, 10a §6): семантика `paths:` с brace-glob,
    `enabledPlugins` из project settings у нового участника, `onFailure: "block"` ниже 2.1.295, `language: "russian"`,
    `autoMemoryEnabled: false` из project, `pnpm exec playwright-mcp` через `.cmd`, `Read(!.env.example)`. Фаза 0
    плана должна начинаться с этих 12 проверок.

37. **Модели путают Phaser 3 и 4** (05e §11), **@tma.js 3 → 4 RC** (05e §1), **MobX-паттерн копируется с соседей**
    (01 §4: новейший код всё ещё пишет `LoadingStatus` руками в 26 файлах). Все три — правила в `apps/<id>/CLAUDE.md`
    + lint, в риски плана.

38. **Medusa как эталон = кто-то должен его эксплуатировать** (05b §2): Node + Postgres + Redis рядом с фронтом. Для
    «frontend only» это внешний сервис в compose для dev и mock-адаптер для CI; назвать в §2 «что жертвует shop».

## 6. Что бы оспорил сильный архитектор

39. **(A) Объём v1 не определён, а он огромен.** В бойлерплейт по отчётам входят: 6 шаблонов, 8 пакетов, init с
    журналом и матрицей, ~15 собственных Node-инструментов (verify, ai:check с 13 проверками, arch-test,
    manifest-coverage, markers, doc-paths, guard + 3 хука, lint:copy, design:scan ~300 строк, figma fetch/measure/diff,
    tokens build/check, slop-check, MobxQuery v2), 18 core skills + 6 шаблонных, 6 агентов, 10 rule-файлов, 8
    runbook, 8–12 ADR, CI-ревьюер. Это противоречит 11 R5 «пределы магии» применительно к самому бойлерплейту.
    Предлагаю в §12 выделить **v1 (должно собираться и запускаться):** core-пакеты (включая мост Query↔MobX), `tma` +
    `admin`, AI-слой (CLAUDE.md-дерево, settings, guard, verify, ai:check, 8–10 skills, 3 агента), init без `add`,
    Docker + GitHub Actions, runbooks deploy/rollback/hotfix/EMERGENCY. **v1.1:** landing, blog, anti-slop stylelint +
    lint:copy, design-reviewer. **v2:** game, shop, Figma-модуль, design:scan, CI-ревьюер, ai:sync, `add`, GitLab CI.
    Без этого разреза план читается как список желаний.

40. **(A) Свои проверки — в один раннер.** `ai:check`, `arch-test`, `manifest-coverage`, `markers`, `check-doc-paths`
    (11 R1.4), `slop-check` (07a) — сканеры по `node:fs` с одинаковым выводом «файл / правило / почему». Один
    `tools/checks/` с правилами-плагинами вместо шести скриптов: меньше кода, один формат ошибок для агента, один
    тест-харнесс. Меняет только §12 (один deliverable вместо шести).

41. **(B) Один проект после init — всё ещё монорепо** (workspace, Turborepo, catalog, `apps/x` + `packages/*`) даже при
    одном выбранном шаблоне. Осознанная цена (общий kit нельзя «сплющить»), но назвать в §1/§8: init не делает плоский
    проект, `pnpm dev --filter tma` остаётся нормой.

42. **(C) Pre-commit с typecheck.** tooling.md §6 и 02 F6 жалуются на 4×tsc в pre-commit, 08 §5.1 снова кладёт
    typecheck в `verify --staged`. Предлагаю pre-commit = lint-staged + secretlint + markers; typecheck — pre-push и
    CI.

43. **(C) Шрифты и DESIGN.md на приложение.** 07 H12: Operate-шаблоны — системный стек или Inter, Persuade — не из
    reflex-списка. Значит `--font-sans` задаётся в токенах приложения по `apps/<id>/DESIGN.md`, а не в `packages/tokens`;
    kit не знает семейство. Записать в §6, иначе первый лендинг унаследует Inter и нарушит H12.

## Что считаю правильным и не оспариваю

Вычитание по манифесту и инвариант владения (06); `exports` как граница пакетов и арх-тест (01); отказ от RN/Tamagui/
tsyringe/Nx (02); MobX без DI как решение пользователя (совпадает с 01 §11 «идея сильная, реализация на декораторах
нет»); Base UI + сброс дефолтной темы (05, 07); Phaser 4 только 2D; две документации и runbooks (11); `pnpm verify`
как единственный гейт и `ai:check` (04, 08); auto memory off; CLAUDE.md ≤ 200 строк; rules с `paths`;
`/record-decision`; secretlint + gitleaks; BuildKit secrets и non-root; Umami по умолчанию; pixel-perfect как модуль с
блокирующими числовыми замерами и advisory pixel-diff (09); Astro для landing и blog.
