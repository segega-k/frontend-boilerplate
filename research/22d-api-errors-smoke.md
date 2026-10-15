# 22d. Wave 0 · агент D: API-клиент и pipeline маппинга ошибок (smoke)

Status: done · 2026-10-15 · ветка `worktree-agent-a9fc409ce490ce299`

## Resume notes
- Done: всё из задачи плюс правило пользователя «шаблон не привязан к контракту бэкенда» (сообщения координатора
  во время работы): библиотека `packages/api` отделена от фикстуры `examples/sample-backend`, auth через `AuthAdapter`,
  health-probe настраивается, контракт ошибок (problem+json `type`, 403-маркер, 503 maintenance) фиксирован.
  Спайк `spikes/api/` (pnpm 11 workspace: 2 пакета + 1 пример), 71 тест зелёный, `tsc` чистый, `errors:check` и
  `i18n:check` зелёные на закоммиченном состоянии.
- Next: ничего. Если продолжать: React-оболочка `PageQueryGuard`/`GlobalToasts`/`FailureScreen` (в спайке только
  headless-логика), drift-тест `api:gen`, ESLint-правило barrel.
- Sub-agent: не использовался.

## Summary
1. Механизм xRocket переносится 1:1 на `openapi-typescript 7.13.0` + `openapi-fetch 0.17.0`: `schemaPath` в middleware,
   порядок `onRequest` прямой / `onResponse` и `onError` обратный, ответ из `onRequest` обрывает всю цепочку
   `onResponse` — всё проверено тестом на 0.17.0 (xRocket проверял на 0.14.1).
2. Цепочка `[appStatusGate, auth, maintenance, responseResolution, bannedGuard, retry, unauthorized]` закреплена тестом:
   имена, фактический порядок вызовов и отрицательный тест (если поменять resolution и retry местами, `_resolution`
   теряется).
3. Все e2e-подобные сценарии критерия выхода волны 1 проходят на настоящих клиентах openapi-fetch с фейковым бэкендом:
   тост на 4xx, модалка через guard, NET-тост через `onError`, 403 banned → `banned` → 503 от gate, maintenance, 401 по
   старому токену не разлогинивает, плюс single-flight refresh.
4. Свой генератор: спека + `mappings/<svc>.json` → `<svc>.generated.ts` (данные с `satisfies VariantsOf`, `I18nParams`,
   фабрики query/mutation) + `index.generated.ts`. Вариант, которого нет в спеке, ломает `tsc` (проверено
   `@ts-expect-error`-тестом).
5. CLI на общей библиотеке (`--json` везде): `errors:add|set|list|sync|check`, `i18n:set|missing|check|sync|split|validate`.
   Маппинги в спайке созданы самим CLI (`examples/sample-backend/scripts/seed-mappings.sh`), то есть «агентский» путь проверен целиком.
6. Найдено и исправлено: баг xRocket с массивом в теле 2xx; ловушка discriminator без `mapping` в openapi-typescript;
   MobX 7 убрал `observable.shallow`; гипотеза xRocket §4.8 (оффлайн на старте → `app`) подтверждена и закрыта.
7. Нативный TS в Node 24.18 (type stripping) работает для CLI из кириллического пути без `tsx`.
8. Библиотека не знает ни одного эндпоинта и формата авторизации: всё про конкретный бэкенд — в `AuthAdapter`
   (готовые `noAuth`, `BearerTokenAuth`, `CookieSessionAuth`), probe восстановления (URL или «только `online`») и
   данных проекта (спека, маппинг, каталог), пути к которым задаёт `devtools.config.json`. Тест
   `neutral-defaults.test.ts` гоняет библиотеку без генератора и без примера. См. «Backend contract surface».

## Results

