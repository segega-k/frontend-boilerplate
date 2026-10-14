# 10a. Claude Code: как закрутить гайки агенту в общем репозитории

Status: done
Date: 2026-10-14
Автор: под-агент исследования 10 (security). Источники: только официальная документация Claude Code (code.claude.com/docs, сверено 2026-10-14) плюс отдельно помеченные внешние ссылки.
Легенда: **[V]** — проверено по официальной документации (ссылка рядом); **[U]** — не проверено / по памяти / по вторичному источнику.

> Важное наблюдение про версию: в текущих доках многие гарантии привязаны к версиям CLI v2.1.2xx (например, `onFailure` у хуков требует v2.1.295, проверки редиректов ввода — v2.1.257). Перед внедрением выполните `claude --version` и `claude doctor`. Все цитаты ниже относятся к документации на 2026-10-14.

---

## 0. TL;DR (что важно знать в первую очередь)

1. **Правила `permissions` не являются границей безопасности для Bash.** Документация прямо говорит, что deny-правило `Bash(git push *)` не остановит `git -C . push`, `git 'push'`, `/usr/bin/curl`, `sh -c '...'`. Для настоящей защиты рекомендуют **sandbox** (ОС-уровень) и/или **PreToolUse-хуки**. [V] https://code.claude.com/docs/en/permissions#bash-rule-limits
2. **Нативной песочницы на Windows нет.** "The sandbox runs on macOS, Linux, and WSL2. On native Windows, Claude Code runs commands unsandboxed." На Windows 11 + Git Bash блок `sandbox` в settings.json **ничего не делает** (молча, если не задан `failIfUnavailable: true`, иначе Claude Code не стартует). Реальные варианты: WSL2, devcontainer или VM. [V] https://code.claude.com/docs/en/sandboxing
3. **На Windows при установленном Git Bash по умолчанию включён ещё и инструмент PowerShell** (для аккаунтов claude.ai/Console). Каждое Bash-правило и matcher хука нужно дублировать для `PowerShell`, иначе обход тривиален. [V] https://code.claude.com/docs/en/env-vars (`CLAUDE_CODE_USE_POWERSHELL_TOOL`), https://code.claude.com/docs/en/hooks (Windows notes)
4. **Режим по умолчанию теперь `auto`** (классификатор вместо человека) для интерактивных сессий в CLI/VS Code с v2.1.283. В проектном `.claude/settings.json` значения `"auto"` и `"bypassPermissions"` для `defaultMode` **игнорируются**, остальные значения (`"default"` и т. д.) работают. [V] https://code.claude.com/docs/en/permission-modes
5. **Проектный `.claude/settings.json` может повлиять только на часть настроек:** `allow` и `additionalDirectories` применяются лишь после workspace trust, а `deny`/`ask` действуют сразу. Хуки из проектных настроек **запускаются** и в `claude -p`, и при доверии только родительской папке. Надёжно закрепить политику (чтобы разработчик/агент не мог её ослабить) можно только через **managed settings**. [V] https://code.claude.com/docs/en/permissions#project-allow-rules-and-workspace-trust

---

## 1. Синтаксис правил разрешений (на 2025–2026)

Источник по всему разделу, если не указано иное: https://code.claude.com/docs/en/permissions [V]

### 1.1 Формат и порядок вычисления
- Формат: `Tool` или `Tool(specifier)`. `Bash` == `Bash(*)` (все команды). Если в deny указано голое имя инструмента, инструмент **удаляется из контекста** модели.
- Порядок: **deny → ask → allow**, побеждает первое совпадение; "rule specificity doesn't change the order". Узкое allow не может прорезать исключение в широком deny; ask тоже побеждает более узкое allow.
- Правила применяет Claude Code, а не модель: инструкции в CLAUDE.md/промпте ничего не разрешают и не запрещают.
- `Tool(param:value)` работает только в deny/ask и только для top-level скалярных параметров (`Bash(run_in_background:true)`, `Agent(model:opus)`, `Bash(dangerouslyDisableSandbox:true)`). Основные поля (`command`, `file_path`, `url`) так матчить нельзя: `Bash(command:rm *)` игнорируется с предупреждением.

### 1.2 Bash: `:*` или ` *`
- `*` матчит любой текст, **включая пробелы**, и может стоять в любом месте.
- **`Bash(ls:*)` ≡ `Bash(ls *)`.** "The `:*` suffix is an equivalent way to write a trailing wildcard". `:*` распознаётся **только в конце**: в `Bash(git:* push)` двоеточие считается литералом. Диалог "Yes, don't ask again" сохраняет форму с пробелом, так что **рекомендуемая запись — `Bash(git push *)`**.
- Хвостовой ` *` матчит и голую команду: `Bash(git log *)` матчит `git log`. Пробел значим: `Bash(ls *)` не матчит `lsof`, а `Bash(ls*)` матчит.
- Ставьте `*` **после подкоманды**: `Bash(git * main)` матчит `git -c core.fsmonitor=<script> diff main`, а для allow-правил с `*` перед подкомандой Claude Code выдаёт предупреждение при старте.
- **Составные команды:** разделители `&&`, `||`, `;`, `|`, `|&`, `&`, перевод строки. Allow должен совпасть с **каждой** подкомандой. Deny/ask срабатывают, если совпала **любая** подкоманда, включая `$(...)`, подоболочки и тела `for`.
- **Обёртки** `timeout`, `time`, `nice`, `nohup`, `stdbuf`, `command`, `builtin`, `noglob` и голый `xargs` снимаются перед сравнением. `npx`, `docker exec`, `devbox run`, `mise exec` и `direnv exec` **не снимаются**, поэтому `Bash(devbox run *)` разрешает что угодно.
- **Переменные окружения:** allow-правило снимает только известные безопасные `VAR=`, а deny/ask пропускает **любое** ведущее присваивание (`Bash(rm *)` в deny ловит `FOO=bar rm -rf tmp/`).
- **Редиректы:** цели `> file`/`>> file`/`2> file` и `tee` проверяются по правилам `Edit`, `< file` — по правилам `Read` (v2.1.257+, `tee` — v2.1.269+).
- Встроенные read-only команды (`ls`, `cat`, `head`, `tail`, `grep`, `find`, `git status`...) выполняются без запроса **в любом режиме**. Список не настраивается; чтобы получать запрос, добавьте ask/deny.

**Известные обходы, которые признаёт сама документация** (таблица "What a Bash rule doesn't match"):

| Правило | Останавливает | НЕ останавливает |
|---|---|---|
| `Bash(curl *)` | `curl https://example.com` | `/usr/bin/curl ...`, `sh -c 'curl ...'` |
| `Bash(rm *)` | `rm -rf build/` | `/bin/rm -rf build/`, `bash -c 'rm -rf build/'` |
| `Bash(git push *)` | `git push origin main` | `git -C . push ...`, `git -c push.default=current push ...`, `git 'push' origin main` |

Что рекомендует документация: "For filesystem and network enforcement that doesn't depend on the command text, use sandboxing. To inspect the full command text with your own logic before it runs, use a PreToolUse hook." А также: "using WebFetch alone doesn't prevent network access. If Bash is allowed, Claude can still use curl, wget...".

