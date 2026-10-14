# 01. Архитектура современного фронтенда xRocket
Status: done
Updated: 2026-10-14 (финал)

## Resume notes
- Done: все разделы. Метрики сняты скриптами (в scratchpad сессии, не в репо): `born.txt` (дата рождения файла с учётом
  переименований), `rows.json` (декомпозиция), `viol.json` (импорты), `knip2.json` (мёртвый код).
- Next: ничего. При желании углубить: прогнать полный `eslint` xRocket и сравнить с моим сканом импортов.
- Sub-agent: не запускался.

## Summary (≤ 15 lines)
1. **Доменное деление xRocket работает, слои FSD внутри него в основном нет.** Импортов `domain → domain` 0. Зато
   `shared → entities` 95 (79 из них в коде последних 12 месяцев), импортов между слайсами `entities` 92. В `apps/web`
   из шести объявленных слоёв заполнены два (`pages` 278 файлов, `shared` 128), в `entities` и `features` лежит только README.
2. **Конвенция «Component/ + .styled + types + consts + utils + lib + ui + index» на деле сводится к `X.tsx` + `X.styled.ts`.**
   В новейшем коде (июль–октябрь 2026, 327 tsx) в отдельной папке лежат 51% компонентов. У них `.styled` есть в 60%,
   `types.ts` в 15%, `consts` в 4%, `utils.ts` в 0%, `index.ts` в 18%. Типы объявлены прямо в tsx у 51% файлов, из них
   81% — это просто `Props`.
3. **MVVM (store / VM / page root / view, DI на tsyringe) хорошо продуман и описан, но внедрён в трети страниц:** VM есть у 22
   из 64 страниц. `PageQueryGuard` используют 5 файлов. Правило `no-store-in-page-view` отключено в 227 файлах.
4. **Принуждение держится на 18 своих ESLint-правилах.** Их паттерн хорош: баг → правило с `message`, где объяснено
   «почему». Слабое место — границы на `no-restricted-imports`: в flat config блоки перетирают друг друга, относительные
   пути не видны, `shared → entities` не запрещён. `knip` настроен, но в CI не стоит: 63 мёртвых файла в `libs/main/src`.
5. **Связь между приложениями монорепо идёт глубокими импортами.** `apps/web` импортирует из `libs/main` 186 раз, 21 раз
   прямо во внутренности чужих страниц (например, `CryptoRub.tsx` → шесть `altynLanding/ui/*`). Для нашего монорепо из
   нескольких шаблонов это главный урок: делиться только через пакеты с полем `exports`.
6. **Для бойлерплейта:** брать доменную нарезку, тонкий page-slice, слоистый query + error mapping, типизированную
   навигацию, SSR-safe DI-scope, правила-из-багов. Не брать: шесть слоёв FSD, RN/Tamagui/`.native`, tsyringe с
   декораторами, god-интерфейс `goToX` на 47 методов, `index.ts` на каждый слайс, mapping из внешнего Strapi.
7. **Предлагаемая форма:** pnpm-монорепо `apps/<template>` + `packages/{ui,tokens,api,config,…}`. Границы между
   пакетами задаёт `exports` (жёстко, без линтера). Внутри приложения три уровня `app → features/<домен> → shared`
   (+ `pages` как тонкие маршруты). Проверяет их один архитектурный тест (или `eslint-plugin-boundaries`), он входит в `check` и CI.

## Findings

### 0. Метод и оговорки

- Репозиторий `C:/Работа/xRocket/xrocket-front`, HEAD `0d91ae406` (2026-10-13). Всего 8623 коммита, 5307 из них за
  последние 12 месяцев. Пик пришёлся на март–июль 2026 (650–830 коммитов в месяц), дальше спад: август 290, сентябрь 207.
- **«Современный» код** — это файлы, рождённые после 2025-10-14. Дату рождения я считал по `git log --name-status -M`,
  протаскивая её через переименования. Точность проверил выборкой из 40 файлов по `git log --follow`: 2 файла (5%) на
  деле старше, потому что их переименования прошли в merge-коммитах. Из 2767 не-generated `.ts/.tsx` в
  `libs/main/src` + `apps/web/src` за 12 месяцев родилось 2039 (74%). Группа «новейшие» (2026-07…10) — 827 ts/tsx,
  из них 327 tsx.
- **ИИ-ассистирование.** `CLAUDE.md` появился 2025-11-25. Есть `.claude/` (skills, commands, output-styles), `.codex/`,
  10 `CONTEXT.md`, `docs/mvvm-snippets/*.template`. Трейлер `Co-Authored-By` есть лишь в 45 коммитах: команда его
  обычно не ставит, поэтому ИИ-код по трейлеру не отделить. Его выдают стиль и плотность «почему»-комментариев.
- Всё ниже проверено по коду, если не помечено «мнение». Номера строк даны на HEAD.

### 1. Верхний уровень и доменное деление

