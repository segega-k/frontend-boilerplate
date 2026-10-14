# 11a. Поддерживаемость кода человеком: веб-исследование

Status: done
Дата: 2026-10-14. Источники по возможности 2025–2026. Пометка **[старое]** значит, что источнику больше двух лет, но он остаётся каноническим. Пометка **[не проверено]** значит, что утверждение взято из вторичного источника и по первоисточнику не сверено.

Сценарий, который держим в голове: ночью упал прод, AI недоступен, а в код впервые смотрит человек. Ему нужно за 15–30 минут найти место поломки, откатить или починить и проверить результат.

---

## 1. Принципы читаемой кодовой базы

- **Когнитивная нагрузка как главная метрика.** Рабочая память держит примерно 4 «чанка». Нагрузка делится на intrinsic (сложность самой задачи) и extraneous (созданную тем, как написан код), и бороться имеет смысл со второй. Документ живой, последнее обновление июнь 2026. https://github.com/zakirullin/cognitive-load (это и есть minds.md/zakirullin/cognitive)
  - Пример автора: два проекта по 5K строк. В одном 80 shallow-классов, и через 18 месяцев в нём не разобраться. В другом 7 deep-классов, и он понятен быстро.
  - Правила вида «метод не длиннее 15 строк» автор считает вредными: важную логику проще найти в крупной функции, которая явно выглядит главной.
  - Hexagonal/onion-слои добавляют косвенность и glue-код. Абстракция ради замены БД почти ничего не экономит.
  - Тест для архитектуры: если новичок непрерывно путается дольше ~40 минут, код надо улучшать.
  - Самоописывающие ошибки: строка `"jwt_has_expired"` лучше числового кода, который нужно сверять с таблицей.
- **Deep vs shallow modules (Ousterhout).** Глубокий модуль даёт простой интерфейс и прячет много функциональности. У мелкого интерфейс почти так же сложен, как реализация. https://freshman.tech/philosophy-of-software-design-summary
- **Дебаты Ousterhout и Martin (сентябрь 2024 – февраль 2025)** напрямую касаются противоречия «много мелких файлов против локальности». https://github.com/johnousterhout/aposd-vs-clean-code
  - Цитаты Ousterhout: «Entangled methods can usually be improved by combining them so that all the code is in one place», «Separating the pieces, even in physically adjacent methods, makes the code harder to understand».
  - О комментариях: «the cost of missing comments is easily 10-100x the cost of incorrect comments».
  - Martin признаёт, что декомпозицию можно перегнуть, но по умолчанию предпочитает мелкие методы. Для экстренной починки человеком нам ближе позиция Ousterhout.
- **Locality of Behaviour (Carson Gross, htmx).** Поведение единицы кода должно быть понятно из чтения только этой единицы. Автор различает inline-реализацию и inline-вызов/декларацию: локальным должно быть хотя бы место, где поведение объявлено. Принцип прямо конфликтует с DRY и Separation of Concerns, и это обсуждается открыто. https://htmx.org/essays/locality-of-behaviour/ , подкаст: https://shows.acast.com/dead-code/episodes/brutality-of-behaviour-with-carson-gross
- **Colocation (Kent C. Dodds):** «Place code as close to where it's relevant as possible». Тесты, стили, state и комментарии лежат рядом с кодом. Абрамов формулирует так: «Things that change together should be located as close as reasonable». https://kentcdodds.com/blog/colocation **[старое, 2019–2021, но актуально]**
- **Вывод о противоречии.** «Много мелких файлов» хорошо только тогда, когда каждый файл является глубоким модулем с понятным именем. Если для понимания одного сценария нужно открыть 5–7 файлов (component → hook → service → adapter → mapper → dto → constants), это и есть extraneous load.

**Выводы для бойлерплейта**
- Ввести правило «≤ 3 прыжка»: от роута до вызова API должно быть не больше трёх переходов по go-to-definition. Агент проверяет это на ревью.
- Слайс фичи хранить в одной папке: `features/checkout/{CheckoutPage.tsx, useCheckout.ts, checkout.api.ts, checkout.test.ts}`. Глобальных `services/`, `mappers/`, `utils/` по типу файла не заводить.
- Без слоёв «на будущее»: интерфейс появляется только при второй реализации.
- Лимиты поставить мягкие: файл ≤ 300–400 строк, функция ≤ 80. Нижнего лимита («≤ 15 строк») не ставить.
- Ошибки делать строковыми кодами (`'cart_item_out_of_stock'`), а не числами.