### 1.3 Read/Edit: пути в стиле gitignore
| Шаблон | Значение | Пример |
|---|---|---|
| `//path` | абсолютный путь от корня ФС | `Read(//Users/alice/secrets/**)` |
| `~/path` | от домашней папки | `Read(~/.ssh/**)` |
| `/path` | **относительно источника настроек** (не корня ФС!) | `Edit(/src/**)` в `.claude/settings.json` → `<project>/src/**` |
| `path` / `./path` | относительно текущей директории | `Read(*.env)` |

- `/path` в `~/.claude/settings.json` указывает на `~/.claude/path`. Чтобы правило в пользовательских настройках работало во всех проектах, используйте `//` или `~/`.
- **Windows:** пути нормализуются в POSIX: `C:\Users\alice` → `/c/Users/alice`. `.env` на всём диске C: — `//c/**/.env`, на всех дисках — `//**/.env`.
- Голое имя файла матчится на любой глубине: `Read(.env)` ≡ `Read(**/.env)` (только под cwd). `Read(//**/.env)` — по всей ФС.
- Шаблон с одним сегментом каталога (`secrets/**`): в **allow** матчит только `<cwd>/secrets`, в **deny/ask** — каталог `secrets` на любой глубине.
- Отрицание `!`: в одном и том же списке deny `Read(*.env)` и затем `Read(!sample.env)`. Вырезает исключения **только из `path`/`./path`-правил того же источника** и не может открыть файл внутри полностью закрытого каталога.
- `Read`-deny также блокирует Edit/Write по тому же пути (v2.1.208+/v2.1.228+), `@`-упоминания, вставленные пути к картинкам и листинги каталогов (v2.1.290+). NotebookEdit **не** покрывается, нужен отдельный `Edit`-deny.
- Учитываются только правила `Edit(path)` и `Read(path)`. `Write(path)`, `Glob(path)` и `MultiEdit(path)` принимаются, но **никогда не проверяются** (с предупреждением).
- **Ограничение:** "They don't apply to a command that reads files without naming them, such as `grep -r pattern .`... or to arbitrary subprocesses that read or write files indirectly, like a Python or Node script". На уровне ОС такое закрывает только sandbox.
- Файл `.claudeignore` **не работает**: "If your project has a `.claudeignore` file, it has no effect".

### 1.4 WebFetch, MCP, Agent
- `WebFetch(domain:example.com)` — только сам хост. Поддомены: `WebFetch(domain:*.example.com)` (wildcards с v2.1.172). `example.*` не пересекает точку.
- Голое `WebFetch` в deny удаляет инструмент. `WebFetch(domain:*)` в deny оставляет инструмент, но отклоняет каждый fetch **и** закрывает сеть sandbox. Allow-правила `domain:` **добавляются в allowlist песочницы**.
- MCP: `mcp__server` или `mcp__server__*` (все инструменты сервера), `mcp__server__tool`. В deny/ask допустимы globs по имени (`"mcp__*"` — все MCP). В allow glob разрешён только после литерала `mcp__<server>__`. `mcp__`-правила со скобками в settings **пропускаются**.
- Инструменты плагинов называются `mcp__plugin_<plugin>_<server>__<tool>` [V] https://code.claude.com/docs/en/hooks. В этой среде Figma подключён как `mcp__plugin_figma_figma__*`.
- `Agent(Explore)` и т. п. отключают отдельных субагентов.

### 1.5 Файлы настроек: что сливается и что побеждает
Источник: https://code.claude.com/docs/en/settings [V]
1. **Managed** (`managed-settings.json`, MDM/HKLM, server-managed): ничто не переопределяет.
2. **CLI** `--settings`.
3. **Local** `.claude/settings.local.json`.
4. **Project** `.claude/settings.json` (коммитится).
5. **User** `~/.claude/settings.json`.

- **Скалярные ключи** берутся с самого высокого уровня. **Списки (`permissions.allow/ask/deny`, `sandbox.filesystem.*` и др.) объединяются**, а не заменяются.
- Для permissions: deny с **любого** уровня нельзя разрешить ни на каком другом, даже `--allowedTools` не помогает. `allowManagedPermissionRulesOnly` (только managed) делает managed единственным источником правил.
- Есть исключения, когда побеждает более строгое значение с нижнего уровня: `permissions.blockReadsOutsideWorkingDirectories: true` из любого scope, `disableClaudeAiConnectors: true` и др. (таблица "Exceptions to managed settings precedence").
- Путь к managed-файлу на Windows: **`C:\Program Files\ClaudeCode\managed-settings.json`** (старый `C:\ProgramData\ClaudeCode\...` больше не читается), плюс `managed-settings.d/`, `managed-mcp.json`. Также реестр: `HKLM\SOFTWARE\Policies\ClaudeCode` → значение `Settings` (REG_SZ с JSON). [V] https://code.claude.com/docs/en/managed-settings
- JSON-схема: `"$schema": "https://json.schemastore.org/claude-code-settings.json"`. Схема может отставать от CLI. [V]

### 1.6 Ключевые ключи permissions
- `defaultMode`: `default` (алиас `manual`), `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`. В проектных `.claude/settings.json` и `settings.local.json` значения `auto` и `bypassPermissions` **не действуют**. [V] https://code.claude.com/docs/en/permission-modes
- `disableBypassPermissionsMode: "disable"` работает из любого scope (пользователь может заблокировать сам себя), но обычно задаётся в managed. [V] permissions#managed-settings
- `disableAutoMode: "disable"`: страницы permissions и permission-modes пишут `permissions.disableAutoMode`, а индекс settings-reference показывает top-level `disableAutoMode`. **[U] расхождение в доках.** Перед использованием проверьте через `claude doctor`.
- `additionalDirectories`: даёт **только файловый доступ** (не загружает `.claude/`-конфиг этих папок). Из проектного файла применяется только после trust. Записи в additionalDirectories также расширяют запись для sandbox. [V]
- `blockReadsOutsideWorkingDirectories: true`: файловые инструменты отказывают в чтении вне рабочих каталогов. Строгое значение побеждает даже managed (v2.1.257+). [V]
- **Protected paths** (защищены всегда, кроме `bypassPermissions`): запись в `.git`, `.husky`, `.claude`, `.vscode`, `.idea`, `.devcontainer`, `.yarn`, а также `.npmrc`, `.pnpmfile.cjs`, `.mcp.json`, `.gitconfig`, `.envrc`, `lefthook.yml`, `.pre-commit-config.yaml` и др. В `default`/`acceptEdits` такие записи всегда спрашивают, в `auto` идут к классификатору, в `dontAsk` запрещены. `allow`-правила их **не** предразрешают. [V] https://code.claude.com/docs/en/permission-modes#protected-paths
- **Critical paths**: `rm`/`rmdir` по корню, домашнему каталогу, cwd и его родителям никогда не одобряются allow-правилом или хуком. [V] там же.

---

## 2. Sandbox

Источник: https://code.claude.com/docs/en/sandboxing [V]

