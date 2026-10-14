# 18. Error mapping, interceptors, fatal screens, i18n catalogs
Status: done
Updated: 2026-10-15

## Resume notes
- Done: все разделы (1–5). Исследование xRocket завершено, спецификация порта написана.
- Next: —
- Sub-agent: нет (не понадобился)

## Summary (≤ 15 lines)
1. В xRocket ошибки API обрабатывает один слой — `responseResolutionMiddleware` на клиентах `openapi-fetch`. Он ищет маппинг
   по ключу `(schemaPath, METHOD, status, body.type|body.name)` и сам показывает тост. Для `modal`/`custom` он только кладёт
   в тело ответа поле `_resolution`. Модалку рисует `PageQueryGuard`, `custom` — домен через `toResult().resolution`.
2. Маппинги лежат в `errors/mappings/<svc>.generated.ts` и скачиваются из внешнего сервиса xRocket Tools (Strapi,
   `GET /api/swagger-endpoints/:id/export-ts`). В этом же файле лежат тексты (en/ru, **без zh**) и генерированные фабрики
   `createQuery/createMutation`.
3. Порядок middleware: `[hiddenRub, appStatusGate, auth, resolution, bannedGuard, retry, 401]`. В openapi-fetch `onResponse`
   вызывается в обратном порядке массива, поэтому resolution срабатывает после retry. Порядок проверяется тестом `api.test.ts`.
4. Фатальные состояния. `AppStore.appStatus` — computed-значение `'initial'|'app'|'no-network'|'server-error'|'banned'`. Бан
   ловит интерсептор `bannedGuardMiddleware` на любом эндпоинте (403 + маркер blocked/banned). no-network и server-error
   ставятся, только если упала первая загрузка foundation-запросов (profile, settings, TMA-логин). Фуллскрин закрыть нельзя:
   это отдельная группа роутов, остальные группы при этом размонтированы. `appStatusGateMiddleware` отвечает синтетическим
   503 на все исходящие запросы. Восстановление — только полный `window.location.reload()` по кнопке.
5. i18n: каталоги `translations/{all,en,ru,zh}/<ns>.json`. `all/` — единый источник истины, каждый лист в нём хранится как
   `{en,ru,zh}`. `sync-i18n.mjs` синхронизирует каталоги и валидирует их в pre-commit. Eager грузятся только `notSorted` и
   `common`, остальные namespace подгружаются лениво. `i18n:check` работает с baseline-файлом. Источник для Crowdin — `en/*`.
6. Тексты ошибок API **не лежат** в i18n-каталогах: они хранятся в TS-объекте `translations` внутри generated-файлов, вне
   Crowdin, без zh, и 177 из 379 ключей в них — дубли с числовым суффиксом. Тексты фуллскринов и PageQueryGuard лежат в
   `common` и `notSorted`.
7. Главные дыры:
   - покрытие маппингом примерно 73 из ~237 путей: эндпоинт без маппинга не показывает никакого UI;
   - для `*_NET` тост автоматически не показывается вообще: `onError` в openapi-fetch не используется;
   - maintenance обрабатывается только в legacy axios, текст захардкожен на английском;
   - правило про barrel нарушают 10 файлов;
   - на SSR middleware пушит тосты в глобальный контейнер.
8. Порт. Пакет `packages/api` с транспортом на `openapi-fetch` (ему нужен `schemaPath`) и типами из `openapi-typescript`.
   Маппинги хранятся как JSON-данные в репо (их редактирует utils-сайт), тексты — в i18n-namespace `apiErrors`. Тот же
   pipeline, `ToastsStore` + `GlobalToasts`, `FailureScreen` в kit, `appStatus` + gate. Обязательный тест: каждая операция
   из OpenAPI имеет маппинг с `ERR` и `NET`.

## Findings

Все пути ниже относительно `C:/Работа/xRocket/xrocket-front/libs/main/src/` (если не указано иное). Факты проверены
чтением кода 2026-10-15; пометка «гипотеза» означает «следует из кода, в рантайме не проверял».

### 1. API error pipeline

#### 1.1 Клиенты
`common/shared/api/api.ts`: по одному клиенту `createClient<paths>()` (openapi-fetch 0.14.1) на сервис плюс
`createQueryClient(client)` (openapi-react-query 0.5.0). Сервисы: assets, auth, competition, exchange, user, wallet,
xjourney, p2p, swap. Общие опции:
```ts
const baseClientOptions = {
  credentials: 'include' as const,
  fetch: (...args) => globalThis.fetch(...args), // ленивый fetch, чтобы eruda могла патчить
};
```
Типы `paths` генерирует `openapi-typescript` 7.13 (`tools/scripts/api/openapi-generator.sh`: curl спеки →
`npx openapi-typescript … --root-types=true` → prettier/eslint) в `common/shared/api/generated/<svc>.ts`. Есть и legacy
axios-клиенты (OpenAPI Generator, `model.ts`, `*Api.ts`). Стратегия — переезжать на modern по мере касания кода.

`queryClient` (`common/shared/api/index.ts`) настроен с `defaultOptions.queries.retry: false`: ретраи делает только
middleware, иначе они удваиваются.

#### 1.2 Middleware и их порядок (`common/shared/api/middlewareSetup.ts`)
```ts
export const middlewares: Middleware[] = [
  hiddenRubResponseMiddleware, appStatusGateMiddleware, authMiddleware,
  responseResolutionMiddleware, bannedGuardMiddleware, retryMiddleware, unauthorizedMiddleware,
];
exchange.use(...middlewares); /* … все modern-клиенты … */
auth.use(responseResolutionMiddleware, bannedGuardMiddleware); // без gate и 401, иначе ломается ре-логин
```
- openapi-fetch вызывает `onRequest` по порядку массива, а `onResponse` — в обратном порядке. Фактический порядок:
  на запросе `appStatusGate → auth`, на ответе `401 → retry → bannedGuard → resolution → hiddenRub`.
- Почему resolution стоит в массиве раньше retry: так он срабатывает после retry. В обратном случае `_resolution` попал бы
  на исходный упавший ответ, retry вернул бы свежий fetch без этого поля, и `MobxQuery.rawResolution` всегда был бы `null`.