| Механизм | Результат | Примечание |
| --- | --- | --- |
| openapi-typescript 7.13 по OpenAPI 3.1 (`const`, problem+json) | работает | `const` → literal; peer `typescript ^5.x`, с TS 6.0.3 только warning |
| discriminator `oneOf` без `mapping` | обход | генератор подставляет имя схемы как `type`; в спеке нужен явный `mapping` |
| openapi-fetch 0.17: порядок хуков, обрыв `onResponse` из gate, `onError` | работает | проверено тестом с трассировкой |
| Порядок middleware (тест-замок) | работает | + отрицательный тест |
| Lookup exact → METHOD_2xx → METHOD_ERR → null, ключ `service:schemaPath` | работает | |
| toast из middleware в `ToastsStore`, Support с кодом только для ERR/≥500 | работает | |
| modal через `_resolution` → `MobxQuery.rawResolution` → guard | работает | guard headless (без React) |
| custom через `toResult(t, params)`, silent | работает | |
| NET-тост через `onError` + дедуп 3 с, AbortError без UI | работает | новое относительно xRocket |
| retry: только GET и ≥ 500, 1s·2^n ≤ 30s | работает | maintenance-503 не ретраится (изменение) |
| 401: single-flight refresh → retry once → clear только текущей сессии; BFF; старый токен | работает | тело POST сохраняется для повтора |
| 403 banned (привязка к токену запроса) → `banned` → gate 503 | работает | поздний 403 со старого токена не банит |
| 503 maintenance → `maintenance` → gate | работает | |
| `appStatus` computed: initial/app/no-network/server-error/banned/maintenance | работает | |
| Оффлайн на старте (paused query) | исправлено | xRocket давал `app`; у нас `no-network` |
| no-network: `online` + health-ping (raw fetch мимо gate) → recover | работает | recover = reload по умолчанию |
| Генератор TS из JSON + `satisfies VariantsOf` | работает | drift-тест: generated == render(JSON) |
| JSON Schema маппинга (ajv 8.20, draft 2020-12) | работает | |
| `errors:check` (ERR/NET/2xx, variants ⊆ spec, тексты в en+ru, params = `{{vars}}`) | работает | |
| i18n `translations/{all,en,ru}/apiErrors.json`: sync/split/validate | работает | гомоглифы, теги, vars, плюрали |
| CLI на Node 24 type stripping, путь с кириллицей | работает | ~0.45–0.6 с на вызов |
| MobxQuery v2 minimal (QueryObserver → atom) | работает | без SSR-синка и гонок гидрации |

## Details

### Версии (точные; правило «последний патч старше 7 дней» на 2026-10-15)

| Пакет | Версия | Комментарий |
| --- | --- | --- |
| Node | 24.18.0 | `C:/Users/Сергей/.local/node-v24.18.0-win-x64` |
| pnpm | 11.28.5 (corepack, `packageManager`) | latest 12.11.2 — план требует 11 |
| typescript | 6.0.3 | latest 7.0.2; план — TS 6 |
| openapi-typescript | 7.13.0 | peer `typescript ^5.x` → unmet peer warning, работает |
| openapi-fetch | 0.17.0 | |
| @tanstack/query-core | 5.104.1 | 5.104.2 моложе 7 дней |
| mobx | 7.0.6 | |
| i18next | 26.4.2 | 26.4.5 моложе 7 дней |
| ajv | 8.20.0 | |
| vitest | 5.0.3 (vite 8.3.4) | 5.0.4 моложе 7 дней |
| @types/node | 24.19.1 | |

Глобально ничего не ставилось. `openapi-react-query` не нужен: фабрики генерируем сами.

### Раскладка спайка
```
spikes/api/
  package.json (scripts api:gen, api:mappings:gen, errors:*, i18n:*, typecheck, test), pnpm-workspace.yaml, tsconfig.json
  devtools.config.json                     # где лежат спеки/маппинги/каталоги (здесь — в examples/)
  packages/api/                            # БИБЛИОТЕКА: ни эндпоинтов, ни формата auth
    src/contract.ts                        # AuthAdapter + noAuth; описание фиксированного контракта ошибок
    src/errors/{types,resolve,translate,loadError}.ts, mapping.schema.json
    src/middleware/{gate,resolution,guards,setup,types}.ts   # setup: MIDDLEWARE_ORDER, createServiceClient
    src/query/{MobxQuery,factories}.ts     # MobxQuery v2 minimal, MobxMutation, callApi
    src/state/{AppStore,AuthStore(BearerTokenAuth, CookieSessionAuth),UserStore,ToastsStore,pageQueryGuard,networkRecovery}.ts
    src/{createRuntime,runtime,i18n,index}.ts
    tests/neutral-defaults.test.ts         # библиотека без генератора и без примера
  packages/devtools-core/src/{cli,mapping,i18n,spec,generate,fsx,project}.ts + tests/{cli,lib}.test.ts
  examples/sample-backend/                 # ФИКСТУРА: один возможный бэкенд, не часть библиотеки
    specs/{auth,wallet}.json               # OpenAPI 3.1: 2 сервиса, 8 операций, problem+json, 403 user_blocked, 503 maintenance
    src/generated/{auth,wallet}.ts         # openapi-typescript
    src/mappings/<svc>.json                # ДАННЫЕ маппинга (правит CLI/utils/человек)
    src/mappings/<svc>.generated.ts, index.generated.ts      # импортируют только '@repo/api'
    src/api.ts, src/app.ts                 # wiring: клиенты, BearerTokenAuth с refresh через /auth/refresh, health-probe
    translations/{all,en,ru}/apiErrors.json
    scripts/seed-mappings.sh               # как получены маппинги: только команды CLI
    tests/{middleware-order,resolve,pipeline,app-status}.test.ts, variants.typecheck.ts, harness.ts
```

