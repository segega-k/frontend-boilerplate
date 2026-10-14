# 04a. Claude Code: актуальные механизмы (октябрь 2026)
Status: done
Updated: 2026-10-14

## Resume notes
- Источник истины: официальные docs `code.claude.com/docs/en/*` (скачаны 2026-10-14 как `.md`: `https://code.claude.com/docs/en/<page>.md`). Локально установлен Claude Code **2.1.299**; docs ссылаются на версии до v2.1.296, то есть совпадают с текущей версией.
- Codex-часть взята с `learn.chatgpt.com` (туда редиректит `developers.openai.com/codex/*`).
- Не проверено руками: поведение `.claude.json` в корне репо. Вывод сделан по документации: такого файла нет ни в одном списке конфигов. Эксперимент не ставился, потому что задача read-only.
- Пометка **[!]** означает, что вывод не процитирован из docs напрямую или может устареть.

## Summary (≤15 lines)
1. Общие правила, которые нужны всегда, кладём в `./CLAUDE.md` (до 200 строк) и в `.claude/rules/*.md` без `paths`. Правила для части кода кладём в `.claude/rules/*.md` с `paths:`. Процедуры оформляем как skills (`.claude/skills/<name>/SKILL.md`). Детерминированные проверки делаем hooks в `.claude/settings.json`. Всё это коммитится.
2. CLAUDE.md и rules задают контекст и ничего не гарантируют. Жёсткие запреты делаются через `permissions.deny` или PreToolUse hook с `exit 2`.
3. `.claude/commands/` слиты со skills. Skill с тем же именем побеждает команду. У skill есть frontmatter `paths`, `context: fork`, `hooks`, `model`, `effort`, `allowed-tools`, `disable-model-invocation`.
4. AGENTS.md Claude Code читает нативно начиная с v2.1.277, но **только если нет CLAUDE.md**. Для общего источника с Codex: один `AGENTS.md`, а в `CLAUDE.md` первой строкой `@AGENTS.md`. Symlink на Windows не подходит.
5. Codex читает `AGENTS.md` (лимит 32 KiB) и skills из `.agents/skills/`. Claude Code `.agents/` **не читает**, его skills лежат в `.claude/skills/`. Формат SKILL.md общий (agentskills.io).
6. MCP для команды задаётся в `.mcp.json` в корне репо (коммитится, требует approval). Личные серверы хранятся в `~/.claude.json`. **`.claude.json` в корне репо Claude Code не читает**, поэтому схема xRocket (gitignored `.mcp.json` + закоммиченный `./.claude.json`) у других участников не работает. **[!]** вывод по docs, вручную не проверялось.
7. Auto memory (`~/.claude/projects/<proj>/memory/MEMORY.md`) живёт только на одной машине и не синхронизируется. Полезное оттуда нужно вручную переносить в CLAUDE.md или rules.
8. Plugins не умеют поставлять CLAUDE.md и rules: `CLAUDE.md` в корне плагина не грузится. Они поставляют skills, agents, hooks, MCP, output styles. Раздавать через project `extraKnownMarketplaces` + `enabledPlugins` удобно для обновляемых skills и hooks, но marketplace регистрируется только после workspace trust, а `autoUpdate` у сторонних marketplaces по умолчанию выключен.
9. Рекомендация для boilerplate: гибрид. Всё, что относится к конкретному проекту (CLAUDE.md, rules, settings, `.mcp.json`), коммитится в каждый проект. Общие обновляемые skills, agents и hooks выносятся в marketplace-плагин команды (relative-path плагины в git-marketplace, `autoUpdate: true`).
10. В CI используются `anthropics/claude-code-action@v1` (`prompt`, `claude_args`) или `claude -p --output-format json`. `--bare` **пропускает CLAUDE.md, skills и hooks**, поэтому для ревью по правилам проекта он не подходит. GitLab CI пока в beta.
11. Ревью: `/code-review` (`/review` его alias с v2.1.223), `/security-review`, managed Code Review (Team/Enterprise) с `REVIEW.md`.
12. Output styles не удалены (`.claude/output-styles/*.md`, ключ `outputStyle`). Их депрекейт в 2.0.30 (октябрь 2025) был отменён.

## Findings

### 1. CLAUDE.md
**Что это.** Markdown-инструкции, которые грузятся в начале каждой сессии. Доставляются как user message после system prompt, а не как часть system prompt. https://code.claude.com/docs/en/memory