### 2.1 Платформы
- **macOS** (Seatbelt), **Linux и WSL2** (`bubblewrap` + `socat`). **Нативный Windows не поддерживается:** "On native Windows, Claude Code runs commands unsandboxed. To use the sandbox on a Windows machine, run Claude Code inside a WSL2 distribution."
- По умолчанию при недоступном sandbox команды **молча выполняются без него**. `sandbox.failIfUnavailable: true` заставляет Claude Code завершиться при старте. Это значит, что для пользователя на нативном Windows **нельзя ставить `failIfUnavailable: true` в коммитимый project settings**: у него Claude Code просто не запустится. Документация советует раздавать такую конфигурацию по ОС или переводить Windows-пользователей в WSL2/контейнер.

### 2.2 Что ограничивает и что нет
| Доступ | По умолчанию | Ключи |
|---|---|---|
| Запись | cwd, per-user temp, additional dirs; protected paths закрыты | `sandbox.filesystem.allowWrite`, `denyWrite` |
| Чтение | **почти вся машина, включая `~/.ssh` и `~/.aws/credentials`** | `sandbox.filesystem.denyRead`, `allowRead`, `sandbox.credentials` |
| Сеть | только через локальный прокси, allowlist **пустой** | `sandbox.network.allowedDomains`, `deniedDomains`, `strictAllowlist` |
| Env vars | наследуются, **включая секреты** | `sandbox.credentials.envVars`, `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` |

- **Вне песочницы работают:** Read/Edit/Write/WebFetch/WebSearch (их ограничивают permissions; `denyRead` не останавливает Read, `allowedDomains` не ограничивает WebFetch), **хуки, локальные MCP-серверы**, LSP, statusLine, `apiKeyHelper`, команды из `!`-режима, `excludedCommands` и unsandboxed-ретраи.
- Пути в sandbox используют **обычные** соглашения (`/tmp/build` абсолютный, `~/.kube`, `.` = корень проекта в project settings), а не `//`-синтаксис permissions.
- Правила `Read`/`Edit` deny, `Edit` allow и `WebFetch(domain:)` **сливаются** в конфигурацию sandbox.
- `excludedCommands: ["docker compose *"]`: синтаксис как у `Bash(...)`; такие команды выполняются **с полным доступом**, широкие шаблоны опасны.
- `allowUnsandboxedCommands: false` («strict sandbox mode»): игнорирует параметр `dangerouslyDisableSandbox`. Без него модель может попросить перезапустить команду вне песочницы (в Manual — с запросом). Альтернатива: ask-правило `Bash(dangerouslyDisableSandbox:true)`.
- `autoAllowBashIfSandboxed` (по умолчанию `true`): команды в песочнице выполняются **без запроса**, но explicit deny и content-scoped ask (`Bash(git push *)`) всё равно действуют.
- `filesystem.disabled` нельзя включить из project settings (только user/managed/`--settings`).
- **Admin-required sandbox** (managed `allowUnsandboxedCommands: false` или `allowManagedDomainsOnly`): ослабляющие ключи из репозитория (`excludedCommands`, `allowedDomains`, `allowWrite`...) игнорируются (v2.1.285+).
- **Ограничения:** прокси не инспектирует TLS. Широкие домены вроде `github.com` — канал эксфильтрации (domain fronting). Unix-сокеты (`docker.sock`) равны выходу из песочницы.

---

## 3. Hooks (PreToolUse)

Источник: https://code.claude.com/docs/en/hooks [V], https://code.claude.com/docs/en/permissions#extend-permissions-with-hooks [V]

### 3.1 Входной JSON (stdin)
Общие поля: `session_id`, `prompt_id`, `transcript_path`, `cwd`, `scratchpad_dir`, `permission_mode`, `effort`, `hook_event_name`. Для PreToolUse добавляются **`tool_name`, `tool_input`, `tool_use_id`**.
```json
{
  "session_id": "abc123",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "npm test", "description": "Run test suite", "timeout": 120000, "run_in_background": false },
  "tool_use_id": "toolu_01ABC123..."
}
```
Поля `tool_input` [V]:
- Bash/PowerShell: `command`, `description`, `timeout`, `run_in_background`.
- Read: `file_path`, `offset`, `limit`.
- Write: `file_path`, `content`.
- Edit: `file_path`, `old_string`, `new_string`, `replace_all`.
- Grep: `pattern`, `path`, `glob`, `output_mode`.
- Glob: `pattern`, `path`.
- WebFetch: `url`, `prompt`.
- NotebookEdit: `notebook_path` (упоминается на странице permissions).

**Windows:** "the path arrives with backslash separators, even when your hook runs under Git Bash". Пути нужно нормализовать. `~` и относительные пути Claude Code раскрывает до вызова хука.

### 3.2 Exit code и JSON
| Exit | Эффект |
|---|---|
| 0 | stdout разбирается как JSON (если весь вывод — один объект). Без вывода: «нет решения», работает обычный поток разрешений |
| **2** | **Блок.** stderr становится причиной для Claude. "JSON fields can't override the block." Срабатывает **до** оценки permission rules, т. е. сильнее allow |
| другое (вкл. 1) | **Неблокирующая** ошибка: действие **выполняется**. "If your hook is meant to enforce a policy, use exit 2." |

JSON-решение для PreToolUse (внутри `hookSpecificOutput`; верхнеуровневые `decision`/`reason` устарели):
```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "..." } }
```
- Значения: `allow` | `deny` | `ask` | `defer`. При нескольких хуках: **deny > defer > ask > allow**.
- `allow` из хука **не** отменяет deny/ask-правила. `ask` из хука заставляет показать запрос даже в auto mode.
- **Таймаут** command-хука (по умолчанию 600 с) **не блокирует** вызов. Для «шлюза» задайте `"onFailure": "block"` (требует **v2.1.295+**).
- Файлы, упомянутые через `@` в промпте, **не проходят** через PreToolUse. Против них нужен `Read`-deny.
- Поле `if` у хука ("best-effort") — документация советует для жёстких allow/deny использовать permission system.

### 3.3 Matcher
- `"*"`, `""` или отсутствие — всё. Только буквы/цифры/`_`/`-`/пробел/`,`/`|` — точное имя или список (`Edit|Write`). Любой другой символ — JS regex без якорей (`Edit.*` заденет и `NotebookEdit`, используйте `^Edit$`).
- MCP: `mcp__memory__.*` (голое `mcp__memory` не матчит ничего).
- На Windows: **`Bash|PowerShell`**. Без Git Bash инструмент Bash вообще не регистрируется.

### 3.4 Конфигурация и управление
- Exec-форма: `"command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/x.mjs"]`. Без шелла, рекомендована для путей с плейсхолдерами. `.cmd`/`.bat`-шимы в exec-форме **не запускаются**, поэтому вызывайте `node` напрямую. На Windows без Git Bash поле `shell` по умолчанию `powershell`.
- `disableAllHooks: true`: эффективное значение следует приоритету настроек, поэтому **проектный `false` перекрывает пользовательский `true`**. Managed-хуки этим ключом из user/project/local не отключаются. Разовое отключение: `claude --settings '{"disableAllHooks": true}'`.
- `allowManagedHooksOnly` (только managed): запускаются только managed-хуки и хуки force-enabled managed-плагинов.
- Хуки **сами работают вне песочницы** с полными правами пользователя. Хук из чужого репозитория — это исполнение кода (выполняется даже в `claude -p` без trust). [V] permissions#what-runs-before-you-trust-a-folder
- Дополнительно: хук `ConfigChange` позволяет аудировать или блокировать изменения настроек во время сессии. [V] https://code.claude.com/docs/en/security

