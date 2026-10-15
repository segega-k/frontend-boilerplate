# 22a. Механизмы Claude Code на реальной установке (wave 0, агент A)

Status: done · Updated: 2026-10-15 · Режим: comfort (Opus 5.5 medium, без sub-agent)

## Resume notes

- Done: все пункты задачи и 08 §7 (кроме отмеченных «не проверено»). Спайк: `spikes/claude-mechanisms/`.
- Как воспроизвести: `bash spikes/claude-mechanisms/setup.sh "<dir с кириллицей и пробелом>"` копирует `project/` в
  новую папку, делает git-репо с bare-remote и фиктивным `.env`; затем `run-rules.sh <dir> Read|Edit|Bash` и
  `batch.sh <dir> <prompt-name>...` (промпты в `prompts/*.txt`, доп. настройки в `prompts/<name>.settings.json`).
  Модель для прогонов — haiku (`MODEL=sonnet` через `batch-debug.sh`). Доказательства — лог хуков
  `.work/hooklog.jsonl` (хук `InstructionsLoaded` + все хуки пишут туда) и JSON `claude -p --output-format json`.
- Тестовая папка: `%TEMP%\claude\…\scratchpad\Проект механизмы` (кириллица + пробел). Глобальные настройки
  `~/.claude` не менялись; `~/.claude.json` не читался и не правился.
- Next: ничего. Открытые вопросы — в конце.

## Summary (≤ 15 lines)

1. Path-rules с `paths:` (YAML-список, строка через запятую, brace-glob `*.{ts,tsx}` и `{api,model}/**`) грузятся
   лениво ровно при касании подходящего файла — через Read, Edit **и** `cat` в Bash; без касания не грузятся.
2. Вложенный `apps/<id>/CLAUDE.md` грузится лениво так же. **Новое:** вложенные `apps/<id>/.claude/rules/*.md` тоже
   работают, их `paths` считаются от `apps/<id>/`. `@import` внутри rule работает.
3. **Битый YAML-frontmatter: rule молча пропадает** (не грузится ни при старте, ни по пути) — не так, как в docs.
4. Хуки на Node в exec-форме (`command: node`, `args: ["${CLAUDE_PROJECT_DIR}/…"]`) работают в пути с кириллицей и
   пробелом, из Bash и PowerShell. SessionStart: 215 мс полностью, вывод попадает в контекст; срабатывает на
   startup/resume/compact. Guard: 55 мс. PostToolUse `additionalContext` доходит до модели. Stop блокирует один раз,
   `stop_hook_active` защищает от цикла.
5. `onFailure: "block"` работает: упавший или зависший guard блокирует инструмент; без ключа — fail-open.
6. Push только через `/push`: skill с `disable-model-invocation` пишет маркер детерминированно через `!`-препроцессинг
   (не проходит через PreToolUse), guard пропускает один push и удаляет маркер; модель вызвать `/push` не может.
7. Permissions: deny `Read(.env.*)` + `Read(!.env.example)` — отрицание работает, `.env` матчится на любой глубине,
   deny распространяется на `cat`/`Get-Content`, но **не** на `node -e readFileSync('.env')` (только ask) — guard
   закрывает. `ask` перекрывает `allow`. PowerShell-правила работают.
8. **Allow из project settings игнорируются, пока проект не trusted** (точное сообщение ниже); deny/ask,
   `defaultMode: acceptEdits`, хуки, outputStyle, attribution, `language` применяются и без trust.
9. `.mcp.json` с `pnpm exec playwright-mcp` (`.cmd`-шим) стартует на Windows без `cmd /c`; в `-p` проектный сервер
   используется без одобрения, `claude mcp list` до одобрения показывает «Pending approval».
10. Агент с `model: haiku`, `effort: low` во frontmatter реально идёт на haiku/low; агент читает `.work/mode`.
11. `enabledPlugins` из project settings не ставит плагин сам в headless-режиме; нужен интерактивный trust или
    команда установки. Ловушки окружения: MSYS Git Bash превращает `/push` в `C:/Program Files/Git/push`.

## Results table