---

## 2. ADR (Architecture Decision Records)

- **Nygard (2011) [старое, канон]:** Title, Context, Decision, Status, Consequences. Context описывает силы, которые находятся в напряжении. В Consequences перечисляют все последствия, а не только позитивные. Статусы: proposed / accepted / deprecated / superseded (со ссылкой на замену). https://docs.arc42.org/tips/9-5/ , https://github.com/peter-evans/lightweight-architecture-decision-records
- **MADR 4.0.0 (17.09.2024), актуальная версия:** https://adr.github.io/madr/
  - Обязательные разделы: заголовок, Context and Problem Statement, Considered Options, Decision Outcome («Chosen option: …, because …»).
  - Опциональные разделы: Decision Drivers, Consequences, Confirmation, Pros and Cons of the Options, More Information. Front matter (`status`, `date`, `decision-makers`, `consulted`, `informed`) тоже опционален.
  - Имя файла `NNNN-title-with-dashes.md`, папка `docs/decisions/`. Есть варианты шаблона «bare» и «minimal».
- **Гос. практика (GDS, UK):** ADR лежат в репозитории рядом с кодом. https://gds-way.digital.cabinet-office.gov.uk/standards/architecture-decisions.html
- **ADR как контекст для агентов (2026).** У агента нет «коридорных разговоров» и неявного знания, он знает только то, что записано. ADR из вики можно отдать ему через MCP. https://bencane.com/posts/2026-05-28-coding-agent-architectural-context/
- **Skills для Claude Code** записывают решения из сессии в формате Nygard, но только после подтверждения человеком, автоматически ADR не создают. https://claudeskills.info/skills/affaan-m/ecc/architecture-decision-records/ **[вторичный источник, независимых бенчмарков пользы нет]**
- Когда писать ADR (практика из перечисленных источников): решение трудно откатить, затрагивает несколько пакетов, выбирает между двумя и более разумными вариантами или осознанно отклоняет «очевидный» вариант. Последнее особенно важно для агентов, иначе агент его «починит».

**Выводы для бойлерплейта**
- Хранить ADR в `docs/decisions/NNNN-*.md` в формате MADR minimal: Context, Options, Decision, Consequences. Объём 20–60 строк.
- В ADR обязательно писать раздел «Отклонено и почему». Это прямая защита от того, что агент «улучшит» код обратно.
- Завести `docs/decisions/README.md` с таблицей «№ | решение | статус». CLAUDE.md ссылается на этот индекс, но не тянет ADR через `@`, чтобы не тратить контекст.
- Отдельный «decision log» для агента не заводить. ADR и есть лог, а агент пишет новый ADR, когда меняет зафиксированное решение. Мелкие решения записывать одной строкой в `docs/decisions/log.md` (дата, что, почему).

---

## 3. Runbooks / playbooks для фронтенда

- **Google SRE:** заранее записанные инструкции в playbook дают «roughly a 3x improvement in MTTR as compared to the strategy of "winging it."» https://sre.google/sre-book/introduction/ **[старое, 2016, канон]**. Глава On-Call в SRE Workbook: https://sre.google/workbook/on-call/
- **Структура хорошего runbook** (сводка шаблонов 2025–2026):
  - Front matter: severity, owner, `last-tested`. Дальше Symptoms → Prerequisites (доступы) → Diagnosis → Mitigation → Verification → Escalation. https://gravitee.io/corpus/gen-258/process-management/observability-runbooks.html , https://frameworks.securityalliance.org/incident-management/incident-response-template/templates/runbook-template
  - Mitigation должна быть обратимой, с точными шагами отката. Поиск root cause не должен быть условием для mitigation: нужно ровно столько диагностики, сколько требуется для выбора безопасного действия. https://oneuptime.com/blog/post/2026-08-06-on-call-runbook-game-day-validation/markdown
  - Verification формулируется как измеримое условие («доля 5xx < X% в течение 10 мин»). Escalation срабатывает по таймеру: «если mitigation не помогла за 15 мин, звонить Y».
  - Runbook проверяют на game day: незнакомый с системой инженер проходит его в «3 часа ночи». Без этого runbook не считается рабочим (тот же источник oneuptime, 2026).