```
apps/web        Vike SSR-сайт: pages/ (+файлы маршрутов, 153 файла), renderer/, server/, src/ (FSD)
apps/mobile     RN-хост (вне нашего скоупа)
apps/storybook
libs/main/src   всё TMA-приложение (@/* → libs/main/src/*)
  app/          27 файлов: App(.native).tsx, InitApp, Routes.tsx (1196 строк), lib/withAuthGuard …
  common/       2316 файлов: shared 1718 · pages 268 · widgets 160 · entities 150 · features 20
  domains/      1716 файлов: p2p 585 · wallet 419 · exchange 325 · xJourney 212 · qrPay 138 · settings 36
libs/tamagui    токены и темы
libs/i18n       locales.ts
tools/          eslint-rules (18 своих правил), scripts (i18n-check, генераторы API, webp, visual), conflict-pile
```

- **Домены — честные вертикали.** Импортов `domains/X → domains/Y` 0, а запрет проверяется блоками в
  `libs/main/eslint.config.mjs:634-749`, сгенерированными по списку папок. Сокет-сервис домена, его сторы и
  страницы лежат вместе.
- **Цена запрета.** Связность переехала в `common/entities`: `@/common/entities/app` импортируется в 46 местах только
  из shared-слоёв. Из `common` в домены идёт 9 импортов, все через ignore или `eslint-disable`:
  - `common/shared/store/rootReducer.ts` → три Redux-слайса `wallet`;
  - `common/entities/balance/model/BalancesStore.ts` → `domains/exchange/shared/api/ExchangeSocketService`;
  - `common/pages/acceleratorId/**` → `xJourney` и `wallet`.
- **Мелкие домены.** У `settings` 36 файлов на 9 страниц, 7 из них — страница из одного файла. Папка
  `pages/<name>/<Name>.tsx` ради одного файла — чистая структура без содержания.
- **Нестандартные сегменты:** `domains/wallet/model/`, `domains/qrPay/model/` в корне домена,
  `domains/p2p/pages/p2p/{Market,UserDeals,UserAds,Profile,UserRequisites}`. Последнее — страницы внутри страницы,
  146 файлов.

### 2. FSD-слои: насколько они заполнены

| Слой | Где | Факт |
|---|---|---|
| `common/features` | 5 слайсов, 20 файлов | knip: `FAQ`, `HoldXrocketCosmonauts` — мёртвые файлы |
| `common/entities` | 14 слайсов | в основном глобальные сторы (`AppStore`, `UserStore`, `AssetsStore`, `BalancesStore`); `user/index.ts` экспортирует `P2PProfileStore` (утечка домена) |
| `domains/*/entities` | wallet: `asset/balance/currency` — только UI-селекты; p2p: `manageAd/adDraft` — фактически стейт страницы | слой используется как «папка для того, что не влезло» |
| `domains/*/features` | только xJourney | — |
| `apps/web/src` | app 1 файл, entities 1 (README), features 1 (README), widgets 7, pages 278, shared 128 | FSD объявлен в DEV-3873 (2026-09-16), заполнены 2 из 6 слоёв |

Сканер импортов (`viol.json`) нашёл такие нарушения направления слоёв. Цифры в скобках — сколько из них в файлах,
рождённых за 12 месяцев.

| Нарушение | Всего (новые) | Главные источники |
|---|---|---|
| `shared → entities` | 95 (79) | `common/shared/ui` 32, `domains/p2p/shared` 27, `domains/exchange/shared` 13, `common/shared/api` 7 (`errors/middleware.ts` → `ToastsStore`) |
| cross-slice `entities → entities` | 92 (61) | `balance` → `user/asset/app`, `exchange/entities/symbol` → `common/entities/asset` |
| deep-импорт во внутренности чужого слайса | 46 (33) | почти все из `apps/web` в `libs/main/.../pages/*/ui/*` |
| относительный `../` между слайсами | 33 (27) | `common/entities/balance/lib → ../../asset/model/types` |
| `common → domain` | 9 (2) | см. §1 |
| cross-slice `pages`/`widgets` | 5 / 5 | — |
| `domain → domain` | **0** | правило работает |

**Вывод (факт).** Новый код нарушает слои не реже старого: 79 из 95 импортов `shared → entities` пришли в
2025–2026 годах. Правило слоёв без машинной проверки не держится даже при ИИ-ассистенте с подробным CLAUDE.md.
Держится только то, что проверяется линтером.

### 3. Декомпозиция файлов: насколько новый код следует конвенции

Конвенция по документам (CLAUDE.md §9, `docs/project-structure.md`, `apps/web/src/README.md`):
`Component/Component.tsx` + `Component.styled.ts`, рядом `types.ts`, `constants.ts`, `lib/`, `ui/`, `index.ts`.
Эталоны — `common/shared/ui/Button` и `common/shared/ui/Cell` (в них есть `constants.ts`, `types.ts`, `index.ts`,
stories и visual-тест).