- Если `appStatusGate` на запросе вернул `Response`, вся цепочка `onResponse` пропускается (проверено на 0.14.1). Поэтому
  синтетический 503 не ретраится и не попадает в resolution, то есть тоста нет.
- Brief описывает порядок как `auth → resolution → retry → 401`. Это упрощение: в реальной цепочке есть ещё gate и
  bannedGuard.
- `authMiddleware`: `container.resolve(AuthStore).token` через dynamic import (чтобы не ловить циклы DI), заголовок
  `Authorization: Bearer`.
- `retryMiddleware`: ретраит **только GET**, если `!status || status >= 500`. Три попытки, задержка
  `min(1000·2^n, 30000)` (`retryConfig.ts`). Повтор делается через `fetch(request.clone())`.
- `unauthorizedMiddleware`: на 401 решение принимает `classifyUnauthorized(requestAuthHeader, authStore.token)`. Сессию
  чистит только 401 на запрос с **текущим** токеном (`authStore.clearStoredData()` + `userStore.clearStoredData()`). Редиректа
  нет: экран Auth показывает `withAuthGuard` по MobX-реакции на `isAuthorized`. 401 по устаревшему токену только
  логируется в Sentry.
- `bannedGuardMiddleware`: на 403 читает `response.clone().json()` и вызывает `isBannedResponse` (`errors/loadError.ts`) —
  ищет `blocked`/`banned` в полях `type|name|instance|kind`. Проверка не зависит от формы тела: подходят и NestJS
  `UserBlockedException`, и RFC 7807 `/api/problems/user_blocked`. Дальше
  `UserStore.markBanned(tokenOfThisRequest)`: бан привязан к токену запроса, и поздний 403 со старой сессии не блокирует
  новую.
- Тесты: `common/shared/api/api.test.ts` проверяет порядок (resolution раньше retry, gate — первый onRequest, hiddenRub
  стоит на индексе 0), штамп `_resolution` и `_httpStatus`, gate для каждого статуса, решение по 401, bannedGuard.

#### 1.3 Resolution (`common/shared/api/errors/*`)
Файлы: `types.ts`, `resolveApiResponse.ts`, `middleware.ts`, `responseMappings.ts`, `loadError.ts`, `index.ts`,
`mappings/*.generated.ts`.

Типы (`types.ts`):
```ts
export type ResponseDisplayType = 'toast' | 'modal' | 'custom' | 'silent';
export type ResponseSeverity = 'error' | 'warning' | 'info' | 'success';
export interface ResponseMappingEntry<V extends string> {
  variants: V[]; type: ResponseDisplayType; severity: ResponseSeverity;
  i18n?: { title: string; subtitle?: string }; support?: boolean;
}
export interface RawResolution { type; severity; translationKey: string; subtitleTranslationKey?: string;
  support?: boolean; isErrorFallback?: boolean }
```
Строка варианта имеет вид `` `${METHOD}_${status}_${problemType}` ``, например
`POST_400_/api/problems/exchange_amount_more_than_user_balance`. Кроме реальных вариантов есть синтетические:
- `POST_200` — успех;
- `POST_ERR` — catch-all для любого ответа ≥ 400;
- `POST_NET` — сетевой сбой.

`VariantsOf<paths, path>` выводит на уровне типов union допустимых вариантов из ответов в спеке. Каждая запись проверяется
через `satisfies EndpointResponseMapping<VariantsOf<paths,'/path'>>`. Если API legacy и в нём нет literal `type`, вывод
откатывается до `string`.

`resolveApiResponse(path, method, status, type)` ищет совпадения в таком порядке:
1. точный вариант `METHOD_STATUS_TYPE`;
2. для 2xx: `METHOD_STATUS`, затем любой `METHOD_2xx` того же метода (спека говорит 200, NestJS отдаёт 201);
3. для ≥ 400: `METHOD_ERR`, при этом ставится `isErrorFallback: true`;
4. иначе `null`, и пользователь ничего не видит.

`resolveNetworkError(path, method)` ищет вариант `METHOD_NET`.

`responseResolutionMiddleware.onResponse` (`errors/middleware.ts`):
- если тело JSON, читает `clone().json()`; тип ошибки берёт из `body.type` (RFC 7807), иначе из `body.name` (NestJS);
- при `resolution.type === 'toast'` сразу вызывает `container.resolve(ToastsStore).push({title, subtitle, severity, action?})`.
  Если `support: true`, у тоста появляется кнопка «Support» (`buildSupportBotUrl(text)`). Текст с кодом ошибки и статусом
  прикладывается к ней, только когда сработал catch-all `_ERR` или статус ≥ 500 (`shouldAttachSupportContext`);
- на любом ответе ≥ 400, а также на 2xx с найденной резолюцией пересоздаёт `Response` с телом
  `{ _httpStatus, ...body, _resolution }`. Константа `RESOLUTION_KEY = '_resolution'`. Статусы без тела
  (101/103/204/205/304) не трогает.

`translateResolution(raw, params)` переводит ключи через `responseTranslations[key][i18n.language] ?? [..]['en'] ?? key` и
подставляет `{{var}}`. Это **не** i18next, а собственный lookup по TS-объекту. `getApiResponseResolution(dataOrError)` —
ручной вариант для доменов (например, `domains/wallet/pages/withdrawal/Withdrawal.tsx`).

Как выбирается поверхность:

| `type` в маппинге | Кто показывает                                         | Когда |
|---|---|---|
| `toast`  | middleware сам, сразу при ответе                        | любой запрос через modern-клиент: query, mutation, raw |
| `modal`  | `PageQueryGuard` на page root по `rawResolution.type === 'modal'` | только page-load GET-queries, переданные в guard |
| `custom` | домен сам, через `query.toResult(params).resolution` или `getApiResponseResolution` | ошибки полей форм, inline-блоки (wallet 41, exchange 23) |
| `silent` | никто                                                   | явное «ничего не показываем», чаще всего для `GET_200` и ожидаемых 4xx |
| нет записи | никто                                                 | **дыра** |

