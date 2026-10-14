# 06. Init script (выбор шаблонов и очистка монорепо)
Status: done
Updated: 2026-10-14

## Resume notes
- Done: все разделы. Список шаблонов взят из research/05-templates.md §1 (ids `landing`, `shop`, `tma`, `admin`, `game`; фичи-опции `pwa`, `blog`, `i18n`, `analytics`). Если 05 поменяет список, архитектура не меняется: меняется только манифест.
- Next: ничего. Если 05 добавит шаблон, дописать модуль в пример манифеста (§F4) и пересчитать CI-матрицу (§F9).
- Sub-agent: не использовался.

## Summary (≤ 15 lines)
1. **Подход: «вычитание по манифесту» (subtractive).** Исходный репозиторий сам по себе рабочий монорепо со ВСЕМИ шаблонами. Его разрабатывают и проверяют в CI целиком. Init только удаляет то, что не выбрано, и перегенерирует несколько сводных файлов. Сборка из частей (create-t3-app, Better-T-Stack) и маркеры в коде отвергнуты: исходник там нельзя запустить и проверить линтером.
2. **Главный инвариант: у каждого файла ровно один владелец.** Владелец — либо модуль (шаблон или фича), либо core, либо файл генерируется из манифеста. Списков, которые пришлось бы править вручную, нет: CI находит приложения сам, exports в package.json заданы wildcard'ами, у каждого приложения свой Dockerfile, свой eslint.config, свой `.env.example`, свой `CLAUDE.md`. Покрытие проверяет тест `manifest-coverage`.
3. **Общие пакеты обрезаются по графу зависимостей**, как это делает `turbo prune`. Остаются пакеты, до которых можно дойти от выбранных приложений по `workspace:*`. Вручную `usedBy` не ведётся.
4. **Манифест** — `boilerplate.manifest.ts`, типизирован, Node 24 читает его без сборки. Маркеры `<!-- init:<id> -->` разрешены только в Markdown (README, CLAUDE.md, docs).
5. **CLI:** один бандл `tools/init/dist/init.mjs`, он запускается до `pnpm install`. Внутри `@clack/prompts`, `node:util parseArgs`, `yaml`. Команда: `pnpm run init` (не `pnpm init`, это встроенная команда pnpm).
6. **Порядок шагов:** preflight → выбор → план → (dry-run: стоп) → подтверждение → перенос удаляемого в `.init-backup/` → правки → install → чистка каталога, allowBuilds, overrides и patches → update → prettier → проверки (typecheck, lint, test, build, knip, поиск остатков) → удаление бэкапа → запись `.boilerplate.json`.
7. **Откат без git:** удаляемые файлы не стираются, а переносятся в бэкап. Любое изменённое содержимое тоже кладётся туда. При ошибке всё восстанавливается из бэкапа, при обрыве процесса — по журналу. Повторный запуск идемпотентен.
8. **Для Claude-агента:** `pnpm run init -- --templates tma,landing --features pwa --name acme --yes --json`. Без TTY и без флагов скрипт падает с кодом 2 и ничего не спрашивает.
9. **CI-матрица:** на каждый PR 7 комбинаций на Linux плюс 2 на Windows с кириллическим путём. Каждую ночь все 31 комбинация. Плюс тесты на dry-run (дерево не изменилось), откат (хеш дерева совпал) и идемпотентность.

## Findings

### F1. Как это делают другие (проверено по источникам, 2025–2026)