Замер по всем 1256 tsx (без generated, stories, tests):

| Метрика | Старые (<2025-10) | 2025-10…2026-06 | **Новейшие 2026-07…10** |
|---|---|---|---|
| tsx-файлов | 323 | 606 | 327 |
| компонент в своей папке `X/X.tsx` | 61% | 51% | 51% |
| …есть `X.styled.ts(x)` | 14% | 33% | 60% |
| …есть `types.ts` | 1% | 1% | 15% |
| …есть `consts.ts`/`constants.ts` | 0% | 1% | 4% |
| …есть `utils.ts` | 0% | 0% | 0% |
| …есть `index.ts` | 28% | 9% | 18% |
| …есть `lib/` / `ui/` | 1% / 5% | 1% / 14% | 2% / 8% |
| tsx с объявлением типа внутри | 71% | 44% | 51% (81% из них — только `Props`) |
| tsx с UPPER_CASE-константой внутри | 6% | 12% | 11% |
| `styled()` прямо в tsx | 0% | 10% | 7% |
| больше одного компонента в файле | 5% | 16% | 7% |
| tsx > 200 строк | 9% | 10% | 3% |
| медиана строк tsx | 68 | 68 | 46 |
| файлов в папке компонента (среднее) | 2,44 | — | 2,44 |

По слоям среди новых папок-компонентов: `apps/web` — `.styled` 97%, `types` 0%, `index` 0%; `pages` (268) —
`.styled` 36%, `types` 3%, `index` 7%; `shared/ui` (88) — `.styled` 38%, `index` 36%; `entities` — `types` 48%.

**Где конвенция ломается (факты):**
- **Имена файлов не едины.** Стили лежат в `.styled.ts` (280), `.styled.tsx` (21), `.styles.ts` (19, все новейшие:
  `p2p/widgets/dealChat`), `.module.scss` (236, наследие Consta и web). Константы — `consts.ts` (17) против
  `constants.ts` (16), причём эталонный `Button` использует `constants.ts`, а наш бойлерплейт требует `consts.ts`.
- **Папка компонента становится мешком.** `p2p/pages/deal/ui/DealLoader/` содержит 6 соседних компонентов
  (`ChatSkeleton`, `DetailRow`, `HeaderSkeleton`…). В `p2p/widgets/dealChat/ui/DealBubble/` их 5, у каждого свой
  `.styles.ts`. В `exchange/pages/tradePair/ui/TradeForm/TradeFormInputsLimit/` 4 подкомпонента рядом с `.module.scss`.
- **Глубина вложенности.** Каталогов `ui/*/ui` 70, `ui/*/ui/*/ui` — 22. Максимальная глубина 16 сегментов:
  `domains/p2p/pages/deal/ui/DealSuccessModal/ui/DealReviewForm/ui/ReviewBlockedNotice/ReviewBlockedNotice.tsx`.
  Это прямо противоречит правилу пользователя «страница плоская, вытащи из ui».
- **Даже «эталонный» новый слайс неоднороден.** `qrPay/pages/transaction` (июнь 2026):
  - `ui/DisputeCreateModal.tsx` лежит плоско, без папки;
  - `ui/InfoList/InfoRow/` вложен без `ui/`;
  - `index.ts` есть только у `DisputeButton`.
- **Типы и константы уходят на уровень слайса,** а не к компоненту: `model/types.ts` (35), `model/consts.ts` (8) +
  `constants.ts` (7), `lib/types.ts` (6). Утилиты лежат в `lib/<name>.ts`, а не в `utils.ts`: `utils.ts` во всём
  репо 5 штук.

**Во что обходится полная схема (мнение, на цифрах).** Типичный новый компонент — 46–65 строк tsx и 37 строк стилей.
Если раскладывать его на `types.ts` + `consts.ts` + `utils.ts` + `index.ts`, файлов станет не 2,4, а 5–6, причём в
`types.ts` будет одна `Props`. Команда, пишущая с ИИ, к этому не пришла: де-факто конвенция — «tsx + styled, Props
внутри, общее на уровне слайса». Полная схема окупается только для shared UI kit: публичный API, stories и тесты
там действительно нужны.

### 4. MVVM, DI, слой запросов

**Как устроено** (`docs/mvvm.md` на 738 строк, 20 кейсов, 29 шаблонов в `docs/mvvm-snippets/`):
- **Store** — `@provide.singleton()`, держит `MobxQuery`/`MobxMutation` из сгенерированных фабрик
  `walletQueries.x(params, opts)`, `walletMutations.y()`. Пример: `domains/wallet/entities/addressRotation/model/AddressRotationStore.ts`.
- **ViewModel** — `@provide.transient()`, `implements ViewModel`, `makeAutoObservable(this, {}, { autoBind: true })`.
  Получает сторы через конструктор. Пример: `domains/exchange/widgets/MarketsList/model/MarketsListViewModel.ts`,
  `get listState(): 'unavailable'|'error'|'loading'|'emptySearch'|'empty'|'ready'` — хороший пример «derive, do not toggle».