Пример записи из `mappings/swap.generated.ts`:
```ts
'/api/v1/routes/default': { responses: [
  { variants: ['GET_200','GET_400_/api/problems/client_data_validation','GET_403_/api/problems/user_blocked', …],
    type: 'silent', severity: 'success' },
  { variants: ['GET_500_/api/problems/internal_error','GET_ERR'], type: 'modal', severity: 'error', support: true,
    i18n: { title: 'anErrorOccurredPleaseTryAgainLater2', subtitle: 'pleasePressTheButtonBelowToTryAgain3' } },
  { variants: ['GET_NET'], type: 'modal', severity: 'error',
    i18n: { title: 'thereIsSomethingWrongWithYourInternetConnection3' } },
]} satisfies EndpointResponseMapping<VariantsOf<paths, '/api/v1/routes/default'>>,
```
Маппинг покрывает и успешные ответы: `POST_201 → toast success "theAdHasBeenCreated"` (p2p). Поэтому тосты успеха тоже
задаются данными, без кода.

Формат generated-файла (секции идут в таком порядке):
1. `mappings`;
2. `translations: Record<key, {en, ru}>`;
3. `I18nParams` — типы параметров интерполяции для path×method, например `amount`, `coin`, `maxAmount`, `network` у
   wallet withdrawal confirm;
4. `<svc>Queries` — фабрики `createQuery` поверх `api.<svc>Query.queryOptions(...)`;
5. `<svc>Mutations` — `createMutation` с `mutationKey: ['post','/api/v1/swap']` и
   `mutationFn: … const {data,error} = await api.swap.POST(...); if (error) throw error;`.

`responseMappings.ts` склеивает все сервисы в один объект через spread. Ключ — `schemaPath`. Если у двух сервисов
совпадёт путь, поздний молча затрёт ранний.

#### 1.4 Как ошибка доходит до MobX (`common/shared/lib/mobxQuery/*`)
- `MobxQuery.rawResolution`: при `TypeError` или offline-паузе (`isPaused`) ищет `resolveNetworkError(queryKey[1],
  queryKey[0])`, потому что queryKey у openapi-react-query имеет вид `['get','/path',init]`. Иначе берёт
  `(error ?? data)._resolution`.
- `MobxQuery.errorKind` возвращает `'network'`, если `isPaused` или `error instanceof TypeError`; `'server'` — если есть
  `isError`; иначе `null`.
- `MobxMutation.rawResolution` берёт `_resolution` из error или data. Для `TypeError` вызывает
  `resolveNetworkError(mutationKey[1], mutationKey[0])` — это и есть «mutationKey lookup». Поэтому ручная мутация обязана
  иметь ключ `['<method>','<path>']`.
- `helpers.ts` содержит фабрики `createQuery/createMutation` и метод `toResult(params)`, который возвращает
  `{data,status,error,errorKind,resolution}` (resolution уже переведён). `QueryClient` берётся через
  `resolveQueryClient()`: на SSR — свой на каждый запрос (`lib/requestScope.ts`).

#### 1.5 Toasts
- `common/entities/toast/model/ToastsStore.ts` — `@provide.singleton()`. Методы `push(toast, autoDismissMs=5000)` и
  `dismiss`, одновременно видно не больше 5 тостов, лишние закрываются. Если у тоста есть только title, он переносится в
  subtitle (особенность раскладки). Тип тоста: `{id,title,subtitle?,severity,dismissing?,action?:{label,onClick}}`.
- `common/shared/ui/GlobalToasts/GlobalToasts.tsx` — observer, раскладка задана в `SEVERITY_CONFIG` (иконки
  error/warning/success/info). Монтируется один раз в `app/App.tsx:181`.

#### 1.6 PageQueryGuard (`common/shared/ui/PageQueryGuard/PageQueryGuard.tsx`, README рядом)
- Props: `queries: PageQueryRef[]`, где `PageQueryRef = {status, rawResolution, errorKind, refetch()}`. Под этот интерфейс
  подходит `MobxQuery` без адаптеров.
- Логика:
  - фильтрует запросы, у которых `errorKind !== null && rawResolution?.type === 'modal'`;
  - network-ошибка важнее server-ошибки;
  - снимок последней ошибки сохраняется в `useRef`, чтобы текст не пропадал во время fade-out.
- Тексты:
  - при network-ошибке: `t('somethingIsWrongWithYourConnection')` / `t('pressTheButtonBelowToTryAgain')` с иконкой
    `WifiOff`;
  - при server-ошибке: title/subtitle из маппинга, если в нём есть subtitle, иначе `somethingWentWrong` /
    `thisIsNormalJustTryAgainByClickingTheButtonBelow`.
- Кнопки:
  - «Support» — если в маппинге `support: true`, открывает `SUPPORT_BOT_URL`;
  - «Try again» — вызывает `Promise.all(failed.map(q => q.refetch()))`.
- Модалка: `Modal inline size="small" showClose={false}`, закрыть нельзя, она блокирует экран. Закрывается сама, когда
  запросы успешно загрузились.
- Правило: guard рендерится только в page root (ESLint `xrocket/no-page-query-guard-outside-page-root`), только для
  page-load GET. Используется всего на 4 страницах: Convert, Market, ManageAd, RefCompetition.

#### 1.7 Генератор маппингов (xRocket Tools)
- Скрипты: `package.json` → `"xrocket-tools:<svc>": "node --env-file=.env tools/scripts/xrocket-tools/xrocket-tools-generator.mjs <svc>"`.
- Скрипт (`tools/scripts/xrocket-tools/xrocket-tools-generator.mjs`, 4.5 КБ):
  1. `POST {TOOLS_API_URL}/api/auth/local` с `TOOLS_USER`/`TOOLS_PASSWORD`;
  2. `GET /api/swagger-endpoints?filters[slug][$eq]=<svc>` → `documentId`;
  3. `GET /api/swagger-endpoints/<id>/export-ts` → текст TS;
  4. перезаписывает `errors/mappings/<svc>.generated.ts` и прогоняет prettier.

  То есть вся логика (какой вариант какой поверхности соответствует, тексты, фабрики) живёт во внешнем Strapi-сервисе, а
  в репо попадает готовый TS. Подробнее о сервисе — отчёт агента 19 (`research/19-utils-site.md`).
- Порядок обновления (из `common/shared/api/CONTEXT.md`):
  1. `pnpm api-generator-<svc>` (типы);
  2. `pnpm xrocket-tools:<svc>` (маппинги и фабрики);
  3. `pnpm typecheck`: удалённый на бэке ключ проявится только как ошибка типов.