**Расположения в порядке загрузки, от широкого к узкому** (https://code.claude.com/docs/en/memory#choose-where-to-put-claude-md-files):
| Scope | Путь | Коммит |
|---|---|---|
| Managed | Windows `C:\Program Files\ClaudeCode\CLAUDE.md`, macOS `/Library/Application Support/ClaudeCode/CLAUDE.md`, Linux/WSL `/etc/claude-code/CLAUDE.md`. Альтернатива: ключ `claudeMd` в managed-settings | нет (MDM) |
| User | `~/.claude/CLAUDE.md` (+ `~/.claude/rules/`) | нет |
| Project | `./CLAUDE.md` **или** `./.claude/CLAUDE.md` | да |
| Local | `./CLAUDE.local.md`. Поддерживается (не deprecated), его нужно добавить в `.gitignore` вручную | нет |

- **Загрузка.** Файлы из cwd и всех родительских директорий грузятся при старте и **конкатенируются**, без override: сначала корень ФС, потом cwd. В каждой директории `CLAUDE.local.md` идёт после `CLAUDE.md`. CLAUDE.md в **поддиректориях** грузится лениво, когда Claude читает или редактирует файл в этой поддиректории (`cat`/`head` тоже считаются). https://code.claude.com/docs/en/memory#how-claude-md-files-load
- **Imports.** `@path/to/file`. Относительный путь считается от файла, в котором стоит импорт. Абсолютные пути и `@~/...` разрешены. Максимальная глубина 4 hops. Внутри code span и fenced block импорт не срабатывает. Пробел в пути экранируется `\ `, путь в кавычках не импортируется. Импорт **за пределами** рабочей директории при первой встрече показывает approval-диалог; если от него отказаться, он больше не появится. Импорты **не экономят контекст**: всё грузится при старте. https://code.claude.com/docs/en/memory#import-additional-files
- **Размер.** Целиться в **<200 строк на файл**. Файл больше 4 MiB пропускается целиком. Есть warning при превышении рекомендуемой длины и суммарного лимита (каждый CLAUDE.md, rule и import считается отдельным файлом). Блочные HTML-комментарии `<!-- -->` вырезаются до инъекции, поэтому годятся для заметок людям. https://code.claude.com/docs/en/memory#write-effective-instructions, https://code.claude.com/docs/en/memory#my-claude-md-is-too-large
- **Compaction.** Корневой CLAUDE.md перечитывается с диска после `/compact`. Вложенные CLAUDE.md и path-rules подгружаются заново по требованию. https://code.claude.com/docs/en/memory#instructions-seem-lost-after-compact
- **Диагностика.** `/context` (Memory files), `/memory`, hook `InstructionsLoaded`, `/doctor prompt-audit` (нужен v2.1.283+).
- **Исключения.** `claudeMdExcludes` (glob по абсолютным путям, массивы мёржатся между слоями). Managed CLAUDE.md исключить нельзя.
- **Ловушка.** Если в CLAUDE.md заданы правила для коммитов и PR, встроенные инструкции надо выключить через `includeGitInstructions: false` и `attribution`. https://code.claude.com/docs/en/memory#claude-isnt-following-my-claude-md
- **AGENTS.md** разобран в п.12.

Минимальный пример:
```markdown
@AGENTS.md

## Claude Code
- Run `pnpm lint && pnpm typecheck` before reporting a task done.
<!-- maintainer note: not sent to the model -->
```

### 2. `.claude/rules/*.md` (path-scoped rules)
- **Что это.** Модульные инструкции. Все `.md` находятся рекурсивно, подпапки разрешены. Без `paths` грузятся при старте с тем же приоритетом, что `.claude/CLAUDE.md`. С `paths` грузятся только когда Claude делает Read/Write/Edit (или `cat`/`head`) над подходящим файлом. https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/
- **Frontmatter.** Единственное поле `paths`: YAML-список или строка через запятую, glob вида `src/**/*.{ts,tsx}`. Остальные поля молча игнорируются. Если YAML битый, rule грузится **безусловно**, это видно в `claude --debug`. Brace expansion ограничен 1000 паттернами / 4 MiB на rule. https://code.claude.com/docs/en/memory#rules-frontmatter-reference
- **User rules.** `~/.claude/rules/` грузятся раньше project rules. Конфликтующие правила **не перекрывают** друг друга, Claude может выбрать любое из них.
- **Symlinks** поддерживаются. Symlink за пределы рабочей директории считается external import и требует approval, причём после approval грузятся только rules без `paths`. Symlink на сетевой путь (UNC) не грузится. Для Windows это неудобно (см. п.12).
- **Rules или вложенный CLAUDE.md.** Вложенный CLAUDE.md привязан к директории и грузится при работе в ней. Rule с `paths` привязан к glob, который может пересекать директории (например, `**/*.test.ts`), и при этом всё хранится централизованно в `.claude/rules/`. Docs советуют rules для «instructions that matter for only part of the codebase». Для процедур docs советуют skills, потому что rules «load into context every session or when matching files are opened». https://code.claude.com/docs/en/memory
- Коммитится.

```markdown
---
paths:
  - "src/**/*.{ts,tsx}"
---
# Component rules
- Props interface is named `<Component>Props`.
```

### 3. Skills
- **Расположение** (https://code.claude.com/docs/en/skills): enterprise (managed dir), `~/.claude/skills/<name>/SKILL.md`, `.claude/skills/<name>/SKILL.md`, `<plugin>/skills/<name>/SKILL.md`. Приоритет: **enterprise > personal > project**. Plugin skills получают namespace `/plugin:skill` и не конфликтуют. Project skills ищутся в `.claude/skills/` в cwd и в родителях до корня репо. Skills в `.claude/skills/` поддиректории грузятся, когда Claude впервые трогает файл в этой поддиректории; вызываются как `/apps/web:deploy`. Папку skill можно сделать symlink. Правки подхватываются без рестарта.
- **`.claude/commands/`** слиты со skills: оба механизма дают `/name`. При совпадении имени **побеждает skill**. Команды поддерживают тот же frontmatter, кроме `name` и `paths`. Подпапки дают имя `/frontend:component`. Старые команды продолжают работать.
- **Frontmatter** (полный список, https://code.claude.com/docs/en/skills#frontmatter-reference):
  - `name`: по умолчанию имя папки.
  - `description`: рекомендуется. Вместе с `when_to_use` **обрезается до 1536 символов** в листинге (настраивается через `skillListingMaxDescChars`).
  - `when_to_use`, `argument-hint`, `arguments`: именованные `$name`.
  - `disable-model-invocation`: только ручной вызов, skill также не преднагружается в subagents.
  - `user-invocable: false`: только модель, в `/`-меню skill не виден.
  - `allowed-tools`: даёт разрешение только **на ход вызова** и ничего не ограничивает.
  - `disallowed-tools`.
  - `model`, `effort`: действуют до конца хода.
  - `context: fork` + `agent`: запуск в subagent. `background` (по умолчанию `true`, нужен v2.1.218+).
  - `hooks`: регистрируются при вызове и живут до конца сессии; доступен `once: true`.
  - `paths`: авто-активация только для подходящих файлов.
  - `shell: bash|powershell`.
  - `metadata`, `license`, `compatibility` (≤500 символов).
- **Подстановки:** `$ARGUMENTS`, `$N`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_SESSION_ID}`. Строка `` !`cmd` `` выполняется до показа skill модели (динамический контекст).
- **Progressive disclosure.** В контексте постоянно лежит только листинг name+description. Тело skill грузится при вызове, supporting files Claude читает по ссылкам из SKILL.md. Держать SKILL.md **<500 строк**. https://code.claude.com/docs/en/skills
- **Бюджет листинга.** **1% контекстного окна.** При переполнении описания выбрасываются начиная с самых редко вызываемых skills, но имена остаются всегда. Настройки: `skillListingBudgetFraction` (например, `0.02`), env `SLASH_COMMAND_TOOL_CHAR_BUDGET`, `skillOverrides: {"x": "name-only"|"user-invocable-only"|"off"}` (на plugin skills не действует). Стоимость показывают `/doctor` и `/skill-doctor` (v2.1.252+). https://code.claude.com/docs/en/skills#skill-descriptions-are-cut-short
- **Жизненный цикл.** Вызванный skill остаётся в контексте одним сообщением, файл не перечитывается. После auto-compaction сохраняются **первые 5000 токенов** каждого skill, общий бюджет 25 000 токенов, приоритет у последних вызванных. Поэтому важное надо держать в начале SKILL.md.
- **Windows.** При `shell: bash` без Git Bash skill падает. `shell: powershell` работает, если включён PowerShell tool.
- **Переносимость.** Для claude.ai, API и `package_skill.py` разрешены только `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`, остальные поля дают hard error. В Claude Code допустимо всё.
- Коммитится (`.claude/skills/`).

```markdown
---
name: new-component
description: Scaffolds a React component with story and test following repo conventions. Use when the user asks to create a new UI component.
argument-hint: "[ComponentName]"
disable-model-invocation: true
allowed-tools: Read Write Edit Bash(pnpm lint *)
---
Create `$ARGUMENTS` under src/components/... See [conventions.md](conventions.md).
```

### 4. Subagents `.claude/agents/*.md`
- **Приоритет** (https://code.claude.com/docs/en/sub-agents): managed (1) > `--agents` CLI (2) > `.claude/agents/` (3) > `~/.claude/agents/` (4) > plugin `agents/` (5). Сканирование рекурсивное.
- **Frontmatter:**
  - `name`: обязателен, ≤256 символов, без `:`.
  - `description`: обязателен.
  - `tools`, `disallowedTools`.
  - `model`: `sonnet|opus|haiku|fable|<id>|inherit`.
  - `permissionMode`, `maxTurns`.
  - `skills`: преднагрузка полного текста.
  - `mcpServers`, `hooks`.
  - `memory`: `user|project|local`. Пути: `~/.claude/agent-memory/<n>/`, `.claude/agent-memory/<n>/` (можно коммитить), `.claude/agent-memory-local/<n>/`.
  - `background`, `omitClaudeMd` (v2.1.271+), `effort`, `isolation: worktree`, `color`, `initialPrompt`, `experimental.cacheTtl`.
  - Для plugin agents `permissionMode`, `mcpServers`, `hooks`, `initialPrompt` игнорируются.
- **Что видит subagent.** Свой system prompt, задачу, **все уровни CLAUDE.md и rules**, git status и преднагруженные skills. Встроенные Explore и Plan **пропускают CLAUDE.md**. Output style и auto memory основной сессии в subagent не передаются. Вложенность до 3 уровней (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`). Fork наследует весь разговор (`/subtask`).
- **Вывод для boilerplate.** Правила, которые должны соблюдаться в Explore/Plan, придётся дублировать в промпт делегирования или в custom agent.

```markdown
---
name: reviewer
description: Reviews a diff against docs/code-style.md. Use after implementing a change.
tools: Read, Grep, Glob, Bash
model: inherit
skills: [code-style-check]
---
You are a strict reviewer...
```

### 5. Hooks
- **Где задаются** (https://code.claude.com/docs/en/hooks): `~/.claude/settings.json`, `.claude/settings.json` (коммитится), `.claude/settings.local.json`, managed, plugin `hooks/hooks.json`, frontmatter skill и agent.
- **События** (на 10.2026): SessionStart (matcher `startup|resume|clear|compact|fork`), Setup, UserPromptSubmit, UserPromptExpansion, PreToolUse, PermissionRequest, PermissionDenied, PostToolUse, PostToolUseFailure, PostToolBatch, Notification, MessageDisplay, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, Stop, StopFailure, TeammateIdle, InstructionsLoaded, ConfigChange, CwdChanged, DirectoryAdded, FileChanged, WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, PreModelSwitch, PostModelSwitch, Elicitation, ElicitationResult, SessionEnd. Блокировать могут, в частности, PreToolUse, UserPromptSubmit, Stop, SubagentStop, PreCompact, PostToolBatch, TaskCompleted.
- **Структура.** `hooks.<Event>[] = {matcher, hooks:[{type, ...}]}`.
- **Matcher.** `*`/пусто означает всё. Буквы, цифры и `|` дают точный список (`Edit|Write`). Любой другой символ превращает matcher в JS regex. MCP-инструменты матчатся как `mcp__server__.*`.
- **Типы handler-ов:** `command` (`command`, `args` для exec-формы, `async`, `shell: bash|powershell`, `onFailure: continue|block` (v2.1.295+)), `http`, `mcp_tool`, `prompt` (LLM-оценка, по умолчанию 30 с), `agent` (experimental, 60 с). Общие поля: `if` (синтаксис permission rule, например `"Bash(git *)"`, работает только на tool-событиях), `timeout` (по умолчанию 600 с у command), `statusMessage`, `once`.
- **Exit codes.** `0` означает успех, при этом JSON из stdout парсится. `2` блокирует, причина берётся из stderr. Любой другой код даёт **неблокирующую** ошибку, действие продолжается. Для enforcement нужен `exit 2`.
- **JSON-вывод:** `continue`, `stopReason`, `systemMessage`, `decision: "block"` (UserPromptSubmit, PostToolUse, Stop), `hookSpecificOutput.permissionDecision: allow|deny|ask|defer`, `permissionDecisionReason`, `updatedInput`, `additionalContext`, `updatedToolOutput`.
- **Важно.** PreToolUse `allow` **не обходит** deny и ask правила. https://code.claude.com/docs/en/permissions
- **Env.** `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_ENV_FILE` (в SessionStart в него можно дописать `export ...` для Bash). https://code.claude.com/docs/en/hooks
- **Windows:**
  - `shell` по умолчанию `bash`, а без Git Bash `powershell`.
  - В exec-форме `.cmd` и `.bat` shim-ы (npx, eslint) **не исполняемые**, их надо вызывать как `"command":"node","args":[...]` или в shell-форме.
  - Плейсхолдеры брать в двойные кавычки.
  - Профиль Git Bash может печатать мусор в stdout и ломать JSON.
  - PostToolUse на `Edit|Write` не видит изменений, сделанных через Bash или PowerShell, поэтому для гарантий нужен Stop-hook со сканом дерева. https://code.claude.com/docs/en/hooks-guide
- **Безопасность и trust.** Hooks из settings репозитория выполняются, даже если доверен только родительский каталог, и в `claude -p` тоже. Hooks из frontmatter project agents выполняются только после trust. `disableAllHooks` нельзя выключить отдельным hook-ом. Managed `allowManagedHooksOnly` разрешает только managed hooks. https://code.claude.com/docs/en/permissions#what-runs-before-you-trust-a-folder

```json
{
  "hooks": {
    "PostToolUse": [{ "matcher": "Edit|Write",
      "hooks": [{ "type": "command", "command": "node",
        "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/format.mjs"], "timeout": 60 }] }],
    "PreToolUse": [{ "matcher": "Bash",
      "hooks": [{ "type": "command", "if": "Bash(git push *)",
        "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/block.mjs"] }] }]
  }
}
```

### 6. Settings
- **Приоритет**, от высшего к низшему (https://code.claude.com/docs/en/settings#settings-precedence): **managed** (managed-settings.json, MDM, claude.ai console) > **`--settings`** (CLI, одна сессия) > **`.claude/settings.local.json`** > **`.claude/settings.json`** > **`~/.claude/settings.json`**. Env-переменные в эту лестницу не входят и решаются попарно. Флаги вроде `--model` тоже идут отдельно.
- **Массивы мёржатся** (например, `permissions.allow`), исключения: `fallbackModel`, `modelPicker`, `availableModels`, `modelSettings`. Порядок оценки правил: **deny → ask → allow**, побеждает первое совпадение. Specificity не учитывается. https://code.claude.com/docs/en/permissions
- Файлы — строгий JSON без комментариев и trailing comma. `$schema: "https://json.schemastore.org/claude-code-settings.json"`, схема может отставать от релизов. Hot reload работает для большинства ключей, кроме `model` и `effortLevel`.
- `.claude/settings.local.json` попадает в gitignore автоматически, когда Claude Code сам пишет в него (https://code.claude.com/docs/en/claude-directory). **[!]** Надёжнее добавить его в `.gitignore` явно.
- **Ключи, которые в shared-файле не работают или ждут trust.** Ключи со scope `User`/`Managed`/`Global config` из `.claude/settings.json` игнорируются. `permissions.allow`, `additionalDirectories`, `extraKnownMarketplaces` и большинство `env` применяются только после workspace trust. `deny` и `ask` действуют сразу. `defaultMode: auto|bypassPermissions` из project-файла не применяется. https://code.claude.com/docs/en/settings#a-committed-key-doesnt-reach-teammates
- **Ключевые поля** (https://code.claude.com/docs/en/settings-reference):
  - `permissions{allow,ask,deny,defaultMode,additionalDirectories}`, `env`, `hooks`.
  - `outputStyle`: регистрозависим, `"Explanatory"`.
  - `enabledPlugins{"p@m":bool}`, `extraKnownMarketplaces`.
  - `enableAllProjectMcpServers`, `enabledMcpjsonServers`, `disabledMcpjsonServers`: из shared-файла в недоверенной папке игнорируются.
  - `statusLine{type:"command",command,padding,refreshInterval}`, `model`.
  - **`includeCoAuthoredBy` deprecated**, вместо него `attribution{commit,pr,sessionUrl}` или `attribution: false` (v2.1.281+). Claude Code сам говорит модели, что правила атрибуции из CLAUDE.md приоритетнее, если ключ не задан в managed.
  - `includeGitInstructions` (по умолчанию `true`).
  - `autoMemoryEnabled`, `autoMemoryDirectory`.
  - `cleanupPeriodDays` (по умолчанию **30**, минимум 1).
  - `language`, `respectGitignore`, `claudeMdExcludes`, `skillOverrides`, `skillListingBudgetFraction`.
  - `pluginConfigs`: только user и managed.
  - `strictKnownMarketplaces`: только managed.
- `~/.claude.json` — global config (OAuth, trust по проектам, личные MCP local/user scope, IDE-тумблеры). В репо его не коммитят.

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": { "allow": ["Bash(pnpm lint *)"], "deny": ["Read(./.env)", "Read(./.env.*)"] },
  "attribution": { "commit": "", "pr": "", "sessionUrl": false },
  "includeGitInstructions": true,
  "outputStyle": "Human"
}
```

### 7. MCP
- **Scopes** (https://code.claude.com/docs/en/mcp#mcp-installation-scopes):
  | Scope | Хранится в | Shared |
  |---|---|---|
  | local (по умолчанию) | `~/.claude.json`, под путём проекта | нет |
  | project | **`.mcp.json` в корне проекта** | да, коммитится |
  | user | `~/.claude.json`, top-level | нет |
  Приоритет при совпадении имени: local > project > user, запись берётся целиком без merge.
- **Approval.** В интерактивном режиме project-серверы из `.mcp.json` требуют подтверждения (`claude mcp reset-project-choices`). Репозиторий не может одобрить себя сам: `enableAllProjectMcpServers` и `enabledMcpjsonServers` из закоммиченного `.claude/settings.json` в недоверенной папке игнорируются. В `claude -p` в недоверенной папке серверы подключаются **без вопросов**.
- **Env expansion** работает в `command`, `args`, `env`, `url`, `headers`: `${VAR}` и `${VAR:-default}`. Если переменной нет и default не задан, сервер всё равно грузится, но с буквальным текстом `${VAR}` и warning в `claude mcp list`. `${CLAUDE_PROJECT_DIR}` в `.mcp.json` требует default (`${CLAUDE_PROJECT_DIR:-.}`). https://code.claude.com/docs/en/mcp#environment-variable-expansion-in-mcp-json
- **`.claude.json` в корне репо.** В docs фигурирует только `~/.claude.json` в домашней директории, а таблица файлов (https://code.claude.com/docs/en/claude-directory) описывает `~/.claude.json` как «Global only». Отдельного «project `.claude.json`» нет. Вывод: **закоммиченный `./.claude.json` с `mcpServers` Claude Code не читает**. У автора всё могло работать, потому что те же серверы лежали у него в `~/.claude.json` (local или user scope) или в его локальном `.mcp.json`. Для boilerplate: **коммитить `.mcp.json`**, секреты передавать через `${VAR}`. **[!]** Вручную не проверено. Пользовательские issue с claudeissues.com (например, https://claudeissues.com/issue/26422-custom-mcp-servers-in-claude-json-never-loaded-v2-1-45) косвенно подтверждают путаницу.

```json
{ "mcpServers": {
    "figma": { "type": "http", "url": "${FIGMA_MCP_URL:-http://127.0.0.1:3845/mcp}" },
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] } } }
```
На native Windows stdio-сервер через `npx` иногда запускают как `cmd /c npx ...`. **[!]** Отдельного требования про `cmd /c` в текущем mcp.md я не нашёл, на конкретной машине нужно проверить через `claude mcp list`.

### 8. Output styles
- **Статус.** Фича **активна**. В v2.0.30 (31.10.2025) её пометили deprecated, а через несколько дней депрекейт отменили (https://github.com/anthropics/claude-code/issues/10721). **[!]** Об отмене сообщают вторичные источники. Текущие docs описывают фичу полностью, `/output-style` снова работает с v2.1.269. https://code.claude.com/docs/en/output-styles
- **Где лежат:** `~/.claude/output-styles/`, `.claude/output-styles/` (ищутся от cwd до корня репо, побеждает ближайший), managed, plugin `output-styles/`.
- **Frontmatter:** `name`, `description`, `keep-coding-instructions` (по умолчанию **false**, то есть инженерная часть system prompt выбрасывается), `force-for-plugin`.
- **Выбор стиля.** Ключ `outputStyle` регистрозависим: несовпадение имени даёт Default. `/config` и `/output-style` пишут выбор в `.claude/settings.local.json`. Стиль из `.claude/settings.json` действует для всей команды.
- **Gotchas.** Стиль не передаётся в subagents. Новый или изменённый файл стиля подхватывается только после рестарта.
- Для репо: текущий `.claude/settings.json` (`"outputStyle":"Human"`) + `.claude/output-styles/Human.md` — валидная схема. Нужно проверить, что в `Human.md` стоит `keep-coding-instructions: true`.

### 9. Plugins и marketplaces
- **Структура плагина** (https://code.claude.com/docs/en/plugins/manifest-reference#standard-layout):
  - `.claude-plugin/plugin.json` (опционален, обязательно только `name`).
  - В корне плагина: `skills/`, `commands/`, `agents/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`, `output-styles/`, `workflows/`, `themes/`, `monitors/`, `bin/` (попадает в PATH Bash), `settings.json` (только `agent` и `subagentStatusLine`).
  - **`CLAUDE.md` в корне плагина не грузится**, вместо него нужен skill. Rules плагином **не поставляются**. **[!]** Прямой фразы «rules» в docs нет, это вывод из layout.
- **Marketplace.** Репо или папка с `.claude-plugin/marketplace.json` (`name`, `owner`, `plugins[{name, source}]`). Source: относительный путь, `github`, `git`, `git-subdir`, `url`, `npm`, `archive`. Проверка через `claude plugin validate`. https://code.claude.com/docs/en/plugin-marketplaces
- **Раздача команде через репо** (https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository): в `.claude/settings.json` проекта:
  ```json
  { "extraKnownMarketplaces": { "fe-kit": { "source": { "source": "github", "repo": "org/fe-claude-kit" }, "autoUpdate": true } },
    "enabledPlugins": { "fe-rules@fe-kit": true } }
  ```
  Ограничения:
  - Marketplace регистрируется **только после workspace trust**. В `-p` и CI только если папка уже доверена или в `~/.claude.json` стоит `hasTrustDialogAccepted`.
  - Плагины с **относительным путём внутри marketplace** ставятся автоматически. Плагины с внешним source (собственный GitHub) из project settings **не ставятся**: каждый участник видит «enabled in project settings but isn't installed» и должен выполнить `claude plugin install … --scope project`.
  - Приватный репо требует git-доступа у каждого участника.
  - В CI нужны `CLAUDE_CODE_SYNC_PLUGIN_INSTALL=1` (иначе плагин может отсутствовать на первом ходу) или seed `CLAUDE_CODE_PLUGIN_SEED_DIR`.
- **Версии и обновления** (https://code.claude.com/docs/en/plugins/loading#versions-and-updates):
  - Версия определяется так: `version` в plugin.json, иначе `version` в записи marketplace, иначе SHA коммита. **Если зафиксировать `version`, обновления до смены строки не придут.**
  - `autoUpdate` по умолчанию включён у официальных marketplaces и **выключен у сторонних**.
  - Auto-update запускается через случайную задержку до 10 минут после первого сообщения. Применяется после `/reload-plugins` или при следующем запуске.
  - Project-enabled плагин отключается локально через `false` в `.claude/settings.local.json`. Отключение в user settings не помогает, потому что project приоритетнее.
- **Плюсы и минусы для boilerplate, который порождает много проектов:**

| | Коммит `.claude/` в каждый проект (копия из boilerplate) | Плагин из marketplace команды |
|---|---|---|
| Обновление правил в уже созданных проектах | вручную (скрипт sync, PR в каждый проект) | авто (`autoUpdate: true`) или `claude plugin update` |
| CLAUDE.md / rules | да | **нет** (только через skills) |
| Hooks, skills, agents, MCP, output styles | да | да |
| Работает без trust, офлайн, в cloud-сессиях | да (в cloud читается `.claude/settings.json`) | нет: trust, git-доступ; в cloud плагины из marketplace **не грузятся** (https://code.claude.com/docs/en/settings#settings-in-cloud-sessions) |
| Проект может переопределить | правкой файлов | только выключить плагин целиком или `skillOverrides` (на plugin skills не действует) |
| Namespace | `/skill` | `/plugin:skill` |
| Прозрачность в diff или ревью | высокая | низкая (код плагина вне репо) |

  **Рекомендация.** Проектный слой (CLAUDE.md/AGENTS.md, `.claude/rules/`, settings, `.mcp.json`, проектные skills) **коммитится** и обновляется скриптом `sync` из boilerplate (вне scope 04a). Общие и часто меняющиеся workflow-skills, ревью-agents и gate-hooks выносятся в **один** marketplace-репо команды: относительные пути плагинов, без фиксированной `version` (или с bump на каждый релиз), `autoUpdate: true` в `extraKnownMarketplaces` шаблона.

### 10. Auto memory
- **Где лежит.** `~/.claude/projects/<project>/memory/`: `MEMORY.md` (индекс) + topic-файлы с frontmatter `type: user|feedback|project|reference`. `<project>` выводится из git-репо, поэтому все worktree одного репо используют одну память. **Только на этой машине**, между машинами и в cloud не переносится. В retention-sweep (`cleanupPeriodDays`) не попадает. https://code.claude.com/docs/en/memory#auto-memory
- **Загрузка.** Первые **200 строк или 25 KB** `MEMORY.md` в каждой сессии. Topic-файлы читаются по требованию. В subagents не передаётся, кроме fork.
- **Управление.** По умолчанию включена. `/memory` показывает тумблер, файлы и папку. Выключение: `autoMemoryEnabled: false` (можно в project settings), env `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. Перенос: `autoMemoryDirectory` (абсолютный путь или `~/`). Фраза «remember X» пишет в auto memory, «add this to CLAUDE.md» — в CLAUDE.md.
- **Перенос в репо.** Механизма «promote» нет. Процесс такой: `/memory` → открыть папку → записи `feedback` и `project`, применимые ко всей команде, вручную перенести в `CLAUDE.md` или `.claude/rules/*.md` (или попросить Claude) → удалить их из memory, чтобы не было дубля. Это можно оформить как skill `/promote-memory`. Для boilerplate есть вариант поставить в project settings `autoMemoryEnabled: false`, чтобы поведение не расходилось между машинами. **[!]** Решение за командой.

### 11. CI и ревью
- **GitHub Action** `anthropics/claude-code-action@v1` (https://code.claude.com/docs/en/github-actions). Установка через `/install-github-app` (только github.com) или вручную: App + secret `ANTHROPIC_API_KEY` или OAuth. Входы: `prompt`, `claude_args` (любые CLI-флаги: `--max-turns`, `--model`, `--allowedTools`, `--mcp-config`). Переход с `@beta`: `custom_instructions` превращается в `--append-system-prompt`. Action читает CLAUDE.md репо.
  ```yaml
  - uses: anthropics/claude-code-action@v1
    with:
      anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
      prompt: "/code-review:code-review --comment ${{ github.repository }}/pull/${{ github.event.pull_request.number }}"
      claude_args: '--allowedTools "mcp__github_inline_comment__create_inline_comment"'
  ```
- **Headless.** `claude -p "..." --output-format text|json|stream-json`, `--json-schema`, `--max-turns`, `--max-budget-usd`, `--allowedTools`, `--disallowedTools`, `--permission-mode`, `--settings <file|json>`, `--setting-sources user,project,local`, `--mcp-config`, `--strict-mcp-config`, `--append-system-prompt(-file)`. https://code.claude.com/docs/en/cli-reference
- **`--bare`** пропускает hooks, skills, commands, agents, plugins, `.mcp.json`, auto memory и **CLAUDE.md**. Его рекомендуют для скриптов, и он станет default для `-p`. **[!]** Это повлияет на CI-ревью по правилам проекта: нужно будет явно убирать `--bare` или передавать правила через `--append-system-prompt-file`. Без `--bare` команда `-p` выполняет project hooks и `.mcp.json` даже в недоверенной папке. https://code.claude.com/docs/en/headless
- **GitLab CI/CD** — **beta**. Job на `node:24-alpine`, `claude -p "${AI_FLOW_INPUT}" --permission-mode acceptEdits --allowedTools "Bash Read Edit Write mcp__gitlab"`, триггер `@claude` через webhook и pipeline trigger API. https://code.claude.com/docs/en/gitlab-ci-cd
- **Ревью:**
  - `/code-review [target] [--comment|--fix]`: bundled skill, ищет баги. **`/review` его alias с v2.1.223.**
  - `/security-review`: bundled, вызывается только вручную.
  - **Code Review** (managed, research preview, Team/Enterprise): мультиагентный, оставляет inline-комментарии в PR с severity 🔴/🟡/🟣, читает `CLAUDE.md` (нарушения как nit) и **`REVIEW.md`** в корне репо (правила только для ревью). https://code.claude.com/docs/en/code-review

### 12. AGENTS.md и совместимость с Codex
- **Claude Code** (v2.1.277+; https://code.claude.com/docs/en/memory#agents-md):
  - По умолчанию (`claude-md-or-agents-md`) `AGENTS.md` и `.claude/AGENTS.md` читаются **только если в cwd и выше нет `CLAUDE.md`, `.claude/CLAUDE.md` или `CLAUDE.local.md`**. `CLAUDE.local.md` тоже считается и «выключает» AGENTS.md.
  - Режим `claude-md-and-agents-md` (через `/config` → Project instructions или `pluginConfigs["cc-plugin-agents-md@builtin"].options.instructionFiles`) работает **только из user, managed или `--settings`, не из project**.
  - Не читаются: `AGENTS.local.md`, `AGENTS.override.md`, `.agents/`.
  - `@AGENTS.md` внутри CLAUDE.md никогда не загружает файл дважды.
  - Symlink `CLAUDE.md → AGENTS.md` docs **не рекомендуют для Windows**: нужны админ-права или Developer Mode, а Git без `core.symlinks` создаёт однострочный текстовый файл.
- **Codex** (https://learn.chatgpt.com/docs/agent-configuration/agents-md):
  - Global: `~/.codex/AGENTS.override.md` или `AGENTS.md`.
  - Project: от git root вниз до cwd, в каждой директории берётся `AGENTS.override.md` → `AGENTS.md` → `project_doc_fallback_filenames`, максимум один файл на директорию.
  - Суммарный лимит `project_doc_max_bytes` **32 KiB**.
  - Поддержка `@import` **не описана**, предполагаем, что её нет.
- **Codex skills** (https://learn.chatgpt.com/docs/build-skills): `.agents/skills` от cwd до корня репо, `~/.agents/skills`, `/etc/codex/skills`. Формат тот же (agentskills.io, `name` + `description`). Листинг skills занимает 2% контекста. `.codex/skills` в текущих docs не упоминается. **[!]** Возможно, это устаревший путь.
- **Один источник истины, рекомендация:**
  1. `AGENTS.md` в корне — канонические правила. Он самодостаточен (без `@`-импортов, потому что Codex их не раскрывает) и меньше 32 KiB.
  2. `CLAUDE.md` = `@AGENTS.md` + короткий блок, специфичный для Claude (skills, hooks, `/code-review`). Symlink не используем.
  3. Skills храним в `.claude/skills/` (канон). Для Codex либо генерируем `.agents/skills/` копией через sync-скрипт, либо делаем symlink каталогов (на Windows ненадёжно). **[!]** Нужно решить в 05/06.
  4. Глубокие правила (`docs/*.md`) в обоих инструментах подгружаются ссылками или чтением по требованию. Для Claude их дополнительно можно привязать через `.claude/rules/` с `paths`.

### 13. Best practices Anthropic
- **CLAUDE.md** (https://code.claude.com/docs/en/best-practices#write-an-effective-claude-md, https://code.claude.com/docs/en/memory#write-effective-instructions):
  - Коротко, меньше 200 строк. Для каждой строки спрашивать: «Would removing this cause Claude to make mistakes?»
  - Включать: команды, которые не угадать; стиль, отличный от дефолтов; тест-раннер; правила веток и PR; архитектурные решения; env-особенности; gotchas.
  - Не включать: то, что выводится из кода; стандартные конвенции; API-доки; часто меняющееся; пофайловые описания.
  - `IMPORTANT` ставить точечно, иначе выделение теряет смысл.
  - Конкретные проверяемые формулировки («Use 2-space indentation»).
  - Противоречия устранять: при конфликте Claude выбирает случайно.
  - Многошаговые процедуры выносить в skills, частные правила — в path-rules.
  - `/doctor` предлагает сокращения: вырезает выводимое из кода, оставляет pitfalls и rationale.
- **Skills** (https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices):
  - `name` ≤64 символов, `[a-z0-9-]`, без «anthropic» и «claude». Предпочтительна gerund-форма.
  - `description` ≤1024 символов (Claude Code-листинг режет `description` + `when_to_use` на 1536), **в третьем лице**, формулирует «что делает + когда использовать» с ключевыми словами.
  - Тело меньше 500 строк, ссылки на файлы только **на один уровень вглубь**, для reference-файлов больше 100 строк нужен TOC.
  - Только forward slashes, никаких Windows-путей.
  - Сначала evals: минимум 3 сценария, сравнение с baseline.
  - Учитывать степени свободы: для хрупких операций давать точные скрипты.
  - Чек-листы и feedback loops (validate → fix → repeat).
  - Без time-sensitive информации.
  - Единая терминология.
  - Утилиты-скрипты вместо генерации кода.

## Таблица «потребность → механизм»
| Потребность | Механизм | Файл (коммит?) | Примечание |
|---|---|---|---|
| Правила, нужные всегда (процесс, git, язык ответа) | `CLAUDE.md` (`@AGENTS.md` + Claude-блок) | `./CLAUDE.md`, `./AGENTS.md` (да) | <200 строк. Контекст, а не гарантия |
| Правила для части кода (компоненты, тесты, стили) | `.claude/rules/*.md` с `paths:` | да | Грузятся при касании подходящего файла |
| Тематические правила, нужные всегда, но модульно | `.claude/rules/*.md` без `paths` | да | Эквивалент импорта, контекст не экономят |
| Рецепты (новый компонент, pixel-perfect по Figma, релиз) | Skills `.claude/skills/<n>/SKILL.md` | да | Для побочных эффектов `disable-model-invocation`. Тяжёлые — через `context: fork` |
| Специализированный исполнитель (ревьюер, верстальщик) | Subagent `.claude/agents/*.md` | да | `skills:` для преднагрузки. Explore и Plan не видят CLAUDE.md |
| Детерминированные проверки (формат, lint после правки, запрет push или `.env`) | Hooks + `permissions.deny` в `.claude/settings.json` | да | `exit 2` для блокировки. На Windows вызывать `node` + `args` |
| Атрибуция и правила коммитов | `attribution` + `includeGitInstructions` | `.claude/settings.json` (да) | `includeCoAuthoredBy` deprecated |
| Ревью в CI | `claude-code-action@v1` / `claude -p` / managed Code Review + `REVIEW.md` | `.github/workflows/*.yml`, `REVIEW.md` (да) | Без `--bare`, если нужны CLAUDE.md и skills |
| MCP для команды (Figma, context7) | `.mcp.json` в корне + `${VAR:-default}` | да | **Не `./.claude.json`**. Нужен approval при первом запуске |
| Личные MCP и секреты | `claude mcp add --scope local/user`, переменные окружения | `~/.claude.json` (нет) | |
| Раздача обновляемых skills, agents и hooks во все проекты | Plugin в marketplace команды + `extraKnownMarketplaces`/`enabledPlugins` | `.claude/settings.json` (да), plugin-репо отдельно | Нужен trust, `autoUpdate: true`. CLAUDE.md и rules не поставляет |
| Тон и формат ответов | Output style + `outputStyle` | `.claude/output-styles/*.md`, settings (да) | `keep-coding-instructions: true` |
| Личные настройки на проект | `.claude/settings.local.json`, `CLAUDE.local.md` | нет (gitignore) | `CLAUDE.local.md` отключает чтение AGENTS.md по умолчанию |
| Личные настройки глобально | `~/.claude/settings.json`, `~/.claude/CLAUDE.md`, `~/.claude/rules/` | нет | Project-уровень приоритетнее user |
| Знания, накопленные в сессиях | Auto memory → ручной перенос в rules | `~/.claude/projects/.../memory` (нет) | Живёт на одной машине. Можно выключить через `autoMemoryEnabled:false` |
| Совместимость с Codex | `AGENTS.md` (канон, <32 KiB) + копия skills в `.agents/skills/` | да | Codex не читает `.claude/`, Claude не читает `.agents/` |
| Политики уровня организации | managed-settings / managed CLAUDE.md / `strictKnownMarketplaces` | MDM (нет) | Вне репо |