- **Page root:** `useViewModelProvider(VM)` + `<ViewModelProvider>`. **View:** `useViewModel(VM)`.
- **DI** (`common/shared/lib/ioc.ts`, 70 строк) — tsyringe + `reflect-metadata`. Singleton регистрируется как
  `Lifecycle.ContainerScoped`: на клиенте это синглтон, а на SSR каждый запрос получает child-container
  (`requestScope.ts`, `prefetchViewModel.ts`). Сторы между запросами не делятся. **Идея сильная и переносимая;
  реализация на декораторах требует `experimentalDecorators` + `emitDecoratorMetadata` (`tsconfig.base.json:8-9`) и
  babel-плагина `decorators-legacy` в `apps/web/vite.config.mts:103,129`.**

**Насколько внедрено (факт):**

| Показатель | Значение |
|---|---|
| Страниц с VM | 22 из 64 (qrPay 6/7, common/pages 9/15; tradePair, deal, deposit, altyn*, весь xJourney — без VM) |
| `PageQueryGuard` | 5 файлов |
| `useStore(` в tsx | 330 файлов (в `tradePair` 40, в `p2p/pages/p2p` 74) |
| `eslint-disable xrocket/no-store-in-page-view` | 233 директивы в 227 файлах; 138 из этих файлов родились за 12 мес (массово вставлены при включении правила 2026-04), 15 — в новейших |
| Стили доступа к данным (файлов) | `LoadingStatus` вручную — 158; ручной `api.x.GET/POST` — 25; сгенерированные `*Queries/*Mutations` — 17; `new MobxQuery/Mutation` — 21; TanStack `useQuery` напрямую — 20; Redux — 34; axios — 57 (в основном старое) |
| В новейших файлах (829 ts/tsx) | `LoadingStatus` 26, ручной `api.x.*` 9, `useQuery` 6, сгенерированные фабрики 3 |

**Вывод.** Документированный «единственный путь» (фабрика → MobxQuery в сторе → статус из query) в новом коде всё ещё
в меньшинстве: даже свежий `MarketsListViewModel` читает `symbolsStatus: LoadingStatus` из стора. Причина — инерция
соседнего кода: ИИ копирует то, что видит рядом. Это совпадает с правилом пользователя «не копируй устаревший
паттерн у соседей» (boilerplate `architecture.md` §4), и оно должно идти с проверкой, а не с текстом.

### 5. Слой ошибок API

- `common/shared/api/errors/`: `middleware.ts`, `resolveApiResponse.ts`, `responseMappings.ts`, `loadError.ts` и 12
  файлов `mappings/<service>.generated.ts`.
- **Формат записи:** `'/api/v1/wallet/qr/payments': { responses: [{ variants: ['GET_400_/api/problems/validation_error',
  'GET_ERR'], type: 'toast'|'modal'|'custom'|'silent', severity, i18n: {title, subtitle}, support }] }`. Матчинг идёт
  `METHOD_STATUS_problemType` с фоллбэком `METHOD_ERR`.
- **Тот же файл генерирует фабрики `xxxQueries`/`xxxMutations`** поверх `openapi-fetch` (`api.ts`). Типы — из
  `openapi-typescript` (`tools/scripts/api/openapi-generator.sh`).
- **xRocket-специфика:** mappings берутся скриптом `tools/scripts/xrocket-tools/xrocket-tools-generator.mjs` из
  внутреннего «tools-api» (Strapi, логин и пароль в `.env`). Источник правды по UX ошибок лежит вне репо.
- **Дыры:**
  - прямые импорты `mappings/*.generated` из доменов дают TDZ-циклы, запрет на них в `src/domains/**` перетёрт;
  - `api/errors/middleware.ts` импортирует `ToastsStore` из entities, то есть shared зависит от entities.
- **Легаси-генерация живёт рядом:** `common/shared/api/{wallet,exchange,xjourney,user,…}/api.ts` от
  openapi-generator + axios (`wallet/api.ts` — 8460 строк), 12 скриптов `api-generator-*-old`.

### 6. Навигация

- **Типизированный хук** `common/shared/lib/navigation/useNavigation.types.ts` — интерфейс `AppNavigation` с 47
  методами `goToX`. Две реализации: `useNavigation.ts` (React Navigation) и `useNavigation.web.ts` (347 строк, маппинг
  в URL). Плюс `navigationBackPolicy.ts`, `backActionByScreenName.ts`, `createResetNavStateAction.ts`.
- **Роуты в одном файле** `app/Routes.tsx` на 1196 строк. Хорошее в нём — `typedLazyImportWithRetry` с предзагрузкой
  i18n-неймспейсов. Плохое — god-файл.