| # | Механизм | Итог | Доказательство (раздел) |
| --- | --- | --- | --- |
| 1 | `.claude/rules` с `paths`, brace-glob, YAML-список и строка через запятую | работает | D1 |
| 1a | Загрузка при Read / Edit / `cat` в Bash | работает во всех трёх | D1 |
| 1b | Без касания подходящего файла rule не грузится | работает | D1 |
| 1c | Rule без frontmatter грузится при старте | работает | D1 |
| 1d | Битый YAML-frontmatter | **rule пропадает молча** (docs говорят «грузится безусловно») | D1 |
| 1e | `@import` внутри rule | работает (`load_reason: include`) | D1 |
| 2 | Вложенный `apps/<id>/CLAUDE.md`, ленивая загрузка | работает | D1 |
| 2a | Вложенные `apps/<id>/.claude/rules/*.md` | работает; `paths` от папки `apps/<id>/`; без `paths` — при первом касании поддерева | D2 |
| 3a | `permissions.deny` для Read, `.env` на любой глубине | работает | D3 |
| 3b | `Read(!.env.example)` в deny (отрицание) | работает (контроль без него: `.env.example` запрещён) | D3 |
| 3c | Read-deny распространяется на Bash `cat`, PowerShell `Get-Content` | работает | D3 |
| 3d | Read-deny для `node -e "readFileSync('.env')"` | **не покрывает** (только ask) → обход: guard | D3 |
| 3e | `ask` vs `allow` | ask побеждает allow из `--settings` | D4 |
| 3f | PowerShell-дубли правил (`PowerShell(Remove-Item *)`) | работает | D3 |
| 3g | `permissions.allow` из project settings | **работает только после trust** (иначе игнорируется с предупреждением) | D4 |
| 3h | `defaultMode: acceptEdits` из project settings | работает (контроль `defaultMode: default` → Edit отклонён) | D4 |
| 3i | `outputStyle` из project settings + своя `.claude/output-styles/*.md` | работает | D5 |
| 3j | `attribution: {commit: "", pr: ""}` | работает (контроль с непустым значением показывает трейлер) | D5 |
| 3k | `autoMemoryEnabled: true` | работает, память в `~/.claude/projects/<slug>/memory/` | D5 |
| 3l | `language: "russian"` | работает поверх output style | D5 |
| 3m | `enabledPlugins` у нового участника | **не ставится сам** в headless; обход: интерактивный trust или `claude plugin install` | D6 |
| 4a | Хуки Node в exec-форме, `${CLAUDE_PROJECT_DIR}` с кириллицей и пробелом | работает | D7 |
| 4b | SessionStart печатает маркер в контекст; startup/resume/compact | работает; 215 мс | D7 |
| 4c | PreToolUse guard `exit 2`: push без маркера (Bash и PowerShell) | работает | D8 |
| 4d | Guard: многострочный commit, `-m` дважды, `Co-Authored-By`, heredoc, here-string | работает после правки (первая версия пропустила `-am "a\nb"`) | D8 |
| 4e | PostToolUse `additionalContext` | работает | D7 |
| 4f | Stop-хук `decision: block` один раз, без цикла | работает | D7 |
| 4g | `onFailure: "block"` (crash и timeout) | работает; без ключа — fail-open | D9 |
| 4h | Хуки видят инструменты subagent-ов | работает (Read агента прошёл через guard) | D11 |
| 5a | `.mcp.json` stdio через `pnpm exec` (`.cmd`) в кириллическом пути | работает | D10 |
| 5b | Одобрение проектного MCP | интерактивное; в `-p` не требуется; `mcp list` до одобрения = «Pending approval» | D10 |
| 5c | Storybook MCP | **не проверено** (нужен живой Storybook; это отдельный пункт волны 0) | — |
| 6a | `disable-model-invocation: true` | работает: модель не видит skill | D11 |
| 6b | `/push` пишет маркер через `!`-препроцессинг, guard пропускает 1 push | работает | D8 |
| 6c | `/speed <mode>` пишет `.work/mode` с `$ARGUMENTS` | работает | D11 |
| 6d | Агент `.claude/agents/*.md` с `model`/`effort` | работает (haiku, effort low в транскрипте) | D11 |
| 6e | Агент читает `.work/mode` и меняет ответ | работает | D11 |
| 6f | Обычный skill вызывается моделью сам | работает | D11 |

## Details