### Команды и цифры
```
corepack pnpm install                 # 7.8 s холодный (76 пакетов, store переиспользован), 0.7 s повторно
pnpm api:gen                          # 2 сервиса, ~35 ms на спеку внутри openapi-typescript
sh examples/sample-backend/scripts/seed-mappings.sh         # 45 вызовов CLI за 18.6 s → ~0.41 s на вызов (старт Node + strip types)
node packages/devtools-core/src/cli.ts errors:check --json   # 0.57 s
pnpm exec tsc -p tsconfig.json --noEmit                      # 1.6 s, 0 ошибок
pnpm exec vitest run                  # 7 файлов, 71 тест, 13.7 s (~12.5 s из них — 13 CLI-тестов через spawn)
```
API-тесты без CLI идут за ~0.7 s.

### Формат данных маппинга (решение спайка)
Смесь [18 §5.3] и [19]: ключ — `operationId` (как в 19), в записи `path` и `method`, варианты без метода, как в 18
(`"200"`, `"400_/api/problems/x"`, `"ERR"`, `"NET"`); генератор собирает runtime-строку `POST_400_/api/problems/x`.
Поля записи: `variants, type, severity, support?, i18n{title,subtitle?}, params?, draft?, comment?`. Схема требует
`i18n` для `toast|modal|custom`. Ключи текстов — camelCase от английского текста без `{{var}}` и без числовых
суффиксов; одинаковый английский текст переиспользует существующий ключ; конфликт ключа с другим текстом — ошибка,
нужен явный `--title <key>`. Ключи `<svc>.<op>.<slug>` из [19] не взяты: мастер-план следует 18.

### Что делает каждый middleware (отличия от xRocket выделены)
- `appStatusGate.onRequest`: синтетический 503 при `no-network|server-error|banned|maintenance`.
- `auth.onRequest`: **`rt.auth.applyAuth(request)` — формат заголовка решает адаптер** (xRocket: жёсткий `Bearer`).
  **Сторы не из DI-контейнера, а из `ApiRuntime`, который передаётся в `createServiceClient(svc, rt, …)`** — на SSR
  runtime создаётся на запрос (чинит xRocket §4.7).
- `maintenance.onResponse` (**новое**): 503 + `type` из конфига (`/api/problems/maintenance`) или legacy
  `message: PLATFORM_MAINTENANCE` → `appStore.setMaintenance(true)`.
- `responseResolution.onResponse` как в xRocket; **параметры интерполяции тоста берутся из примитивных полей тела**
  (xRocket тост переводил без params); **на SSR (`isClient() === false`) тост не пушится**; **`onError`: NET-тост с
  дедупом на runtime (общий для всех клиентов), `AbortError` игнорируется, ошибка пробрасывается как была**.
- `bannedGuard`: 1:1 (маркер, привязка к токену запроса, `UserStore.markBanned`/`isBanned` 1:1).
- `retry`: 1:1, но **ретрай идёт через `options.fetch` клиента, а не глобальный `fetch`**, и **maintenance-503 не
  ретраится** (иначе экран maintenance появлялся бы через 7 с).