- **Правило `no-platform-navigation-outside-page-root`** (2026-09-25, warn): React Navigation падает в Vike-сборке.
- **Мнение.** Типизированная навигация с `goToX` — компенсация за то, что React Navigation и URL-роутер надо
  было свести к одному API. В web-only это делает сам типизированный роутер (`<Link to="/wallet/$id">` с проверкой
  параметров). Отдельный 47-методный интерфейс, который правят на каждый экран в 4+ местах, не нужен.

### 7. i18n, SSR-безопасность, платформенные варианты

- **i18n:**
  - `common/shared/i18n/` (catalogs, loader, namespaceUsage.test), lazy-неймспейсы по экранам;
  - правило `require-i18n-namespace`, правило `no-i18n-in-getter` для `*Store/*ViewModel`;
  - скрипты `check-i18n-completeness.mjs` (с baseline `tools/i18n-completeness-baseline.json`), `check-i18n-web.mjs`,
    `sync-i18n.mjs` в pre-commit.
  - Набор переносим целиком: детали у агента по i18n, если такой есть.
- **SSR:**
  - DI request-scope (§4) и `prefetchViewModel` для Vike `+onBeforeRender`: 44 файла в `apps/web/pages`;
  - правило `no-platform-globals-in-store` (2026-08-26) — никаких `window`/`document` в DI-классах;
  - отдельный барел `tma` для Telegram-only экспорта, `index.ssr.test.ts` проверяет, что общий барел `lib` SSR-safe;
  - при этом `typeof window|document` ещё в 57 файлах;
  - runtime-тест SSR в CI отключён: «still red on SSR hydration mismatches» (`.gitlab-ci.yml:79`).
- **Платформы:**
  - 19 `.native.*` и 11 `.web.*` (в основном `common/shared/lib`, `common/shared/ui`, `app/`);
  - `react-native` импортируют 123 файла, Tamagui — 548 tsx;
  - `react-native/no-raw-text` отключён 34 раза. **Для бойлерплейта всё это мёртвый груз** (решение 4 брифа).

### 8. Границы импортов и их принуждение

**18 своих правил в `tools/eslint-rules/`.** Все появились в 2026 году, каждое после конкретного бага:

| Группа | Правила |
|---|---|
| MVVM | `no-store-in-page-view`, `no-page-query-guard-outside-page-root`, `require-viewmodel-autobind`, `require-mobx-default-values`, `no-i18n-in-getter`, `observer-named-function` |
| Платформа и SSR | `no-platform-globals-in-store`, `no-platform-navigation-outside-page-root`, `no-viewport-height` |
| UI | `no-inline-styles-tamagui-aware`, `no-color-literals-tamagui-aware`, `no-transition-property-all`, `no-leaked-render-children`, `no-inert-handler`, `no-direct-tabler-icons` |
| Инфраструктура | `public-api`, `no-direct-persist-import`, `require-i18n-namespace` |

Ещё `no-restricted-syntax` против захардкоженных legal-URL. У каждого блока в `eslint.config.mjs` есть комментарий
«почему» со ссылкой на тикет — это лучший переносимый паттерн репо.

**Слабые места (факт):**
1. **Границы на `no-restricted-imports`.** Последний подходящий блок flat config заменяет правило целиком. Конфиг сам
   это признаёт (`libs/main/eslint.config.mjs:448-451`), но защищён так только запрет tabler-иконок
   (подробно в отчёте 06 §1.4). Справка ESLint о слиянии конфигов:
   https://eslint.org/docs/latest/use/configure/configuration-files#cascading-configuration-objects
2. **`shared → entities` не запрещён вообще.** Отсюда 95 нарушений.
3. **`public-api` видит только `@/`-спецификаторы,** в `apps/web` не включено. Отсюда 46 deep-импортов, из них 33 в новом коде.
4. **`@nx/enforce-module-boundaries` выключен** из-за бага с `.tsx`-барелами (`eslint.config.mjs:24`). Nx-тегов нет.
5. **`max-lines: 200` для tsx стоит в режиме `warn`** (`libs/main/eslint.config.mjs:532`), а лимита в 700 строк для
   прочих файлов в линте нет. 33 отключения `max-lines`, 24 файла длиннее 700 строк: `AltynWidgetStore` 1471,
   `Routes.tsx` 1196, легаси `api.ts`.
6. **В `apps/web` два линтера:** `biome.json` и `eslint.config.ts`.
7. **Отключений:** `no-store-in-page-view` 233, `no-explicit-any` 65 (11 файлов из них новейшие),
   `no-inline-styles-tamagui-aware` 61, `/* eslint-disable */` на весь файл 82.

### 9. Барелы, мёртвый и сгенерированный код

- **Барелы.** `index.ts` 346 штук (190 родились за 12 мес, 74 новейшие). Из них 148 однострочные. Строк
  `export * from` 136. Есть обходной барел «для линтера» (`qrPay/pages/pay/index.ts`, отчёт 06).