Окружение: Windows 11 Pro 10.0.26200, Claude Code **2.1.300**, хуки исполняются **системным Node 22.20.0** (тот
`node`, что в PATH у Claude Code, а не Node 24 проекта); установка пакетов — Node 24.18.0 + `corepack pnpm@11.28.2`
(pnpm 12.11.2 уже `latest`, но бриф требует 11). `@playwright/mcp` **0.0.83** (2026-09-28), браузер — системный Edge.

Все прогоны: `claude -p --model haiku --output-format json --permission-prompts none "<prompt>"` в папке
`…\scratchpad\Проект механизмы` (не trusted, см. D4). Модель в конце перечисляет токены `*_MARK_*` из контекста,
хук `InstructionsLoaded` пишет загруженные файлы — две независимые проверки.

### D1. Path-rules и вложенный CLAUDE.md

Файлы: `code-style.md` (`paths:` списком `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`), `data.md`
(`paths: "apps/*/src/**/{api,model}/**, **/*.{query,store}.ts"` одной строкой), `styles.md` (`**/*.css`),
`always.md` (без frontmatter, с `@../../docs/imported.md`), `broken.md` (битый YAML, `paths: [ "docs/**/*.md`).

`run-rules.sh <dir> Read` (одна сессия на файл; «hook» — только ленивые загрузки сверх старта):

```
Read src/root.ts                  | hook: none                                   | model: ROOT,ALWAYS,IMPORT,SESSION,STYLE
Read apps/demo/src/a.ts           | hook: apps\demo\CLAUDE.md; code-style.md     | + NESTED_MARK_22, RULE_MARK_TS_41
Read apps/demo/src/x.css          | hook: apps\demo\CLAUDE.md; styles.md         | + NESTED_MARK_22, RULE_MARK_CSS_63
Read apps/demo/src/notes.md       | hook: apps\demo\CLAUDE.md                    | + NESTED_MARK_22
Read apps/demo/src/api/client.ts  | hook: apps\demo\CLAUDE.md; code-style; data  | + NESTED, TS_41, DATA_52
Read packages/ui/src/Button.tsx   | hook: code-style.md                          | + TS_41
Read packages/ui/src/user.store.ts| hook: code-style.md; data.md                 | + TS_41, DATA_52
Read docs/imported.md             | hook: none                                   | (BROKEN_85 нет нигде)
```

Варианты `Edit` и `Bash` (`cat <file>`) дали **идентичную** таблицу. При старте хук видит: `CLAUDE.md`
(`load_reason: session_start`), `.claude/rules/always.md` (session_start), `docs/imported.md`
(`load_reason: include`, `parent_file_path: …\always.md`). `broken.md` не грузится вообще: ни при старте, ни при
Read `docs/*.md`. Вывод: `ai:check` обязан парсить frontmatter каждого rule (иначе правило тихо исчезает).

### D2. Вложенные `apps/demo/.claude/rules/`

`rel.md` (`paths: ["src/**/*.ts"]`), `abs.md` (`paths: ["apps/demo/src/**/*.ts"]`), `always.md` (без frontmatter).
Без касания (`n0`): ни одного `NESTED_RULE`. После Read `apps/demo/src/a.ts` (`n1`):
`NESTED_MARK_22, NESTED_RULE_ALWAYS_35, NESTED_RULE_REL_33, RULE_MARK_TS_41` — `abs.md` не загрузился. Значит,
`paths` во вложенном `.claude/rules` считаются от папки, где лежит `.claude`, а rule без `paths` грузится вместе с
вложенным CLAUDE.md.

### D3. Permissions deny, отрицание, PowerShell

- `e1` Read `.env.example` → прочитано (`PUBLIC_EXAMPLE=1`). Контроль: убрал `"Read(!.env.example)"` → `File is in a
  directory that is denied by your permission settings.` Отрицание в deny работает.
- `e2` Read `.env` → тот же deny; PreToolUse-хук **не вызывался** (deny по Read срабатывает раньше хука).
- `e4` Read `apps/demo/.env.example` → OK; `apps/demo/.env.local`, `apps/demo/.env` → deny. Шаблон `Read(.env)` без
  `/` матчится на любой глубине.