- `unauthorized`: **`onRequest` сохраняет `request.clone()`** (fetch съедает тело POST), `onResponse`:
  `classifyUnauthorized` 1:1, но по `credentialOf(request)`/`currentCredential()` адаптера → anonymous: ничего;
  superseded: **один повтор с текущей сессией** (в xRocket просто выход); current: **у адаптера нет `refresh`** (cookie/BFF,
  `noAuth`) → clear (xRocket), **есть `refresh`** → один общий refresh на адаптер (single-flight в библиотеке) → повтор
  → если не помогло и сессия всё ещё та же → clear. Повторённый ответ проходит retry/bannedGuard/resolution
  (unauthorized последний в массиве).
- `bannedGuard` привязывает бан к `auth.credentialOf(request)` (xRocket: к Bearer-токену).
- Клиент `kind: 'sign-in'` (login/refresh): `[maintenance, responseResolution, bannedGuard]` (xRocket auth-клиент: без
  maintenance).

### Найдено в спайке
1. **Баг xRocket (latent):** resolution пересоздаёт тело как `{ _httpStatus, ...body, _resolution }`. Для 2xx с
   маппингом (даже `silent`) и телом-массивом получается `{0: …, 1: …, _resolution}` — данные ломаются. Поймано тестом
   `GET /balances` → массив. Исправлено: штампуем только plain-object тела. Следствие: у 2xx-массива нет
   `_resolution`, поэтому `modal`/`custom` на успешный ответ-массив прочитать нельзя (тост работает).
2. **openapi-typescript + discriminator без `mapping`** генерирует `type: "InsufficientBalanceProblem"` (имя схемы, по
   спецификации OpenAPI) вместо `const` — `VariantsOf` и маппинг разъезжаются молча. Правило для бэкенда/спеки:
   discriminator по `type` только с явным `mapping`. Наш `spec.ts` читает и `mapping`, и `const`.
3. **MobX 7**: `observable.shallow/ref/struct`, `action.bound`, `comparer.*` удалены → `observableShallow` и т. п.
   (CHANGELOG 7.0.0). Касается rules и примеров в доках волны 1.
4. **`erasableSyntaxOnly` (нужен для Node type stripping)** запрещает parameter properties
   (`constructor(private x)`) и `enum`. xRocket-стиль сторов надо переписать на явные поля.
5. **Оффлайн на старте:** запрос в паузе (`onlineManager` offline) имеет `status` `initial`, не `failed`; в xRocket
   `appStatus` был бы `app` с пустым профилем. У нас foundation-запрос без данных с `errorKind === 'network'` даёт
   `no-network` (тест).
6. **Ловушка `all/` в обе стороны:** `i18n:sync` = merge (языки → all) + split, поэтому текст, удалённый только из
   `all/`, возвращается из `ru/` при следующем sync (как и наоборот в xRocket). Удалять ключ нужно в обоих местах
   или отдельной командой (её нет — см. Open issues).
7. Node 24.18 type stripping импортирует `.ts` воркспейс-пакетов через симлинк без проблем; путь с кириллицей не мешает
   ни Node, ни Vitest 5, ни tsc.

### Что сделано не как в xRocket и почему
- Маппинг — JSON-данные в репо + JSON Schema, тексты — i18next namespace `apiErrors` (решение плана; xRocket — TS из
  Strapi с собственным словарём).
- Ключ runtime-реестра — сервис + `schemaPath` (xRocket склеивал spread-ом, одинаковые пути затирались).
- `VariantsOf` берёт статус из ключа ответа и принимает любой JSON media type (`application/problem+json`), без
  fallback на `string` для legacy API — все бэкенды на problem+json (решение 17). xRocket читал `status` из тела и
  только `application/json`.
- queryKey `['<svc>','get','<path>',init]`, mutationKey `['<svc>','<method>','<path>']`, NET-lookup через `meta`
  (`{service, method, path}`), а не через позицию в ключе.
- Фабрики создаются от клиента (`createWalletQueries(client)`), клиенты — от runtime (`createServiceClient(svc, rt, opts)`), без модульных
  синглтонов. Поэтому TDZ-проблема barrel из xRocket (§1.8) снимается по построению; barrel всё равно единственная
  точка импорта.