### 3.5 Рабочий хук `.claude/hooks/guard.mjs` (Node, кроссплатформенный)
Логика: deny → `exit 2` + причина в stderr. ask → JSON `permissionDecision: "ask"`. Сбой разбора → `exit 2` (fail-closed). Проверено локально на Node 22.20 набором из 62 кейсов, все прошли. Среди кейсов: `git -C . push`, `git 'push'`, `bash -c "git push"`, `echo $(git push)`, `timeout 30 git push`, `iwr ... | iex`, `bash <(curl ...)`, `HUSKY=0 git commit`, `git commit -nm`, `cat .env` (deny), `cat .env.example` (allow), `node -e "readFileSync('.env')"`, Windows-пути с `\`, ложные срабатывания на `git commit -m "fix .env"`, `grep secret src`.

Что блокирует (deny):
- чтение и упоминание `.env*` (кроме `.env.example/.sample/.template/.defaults`), `*.pem/key/p12/pfx/...`, `id_rsa*`, `~/.ssh`, `~/.aws`, `~/.config/gh`, `.npmrc`, `.netrc`, `.git-credentials`, `secrets/`;
- `git push` (любой, включая `--force` и глобальные опции перед подкомандой), `git branch -D` / `--delete --force`, `git reset --hard`, `git clean -f*`, `git filter-branch/filter-repo`;
- `git config core.hooksPath|fsmonitor|sshCommand|alias.*` и `git -c core.hooksPath=...`;
- `--no-verify`, `git commit -n`, `HUSKY=0`;
- `rm -rf` (любые сочетания `-r` и `-f`), `Remove-Item -Recurse`, `rd /s`;
- download→exec: `curl|sh`, `wget|bash`, `iwr|iex`, `iex (irm ...)`, `bash <(curl ...)`;
- `npm/pnpm publish|login|token|owner`;
- запись (Edit/Write/NotebookEdit, редиректы, `sed -i`/`mv`/`cp`/`tee`/`Set-Content`/...) в `.husky/`, `.claude/settings*.json`, `.claude/hooks/`, `.git/hooks|config`, `.mcp.json`, `.gitconfig`, `lefthook.yml`, `pnpm-lock.yaml`.

Что отправляет на подтверждение (ask): `pnpm/npm/yarn/bun add`, `install <pkg>`, `dlx`, `npx`/`bunx`/`npm exec`, прочие `git config`, `git checkout/restore .`, `git stash drop/clear`, дамп окружения (`env`, `printenv`, `gci env:`), одиночный `rm -r`, `rimraf`.

Ограничения (честно): это текстовая эвристика. Её обходят base64/`eval` с переменными, скрипт, записанный в файл и затем выполненный (`node x.js`, `pnpm run <script>` после правки `package.json`), алиасы, бинарники, которые сами читают `.env` (например, `vite` / `dotenv` в тестах — это легитимно). Настоящую границу дают только sandbox, контейнер или VM.

```js
#!/usr/bin/env node
// .claude/hooks/guard.mjs — PreToolUse guard (Bash, PowerShell, Read, Edit, Write, NotebookEdit, Grep, Glob)
// Deny  -> exit 2, reason on stderr (blocks before permission rules; JSON can't override).
// Ask   -> exit 0 + JSON hookSpecificOutput.permissionDecision = "ask".
// Allow -> exit 0, no output ("no decision": normal permission flow continues).
// Heuristic text analysis: NOT a security boundary (see sandbox / devcontainer).

const DENY = 'deny';
const ASK = 'ask';

// ---------- path rules ----------
const SECRET_FILE_RE = [
  /(^|\/)\.env(\.[^/]*)?$/i,           // .env, .env.local, .env.production ...
  /(^|\/)\.envrc$/i,
  /\.(pem|key|p12|pfx|jks|keystore|crt|cer|der|asc|gpg)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /(^|\/)\.ssh(\/|$)/i,
  /(^|\/)\.aws(\/|$)/i,
  /(^|\/)\.gnupg(\/|$)/i,
  /(^|\/)\.config\/gh(\/|$)/i,
  /(^|\/)\.npmrc$/i,                    // may contain _authToken
  /(^|\/)\.netrc$/i,
  /(^|\/)\.git-credentials$/i,
  /(^|\/)secrets?\/|\/secrets?$/i,       // a "secrets/" directory (bare word "secret" is not a path)
  /(^|\/)\.credentials\.json$/i,
  /(^|\/)credentials\.json$|\/credentials$/i,
];
const SECRET_ALLOW_RE = /(^|\/)\.env\.(example|sample|template|defaults)$/i;

const PROTECTED_WRITE_RE = [
  /(^|\/)\.husky(\/|$)/i,
  /(^|\/)\.claude\/settings(\.local)?\.json$/i,
  /(^|\/)\.claude\/hooks(\/|$)/i,
  /(^|\/)\.git\/(hooks|config)(\/|$)/i,
  /(^|\/)\.mcp\.json$/i,
  /(^|\/)\.gitconfig$/i,
  /(^|\/)lefthook\.ya?ml$/i,
  /(^|\/)pnpm-lock\.yaml$/i,            // lockfile only via pnpm, never by hand
];

const norm = (p) => String(p || '').replace(/\\/g, '/').replace(/^["']|["']$/g, '');
const isSecretPath = (p) => {
  const n = norm(p);
  if (!n || SECRET_ALLOW_RE.test(n)) return false;
  return SECRET_FILE_RE.some((re) => re.test(n));
};
const isProtectedPath = (p) => PROTECTED_WRITE_RE.some((re) => re.test(norm(p)));

// ---------- shell tokenizer ----------
// Splits into segments by ; && || | & newline (outside quotes). Keeps quoted tokens intact.
function tokenize(cmd) {
  const segs = [];
  let cur = [], tok = '', q = null, hadTok = false;
  const pushTok = () => { if (hadTok) cur.push(tok); tok = ''; hadTok = false; };
  const pushSeg = (op) => { pushTok(); if (cur.length) segs.push({ tokens: cur, op }); cur = []; };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i], n = cmd[i + 1];
    if (q) {
      if (c === q) { q = null; continue; }
      if (c === '\\' && q === '"' && n !== undefined) { tok += n; i++; continue; }
      tok += c; continue;
    }
    if (c === '"' || c === "'") { q = c; hadTok = true; continue; }
    if (c === '\\' && n !== undefined && n !== '\n') { tok += n; hadTok = true; i++; continue; }
    if (c === ' ' || c === '\t') { pushTok(); continue; }
    if (c === '\n' || c === ';') { pushSeg(';'); continue; }
    if (c === '&' && n === '&') { pushSeg('&&'); i++; continue; }
    if (c === '|' && n === '|') { pushSeg('||'); i++; continue; }
    if (c === '|') { pushSeg('|'); if (n === '&') i++; continue; }
    if (c === '&' && n !== '>') { pushSeg('&'); continue; }
    tok += c; hadTok = true;
  }
  pushSeg(null);
  return segs;
}