#### 1.8 Правило barrel / TDZ
- `libs/main/eslint.config.mjs:36` содержит `apiBarrelImports`, который запрещает импорт `@/common/shared/api/errors/mappings/*`
  и `@/common/shared/api/api` вне `shared/api/**` с сообщением «direct imports … cause module-init TDZ cycles». Причина:
  barrel `shared/api/index.ts` первым делает `import './middlewareSetup'`. Прямой импорт generated-фабрики может
  выполнить модуль раньше, чем на клиенты навешены middleware, или поймать цикл shared/lib ↔ shared/api.
- Внутренние модули специально импортируют точечные файлы, а не barrel: `mobxQuery` берёт `errors/middleware`,
  `errors/resolveApiResponse`.
- Отдельное правило TDZ про сторы: query собирается в теле конструктора после присвоения DI-параметров, потому что
  class-field initializer читал бы `this.appStore` до присвоения (`docs/mvvm.md`, `PageQueryGuard/README.md`).
- Расхождение: 10 доменных файлов импортируют `errors/mappings/*.generated` напрямую (`SwapRoutesStore`,
  `P2PMarketStore`, qrPay VM…), и сами README/CONTEXT показывают такой импорт в примерах. Barrel при этом не
  реэкспортирует `swapQueries`. Правило и документация противоречат друг другу.

### 2. Фатальные состояния приложения

#### 2.1 appStatus
`common/entities/app/model/types.ts`: `type AppStatus = 'app' | 'no-network' | 'server-error' | 'initial' | 'banned'`.
`AppStore.appStatus` (`common/entities/app/model/AppStore.ts:202`) — **computed-значение, а не сеттер**. Его никто не
выставляет напрямую, оно выводится из состояния сторов. Ветки по порядку:
1. `userStore.isBanned` → `'banned'`. Перекрывает всё, включая `'initial'`. Флаг ставит `bannedGuardMiddleware`.
2. `!authStore.isInitialized` → `'initial'` (сплэш).
3. TMA и токена нет:
   - логин `Failed`: `UserBlockedException` → `'banned'`, network → `'no-network'`, иначе → `'server-error'`;
   - логин `Loading` и таймаут не истёк → `'initial'`;
   - логин «завис» или истёк по таймауту → `'server-error'`. Если ответ всё-таки придёт позже, `appStatus` пересчитается в
     `'app'` сам.
4. `!isAuthorized` → `'app'`.
5. Авторизован: «жёстко упавшими» считаются `profileQuery` и `usersSettingsQuery` в статусе `Failed` и с
   `data === undefined` (первая загрузка). Если токен уже стёрт 401-м → `'app'`. Если среди упавших есть network-ошибка
   → `'no-network'`, иначе → `'server-error'`.
6. Иначе `'app'`. Упавший refetch при уже загруженных данных фуллскрин не вызывает.

Сетевые listener'ы (`AppActivityService/activitySource.ts`, события `online`/`offline`) на `appStatus` **не влияют**. Их
используют только сокеты (`ExchangeSocketService`, `P2PSocketService`) и `TradeOrders`.

#### 2.2 Блокировка и неубираемый экран
- **Роутинг.** `app/Routes.tsx` содержит static-группы `app | network | serverError | banned`, каждая с
  `if: () => appStore.appStatus === '…'`, и `{ remountOnAppStatus: true }`. Пока статус не `'app'`, группа приложения не
  смонтирована вообще: навигации, хедера, кнопки «назад» нет. В стеке остаётся единственный экран
  `common/pages/failureScreen/FailureScreen.tsx`, загружаемый лениво. Именно поэтому фуллскрин нельзя закрыть.
- **Сеть.** `appStatusGateMiddleware.onRequest` при `no-network|server-error|banned` возвращает
  `new Response(JSON.stringify({_httpStatus:503,_blockedByAppStatus:true}),{status:503})`. Фоновые запросы перестают
  ходить. Если контейнер ещё не готов, запрос пропускается. Тесты в `api.test.ts`.
- **Сплэш.** `App.tsx:91` считает приложение готовым, если статус равен `app`, `no-network`, `server-error` или `banned`. В
  этот момент сплэш из `index.html` скрывается с задержкой 1 с.
- **FailureScreen** — тонкое ветвление по `vm.appStatus`. Все варианты рисуются через `FullScreenResult`:
  - `FailureScreenNoNetwork`: `t('connectionError.title' | '.subtitle' | '.suggestions', ns common)` и кнопка
    `tryAgain` → `reloadApp`;
  - `FailureScreenServerError`: `serverError.*` (ns common) и кнопки «Support» (в бот уходит
    `Error code / Status`) и «Try again» → reload. Плюс блок `TechnicalInfo`: код и статус из
    `extractErrorContext(foundationQuery.error)`, по нажатию копируется в буфер;
  - `FailureScreenBanned`: `userBanned.*` и кнопки «Support» и «Refresh» (в TMA) или «Logout» (на вебе). Обе вызывают
    `logout().finally(reloadApp)`. Голый reload не помогает: он поднимает тот же забаненный токен.
- **Восстановление** — только полный `window.location.reload()` (`shared/lib/platform/reloadApp.web.ts`). Автоматического
  восстановления при reconnect **нет**. Это сознательное решение, его обоснование в комментарии в `middlewareSetup.ts`:
  reload пересоздаёт DI и gate, после чего статус снова `'initial'` и gate открыт. TMA-логин идёт raw fetch мимо
  middleware, поэтому его gate не блокирует, и deadlock невозможен.
- **TMA.** Логин выполняется до появления токена, поэтому вынесен в отдельную ветку. Добавлен таймаут против вечного
  сплэша. `UserBlockedException` на `/auth/tma` ведёт на banned (маппинг там silent). `language` при banned берётся из
  fallback, так как профиль недоступен.
- **Maintenance** — отдельный механизм, только для legacy axios. `onResponseErrorCommon` (`shared/api/model.ts:44`) при
  `data.message === 'PLATFORM_MAINTENANCE'` делает `document.dispatchEvent(new CustomEvent('custom-maintenance'))` и
  оставляет промис висеть навсегда. `shared/ui/Maintenance/Maintenance.tsx` — оверлей через `FloatingPortal` с
  **захардкоженным английским** текстом и кнопкой `WebApp.close()`. В modern middleware этого нет, хотя `CONTEXT.md`
  утверждает «в любом ответе».