- **Откат Docker-образа:**
  - Тег `latest` ломает откат: «старая» ревизия снова тянет текущий `latest`. Деплоить надо по git SHA или digest. https://notes.kodekloud.com/docs/Hands-On-AWS-Project-Deploy-Your-First-Crypto-App/Rolling-deployment-and-Rollback-of-deployments/Understanding-why-manual-rollback-is-failing/page , https://www.chainguard.dev/unchained/how-i-learned-to-stop-worrying-and-love-the-latest-tag
  - Теги изменяемы по умолчанию, поэтому в реестре стоит включить tag immutability. https://docs.stackit.cloud/products/developer-platform/container-registry/how-tos/ensuring-image-integrity-with-immutability/
  - Теги по окружению (`:prod`) считаются антипаттерном. https://dev.to/peterj/docker-image-tagging-scheme-3kml
- **k8s:** `kubectl rollout undo deployment/web` откатывает на предыдущую ревизию, `--to-revision=N` на конкретную. Undo меняет только живой кластер, а не манифесты в Git, поэтому при GitOps откат делается через revert коммита. https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/kubectl_rollout_undo/ , https://www.plural.sh/blog/kubectl-rollout-undo-deployment/
- **Поломка зависимостей / supply chain:**
  - `minimumReleaseAge` появился в pnpm 10.16. Значение задаётся в минутах (1440 = сутки). Исключения задаёт `minimumReleaseAgeExclude`, паттерны поддерживаются с 10.17. **[не проверено]**: в pnpm 11 (апрель 2026) по умолчанию стоит 1440, настройка живёт в `pnpm-workspace.yaml`. https://lilting.ch/en/articles/pnpm-11-minimum-release-age-default-shai-hulud-defense , https://gist.github.com/mcollina/b294a6c39ee700d24073c0e5a4e93104
  - Известная проблема: Dependabot/Renovate PR падают, если свежая транзитивная зависимость (например, `caniuse-lite`) моложе порога. https://dev.classmethod.jp/en/articles/pnpm-11-minimum-release-age-dependabot-ci-failure/
  - Аналоги: npm `min-release-age` (в днях, CLI 11.10), Yarn `npmMinimalAgeGate` (4.10). https://github.com/npm/cli/pull/8825
- **Hotfix-флоу** (типовая практика, без отдельного источника): ветка `hotfix/<issue>` от тега текущего прода, затем CI собирает образ с SHA, деплой, потом merge обратно в main. Пока идёт починка, откат на предыдущий SHA выполняется одной командой.
- **API лежит:** maintenance page или degraded mode через runtime-флаг (см. раздел 6). Nginx отдаёт статический `maintenance.html` с кодом 503, его включение не требует пересборки.

**Выводы для бойлерплейта**
- Завести `docs/runbooks/` с файлами: `deploy.md`, `rollback.md`, `hotfix.md`, `deps-broken.md`, `api-down.md`, `maintenance-mode.md`, `sentry-triage.md`. Каждый файл ≤ 1 экрана.
- Шаблон runbook:
  ```md
  ---
  severity: high | owner: @team-web | last-tested: 2026-10-01
  ---
  ## Симптом      (что видит пользователь / алерт)
  ## Проверить    (команды copy-paste, ожидаемый вывод)
  ## Действие     (обратимое; точная команда отката)
  ## Убедиться    (измеримо: /version.json = SHA, ошибок в Sentry < N за 10 мин)
  ## Эскалация    (через 15 мин -> кому, контакты)
  ```
- Деплоить только `image:<git-sha>`. Держать `scripts/rollback.sh <sha>` или CI-job «Rollback» с вводом SHA. Последние 10 SHA показывать в `docs/runbooks/rollback.md` (как получить: `git log --oneline -10 origin/main` или список тегов из реестра).
- В `pnpm-workspace.yaml` задать `minimumReleaseAge: 1440`, точные версии (`save-exact`) и коммитить lockfile. В CI ставить `pnpm install --frozen-lockfile`.
- Раз в квартал проводить game day: незнакомый с проектом человек откатывает staging по runbook.
- «Runbook as code»: команды в runbook должны совпадать с `package.json`-скриптами или `scripts/*.sh`, а не дублироваться руками. Отдельного стандарта найти не удалось.