| Инструмент | Модель | Что полезно взять | Почему не берём целиком |
| --- | --- | --- | --- |
| create-vite | Отдельная папка на каждый шаблон, копирование. Флаги `--template`, `--no-interactive` ([vite.dev/guide](https://vite.dev/guide/)) | Режим без вопросов через флаг | Нет монорепо и мультивыбора. Общий код дублировался бы в каждой папке |
| create-t3-app | База `template/base` + «installers», которые копируют файлы из `template/extras` и дописывают зависимости (`addPackageDependency`, `dependencyVersionMap.ts`) ([installation](https://create.t3.gg/en/installation), [repo installers](https://github.com/t3-oss/create-t3-app/tree/main/cli/src/installers)) | `--CI` + флаги на каждую опцию; `-y`; `--noInstall`; `--noGit` | Сборка из частей: исходник не запускается как проект, версии зависимостей зашиты в CLI. Флаги сами помечены как experimental |
| Better-T-Stack | Генерация из шаблонов по фичам (отдельный пакет template-generator), Turborepo, мультивыбор `--frontend a b` ([CLI docs](https://www.better-t-stack.dev/docs/cli)) | `--yes`, `--dry-run` (проверяет конфигурацию без записи), команда `add` для добавления позже | Тот же минус, что у сборки из частей. Комбинаторику приходится покрывать тестами генератора |
| Nx generators | Виртуальная ФС `Tree`, изменения копятся и применяются в конце, `--dry-run`, `formatFiles`, тесты на `createTreeWithEmptyWorkspace` (источник неофициальный: [tessl mirror](https://tessl.io/registry/tessl/npm-nrwl--devkit/files/docs/generators.md)) | **Паттерн «план → применение»**: сначала вычисляем список операций, dry-run печатает его. Форматирование изменённых файлов | Тянет за собой Nx целиком; Nx в стек не выбран |
| turbo gen (Plop) | Генераторы для **добавления** пакетов: `turbo gen workspace --copy` ([turborepo.dev](https://turborepo.dev/docs/guides/generating-code)) | Пригодится после init, чтобы добавлять пакеты и страницы | Удалять не умеет |
| turbo prune | Частичный монорепо для одного пакета: исходники нужных внутренних пакетов + урезанный lockfile; режим `--docker` выдаёт `json/` и `full/` ([turborepo.dev/docs/reference/prune](https://turborepo.dev/docs/reference/prune)) | **Логику графа** (оставить то, до чего дотягиваются выбранные приложения). `--docker` использовать в Dockerfile каждого приложения | Копирует в `out/`, не правит исходный репо. Не трогает docs, CI, `.claude`. `globalDependencies` не копирует без future flag |
| degit / tiged / giget | Скачать репо или подпапку без истории. giget: tarball без локальных git и tar, `#ref`, auth, offline-кэш, v1.2.x ([unjs.io/packages/giget](https://unjs.io/packages/giget)) | Канал раздачи: `pnpm dlx giget gh:<org>/frontend-boilerplate my-app`, затем init | Чистить они не умеют |
| copier / cookiecutter | Python, Jinja, файл ответов. У copier есть `update` через diff с миграциями ([copier updating](https://copier.readthedocs.io/en/stable/updating/)) | Идея **файла ответов** (`.boilerplate.json`) для будущих обновлений | Python на машине пользователя может отсутствовать (docs/tooling.md §11). Требование брифа — только Node |
| Yeoman | Генераторы на Node; в 2025 перезапуск поддержки ([yeoman.io blog](https://yeoman.io/blog/maintenance-reboot)) | — | Тяжёлый, сам себя описывает как «no longer at the cutting edge» |
| Hygen | Шаблоны-генераторы | — | Неактивен: последний релиз около 3 лет назад ([snyk](https://security.snyk.io/package/npm/hygen)) |
| pnpm | `--filter`, `update -r [--latest]`, каталоги: при обновлении правится `pnpm-workspace.yaml`, а не package.json ([pnpm.io/cli/update](https://pnpm.io/cli/update)). В pnpm 11.22 настройка `cleanupUnusedCatalogs` переименована в `catalogPrune`, добавлена `minimumReleaseAgeExcludePrune` (по стороннему зеркалу [newreleases](https://newreleases.io/project/npm/pnpm/release/11.22.0); перед использованием проверить в официальном changelog) | Опираемся на штатную чистку каталога, но дублируем её своей проверкой (§F6) | — |

### F2. Сравнение архитектур

| Критерий | A. Папка на шаблон (create-vite) | B. Сборка из частей (t3, BTS) | C. Маркеры в коде (`// #if tma`) | **D. Вычитание по манифесту (рекомендуется)** |
| --- | --- | --- | --- | --- |
| Исходник — рабочий проект | да, но по отдельности | нет | частично (линтер и TS видят все ветки) | **да, все шаблоны сразу** |
| Общий UI-kit и пакеты | дублируются | собираются | общие | **общие, обрезаются по графу** |
| Мультивыбор | плохо | хорошо | средне | **хорошо (удаление коммутативно)** |
| Надёжность | высокая | средняя (комбинации не видны до генерации) | низкая (сломанные маркеры, Prettier переносит строки) | **высокая, если соблюдается инвариант владения** |
| Поддержка | дрейф между копиями | два источника правды: шаблон и генератор | маркеры расползаются | **один источник; тест покрытия ловит ничейные файлы** |
| Тестируемость | просто | нужна матрица генерации | нужна матрица | **матрица по подмножествам, плюс полный репо и так проверяется в обычном CI** |
| Dry-run, откат | — | просто (пишем в пустую папку) | сложно | **просто: план — это список операций, откат идёт из бэкапа** |
| Добавить шаблон после init | нет | да (команда `add`) | нет | нет вычитанием; нужен отдельный `add` (открытый вопрос 3) |

Почему D подходит именно здесь. Пользователь сам сформулировал задачу как «удалить всё ненужное» (бриф §1). Шаблоны живут в одном монорепо с общим kit'ом. Агенты Claude работают с исходником как с обычным проектом: правила, линтер и тесты действуют на все шаблоны. Цена подхода — дисциплина: шаблоны не импортируют друг друга, а общие файлы не содержат знаний о конкретном шаблоне. Эту дисциплину обеспечивают тесты из §F9.

### F3. Структура исходного репозитория

```
frontend-boilerplate/
├── boilerplate.manifest.ts        манифест (удаляется после init)
├── .boilerplate.json              создаётся init: выбор, версия, дата
├── package.json                   только тулинг + скрипты через turbo, без зависимостей шаблонов
├── pnpm-workspace.yaml            packages: [apps/*, packages/*, tools/*], catalog, allowBuilds, overrides
├── turbo.json                     generic-задачи: build, typecheck, lint, test
├── compose.yaml                   GENERATED: include: apps/*/compose.yaml
├── apps/
│   ├── landing/  shop/  tma/  admin/  game/
│   │   ├── package.json  eslint.config.ts  tsconfig.json  .env.example
│   │   ├── Dockerfile  compose.yaml  deploy.json   (target, порт, тип static|ssr)
│   │   ├── CLAUDE.md                контекст шаблона для агента
│   │   └── e2e/  src/
├── packages/
│   ├── ui/            общий kit (props-only)       ← core
│   ├── tokens/        дизайн-токены, темы           ← core
│   ├── i18n/  api-client/  config/                  ← core или фича
│   ├── ui-data/       таблицы, фильтры (admin)      ← обрезается по графу
│   ├── commerce/      адаптеры headless commerce    ← граф (shop)
│   ├── telegram/      SDK-обёртки TMA               ← граф (tma, game-в-TMA)
│   ├── game-kit/      движок и обвязка              ← граф (game)
│   ├── eslint-config/ src/presets/<id>.ts, exports "./*"
│   └── tsconfig/      base.json, spa.json, ssr.json, lib.json
├── tools/
│   ├── init/          src/*.ts, dist/init.mjs (закоммиченный бандл), test/
│   └── eslint-rules/  <rule>/ (правило конкретного шаблона принадлежит модулю)
├── .claude/
│   ├── rules/         core-*.md, <id>-*.md (с frontmatter paths: apps/<id>/**)
│   └── skills/        core-скиллы, <id>-* (например tma-payments), init-project (удаляется)
├── docs/              общие docs + docs/templates/<id>.md
├── .github/workflows/ ci.yml и deploy.yml (generic, приложения находит сами), init-matrix.yml (удаляется)
└── .gitlab-ci.yml     generic, та же схема поиска приложений
```

Правила, которые делают удаление тривиальным:

1. **Шаблон = приложение (или несколько) в `apps/`** плюс всё, что лежит внутри него: Dockerfile, compose, env, CLAUDE.md, e2e. Удалил папку — удалил всё сразу.
2. **Никаких списков в общих файлах.** Wildcard-exports (`"./*": "./src/*.ts"`) в `eslint-config` и `ui-*`. CI находит приложения сам: Node-скрипт `tools/ci/list-apps.mjs` читает `apps/*/deploy.json` и выдаёт матрицу. Корневые скрипты вида `turbo run build`. У каждого пакета свой `eslint.config.ts` (это заодно лечит проблему из docs/tooling.md §4: правила вложенного пакета не применялись из корня). tsconfig у каждого пакета свой, корневых `references` нет.
3. **Код шаблона не лежит в общих пакетах.** То, что нужно двум шаблонам, выносится в свой пакет (`telegram` для tma и game). Граф сам решит, оставлять ли его.
4. **Корень не держит зависимостей шаблонов.** Там только тулинг: turbo, prettier, eslint, typescript, knip, husky, vitest и playwright, если они общие.
5. **Генерируемые файлы** (их немного): `compose.yaml`, таблица шаблонов в README. Генератор живёт в init, а тест сверяет сгенерированное с закоммиченным, чтобы исходник не разошёлся с генератором.
6. **Markdown — единственное место с маркерами** (`<!-- init:tma -->…<!-- /init:tma -->`). Маркеры разрешены только в README.md, CLAUDE.md и docs/*.md. Тест проверяет, что маркеры сбалансированы, а id существуют в манифесте.

### F4. Формат манифеста (пример)

```ts
// boilerplate.manifest.ts — Node ≥ 22.18/24 читает напрямую (type stripping), без enum/namespace
import { defineManifest } from './tools/init/src/define.ts';

export default defineManifest({
  version: 1,
  name: 'frontend-boilerplate',
  core: {
    keepPackages: ['packages/ui', 'packages/tokens', 'packages/tsconfig', 'packages/eslint-config'],
    removeAfterInit: ['boilerplate.manifest.ts', 'tools/init', '.github/workflows/init-matrix.yml',
      '.claude/skills/init-project'],
  },
  modules: {
    landing: {
      kind: 'template', title: 'Лендинг / контентный сайт',
      apps: ['apps/landing'],
      paths: ['docs/templates/landing.md', '.claude/rules/landing-*.md', '.claude/skills/landing-*'],
      residue: ['apps/landing', '@repo/landing'],
    },
    tma: {
      kind: 'template', title: 'Telegram Mini App',
      apps: ['apps/tma'],
      paths: ['docs/templates/tma.md', '.claude/rules/tma-*.md', '.claude/skills/tma-*',
        'packages/eslint-config/src/presets/tma.ts', 'tools/eslint-rules/no-tg-outside-tma'],
      residue: ['apps/tma', '@telegram-apps/', 'telegram-web-app'],
    },
    game: {
      kind: 'template', title: 'Веб-игра',
      apps: ['apps/game'],
      paths: ['docs/templates/game.md', '.claude/skills/game-*'],
      residue: ['apps/game', 'phaser', 'pixi.js'],
    },
    shop:  { kind: 'template', title: 'Магазин', apps: ['apps/shop'],  paths: [/* … */], residue: [/* … */] },
    admin: { kind: 'template', title: 'Админка', apps: ['apps/admin'], paths: [/* … */], residue: [/* … */] },

    pwa: {
      kind: 'feature', title: 'PWA / offline', appliesTo: ['landing', 'shop', 'tma', 'admin'],
      paths: ['apps/*/src/app/pwa', 'docs/features/pwa.md'],
      dependencies: { drop: ['vite-plugin-pwa', 'workbox-window'] },
    },
    blog: { kind: 'feature', title: 'Блог / docs', appliesTo: ['landing'], paths: ['apps/landing/src/content/blog'] },
  },
  rules: {
    minTemplates: 1,
    conflicts: [],
    defaults: { features: ['i18n'] },
  },
});
```

Что манифест **не** содержит: список общих пакетов (его даёт граф), списки CI-джобов и Docker-таргетов (их находит CI сам), env-ключи (они в `apps/<id>/.env.example`). Чем меньше манифест, тем реже он расходится с кодом.

Фичи внутри приложения (`pwa` в tma) удаляются как пути, плюс из package.json приложения убираются перечисленные зависимости. Код приложения подключает фичу ровно в одном месте: файлом, который находится по glob (`src/app/features/*.ts` → `import.meta.glob`). Удалил файл — удалил подключение. Это совпадает с правилом пользователя «features are opt-in» (docs/architecture.md §10).

### F5. Как переписываются файлы

| Файл | Действие | Как |
| --- | --- | --- |
| `apps/<x>`, owned paths | перенос в `.init-backup/` | `fs.rename` (быстро, служит корзиной); `node_modules` перед этим удаляется через `fs.rm({recursive, force, maxRetries: 10, retryDelay: 200})`, потому что на Windows бывают EBUSY и EPERM ([Node docs mirror](https://titaniumsdk.com/api/structs/fs/rm/options.html), [пример](https://cubic.dev/pr/browserbase/stagehand/pull/2321)) |
| `packages/*` | граф: от оставшихся `apps/*` идём по `dependencies`, `devDependencies` и `peerDependencies` с `workspace:` (транзитивно); недостижимые пакеты удаляются, кроме `core.keepPackages` | своя функция, ~50 строк, без turbo |
| root `package.json` | `name`, `description`; удаление `scripts`, ссылающихся на удалённые пакеты (проверка по `--filter <name>`) | JSON parse/stringify + prettier |
| `apps/*/package.json` (фичи) | `dependencies.drop` | то же |
| `pnpm-workspace.yaml` | чистка `catalog` и `catalogs`, `allowBuilds` (pnpm 11; в pnpm 10 это `onlyBuiltDependencies`), `overrides`, `patchedDependencies` (вместе с файлами `patches/*.patch`), `minimumReleaseAgeExclude`: убираем всё, чего нет в новом lockfile | пакет `yaml` (Document API сохраняет комментарии). Две фазы: install → чистка → install |
| `tsconfig*` | ничего (у каждого пакета свой, корневых references нет) | — |
| ESLint | ничего (конфиг у каждого пакета; пресеты удаляются как owned paths) | — |
| CI (GitHub, GitLab) | ничего, кроме удаления `init-matrix.yml` и job'а `init` | приложения находятся по `apps/*/deploy.json` |
| Docker | ничего (Dockerfile у каждого приложения с `turbo prune <app> --docker`); `compose.yaml` перегенерируется | генератор |
| README.md, CLAUDE.md, docs/*.md | вырезаются блоки `<!-- init:<id> -->` невыбранных модулей; сами маркеры выбранных тоже убираются, чтобы итоговые docs были чистыми | regex по строкам + проверка баланса |
| `.claude/rules`, `.claude/skills`, `apps/*/CLAUDE.md` | удаляются как owned paths | — |
| `.env.example` | удаляется вместе с приложением | — |
| `.boilerplate.json` | создаётся: `{ "templates": [...], "features": [...], "boilerplateVersion": "<git sha/tag>", "initAt": "..." }` | для идемпотентности и будущих обновлений |

Все записи идут с LF, исходный EOL файла сохраняется (`.gitattributes`: `eol=lf`). В конце prettier прогоняется только по изменённым файлам.

### F6. Порядок шагов (точный)

1. **Preflight** (ничего не меняет): Node ≥ версии из `.nvmrc`; pnpm доступен (в Node 25 corepack больше не входит в поставку, так что pnpm ставится отдельно; проверить при выборе версий). Repo уже инициализирован (`.boilerplate.json` существует)? Тогда no-op с кодом 0, либо режим `--remove <id>` (см. 9). Не висит ли незавершённый журнал `.init-backup/journal.json`: предложить `--resume` или `--rollback`. Если это git-репо с грязным деревом — предупреждение, а без `--yes` ещё и вопрос. Не запущены ли dev-серверы: пробная попытка переименовать `apps/*` на месте ловит EPERM заранее.
2. **Ввод:** флаги → если TTY и чего-то не хватает, вопросы → валидация по манифесту (`minTemplates`, `appliesTo`, `conflicts`).
3. **План:** чистая функция `plan(manifest, selection, repoGraph) → Operation[]`. Типы операций: `move`, `rm-node_modules`, `edit-json`, `edit-yaml`, `strip-md`, `generate`, `write-state`. Плюс сводка: удаляются N приложений, M пакетов, K docs, зависимости X.
4. **Dry-run:** печать плана (человекочитаемо или `--json`) → выход 0. Файлы не трогаются.
5. **Подтверждение** (если нет `--yes`): `confirm` с итоговой сводкой.
6. **Применение с журналом:** каждая операция пишется в `.init-backup/journal.json` до выполнения (write-ahead). Удаление = перенос в бэкап. Перед правкой файла его оригинал копируется в бэкап.
7. **Install, фаза 1:** `pnpm install --no-frozen-lockfile`. Lockfile перегенерируется, лишние записи уходят.
8. **Чистка pnpm-workspace.yaml** по фактическому lockfile (каталог, allowBuilds, overrides, patches). Если что-то изменилось — **install, фаза 2**.
9. **Обновление зависимостей** (`--update`): `none` | `safe` (по умолчанию: `pnpm update -r` в пределах диапазонов, с учётом `minimumReleaseAge`) | `latest` (`pnpm update -r --latest`, явно помечен как рискованный). Обоснование: исходный репо и так держит зависимости свежими (Renovate), поэтому `safe` только обновляет lockfile.
10. **Prettier** по изменённым файлам.
11. **Проверки:** `turbo run typecheck lint test build` (по умолчанию `--verify full`; `quick` = без build) → `knip` (неиспользуемые файлы, экспорты и зависимости как индикатор остатков) → **поиск остатков**: по всем текстовым файлам, кроме `.init-backup`, `node_modules` и lockfile, ищутся `residue`-токены удалённых модулей и имена удалённых пакетов. Любое совпадение — ошибка с указанием файла и строки.
12. **Успех:** записать `.boilerplate.json`, удалить `core.removeAfterInit` (сам init, манифест, matrix-workflow, skill init-project) → удалить `.init-backup/` (если нет `--keep-backup`) → итог: что удалено, что проверено, следующие команды (`pnpm dev --filter tma`). **Коммит init не делает.** Это правило пользователя (CLAUDE.md §3): он только подсказывает команду.

### F7. Обработка ошибок и откат

| Где упало | Поведение |
| --- | --- |
| 1–5 | Ничего не изменено; код 2 (аргументы) или 3 (preflight) |
| 6 (применение) | Автооткат по журналу в обратном порядке: файлы возвращаются из бэкапа, созданные удаляются → код 1 |
| 7–11 (install, проверки) | Автооткат файлов, затем `pnpm install`, чтобы вернуть node_modules. Лог ошибок сохраняется в `init-error.log` вне бэкапа, а сообщение называет упавший шаг. `--no-rollback` оставляет результат для ручного разбора (флаг для агента-отладчика) |
| Процесс убит (Ctrl+C, сбой питания) | При следующем запуске журнал найден → предложение `--resume` (продолжить с первой невыполненной операции; все операции идемпотентны) или `--rollback` |
| Откат сам упал (файл заблокирован) | Код 4. Точная инструкция: какие пути из `.init-backup/` вернуть руками. Плюс `git restore`/`git clean` как запасной вариант, если это git-репо |

Почему бэкап, а не git: init должен работать и после `giget` (там нет `.git`), и без коммитов, которые пользователь запрещает делать без запроса. `rename` в пределах одного тома дешёвый, а бэкап весит мегабайты: `node_modules` в него не попадает.

Идемпотентность: каждая операция проверяет состояние перед выполнением («уже перенесено» = пропуск). Повторный запуск после успеха: `.boilerplate.json` есть → «уже инициализировано: tma, landing», код 0. Удалить ещё один шаблон позже (`--remove admin`) возможно, только пока init не удалён (`--keep-init`): вычитание остаётся корректным. Добавить шаблон позже вычитанием нельзя (открытый вопрос 3).

### F8. CLI: UX и реализация

**Зависимости init** (бандл esbuild или tsdown → `tools/init/dist/init.mjs` коммитится; CI проверяет, что бандл совпадает с исходником). Init запускается ДО install, иначе пришлось бы ставить Phaser, Telegram SDK и прочее, что сразу удалится:
- `@clack/prompts` (v1.x, в документации упоминается v1.8): `intro`, `multiselect`, `groupMultiselect`, `select`, `confirm`, `tasks`, `taskLog`, `spinner`, `note`, `isCancel`, плюс хелперы `isCI()` и `isTTY()` ([bomb.sh/docs/clack](https://bomb.sh/docs/clack/packages/prompts/)). Альтернатива — `@inquirer/prompts`; clack выбран из-за `tasks`, `taskLog` и единообразной отмены.
- `node:util parseArgs` для флагов (commander не нужен), `yaml` для YAML, `tinyglobby` или `fs.glob` (Node 22+) для glob.
- Запуск pnpm без shell и без проблем с `.cmd` на Windows. После фикса CVE-2024-27980 `spawn` на `.cmd` без `shell: true` падает с EINVAL. Решение: когда init запущен через `pnpm run init`, взять `process.env.npm_execpath` (путь к `pnpm.cjs`) и вызывать `spawn(process.execPath, [npm_execpath, ...args])`. Запасной вариант — `tinyexec` или `cross-spawn`. Пути передаются аргументами, а не строкой: кириллица и пробелы безопасны.
- Пути получаем только через `import.meta.dirname` или `fileURLToPath`, никогда через `new URL(...).pathname`: тот кодирует кириллицу в `%D0%A0…`. Ровно этот баг ломал алиасы Vitest в прошлом проекте (docs/tooling.md §11).

**Экран (TTY):**
```
┌  Frontend boilerplate — init
◆  Какие шаблоны оставить? (пробел — выбрать, минимум 1)
│  ◼ Лендинг   ◻ Магазин   ◼ Telegram Mini App   ◻ Админка   ◻ Веб-игра
◆  Фичи (только для выбранных шаблонов)
│  Лендинг: ◼ i18n ◻ PWA ◼ Блог     TMA: ◼ i18n ◻ PWA
◆  Имя проекта / npm scope:  acme / @acme
◆  Обновить зависимости?  ● в пределах диапазонов  ○ до latest  ○ не обновлять
◇  План ─────────────────────────────────
│  Удалить: apps/shop, apps/admin, apps/game; packages/commerce, ui-data, game-kit
│  Docs/Claude: 9 файлов, 4 skills; зависимости: −38 пакетов
│  Проверки: install, typecheck, lint, test, build, knip, поиск остатков
◆  Применить?  Да
◇  ✔ Перенос в бэкап  ✔ Правки конфигов  ✔ pnpm install (42s)  ✔ Проверки (3m10s)
└  Готово. Дальше: pnpm dev --filter tma · git add -A && git commit (сами)
```
Ctrl+C на любом вопросе → `cancel('Ничего не изменено')`, код 130. Во время применения Ctrl+C запускает откат.

**Флаги (для людей, CI и Claude):**

| Флаг | Значение |
| --- | --- |
| `--templates <ids>` | через запятую, `all` |
| `--features <ids>` | через запятую; `none` |
| `--name`, `--scope` | имя проекта и npm scope |
| `--update none\|safe\|latest` | по умолчанию `safe` |
| `--verify none\|quick\|full` | по умолчанию `full` |
| `--yes`, `-y` | без подтверждения |
| `--dry-run` | только план |
| `--json` | NDJSON-события в stdout (`{"step":"install","status":"ok","ms":42000}`) и итоговый объект; человеческий вывод уходит в stderr |
| `--plan-out <file>` / `--from-plan <file>` | сохранить план и применить ровно его (агент показывает план пользователю, потом применяет) |
| `--keep-backup`, `--keep-init`, `--no-rollback` | отладка |
| `--resume`, `--rollback`, `--remove <id>` | восстановление и дочистка |
| `--list` | вывести модули из манифеста в JSON (агенту не нужно читать манифест самому) |

Правило без TTY (`!isTTY(stdout)` или `isCI()`): любой недостающий обязательный параметр → код 2 и сообщение, каких флагов не хватает. Никаких зависаний на вопросах. Это прямая защита от бага, описанного у Vite+: в неинтерактивном режиме команда тихо ничего не сделала и вернула 0 ([issue](https://github.com/voidzero-dev/vite-plus/issues/2254)).

**Коды выхода:** 0 — успех или no-op; 1 — проверка или применение упали, откат выполнен; 2 — аргументы; 3 — preflight; 4 — откат не удался; 130 — отмена.

**Для Claude-агента:** skill `.claude/skills/init-project/SKILL.md` (удаляется вместе с init) описывает процедуру. (1) `pnpm run init -- --list --json`. (2) Спросить пользователя, какие шаблоны и фичи он хочет; самому не выбирать. (3) `--dry-run --json --plan-out .init-plan.json`, показать сводку. (4) После «да»: `--from-plan .init-plan.json --yes --json`. (5) Отчёт: какие шаги прошли, что не проверено, коммита нет.

### F9. Тесты и сопровождение шаблонов

**Статические тесты исходника** (на каждый PR, секунды):
1. `manifest-coverage`: каждый файл репозитория (`git ls-files`) принадлежит ровно одному владельцу: core, модулю, графу пакетов или генератору. Если кто-то добавил `apps/new` или `.claude/skills/x` без записи в манифест, тест падает. Это главный механизм, который не даёт манифесту устареть.
2. `isolation`: приложения не импортируют друг друга. Пакеты из `core.keepPackages` не зависят от пакетов, которые могут удалиться. Реализация — простой скан импортов на `node:fs`, этот приём уже описан в docs/architecture.md §2.
3. `markers`: маркеры в Markdown сбалансированы, а id существуют.
4. `generated-up-to-date`: `compose.yaml` и таблица README совпадают с выводом генератора; `dist/init.mjs` совпадает со сборкой из `src`.
5. Unit-тесты `plan()` на фикстурах (снапшоты планов) и тесты каждой операции во временной папке.

**E2E-матрица** (`.github/workflows/init-matrix.yml`, удаляется при init). Шаги: копия репо через `git archive` во временную папку → `node tools/init/dist/init.mjs --templates … --yes --update none --verify full --json`. Проверки внутри init уже покрывают install, typecheck, lint, test, build, knip и поиск остатков. Дополнительно:
- **PR (≈7 комбинаций, Linux):** 5 одиночных шаблонов + `tma,landing,admin` + `shop,landing`. Плюс `all` неявно: обычный CI полного репо.
- **PR (Windows):** `tma` и `landing,admin` в папке `C:\Работа\тест init` (кириллица и пробел). Ещё одна комбинация на macOS.
- **Nightly:** все 2^5−1 = 31 комбинация на Linux (кэш pnpm store; ≈2–5 мин на комбинацию, параллельно), все 5 одиночных на Windows. Отдельно `--update latest` как информационный job: ранний сигнал о ломающих мажорах.
- **Поведенческие тесты:** `--dry-run` → хеш дерева до и после совпадает. Отказ, внедрённый через `BOILERPLATE_INIT_FAIL_AT=<step>` на каждом шаге → после отката хеш дерева совпадает с исходным. Повторный запуск → код 0, без изменений. `--resume` после убийства процесса на середине.
- Если число шаблонов вырастет (6 → 63 комбинации), nightly переходит на pairwise-покрытие плюс все одиночные и полный набор.

**Процесс сопровождения:**
- Renovate или Dependabot обновляет исходный репо целиком. Матрица ловит комбинации, которые ломаются.
- Изменение общего пакета (`ui`, `tokens`) обычный CI проверяет на всех приложениях сразу: в исходнике они все присутствуют.
- Версия бойлерплейта = git-тег. `.boilerplate.json` хранит тег и выбор, это основа для будущего `upgrade`, если он понадобится (модель copier: diff между старой и новой версией шаблона с теми же ответами).

### F10. Риски

- **Скрытая связь шаблонов** (общий файл знает про tma). Против неё работают тесты `isolation` и `manifest-coverage`, поиск остатков после init и knip.
- **pnpm 11 переименовал настройки** (`allowBuilds`, `catalogPrune`). Init читает обе формы. Версии фиксирует агент 02/05.
- **Windows:** блокировка файлов dev-сервером и антивирусом (лечится retry и проверкой в preflight); длинные пути в `.init-backup/node_modules` (поэтому node_modules в бэкап не переносим); `.cmd`-шимы (через `npm_execpath`).
- **Закоммиченный бандл** может разойтись с исходником; против этого — проверка в CI (тест 4).

## Recommendations for the boilerplate

1. **(P0) Принять модель «вычитание по манифесту»** и инвариант «у каждого файла один владелец». Это закладывается в структуру репо с первого коммита шаблонов, потом это дорого.
2. **(P0) Писать конфиги без списков:** CI находит приложения сам, у каждого приложения свой Dockerfile, eslint.config и tsconfig, exports через wildcard, фичи подключаются через glob. Каждый список в общем файле — будущая строка в init-коде и потенциальная ошибка.
3. **(P0) Общие пакеты обрезаются по графу `workspace:*`**, а не по ручным спискам. То, что нужно двум шаблонам, становится отдельным пакетом.
4. **(P0) Init — закоммиченный Node-бандл**, который работает до install. Команда `pnpm run init`: не `pnpm init`, а `node tools/init/dist/init.mjs` через скрипт с другим именем, например `"setup"`, чтобы не путаться с встроенной `pnpm init`.
5. **(P0) Без TTY — только флаги, иначе код 2.** `--json` с NDJSON. `--dry-run` и `--plan-out`/`--from-plan` для агента.
6. **(P1) Бэкап с журналом вместо git-отката.** Автооткат при любой ошибке, `--resume` и `--rollback`. Init никогда не коммитит.
7. **(P1) Проверка после init = typecheck, lint, test, build, knip и поиск остатков.** Без зелёной проверки init не сообщает об успехе.
8. **(P1) Тесты `manifest-coverage`, `isolation`, `markers`** на каждый PR. E2E-матрица: 7 комбинаций на PR, 31 nightly, Windows с кириллическим путём.
9. **(P2) Маркеры только в Markdown.** В коде маркеров нет: шаблоны различаются файлами, а не ветками внутри файла.
10. **(P2) `.boilerplate.json` как файл ответов** — задел на `remove`/`add`/`upgrade`.

Чего избегать: copier и cookiecutter (Python), Hygen (неактивен), Yeoman (тяжёлый), маркеры `#if` в TS/TSX, генерация из частей, а также `turbo prune` как замена init (он копирует в `out/` и не трогает docs, CI и `.claude`; использовать только в Dockerfile).

## Open questions for the user

1. Удалять ли сам init-скрипт после успешного запуска (по умолчанию да, флаг `--keep-init` оставляет его)? Если оставить, позже можно удалить ещё один шаблон через `--remove`.
2. Обновление зависимостей при init по умолчанию: «в пределах диапазонов» (безопасно) или «до latest» (свежее, но может сломать сборку)?
3. Нужна ли возможность **добавить** шаблон в уже инициализированный проект (например, через месяц добавить админку)? Это отдельная команда `add`: она скачивает модуль из тега бойлерплейта через giget. В первую версию не входит.
4. Как раздавать бойлерплейт: `git clone` или «Use this template» на GitHub/GitLab, либо `pnpm dlx giget …` (без истории git)? От этого зависит, есть ли `.git` в момент init. Скрипт работает в обоих случаях.
5. Разрешено ли init'у в конце предложить готовую команду коммита (сам он не коммитит) или промолчать?