### 3. Организация i18n-каталогов

- **Где лежат.** `common/shared/i18n/translations/{all,en,ru,zh}/<ns>.json`, 15 namespace: accelerator, challenges,
  cheque, common, competition, convert, countries, earn, notSorted, onboarding, p2p, qrPay, trade, wallet, xJourney. В
  zh нет 4 из них (competition, countries, earn, qrPay). Каталоги для локалей только сайта (de, es, fil, fr,
  hi, id, pt, th, tr, uk, vi) вынесены в `apps/web/src/shared/i18n/translations/<lng>/`, чтобы glob приложения
  `./translations/{en,ru,zh}/*.json` (`catalogs.ts`) их не захватил. Реестр локалей — `libs/i18n/locales.ts` с флагами
  `enabledWeb`/`enabledApp` (`docs/i18n-locales.md`).
- **Формат `all/`.** Каждый лист хранится как `{en, ru, zh}`:
  `"tryAgain": {"en":"Try Again","ru":"Повторить","zh":"重试"}`. Вложенные группы допустимы:
  `connectionError.title`. Поле `CROWDIN_NOTE` — заметка для переводчика.
- **`tools/scripts/sync-i18n.mjs`** (25 КБ, тест 39 КБ):
  - `merge` — каталоги языков → `all/` с deep merge, ключи, добавленные прямо в `all/`, сохраняются;
  - `split` — `all/` → `en|ru|zh`;
  - `sync` — сначала merge, потом split (в комментарии к скрипту порядок указан наоборот). Запускается в
    `.husky/pre-commit`, затем `git add translations/`.
  - Валидации: en обязателен; в en/zh не должно быть кириллицы (кириллические гомоглифы автоматически заменяются
    латиницей); zh, совпадающий с en, удаляется; проверяется баланс HTML-тегов и фигурных скобок; набор `{{var}}`
    должен совпадать во всех языках.
  - Ловушка: ключ, удалённый только из `en/ru/zh`, вернётся из `all/` при следующем коммите.
- **Загрузка.** `loader.ts`: i18next 25.7 и `i18next-resources-to-backend`. `EAGER_NAMESPACES = ['notSorted','common']`
  (`defaultNS: 'notSorted'`), остальные подгружаются лениво. Если в zh нет каталога, используется en.
  `partialBundledLanguages`, `fallbackLng: 'en'`. Тип `Translations` описывает все namespace, `TranslationPath<N>` даёт
  типизированные ключи.
- **Объявление namespace.**
  - Экран объявляет свои namespace в `Routes.tsx` (`typedLazyImportWithRetry(..., ['wallet'])`), страница сайта — в
    `+config.ts`.
  - Правило ESLint `xrocket/require-i18n-namespace` и тест `namespaceUsage.test.ts` проверяют, что
    `t(..., {ns})` без объявления не используется.
  - Smoke-тест `tests/smoke/web-runtime.spec.ts` ищет в DOM сырые ключи.
- **Ключи.** camelCase, полученный из английского текста (`thanksWellLetYouKnowWhenTheCardsBecomeAvailable`), плюс
  смысловые группы (`serverError.somethingWentWrong`, `userBanned.buttonRefresh`). Плюралы через суффиксы
  `_one/_few/_many/_other`.
- **Полнота.**
  - `pnpm i18n:check` (`check-i18n-completeness.mjs`) проверяет только ru против en; zh сознательно исключён, он
    переведён примерно на 34%.
  - Учитывается разница наборов плюральных форм.
  - Известные пропуски записаны в baseline `tools/i18n-completeness-baseline.json`; после `crowdin download` его
    регенерирует `pnpm i18n:check:baseline`.
  - `i18n:check:web` проверяет только локали сайта.
  - Обе проверки входят в `pnpm check` и `lint:ci`.
- **Crowdin.** `crowdin.yml` в корне, `base_path` указывает на translations, source — `en/<ns>.json` (14 файлов, qrPay и
  countries в списке нет — дрейф). Токен хранится в `$HOME`. Порядок работы: правка en → `crowdin upload` → перевод →
  `crowdin download` → commit.
- **Тексты ошибок.**
  1. Тексты ошибок API — в `errors/mappings/*.generated.ts → translations` (TS, en/ru). Они не проходят через i18next, не
     попадают в Crowdin и в `sync-i18n`. Ключи там — camelCase от текста, дубли получают числовой суффикс
     (`thereIsSomethingWrongWithYourInternetConnection4`): 177 из 379 ключей.
  2. Общие тексты ошибок UI лежат в i18n-каталогах: `common:connectionError.*`, `common:serverError.*`,
     `common:userBanned.*`, `notSorted:somethingWentWrong|tryAgain|support|somethingIsWrongWithYourConnection…`.

### 4. Слабые места и дрейф (что чинить при переносе)

1. **Покрытие.** В `mappings` 73 эндпоинта на ~237 путей (≈ 280 операций) в generated-спеках. Пустые маппинги у pay,
   accelerator, cheques, xjourney, asset. Эндпоинт без маппинга не показывает никакого UI: ни тоста, ни модалки
   (так написано и в `CONTEXT.md`). Теста на покрытие нет.
2. **NET-тосты не работают.** 43 записи с `*_NET → toast`, но middleware срабатывает только на `onResponse`. При
   `TypeError` (fetch упал) никто тост не показывает. В openapi-fetch 0.14.1 есть хук `onError`
   (`node_modules/openapi-fetch/dist/index.d.ts:154`), xRocket его не использует. NET работает только там, где кто-то
   читает `rawResolution`: в PageQueryGuard и в ручных `toResult`.
3. **Тексты вне i18n.** Нет zh: китайский пользователь видит английские тосты. Нет Crowdin, нет проверки `i18n:check`,
   177 ключей-дублей. Генерируемые файлы большие: p2p 164 КБ, wallet 75 КБ, всего около 340 КБ. Часть из этого —
   повторяющиеся блоки и тексты, и всё попадает в бандл, так как `responseMappings` импортируется статически.
4. **Сам пайплайн не в репо.** Логика маппинга и тексты живут во внешнем Strapi и приходят одним перезаписываемым
   TS-файлом, где смешаны данные и код фабрик. Ревью diff затруднено, `.env` с паролем Strapi нужен каждому
   разработчику.