---

## 4. Документация для людей и для AI-агентов (2025–2026)

- **Anthropic, официальная позиция по CLAUDE.md:**
  - «keep it short and human-readable». Для каждой строки задавать вопрос «Would removing this cause Claude to make mistakes?», и если нет, удалять. «Bloated CLAUDE.md files cause Claude to ignore your actual instructions!» https://code.claude.com/docs/en/best-practices
  - Цель: меньше 200 строк на каждый CLAUDE.md. Инструкции для части кодовой базы выносятся в path-scoped `.claude/rules/*.md` с `paths:`. Импорты через `@` упорядочивают файл, но контекст не экономят. https://code.claude.com/docs/en/memory
  - Что включать: команды, которые нельзя угадать; стиль, который отличается от дефолта; тест-раннер; соглашения по веткам и PR; специфичные архитектурные решения; env-особенности; неочевидные gotchas. Что не включать: то, что выводится из кода; стандартные конвенции; подробную API-доку; часто меняющееся; пофайловое описание; «write clean code».
  - «IMPORTANT» ставить только на одну строку, которую систематически игнорируют. Правило, которое обязано выполняться всегда, оформлять хуком, а не текстом.
  - Многошаговые процедуры выносить в skills, тогда они грузятся по требованию.
  - Claude Code читает `AGENTS.md`, если CLAUDE.md нет (v2.1.277+). Если есть оба, читается только CLAUDE.md, если он не импортирует AGENTS.md.
  - Auto memory грузит первые 200 строк или 25KB.
- **AGENTS.md:** открытый формат, «README for agents». Используется в 60k+ репозиториев и находится под Agentic AI Foundation (Linux Foundation). В монорепо действует ближайший к редактируемому файлу AGENTS.md. Рекомендуемые разделы: overview, build/test, code style, testing, security. https://agents.md/
- **Diátaxis:** документация делится на 4 вида: tutorial (обучение), how-to (задача), reference (факты), explanation (почему). Главная ошибка состоит в смешивании, чаще всего explanation проникает в how-to. Лечится выносом объяснения в отдельный документ со ссылкой. https://diataxis.fr/start-here/
- **ARCHITECTURE.md (matklad) [старое, 2021, канон]:** https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html
  - «Keep it short: every recurring contributor will have to read it». В нём только то, что редко меняется; ревизия пару раз в год.
  - Codemap — «a map of a country, not an atlas of maps of its states».
  - **Имена, а не ссылки**: ссылки протухают, а символ находится поиском.
  - Явно описывать инварианты, особенно сформулированные через отсутствие («X не импортирует Y»), а также границы между слоями. Cross-cutting concerns вынести в отдельный раздел.
- Runbook по Diátaxis является how-to, ADR является explanation, ARCHITECTURE.md является explanation плюс codemap (reference). README отвечает за tutorial «запусти за 5 минут».

**Выводы для бойлерплейта**
- Корневой `CLAUDE.md` ≤ 150 строк: команды, инварианты, ссылки на `docs/`. Правила по пакетам держать в `apps/*/CLAUDE.md` или `.claude/rules/*.md` с `paths:`. Сделать `AGENTS.md` = `@CLAUDE.md` (или наоборот), чтобы не дублировать.
- `ARCHITECTURE.md` для людей ≤ 200 строк: codemap «где что лежит» в виде таблицы «хочу X → смотри `apps/shop/src/features/cart`», инварианты, границы.
- Отдельный `docs/EMERGENCY.md` на 1 экран. Это первый файл, который откроет человек ночью: как понять, какая версия на проде; как откатить; где логи и ошибки; ссылки на runbooks; контакты.
- Структура `docs/`: `tutorials/` (setup), `how-to/` + `runbooks/`, `reference/` (env-переменные, скрипты), `decisions/` (ADR), `ARCHITECTURE.md`.
- Проверка в CI: `wc -l CLAUDE.md` ≤ 200, плюс проверка на битые пути в codemap (скрипт ищет упомянутые пути через `test -e`).