- **Мёртвый код.** `pnpm knip` (`knip:ci --max-issues 0`) существует, но в `lint:ci` и pre-commit не вызывается,
  `deps:unused` идёт с `--no-exit-code`. Есть и `knip.json`, и `knip.jsonc` с разным содержимым. Мой прогон
  (read-only) нашёл 69 неиспользуемых файлов (63 в `libs/main/src`), 65 экспортов и 47 типов. Среди файлов —
  `common/features/FAQ`, 7 хуков `wallet/entities/wallet/api/use*.tsx`, `common/shared/ui/{ConvertFrom,ConvertTo,Rate}`.
- **Сгенерированный код.** 47 файлов, 66,5 тыс. строк в `libs/main/src/**/generated*`, плюс легаси axios-клиенты.
  Pre-commit исключает `generated/` из лимита диффа в 40 000 строк. Генерация и маппинги ошибок регенерируются
  отдельными скриптами, а не одной командой.

### 10. Документы против кода (дрейф)

- **`docs/project-structure.md`** описывает корневой `libs/main/src/shared/` (DEV-3266), а его уже нет. Там же
  `features/` назван «only xJourney has it».
- **CLAUDE.md §9** требует MVVM + `PageQueryGuard` для страниц, а реально так сделано у 22 из 64 страниц, guard — в 5 файлах.
- **`apps/web/src/README.md`** объявляет 6 слоёв, а заполнены 2.
- **Повторы текста.** CLAUDE.md (1109 строк) и `docs/project-structure.md` слово в слово повторяют раздел про web page
  slice. Ещё 10 `CONTEXT.md`, часть ссылается на несуществующие файлы (отчёт 06 §1.7).

### 11. Что хорошо и универсально / что накладно / что не копировать

| Универсально и полезно (брать) | Накладно или специфично (адаптировать) | Не копировать |
|---|---|---|
| Доменные вертикали и 0 кросс-доменных импортов | MVVM на MobX: хорош для сложных экранов, излишен для лендинга и магазина | RN, Tamagui, RNW, `.native.*`, `react-native/*` правила |
| Тонкая страница + VM/hook с derived `pageState` | DI-контейнер: нужен request-scope на SSR, но без tsyringe и декораторов | 6 FSD-слоёв в каждом домене и в web-app |
| Слой запросов: генерация из OpenAPI → фабрики query/mutation | `goToX`-интерфейс: в web-only заменяется типизированным роутером | `index.ts` на каждый слайс, `export *` |
| Центральный error mapping `endpoint × status × problem → toast/modal/silent` + i18n-ключ | Strapi-«tools-api» как источник маппингов: заменить файлом в репо | God-файл роутов, `ui/*/ui/*/ui` |
| Правило «баг → lint-правило с message-почему» | Pre-commit с полным `tsc` по 4 проектам: медленно, лучше в CI + lint-staged | Границы на `no-restricted-imports` в нескольких блоках flat config |
| SSR request-scope, SSR-safe барел, отдельный барел для TMA-SDK | i18n-тулинг (completeness, sync, baseline) — да, но под один каталог | Глубокие импорты app → чужое приложение |
| Ленивые экраны с retry и предзагрузкой неймспейсов | knip: брать, но в CI с exit-code | Два линтера в одном приложении; `consts.ts` и `constants.ts` вперемешку |
| `conflict-pile`, webp-хук, лимит диффа | Snippet-шаблоны MVVM (29 файлов) — полезны агентам, но дороги в поддержке | `eslint-disable` пачками при включении правила (227 файлов) — вместо baseline |

## Recommendations for the boilerplate

### R1. Структура монорепо для нескольких шаблонов (P0)

```
apps/
  tma/            шаблон Telegram Mini App
  landing/        шаблон лендинга (SSR/SSG)
  shop/           шаблон магазина (headless commerce)
  admin/          шаблон админки
  <app>/src/
    app/          composition root: providers, init, router, error boundary, global handlers
    pages/        тонкие маршрутные адаптеры: файл = маршрут, только композиция features
    features/     доменные вертикали
      <domain>/
        <Screen>/        экран: <Screen>.tsx (root) + model/ (store, vm/hook) + компоненты плоско
        components/      UI домена, переиспользуемый его экранами
        api.ts|model/    запросы и сторы домена
        index.ts         ЕДИНСТВЕННЫЙ публичный API домена
    shared/       код приложения без бизнес-знаний (lib, config, hooks); UI кита сюда не копировать
packages/
  ui/             общий UI kit: props-only, stories, visual-тесты; exports только из index
  tokens/         дизайн-токены и темы (CSS variables), без React
  api/            сгенерированные OpenAPI-клиенты + фабрики query/mutation + error mappings (как данные)
  i18n/           ядро i18n, типы ключей, проверки (каталоги — в приложениях)
  config/         eslint, tsconfig, prettier, vitest пресеты
  platform-tma/   опционально: обёртки Telegram SDK (удаляется init-скриптом вместе с apps/tma)
tools/
  init/           скрипт выбора шаблонов
  eslint-rules/   свои правила (по образцу xRocket: баг → правило → message «почему»)
  arch-test/      архитектурный тест импортов
```