5. **Barrel-правило противоречиво** (§1.8): 10 нарушений, документация показывает прямой импорт.
6. **Склейка через spread.** Одинаковый `schemaPath` у двух сервисов молча затирается. Ключ не учитывает сервис.
7. **SSR.** Middleware не различает сервер и клиент. На SSR-префетче (`apps/web/pages/markets/+onBeforeRender.ts`,
   `prefetchViewModel`) toast-резолюция вызывает `container.resolve(ToastsStore)` на **глобальном** контейнере процесса,
   а не request-scope. `authMiddleware` тоже берёт глобальный `AuthStore`. Гипотеза: на сервере копятся тосты и таймеры,
   есть риск протечки между запросами.
8. **Offline на старте** (гипотеза). При `navigator.onLine === false` TanStack ставит запрос на паузу, и
   `MobxQuery.status` остаётся `Initial`, а не `Failed`. `AppStore.hardFailedQueries` пуст → `appStatus = 'app'` с пустым
   профилем вместо фуллскрина no-network. `errorKind` при этом `'network'`, но `appStatus` смотрит на `status`.
9. **Maintenance** — только legacy axios, английский хардкод, вне `AppStatus` (§2.2).
10. **Мелочи:**
    - тост с одним title переносит его в subtitle (костыль раскладки);
    - PageQueryGuard подключён всего на 4 страницах, хотя у 16 записей p2p стоит `modal`. Без guard модалку никто не
      покажет, это ещё одна «немая» ошибка;
    - в `CONTEXT.md` таблица «Куда смотреть» продублирована;
    - в `crowdin.yml` нет qrPay и countries;
    - в комментарии `sync-i18n` перепутан порядок merge и split.

### 5. Спецификация порта в boilerplate

Принцип: поведение xRocket сохраняется 1:1. Меняется только формат хранения (данные вместо TS из внешнего сервиса) и
пункты, которые в xRocket доказуемо сломаны (§4: 1, 2, 3, 5, 6, 7, 9; пункт 8 — после проверки).

#### 5.1 Транспорт и генерация
- **Транспорт — `openapi-fetch`** (+ `openapi-react-query` для `queryOptions`), типы из `openapi-typescript`. Весь
  механизм xRocket держится на `schemaPath` (шаблон пути), который openapi-fetch передаёт в middleware.
- **Orval** сам по себе этого не даёт: его fetch-mutator получает уже подставленный URL. Если в волне 0 выберут Orval,
  нужны два дополнения: (а) Orval-mutator, который вызывает тот же `apiClient` с `schemaPath` и `method` из
  метаданных операции, или генерируемый из спеки matcher «URL → шаблон»; (б) тест, что matcher однозначен. Мнение:
  для API-приложений (tma, admin, game, site) брать `openapi-typescript` + `openapi-fetch` — это точное повторение
  xRocket и без лишнего слоя. Orval оставить для моков и Zod, если они нужны. **Решение за пользователем, см. вопрос 1.**
- Скрипты в корне:
  - `pnpm api:gen <svc>` — спека в `packages/api/specs/<svc>.json` (закоммичена, из URL или файла) → `generated/<svc>.ts`;
  - `pnpm api:mappings:scaffold <svc>` — добавляет в JSON маппинга заготовки для новых операций: `silent` для 2xx,
    `ERR` → `toast` или `modal` по методу, `NET` → `toast` или `modal`. Существующие записи не трогает;
  - `pnpm api:mappings:gen` — JSON → типизированный `mappings.generated.ts` с `satisfies VariantsOf` и фабриками
    queries/mutations, как в xRocket.

#### 5.2 Раскладка пакета
```
packages/api/
  specs/<svc>.json                 # закоммиченная OpenAPI-спека (вход генерации)
  generated/<svc>.ts               # openapi-typescript (не редактировать)
  mappings/<svc>.json              # ДАННЫЕ маппинга — редактирует utils-сайт (агент 19) или человек
  mappings/<svc>.generated.ts      # из JSON: typed mappings + <svc>Queries/<svc>Mutations (не редактировать)
  src/
    clients.ts                     # createClient<paths>() per service, ленивый fetch, credentials
    middleware/                    # appStatusGate, auth, resolution, bannedGuard, retry, unauthorized, maintenance
      setup.ts                     # единственное место .use(); порядок + комментарий
    errors/
      types.ts                     # ResponseDisplayType, RawResolution, VariantsOf (как в xRocket)
      resolve.ts                   # resolveApiResponse / resolveNetworkError (тот же порядок матчинга)
      translate.ts                 # translateResolution через i18next (ns apiErrors)
      loadError.ts                 # isBannedResponse, extractErrorContext, formatErrorContextMessage
    query/                         # MobxQuery v2 / MobxMutation (rawResolution, errorKind, toResult)
    index.ts                       # barrel: первым импортирует middleware/setup
  tests/                           # order, resolution, gate, banned, 401, coverage (см. 5.7)
```
Barrel-правило переносится как есть: ESLint `no-restricted-imports` на `@app/api/{generated,mappings,src/clients}`. При
этом barrel **реэкспортирует все** `<svc>Queries`/`<svc>Mutations`, а в документации нет примеров прямого импорта (чинит
§4.5).

#### 5.3 Формат данных маппинга (`mappings/<svc>.json`)
Повторяет TS-структуру xRocket, но это данные: их можно ревьюить и редактировать из utils-сайта.
```json
{
  "$schema": "../mapping.schema.json",
  "service": "wallet",
  "endpoints": {
    "/api/v1/wallet/withdrawal/{assetCode}/{networkCode}/confirm": {
      "post": [
        { "variants": ["201"], "type": "toast", "severity": "success", "i18n": { "title": "withdrawalCreated" } },
        { "variants": ["400_/api/problems/withdrawal_limit"], "type": "custom", "severity": "error",
          "i18n": { "title": "weCannotWithdrawAmountReduceTo" }, "params": ["amount","coin","network","maxAmount"] },
        { "variants": ["ERR"], "type": "toast", "severity": "error", "support": true,
          "i18n": { "title": "anErrorOccurredOnTheServer", "subtitle": "pleasePressTheButtonBelowToTryAgain" } },
        { "variants": ["NET"], "type": "toast", "severity": "error",
          "i18n": { "title": "thereIsSomethingWrongWithYourInternetConnection" } }
      ]
    }
  }
}
```
- Отличия от xRocket:
  1. метод вынесен в ключ, в варианте его нет (генератор собирает `POST_400_…` обратно, runtime-формат прежний);
  2. ключ верхнего уровня — сервис, в runtime ключ `service:schemaPath` (чинит §4.6);
  3. текстов в маппинге нет, только i18n-ключи.