- PageQueryGuard и FailureScreen проверены как headless-логика (`pageQueryGuardState`, `appStatus`), без React: React
  в спайке не ставился, это работа kit в волне 1. Тексты guard временно в `apiErrors.guard.*` (по плану — `common`).
- TMA-логин-ветка `appStatus` не воспроизводилась (app-специфична).
- Recovery: `recover` по умолчанию — полный reload (как кнопка в xRocket, без deadlock); in-app refetch не делали.

## Backend contract surface

Правило пользователя: шаблон не привязан к конкретному бэкенду; только базовый код подключения и минимальные
ожидания. Ниже полный список того, что библиотека ожидает от **любого** бэкенда, и все точки настройки.

### Фиксированный минимум (не настраивается, семантика xRocket)
| Ожидание | Где в коде | Что будет, если бэкенд не соблюдает |
| --- | --- | --- |
| Ошибки — JSON-тело (`content-type` содержит `json`), ключ ошибки — поле `type` (problem+json); NestJS-поле `name` принимается как fallback, как в xRocket | `middleware/resolution.ts` | ответ с ошибкой матчится только через `METHOD_ERR` (catch-all), тост/модалка всё равно есть |
| Бан — HTTP 403 + `blocked`/`banned` в `type`, `name`, `instance` или `kind` | `errors/loadError.ts#isBannedResponse` | фатального экрана `banned` не будет |
| Техработы — HTTP 503 + `type: /api/problems/maintenance` (legacy: `message: PLATFORM_MAINTENANCE`) | `errors/loadError.ts#isMaintenanceResponse` | вместо экрана maintenance — обычная ошибка/ретраи |
| Ошибки статусов ≥ 400 значат ошибку, 2xx — успех; 5xx на GET безопасно повторять | `guards.ts#retryMiddleware` | — |
| Спека OpenAPI (3.x) с `operationId` и literal `type` (`const`/`enum`; discriminator — с явным `mapping`) | `devtools-core/spec.ts`, `VariantsOf` | без literal `type` вариант не выводится, ошибка покрывается только `ERR` |

Больше ничего: ни одного обязательного эндпоинта, ни формы успешных тел, ни формата авторизации, ни health-URL.

### Точки настройки (адаптеры и конфиг с нейтральными значениями по умолчанию)
| Точка | API | По умолчанию | Готовые варианты |
| --- | --- | --- | --- |
| Авторизация и смысл 401 | `AuthAdapter { isInitialized, isAuthorized, applyAuth(req), credentialOf(req), currentCredential(), refresh?(), clearSession() }` в `createRuntime({ auth })` | `noAuth` (анонимный API) | `BearerTokenAuth({ header?, scheme?, refresh? })` (схема `Bearer`/`tma`/raw), `CookieSessionAuth` (BFF, без refresh); refresh только если адаптер его дал |
| Probe восстановления `no-network` | `startNetworkRecovery({ ping })` | обязателен выбор приложения | `healthPing(fetch, url)` (любой URL с 2xx, тело не читается), `onlineEventOnly` (без запроса; первый запрос после recover — реальная проверка) |
| Что делает восстановление | `recover` | приложение передаёт (обычно `location.reload()`) | — |
| Базовый URL, `fetch`, `credentials` | `createServiceClient(svc, rt, { baseUrl, fetch?, credentials?, kind? })` | ленивый `globalThis.fetch`, `include` | `kind: 'sign-in'` для login/refresh-клиента |
| Тексты | `createRuntime({ t })`, `createApiErrorsT(resources, lng)` | ключ как текст | i18next, namespace `apiErrors` |
| UI-окружение | `isClient`, `openSupport(text)`, `netToastDedupMs`, `retry {maxRetries, baseDelayMs, maxDelayMs}`, `now` | `typeof window`, no-op, 3000, 3 / 1000 / 30000 | — |
| Список foundation-запросов для `appStatus` | `appStore.setFoundationQueries([...])` | пусто | — |
| Где лежат данные проекта | `devtools.config.json`: `specsDir, generatedTypesDir, mappingsDir, translationsDir, schemaFile, locales, apiImport` | раскладка плана (`packages/api/...`, en+ru) | — |
| Реакции на ответы | данные `mappings/<svc>.json` (toast/modal/custom/silent, тексты, support) | `errors:sync` даёт draft-заготовку | — |

