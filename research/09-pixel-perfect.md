# 09. Pixel-perfect вёрстка по Figma
Status: done
Updated: 2026-10-14

## Resume notes
- Done: все разделы. Источники: xRocket (docs/ui-conventions.md, layout-and-styles.md, figma-lint/*, skills new-ui/new-ui-v2,
  tests/visual/web, README VRT, tools/scripts/check-figma-breakpoints.test.mjs), дайджесты прошлых сессий, boilerplate
  docs/design.md и docs/workflow.md, официальный Figma-плагин Claude Code v2.2.120, веб-ресерч саб-агента.
- Next: —
- Sub-agent: research/09a-figma-web.md — done (веб-факты с URL: MCP, Code Connect, токены, VRT, рендеринг, агентные workflow).

## Summary (≤ 15 lines)
1. В xRocket была сильная **входная** половина (линтер имён макета с подписью, скиллы /new-ui и /new-ui-v2 с Name map,
   Measurement plan, Token mapping и ⚠️-гейтом), но **выходной** сверки с Figma не было: «by eye», только code-vs-code VRT.
   Точность на деле давали ручные Playwright-замеры DOM и 7 агентов по секциям фрейма (нашли 2px от inside-обводки).
2. Пайплайн для бойлерплейта: P0 контракт с дизайнером → P1 линт макета + подпись → P2 токены Figma → DTCG JSON → Style
   Dictionary v5 → CSS vars → P3 карта компонентов → P4 план с Name map и машинным spec → P5 вёрстка блоками → P6 сверка →
   P7 ревью, deviations, эталоны VRT.
3. Ядро P6 — **блокирующие числовые замеры** (`figma:measure`: getBoundingClientRect/getComputedStyle по `data-figma`
   против spec из REST, допуски 0 / ±1px / ±2%, цвет — по токену) + Stop-хук, не дающий агенту сказать «готово».
   Pixel diff против PNG фрейма — только advisory heatmap по узлам (текст Figma и браузера не совпадает никогда).
   Code-vs-code VRT в Docker — после приёмки, против регрессий.
4. Доступ: Dev/Full seat на платном плане обязателен (иначе MCP/REST 6–20 вызовов в месяц); Code Connect и REST Variables
   API — только Org/Enterprise → своя карта компонентов и экспорт токенов плагином.
5. Поставка: docs/figma.md, docs/design-qa-contract.md, порт figma-lint, скиллы figma-preflight / figma-implement /
   figma-verify / tokens-sync, скрипты tools/figma/*, агент figma-section-inspector, Docker-образ тестов; всё удаляется init при
   режиме «без макета».
6. Не pixel-perfect никогда: растеризация текста, переносы на реальных данных, ширины между фреймами, нативный UI и шапка
   Telegram, blur/тени/градиенты, дробные значения, иная версия шрифта. Это фиксируется в контракте до начала работ.

## Findings

### F1. Что уже было в xRocket (факты, проверено по коду и докам)

1. **Конвенция макета + валидатор на стороне дизайна.** `docs/figma-lint/figma-naming.md` — грамматика имён:
   экран `flow / state [ - modifier ] @ [platform] breakpoint`, слои `категория / роль`, блок `X` с частями `X / y`,
   маркеры `@ <bp>-only`, `@ reorder`, префикс `wip /`. `docs/figma-lint/checks.md` (CHECKS_VERSION 7) — предикаты уровней
   A (имя экрана), B (слои: дефолтные имена `Frame 12`, `copy/final/v2`, позиционные `left`, непереименованные инстансы,
   цепочки групп), C (кросс-брейкпоинт: узел есть в одном фрейме и нет в baseline без `-only`, разный порядок детей без
   `@ reorder`, разные имена одной роли), D (любой скрытый слой — blocker). Severity blocker/warning/info, подсказки с
   `suggestion_source` (`rule`/`derived`/`—`), группировка по причинам.
2. **Подпись валидации.** Плагин `figma-lint-plugin` (репо `xrocket-front-chrome-extensions`) при нуле блокеров пишет в
   shared plugin data фрейма `{checksVersion, validatedAt, tool, flowFrames}`; скилл читает её через
   `GET /v1/files/:key/nodes?ids=…&plugin_data=shared` с PAT `file_content:read` (`token-setup.md`: env `FIGMA_TOKEN` →
   OS keychain/DPAPI/libsecret). Подпись не видит правок после прогона → скилл делает собственную «сверку» по `get_metadata`.
3. **Два скилла вёрстки.** `/new-ui` (любой макет, каждая догадка ⚠️) и `/new-ui-v2` (подписанный макет, Name map,
   границы файлов и Responsive table выводятся механически). Фазы Plan → Approval → Impl → Review → Done. Обязательные
   секции плана: Name map (`имя слоя · node-id · узел в коде · файл · data-test`), Reuse map (инстанс → компонент
   проекта), Measurement plan (заранее перечисленные узлы для `get_design_context`), Token mapping (каждое значение →
   токен, нет токена → ⚠️, «never silently substitute the nearest token»), i18n keys (из `get_variable_defs`),
   Responsive table, Styled tree, File tree. Порядок MCP: `get_metadata` → baseline = самый узкий фрейм →
   `get_screenshot` (ориентир, не источник пикселей) → точечный `get_design_context` только на листья → `get_variable_defs`.
   Главный review-инвариант: каждый экспорт `*.styled.ts` есть в Name map («отделяет вёрстку по макету от вёрстки по мотивам»).
4. **Автоматической сверки с Figma не было.** `ui-conventions.md §10`: «Final comparison with Figma is by eye, by a
   human… PNG-сравнение не запускать». Был только code-vs-code VRT: `tests/visual/web/p2p` — одна страница, 2 темы × 3
   вьюпорта (393/768/1024), `toHaveScreenshot({fullPage:true})`, `maxDiffPixelRatio: 0.01`, отключение анимаций/каретки
   через `addStyleTag`, `document.fonts.ready`, прокрутка для lazy-контента, блокирующий CI-job, эталоны в Docker
   (`tools/visual/Dockerfile`, Alpine + системный Chromium 142). README фиксирует измеренные факты: шум macOS↔CI ниже 1%,
   но платформенно-зависимый CSS (`scrollbar-gutter`, overlay-скроллбары macOS, fixed/sticky, vh) даёт 8.47% → эталоны
   только из контейнера; amd64 и arm64 дают побайтно одинаковые снимки; после мержа эталоны переснимаются, а не выбираются.
5. **Что реально давало точность — ручная практика пользователя** (дайджесты сессий 04.10, 07.10, KYC):
   - замеры DOM через Playwright (`getBoundingClientRect`, `getComputedStyle`) в Storybook/dev против чисел Figma, в
     обеих темах, таблицами — «хорошо зашло»;
   - «отправь много мультиагентов на параллельную проверку разных кусков фрейма» — 7 агентов, каждый мерил свой кусок;
     нашли поле на 2px выше (46/42 вместо 44/40): в Figma stroke inside, CSS border прибавляется к padding; lineHeight
     TextArea 19 vs 17; палитра Figma (Radix v1/v2) ≠ проект (Radix v3) → решение в теме, не hex в компоненте;
     Storybook не грузил Inter (`.ttf` vs `.woff2`) — тихая подмена шрифта ломает все текстовые замеры;
   - «составь список всех изменений которые сделаны и не описаны здесь» — поиск отсебятины;
   - конфликт макет/код → пользователю списком, обычно «бери кодовую», но «пол пикселя» толщины линии оставил по макету;
   - юзабилити выше пикселя: зона касания 40×40 откатила «точные» отступы;
   - падение VRT «страница на 1px выше» — виноват 1px sentinel пагинации из соседней ветки, а не шрифты: diff нужно
     локализовать до элемента, а не гадать.

6. **Прочее.** Code Connect в репозитории не было (ни одного `*.figma.tsx`/`figma.config.json`), хотя `/new-ui` упоминает
   «code-connect-маппинги»: Reuse map на деле строился grep'ом по `shared/ui`. Токены из Figma не синхронизировались
   автоматически: `libs/tamagui/src/{tokens,fonts,themes}.ts` писались руками, сверка — Token mapping table в плане.
   Единственная автоматическая защита связи «дизайн-правила ↔ код» — `tools/scripts/check-figma-breakpoints.test.mjs`:
   Vitest парсит брейкпоинты из `breakpoints.ts`, `tamagui.config.ts` и таблицу в `figma-naming.md` и падает при
   расхождении. Это хороший образец для бойлерплейта (тесты дрейфа «правила для дизайнера ↔ код»).

### F2. Официальный Figma-плагин для Claude Code (проверено локально, v2.2.120)

- MCP: remote `https://mcp.figma.com/mcp`. Инструменты: `get_metadata`, `get_design_context`, `get_screenshot`,
  `get_variable_defs`, `get_code_connect_map`, `add_code_connect_map`, `get_code_connect_suggestions`,
  `get_context_for_code_connect`, `send_code_connect_mappings`, `search_design_system`, `get_libraries`, `use_figma`
  (запись), `upload_assets`, `generate_figma_design`, `create_new_file`, `generate_diagram`, `get_figjam`, `whoami`.
- README плагина: Starter-план или View/Collab-сид — **до 6 вызовов в месяц** (текущая документация Figma — 20/мес, см. F4);
  Dev/Full-сид на Professional/Org/Enterprise — поминутные лимиты как Tier 1 REST API. → Верстальщику нужен Dev или Full
  seat, иначе пайплайн не работает.
- Скилл `figma-design-to-code`: скриншот — «visual target», реализация только из high-fidelity ответов
  `get_design_context`; «sparse»-ответ нельзя использовать, нужно дробить на дочерние узлы; абсолютное позиционирование
  переводить в нативный layout; переиспользовать Code Connect-компоненты; ассеты строго из payload, не перерисовывать.
- `steering/implement-design.md`: начинает с `get_design_context` на весь узел и откатывается на `get_metadata` только при
  переполнении; «When conflicts arise between design system tokens and Figma specs, prefer design system tokens but adjust
  spacing or sizes minimally»; «DO NOT import or add new icon packages — all assets should come from the Figma payload».
- **Конфликты с правилами пользователя** (решение: правила проекта имеют приоритет, официальный скилл не грузить как
  есть, а обернуть своим): (a) порядок — у пользователя metadata-first и запрет `get_design_context` на корень фрейма;
  (b) «подогнать минимально под токен» = тихая подмена, у пользователя — ⚠️ и вопрос; (c) иконки — у пользователя из
  Lucide, а не из payload; (d) тексты — из словаря i18n, а не из слоя.

### F3. Где ломается пиксель: механика расхождений (знание + практика; веб-подтверждения — в F4)

| Явление | Что в Figma | Что в CSS | Правило маппинга |
| --- | --- | --- | --- |
| Обводка | stroke inside / center / outside; флаг auto-layout «Strokes included in layout» (по умолчанию выкл.) | `border` занимает место в box (с `border-box` съедает padding) | inside без флага → `box-shadow: inset 0 0 0 Npx` (по умолчанию) или `border` с padding = figmaPadding − stroke; inside с флагом → `border` + `border-box`; outside → `outline` / `box-shadow: 0 0 0 Npx`; center → `outline` + `outline-offset: -N/2` или договориться на inside. Случай 2px из F1 |
| Line height | `auto` = метрики шрифта; px; % | `normal` зависит от шрифта и ОС | всегда явный `line-height` в px/unitless из токена; `auto` в макете → ⚠️ (взять из text style) |
| Letter spacing | % от кегля или px | em/px | `x%` → `x/100 em`; 0% → `normal` не писать |
| Обрезка текста по капу | «Vertical trim» (cap height → baseline) | `text-box: trim-both cap alphabetic` — Chrome 133+, Safari 18.2+, Firefox 154 (авг. 2026, Baseline Newly available) | использовать; для старых браузеров — отрицательные margin в духе Capsize |
| Высота текстового узла | высота текстового слоя | у inline `<span>` DOMRect = content area (Arial 16/24 → 17px), у блока = line box (24px) | мерить блочные контейнеры, не инлайн-узлы |
| Auto-layout | hug / fill / fixed, gap, space-between, padding, absolute-child, min/max, wrap, grid | flex/grid | hug → `auto`/`fit-content`; fill по главной оси → `flex: 1 1 0; min-width: 0`; fill по поперечной → `align-self: stretch`; fixed → `width`; absolute-child → `position:absolute` в `relative`; wrap → `flex-wrap` + `row-gap`; frame без auto-layout → ⚠️ (абсолют в коде запрещён без согласования) |
| Дробные значения | x=12.5, w=343.33 | layout-округление браузера, снап бордеров к device px | дробное значение — ⚠️ на handoff; в тестах допуск ±0.5px |
| Тени/блюр | drop shadow со spread (spread только у прямоугольных слоёв); layer/background blur | `box-shadow`, `filter: drop-shadow`, `filter: blur`, `backdrop-filter` | blur тени Figma ≈ CSS 1:1; layer/background blur Figma ≈ 2× CSS (`30` → `blur(15px)`, неофициально, калибровать); порядок нескольких теней в CSS обратный; тень непрямоугольной формы → `drop-shadow()`; всё — через токены |
| Градиенты, blend | linear через transform handles; diamond; pass through | угол CSS; `mix-blend-mode`; stacking context | угол брать из Dev Mode или пересчитывать; diamond → SVG/растр; `isolation: isolate` там, где блендинг внутри фрейма |
| Растеризация текста | собственный рендерер Figma | ClearType/DirectWrite (Win), CoreText (mac), FreeType (Linux) | пиксельное совпадение текста невозможно → текст сравнивается метриками, не пикселями |
| Шрифт | версия, установленная у дизайнера / Google Fonts | файл, который грузит приложение | одна и та же версия файла; проверка `document.fonts` в тесте; подмена шрифта = тест падает |
| Цвет с прозрачностью | заливка с opacity поверх слоёв | композитинг в браузере | сравнивать токен, а не итоговый пиксель |
| Скроллбары | нет | есть на Win/Linux, overlay на mac | замер на фиксированном контейнере в Docker; не сравнивать vh/scrollbar-зависимое с хоста (F1.4) |

### F4. Внешние факты 2025–2026 (подробно и с URL — research/09a-figma-web.md)

1. **Figma MCP.** Remote `mcp.figma.com/mcp` (OAuth, рекомендуемый, единственный с write-инструментами и
   `download_assets`) и desktop `127.0.0.1:3845` (только чтение, работает от выделения). OAuth интерактивный → в CI MCP не
   годится, там REST + PAT. Лимиты (developers.figma.com/docs/figma-mcp-server/rate-limits-access/): View/Collab — 20
   вызовов/мес (README плагина: 6); Dev/Full: Professional 200/день и 10/мин, Org 200/день и 15/мин, Enterprise 600/день
   и 20/мин. Лимит определяет план **команды, владеющей файлом**: файл в Starter-команде = Starter-лимиты. Самый дешёвый
   рабочий вариант — Dev seat на Professional (~$12/мес). Экран = 5–20 вызовов → кэшировать ответы.
2. `get_design_context` по умолчанию отдаёт React + Tailwind с arbitrary values; другой стек — просьбой в промпте;
   большие узлы → «sparse»/обрезка. Вывод MCP в Claude Code ограничен 25k токенов (`MAX_MCP_OUTPUT_TOKENS`).
   `get_variable_defs` отдаёт только переменные выделения. Если у переменной задан **codeSyntax (WEB)**, Dev Mode и MCP
   выводят его → дизайнер ставит codeSyntax = имя CSS-токена, и вывод сразу в наших именах.
3. **Code Connect** — только Organization/Enterprise (Dev или Full seat). React-парсер `*.figma.tsx` объявлен legacy;
   рекомендуемый формат — template files `*.figma.ts`. Без Org — своя карта компонентов в репо.
4. **Переменные.** REST `GET /v1/files/:key/variables/local` — только Enterprise (подтверждено); `tz import` Terrazzo для
   переменных — тоже. Без Enterprise: нативный экспорт мод в JSON (раскатан в ноябре–декабре 2025; формат экспорта
   проверить на реальном файле), Tokens Studio Free (sync одного файла в GitHub/GitLab), TokensBrücke (DTCG), либо
   скрипт Plugin API через `use_figma`. DTCG Format 2025.10 — первая стабильная версия спецификации; Style Dictionary v5
   (Node ≥ 22) и Terrazzo её понимают.
5. **VRT.** Playwright 1.64 (2026-10-07): `toHaveScreenshot` с `animations`, `caret`, `mask`, `stylePath`, `threshold`
   (0.2), `maxDiffPixels(Ratio)`; с 1.62 baseline в WebP. Имена baseline включают платформу → эталоны только из Docker
   `mcr.microsoft.com/playwright:v1.64.0-noble`. **Lost Pixel заархивирован 2026-04-22** (команда ушла в Figma) — не брать.
   Argos: код MIT, self-host не поддерживается, Hobby 5k снимков/мес бесплатно. Chromatic от $179/мес. Vitest 4 browser
   mode `toMatchScreenshot` + Storybook 10 — для компонентов.
6. **Design-vs-code.** Эталон — REST `GET /v1/images/:key?ids=&scale=2&version=` (фиксировать `version`, ссылки живут 30
   дней, лимит 32 Мп). Прямой pixel diff с Figma шумит (собственный рендер текста Figma, line-height `auto` ≠ CSS `normal`,
   дробная геометрия, разные blur/градиенты, ресемплинг картинок). Коммерческий аналог «Figma как baseline» — TestMu
   SmartUI (SaaS); Figma «AI design QA agent» проверяет макет против дизайн-системы, а не против кода (полезен на P1).
7. **Агентные workflow 2026** (Anthropic best practices, buildmvpfast «pixel-perfect loop», Pix skill, OpenAI `design-qa`):
   гейт — детерминированный скрипт с числовыми дельтами (`getBoundingClientRect`/`getComputedStyle`), а не мнение модели
   о скриншоте; подключать как **Stop hook** / verification-сабагент; 3–5 итераций, кап 8, стоп если дельты не падают 3
   раунда. Это ровно ручная практика пользователя (F1.5), только автоматизированная.

### F5. Источники истины и иерархия (из docs/design.md пользователя)

1. Фрейм «что изменено» / конкретный node-id > документация и гайд (гайд исполняется буквально).
2. Проектные константы > геометрия одного фрейма (контейнер 1198 / 440).
3. Юзабилити > пиксель (тач 40×40, 16px в инпуте на iOS).
4. Токен проекта > значение макета **только по решению пользователя** (обычно «бери кодовую»); без решения — ⚠️.
5. Тексты — из словаря, не из слоя. Иконки — из библиотеки (Lucide), stroke пересчитывается под viewBox 24.

## Recommendations for the boilerplate

### R0. Где это живёт и как включается

- Init-скрипт спрашивает «дизайн: Figma от дизайнера / без макета». Ответ «без макета» удаляет весь пакет pixel-perfect
  (скиллы `figma-*`, `tools/figma/`, `design/`, `docs/figma.md`, `docs/design-qa-contract.md`, CI-job `design:fidelity`).
  Code-vs-code VRT остаётся в обоих режимах.
- Пакет стек-нейтрален относительно способа стилизации (CSS Modules / vanilla-extract / Tailwind v4 — решает агент 05):
  контракт с кодом — CSS custom properties из токенов + атрибут-связка DOM↔Figma.
- Связка DOM↔Figma: атрибут `data-figma="<имя слоя>"` (имя из Name map; node-id нестабилен при дублировании фреймов,
  валидированное имя уникально в экране). Ставится на каждый узел из Measurement plan; в production-сборке вырезается
  плагином сборки (или совпадает с `data-test`, который в xRocket и так выводился из имени слоя — тогда отдельный
  атрибут не нужен, решение — Open question 3).

### R1. Пайплайн end-to-end

| # | Этап | Кто/что | Выход | Гейт |
| --- | --- | --- | --- | --- |
| P0 | Контракт с дизайнером | человек, один раз на проект | `docs/design-qa-contract.md` (шаблон в бойлерплейте): брейкпоинты, допуски, иерархия источников, что не бывает pixel-perfect | подписан до первой вёрстки |
| P1 | Handoff-проверка макета | Figma-плагин-линтер (порт `figma-lint` из xRocket) + скилл `figma-preflight` | отчёт blocker/warning/info, подпись в plugin data | 0 blockers, иначе стоп |
| P2 | Синхронизация токенов | экспорт переменных → DTCG JSON в `design/tokens/*.json` → Style Dictionary / Terrazzo → CSS vars + TS | PR с diff токенов | `tokens:check` в CI: сборка детерминирована, нет ручных правок сгенерированного |
| P3 | Маппинг компонентов | `design/component-map.json` (ключ компонента Figma → компонент кода + маппинг variant→props); Code Connect — опционально при Org/Enterprise | Reuse map плана | каждый инстанс либо в карте, либо ⚠️ |
| P4 | План | скилл `figma-implement`, фаза Plan | план с Name map, Reuse map, Measurement plan, Token mapping, Responsive table, Styled/File tree **и `*.figma-spec.json`** (ожидаемые числа по узлам) | approval пользователя по всем ⚠️ |
| P5 | Реализация | агент, блок за блоком (сначала неизменяемый блок) | код + `data-figma` | typecheck/lint после каждого блока; `figma:measure` по блоку зелёный |
| P6 | Автоматическая сверка | `figma:measure` (DOM-замеры против spec), `figma:diff` (картинка против PNG фрейма, advisory), N агентов-инспекторов по секциям | HTML-отчёт: таблица «узел / свойство / Figma / DOM / Δ / статус» + overlay/heatmap | 0 fail вне `design/deviations.md` |
| P7 | Ревью и фиксация | 2 свежих ревьюера (правила + корректность) → пользователь/дизайнер смотрит отчёт → эталоны code-vs-code VRT снимаются в Docker | `design/deviations.md` (принятые отклонения), baseline PNG | sign-off; дальше регрессии ловит VRT |

### R2. P1 — проверка макета до вёрстки (handoff)

Перенести из xRocket почти как есть: грамматику имён (`figma-naming.md`), предикаты (`checks.md` с `CHECKS_VERSION`),
подпись (`signature.md`), чтение токена (`token-setup.md`), drift-тест словаря брейкпоинтов (F1.6). Обобщить:
словарь брейкпоинтов и платформ — из конфигурации проекта (init записывает), а не захардкожен.

Добавить проверки, нужные именно пиксельной точности (новый уровень E в `checks.md`, предложение):

| id | Предикат | Severity |
| --- | --- | --- |
| E1 | Заливка/текст/обводка/радиус/gap/padding не привязаны к переменной или стилю (сырое значение) | warning (⚠️ в Token mapping) |
| E2 | Дробные координаты/размеры (`x=12.5`, `w=343.33`) на узлах вне инстансов | warning |
| E3 | Контейнер с детьми без auto-layout (абсолютная раскладка) и без маркера `@ absolute` | blocker для экранов, warning для иллюстраций |
| E4 | Текст с line-height `auto` или не из text style | warning |
| E5 | Шрифт/начертание, отсутствующее в списке шрифтов проекта | blocker |
| E6 | Отсоединённый инстанс (detached) компонента из библиотеки | warning |
| E7 | Ширина фрейма не равна каноничной ширине брейкпоинта проекта (393/768/1024/1440 и т.п.) | info |
| E8 | Обводка center/outside на элементе, участвующем в layout | info (подсказка маппинга) |

Скилл `figma-preflight` (агентская сторона) повторяет «сверку» из `/new-ui-v2` по `get_metadata` (подпись не видит правок
после прогона), проверяет подключение MCP и тип сида (`whoami`), и говорит пользователю первой репликой: валидирован ли
макет, какая версия правил, сколько вызовов MCP потребуется.

### R3. P2 — токены

- Источник истины для кода — JSON в репо: DTCG 2025.10 (`design/tokens/{primitives,semantic,component}.tokens.json`, слои
  как в docs/design.md §3), режимы light/dark через `$extensions`/resolver. Сборка — Style Dictionary v5 (Node ≥ 22) →
  `tokens.css` (`:root`, `[data-theme=dark]`) + `tokens.ts` (+ `@theme` для Tailwind v4, если стек его выберет). Terrazzo
  — альтернатива (`tz check` удобен как валидатор), но CLI в beta.
- Поступление из Figma без Enterprise (REST Variables API и `tz import` переменных — только Enterprise): по умолчанию
  **свой экспорт DTCG в `figma-lint-plugin`** (плагин уже есть, Plugin API видит коллекции/моды/алиасы на любом плане;
  кнопка «Export tokens» рядом с «Validate»); запасные — нативный экспорт мод Figma, Tokens Studio Free (sync одного
  файла в Git), скрипт через MCP `use_figma`. С Enterprise — nightly job `GET /variables/local` → DTCG → diff → PR.
- CI `tokens:check`: валидация DTCG + rebuild + `git diff --exit-code` по сгенерированным файлам; цвета сравнивать после
  нормализации (Figma хранит float 0..1 → hex8 с округлением до 1/255), иначе ложный дрейф.
- Дизайнер ставит переменным **codeSyntax WEB** = имя CSS-переменной: тогда Dev Mode и `get_design_context` выдают наши
  имена токенов, и маппинг «значение → токен» в плане становится механическим.
- Правило направления: **Figma → репо** через PR с читаемым diff («color/neutral/9: #8B8D98 → #8A8C97»). Ручные правки
  сгенерированных файлов запрещены (lint/hook). Значение, которого нет в токенах, в код не попадает без решения
  пользователя (как сейчас в docs/design.md).
- `get_variable_defs` в MCP — для плана (какие токены и i18n-ключи висят на узле), а не для синхронизации: он отдаёт
  только переменные выбранного узла.
- Тест дрейфа в духе `check-figma-breakpoints.test.mjs`: брейкпоинты, шкалы радиусов/отступов, список шрифтов в
  `design-qa-contract.md` ↔ в коде.

### R4. P3 — компоненты

- `design/component-map.json`: `{ figmaComponentKey | имя набора: { component: "@ui/Button", props: { "Variant=Primary": { variant: "primary" } } } }`.
  Заполняется при создании компонента UI-кита (скилл `new-component` добавляет строку). Скилл вёрстки строит Reuse map
  из карты, затем grep — как фолбэк.
- Code Connect — если у команды Org/Enterprise и Dev seats: тогда `get_design_context` сам отдаёт реальный импорт
  компонента. Это только Organization/Enterprise; React-парсер `*.figma.tsx` уже legacy, формат — template files
  `*.figma.ts`. Для маленькой команды на Professional своя JSON-карта — единственный путь и работает с любым MCP.
  Формат карты держать близким к Code Connect (ключ компонента + маппинг variant→props), чтобы при переходе на Org её можно
  было сконвертировать скриптом.
- Storybook: история на каждый вариант из Figma (docs/components.md §10) + параметр `design: { figmaNode: '<url>' }`
  (addon-designs) — даёт overlay при ручной проверке.

### R5. P4–P5 — правила для агента-верстальщика (в `docs/figma.md` + скилл `figma-implement`)

1. Порядок MCP: `get_metadata` → baseline = самый узкий фрейм → `get_screenshot` baseline (ориентир) →
   `get_variable_defs` → точечный `get_design_context` только по Measurement plan. Никогда на корень экрана.
   Официальный скилл `figma-design-to-code` не заменяет этот порядок (F2); если плагин Figma установлен, наш скилл
   явно говорит, какие его правила не действуют (иконки из payload, «подогнать под токен»).
2. Числа — только из `get_design_context`/REST JSON. Со скриншота пиксели не мерить. Нет числа — ⚠️.
3. Каждое значение → токен; нет токена → ⚠️ в плане, ближайший токен молча не подставлять.
4. Маппинг-таблица F3 обязательна к применению: stroke inside → вычесть из padding или `inset box-shadow`; явный
   line-height; letter-spacing % → em; hug/fill/fixed → правила flex; абсолютное позиционирование только для узлов,
   которые в макете absolute.
5. Строить блок за блоком, начиная с блока, который не меняется; после каждого блока — `figma:measure --node <имя>`;
   следующий блок только при зелёном замере или записанном ⚠️.
6. Каждый узел из Measurement plan получает `data-figma`. Узел без строки в Name map не создаётся.
7. Шрифты: подключить те же файлы (woff2, та же версия), что у дизайнера; проверить `document.fonts.check()` в тесте.
8. Тексты — из словаря i18n; иконки — из библиотеки иконок проекта с пересчётом stroke под viewBox 24; ассеты-иллюстрации
   — экспорт из Figma, light/dark версии.
9. Юзабилити-правила (тач ≥ 40×40, 16px в инпутах iOS) выше макета: расхождение записывается в deviations с причиной,
   а не исправляется молча.
10. Перед сдачей — список «что сделано, но не описано в макете» и «где отступил от макета и почему».

### R6. P6 — автоматическая сверка (ядро системы)

Три независимых сигнала, потому что ни один не надёжен сам по себе:

**(a) `figma:measure` — замеры DOM против spec (блокирующий, главный).**
- `tools/figma/fetch-spec.mjs`: по fileKey + списку фреймов берёт REST `GET /v1/files/:key/nodes?ids=…` (geometry,
  `absoluteBoundingBox`, `paddingLeft…`, `itemSpacing`, `style` текста, `fills`, `strokes`, `strokeAlign`, `cornerRadius`,
  `boundVariables`) и пишет `design/specs/<flow>-<state>@<bp>.figma-spec.json`: для каждого узла Name map — бокс
  относительно фрейма, padding, gap, typography, цвет как **имя токена** (через boundVariables), радиус, обводка с
  выравниванием. Кэш по `version` файла в `.figma-cache/` (gitignore). Spec коммитится — это снимок макета, по diff видно,
  что дизайнер поменял.
- `tools/figma/measure.spec.ts` (Playwright): для каждого фрейма открывает route/story в вьюпорте ширины фрейма,
  `deviceScaleFactor: 1`, обе темы, ждёт `document.fonts.ready`, отключает анимации (как в xRocket), находит
  `[data-figma="…"]`, снимает `getBoundingClientRect()` (относительно корня экрана) и `getComputedStyle()`, сравнивает с
  spec по допускам R7, выводит таблицу и JSON; падает на fail вне deviations. Текст мерится по блочному контейнеру (у
  inline-узла DOMRect = content area, не line box), число строк — через `getClientRects()`/высоту ÷ line-height.
- Spec генерируется скриптом с PAT от Dev/Full seat (REST Tier 1: 10–20 запросов/мин; у View/Collab ~20 в месяц) и
  коммитится вместе с `meta.json` (fileKey, nodeId, `version`, lastModified): агент и CI работают с кэшем, лимиты MCP
  тратятся только на план.
- Цвет сравнивается по токену: computed `rgb()` сопоставляется значению токена в текущей теме; hex в макете без
  переменной уже отмечен на P1/P4.
- Запуск: локально в контейнере (тот же образ, что CI) и в CI как job `design:fidelity` на MR, которые трогают UI.

**(b) `figma:diff` — картинка против картинки фрейма (advisory, не блокирует).**
- Экспорт PNG фрейма `GET /v1/images/:key?ids=…&scale=2&format=png&version=<v>` (ссылки живут 30 дней → PNG кладётся в
  `design/frames/<screen>@2x.png` рядом со spec), рендер того же экрана в Docker при той же ширине и
  `deviceScaleFactor: 2` (`scale: "device"`), тестовые данные = тексты макета (фикстура), маски на динамике.
- pixelmatch/odiff с антиалиас-детекцией → heatmap + процент по каждому узлу (кроп по боксу из spec), а не по всему кадру:
  так diff указывает на элемент (урок «страница на 1px выше»).
- HTML-отчёт с тремя видами: рядом, «луковица» (opacity-слайдер), heatmap. Это заменяет ручное «наложить PerfectPixel».
- Не блокирует, потому что текст Figma и браузера растеризуется по-разному (F3); порог только сигнализирует «посмотри».
  Для кропов полезен SSIM (`ssim.js`) или pixelmatch после лёгкого размытия обоих кадров — меньше шума от текста;
  пороги калибруются на первых экранах проекта, а не берутся из статей.

**(c) Агенты-инспекторы по секциям (по запросу или на большом экране).**
- `.claude/agents/figma-section-inspector.md`: read-only, получает одну секцию (поддерево Name map), spec, результаты
  (a) и (b), кропы; сверяет то, что тестом не формализуется (состояния, иконки, переносы, порядок, отсебятина), и
  возвращает строки «узел / проблема / причина / фикс / уверенность». Оркестратор сливает в одну таблицу, проверяет
  находки руками (docs/workflow.md §6) и только потом показывает пользователю.
- Число агентов = числу секций верхнего уровня (у пользователя было 7), не больше ~8.

**(d) Петля агента и жёсткий гейт.** Во время P5 агент гоняет `figma:measure` по своему блоку и правит по числовым
  дельтам (не по скриншоту). Кап — 5 итераций на блок; если дельты не уменьшаются 2–3 раунда — стоп и вопрос (типично:
  не тот шрифт, `auto` line-height, inside-обводка, нет токена). Завершение задачи блокируется Stop-хуком скилла
  `figma-implement`: пока `figma:measure` по экранам задачи не зелёный (или каждое отклонение не записано в
  deviations/⚠️), агент не может сказать «готово». Опубликованные агентные workflow 2026 (F4.7) сходятся ровно на этом:
  гейт — скрипт, а не мнение модели.

**(e) Code-vs-code VRT (после одобрения, блокирующий).** Как в xRocket: Playwright `toHaveScreenshot`, 2 темы × 3
ширины, эталоны только из Docker (`mcr.microsoft.com/playwright:v<версия>-noble`, тег = версия `@playwright/test`),
`maxDiffPixelRatio: 0.01`, `animations: "disabled"`, `caret: "hide"`, `mask` на динамику, `stylePath` для стабилизации,
baseline в WebP (Playwright ≥ 1.62). Компоненты — Storybook 10 + Vitest 4 browser mode `toMatchScreenshot`. SaaS (Argos
Hobby) — опционально ради review-UI; Lost Pixel не брать (архив). Он не про Figma, а про то,
чтобы принятая вёрстка не уехала.

### R7. Допуски (стартовые значения для `design-qa-contract.md`, согласуются с дизайнером)

| Свойство | Допуск | Почему |
| --- | --- | --- |
| padding, gap, радиус, толщина обводки, размеры не-текстовых боксов (иконка, аватар, кнопка фикс. высоты) | 0 (±0.5 на округление) | детерминировано, браузер воспроизводит точно |
| позиция бокса относительно экрана | ±1px | накопление округлений |
| высота бокса, зависящая от текста | ±1px на строку | метрики шрифта / line-height |
| ширина текста (hug) | ±2px или ±2% | шейпинг и хинтинг различаются |
| число строк текста при тексте макета | точно | иначе — другой перенос, это баг |
| font-size, font-weight, line-height, font-family | точно | |
| letter-spacing | ±0.01em | % → em округление |
| цвет | точно по токену; без токена ΔE2000 ≤ 1 | |
| тень/блюр | токен; визуально advisory | разные модели блюра |
| картинка против PNG Figma (кроп узла) | advisory: > 3% пикселей при pixelmatch `threshold: 0.1` → «посмотри» | текстовый шум |
| code-vs-code VRT | `maxDiffPixelRatio: 0.01` в Docker | измерено в xRocket |
| Ширины вне нарисованных фреймов | не проверяются на пиксель; только «нет горизонтального скролла, нет наложений» | макета нет |

Отклонение, принятое пользователем, записывается в `design/deviations.md` строкой `экран · узел · свойство · Figma · код ·
причина · кто решил · дата`; `figma:measure` читает файл и не падает на этих строках (аналог «Deliberate, do not fix»).

### R8. Что автоматизировать, а что оставить человеку

| Автоматически | Вручную |
| --- | --- |
| Линт макета и подпись (плагин) | Решения по ⚠️ (нет токена, конфликт макет/код) |
| Сверка подписи и «сверка» метаданных (скилл) | Утверждение плана (approval gate) |
| Экспорт и сборка токенов, diff токенов в PR | Решение, принять ли изменение токена дизайнером |
| Генерация spec из Figma, замеры DOM, отчёт | Состояния, которых нет в макете (hover/focus/error/empty) |
| Diff картинок с heatmap по узлам | Оценка advisory-diff и анимаций |
| VRT регрессий в CI | Sign-off экрана пользователем/дизайнером, запись deviations |
| Агенты-инспекторы по секциям | Проверка на реальном устройстве (iOS Safari, Telegram) |

### R9. Что бойлерплейт поставляет (по приоритету)

1. **Документы**: `docs/figma.md` (правила R5 + маппинг F3 + порядок MCP), `docs/design-qa-contract.md` (шаблон P0 с
   допусками R7 и ограничениями R10), `docs/figma-lint/*` (порт из xRocket, обобщённый), `design/deviations.md` (пустой).
2. **Скиллы**: `figma-preflight` (MCP, сид, подпись, сверка), `figma-implement` (наследник `/new-ui` + `/new-ui-v2` в одном
   скилле с ветками VALIDATED/UNVALIDATED; добавлены `*.figma-spec.json` и петля замеров по блокам), `figma-verify`
   (запускает measure + diff, при необходимости инспекторов, собирает отчёт), `tokens-sync`.
3. **Скрипты** (Node `.mjs`, кроссплатформенно — docs/tooling.md §11): `tools/figma/fetch-spec.mjs`,
   `tools/figma/fetch-frames.mjs` (PNG), `tools/figma/measure.spec.ts`, `tools/figma/diff.mjs` + HTML-отчёт,
   `tools/tokens/build.mjs`; npm-скрипты `figma:spec`, `figma:measure`, `figma:diff`, `tokens:build`, `tokens:check`,
   `test:visual`, `test:visual:update` (Docker).
4. **Агенты** (`.claude/agents/`): `figma-section-inspector` (read-only), `design-fidelity-reviewer` (свежий, без
   контекста разработки, с правилами), использует общий ревьюер правил из пакета агентов 08.
5. **Docker**: образ тестов с фиксированной версией Chromium и шрифтами проекта (без системных fallback), единый для
   VRT, measure, diff.
6. **CI**: `design:fidelity` (measure, блокирующий на MR с изменениями UI), `test:visual` (VRT, блокирующий),
   `figma:diff` — артефакт-отчёт.
7. **Настройки Claude Code**: Stop-хук `figma-implement` (R6d); `MAX_MCP_OUTPUT_TOKENS=50000` в env проекта; Figma MCP
   (`figma@claude-plugins-official` или `claude mcp add --transport http figma https://mcp.figma.com/mcp`) — в списке
   рекомендованных, а не обязательных серверов (нужен только в режиме Figma); PAT в env `FIGMA_TOKEN` вне репо
   (`token-setup.md` из xRocket).
8. **Требование к доступам** (в README режима Figma): у разработчика/агента Dev или Full seat на платном плане, файл
   макета в платной команде. Без этого MCP и REST дают 6–20 вызовов в месяц — пайплайн не работает.
9. **Figma-плагин** — отдельный репозиторий (как в xRocket), не часть бойлерплейта; бойлерплейт фиксирует только контракт
   (`CHECKS_VERSION`, формат подписи, формат экспорта токенов).

Чего не делать:
- не делать pixel-diff против Figma блокирующим (шум текста — гарантированные ложные падения);
- не строить скилл поверх `get_design_context` на целый экран (дорого, sparse/обрезка, абсолютные координаты);
- не принимать официальный `figma-design-to-code` как правила проекта без обёртки (F2);
- не снимать эталоны на хосте для CSS, зависящего от платформы (F1.4) — в бойлерплейте вообще только Docker;
- не брать Lost Pixel (архив) и не завязываться на SaaS (Chromatic/Percy) как на обязательный шаг — противоречит
  self-hosted Docker CI;
- не принимать вывод `get_design_context` как код: Tailwind arbitrary values и `absolute` — это описание, а не реализация.

### R10. Что никогда не будет pixel-perfect (и как договориться)

1. **Растеризация текста** (антиалиасинг, хинтинг, субпиксели) — Figma, Windows, macOS, Linux, iOS отличаются всегда.
   Договорённость: текст сверяется метриками (кегль, вес, межстрочный, число строк, ширина ±2%), не пикселями.
2. **Переносы строк на реальных данных и в других языках** (русский длиннее английского, числа, имена) — макет
   показывает один текст. Договорённость: дизайнер даёт правила (обрезка/перенос/max-lines), сверка — на тексте макета.
3. **Ширины между нарисованными фреймами** — поведение не задано. Договорённость: fluid между брейкпоинтами, проверка
   только «нет скролла/наложений»; нужна точность — нужен фрейм.
4. **Нативные контролы и системный UI**: скроллбары, `select`, date picker, автозаполнение, safe-area, клавиатура, шапка
   Telegram и её цвета из `themeParams` (TMA). Договорённость: вне сверки, фиксируется в контракте.
5. **Блюр, тени, градиенты, blend modes** — модели рендера разные. Договорённость: токен + визуальный advisory.
6. **Дробные значения** — браузер округляет к device pixels; на DPR 1 и 3 результат разный. Договорённость: дизайнер
   рисует целыми числами на сетке 4/8, линии 0.5px только осознанно («пол пикселя» — решение пользователя).
7. **Шрифт другой версии** (у дизайнера локально установлен Inter другой версии, чем в `@fontsource`) — метрики и
   кернинг разойдутся. Договорённость: версия шрифта указана в контракте, дизайнер использует ту же.
8. **Иконки из библиотеки** вместо экспортированных SVG — геометрия глифа может отличаться (принято в docs/design.md §4).
9. **Состояния и анимации**, которых нет в макете, — не «pixel-perfect», а решения по системе (docs/design.md §5–6).
10. **Юзабилити-правки** (тач-зоны, 16px в инпутах) — сознательные отклонения, записываются в deviations.

Форма договорённости: `docs/design-qa-contract.md` подписывается в начале проекта (P0); всё спорное идёт в
`design/deviations.md` с автором решения. Дизайнер видит HTML-отчёт `figma:verify` (таблица + overlay), а не «на глаз
похоже».

## Open questions for the user
1. Есть ли у команды (и у машины агента) Dev или Full seat на платном плане Figma, и в какой команде лежат макеты? От этого
   зависит, работает ли MCP и REST вообще (иначе 6–20 вызовов в месяц).
2. План Figma: Professional или Organization/Enterprise? На Org+ можно взять Code Connect и (на Enterprise) REST Variables API
   вместо своей карты компонентов и экспорта токенов плагином.
3. Связка DOM↔Figma: отдельный атрибут `data-figma` (вырезается из прод-сборки) или единый `data-test`, выведенный из имени
   слоя, как в xRocket?
4. Развивать `figma-lint-plugin` из xRocket как общий инструмент (новый уровень проверок E и экспорт токенов в DTCG) или
   начать с готовых плагинов (Tokens Studio Free, нативный экспорт Figma)?
5. Делать `design:fidelity` (числовые замеры) блокирующим CI-job на MR с изменениями UI или только локальным гейтом агента?
6. Стартовые допуски из R7 устраивают, или нужен строже/мягче (например, 0px для позиций)?
7. Кто подписывает приёмку экрана: сам пользователь или дизайнер проекта, и в каком виде ему удобнее отчёт (HTML-артефакт
   с overlay, Storybook с addon-designs, таблица в MR)?