// Nested commands: $(...), `...`, <(...), bash -c "...", pwsh -Command "...", eval "..."
function nestedCommands(raw, segs) {
  const out = [];
  for (const m of raw.matchAll(/\$\(([^()]*)\)|`([^`]*)`|<\(([^()]*)\)/g)) out.push(m[1] ?? m[2] ?? m[3]);
  for (const { tokens } of segs) {
    const prog = baseProg(tokens);
    const t = tokens.slice(prog.idx);
    const p = prog.name;
    if (/^(ba|z|da|k)?sh$/.test(p)) {
      const i = t.findIndex((x) => /^-\w*c\w*$/.test(x));
      if (i >= 0 && t[i + 1]) out.push(t[i + 1]);
    }
    if (/^(pwsh|powershell)(\.exe)?$/.test(p)) {
      const i = t.findIndex((x) => /^-(c|command|encodedcommand|e|ec)$/i.test(x));
      if (i >= 0 && t[i + 1]) out.push(t.slice(i + 1).join(' '));
    }
    if (p === 'eval' || p === 'invoke-expression' || p === 'iex') out.push(t.slice(1).join(' '));
  }
  return out;
}

const WRAPPERS = new Set(['sudo', 'doas', 'env', 'nohup', 'time', 'timeout', 'nice', 'stdbuf', 'command', 'builtin', 'exec', 'xargs', 'noglob', 'call', '&', '.']);
function baseProg(tokens) {
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) { i++; continue; }      // VAR=value
    const name = t.replace(/\\/g, '/').split('/').pop().toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '');
    if (WRAPPERS.has(name)) {
      i++;
      if (name === 'timeout' && tokens[i] && /^\d/.test(tokens[i])) i++;
      while (tokens[i] && tokens[i].startsWith('-')) i++;            // wrapper flags
      continue;
    }
    return { name, idx: i };
  }
  return { name: '', idx: tokens.length };
}

const GIT_OPTS_WITH_ARG = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']);
function gitSub(args) {
  // args: tokens after "git"; returns { sub, rest, globals }
  const globals = [];
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) {
    const a = args[i];
    globals.push(a);
    if (GIT_OPTS_WITH_ARG.has(a)) { globals.push(args[i + 1] || ''); i += 2; } else i++;
  }
  return { sub: (args[i] || '').toLowerCase(), rest: args.slice(i + 1), globals };
}

const DOWNLOADERS = /^(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod|fetch|aria2c)$/;
const EXEC_SINKS = /^((ba|z|da|k)?sh|node|deno|bun|python3?|perl|ruby|iex|invoke-expression|pwsh|powershell)$/;

function checkShell(cmd, depth = 0) {
  const findings = [];
  const add = (decision, reason) => findings.push({ decision, reason });
  const raw = String(cmd || '');
  const segs = tokenize(raw);

  // Download piped into an interpreter anywhere in the command (curl ... | sh, iwr ... | iex, bash <(curl ...))
  const progs = segs.map((s) => baseProg(s.tokens).name);
  if ((progs.some((p) => DOWNLOADERS.test(p)) && progs.some((p) => EXEC_SINKS.test(p))) || /<\(\s*(curl|wget|iwr|irm)\b/i.test(raw))
    add(DENY, 'download piped/fed into an interpreter (curl|sh, iwr|iex)');
  if (/\b(iex|invoke-expression)\b[\s\S]*\b(iwr|irm|invoke-webrequest|invoke-restmethod|downloadstring|net\.webclient)\b/i.test(raw))
    add(DENY, 'PowerShell download-and-execute');

  // Redirect targets (> file, >> file, Out-File, Set-Content)
  for (const m of raw.matchAll(/(?:^|[^0-9&>])>{1,2}\s*([^\s;&|<>]+)/g)) {
    const target = m[1].replace(/^["']|["']$/g, '');
    if (target === '/dev/null' || /^&\d$/.test(target) || target.toLowerCase() === '$null') continue;
    if (isProtectedPath(target)) add(DENY, `redirect writes to protected path ${target}`);
    if (isSecretPath(target)) add(DENY, `redirect writes to secret file ${target}`);
  }
  for (const m of raw.matchAll(/<\s*([^\s;&|<>(]+)/g)) {
    if (isSecretPath(m[1])) add(DENY, `input redirect from secret file ${m[1]}`);
  }

  for (const { tokens } of segs) {
    const { name: p, idx } = baseProg(tokens);
    const args = tokens.slice(idx + 1);
    const lower = args.map((a) => a.toLowerCase());
    const pre = tokens.slice(0, idx);

    // env-var tricks that disable git hooks
    if (pre.some((t) => /^HUSKY=0$/i.test(t)) || /\$env:HUSKY\s*=\s*['"]?0/i.test(raw))
      add(DENY, 'HUSKY=0 disables git hooks');

    // secrets mentioned as arguments of ANY program (cat .env, type .env, Get-Content .env, node -e readFileSync('.env'))
    const isMessageCmd = p === 'git' && /^(commit|tag|notes)$/.test(gitSub(args).sub); // commit messages may mention ".env"
    for (const a of isMessageCmd ? [] : args) {
      for (const piece of a.split(/[\s'"(),=:;]+/)) {
        if (piece && isSecretPath(piece)) { add(DENY, `command references secret file ${piece}`); break; }
      }
    }

    // dumping the environment
    if ((p === 'env' && args.length === 0) || p === 'printenv' || p === 'set' && args.length === 0 ||
        (/^(get-childitem|gci|ls|dir)$/.test(p) && lower.some((a) => /^env:/.test(a))) || p === 'export' && lower[0] === '-p')
      add(ASK, 'dumps environment variables (may contain secrets)');

    // --no-verify anywhere
    if (lower.includes('--no-verify')) add(DENY, '--no-verify skips git hooks');

    if (p === 'git') {
      const { sub, rest, globals } = gitSub(args);
      const r = rest.map((x) => x.toLowerCase());
      const gl = globals.join(' ').toLowerCase();
      if (/core\.(hookspath|fsmonitor|sshcommand|pager|editor)|alias\./.test(gl)) add(DENY, 'git -c override of hooks/exec config');
      if (sub === 'push') add(DENY, 'git push is reserved for humans');
      if (sub === 'branch' && (rest.some((x) => /^-[a-zA-Z]*D/.test(x)) || (r.includes('--delete') && (r.includes('--force') || r.includes('-f')))))
        add(DENY, 'git branch -D (force delete)');
      if (sub === 'reset' && r.includes('--hard')) add(DENY, 'git reset --hard');
      if (sub === 'clean' && r.some((x) => /^-[a-z]*f/.test(x) || x === '--force')) add(DENY, 'git clean -f');
      if (sub === 'commit' && rest.some((x) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(x) && !x.startsWith('--'))) add(DENY, 'git commit -n (= --no-verify)');
      if (sub === 'config') {
        if (r.some((x) => /core\.hookspath|core\.fsmonitor|core\.sshcommand|^alias\./.test(x))) add(DENY, 'git config of hooksPath/fsmonitor/sshCommand/alias');
        else if (!r.some((x) => /^(--get|--get-all|--get-regexp|--list|-l|get|list)$/.test(x))) add(ASK, 'git config change');
      }
      if ((sub === 'checkout' || sub === 'restore') && (r.includes('.') || r.includes('--') && r.includes('.'))) add(ASK, 'discards working tree changes');
      if (sub === 'stash' && /^(drop|clear)$/.test(r[0] || '')) add(ASK, 'git stash drop/clear');
      if (sub === 'filter-branch' || sub === 'filter-repo' || (sub === 'update-ref' && r.includes('-d'))) add(DENY, 'history rewrite');
    }

    // rm -rf / Remove-Item -Recurse -Force / rimraf
    if (p === 'rm') {
      const flags = lower.filter((a) => a.startsWith('-')).join(' ');
      const rec = /(^|\s)-[a-z]*r|--recursive/.test(flags);
      const force = /(^|\s)-[a-z]*f|--force/.test(flags);
      if (rec && force) add(DENY, 'rm -rf');
      else if (rec) add(ASK, 'recursive rm');
    }
    if (/^(remove-item|ri|rd|rmdir|del|erase)$/.test(p) && lower.some((a) => /^-r(ecurse)?$|^\/s$/.test(a))) add(DENY, 'recursive Remove-Item / rd /s');
    if (p === 'rimraf' || p === 'del-cli') add(ASK, 'recursive delete tool');

    // package managers: new dependencies / remote code execution
    if (/^(npm|pnpm|yarn|bun|cnpm)$/.test(p)) {
      const sub = (lower.find((a) => !a.startsWith('-')) || '');
      const after = args.slice(args.findIndex((a) => a.toLowerCase() === sub) + 1).filter((a) => !a.startsWith('-'));
      const remoteExec = sub === 'dlx' || (p === 'npm' && (sub === 'exec' || sub === 'x')) || (p === 'bun' && sub === 'x');
      if (sub === 'add' || remoteExec)
        add(ASK, `${p} ${sub}: adds or executes a package from the registry`);
      if (['install', 'i', 'in', 'isntall'].includes(sub) && after.length > 0)
        add(ASK, `${p} ${sub} <pkg>: adds a new dependency`);
      if (['publish', 'unpublish', 'deprecate', 'owner', 'token', 'login', 'adduser'].includes(sub))
        add(DENY, `${p} ${sub} touches the registry account`);
      if (sub === 'config' && lower.some((a) => /set|delete/.test(a))) add(ASK, `${p} config change`);
    }
    if (p === 'npx' || p === 'bunx' || p === 'pnpx') add(ASK, `${p}: executes a package from the registry`);
    if (p === 'corepack' && lower[0] !== 'enable') add(ASK, 'corepack change');

    // writes to protected files from shell (sed -i, tee, mv, cp, rm, chmod, Set-Content ...)
    if (/^(rm|mv|cp|tee|sed|perl|chmod|chown|ln|truncate|install|touch|set-content|add-content|out-file|remove-item|move-item|copy-item|new-item|rename-item|sc|ac|mi|cpi|ni|ri)$/.test(p)) {
      for (const a of args) if (isProtectedPath(a)) { add(DENY, `${p} modifies protected path ${a}`); break; }
    }
    if (p === 'git' && /^(checkout|restore|rm|mv)$/.test(gitSub(args).sub)) {
      for (const a of args) if (isProtectedPath(a)) { add(DENY, `git modifies protected path ${a}`); break; }
    }
  }

  if (depth < 3) for (const inner of nestedCommands(raw, segs)) findings.push(...checkShell(inner, depth + 1));
  return findings;
}

function checkFileTool(tool, input) {
  const findings = [];
  const paths = [input.file_path, input.notebook_path, input.path, input.glob, input.pattern && tool === 'Glob' ? input.pattern : undefined].filter(Boolean);
  for (const p of paths) {
    if (isSecretPath(p) || /\.env(\*|\.\*|$)/i.test(norm(p))) findings.push({ decision: DENY, reason: `${tool} on secret path ${p}` });
  }
  if (['Edit', 'Write', 'NotebookEdit', 'MultiEdit'].includes(tool)) {
    for (const p of paths) if (isProtectedPath(p)) findings.push({ decision: DENY, reason: `${tool} on protected path ${p} (edit it by hand)` });
  }
  return findings;
}

async function main() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  const ev = JSON.parse(data);
  const tool = ev.tool_name || '';
  const input = ev.tool_input || {};
  let findings = [];
  if (tool === 'Bash' || tool === 'PowerShell' || tool === 'Monitor') findings = checkShell(input.command);
  else findings = checkFileTool(tool, input);

  const deny = findings.find((f) => f.decision === DENY);
  if (deny) {
    process.stderr.write(`Blocked by .claude/hooks/guard.mjs: ${deny.reason}. Ask the human to do this manually if it is really needed.\n`);
    process.exit(2);
  }
  const ask = findings.find((f) => f.decision === ASK);
  if (ask) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `guard.mjs: ${ask.reason}` },
    }));
  }
  process.exit(0);
}

main().catch((e) => {
  // fail closed: malformed input or a bug blocks the call instead of silently allowing it
  process.stderr.write(`guard.mjs failed (${e && e.message}); blocking the tool call to be safe.\n`);
  process.exit(2);
});
```

---

## 4. MCP: риски и настройки

Источники: https://code.claude.com/docs/en/mcp, https://code.claude.com/docs/en/managed-mcp, https://code.claude.com/docs/en/security [V]

- `.mcp.json` (project scope) в интерактивной сессии требует **отдельного одобрения**. В `claude -p`, SDK и cloud-сессиях серверы из `.mcp.json` **подключаются без вопроса**.
- `enableAllProjectMcpServers` и `enabledMcpjsonServers`, закоммиченные в `.claude/settings.json`, **игнорируются в недоверенной папке** ("A cloned repository can't approve its own servers"). Одобрения учитываются из user settings, managed и `--settings`. В коммитимом файле ставьте `enableAllProjectMcpServers: false` (явная декларация) и **не** перечисляйте `enabledMcpjsonServers`.
- `disabledMcpjsonServers` из **любого** файла отклоняет сервер. Это также рекомендованная защита для `claude -p` в чужих репозиториях. `claude mcp reset-project-choices` сбрасывает одобрения.
- Managed: `allowedMcpServers` / `deniedMcpServers` с записями `{ "serverUrl": "https://mcp.figma.com/*" }`, `{ "serverCommand": ["npx","-y","pkg"] }`, `{ "serverName": "x" }`. **`serverName` — не контроль безопасности** (имя задаёт пользователь). Denylist побеждает всегда и сливается из всех scope. `allowManagedMcpServersOnly: true` (только managed) делает managed-allowlist единственным. `managed-mcp.json` (Windows: `C:\Program Files\ClaudeCode\managed-mcp.json`) даёт эксклюзивный контроль, `{"mcpServers":{}}` отключает MCP. `strictPluginOnlyCustomization` разрешает только серверы из плагинов.
- MCP-серверы **работают вне песочницы**. Anthropic "does not security-audit or manage any MCP server". Совет: "Servers that fetch external content can expose you to prompt injection risk".
- **Figma:** официальный remote-сервер `https://mcp.figma.com/mcp`, OAuth; установка `claude mcp add --transport http figma https://mcp.figma.com/mcp` или плагин `figma@claude-plugins-official` [V] https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/. Официальных рекомендаций Figma по prompt injection я **не нашёл** [U]. Известная уязвимость относится к **стороннему** `figma-developer-mcp` (Framelink), CVE-2025-53967, command injection, исправлена [U, вторичные источники: https://thehackernews.com/2025/10/severe-figma-mcp-vulnerability-lets.html, https://osv.dev/vulnerability/GHSA-gxw4-4fc5-9gr5]. Практически: текстовые слои, имена компонентов и описания в Figma-файле — **недоверенный ввод**, такой же, как веб-страница. Не давайте агенту одновременно читать Figma/веб и выполнять неподтверждённые `Bash`/`git`/сетевые действия. Write-инструменты Figma (`use_figma`, `create_*`) держите в `ask`.
- **Prompt injection, общее:** Claude Code защищает через permission system, запрет авто-одобрения `curl`/`wget`, WebFetch с суммаризацией отдельной моделью (Claude получает ответ, а не сырую страницу), workspace trust, детекцию неразбираемых команд и fail-closed для несматченных команд. Рекомендации: проверять команды, "Avoid piping untrusted content directly to Claude", "Use virtual machines (VMs) to run scripts and make tool calls, especially when interacting with external web services". [V] https://code.claude.com/docs/en/security. Anthropic подчёркивает, что "prompt injection is far from a solved problem, particularly as models take more real-world actions" [V-вторично, через поиск] https://www.anthropic.com/research/prompt-injection-defenses
- **Windows-специфика:** не включать WebDAV и не давать доступ к `\\*`-путям, потому что это позволяет обойти систему разрешений сетевыми запросами. Чтения по UNC-путям всегда спрашивают (v2.1.292+). [V] security, permissions#network-paths

---

## 5. Черновик `.claude/settings.json` для frontend-boilerplate (pnpm + git + node)

Валидирован как JSON (`JSON.parse`). Предполагается, что хук лежит в `.claude/hooks/guard.mjs`.

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "defaultMode": "default",
    "disableBypassPermissionsMode": "disable",
    "allow": [
      "Bash(pnpm install --frozen-lockfile)",
      "Bash(pnpm install)",
      "Bash(pnpm run lint *)",
      "Bash(pnpm run typecheck *)",
      "Bash(pnpm run test *)",
      "Bash(pnpm run build *)",
      "Bash(pnpm run format *)",
      "Bash(pnpm lint *)",
      "Bash(pnpm typecheck *)",
      "Bash(pnpm test *)",
      "Bash(pnpm build *)",
      "Bash(pnpm exec tsc *)",
      "Bash(pnpm exec eslint *)",
      "Bash(pnpm exec prettier *)",
      "Bash(pnpm exec vitest *)",
      "Bash(pnpm --version)",
      "Bash(node --version)",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git show *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git switch *)",
      "Bash(git stash push *)",
      "Bash(git stash list *)",
      "Bash(git fetch *)",
      "PowerShell(pnpm run lint *)",
      "PowerShell(pnpm test *)",
      "PowerShell(git status *)",
      "PowerShell(git diff *)",
      "PowerShell(git log *)",
      "WebFetch(domain:code.claude.com)",
      "WebFetch(domain:developer.mozilla.org)",
      "WebFetch(domain:vite.dev)",
      "WebFetch(domain:react.dev)",
      "WebFetch(domain:typescriptlang.org)",
      "WebFetch(domain:www.typescriptlang.org)"
    ],
    "ask": [
      "Bash(dangerouslyDisableSandbox:true)",
      "Bash(pnpm add *)",
      "Bash(pnpm remove *)",
      "Bash(pnpm update *)",
      "Bash(pnpm up *)",
      "Bash(pnpm dlx *)",
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(yarn *)",
      "Bash(git merge *)",
      "Bash(git rebase *)",
      "Bash(git checkout *)",
      "Bash(git restore *)",
      "Bash(git stash drop *)",
      "Bash(git stash clear *)",
      "Bash(git tag *)",
      "Bash(git config *)",
      "Bash(git remote *)",
      "Bash(git branch *)",
      "Bash(curl *)",
      "Bash(wget *)",
      "Bash(bash *)",
      "Bash(sh *)",
      "Bash(env)",
      "Bash(printenv *)",
      "PowerShell(pnpm add *)",
      "PowerShell(npm *)",
      "PowerShell(npx *)",
      "PowerShell(Invoke-WebRequest *)",
      "PowerShell(Invoke-RestMethod *)",
      "PowerShell(Remove-Item *)",
      "PowerShell(git config *)",
      "PowerShell(git checkout *)",
      "PowerShell(git restore *)",
      "PowerShell(git branch *)"
    ],
    "deny": [
      "Read(.env)",
      "Read(.env.*)",
      "Read(!.env.example)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Read(**/*.p12)",
      "Read(**/*.pfx)",
      "Read(secrets/**)",
      "Read(~/.ssh/**)",
      "Read(~/.aws/**)",
      "Read(~/.config/gh/**)",
      "Read(~/.npmrc)",
      "Read(~/.netrc)",
      "Read(~/.git-credentials)",
      "Edit(.husky/**)",
      "Edit(/.claude/settings.json)",
      "Edit(/.claude/settings.local.json)",
      "Edit(/.claude/hooks/**)",
      "Edit(/.mcp.json)",
      "Edit(/.git/**)",
      "Edit(/.npmrc)",
      "Edit(/pnpm-lock.yaml)",
      "Bash(git push *)",
      "Bash(git reset --hard *)",
      "Bash(git clean *)",
      "Bash(git branch -D *)",
      "Bash(git branch --delete --force *)",
      "Bash(git config core.hooksPath *)",
      "Bash(git config --local core.hooksPath *)",
      "Bash(git config --global core.hooksPath *)",
      "Bash(git filter-branch *)",
      "Bash(* --no-verify *)",
      "Bash(* --no-verify)",
      "Bash(HUSKY=0 *)",
      "Bash(rm -rf *)",
      "Bash(rm -fr *)",
      "Bash(rm -Rf *)",
      "Bash(sh)",
      "Bash(bash)",
      "Bash(npm publish *)",
      "Bash(pnpm publish *)",
      "Bash(npm login *)",
      "Bash(npm token *)",
      "PowerShell(git push *)",
      "PowerShell(git reset --hard *)",
      "PowerShell(git clean *)",
      "PowerShell(git branch -D *)",
      "PowerShell(Invoke-Expression *)",
      "PowerShell(* --no-verify *)",
      "PowerShell(* --no-verify)"
    ]
  },
  "enableAllProjectMcpServers": false,
  "sandbox": {
    "enabled": true,
    "allowUnsandboxedCommands": false,
    "filesystem": {
      "denyRead": ["~/.ssh", "~/.aws", "~/.config/gh", "~/.npmrc", "~/.netrc", "~/.git-credentials"]
    },
    "credentials": {
      "files": [
        { "path": "~/.ssh", "mode": "deny" },
        { "path": "~/.aws/credentials", "mode": "deny" },
        { "path": "~/.npmrc", "mode": "deny" }
      ],
      "envVars": [
        { "name": "GITHUB_TOKEN", "mode": "deny" },
        { "name": "GH_TOKEN", "mode": "deny" },
        { "name": "NPM_TOKEN", "mode": "deny" },
        { "name": "NODE_AUTH_TOKEN", "mode": "deny" },
        { "name": "FIGMA_ACCESS_TOKEN", "mode": "deny" }
      ]
    },
    "network": {
      "allowedDomains": ["registry.npmjs.org"]
    }
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell|Monitor|Read|Edit|Write|NotebookEdit|Grep|Glob",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/guard.mjs"],
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