- Валидацию делает JSON Schema. Отдельный тест сверяет с генерированными типами: каждый вариант существует в спеке,
  каждый ключ есть в `apiErrors`.

#### 5.4 Цепочка интерсепторов (порядок в массиве и семантика 1:1 с xRocket)
```ts
export const middlewares = [
  appStatusGateMiddleware,   // onRequest: блок при no-network|server-error|banned|maintenance → синт. 503 (без onResponse)
  authMiddleware,            // onRequest: Bearer из AuthStore (lazy resolve)
  maintenanceMiddleware,     // NEW (порт legacy): onResponse PLATFORM_MAINTENANCE/503+маркер → appStore.setMaintenance()
  responseResolutionMiddleware, // onResponse: _resolution + _httpStatus, toast; onError: NET-резолюция → toast (FIX §4.2)
  bannedGuardMiddleware,     // onResponse: 403 + blocked/banned → userStore.markBanned(tokenOfRequest)
  retryMiddleware,           // onResponse: только GET, !status||>=500, 3×, 1s·2^n ≤ 30s
  unauthorizedMiddleware,    // onResponse: 401 только по текущему токену → clear auth+user stores
];
authClient.use(responseResolutionMiddleware, bannedGuardMiddleware); // auth-клиент без gate/401, как в xRocket
```
- **`onError` для NET** (новое). Резолюцию ищем через `resolveNetworkError(service, schemaPath, method)`. Если тип
  `toast`, показываем тост. Для `modal` ничего не делаем: модалку покажет guard. Ошибку пробрасываем дальше
  (`TypeError`), чтобы `errorKind = 'network'` остался прежним.
- **Дедупликация NET-тостов** (новое, небольшое): если за 3 секунды несколько запросов упали по сети, показываем один
  тост. Иначе при обрыве сети пользователь получит пачку одинаковых тостов. Окно оставить настраиваемым.
- **SSR (site, Next).** Тосты возможны только на клиенте. На сервере (`typeof window === 'undefined'`) resolution
  только ставит `_resolution` и `_httpStatus`, тост не показывает. Auth и store берутся из request-scope контейнера, не
  из глобального (чинит §4.7). Server Components и route handlers вызывают API через тот же клиент, но без toast,
  bannedGuard и gate. Ошибку страницы рендерит `error.tsx` или `not-found` по `_resolution`/`_httpStatus`. Тосты и
  фуллскрины появляются после гидрации на клиентских запросах.
- **landing/blog (Astro)** — API-слоя нет. Если появится форма с API (newsletter), использовать тот же `@app/api` с
  маппингом, а тост показывать островом.

#### 5.5 Toast store и UI
- `ToastsStore` — сущность приложения (`entities/toast`): API `push/dismiss`, авто-закрытие через 5000 мс, не больше 5
  тостов, `action: {label, onClick}`, `severity: error|warning|info|success`. Костыль «title → subtitle» не переносим,
  раскладка решается в компоненте.
- `GlobalToasts` (kit: `packages/ui/Toast` на Base UI Toast, или свой) монтируется один раз в app shell. Kit-компонент
  получает список через props, связь со стором — в shell (shared UI работает только через props, как в
  `docs/architecture.md`).
- Кнопка «Support» строится из конфига приложения: `supportUrl(text)` для TMA — бот, для web — mailto или форма. Текст
  `Error code / Status` прикладывается только для `_ERR` и статусов ≥ 500, как в xRocket.

#### 5.6 Фатальный экран и app shell
- **`AppStatus`:** `'initial' | 'app' | 'no-network' | 'server-error' | 'banned' | 'maintenance'`. `maintenance` — новое
  значение (чинит §4.9 и вместо overlay с английским хардкодом). Это computed-значение в `AppStore`, логика как в §2.1:
  бан первым → initial → TMA-логин → foundation-запросы (список `foundationQueries` задаёт каждое приложение).
- **Kit.** `packages/ui/FullScreenResult`: иконка/иллюстрация, title, subtitle, children, actions. Без кнопки закрытия,
  без хедера, без back. **App-пакет** `FailureScreen` — тонкое ветвление по статусу: `NoNetwork`, `ServerError` (с
  `TechnicalInfo` и копированием), `Banned` (logout + reload), `Maintenance`.
- **Shell.**
  - Если `appStatus ∉ {app, initial}`, рендерится только `<FailureScreen/>` вместо роутера. Это аналог static-групп
    `if:` в xRocket и тоже не даёт закрыть экран: роутер не смонтирован.
  - В Vite SPA: `<AppShell>{status === 'app' ? <RouterProvider/> : <FailureScreen/>}</AppShell>`.
  - Сплэш снимается при любом статусе, кроме `initial`.
  - В TMA при фатальном статусе дополнительно скрываются `BackButton`/`MainButton`, `closingConfirmation` выключается.
- **Восстановление** — как в xRocket: полный reload. На Banned перед ним logout. Автовосстановление при reconnect **не**
  добавляем, пользователь просил «как есть». См. вопрос 3 про оффлайн на старте.
- **`appStatusGateMiddleware`** блокирует и при `maintenance`.

#### 5.7 Тесты, которые гарантируют покрытие
1. **Coverage.** Для каждой `(path, method)` из `generated/<svc>.ts` в `mappings/<svc>.json` должна быть запись, и в ней
   есть `<METHOD>_ERR`, `<METHOD>_NET` и хотя бы один 2xx-вариант (явный `silent` тоже считается). Отсутствие любого из
   них ломает CI. Исключения разрешены только списком `mappings/<svc>.ignore.json` с причиной.
2. **Variants ⊆ spec.** Каждый вариант соответствует реальному `status/type` в спеке. Генератор даёт это на уровне типов
   (`satisfies VariantsOf`), плюс runtime-тест для JSON.
3. **i18n-ключи.** Каждый `i18n.title/subtitle` существует в `apiErrors` для en, ru и остальных включённых языков.
   Каждый `params` совпадает с `{{vars}}` в тексте.