Почему так:
- **Пакеты `packages/*` — жёсткая граница через поле `exports` в `package.json`.** Deep-импорт `@acme/ui/src/Button/x`
  не резолвится вообще, линтер не нужен. Это закрывает главный провал xRocket: 186 импортов `apps/web → libs/main`,
  21 из них во внутренности чужих страниц. Документация Node о `exports`: https://nodejs.org/api/packages.html#exports.
  TypeScript учитывает `exports` при `moduleResolution: "bundler"` или `"node16"`.
- **Приложения никогда не импортируют друг друга.** Если лендингу нужен экран TMA, экран (или его UI) переезжает в
  пакет. Init-скрипт тогда может удалить любое `apps/<x>`, ничего не сломав. Это прямо проверяемо: удалить и
  собрать (см. R7).
- **Три уровня внутри приложения** (`app → pages → features → shared`, плюс внешние `packages/*`) вместо шести.
  Отдельные `entities`, `widgets` и `features`-внутри-домена не заводятся: в xRocket они заполнены формально
  (entities из одного UI-селекта, 2 из 6 слоёв в web).

### R2. Правила слоёв (P0)

1. `packages/ui` и `packages/tokens` не импортируют ничего из `apps/*`, `packages/api` и стор-библиотек. Только props.
   (xRocket: 32 импорта `common/shared/ui → entities`.)
2. `shared/**` приложения не импортирует `features/**`, `pages/**`, `app/**`. `import type` тоже запрещён.
   (xRocket: 95 нарушений, правила не было.)
3. Чужой домен импортируется только через `@/features/<d>` (его `index.ts`). Проверяются и `@/`, и относительные
   `../` (в xRocket `public-api` видел только `@/`). Композиция доменов через публичный API разрешена: полный запрет в
   xRocket вытолкнул связность в глобальные синглтоны.
4. `features/**` не импортирует `pages/**` и `app/**`.
5. Сгенерированный API импортируется только через барел `@acme/api` (в xRocket прямые импорты давали TDZ-циклы).
6. Глобальные сторы (auth, user, theme, toast) живут в `shared/model` приложения или в `app/`. Отдельного
   «entities»-слоя для них нет.

### R3. Механизм принуждения (P0)

- **Основной — один архитектурный тест** `tools/arch-test`: `node:fs`, без зависимостей, около 80 строк. Проходит по
  `apps/*/src` и `packages/*/src`, извлекает `import … from` и `import()`, нормализует `../` и `@/`, проверяет R2,
  в ошибке пишет файл, правило и «почему». Входит в `pnpm check` и CI. Плюсы: нет ловушки flat config, видит
  относительные пути, одинаково работает на Windows (нормализовать `path.sep`).
- **Альтернатива — `eslint-plugin-boundaries`:** даёт подсветку в IDE. Если выбирать его, то **одно** правило в
  **одном** блоке конфига. Добавлять ли второй механизм — открытый вопрос 2.
- **Лимиты.** `max-lines` 200 для tsx и 700 для прочего — `error`, не `warn`. Для унаследованного кода — baseline-файл,
  а не 227 `eslint-disable`. `knip --max-issues 0` в CI с первого дня.
- **Свои ESLint-правила** — по образцу xRocket, но только после реального бага. Стартовый набор, полезный в web-only:
  - `observer-named-function` (если MobX);
  - `no-inert-handler`, `no-leaked-render-children`;
  - `require-i18n-namespace`, `no-i18n-in-getter`;
  - `no-platform-globals-in-store` (SSR);
  - `no-transition-property-all`, `no-direct-<icons>`;
  - запрет хардкода legal-URL.

### R4. Декомпозиция файлов — поправить docs/code-style.md (P1)

На цифрах xRocket полная схема на практике не держится и дорога. Предложение:
- **Обязательно:** папка `Name/` с `Name.tsx`, когда у компонента есть хоть один спутник (стили, stories, тест,
  подкомпонент). Без спутников компонент может лежать одним файлом `Name.tsx` в папке экрана.
- **`types.ts`, `consts.ts`, `utils.ts` создаются, только когда в них больше одного экспорта или они используются
  снаружи.** Сейчас в `docs/code-style.md` «Types and props in `types.ts`… Never in the `.tsx`» — это расходится с
  практикой xRocket (81% inline-типов там — одна `Props`). Решение за пользователем (вопрос 1). Если правило остаётся
  строгим, его надо поставить на lint, иначе оно не выживет, как не выжило в xRocket (types.ts у 15%).