### 5.1 Что защищает каждый блок и чего НЕ защищает

| Блок | Защищает | НЕ защищает |
|---|---|---|
| `defaultMode: "default"` | В терминале сессии стартуют в Manual, а не в auto | VS Code-расширение не читает project settings для стартового режима. Пользователь может вручную переключиться в auto (Shift+Tab). Запретить можно только через `disableAutoMode` [U ключ] / managed |
| `disableBypassPermissionsMode: "disable"` | Нельзя включить `--dangerously-skip-permissions` в этом репо | Это проектный файл: его можно отредактировать (правда, `.claude/` — protected path, и есть Edit-deny + хук). Надёжно — только через managed |
| `allow` | Убирает «усталость от запросов» на безопасных командах | Применяется **только после workspace trust**. `pnpm run build/test` выполняет **произвольный код** из `package.json`/конфигов, которые агент может править. `git commit` запустит husky-хуки |
| `ask` | Запрос на добавление зависимостей, сетевые утилиты, переписывание истории, `dangerouslyDisableSandbox` | Матч по тексту: обходится через `sh -c`, абсолютные пути и т. п. (поэтому дублируется хуком) |
| `deny: Read(...)` | Встроенные Read/Grep/Glob, `@`-упоминания, `cat .env` и редиректы в Bash. Сливается в sandbox `denyRead` (где sandbox работает) | `grep -r . `, Node/Python-скрипты, `vite`/тесты, читающие `.env` сами. **На нативном Windows нет ОС-уровня** |
| `deny: Edit(...)` | Правка husky, настроек Claude, хуков, `.git`, `.mcp.json`, lockfile инструментами Edit/Write | Запись через произвольный скрипт (частично ловит хук). Человек может править сам |
| `deny: Bash/PowerShell(...)` | Типичные формы `git push`, `reset --hard`, `clean`, `branch -D`, `--no-verify`, `rm -rf`, `HUSKY=0`, `\| sh` | Документированные обходы (`git -C . push`, `/bin/rm`, `bash -c`); их ловит хук, но тоже эвристически. **Права на push лучше убрать на стороне GitHub** (branch protection, отсутствие токена) |
| `enableAllProjectMcpServers: false` | Явно: серверы `.mcp.json` не одобряются оптом | `claude -p`/SDK подключают `.mcp.json` без вопроса. Пользовательские/плагинные MCP (Figma) этим не управляются |
| `sandbox.*` | На macOS/Linux/WSL2: ОС-уровневый запрет чтения `~/.ssh` и т. п., запрет сети кроме npm registry, вычистка токенов из env, без unsandboxed-ретраев | **На нативном Windows: ничего** (sandbox не стартует, команды без изоляции). Хуки/MCP/Read/WebFetch вне sandbox. `github.com` не в allowlist, поэтому `git fetch` спросит домен (компромисс против эксфильтрации). `credentials.mask` и `strictAllowlist` из project settings игнорируются |
| `hooks.PreToolUse` | Второй слой над правилами: нормализует пути Windows, ловит обходы `git -C`, кавычки, `bash -c`, `$(...)`, PowerShell-формы | Текстовая эвристика. Таймаут хука не блокирует (нужен `onFailure: "block"` с v2.1.295). Не видит `@`-файлы. Отключается `disableAllHooks` с более высокого уровня (local/CLI) |

