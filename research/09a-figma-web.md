# 09a — Figma → pixel-perfect web: исследование (web)

Status: done

## Resume notes
- Начато 2026-10-14. Разделы 1–7 по заданию.
- Готово: все разделы 1–7 + раздел 8 (итоговые рекомендации). Открытые вопросы: точный лимит MCP для View/Collab (docs 20/мес vs README плагина 6/мес); формат нативного экспорта Figma (DTCG или нет) проверить на реальном файле; Medium-статья (403) не прочитана.
- Локальный источник: установленный плагин `figma@claude-plugins-official` v2.2.120 в `~/.claude/plugins/cache/claude-plugins-official/figma/2.2.120/` (README.md, skills/*/SKILL.md) — использован как первичный источник по skills.

---

## 1. Figma MCP server (официальный)

### 1.1 Remote vs Desktop

| | Remote | Desktop |
|---|---|---|
| Endpoint | `https://mcp.figma.com/mcp` (streamable HTTP, OAuth в браузере) | `http://127.0.0.1:3845/mcp` |
| Требует desktop-приложение | нет | да, последняя версия; Dev Mode (Shift+D) → Inspect → "Enable desktop MCP server" |
| Как указывать узел | только ссылкой на frame/layer (`?node-id=`) | текущим selection в приложении или ссылкой (из ссылки берётся node-id) |
| Набор tools | "broadest set of features": все read + write (`use_figma`, `generate_figma_design`, `create_new_file`, `upload_assets`, `generate_diagram`), `search_design_system`, `get_libraries`, `download_assets`, `whoami` | read-набор: `get_design_context`, `get_metadata`, `get_screenshot`, `get_variable_defs`, `get_figjam`, `get_code_connect_map`, `add_code_connect_map`, prompt `create_design_system_rules` (полный список для обычного desktop не опубликован — список дан для Figma for Government) |
| Настройки ассетов | ассеты отдаются временными URL / через `download_assets` | Image settings: "Local server" (ссылки на localhost в разметке) или "Download assets" (пишет файлы в проект); тумблер "Enable Code Connect" |
| Позиционирование Figma | рекомендуемый | "for specific organization and enterprise needs" |

Источники: https://developers.figma.com/docs/figma-mcp-server/ , https://developers.figma.com/docs/figma-mcp-server/local-server-installation/ , https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/

Вывод для CI/агентов: remote удобнее (не нужен запущенный Figma desktop на машине агента), но авторизация OAuth интерактивная — для headless CI MCP не подходит; в CI использовать REST API с PAT (см. разд. 3, 5). Подключаются только клиенты из "Figma MCP Catalog" (Claude Code в нём есть).

### 1.2 План/seat и rate limits (на 2026-10)

Таблица с https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/ :

| Seat | Starter | Professional | Organization | Enterprise |
|---|---|---|---|---|
| View, Collab | 20 вызовов/месяц | 20/мес | 20/мес | 20/мес |
| Dev, Full | (фактически как Starter-лимит) | 200/день, 10/мин | 200/день, 15/мин | 600/день, 20/мин |

- Education = Professional-лимиты.
- Исключены из лимитов: `add_code_connect_map`, `create_new_file`, `whoami`, `generate_figma_design` ("Some tools, such as those that write to Figma files, are exempt").
- ⚠ Расхождение: README плагина v2.2.120 и ряд обзоров (chatforest, Replit docs) говорят "up to 6 tool calls per month" для Starter/View/Collab; текущая страница docs — 20/мес. Считать 6–20/мес, т.е. **для реальной работы нужен Dev или Full seat на платном плане** (Professional Dev seat — самый дешёвый вариант).
- Лимит зависит и от плана команды, владеющей файлом: Full seat в Pro-команде получает Starter-лимиты, если файл лежит в Starter-команде (ответ на форуме, июнь 2026: https://forum.figma.com/ask-the-community-7/rate-limit-issue-on-professional-dev-seat-55255 ). Перенести/дублировать файл в платную команду.
- Write-to-canvas: "will eventually be a usage-based paid feature, but is currently available for free during the beta" (README плагина). `generate_image` тратит Figma AI credits.
- 200 вызовов/день на Pro — реальное ограничение для агента: одна страница = `get_metadata` + N×`get_design_context` + `get_screenshot` + `get_variable_defs` ≈ 5–20 вызовов. Кешировать ответы в репо (см. рекомендации).

### 1.3 Инструменты (remote, актуальный список)

Источник: https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/ + `.mcp.json` плагина v2.2.120.

Read (design→code):
- `get_design_context` (бывш. `get_code`) — структурированное представление выделения/узла; **по умолчанию React + Tailwind**. Другой стек — просьбой в промпте ("plain HTML + CSS", "Vue", "use components from src/components/ui"); для Code Connect на remote — параметр `clientFrameworks` (точная метка, напр. `React`). Может включать скриншот (skill требует запрашивать его в первом же вызове), ссылки на ассеты, данные Code Connect, флаг "sparse" для больших узлов. Параметр `skillNames` — только логирование. Явно предупреждение docs: "large context size".
- `get_metadata` — разреженный XML: id, name, type, x/y, width/height; без `nodeId` — список страниц. Использовать первым на больших фреймах.
- `get_screenshot` — PNG выделения (`enableBase64Response`). Это визуальная цель для агента.
- `get_variable_defs` — переменные и стили, **использованные в выделении** (цвета, spacing, typography) — имя→значение. Не экспорт всей коллекции.
- `download_assets` (remote) — экспорт PNG/JPG/SVG/PDF и исходных растров; `defaultScale` 0.01–4; до 20 узлов/raw images за вызов (`rawImagesTruncated: true`); без export settings при scale 1 рендер ограничен ~4096 px по длинной стороне.
- `get_motion_context` — keyframes, CSS `@keyframes`, сниппеты motion.dev (skill `figma-implement-motion`).
- `get_figjam` — FigJam → XML + скриншоты.

Design system / Code Connect:
- `search_design_system` (remote) — поиск компонентов/переменных/стилей в подключённых библиотеках, массив `queries`.
- `get_libraries` (remote).
- `get_code_connect_map` — node id инстансов → компонент кода (name, source, snippet, version, label); `clientFrameworks`, `clientLanguages`.
- `add_code_connect_map`, `get_code_connect_suggestions`, `send_code_connect_mappings`, `get_context_for_code_connect` (последние три — "Figma-prompted", не для прямого вызова).

Write (remote only): `use_figma` (общий JS Plugin API: создание/правка узлов, переменных, компонентов; skill `figma-use` обязателен), `generate_figma_design` (живой web UI → слои Figma; без лимитов), `create_new_file`, `upload_assets` (≤10 MB), `generate_diagram` (Mermaid → FigJam), `generate_image`.
Прочее: shaders/generative plugins tools, `whoami` (email, планы, seat), Weave-инструменты (отдельный платный аккаунт).
Prompt: `create_design_system_rules` — генерирует rules-файл для агента (сохранять в `rules/`/CLAUDE.md). MCP prompts поддерживаются не всеми клиентами.

### 1.4 Официальный плагин для Claude Code

- Установка: `claude plugin install figma@claude-plugins-official` (или вручную `claude mcp add --transport http figma https://mcp.figma.com/mcp`). Источник: README в https://github.com/figma/mcp-server-guide (локально v2.2.120).
- Skills (beta): `figma-design-to-code`, `figma-code-connect`, `figma-use`, `figma-generate-design`, `figma-generate-library`, `figma-implement-motion`, `figma-swiftui`, `figma-create-new-file`, `figma-generate-diagram`, `figma-shaders`, `figma-generative-plugins`, `figma-use-figjam/-slides/-motion`; workflow-skills `generate-project-plan`, `video-interaction-mapper`.
- Ключевые правила `figma-design-to-code` (SKILL.md, 28 строк) — полезны как готовый контракт для нашего пайплайна:
  - всегда брать скриншот в первом `get_design_context`; если нет — `get_screenshot`;
  - если ответ помечен как **sparse** — сопоставить child node IDs со скриншотом и параллельно запросить детей `get_design_context`;
  - реализовывать только по high-fidelity ответам; скриншот — цель, не ассет;
  - "treat returned code as a high visual fidelity non-interactive prototype — **translate raw absolute positioning into project-native layout**";
  - переиспользовать компоненты/токены проекта и Code Connect;
  - все ассеты скачать локально, никаких временных Figma URL; не переопределять width/height корня SVG;
  - верификация: проверить каждый ассет (файл, слот, call site, геометрия рендера).
- Официальный шаблон rules из README: get_design_context → (если усечено) get_metadata → точечные get_design_context → get_screenshot → ассеты → перевод под конвенции → "Validate against Figma for 1:1 look".

### 1.5 Известные проблемы
- **Объём ответа**: большой фрейм → медленно/ошибки/неполный ответ (README: "Large selections can slow the tools down, cause errors, or result in incomplete responses"). Лечится get_metadata + запрос по секциям. В Claude Code лимит вывода MCP-инструмента: по умолчанию 25 000 токенов, предупреждение с 10 000 (фиксировано), меняется `MAX_MCP_OUTPUT_TOKENS` (напр. 50000); текстовый результат >50 000 символов сохраняется в файл; инструменты с `anthropic/maxResultSizeChars` используют своё значение, изображения всегда под `MAX_MCP_OUTPUT_TOKENS` (https://code.claude.com/docs/en/mcp ). В отчёте buildmvpfast один крупный файл дал ~657k оценочных токенов.
- **Абсолютное позиционирование**: код генерируется из геометрии; для узлов без auto-layout получается `absolute`/`left/top`. Сам skill Figma требует переводить это в flex/grid. Качество напрямую зависит от того, свёрстан ли макет auto-layout'ом.
- **Tailwind по умолчанию**, включая arbitrary values (`w-[343px]`, `text-[#1a1a1a]`) — нужна пост-трансформация в токены проекта; `get_variable_defs` даёт имена переменных, чтобы заменить хардкод.
- Без Code Connect компоненты дизайн-системы "расплющиваются" в div'ы (обзор chatforest: "Component nesting: Flattened").
- Rate limits (см. 1.2), OAuth (не для CI).

### 1.6 Альтернатива: Framelink (GLips/Figma-Context-MCP)
- npm `figma-developer-mcp`, MIT, ~16k stars; v0.13.2 (2026-06-18). Источники: https://github.com/GLips/Figma-Context-MCP , https://chatforest.com/reviews/framelink-figma-mcp-server/
- Tools: `get_figma_data` (упрощённый JSON/YAML/"tree" с layout+стилями; с v0.13 tree-формат по умолчанию, ~на 50% меньше payload, поддержка CSS Grid) и `download_figma_images`.
- Работает через **REST API с personal access token** (`--figma-api-key` / `FIGMA_API_KEY`), stdio или HTTP; не генерирует код — отдаёт описание, код пишет модель под ваш стек. Сохраняет вложенность компонентов.
- Нет Code Connect, переменных как таковых (видны resolved значения/стили), write-операций.
- ⚠ Rate limits: использует Tier 1 REST endpoints (GET file / file nodes / images). С 2025-11-17 у View/Collab seat Tier 1 = до 20 запросов/месяц (ранее заявлялось 6) — т.е. "бесплатность" Framelink фактически исчезла для пользователей без Dev/Full seat; Dev/Full: 10–20/мин в зависимости от плана (https://developers.figma.com/docs/rest-api/rate-limits/ ). Жалобы на 429: issues #258/#259/#287.
- Безопасность: CVE-2025-53967 (command injection) исправлена в v0.6.3; телеметрия PostHog с v0.10.0 (issue #354 про утечку file keys) — отключать.
- Другие форки (1yhy/Figma-Context-MCP) заявляют автоконвертацию absolute → flex/grid (https://mcpservers.org/servers/1yhy/Figma-Context-MCP ) — не проверено.

Вывод: для пиксель-перфекта основной — официальный remote MCP (скриншот + design context + variables + Code Connect) на Dev seat; Framelink — запасной/дополнительный источник структурированных данных с собственным кешем.

---

## 2. Code Connect

- Что делает: связывает компонент Figma с компонентом кода; в Dev Mode показывается реальный сниппет, а MCP (`get_design_context`, `get_code_connect_map`) возвращает ссылку/сниппет вашего компонента вместо сгенерированной вёрстки — агент вставляет `<Button size="lg">`, а не 40 строк div+Tailwind. Источник: https://developers.figma.com/docs/code-connect/
- **План: Organization или Enterprise, seat Dev или Full.** Professional — нет (https://developers.figma.com/docs/code-connect/ , https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect ). Org: Full $55, Dev $25, Collab $5 за seat/мес при годовой оплате; Enterprise: Full $90, Dev $35 (https://www.figma.com/pricing/ , проверено 2026-10).
- Два способа (https://developers.figma.com/docs/code-connect/comparing-cc ):
  - **Code Connect UI** — маппинг внутри Figma + GitHub-интеграция, one-to-many (один компонент → несколько фреймворков), GA для Org/Enterprise.
  - **Code Connect CLI** (`@figma/code-connect`, `npx figma connect publish`) — файлы в репо, PAT. CLI-связи видны в UI, но редактируются только из CLI. На один компонент — один тип связи.
- Форматы:
  - **Template files** (`*.figma.ts` / `*.figma.js`) — сейчас рекомендуемый, framework-agnostic: метаданные-комментарии (`url`, `source`, `component`), `figma.selectedInstance.getString()/getBoolean()/getEnum()/findInstance()/getSlot()/executeTemplate()`, `export default { example: figma.code\`...\`, imports, id }`; конфиг `figma.config.json` (`codeConnect.include`, `label`, `language`). https://developers.figma.com/docs/code-connect/template-files/
  - **React parser** (`*.figma.tsx`, `figma.connect(Button, url, { props: { size: figma.enum('Size', {...}), label: figma.string('Label'), icon: figma.instance('Icon'), children: figma.children('Tab*') }, example: ... })`) — помечен **legacy**: "Framework-specific parsers will no longer receive updates or support". https://developers.figma.com/docs/code-connect/react/
- Через MCP: `add_code_connect_map` (без лимитов), `get_code_connect_suggestions` → `send_code_connect_mappings`; skill `figma-code-connect` генерирует `.figma.ts`.
- Практическая ценность для небольшой команды:
  - Высокая, если есть своя библиотека компонентов в Figma и в коде и план Org+: снижает "расплющивание" и хардкод, уменьшает размер ответа MCP.
  - Если план Professional — недоступно; замена: собственный маппинг в репо (`docs/figma-map.json`: Figma component key/name → путь компонента + props) + rules в CLAUDE.md; агент читает его сам. Работает с тем же эффектом "используй существующий компонент", но без поддержки Figma.

---

## 3. Figma variables → design tokens

### 3.1 Источники данных и ограничения по планам
| Путь | План | Что получаем | Комментарий |
|---|---|---|---|
| REST `GET /v1/files/:key/variables/local` и `/variables/published` | **только Enterprise**, Full seat, scope `file_variables:read`; гости не могут | все коллекции, моды, алиасы, scopes, codeSyntax | Tier 2 (Dev/Full 25–100/мин). https://developers.figma.com/docs/rest-api/variables/ — подтверждено. `POST /variables` — Enterprise, scope `file_variables:write`. |
| REST `GET /v1/files/:key` (стили) | любой | Styles (color/text/effect) + `boundVariables` на узлах (id без значений) | Tier 1 — у View/Collab всего ~20 запросов/мес (с 2025-11-17). https://developers.figma.com/docs/rest-api/rate-limits/ |
| **Нативный экспорт мод в JSON** (Figma UI: ПКМ на mode → Export / ПКМ на коллекцию → "Export modes") | платные планы с modes (Pro/Org/Ent/Edu) | JSON по модам; импорт — строго **DTCG** (`$extensions.com.figma.*`, cross-collection алиасы через `com.figma.aliasData`; типы: color sRGB/HSL, number, string, boolean; dimension только `px`, duration `s`) | Анонс Schema 2025, раскатка ноябрь–декабрь 2025 (https://forum.figma.com/ask-the-community-7/native-variable-export-feature-47831 , https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables ). ⚠ Ручной шаг дизайнера; формат экспорта в help явно как DTCG не назван — проверить на реальном файле. |
| MCP `get_variable_defs` | Dev/Full seat (rate limits MCP) | только переменные, использованные в выделении (имя→resolved value) | не полный экспорт; годится для проверки, не как источник истины |
| Plugin API (`figma.variables.getLocalVariablesAsync()`), свой плагин или `use_figma` | любой план с переменными | полный доступ к коллекциям/модам/алиасам | Все сторонние экспортёры работают так; агент через remote MCP `use_figma` тоже может выгрузить JSON (write-tool, сейчас бесплатен, без лимитов? — `use_figma` в exempt-список явно не включён). |
| Tokens Studio for Figma | Free / Pro | токены в собственном формате (W3C-подобный/DTCG), sync в GitHub/GitLab/Bitbucket/ADO/URL | Free: single-file sync в GitHub/GitLab; Pro (≈16 €/user/мес по старой странице https://tokens.studio/old/pricing — ⚠ возможно устарело): multi-file sync, ветки, themes→variables. https://docs.tokens.studio/token-storage/remote-multi-file-sync |
| TokensBrücke (плагин) | любой | DTCG-JSON, моды в `$extensions.modes` (v2.0.0) | Рекомендован Terrazzo; push в GitHub. https://github.com/tokens-bruecke/figma-plugin |
| lukasoppermann/design-tokens (плагин) | любой | "Standard" формат на базе раннего DTCG-черновика, variables — beta; отправка в GitHub `repository_dispatch` / commit / GitLab trigger | Почти не поддерживается ("only partially supported"). https://github.com/lukasoppermann/design-tokens |

### 3.2 Трансформаторы
- **DTCG Format 2025.10** — первая стабильная версия спецификации (2025-10-28): https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/ . Расширение файлов `.tokens.json`; не W3C Standards Track. Есть Format/Color/Resolver модули (Resolver — темы/моды).
- **Style Dictionary v5** — основан на DTCG, Node ≥ 22, ссылки только на токены (не на группы), синтаксис `{a.b}` фиксирован. https://styledictionary.com/versions/v5/migration/ . v4 уже поддерживал DTCG (`$value/$type`) и `usesDtcg`.
- **Terrazzo** (бывш. Cobalt UI) — CLI `tz build/check/normalize/import`, плагины `@terrazzo/plugin-css`, `-js`, `-sass`, `-tailwind`; ⚠ CLI помечен beta. `tz import <figma-url>`: Styles на любом плане, **Variables только Enterprise** (`--skip-variables`). https://terrazzo.app/docs/guides/import-from-figma , https://terrazzo.app/docs/cli/commands . `tz check` — валидатор DTCG, удобен в CI.

### 3.3 Рекомендуемый пайплайн без Enterprise
1. Источник истины — **JSON в репо** `tokens/*.tokens.json` (DTCG 2025.10), а не Figma: так делают и автор design-tokens plugin, и Terrazzo.
2. Поступление из Figma (выбрать один):
   - (a) дизайнер нативно экспортирует моды коллекции → кладёт в PR (просто, но ручное);
   - (b) Tokens Studio Free с single-file GitHub/GitLab sync → PR в ветку `tokens/*` (Pro если нужно multi-file/ветки);
   - (c) TokensBrücke → push/PR;
   - (d) агент Claude Code через `use_figma` выполняет скрипт Plugin API, сериализующий коллекции в DTCG (подходит для нашего агентного сценария; не годится для headless CI из-за OAuth).
3. Сборка: `style-dictionary build` (или `tz build`) → `src/styles/tokens.css` (CSS custom properties по модам: `:root`, `[data-theme=dark]`), `tokens.ts`, при необходимости Tailwind v4 `@theme`. Сгенерированное коммитить или собирать в CI — главное детерминизм.
4. Agent-правило: значения в CSS только через `var(--token)`; хардкод цветов/размеров ловит stylelint (`stylelint-declaration-strict-value` / `scale-unlimited/declaration-strict-value`), для Tailwind — запрет arbitrary values (eslint-plugin-tailwindcss `no-arbitrary-value` / Tailwind v4 только theme-токены).

### 3.4 Drift detection в CI
- **Code↔tokens JSON**: job `tokens:check` = `tz check` (валидность DTCG) + `style-dictionary build` + `git diff --exit-code src/styles/tokens.*` (сгенерированное должно совпадать с закоммиченным).
- **Figma↔repo** без Enterprise: периодический (nightly/по запросу) агентный job на машине с OAuth-сессией MCP или ручной ре-экспорт → PR; diff JSON показывает дрейф. С Enterprise — cron в CI: `GET /variables/local` (PAT) → нормализация в DTCG → diff → автоматический PR/issue.
- **Usage drift**: при реализации экрана агент сверяет `get_variable_defs` выделения с `tokens/*.tokens.json` — каждое имя переменной из Figma должно существовать в репо; отсутствующие → ошибка "token missing" вместо хардкода.
- Сравнение — по resolved значениям с нормализацией цвета (hex8 / sRGB с округлением до 1/255) и чисел (px), иначе ложные срабатывания из-за float (Figma хранит цвета float 0..1).

---

## 4. Visual regression tooling (code-vs-code baseline)

### 4.1 Playwright `toHaveScreenshot`
Актуальная версия: **Playwright v1.64.0 (2026-10-07)** — https://github.com/microsoft/playwright/releases
Опции (https://playwright.dev/docs/api/class-pageassertions ):
- `animations: "disabled"` (по умолчанию; конечные CSS-анимации перематываются в финал, бесконечные — в начальное состояние), `caret: "hide"` (по умолчанию), `scale: "css"` (по умолчанию; `"device"` для DPR 2 скриншотов), `fullPage: false`, `omitBackground: false`, `clip`.
- `mask: Locator[]` + `maskColor` (по умолчанию `#FF00FF`) — закрыть динамику (даты, аватары, карты).
- `stylePath` — CSS, применяемый только на время снимка (скрыть курсоры, скроллбары, `* { transition: none !important }`, задать `font-variant-ligatures` и т.п.) — проникает в Shadow DOM и iframes.
- `threshold` — per-pixel цветовой допуск в YIQ, 0..1, **по умолчанию 0.2**; `maxDiffPixels` / `maxDiffPixelRatio` — сколько пикселей может отличаться (по умолчанию 0). Задаются глобально в `expect.toHaveScreenshot` конфига.
- Снимок нестабилен → Playwright делает повторные снимки, пока два подряд не совпадут ("stable screenshot"), затем сравнивает с baseline.
- Новое: v1.62 — хранение baseline в **WebP** (имя `.webp`; quality 100 = lossless); v1.64 — опция `type` в `expect.toHaveScreenshot` (все безымянные снимки в WebP), `--update-snapshots=missing` теперь проходит прогон; режимы `--update-snapshots=all|changed|missing|none` (с 1.50).
- Имена baseline включают браузер и платформу (`-chromium-linux.png`); "Screenshots differ between browsers and platforms due to different rendering, fonts and more" — https://playwright.dev/docs/test-snapshots . Поэтому **baseline генерировать и проверять только в Docker** `mcr.microsoft.com/playwright:v1.64.0-noble` (тег = версия `@playwright/test`), локально — тоже через Docker (`docker run --rm --ipc=host -v $PWD:/work -w /work mcr.microsoft.com/playwright:v1.64.0-noble npx playwright test`). На Windows-машинах разработчиков это обязательно: ClearType/DirectWrite ≠ FreeType.
- Детерминизм: шрифты только self-hosted (`@font-face` из репо, не Google Fonts CDN, `document.fonts.ready` перед снимком), фиксированный viewport и `deviceScaleFactor`, `colorScheme`, `locale`, `timezoneId`, `reducedMotion: 'reduce'`, Chromium-флаги `--font-render-hinting=none`/`--disable-lcd-text` по желанию (снижают разницу хинтинга; ⚠ проверить, что совпадает с режимом, в котором снят baseline), отключить GPU-растр (`--disable-gpu`) на CI-раннерах без GPU — так и так software.

### 4.2 Движки сравнения
- **pixelmatch** (mapbox) — `threshold` по умолчанию 0.1, `includeAA: false` (антиалиасинг игнорируется детектором Vyšniauskas 2009), в новых версиях сравнение в OKLab/HyAB, `ignoreMask`, `diffMask`. Используется Playwright внутри (форк). https://github.com/mapbox/pixelmatch
- **odiff** (Zig, SIMD) — в 5–7× быстрее pixelmatch на больших изображениях (по README), `antialiasing`, `ignoreRegions`, `failOnLayoutDiff` (разные размеры → "layout-diff"), серверный режим `ODiffServer`/`odiff --server`; интеграция `playwright-odiff` (`toHaveScreenshotOdiff`). https://github.com/dmtrKovalenko/odiff , npm `odiff-bin`.
- **looks-same** (gemini-testing/Testplane) — `tolerance` в CIEDE2000, `antialiasingTolerance`, `ignoreCaret`, `strict`; хорош там, где нужна перцептивная метрика цвета. https://github.com/gemini-testing/looks-same
- **SSIM** (`ssim.js`, `image-ssim`) — структурное сходство, устойчиво к сдвигам яркости/антиалиасингу; полезно для design-vs-code (разд. 5), не для регрессий.

### 4.3 Сервисы и self-hosting

| Инструмент | Тип | Self-host | Цена (2026) | Заметки |
|---|---|---|---|---|
| Playwright `toHaveScreenshot` + baseline в git | OSS | да (по определению) | 0 | нет review-UI (только HTML report с diff/slider); baseline в git (LFS при объёме) |
| Vitest 4 browser mode `toMatchScreenshot` | OSS | да | 0 | Vitest 4.0 добавил visual regression (https://heise.de/-10814342 ); провайдер Playwright; Storybook 10 `@storybook/addon-vitest` гоняет stories как тесты; сторонний `storybook-addon-vrt` (SB 10+, Vitest 4, Node 22+) — скриншот на каждую story https://storybook.js.org/addons/storybook-addon-vrt |
| **Argos** | SaaS, код MIT (https://github.com/argos-ci/argos ) | ⚠ код открыт, но self-host не поддерживается/не документирован (https://cloudzy.com/blog/argos-vs-lost-pixel-vs-backstopjs-compared/ ) | Hobby free 5 000 скриншотов/мес; Pro $100/мес 35 000, сверх $0.004 (Storybook $0.0015) https://argos-ci.com/pricing | SDK Playwright/Storybook/Cypress/Vitest; Git-интеграция GitHub/GitLab; review UI, "for teams and AI agents" |
| **Lost Pixel** | OSS + SaaS | был | — | ⚠ **Архивирован 2026-04-22, команда ушла в Figma, продукт сворачивается** — не выбирать. https://github.com/lost-pixel/lost-pixel |
| BackstopJS | OSS MIT | да (npm/Docker) | 0 | старый, Puppeteer/Playwright-движок, свой HTML-отчёт |
| Chromatic | SaaS (Storybook-мейнтейнеры) | нет | Free 5 000 снимков/мес (только Chrome); Starter $179/мес 35 000; Pro $399/мес 85 000; сверх $0.008 https://www.chromatic.com/pricing | лучший UX для Storybook; TurboSnap; есть Playwright/Cypress интеграции; Storybook "Visual Tests" addon = клиент Chromatic |
| Percy (BrowserStack) | SaaS | нет | Free 5 000/мес; платные от ~$199/мес (⚠ цифры из агрегаторов, официальная страница не проверена) | кросс-браузер, ML-шумоподавление |

Рекомендация для self-hosted Docker CI: **Playwright `toHaveScreenshot` в официальном Docker-образе + baseline в git (LFS) + HTML-report как артефакт CI**; для компонентов — Storybook 10 + Vitest browser mode. SaaS (Argos Hobby) — опционально ради review-UI; это не lock-in, так как скриншоты делает Playwright.

---

## 5. Сравнение реализации с кадром Figma (design-vs-code)

Различие задач: "Regression tests compare a page against an earlier implementation; design QA compares the implementation against the intended design" (https://www.hypermatic.com/articles/pixelay-visual-regression-testing-vs-design-qa/ ). Нужны оба слоя: design-vs-code при реализации, code-vs-code после приёмки.

### 5.1 Получение эталона из Figma
- **REST `GET /v1/images/:key?ids=…&scale=1|2&format=png`** (https://developers.figma.com/docs/rest-api/file-endpoints/ ): `scale` 0.01–4; `contents_only=true` по умолчанию (не включает перекрывающие соседние слои — для фрейма-экрана ок); `use_absolute_bounds=true` — полные размеры без обрезки; `version=` — фиксировать версию файла для воспроизводимости; лимит 32 Мп (больше — даунскейл); ссылки живут 30 дней; null → узел невидим/0% opacity. Tier 1 endpoint → у Dev/Full 10–20 запросов/мин, у View/Collab ~20/мес — **токен должен быть от Dev/Full seat**.
- MCP `get_screenshot` (для агента, в контексте); `download_assets` (remote, до 20 узлов, рендеры ≤ ~4096 px без export settings).
- Практика: экспортировать эталон **с scale = DPR скриншота** (обычно scale=2 и Playwright `deviceScaleFactor: 2`, `scale: "device"`), viewport = ширина фрейма Figma, высоту — по фрейму (`fullPage` или `clip`). Кешировать PNG в репо `design/<screen>@2x.png` + `design/<screen>.meta.json` (fileKey, nodeId, version, lastModified) → детерминизм и экономия лимитов; обновление эталонов — отдельный job/PR.

### 5.2 Почему прямой pixel diff с Figma шумит
1. **Текст**: Figma рендерит текст своим движком (WebGPU/WebGL-рендерер + собственная растеризация глифов), браузер — Skia + FreeType/DirectWrite/CoreText с хинтингом/субпиксельным AA → различия в толщине штрихов, кернинге и позициях строк на 0.5–1 px на каждом глифе. Даже статьи про агентные циклы отмечают "Figma renders fonts differently from browsers, which can cause mismatches that aren't really implementation errors" (https://www.buildmvpfast.com/blog/figma-to-code-pixel-perfect-loop-ai-agent-screenshot-iterate-2026 ). Подробнее — разд. 6.
2. **Line-height/обрезка строк** — разные модели вертикальной метрики → весь блок ниже сдвигается на 1–2 px, pixel diff "краснеет" целиком.
3. **Растровые изображения**: Figma ресемплирует и сжимает картинки при экспорте, браузер — другой фильтр масштабирования, `object-fit`; JPEG-артефакты.
4. **Тени/blur/градиенты** — разные алгоритмы (гаусс vs box-blur аппроксимации, дизеринг градиентов).
5. **Контент и данные** — макет со статикой vs реальные данные/шрифты fallback; скроллбары, курсор, фокус-кольца.
6. **Субпиксельная геометрия** — дробные координаты в Figma vs округление layout в Chromium (LayoutUnit 1/64 px, снапинг к пикселям при отрисовке).
Вывод: строгий `maxDiffPixels: 0` против Figma недостижим; нужен **перцептивный/структурный критерий + численные проверки геометрии**.

### 5.3 Рабочий подход (многоуровневый)
1. **Численная проверка геометрии и стилей (основной гейт)** — Playwright `getBoundingClientRect()` + `getComputedStyle()` для узлов, сопоставленных с Figma-узлами (через `data-figma-node="12:34"` в dev-сборке или по тестовым id), сравнение с `absoluteBoundingBox`/стилями из REST `GET /files/:key/nodes` или `get_metadata`/`get_design_context`. Допуски: позиция/размер ±1 px (±2 px для текстовых блоков по высоте), цвет — ΔE2000 ≤ 1–2 или точное совпадение токена, font-size/weight/letter-spacing — точно. Практика из статьи buildmvpfast (2026-03-30): кормить агенту дельты числами, а не скриншоты; цель "all deltas under 2px"; 3–5 итераций; кап 8 итераций на компонент; если дельты не уменьшаются 3 раунда — остановиться и дробить.
2. **Перцептивный diff всего кадра** — pixelmatch/odiff с `threshold` 0.1–0.2 и игнором антиалиасинга, **маски на текстовые области** (или сравнение с размытием обоих изображений гауссом σ≈1 px до diff), метрика SSIM (`ssim.js`) с порогом ~0.95–0.98 на кадр/секцию (⚠ эмпирика, калибровать на своих макетах). Diff-изображение — агенту на просмотр (модель хорошо видит "красные зоны").
3. **Визуальная оценка моделью** — скриншот реализации и Figma рядом/overlay (50% opacity или `difference` blend) → агент формулирует список расхождений; OpenAI-skill `design-qa` формализует это: обязательны оба артефакта, результат `design-qa.md`, "final result: blocked" если сравнение невозможно (https://www.skills.sh/openai/role-based-plugins/design-qa ).
4. **Ручной overlay для финала/спорных мест**: PerfectPixel by WellDoneCode (Chrome/Firefox; слои, opacity, blend Difference/Invert; Chrome v2.2.0.1 от 2024-05 — ⚠ давно не обновлялся, реклама в панели) — https://welldonecode.com/perfectpixel ; Pixelay (Hypermatic, Figma-плагин: оверлей Figma против URL, в т.ч. localhost) — https://www.hypermatic.com/pixelay/ ; VisBug (Chrome, Google Chrome Labs — измерения/отступы на живой странице); Storybook `@storybook/addon-designs` v11 (Storybook 10+) — встраивает Figma-фрейм в панель story, параметр `design: { type: 'figma', url }` (https://storybook.js.org/addons/storybook-addon-designs ).

### 5.4 Готовые продукты design-vs-code (2025–2026)
- **TestMu AI (бывш. LambdaTest) SmartUI**: `npx smartui upload-figma designs.json --markBaseline` берёт фреймы Figma как baseline, `npx smartui exec -- npx playwright test` снимает реализацию, фильтрует "anti-aliasing and rendering noise"; MCP-инструменты `analyzeSmartUIRun`, `summarizeLayoutDiff`, `analyzeHumanDiff`. SaaS, цены не опубликованы. (https://www.testmuai.com/blog/agentic-figma-visual-qa/ , 2026-08)
- **Pixelay** (Hypermatic) — overlay/сравнение Figma vs URL, ручное.
- **Figma "AI design QA agent"** — ⚠ проверяет **макет против дизайн-системы** (spacing, alignment, токены), а не против реализации; все платные планы, в open beta без AI credits (https://www.figma.com/solutions/ai-design-qa-agent/ ). Полезен до передачи в разработку (чистый макет = лучше MCP-вывод).
- Академический прототип: Figma-плагин + Playwright + VLM-сравнение + авто-PR (https://ir.iba.edu.pk/fyp-bscs/54 ).
- Self-hosted аналог SmartUI собирается из: REST images (эталон) + Playwright (скриншот) + odiff/pixelmatch/SSIM + отчёт; ничего платного не требуется.

---

## 6. Различия рендеринга Figma ↔ браузер (и как маппить)

### 6.1 Текст и line-height
- **Модель leading**: после обновления Figma распределяет line-height "just like web does" — half-leading (половина сверху, половина снизу строки); 100% = 100% font-size, как в CSS. https://www.figma.com/blog/line-height-changes/ . Отличия: "line-height in CSS is really min-line-height" (инлайн-содержимое с бо́льшими метриками/fallback-глифами растягивает строку), Figma применяет значение строго; эмодзи в Figma не расширяют строку.
- **Auto line height** в Figma = "default line height шрифта" (из метрик файла), **не гарантированно равен CSS `line-height: normal`** — `normal` вычисляет браузер по своим метрикам (hhea / OS/2 typo / win, флаг `USE_TYPO_METRICS`), разные движки дают разные значения. Отчёт от сентября 2026, без ответа staff: https://forum.figma.com/report-a-problem-6/text-layer-height-and-vertical-trim-do-not-map-clearly-to-browser-css-line-boxes-57490 . **Правило: в CSS не оставлять `normal` — всегда явный line-height (px или unitless из typography-токена); дизайнерам — не использовать Auto в текстовых стилях.** Если в макете Auto — агент берёт resolved px из `get_design_context` / REST `style.lineHeightPx`.
- **Высота текстового слоя ≠ DOMRect**: у inline `<span>` Arial 16/24 Chromium даёт 17px (content area), у block — 24px (line box) (тот же отчёт). Сравнивать геометрию по блочным контейнерам, не по инлайн-узлам.
- **Vertical trim (Figma) ↔ `text-box-trim` / `text-box-edge` / `text-box`** (бывш. `leading-trim`): Chrome/Edge 133+, Safari 18.2+, **Firefox 154 (август 2026) → Baseline Newly available** (https://web.dev/blog/web-platform-08-2026 , https://developer.chrome.com/blog/css-text-box-trim ). Маппинг: Figma "Cap height to baseline" → `text-box: trim-both cap alphabetic`. Результат зависит от метрик шрифта (https://ics.media/en/entry/250319/ ). Help Figma всё ещё ссылается на старые имена свойств. Fallback для старых браузеров — отрицательные margin по cap-height (подход Capsize, https://seek-oss.github.io/capsize/ ).
- **Letter spacing**: Figma хранит в % от font-size или в px. `X%` → `letter-spacing: (X/100)em` (−2% → `-0.02em`); px → px. Dev Mode выдаёт пересчитанные px — для токенов лучше em.
- **Paragraph spacing** → `margin-block-end` между абзацами; **text case** → `text-transform`; **truncation / max lines** → `line-clamp` (`-webkit-line-clamp` + `display:-webkit-box`); **OpenType features** (tnum, ss01) → `font-variant-numeric` / `font-feature-settings`; оси variable font → `font-variation-settings`; веса вида 450 требуют variable font в вебе.
- **Растеризация по ОС**: macOS (CoreText, без хинтинга, grayscale AA; `-webkit-font-smoothing` действует только на macOS), Windows (DirectWrite + ClearType, субпиксельный AA, своя гамма), Linux (FreeType, hinting slight/none по fontconfig). Figma рендерит одинаково на всех ОС собственным движком. Следствие: эталон для автоматики — Linux Chromium в Docker; глазами сравнивать удобнее на macOS (ближе к Figma). Playwright: "Screenshots differ between browsers and platforms due to different rendering, fonts and more" (https://playwright.dev/docs/test-snapshots ).
- **Шрифты**: те же файлы и та же версия, что у дизайнера (напр. Inter 3.x vs 4.x различаются метриками), self-host woff2, в тестах `font-display: block` + ожидание `document.fonts.ready`. Отсутствующий шрифт → fallback с другими метриками → сдвиг всего ниже.

### 6.2 Геометрия и округление
- Figma допускает дробные координаты/размеры (x=12.5, w=343.33), особенно после масштабирования. Chromium считает layout в LayoutUnit (1/64 px) и снапит отрисовку к физическим пикселям → на DPR 1 возможны ±1px сдвиги и размытые 1px-линии. Дизайнерам — целые значения; агенту — округлять осознанно (до 1px, до 0.5px при DPR 2) и фиксировать это в отчёте.
- `flex: 1` при нечётной сумме делит пиксели иначе, чем Figma (которая покажет 171.5). Допуск ±1px на элемент обязателен.

### 6.3 Auto layout → CSS
| Figma | CSS |
|---|---|
| Auto layout horizontal / vertical | `display:flex; flex-direction: row / column` |
| Gap / "Auto" spacing | `gap: Npx` / `justify-content: space-between` |
| Padding (по сторонам) | `padding` |
| Alignment (9 точек), baseline | `justify-content` + `align-items`; `align-items: baseline` |
| Hug contents | `width/height: auto` (`fit-content`, `inline-flex`), `flex: none` |
| Fill container — главная ось | `flex: 1 1 0` + `min-width: 0` (иначе текст не сжимается) |
| Fill container — поперечная ось | `align-self: stretch` |
| Fixed | `width: Npx; flex-shrink: 0` |
| Min/Max width/height | `min-width` / `max-width` / … |
| Wrap | `flex-wrap: wrap; row-gap` (counter-axis spacing), `align-content` |
| Absolute position ("ignore auto layout") | `position:absolute` у ребёнка, `position:relative` у родителя + constraints |
| Canvas stacking "first on top" | обратный z-order: `z-index` или `*-reverse` |
| Strokes included in layout | вкл → border влияет на размер; выкл → inset shadow / outline |
| Clip content | `overflow: hidden` |
| **Grid auto layout** (Config 2025, май 2025) | `display:grid; grid-template-columns/rows` (px или `1fr`/Auto), span → `grid-column: span N`. ⚠ строки/колонки не умеют hug, нет auto-fill/minmax/auto-flow; в 2025 — beta (https://forum.figma.com/share-your-feedback-26/config-2025-grid-auto-layout-flow-let-s-hear-what-you-think-40316 , https://uxdesign.cc/figmas-new-grid-you-must-understand-css-grid-as-a-designer-fbb00416e1cc ) |

Источники маппинга hug/fill/fixed: https://www.infragistics.com/indigo-docfx/best-layout-practices-figma , https://grida.co/docs/@designto-code/figma-autolayout (нюанс: `align-items` нельзя вывести только по контейнеру — нужно смотреть, все ли дети stretch).
- **Constraints** (фреймы без auto layout): Left/Right/Top/Bottom → `left/right/top/bottom` у absolute; Left & Right → оба + `width:auto`; Center → `left:50%` + `translate`; Scale → проценты. Constraints описывают только поведение при ресайзе фрейма — **адаптив обычно нарисован отдельными фреймами** (375 / 768 / 1440): агенту давать все, сравнивать каждый на своём viewport.
- **Dev Mode CSS**: абсолютные px, без адаптива, `position:absolute` для не-auto-layout, дробные значения как есть, переменные как `var(--name, fallback)`; если у переменной задан **codeSyntax (WEB)**, используется он → попросить дизайнеров проставить codeSyntax = имя нашего CSS-токена: дешёвый способ получить правильные имена и в MCP-выводе.

### 6.4 Обводки
- **Inside** → `box-shadow: inset 0 0 0 Wpx color` (не влияет на layout, как в Figma) или `border` + `box-sizing: border-box` (совпадает, если в Figma включено "strokes included in layout").
- **Center** → прямого аналога нет: `outline: Wpx solid; outline-offset: -W/2px` или SVG; лучше договориться с дизайнерами использовать Inside.
- **Outside** → `outline` (в современных браузерах следует border-radius) или `box-shadow: 0 0 0 Wpx`.
- Отдельные стороны → `border-top` и т.д.; кастомный dash → SVG / `background-image` (CSS `dashed` не настраивается).
- Обводка текста/векторов → SVG `stroke` / `-webkit-text-stroke` (центрированная, отличается от inside/outside Figma).

### 6.5 Эффекты, градиенты, blend
- **Drop shadow** → `box-shadow: x y blur spread color`; blur Figma совпадает с CSS ("Figma is the closest match to CSS box-shadow", https://bjango.com/articles/blurradiuscomparison/ ). Порядок нескольких теней: в Figma список снизу вверх, в CSS первая — верхняя (были баги Dev Mode с порядком и потерей spread: https://forum.figma.com/report-a-problem-6/figma-shadow-bugs-introduced-feb-26th-affected-dev-mode-css-copy-18764 ). На непрямоугольных формах (векторы, текст, PNG с альфой) тень Figma повторяет форму → CSS `filter: drop-shadow()` (без spread) или SVG-фильтр; spread в Figma работает только для прямоугольных слоёв/фреймов.
- **Layer / Background blur**: по ответу команды Figma на форуме значение Figma ≈ 2× CSS: `blur 30` → `filter: blur(15px)` / `backdrop-filter: blur(15px)` (https://forum.figma.com/ask-the-community-7/background-blur-is-different-in-dev-mode-22642 ). ⚠ неофициально — калибровать скриншотом. Progressive blur — только маской и несколькими слоями backdrop-filter.
- **Градиенты**: Figma задаёт linear gradient через transform handles, а не угол; для неквадратного бокса угол CSS ≠ визуальный угол Figma — брать из Dev Mode CSS или пересчитывать. Diamond — аналога нет (SVG/растр). Интерполяция: hex/rgb в CSS — sRGB (как в Figma), но с `oklch()`-стопами по умолчанию интерполяция в oklab → другой средний цвет. Бандинг/дизеринг различается.
- **Blend modes**: `mix-blend-mode` покрывает стандартные режимы + `plus-lighter`; `plus-darker` — только Safari. "Pass through" у групп Figma ≈ отсутствие изоляции; в CSS `opacity<1`/`filter`/`transform` создают stacking context и меняют смешивание → `isolation: isolate` там, где в Figma блендинг внутри фрейма.
- **Opacity слоя vs fill opacity** → `opacity` (влияет на детей) vs альфа цвета фона.
- **Изображения**: Fill/Fit/Crop/Tile → `object-fit: cover/contain`, `object-position`, `background-size/repeat`; фильтры изображения Figma (exposure, contrast…) не переносятся — экспортировать обработанный ассет.
- **Corner smoothing** (squircle) → `corner-shape: squircle` (Chrome 139+, ⚠ нет в Firefox/Safari на момент проверки) или SVG mask/clip-path.

---

## 7. Практики: допуски, design QA, агентные pixel-perfect воркфлоу

### 7.1 Допуски с дизайнерами
Общепринятого опубликованного стандарта "±1px" не найдено; источники по design QA (Pixelay/Hypermatic, чек-листы) сводятся к триажу: отделять brand-critical расхождения от полировки, каждое расхождение — со скриншотом/overlay, ссылкой на Figma-узел, URL, viewport; повторная проверка после фиксов (https://www.hypermatic.com/articles/pixelay-design-qa-handoff-between-designers-and-developers/ ). Поэтому допуски нужно зафиксировать самим. Предлагаемый контракт (наш вывод на основе разд. 5–6):

| Класс | Допуск | Как проверяется |
|---|---|---|
| Токены (цвет, радиус, тень, typography) | **0** — только токен из `tokens/*.tokens.json`, никакого хардкода | lint + сравнение computed style с resolved значением токена |
| Размеры и позиции боксов | ±1 px (DPR 1) на элемент; накопление по вертикали ≤ 2 px на экран-секцию | `getBoundingClientRect` vs Figma `absoluteBoundingBox` |
| Высота текстовых блоков | ±2 px на абзац (метрики шрифтов), переносы строк должны совпадать | бокс + число строк (`getClientRects().length`) |
| Шрифт: family/size/weight/letter-spacing/line-height | точно (line-height — явный px) | computed style |
| Перенос строк / truncation | совпадает на ширине фрейма | визуально + число строк |
| Растровые изображения | кадрирование/пропорции точно, качество — не сравнивать попиксельно | бокс + `naturalWidth` ≥ 2× для DPR 2 |
| Иконки (SVG) | тот же ассет, размер точно, цвет — токен | хеш файла/имя + бокс |
| Тени/blur/градиенты | визуальная эквивалентность (дизайнер подтверждает) | overlay/скриншот, без pixel-гейта |
| Анимации/состояния | hover/focus/active/disabled присутствуют, если нарисованы | Storybook stories на состояния + скриншоты |
| Адаптив | только нарисованные брейкпоинты сравниваются строго; промежуточные — "не ломается" | Playwright на каждой ширине фрейма + smoke на промежуточных |

Правила для дизайнеров (снижают шум): auto layout везде (не группы с абсолютом); целые px; явный line-height в text styles (не Auto); все цвета/отступы — переменные с codeSyntax WEB; компоненты из библиотеки, а не detached; один фрейм на брейкпоинт; Inside-обводки; подписанные состояния (variants); аннотации Dev Mode для поведения. Перед передачей можно прогнать Figma "AI design QA agent" (проверка макета на соответствие DS).

### 7.2 Опубликованные агентные воркфлоу (2025–2026)
- **Anthropic, Claude Code best practices** (актуально 2026): "Give Claude a check it can run: tests, a build, a screenshot to compare"; паттерн "[paste screenshot] implement this design. take a screenshot of the result and compare it to the original. list differences and fix them"; жёсткие гейты — `/goal`-условие, **Stop hook**, который не даёт завершить ход, пока скрипт проверки не прошёл, и **verification subagent** со свежим контекстом. https://code.claude.com/docs/en/best-practices
- **Figma, skill `figma-design-to-code`** (плагин v2.2.120): скриншот как цель, дробление sparse-ответов, перевод absolute → нативная вёрстка, ассеты локально, верификация каждого ассета (разд. 1.4).
- **buildmvpfast, "Figma-to-Code Pixel-Perfect Loop" (2026-03-30)**: Figma MCP → код → Playwright на фиксированном viewport → `getComputedStyle`/`getBoundingClientRect` → дельты числами агенту → правки; цель все дельты < 2px; 3–5 итераций; кап 8; стоп при отсутствии сходимости 3 раунда; логировать дельты для детекции осцилляции. Перечислены провалы: spatial blindness, ложные правки из-за рендеринга шрифтов, галлюцинации отступов (13px вместо 16px), 429 посреди цикла, переполнение контекста, осцилляция. "The AI is the labor. Playwright is the quality gate." https://www.buildmvpfast.com/blog/figma-to-code-pixel-perfect-loop-ai-agent-screenshot-iterate-2026
- **aidesigner.ai (2026-05-02)**: скриншот через Claude in Chrome / Playwright MCP / свой `scripts/screenshot.sh` в CLAUDE.md; "две итерации — оптимум": 1-я закрывает ~70% разрыва, 2-я ~25%, дальше — убывающая отдача и нужен человек (⚠ анекдотичные цифры). https://www.aidesigner.ai/blog/claude-code-frontend-design
- **Pix skill** (https://github.com/skobak/pix , ⚠ малоизвестный, ~84 звезды): визуальное сравнение Chrome-скриншота с Figma-скриншотами + численный аудит `getComputedStyle` (padding, margin, gap, цвета, font, line-height, letter-spacing, radius, border, box-shadow) против значений Figma; допуск — ноль ("12px is not 10px"); иконки сравниваются по силуэту при зуме 3×. https://mcpmarket.com/tools/skills/pixel-perfect-ui-implementation
- **OpenAI `design-qa` skill**: обязательны оба артефакта (Figma-узел/скриншот + рендер), результат — `design-qa.md` с приоритизированным списком фиксов, "final result: blocked" если сравнить нельзя; повторный проход ссылается на прошлые находки. https://www.skills.sh/openai/role-based-plugins/design-qa
- **TestMu SmartUI + MCP (2026-08)** — коммерческий вариант той же идеи с Figma-baseline (разд. 5.4).
- Medium "How to turn Claude Code into a Figma-to-React pipeline that visually verifies its own work" (Figma MCP + Playwright MCP) — ⚠ не прочитан (403): https://medium.com/@aliafsah1988/how-to-turn-claude-code-into-a-figma-to-react-pipeline-that-visually-verifies-its-own-work-030246f600a9

Общий вывод из источников: чисто визуальное самосравнение моделью сходится плохо (модель "говорит, что всё ок"); работает связка **численные дельты (детерминированный скрипт) + визуальный diff для финала + человек/дизайнер для эффектов и типографики**, гейт — скрипт, а не мнение агента.

---

## 8. Итоговые рекомендации для бойлерплейта

1. **Доступы**: минимум 1 Dev seat (Professional $12/мес; Full $16, Collab $3 — https://www.figma.com/pricing/ ) для агента — даёт MCP 200 вызовов/день и REST Tier 1 10/мин; файл макета обязан лежать в платной команде. Code Connect (Org+) — опционально; без него — `docs/figma-map.json` + правила.
2. **MCP**: официальный remote (`claude plugin install figma@claude-plugins-official`), skills `figma-design-to-code` + `figma-code-connect`; `MAX_MCP_OUTPUT_TOKENS=50000`. В CLAUDE.md — порядок: `get_metadata` → секции `get_design_context` (просить "React + CSS Modules/наш стек, без Tailwind arbitrary values") → `get_variable_defs` → `get_screenshot` → ассеты в `src/assets/figma/`.
3. **Кеш дизайна в репо**: `design/<screen>/{frame@2x.png, nodes.json, meta.json}` (fileKey, nodeId, version) — генерирует скрипт `scripts/figma-pull.ts` через REST (PAT Dev seat, `GET /v1/files/:key/nodes?ids=&depth=` + `GET /v1/images/:key?scale=2&version=`). Агент и CI работают с кешем, не тратя лимиты; обновление — отдельный PR.
4. **Токены**: DTCG 2025.10 JSON в `tokens/` → Style Dictionary v5 (или Terrazzo) → CSS variables; ввод из Figma через нативный export modes / Tokens Studio Free / `use_figma`-скрипт; CI `tokens:check` (валидация + rebuild + `git diff --exit-code`); stylelint запрет хардкода.
5. **Гейт design-vs-code** (`scripts/design-check.ts`, Playwright в Docker `mcr.microsoft.com/playwright:v1.64.0-noble`): (а) численная сверка боксов/стилей по `data-figma-node` с допусками из 7.1 → JSON-отчёт дельт; (б) pixelmatch/odiff + SSIM против `frame@2x.png` с маскированием текста → diff PNG; (в) отчёт агенту. Подключить как Stop hook / `/goal` для агентной сессии; кап итераций 5–8.
6. **Регрессии после приёмки**: Playwright `toHaveScreenshot` (+ Storybook 10 / Vitest 4 browser mode для компонентов), baseline только из Docker, `animations: 'disabled'`, `caret: 'hide'`, `stylePath` для стабилизации, `mask` для динамики, `maxDiffPixelRatio` ~0.001–0.01 (калибровать), WebP-baseline (1.62+) для экономии места. Review-UI — HTML report как артефакт GitHub/GitLab CI; Argos Hobby опционально. Lost Pixel не использовать (архив).
7. **Финальная приёмка** — дизайнер с overlay (PerfectPixel / Pixelay / `@storybook/addon-designs`) по чек-листу 7.1; спорные эффекты (blur, тени, градиенты, текст) принимаются глазами, не пикселями.