- **Одно имя на одну сущность и проверка именования в линте:** `consts.ts` (не `constants.ts`), `Name.styled.ts`
  (или `Name.module.css`, по выбранному стеку стилей), не `.styles.ts`.
- **Подкомпоненты лежат плоско рядом, а не в `ui/X/ui/Y`.** Лимит глубины — `features/<d>/<Screen>/<Component>/` плюс
  один уровень. Проверять тестом на глубину пути (в xRocket доходило до 16 сегментов).
- **`index.ts`** — только у домена (`features/<d>/index.ts`) и у пакета. У компонентов kit'а `index.ts` не нужен, если
  экспорт идёт из `packages/ui/src/index.ts`. Никакого `export *`.

### R5. Что поправить в docs/architecture.md (P1)

1. **§1:** заменить дерево `src/{app,domains,common/{pages,entities,widgets,shared}}` на `apps/* + packages/*` и три
   уровня внутри приложения (R1). Слой `common/entities` и `common/widgets` убрать. Кросс-доменные виджеты либо
   переезжают в домен-владелец, либо становятся props-only компонентами в `packages/ui`.
2. **§2:** добавить правило «приложения не импортируют друг друга, только `packages/*` через `exports`». Добавить
   запрет `import type` в направлении `shared → features`. Механизм принуждения выбрать один (R3).
3. **§3 MVVM:** сделать слои по сложности экрана:
   - простой экран: компонент + query-хук;
   - сложный экран: store/VM.

   Не требовать VM у лендинга. Поправить «DI»: request-scope для SSR обязателен, если есть SSR и сторы-классы, но без
   tsyringe и декораторов. Достаточно фабрики контекста на запрос.
4. **§6 Навигация:** «один типизированный universal-хук `goToX` на все платформы» — это компромисс RN. Заменить на
   «типизированный роутер выбранного стека (typed routes/links); прямые строковые URL запрещены; ссылки строит один
   helper». Правило «VM не навигирует, навигирует владелец кнопки» оставить.
5. **§8:** удалить `.native.*`, React Native, «code shared between web, SSR and native». Оставить SSR-правила:
   - нет глобалов браузера на уровне модуля и в конструкторах;
   - request-scope;
   - SSR-safe барел;
   - отдельный барел для TMA SDK;
   - persistence через один адаптер.
6. **§5:** уточнить, что error mapping — это **данные в репо** (`packages/api/errors/*.ts`), генерируемые из OpenAPI
   с ручными оверрайдами в отдельном файле. Не тянуть их из внешнего CMS, как xRocket.
7. **§1 таблица «What did not work»:** добавить три строки:
   - deep-импорты между приложениями;
   - `eslint-disable` пачками при включении правила;
   - knip без CI.

### R6. Что поправить в CLAUDE.md и docs/code-style.md бойлерплейта (P1)

- **В CLAUDE.md §3 «Component files ≤ 200 lines»** дописать «error в lint, baseline для старого кода».
- **`code-style.md` §1, эталон «the shared `Button` / `Cell` of the past project»:** эталон xRocket сам использует
  `constants.ts`. Дать собственный эталон из `packages/ui`.
- **`code-style.md` §6 «Cross-platform code»:** сократить до web-специфики (SVG-иконки, `dvh/svh`, клавиатура iOS и
  Android). Убрать `react-native-svg` и `.native.tsx` stubs.
- **Добавить правило «новый код следует документированному паттерну, а не соседнему файлу»** с проверкой: например,
  запрет ручного `LoadingStatus` в новых файлах через lint. В xRocket новейший код всё ещё в 26 файлах пишет
  `LoadingStatus` руками.

### R7. Связка с init-скриптом (P0)

- Каждое `apps/<x>` и опциональный пакет (`platform-tma`) удаляется целиком, без правок в других местах. Проверка в
  CI: матрица «удалить всё, кроме шаблона X → `pnpm install && pnpm check && pnpm build`».
- Архитектурный тест и ESLint-правила в `packages/config` работают по glob `apps/*/src`, без списков приложений и
  доменов. В xRocket блоки генерировались по захардкоженному `domainFolders`.

## Open questions for the user

1. Компонентные `types.ts`/`consts.ts`: оставить строгое «никогда в tsx» (тогда нужен lint и смириться с 4–6 файлами
   на мелкий компонент) или разрешить `Props` и одноразовые константы внутри tsx, а выносить при повторном
   использовании или при объёме больше N строк?
2. Механизм границ: только архитектурный тест в CI (без зависимостей, без подсветки в IDE) или ещё
   `eslint-plugin-boundaries` ради подсветки в редакторе?
3. MVVM на MobX с классами — стандарт для всех шаблонов или только для TMA и админки, а лендингу и магазину хватит
   query-хуков?
4. Экраны, общие для нескольких шаблонов (например, auth или профиль в TMA и в админке): выносить в отдельный
   `packages/features-<x>` или считать, что шаблоны не делят экраны, а только UI kit, токены и API?