Пример конкретного бэкенда (`examples/sample-backend`) — фикстура: его спека, маппинги, тексты, `BearerTokenAuth` с
refresh через `/api/v1/auth/refresh` и `healthPing` на `/api/v1/health` живут только там.

## What wave 1 should take as is
- `packages/api/src/middleware/*` и тест `middleware-order.test.ts` целиком (включая трассировку и отрицательный тест).
- `errors/{resolve,loadError,translate,types}.ts`, `state/{AppStore,UserStore}.ts` (логика), `state/networkRecovery.ts`.
- `devtools-core`: `spec.ts`, `mapping.ts` (check/add/set/sync/list), `i18n.ts`, `fsx.ts` (атомарная запись + allowlist),
  `generate.ts`, `cli.ts`; JSON Schema маппинга. Utils-сайт должен звать эти же функции.
- `tests/harness.ts` (фейковый бэкенд с последовательностями ответов) — удобная база для тестов API в шаблонах.
- Сценарии `pipeline.test.ts` — прямо как e2e-критерии волны 1 на уровне unit; в волне 1 добавить один Playwright-прогон
  с React-оболочкой.

## Plan changes proposed
1. §4 «Ошибки API»: добавить «штамп `_resolution` только для object-тел (массивы не трогаем)», «maintenance-503 не
   ретраится», «401 по superseded-токену повторяется один раз с текущим токеном», «retry через fetch клиента».
2. §3.1 / rules: MobX 7 — named-экспорты аннотаций (`observableShallow` и т. д.); `erasableSyntaxOnly` в tsconfig
   (запрет parameter properties и enum) — если CLI/tools запускаются нативным Node без сборки.
3. API-rule для бэкенда/спек: discriminator по `type` только с явным `mapping`; `type` ошибки — `const`.
4. Формат маппинга: ключ `operationId` + `path/method`, варианты без метода (как выше) — зафиксировать ADR.
5. CLI tools на Node 24 type stripping без `tsx` (0.4–0.6 с на вызов) — достаточно для агентов и pre-commit.
7. §4 и решение 18: 401/refresh описывать через `AuthAdapter` (refresh только если адаптер его даёт; BFF = адаптер
   без refresh), а не через режим `bff|token`; `packages/api` не содержит ни эндпоинтов, ни формата заголовка; пример
   бэкенда живёт как фикстура (`examples/` или `__fixtures__/`) и удаляется init-ом; пути данных — в
   `devtools.config.json`.
6. Тексты `PageQueryGuard`/`FailureScreen` оставить в `common`, как в 18 §5.8; в `apiErrors` только тексты маппинга и
   `support`.

## Open issues
- `pnpm -s <script>` в pnpm 11 печатает строку `$ node …` в stdout перед выводом, что ломает `--json` для парсера.
  В тестах CLI вызывается `node cli.ts` напрямую; для агентов документировать вызов через `node` или проверить флаг
  `--reporter=silent` в волне 1.
- Нет команды удаления ключа текста (`i18n:delete`), а `sync` возвращает удалённое из `all/` (см. находку 6).
- `<svc>.ignore.json` (исключения покрытия из 18 §5.7) не реализован.
- Нет drift-теста `api:gen` (generated types == спека) — только для маппингов; добавить в волне 1.
- Генерируемый TS не прогоняется через prettier (двойные кавычки); в репо с prettier — добавить шаг форматирования.
- MobxQuery v2 здесь минимальный: SSR-синк опций, гидрация и гонки отписки (512 строк в xRocket) не покрыты — это
  отдельный smoke волны 0/1 по риску №2 плана.

## Verification
- Проверено: `pnpm install`, `tsc --noEmit` (0 ошибок, включая отрицательные type-тесты), `vitest run` (71/71),
  `errors:check` и `i18n:check` на закоммиченных данных (0 ошибок), полный прогон `examples/sample-backend/scripts/seed-mappings.sh` после переноса в examples.
- Не проверено: браузер/React-слой, реальный бэкенд, SSR (только флаг `isClient`), Playwright.
- Коммит: спайк и отчёт закоммичены в ветку `worktree-agent-a9fc409ce490ce299` одной строкой без трейлеров; push нет.