4. **Порядок middleware** — копия `api.test.ts`: resolution раньше retry, gate — первый onRequest, gate обрывает
   onResponse.
5. **Поверхности:**
   - toast на 4xx с точным совпадением;
   - `_ERR` fallback с `isErrorFallback`;
   - 2xx через любой `METHOD_2xx`;
   - NET-toast через `onError`;
   - modal → PageQueryGuard;
   - banned → `appStatus = 'banned'` → gate отвечает 503;
   - 401 по старому токену не разлогинивает.
6. **Ручные мутации.** Lint-правило: `createMutation` без `mutationKey: ['<method>','<path>']` — ошибка.
7. **PageQueryGuard.** Если `modal` есть у page-load GET, его страница должна рендерить guard. Правило ESLint «guard
   только в page root» переносится, плюс отчёт в `pnpm check`: какие эндпоинты с `modal` нигде не стоят под guard.

#### 5.8 i18n: раскладка и скрипты (как в xRocket)
```
packages/i18n/ (или apps/<app>/src/shared/i18n/ для app-специфичных)
  translations/
    all/<ns>.json      # источник истины: лист = {"en": "...", "ru": "...", "zh": "..."}
    en/<ns>.json  ru/<ns>.json  zh/<ns>.json
  catalogs.ts          # import.meta.glob только языков приложения
  loader.ts            # EAGER: common, notSorted→(переименовать в `app`?), apiErrors
tools/i18n/
  sync-i18n.mjs        # merge | split | sync (pre-commit), валидации xRocket 1:1
  check-completeness.mjs + baseline.json
  crowdin.yml          # source: en/*.json — генерировать список из папки, а не руками
```
- Тексты ошибок API живут в namespace **`apiErrors`** в том же формате `all/en/ru/zh`. Значит, они идут через Crowdin,
  `i18n:check`, sync-валидации и zh. Namespace грузится eager, потому что тост может прийти на любом экране, а
  `translateResolution` синхронный. Ключи — camelCase от английского текста (конвенция xRocket), но без числовых
  суффиксов: одинаковый текст означает один ключ. Utils-сайт при создании записи предлагает существующий ключ.
- Общие фатальные и generic-тексты лежат в `common`: `connectionError.*`, `serverError.*`, `userBanned.*`,
  `maintenance.*`, `tryAgain`, `support`, `somethingWentWrong`.
- Ленивые namespace объявляются по экрану. Правило ESLint `require-i18n-namespace`, тест namespaceUsage и smoke-проверка
  «нет сырых ключей в DOM» переносятся.
- `i18n:check` проверяет все включённые языки приложения. Исключать zh, как в xRocket, не нужно: в новом проекте долга
  нет, baseline начинается пустым.
- Next (site): `next-i18next` (по отчёту 17) читает те же `en|ru/<ns>.json`, формат файлов тот же.

## Recommendations for the boilerplate

Приоритет P0 (обязательно для любого шаблона с API):
1. Перенести pipeline xRocket 1:1: варианты `METHOD_STATUS_TYPE` + `_ERR` + `_NET` + 2xx, порядок матчинга,
   `_resolution`/`_httpStatus`, типы поверхностей toast/modal/custom/silent, автоматический тост в middleware,
   PageQueryGuard, `rawResolution` в MobxQuery/MobxMutation с lookup по `mutationKey`.
2. Перенести цепочку интерсепторов вместе с тестом порядка, включая `appStatusGate` и `bannedGuard` (бан, привязанный к
   токену) и 401 только по текущему токену. Ретраи только в middleware, `retry: false` в QueryClient.
3. Перенести фатальный экран: computed `appStatus`, отдельный экран вместо роутера, gate на все запросы, восстановление
   reload-ом, на banned — logout + reload.
4. Тест покрытия маппингов: каждая операция из спеки имеет маппинг с `ERR`/`NET`/2xx. Это закрывает главную дыру xRocket.
5. Тексты ошибок держать в i18n-каталоге `apiErrors` в формате xRocket `all/en/ru/zh` с `sync-i18n`, Crowdin и
   `i18n:check`. Не в TS внутри generated-файла.

P1 (точечно чинят доказанные поломки xRocket):
6. NET-тосты через `onError` openapi-fetch, с дедупликацией.
7. `maintenance` как значение `AppStatus` в modern middleware, с переводами.
8. Маппинг хранится как JSON-данные в репо с JSON Schema (его редактирует utils-сайт агента 19), из него генерируется
   TS. Ключ в runtime — `service:path`.
9. SSR-безопасный middleware: тосты только на клиенте, store из request-scope.
10. Barrel реэкспортирует все фабрики, правило и документация не противоречат друг другу.

P2:
11. Проверить на прототипе гипотезу «оффлайн на старте даёт `app` вместо `no-network`» (§4.8). Если подтвердится,
    учитывать `errorKind === 'network'` при `isPaused` в `appStatus`.
12. Отчёт «modal-эндпоинты без PageQueryGuard».

Чего избегать: внешнего сервиса как единственного источника маппингов (нужен `.env` с паролем, ревью невозможно);
смешивания данных и кода в одном генерируемом файле; ручных try/catch с тостом в VM для API-вызовов; второго
источника текстов ошибок вне i18n.

## Open questions for the user
1. Транспорт API: оставить `openapi-typescript` + `openapi-fetch`, как в xRocket (механизм маппинга использует
   `schemaPath` без доработок), или Orval с адаптером «операция → шаблон пути»? Рекомендация: openapi-fetch для
   клиентов, Orval только для моков и Zod, если они понадобятся.
2. Тексты ошибок API переносятся из маппинга в i18n-namespace `apiErrors` (Crowdin, zh, проверки). Это отступление от
   xRocket по месту хранения, но формат каталогов остаётся как в xRocket. Согласны?
3. Фатальный экран: только reload по кнопке, как в xRocket, или добавить автоматический reload при событии `online` для
   статуса `no-network`? По умолчанию предлагаю как в xRocket, без автоматики.
4. Нужен ли статус `maintenance` как четвёртый фатальный экран (в xRocket он есть только в legacy и на английском), и
   какой маркер ответа бэкенда считать признаком: `503` + `type: /problems/maintenance` или `message: PLATFORM_MAINTENANCE`?