### 5.2 Что положить в user / managed (вне репозитория)
`~/.claude/settings.json` разработчика или, лучше, managed:
```json
{
  "permissions": {
    "disableBypassPermissionsMode": "disable",
    "deny": ["Read(//**/.env)", "Read(//**/.env.*)", "Read(~/.ssh/**)", "Read(~/.aws/**)"]
  },
  "sandbox": { "allowUnsandboxedCommands": false }
}
```
Только managed (`C:\Program Files\ClaudeCode\managed-settings.json` или HKLM), если нужно, чтобы ни репозиторий, ни пользователь не могли ослабить политику: `allowManagedPermissionRulesOnly`, `allowManagedHooksOnly` (тогда guard-хук нужно перенести в managed), `allowManagedMcpServersOnly` + `allowedMcpServers`, `sandbox.network.allowManagedDomainsOnly`, `strictKnownMarketplaces`. `failIfUnavailable: true` раздавать **только на macOS/Linux/WSL2-машины**.

### 5.3 Рекомендации для Windows 11 + Git Bash (позиция пользователя)
1. Для автономной или «длинной» работы агента запускать Claude Code **в WSL2** (sandbox работает) или в **devcontainer** (официальная референс-конфигурация с `init-firewall.sh`, default-deny egress) [V] https://code.claude.com/docs/en/devcontainer. Не монтировать `~/.ssh` и облачные креды в контейнер.
2. На нативном Windows полагаться на: Manual-режим, deny-правила, guard-хук, отсутствие push-токенов у агента и branch protection на GitHub.
3. Задать `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` **в окружении запуска** (вычищает креды из env Bash, хуков и stdio-MCP; GitHub-токены и прокси оставляет). Его работа без sandbox [U]: в описании сказано «regardless of sandboxing», но сохраняется ли эффект в project `env`, не проверено.
4. Секреты держать вне репозитория. `.env` — только как `.env.example` в git.

---

## 6. Непроверенное / открытые вопросы
- [U] Точное имя ключа `disableAutoMode` (top-level или `permissions.disableAutoMode`): доки расходятся.
- [U] Работают ли относительные wildcard-пути вида `./**/.env` в `sandbox.filesystem.denyRead`. В черновике вместо этого использованы `Read`-deny (они сливаются в sandbox) и абсолютные `~/`-пути.
- [U] Поведение неизвестного поля `onFailure` на версиях < v2.1.295 (не добавлено в черновик; добавить после проверки `claude --version`).
- [U] Официальная позиция Figma по prompt injection в MCP.
- [U] Применяется ли `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` из project `env`-блока.