- `e3` Bash `cat .env` → `Permission to use Bash with command cat .env has been denied.` (guard тогда `.env` в
  командах не смотрел — это сработал Read-deny). `e5` PowerShell `Get-Content apps/demo/.env.local` → отклонено.
- `e6` Bash `node -e "console.log(require('fs').readFileSync('apps/demo/.env.local','utf8'))"` → **«requires
  approval»**, а не deny: в интерактиве человек мог бы нажать «да». После добавления в guard проверки `.env` в
  командах: `guard: commands that touch .env files are blocked (only .env.example is allowed)`.
- `ps1` с `--settings {"permissions":{"deny":["PowerShell(Remove-Item *)"]}}` →
  `Permission to use PowerShell with command Remove-Item … has been denied.`

Порядок: для Bash/PowerShell сначала PreToolUse-хук, потом проверка правил (в логе guard `pass`, затем deny); для
Read по deny-пути хук не вызывается вовсе.

### D4. Trust, allow, ask, defaultMode

Каждый прогон в не-trusted папке печатает в stderr:

```
Ignoring 4 permissions.allow entries from .claude/settings.json: this workspace has not been trusted. Run Claude Code
interactively here once and accept the trust dialog, or set projects["C:/…/Проект механизмы"].hasTrustDialogAccepted:
true in C:\Users\Сергей\.claude.json.
```

То же для копии внутри worktree (`…/agent-…/spikes/claude-mechanisms/.run`): trust не наследуется от родительской
папки, ключ — точный путь проекта. Всё остальное из project settings без trust применяется: deny, ask, хуки,
outputStyle, attribution, `defaultMode`. `-p` пропускает диалог trust (документировано в `claude --help`), поэтому
хуки и `.mcp.json` в headless-режиме выполняются без вопроса.

- `defaultMode: acceptEdits`: Edit во всех прогонах проходил без вопроса при `--permission-prompts none`. Контроль
  `pm1` с `--settings {"permissions":{"defaultMode":"default"}}` → `Permission for this tool use was denied. It
  requires approval…`.
- `ask` побеждает `allow`: `g5` с `--settings` allow `Bash(git commit *)` и проектным ask `Bash(git commit *)` →
  commit отклонён как «requires approval»; guard при этом пропустил однострочное сообщение.

### D5. outputStyle, attribution, auto memory, language

- `outputStyle: "Probe"` + `.claude/output-styles/Probe.md` («заканчивай строкой `STYLE_MARK_3P`») — каждая ответная
  реплика заканчивается `STYLE_MARK_3P`.
- `a1` (проектный `attribution: {"commit": "", "pr": ""}`), вопрос «процитируй трейлеры, которые инструкции велят
  добавлять в коммиты и PR» → `NONE`. Контроль `a2` с `--settings` attribution `Co-Authored-By: Control Probe …` →
  модель цитирует ровно его. Пустой attribution убирает трейлер из системного промпта.