---

## 5. Отладка фронтенда в продакшене

- **Source maps без публикации:**
  - `build.sourcemap: 'hidden'` в Vite плюс `sentryVitePlugin` (последним в списке плагинов) и `sourcemaps.filesToDeleteAfterUpload: ['./dist/**/*.map']`. Альтернатива: nginx отдаёт 404 на `*.map`. https://docs.sentry.io/platforms/javascript/guides/react-router/sourcemaps/uploading/vite/
  - В dev/watch плагин ничего не загружает, проверять нужно на production build. Токену нужны scopes `project:releases`, `org:read`.
- **GlitchTip (self-hosted):** в 2024 был баг — sentry-cli 2.33 падал на шаге finalize release (нет эндпоинта). Статус проверить. https://gitlab.com/glitchtip/glitchtip-backend/-/issues/342 **[возможно устарело]**
  - Рабочий путь для Sentry-совместимых серверов: `sentry-cli sourcemaps inject ./dist && sentry-cli sourcemaps upload --url $URL ./dist`. Не смешивать с `sentryVitePlugin`, иначе debugId перезапишется. https://www.bugsink.com/docs/vite-integration-guide/
- **Release tagging:** `release = <app>@<git-sha>` должен совпадать в SDK `init`, при загрузке source maps и в теге Docker-образа. Это одна строка, которая связывает ошибку, коммит и образ (практика из доки Sentry по releases).
- **Trace propagation:**
  - В браузерном Sentry SDK `tracePropagationTargets` по умолчанию `['localhost', /^\//]`, то есть только same-origin. Для внешнего API нужно добавить его URL.
  - `propagateTraceparent: true` добавляет W3C `traceparent` (формат `00-<32hex trace-id>-<16hex span-id>-01`, https://www.w3.org/TR/trace-context/).
  - Бэкенд должен разрешить `sentry-trace`, `baggage`, `traceparent` в `Access-Control-Allow-Headers`.
  - https://docs.sentry.io/platforms/javascript/guides/react/tracing/distributed-tracing/dealing-with-cors-issues
- **Request/correlation id:** если бэкенд не на OTel/Sentry, генерировать `X-Request-Id` (`crypto.randomUUID()`) в fetch-обёртке, класть его в breadcrumb или тег ошибки и показывать пользователю в тексте ошибки («Код: a1b2c3»). Это стандартная практика, отдельного источника не искали.
- **Session replay:** в примерах Sentry стоят `replaysSessionSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0`, `maskAllText: true`, `blockAllMedia: true`. Тела и заголовки сетевых запросов включаются только явно (opt-in). В canvas PII не маскируется. https://docs.sentry.io/platforms/javascript/session-replay
  - Для Telegram Mini App и магазина (ПДн, адреса, телефоны) разумно `replaysSessionSampleRate: 0` и запись только при ошибке, маски не отключать.
- **Error boundaries с контекстом:** на уровне роута и фичи, а не одна на всё приложение. В `onError` передавать `Sentry.captureException(err, { tags: { feature, route } })`. Fallback показывает версию (SHA) и request id.
- **Build info:** при сборке генерировать `/version.json` вида `{ "version": "1.4.2", "sha": "abc1234", "builtAt": "..." }` и показывать SHA в футере админки или в `?debug`. Это первая проверка в любом runbook: «что сейчас на проде?».
- **Структурированные логи в браузере:** не `console.log` по коду, а тонкий `logger.{info,warn,error}(event, ctx)`. В prod он пишет только в Sentry breadcrumbs, в dev в консоль.

**Выводы для бойлерплейта**
- Пакет `packages/observability`: `initSentry({ app, release, dsn })`, `logger`, `RouteErrorBoundary`, `withRequestId(fetch)`. Всё явно, без глобальной магии.
- Vite: `sourcemap: 'hidden'` плюс удаление `.map` после загрузки, а nginx на всякий случай отдаёт `location ~* \.map$ { return 404; }`.
- `version.json` и SHA в UI сделать обязательными для всех apps.
- Replay выключен по умолчанию. Включение только on-error и только с масками.

---

## 6. Feature flags и kill switches

- **Таксономия (Hodgson/Fowler, 2016) [старое, канон]:** release, ops, experiment, permission. Ops-toggles работают как «panic button / circuit breaker», то есть kill switch. Число флагов нужно сдерживать. https://martinfowler.com/articles/feature-toggles.html , https://www.infoq.com/news/2016/02/featuretoggles/
- **Unleash, гигиена флагов:**
  - Ожидаемое время жизни по типу: release и experiment 40 дней, operational 7 дней, kill switch и permission бессрочно. После этого срока флаг автоматически получает статус «potentially stale». Сроки можно настроить.
  - С v7.1 можно пометить флаг «Ready for cleanup».
  - Frontend SDK использует отдельные frontend-токены.
  - https://docs.getunleash.io/reference/feature-toggle-types , https://www.getunleash.io/blog/unleash-7-1
- **OpenFeature:** CNCF-стандарт, vendor-neutral API. В вебе используются `@openfeature/web-sdk` и React-обёртка. OFREP (OpenFeature Remote Evaluation Protocol) работает через `@openfeature/ofrep-web-provider`, провайдер можно сменить без переписывания кода. https://docs.growthbook.io/lib/openfeature , https://pydantic.dev/docs/logfire/manage/client-side-feature-flags
- **Self-hosted варианты:** Unleash (данные остаются у себя), Flagsmith (self-hosted бесплатно, без лимитов), GrowthBook (self-hosted бесплатно, сильные эксперименты). https://posthog.com/blog/best-open-source-feature-flag-tools **[сравнение от вендора]**
- **Runtime config без сервиса флагов:** образ собирается один раз, а при старте контейнера entrypoint пишет `env.js` или `config.json` из переменных окружения. Приложение читает его до рендера. Всё, что попадает в клиент, публично, секреты туда класть нельзя. https://dev.to/imzihad21/runtime-environment-variables-for-react-apps-with-nginx-and-docker-3p62 , https://env.dev/guides/build-time-env-variables
- **Maintenance mode:** флаг `maintenance: true` в runtime-config включает полноэкранную заглушку без запросов к API. Для полного отключения nginx отдаёт `maintenance.html` с 503, переключение файлом или переменной без пересборки.

**Выводы для бойлерплейта**
- Уровень 0, по умолчанию без внешних сервисов: `public/config.json`, который генерирует entrypoint. Читается через `fetch('/config.json', { cache: 'no-store' })` до монтирования React и валидируется zod-схемой. Kill switch переключается так: поменять env, перезапустить контейнер (без пересборки), проверить.
  ```json
  { "apiBaseUrl": "...", "maintenance": false,
    "killSwitches": { "payments": false, "tgCheckout": false } }
  ```
- Уровень 1: OpenFeature web SDK с провайдером, который читает тот же `config.json`. При росте подключается Unleash или GrowthBook заменой провайдера.
- Гигиена: каждый флаг описан в `flags.ts` с полями `owner`, `createdAt`, `expiresAt`, `type`. ESLint или CI-скрипт падает, если `expiresAt` в прошлом и тип не `kill-switch`.
- В `docs/runbooks/maintenance-mode.md` и `kill-switch.md` — точные команды.

---

## 7. Как сохранить AI-генерированный код читаемым

- **GitClear 2025** (211 млн изменённых строк, 2020–2024):
  - Блоки дубликатов из 5+ строк выросли примерно в 8 раз в 2024.
  - Moved lines (признак рефакторинга) упали на 39.9%. 2024 стал первым годом, когда copy-paste строк было больше, чем перемещённых.
  - Доля рефакторинга в изменённых строках снизилась с ~25% (2021) до <10% (2024).
  - Объяснение авторов: ассистенту проще вставить блок, чем найти существующую функцию, поскольку контекст ограничен.
  - https://devclass.com/2025/02/20/ai-is-eroding-code-quality-states-new-in-depth-report/ , https://www.gitclear.com/media
  - Цифры churn за 2025 (7.1%) взяты из вторичных источников **[не проверено]**.
- **CodeRabbit, декабрь 2025** (470 PR: 320 с участием AI, 150 человеческих):
  - В среднем 10.83 замечания на AI-PR против 6.45 у человеческих, то есть ~1.7x.
  - Critical в 1.4 раза больше, major в 1.7 раза. Readability-замечаний больше чем в 3 раза, logic и correctness на ~75% больше.
  - Выборка небольшая, а автор отчёта продаёт AI-ревью.
  - https://coderabbit.ai/blog/state-of-ai-vs-human-code-generation-report , https://www.theregister.com/2025/12/17/ai_code_bugs/
- **Контрданные: «Echoes of AI» (Borg и соавт., 2025, Empirical SE).** Преригистрированный эксперимент на 151 участнике (95% профессионалы). Когда другие разработчики развивали код, написанный с AI, **значимых различий по времени и качеству не нашли**. Риски, которые авторы отмечают: раздувание кода (bloat) и «cognitive debt». https://arxiv.org/abs/2507.00788
  - Вывод: AI-код сам по себе не обязательно хуже читается, проблемы начинаются в масштабе (дубли, отсутствие рефакторинга). Это лечится процессом.
- **Сама Anthropic предупреждает:** если ревьюер-агенту велено искать проблемы, он их найдёт всегда. Если гоняться за каждой находкой, получается over-engineering: «extra abstraction layers, defensive code, and tests for cases that can't happen». https://code.claude.com/docs/en/best-practices
- **Паттерны «AI slop»** (практические чек-листы 2025–2026, не стандарт):
  - factory, strategy или abstract base при единственной реализации;
  - null-checks и try/catch вокруг кода, который не может бросить; back-compat shims без потребителей;
  - комментарии, пересказывающие код, тривиальные JSDoc, закомментированный код;
  - лишние ветки, «умное» решение вместо простого.
  - Источники: https://skills.sh/asyrafhussin/agent-skills/code-slop , https://managed-code.com/blog-post/ai-slop-in-code , https://tianpan.co/forum/t/what-does-a-good-ai-code-review-checklist-actually-look-like/2440

**Выводы для бойлерплейта**
- Чек-лист ревью AI-PR (в `.github/pull_request_template.md` и в skill ревьюера):
  1. Нет ли уже такой функции или компонента? (поиск по имени и смыслу; цель — дубли)
  2. Каждая новая абстракция имеет ≥ 2 потребителей?
  3. try/catch и `?.` стоят только там, где ошибка или null реально возможны?
  4. Комментарии объясняют «почему», а не «что»?
  5. Нет мёртвого кода (knip), неиспользуемых экспортов и закомментированного кода?
  6. Новый сценарий читается за ≤ 3 прыжка?
  7. PR ≤ ~400 строк диффа без учёта сгенерированного кода?
- Автоматизация: `knip` (мёртвый код и экспорты), `jscpd` с порогом дублей в CI, ESLint `complexity`/`max-depth`, `import/no-cycle`.
- Ревьюер-агенту прямо указать: «флагай только то, что влияет на корректность и требования».

---

## 8. Пределы магии

- **DI-контейнеры с декораторами (tsyringe, inversify) во фронтенде:**
  - Они требуют `experimentalDecorators` + `emitDecoratorMetadata` + `reflect-metadata`.
  - esbuild, на котором Vite компилирует TS, **не эмитит decorator metadata**. Декоратор отрабатывает, но `design:paramtypes` оказывается `undefined`, и ошибка проявляется только в рантайме («TypeInfo not known»). https://dev.to/eljoy/your-decorator-library-silently-breaks-on-vite-heres-why-and-a-fix-ts-jackson-20-fdg , https://github.com/oven-sh/bun/issues/4677
  - Обходные пути: SWC-плагин или сторонние vite-плагины для метаданных. Это ещё один слой хрупкой магии. https://electron-vite.org/guide/typescript-decorator
  - Стандартные TC39-декораторы (TS 5.0+, без флага) **несовместимы с `emitDecoratorMetadata`** и не поддерживают декораторы параметров, а именно на них построена constructor injection в tsyringe и inversify. https://devblogs.microsoft.com/typescript/announcing-typescript-5-0-beta/ . Decorator Metadata (`Symbol.metadata`) дошла до Stage 3 и поддерживается с TS 5.2 **[версию сверить]**. https://www.npmjs.com/package/reflect-metadata
  - Вывод: в React DI естественно делать через props, context и модули ES. Контейнер добавляет невидимые связи, и go-to-definition приводит в никуда.
- **Barrel-файлы:**
  - TkDodo (07.2024): Next.js-проект грузил 11k модулей, dev-старт занимал 5–10 с. После удаления внутренних barrels осталось ~3.5k модулей (−68%). Barrels порождают циклы импорта и не дают реальной приватности. Оправданы только как публичная точка входа библиотеки. https://tkdodo.eu/blog/please-stop-using-barrel-files
  - Atlassian (Jira, тысячи пакетов): удаление barrels дало −75% времени сборки и ускорило TS-подсветку и unit-тесты. https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files
  - Vite официально: «If possible, you should avoid barrel files and import the individual APIs directly». Также рекомендует явные расширения (`moduleResolution: "bundler"`, `allowImportingTsExtensions`). https://vite.dev/guide/performance
- **Кодогенерация (OpenAPI):**
  - hey-api в стадии «initial development», рекомендует пинить точную версию (`-E`). Вывод генератора: `src/client`. https://heyapi.dev/openapi-ts/get-started
  - Официальной позиции «коммитить или нет» у hey-api и orval найти не удалось. Есть пример генерации в CI с публикацией пакета без коммита. https://github.com/InformaticsMatters/squonk2-openapi-js-client-generator
  - Пометка в `.gitattributes`: `packages/api-client/src/gen/** linguist-generated`. Такие файлы исключаются из статистики языков и **свёрнуты по умолчанию в диффах** GitHub. https://docs.github.com/en/repositories/working-with-files/managing-files/customizing-how-changed-files-appear-on-github . В GitLab атрибут `gitlab-generated` делает то же самое **[не проверено в этой сессии]**.
  - Аргумент за коммит для нашего сценария: ночью без сети и без доступа к спеке человек видит точные типы и эндпоинты прямо в репо, а `git diff` при обновлении спеки показывает, что поменялось в контракте.

**Выводы для бойлерплейта**
- Запрещено: DI-контейнеры, `reflect-metadata`, `experimentalDecorators`, `emitDecoratorMetadata`. Проверка в tsconfig и ESLint (`no-restricted-imports` для `tsyringe`, `inversify`, `reflect-metadata`).
- Запрещены внутренние barrels (`index.ts` с re-export) внутри apps. Разрешён ровно один `index.ts` в корне каждого пакета `packages/*`, и он же `exports` в package.json. ESLint: `no-restricted-imports`/`import/no-cycle`, либо `eslint-plugin-no-barrel-files`.
- Генерированный API-клиент **коммитить**: `packages/api-client/src/gen/`, первая строка каждого файла `// AUTO-GENERATED by @hey-api/openapi-ts — do not edit; run pnpm gen:api`, в `.gitattributes` прописать `linguist-generated` и `gitlab-generated`. В CI проверять `pnpm gen:api && git diff --exit-code`, чтобы сгенерированный код не разъезжался со спекой. Версию генератора пинить точно.
- Магия, которая допустима: только та, которую видно в коде (явный вызов функции, явный провайдер в дереве). Никаких авто-регистраций по файловой системе, кроме file-based routing, если он выбран, и тогда он описывается в ARCHITECTURE.md.

---

## Сводка ключевых чисел

| Что | Число | Источник |
|---|---|---|
| CLAUDE.md | < 200 строк на файл | code.claude.com/docs/en/memory |
| Рабочая память | ~4 чанка | github.com/zakirullin/cognitive-load |
| Playbook и MTTR | ~3x лучше | sre.google/sre-book/introduction |
| AI-дубли 5+ строк | ×8 (2024) | GitClear 2025 |
| AI-PR замечаний | ×1.7 | CodeRabbit 12.2025 |
| Barrels → сборка Jira | −75% | Atlassian |
| Barrels → модулей в dev | −68% | TkDodo |
| pnpm minimumReleaseAge | 1440 мин | pnpm 10.16+/11 |
| Unleash lifetime release/ops | 40 / 7 дней | docs.getunleash.io |
| Replay on-error / session | 1.0 / 0.1 (пример Sentry) | docs.sentry.io |