- `autoMemoryEnabled: true` → в системном промпте есть каталог памяти
  `C:\Users\Сергей\.claude\projects\C--Users--------AppData-…-scratchpad-----------------\memory\`. Каждая кириллическая
  буква в slug проекта заменена на `-` (`Работа` → `------`): разные проекты с кириллическими именами одной длины
  получат **один и тот же** каталог памяти и транскриптов. Отрицательный контроль (`false`) не делал: решение
  пользователя — память включена (21 §22).
- `language: "russian"` (через `--settings`), вопрос на английском → ответ на русском, output style соблюдён.

### D6. `enabledPlugins` у нового участника

Проект с `enabledPlugins: {"figma@claude-plugins-official": true}` + `extraKnownMarketplaces` и пустой
`CLAUDE_CONFIG_DIR` (имитация новой машины, без логина): `claude plugin list` → `No plugins installed.`;
`claude -p` → `Not logged in`, плагины не появились. `claude plugin install figma@claude-plugins-official` →
`Plugin "figma" not found in marketplace "claude-plugins-official"` (на чистой машине встроенный маркетплейс
называется `anthropic-plugin-directory`, проектный `extraKnownMarketplaces` CLI-командами не регистрируется);
`claude plugin marketplace add anthropics/claude-plugins-official` → ошибка клонирования; установка из
`anthropic-plugin-directory` → `fatal: cannot write keep file …: Filename too long` (длинный путь scratch-папки +
git без `core.longpaths`). Полный путь «trust → предложение установить плагины» интерактивный, headless его не
проверить без логина в чистом конфиге. Итог: **автоустановки в headless нет**; надёжно — шаг onboarding
(`claude plugin install …`) и проверка в `ai:doctor`. Глобальный конфиг пользователя не трогал.

### D7. Хуки: exec-форма, SessionStart, PostToolUse, Stop

- Exec-форма `{"type":"command","command":"node","args":["${CLAUDE_PROJECT_DIR}/.claude/hooks/x.mjs"]}` принята,
  `${CLAUDE_PROJECT_DIR}` раскрыт в путь с кириллицей и пробелом; переменная `CLAUDE_PROJECT_DIR` есть и в env хука.
- SessionStart (`--debug-file`):
  `Hooks: SessionStart:startup [node ${CLAUDE_PROJECT_DIR}/.claude/hooks/session-check.mjs] finished with status 0 (215ms)`;
  внутреннее время скрипта 3–12 мс. Вывод `[session-check v1] SESSION_MARK_7Q2 … mode=econom` модель цитирует.
  Источники в логе: `startup`, `resume` (`--resume`), `compact` (`/compact`); после compact корневой CLAUDE.md и
  rule без paths перезагружены (`InstructionsLoaded` снова). `clear` headless не проверить.
- PreToolUse guard: `finished with status 0 (55ms)`.
- PostToolUse `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"POST_MARK_5K …"}}` —
  `POST_MARK_5K` в списке токенов во всех Edit-прогонах.
- Stop: при флаге `.work/stop-block-once` → `{"decision":"block","reason":"STOP_MARK_9D …"}`. Лог:
  `Stop stop_hook_active:false` → модель отвечает `STOP_ACK` → `Stop stop_hook_active:true` → конец. Цикла нет. Без
  флага Stop ничего не делает, ответы на вопросы не задерживаются (173 мс). В `-p` итоговый `result` — последняя
  реплика после блока.

### D8. Guard: push-маркер и формат коммита

- `g1` Bash `git push .`, `g2` PowerShell `git push origin main` → `PreToolUse:Bash hook error: [node
  ${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.mjs]: guard: git push needs the user to run /push first (no fresh
  .work/push-ok marker)`; модель не пыталась обойти и подсказала `/push`.
- `/push` (через `MSYS_NO_PATHCONV=1`): skill выполнил `` !`node .claude/skills/push/mark.mjs` `` до модели, модель
  сделала `git push`, лог: `allow-push-marker-consumed`, ответ `Everything up-to-date`, маркер удалён. Push прошёл
  без запроса прав благодаря `allowed-tools: Bash(git push *)` в skill — даже в не-trusted проекте. Препроцессинг
  `!` **не** проходит через PreToolUse (в логе нет записи), поэтому guard может запрещать модели трогать маркер
  (`push-ok`, `mark.mjs`) без вреда для `/push`.
- `g6` «вызови skill push через Skill tool» → `I can't invoke "push": it isn't in the list of available skills`.
- `g4` `git commit -am "Add y" -m "Co-Authored-By: Bot …"` → `guard: no Co-Authored-By trailer in commit messages`.
- `g3` `git commit -am "first line\nsecond line"`: **первая версия guard пропустила** (искала только `-m`, а не
  `-am`). Исправлено: любой перевод строки или `` `n `` в команде `git commit` — блок; `-[a-z]*m` считается флагом
  сообщения. Повтор: `guard: commit message must be one line, no body`.
- `node --test .claude/hooks/guard.test.mjs` — 25/25 (push, маркер, `-am`, два `-m`, `-F`, heredoc, PowerShell
  here-string и `` `n ``, `.env` в Read/Bash/PowerShell/`node -e`, `.env.example` разрешён).

### D9. `onFailure: "block"`

- guard бросает исключение (`.work/guard-crash`) → `PreToolUse:Read hook error: […guard.mjs]: failed; blocking because
  onFailure is "block"` + стек; Read не выполнен.
- то же без `onFailure` (ключ удалён из JSON) → Read выполнен (`export const root = 1;`): fail-open.
- guard висит, `timeout: 3` → `timed out; blocking because onFailure is "block"`.
- Поведение на версиях < 2.1.295 не проверить (стоит 2.1.300).

### D10. `.mcp.json` + Playwright MCP

```json
{ "mcpServers": { "playwright": { "command": "pnpm",
  "args": ["exec", "playwright-mcp", "--browser", "msedge", "--isolated", "--headless"] } } }
```

`corepack pnpm@11.28.2 install` (2.2 с). `claude mcp list` →
`playwright: pnpm exec playwright-mcp --browser msedge --isolated --headless - ⏸ Pending approval (run claude to approve)`
(`enabledMcpjsonServers` в `.claude/settings.local.json` в не-trusted проекте статус не поменял). В `-p` сервер
стартовал без одобрения: `browser_navigate` на `data:text/html;charset=utf-8,<title>MCP_OK_Привет</title>` →
`Page title: MCP_OK_Привет`. `pnpm` — глобальный `.cmd`-шим (pnpm 10 из PATH); `cmd /c` не нужен. Без `charset`
в data-URL заголовок приходит кракозяброй — это Edge, не MCP. Разрешение инструмента: `mcp__playwright` в allow.

### D11. Skills и агенты

- `/speed econom` → skill `` !`node .claude/skills/speed/set-mode.mjs $ARGUMENTS` `` → `.work/mode = econom`, ответ
  `SPEED_SET mode=econom`. Следующий SessionStart печатает `mode=econom`.
- Агент `mode-reader` (`model: haiku`, `effort: low`, `tools: Read, Glob`), главный `--model sonnet`:
  `modelUsage: claude-sonnet-5-5, claude-haiku-5-5`, ответ `AGENT_MODE=econom AGENT_LIMIT=1`. В транскрипте
  сессии: главные запросы `"effort":"medium"`, запросы агента `"output_config":{"effort":"low"}`. Read агента прошёл
  через проектный guard.
- Agent tool сам принимает `model` и `effort` в вызове (описание инструмента: ставить их, когда «instructions such as
  CLAUDE.md or a skill explicitly ask»). То есть режим скорости можно применять двумя способами: строка режима из
  SessionStart → главный агент передаёт `model`/`effort` в каждый вызов; или frontmatter агента. Агент не может
  поменять свою модель после запуска, но может прочитать `.work/mode` и подстроить поведение (лимит вложенности).
- `probe-auto` (обычный skill): «дай probe word» → модель сама вызвала skill, `PROBE_AUTO_OK`.

### Ловушки окружения (не Claude Code, но влияют на тесты и скрипты)

- **Git Bash (MSYS) переписывает аргументы, начинающиеся с `/`**: `claude -p "/speed econom"` превратился в
  `C:/Program Files/Git/speed econom` (модель увидела путь, skill не вызвался). Для скриптов, которые передают
  slash-команды: `MSYS_NO_PATHCONV=1` или PowerShell. Тот же эффект ломает `--settings /c/...` при
  `MSYS_NO_PATHCONV=1` — путь передавать через `cygpath -m`.
- Длинные пути: клон маркетплейса в глубокий `CLAUDE_CONFIG_DIR` упал с `Filename too long`.

## What wave 1 should take as is

1. Хуки: `spikes/claude-mechanisms/project/.claude/hooks/{lib,session-check,guard,post,stop}.mjs` как каркас
   (guard — только как дополнение к guard из 10a §3.5: блоки push-маркера, формата commit и `.env` в командах +
   `guard.test.mjs`). Тестовые ветки `guard-crash`/`guard-hang` убрать. Скрипты должны работать на **Node 22**
   (хуки запускает системный node).
2. Skills `/push` и `/speed` в форме спайка: `disable-model-invocation: true`, маркер/режим пишет `!`-препроцессинг,
   `allowed-tools` с точной командой.
3. Rule-frontmatter: YAML-список строк в кавычках, brace-glob разрешён:

```yaml
---
paths:
  - "apps/**/*.{ts,tsx}"
  - "packages/**/*.{ts,tsx}"
---
```

4. `.claude/settings.json` (проверенные ключи; полный список allow/ask/deny — из 08 §3.2 с правками ниже):

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "outputStyle": "Human",
  "language": "russian",
  "attribution": { "commit": "", "pr": "" },
  "autoMemoryEnabled": true,
  "enableAllProjectMcpServers": false,
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": ["…как в 08 §3.2…", "mcp__playwright"],
    "ask": ["…как в 08 §3.2, включая Bash(git commit *) и PowerShell(git commit *)…"],
    "deny": ["Read(.env)", "Read(.env.*)", "Read(!.env.example)", "…остальное из 08 §3.2…"]
  },
  "hooks": {
    "SessionStart": [{ "matcher": "startup|resume|clear|compact", "hooks": [
      { "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/session-check.mjs"], "timeout": 20 }] }],
    "PreToolUse": [{ "matcher": "Bash|PowerShell|Read|Edit|Write|NotebookEdit|Grep|Glob", "hooks": [
      { "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.mjs"], "timeout": 15, "onFailure": "block" }] }],
    "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [
      { "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/format-file.mjs"], "timeout": 60 }] }],
    "Stop": [{ "hooks": [
      { "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/stop-check.mjs"], "timeout": 60 }] }]
  }
}
```

   `git push` убрать из ask/allow совсем: его решают guard (маркер) и `allowed-tools` skill-а `/push`.
5. `.mcp.json` с Playwright ровно как в D10 (`--headless` по желанию), `@playwright/mcp` 0.0.83 в devDependencies.
6. Агенты: `model`/`effort` во frontmatter работают; для режимов скорости — `model: inherit` во frontmatter, а
   главный агент передаёт `model`/`effort` в вызов Agent по строке режима из SessionStart (CLAUDE.md так и велит).

## Plan changes proposed

1. **`ai:check` должен падать на битом frontmatter rule** (сейчас 08 §2.2 описывает обратный риск: «грузится
   безусловно»; на деле rule исчезает молча).
2. **Шаблонные rules можно класть в `apps/<id>/.claude/rules/`** (08 §2.1 п.4 «не используем до проверки» —
   проверено): `paths` от папки приложения, удаляются вместе с папкой. Решение оставить или нет — за оркестратором;
   механизм рабочий.
3. **Onboarding/`ai:doctor`: trust обязателен.** Без принятого диалога trust allow-правила проекта игнорируются, и
   каждый `pnpm verify` будет спрашивать. Trust ключуется точным путём → новый worktree = новый путь; проверить, как
   это ведёт себя у worktree, созданных самим Claude Code (см. Open issues). Хук эту ситуацию не видит (allow-правила
   хуку не передаются), поэтому `ai:doctor` и README печатают инструкцию «запусти `claude` интерактивно и прими
   trust».
4. **Figma-плагин ставится шагом onboarding** (`claude plugin install …` + проверка в `ai:doctor`), а не надеждой на
   `enabledPlugins`.
5. **Guard дополнить**: `.env*` (кроме `.env.example`) в тексте команд Bash/PowerShell; запрет модели трогать
   `push-ok`/`mark.mjs`; commit — любой перевод строки и `` `n `` в команде; флаги `-am`.
6. **В `08` убрать `Bash(git push *)` из ask**: push решается guard-маркером; ask только создаёт лишний диалог.
7. В README/rules для скриптов на Git Bash: `MSYS_NO_PATHCONV=1` при передаче `/команд` в `claude -p`.

## Open issues

- Trust для git worktree, созданных `claude --worktree` / агентами: наследуется ли trust основного репо (здесь
  проверено только: вложенная папка-репо внутри trusted-дерева — не trusted). Проверка требует интерактивного trust
  или правки `~/.claude.json` — не делал.
- Интерактивное одобрение `.mcp.json` и предложение установить `enabledPlugins` после trust — не проверены (нужен
  TTY); `enabledMcpjsonServers` в `settings.local.json` до trust не подействовал.
- Storybook MCP (`addon-mcp`, HTTP) — не проверен здесь; ожидаемая форма `{"type":"http","url":"http://localhost:6006/mcp"}`.
- `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` из project `env` — не проверен (тест требует подмены переменных авторизации).
- Коллизия slug-каталогов `~/.claude/projects/` для кириллических путей одинаковой длины: память и транскрипты двух
  разных проектов могут смешаться. Не воспроизводил на двух проектах; при включённой auto memory — предупредить в
  README.
- `onFailure` на Claude Code < 2.1.295 не проверить на этой машине.
