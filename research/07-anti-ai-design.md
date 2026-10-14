# 07. Как не делать дизайн, похожий на AI
Status: done
Updated: 2026-10-14 (финал)

## Resume notes
- Done: всё. Прочитаны 00-brief, 03 (U1–U35), docs/design.md, скилл frontend-design, 02-design-ai-analysis,
  00-xrocket-session-context §3. Веб-исследование (§F9). Написаны Summary, F1–F9, H1–H45, рекомендации, вопросы.
  Интегрирован 07a.
- Next: ничего.
- Sub-agent: 07a-anti-ai-templates.md — done (правила по шаблонам L/S/T/A/G).
- Скачанные первоисточники (только для чтения): scratchpad сессии `impeccable/` (craft-floor.md, new-work.md,
  operate.md и др.) и `emil/` (emil-design-eng SKILL.md).

## Summary (≤ 15 lines)
1. «AI-вид» возникает не из одной детали, а из того, что свободные оси дизайна заполнены самым вероятным выбором
   модели. Anthropic называет это distributional convergence (статья от 2025-11-12). Лечится это решениями до кода
   (бриф, токены, референсы) и машинными проверками после, а не просьбой «сделай красиво».
2. Запрет одного дефолта рождает следующий. «Вторая волна» (кремовый фон + сериф + терракота, near-black + неон,
   газетные линейки + mono-метки, Space Grotesk / DM Sans / Plus Jakarta / Fraunces) сегодня такой же признак AI, как
   Inter + фиолетовый градиент. Список запретов должен включать обе волны.
3. Шаблоны делятся на два режима. Operate (admin, TMA, корзина и чекаут магазина) — привычность важнее
   выразительности, смелость запрещена. Persuade/Experience (лендинг, витрина магазина, игра) — одна смелая вещь на
   фоне дисциплины. У TMA своя смелость запрещена вдвойне: цвета, шрифт и хром даёт Telegram.
4. Ниже 45 жёстких правил (H1–H45). У каждого есть проверка, и у 33 она машинная: stylelint, ESLint/Tailwind,
   линтер текстов i18n, Playwright-скан DOM. Обязательные среди них: нет градиентного текста, свечений, неоновых
   обводок, градиентных кнопок, eyebrow-капса, em dash в UI-тексте, эмодзи вместо иконок, подъёма карточек на hover,
   fade-up на каждой секции, `transition: all`, bounce-easing, карточек в карточках, теней на неплавающих слоях,
   иконок в пастельных квадратах, придуманных цифр и отзывов.
5. Процесс для агента: `DESIGN.md` приложения (режим, сцена, 3–5 референсов, палитра 4–6 ролей, шрифты, шкалы, одна
   запоминающаяся вещь) → проверка плана на «то же вышло бы для любого похожего брифа» → код → матрица скриншотов
   (2 темы × 390/1024/1440) → чек-лист самокритики → скан → свежий агент-ревьюер.
6. Boilerplate должен поставлять: stylelint-пресет «anti-slop», сброс дефолтной темы Tailwind (`--color-*: initial`
   и т.д.), линтер копирайта (`lint:copy`), Playwright-скан `design:scan`, агента `design-reviewer`, обновлённый скилл
   `frontend-design` с режимами и списками второй волны, список запрещённых шрифтов и цветовых паттернов.
7. Правила почти не конфликтуют с вкусом пользователя (минимализм, токены, ничего лишнего). Одно уточнение к
   `docs/design.md` §5: «hover у каждой строки» означает смену фона или цвета у интерактивного элемента. Подъём,
   масштаб и тень на hover запрещены.

## Findings

### F1. Почему AI-дизайн выглядит одинаково (факты)
- **Сходимость к центру распределения.** Anthropic: «Safe design choices… dominate web training data… Without
  direction, Claude samples from this high-probability center.» Их же вывод: модель хорошо управляется явными
  запретами и указаниями (статья «Improving frontend design through Skills», 2025-11-12,
  https://claude.com/resources/articles/improving-frontend-design-through-skills).
- **Фиолетовый — дефолт Tailwind.** Tailwind UI использовал `bg-indigo-500` для демо-кнопок. По словам автора,
  Адам Уотан извинился за это в августе 2025 (https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website,
  2025-10-26). Первоисточник (пост в X) я не проверял. Значит, фиолетовый появляется, когда модель заполняет пустоту,
  а не из-за самой библиотеки (https://codemyspec.com/blog/vibe-coded-websites-look-the-same).
- **shadcn сам признал проблему.** В релизе `npx shadcn create` (декабрь 2025) команда пишет, что все приложения стали
  выглядеть одинаково, и добавляет пять стилей (Vega, Nova, Maia, Lyra, Mira). Источник вторичный:
  https://releases.sh/release/rel_GIPYiFS2HOMjsnqNjJQM3.
- **NN/g (2025-10-24, пересмотрено 2026-08-19).** Без визуальной спецификации AI-инструменты выдают «similar, generic
  look»: минимализм, обычный sans-serif, яркий акцент на нейтральном фоне. Экраны «flat and interchangeable», «good
  from afar, but far from good». Лучший результат даёт ссылка на Figma-фрейм или референсы и решения, принятые до
  промпта (https://www.nngroup.com/articles/ai-prototyping/).
- **Вторая волна.** Если запретить Inter и фиолетовый, агент уходит в следующий кластер. Это кремовый фон + сериф +
  терракота, near-black + один неон, «газетная» вёрстка с линейками и mono-метками, необрутализм с жёсткими тенями
  (https://capitalandcompute.net/blog/fix-ai-slop-design/, impeccable `reference/new-work.md`). Пример в самих
  источниках: рекомендации Anthropic 2025 года (Space Grotesk, Playfair, Bricolage Grotesque, JetBrains Mono,
  «атмосферные градиентные фоны», «staggered reveals» при загрузке) через год стали признаками AI. impeccable 4.5
  прямо перечисляет Space Grotesk, Fraunces, Playfair, DM Sans, Plus Jakarta Sans, Instrument Sans как «training-data
  defaults». **Вывод: список запретов должен жить и обновляться, а не быть списком «модных альтернатив».**
- **Слоп — это и отсутствие функции.** Генерации без брифа теряют валидацию, ошибки, пустые состояния и доступность.
  Модель учится на статичном коде, а не на сценариях (prg.sh; Kosta Canatselis,
  https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c).
- **Признак комбинируется.** Отдельный тэлл (тёмная тема, карточки, Inter) не делает дизайн слопом. Слоп — это
  сочетание 3+ дефолтов. В pixelslop шкала такая: 0–1 паттерн CLEAN, 2–3 MILD, 4–6 SLOPPY, 7+ TERMINAL
  (https://cdn.jsdelivr.net/npm/pixelslop@0.3.8/dist/skill/resources/ai-slop-patterns.md). Поэтому ниже правила
  делятся на абсолютные (H) и пороговые (скан с лимитом).

### F2. Каталог тэллов по категориям (сводка источников, 2025–2026)
| Категория | Тэллы первой волны | Тэллы второй волны |
| --- | --- | --- |
| Цвет | фиолетово-синий градиент, indigo-500/violet-600, градиентный текст, пастельные плитки «для разнообразия» | крем #F4F1EA + терракота ~#D97757; near-black #0B0B0B/#111 + acid-green/vermilion/cyan #00D4FF; цветное свечение (`box-shadow` 0 0 Npx accent) |
| Шрифт | Inter/Roboto/Open Sans/Arial везде, системный по умолчанию | Space Grotesk, Space Mono, DM Sans/Serif, Plus Jakarta, Outfit, Syne, Instrument, Fraunces, Playfair, Cormorant, Newsreader, Bricolage; mono для «технологичности»; italic-сериф в заголовке |
| Типографские приёмы | одно слово в заголовке другим цветом/курсивом/градиентом | ALL-CAPS eyebrow с трекингом над каждым заголовком; `A · B · C`; `WORD — fragment`; `→` в кнопке; 01/02/03 без последовательности |
| Раскладка | центрированный hero с pill-бейджем, двумя кнопками, логотипами; 3 одинаковые карточки «иконка + заголовок + текст»; фиксированный порядок секций hero→features→social proof→pricing→FAQ | газетные колонки с hairline-линейками и нулевым радиусом; бенто-сетка ради бенто |
| Контейнеры | всё в карточках, карточка в карточке, один большой радиус везде (`rounded-2xl`), одна мягкая тень `rgba(0,0,0,.1)` | цветная полоска слева на скруглённой карточке; жёсткая офсетная тень `4px 4px 0` |
| Глубина | glassmorphism, `backdrop-blur` на панелях | glow, неоновые обводки на тёмном |
| Движение | fade-and-slide-up у каждой секции, подъём карточек на hover, bounce/elastic, count-up цифр, `animate-pulse` «Live»-точки | «оркестрованная» загрузка страницы в продукте, где пользователь пришёл работать |
| Иконки | иконка над каждым заголовком, иконка в цветном квадрате, эмодзи вместо иконок, ✨ для AI | одна pulse-иконка для разных сущностей; стоковая иконка как логотип |
| Данные | hero-метрика: большое число + маленькая подпись + `+12%` + спарклайн | декоративные прогресс-кольца, спарклайны без осей |
| Текст | «Elevate / Unlock / Seamless / Supercharge / Empower», «Get started» ×3, слоган вместо названия экрана | em dash в каждом подзаголовке, «Built for X. Designed for Y.», придуманные цифры «10,000+ teams», выдуманные отзывы |
| Состояния | только happy path; пустое состояние «настроение» («Your day has room for care») | галочка для «нет данных», «Live»/«New»-бейджи без реального статуса |

Источники: pixelslop (26 визуальных + 16 исходниковых паттернов с порогами), capitalandcompute, Kosta Canatselis,
codemyspec, noqta.tn (2026-06-04, https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026),
impeccable craft-floor (https://github.com/pbakaus/impeccable, `.claude/skills/impeccable/reference/craft-floor.md`),
NN/g про ✨ (https://nngroup.com/articles/ai-sparkles-icon-problem/), Big Medium
(https://bigmedium.com/ideas/your-sparkles-are-fizzling.html), наш 02-design-ai-analysis (Awaaz) и скилл
`frontend-design` репозитория.

**Em dash.** Ассоциация «— значит ChatGPT» массовая с начала 2025. OpenAI в ноябре 2025 отдельно чинил, чтобы ChatGPT
слушался инструкции не ставить тире (https://www.techcrunch.com/2025/11/14/openai-says-its-fixed-chatgpts-em-dash-problem/).
Как детектор текста это слабый признак (https://www.plagiarismtoday.com/2025/06/26/em-dashes-hyphens-and-spotting-ai-writing/),
но в UI-строках его надёжно видят пользователи. Пользователь уже запретил em dash в выводе агентов (output style
Human). **Важно для русского:** тире между подлежащим и сказуемым грамматически обязательно («Цель — 100 000»). Правило
H32 поэтому запрещает тире в ярлыках, кнопках, заголовках и конструкции «Слово — фрагмент», а в полных предложениях
русского текста разрешает.

### F3. Чему учат сильные человеческие продукты (проверенные факты)
- **Linear, редизайн 2024** (https://linear.app/now/how-we-redesigned-the-linear-ui). Тема строится из 3 переменных
  (base, accent, contrast) вместо 98, цвет в LCH, чтобы одинаковая светлость выглядела одинаково. Синий хром
  сознательно ограничен ради «neutral and timeless». Inter Display для заголовков, Inter для остального. Отступы и
  выравнивание по стандартам Apple.
- **Linear, «A calmer interface», 2026-03-12** (https://linear.app/now/behind-the-latest-design-refresh). Сайдбар
  приглушён, чтобы главным был контент. Иконок меньше, они мельче, цветные подложки у иконок команд убраны. Разделителей
  меньше, их контраст снижен: структура «felt not seen». Плотность сохранена. **Вывод: зрелый продукт улучшается
  удалением, и это совпадает с правилом пользователя «сначала удалить, потом добавить».** Inter здесь не тэлл: это
  выбранный шрифт с отдельным display-начертанием внутри системы, где всё остальное решено.
- **Vercel Web Interface Guidelines** (https://vercel.com/design/guidelines). Это лучший машинно-проверяемый список
  «ремесла», которого у генерации нет. Нет `transition: all`; анимируются только `transform`/`opacity`;
  `prefers-reduced-motion`; hit target ≥24px (на мобиле 44); input ≥16px; кавычки «умные», `…` одним символом;
  `tabular-nums` для сравнения чисел; неразрывный пробел между числом и единицей; тень из 2 слоёв; радиус потомка ≤
  радиуса родителя; на цветном фоне бордеры, тени и текст тонируются в тот же оттенок; hover/active/focus контрастнее
  покоя; `color-scheme: dark`; `theme-color`; скелетон повторяет контент; у каждого экрана есть следующий шаг.
- **Apple HIG, Liquid Glass (обновление 2025-06-09).** «Don't use Liquid Glass in the content layer». Стекло — слой
  управления и навигации над контентом, не карточки. Цитата по зеркалу HIG
  (https://glama.ai/mcp/servers/@tmaasen/apple-dev-mcp/blob/b82f0efe2115dc4539c83a2374a714a84aeb350a/content/universal/materials.md),
  официальную страницу не открывал. Это прямой аргумент для H17 (blur только у хрома).
- **Material 3 Expressive (май 2025).** По данным Google (46 исследований, 18 000+ участников), ключевое действие
  находят до 4 раз быстрее, если оно крупнее и лучше расположено. Выразительность здесь служит иерархии, а не
  украшению. Данные собственные, на концепт-макетах
  (https://design.google/library/expressive-material-design-google-research).
- **Radix Colors** (https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale): 12 ступеней с
  ролями: 1–2 фоны, 3–5 фоны элементов (покой, hover, active), 6–8 бордеры, 9–10 сплошной акцент, 11–12 текст. Это
  ровно схема xRocket (03, U1) и готовая защита от «пастели для разнообразия»: цвет берётся по роли ступени.
- **Emil Kowalski, skills** (https://github.com/emilkowalski/skills, `skills/emil-design-eng/SKILL.md`). Анимация
  зависит от частоты. 100+ раз в день или с клавиатуры — без анимации. Десятки раз в день (hover, навигация по
  списку) — убрать или сильно сократить. Редкие события — можно. UI-анимации < 300 мс: кнопка 100–160, тултип
  125–200, дропдаун 150–250, модалка/дровер 200–500. По умолчанию ease-out, никогда ease-in. Не начинать с
  `scale(0)`, минимум 0.95. Press `scale(0.97)`. Popover растёт от триггера, модалка от центра. Hover только в
  `@media (hover: hover) and (pointer: fine)`.
- **Butterick, Practical Typography** (https://practicaltypography.com/letterspacing.html): капс и капитель получают
  +5–12% трекинга, строчные не разрежаются.
- **impeccable** (Paul Bakaus, Apache-2.0, v4.5.2, https://github.com/pbakaus/impeccable). Самый развитый открытый
  анти-слоп набор: детектор с 59 правилами, режимы поверхностей, «craft floor». Ценные формулировки:
  - eyebrow над заголовком — абсолютный запрет, «no brief earns it back»;
  - светлую или тёмную тему выбирают по сцене использования («who, where, under what light»), а не по категории;
  - темизировать выделение текста, каретку, скроллбары, фокус, `text-underline-offset`, табличные цифры: «cheapest
    signal that a page was built rather than assembled».

### F4. Режимы поверхностей и шаблоны (ключевая рамка)
Классификация impeccable (`SKILL.md`, `reference/operate.md`) хорошо ложится на наши шаблоны.

| Режим | Успех посетителя | Шаблоны | Где смелость | Что запрещено |
| --- | --- | --- | --- | --- |
| Operate | выполнил задачу | admin, TMA, кабинет, корзина и чекаут shop | только в деталях: точная типографика, состояния, плотность | display-шрифты в UI, декоративное движение, orchestrated-загрузка, «новые» контролы ради вкуса, модалка как первый выбор |
| Persuade | понял и сделал действие | landing, главная и PDP shop | одна вещь: первый экран, продукт в работе, авторская фотография или типографика | шаблонный порядок секций, придуманные цифры, декор вместо доказательства |
| Read | понял | блог, docs | ритм чтения, мера строки 65–75ch | карточки вместо текста |
| Experience | внутри произведения | game | мир игры ведёт, интерфейс уступает | UI, не связанный с миром игры (стекло, неон «по умолчанию») |

Для Operate impeccable прямо разрешает системные шрифты, стандартную навигацию, плотность и «consistency over
surprise». Шкала 1.125–1.2, переходы 150–250 мс. **Следствие для нас:** Inter или системный стек в admin и TMA — не
нарушение. Нарушение — шрифт из reflex-списка как голос лендинга без записанной причины.

### F5. Слоп и человеческий подход по шаблонам
Ниже краткая версия. Полная версия по каждому шаблону лежит в `research/07a-anti-ai-templates.md` (Status: done):
12–14 тэллов, эталоны, 10–12 правил и «первый запоминающийся элемент». Правила шаблонов имеют ID L1–L10 (landing),
S1–S10 (shop), T1–T12 (TMA), A1–A12 (admin), G1–G12 (game) и **дополняют** H1–H45: H — пол для всех, L/S/T/A/G —
сверху для своего шаблона. Ключевые факты из 07a:
- **TMA.** Design Guidelines Telegram требуют повторять стиль и поведение компонентов Telegram и брать цвета темы
  из API с обновлением при смене (https://core.telegram.org/bots/webapps). Отсюда правила:
  - T1 — только `--tg-theme-*`;
  - T2 — `themeChanged`;
  - T3, T4 — только `BackButton` и `BottomButton`/`SecondaryButton`;
  - T6 — без `100vh`, высота по `--tg-viewport-stable-height`;
  - T7 — системный шрифт;
  - T9 — без `backdrop-filter`, слабые Android WebView;
  - T12 — без белой вспышки в тёмной теме.
- **Shop (Baymard).**
  - Брошенные корзины 70.19%. В среднем 23.48 элемента формы чекаута против идеала ~12 (S5: ≤ 8 видимых полей,
    гостевой заказ).
  - Нужно ≥ 3 миниатюры в карточке листинга; hover-zoom их не заменяет (S4).
  - Распределение рейтинга нужно для доверия (S2).
  - Никаких захардкоженных рейтингов, бейджей, «Free shipping» и таймеров (S1, S6). Цена через
    `Intl.NumberFormat` (S3).
- **Admin.**
  - NN/g: pie, donut, gauge и 3D избегать (A3).
  - У «±N%» обязательны период и полярность (A2).
  - Одна главная метрика ≥ 2× вторичных, вторичных ≤ 4 (A4).
  - «Live» только для данных, которые обновляются чаще 15 с (A8).
  - Сайдбар приглушён, верхнего уровня ≤ 7 пунктов (A12, Linear 2026).
- **Game.**
  - Xbox XAG 101: текст ≥ 18 px на PC и mobile (G3).
  - Запрещены Orbitron, Press Start 2P, Audiowide, Bungee, Exo, Rajdhani (G1).
  - HUD не импортирует общий UI-кит (G9).
  - Пауза на `visibilitychange` (G7).
  - В TMA вызывать `disableVerticalSwipes()` (G8).
  - Первый экран — игра, а не «Daily reward» (G11).
  - Читаемость в 3 уровня (Zach Gage, Into the Breach), «сок» главного действия (Balatro).

**Landing (Persuade).**
- Слоп: центрированный hero «pill-бейдж → H1 с одним цветным словом → подзаголовок → 2 кнопки → логотипы»,
  фиолетовое свечение за мокапом, 3 карточки фич с иконками в квадратах, бенто, count-up статистика, отзывы со
  стоковыми аватарами, fade-up у каждой секции, «Get started» ×4.
- Человек: первый экран показывает продукт в работе или самую характерную вещь предметного мира (реальный скриншот,
  живое демо, авторская фотография, типографская композиция). Секции следуют истории продукта, а не шаблону. Одна
  оркестрованная анимация на странице. Каждое число и логотип имеют источник. CTA называет действие («Создать
  магазин», не «Начать»).
- Где смелость: первый экран (композиция + типографика), остальное тихое.

**Shop (Persuade на витрине, Operate в корзине и чекауте).**
- Слоп: одинаковые карточки с hover-zoom фото и тенью, бейджи «-20%», «Hot», «New» на каждом товаре, пастельные
  плитки категорий с иконками, звёзды без отзывов, баннер «Free shipping» с градиентом, кнопка «Add to cart» с
  градиентом и свечением.
- Человек: фото продукта — главный материал (единый фон, свет, кадрирование, соотношение сторон задано токеном).
  Сетка плотная, текст спокойный. Цена `tabular-nums`, валюта по локали. Бейдж только если правда (реальная скидка из
  API). Чекаут скучный и привычный: одна колонка, крупные поля, прогресс, никакого декора.
- Где смелость: фотография и типографика бренда на главной и PDP. Никогда в чекауте.

**TMA (Operate внутри чужого хрома).**
- Слоп: своя тёмно-фиолетовая тема поверх Telegram, градиентные «крипто»-кнопки, своя шапка и стрелка «назад»
  вместо `BackButton`, своя нижняя кнопка вместо `MainButton`/`BottomButton`, неоновые карточки, кастомный шрифт.
- Человек: цвета из `themeParams` (CSS-переменные `--tg-theme-*`) как примитивы токенов, системный шрифт,
  нативные `BackButton`/`MainButton`/`SettingsButton`, haptic feedback вместо анимаций, safe areas. Приложение выглядит
  как часть Telegram (Wallet — эталон по общему впечатлению; в 07a подробнее).
- Где смелость: почти нигде. Акцент бренда — в одном месте (иконка или иллюстрация состояния), не в хроме.

**Admin (Operate).**
- Слоп: приветствие «Good morning, X» + дата капсом, 4–5 одинаковых KPI-плиток с иконкой в квадрате и `+12%`,
  спарклайны без осей, donut-диаграммы, всё в карточках, слоганы в заголовках страниц, subtle fade-in страниц.
- Человек: экран отвечает на «что сделать сейчас». Срочная очередь — первая и на всю ширину, счётчики — строкой
  ссылок. Таблицы с выравниванием цифр вправо и `tabular-nums`, фильтры в URL, плотность 32–40px строки, заголовок
  страницы — существительное из навигации (наш 02-анализ Awaaz).
- Где смелость: в точности данных (формат чисел, дельты с периодом сравнения, пустые состояния, которые учат).

**Game (Experience).**
- Слоп: стеклянные меню с blur, неоновый киберпанк по умолчанию, Orbitron/Press Start 2P «потому что игра»,
  кнопки-пилюли из SaaS, шрифт и иконки, не связанные с миром игры, fade-up у пунктов меню.
- Человек: UI — часть мира игры (материал, шрифт, звук и движение из сеттинга), диегетические элементы там, где это
  помогает. HUD читается за долю секунды, крупные цели касания для TMA-игр.
- Где смелость: здесь можно больше всего, но в мире игры, а не в «игровом» клише.

### F6. Позитивный метод: бриф → токены → одна вещь → сдержанность
1. **Бриф (5 минут, письменно).** Предмет, аудитория, главная задача экрана, режим (F4), физическая сцена
   использования («кассир в магазине днём с телефона», «трейдер вечером на 27"»). Сцена решает светлая/тёмная, плотность
   и размер шрифта.
2. **Референсы.** 3–5 реальных продуктов или артефактов предметного мира, у каждого строка «что берём». Плюс 1–2
   антиреференса (что не делаем). NN/g: референс или Figma-фрейм дают наибольший прирост качества.
3. **Токены до кода.**
   - Палитра: 4–6 именованных цветов с ролью, в OKLCH. Нейтраль 12 ступеней по Radix-ролям, один акцент, статусы
     тройками.
   - Шрифты: 1–2 семейства, 2–3 начертания, шкала. Operate 1.125–1.2, Persuade крупнее, но из 5–7 ступеней.
   - Радиусы: 3–4 + pill. Отступы: шкала 4/8.
   - Тени: 1–2, только для оверлеев.
   - Движение: 3 длительности, 1–2 easing.
4. **Тест на шаблонность.** Мысленно взять похожий бриф («лендинг для другого SaaS»). Если план вышел бы тем же,
   переделать ту ось, которая совпала, и записать, что изменено и почему (это уже требование скилла `frontend-design`).
   Второй тест из impeccable: можно ли угадать эстетику по одной категории продукта? Если да, переделать.
5. **Одна запоминающаяся вещь.** Назвать её одним предложением в брифе: «каталог как типографский индекс», «первый
   экран — живой график стакана», «HUD нарисован как бортовой журнал». Всё вокруг тихое.
6. **Сдержанность.** Перед сдачей удалить одну вещь (совет Шанель из скилла). Любой элемент без ответа на «какую
   разницу он кодирует» удаляется.

### F7. Процесс для агента (до кода, во время, после)
**До кода (артефакты в репозитории, не в чате):**
- `apps/<app>/DESIGN.md` (формат близок к Google Stitch DESIGN.md / VoltAgent awesome-design-md:
  https://github.com/VoltAgent/awesome-design-md; спецификацию Stitch я не открывал, дата её открытия 2026-04-21 известна
  только из вторичного источника). Секции: Mode & scene; References / anti-references; Palette (роль → OKLCH, обе
  темы); Type (семейства, роли, шкала); Shape & depth (радиусы, бордеры, тени); Motion (длительности, easing,
  разрешённый «момент»); The one memorable thing; Copy voice (3 примера кнопок, ошибки, пустого состояния); Exceptions
  (каждое отступление от H-правил с причиной).
- Токены генерируются или пишутся из DESIGN.md в `tokens.css` до первой страницы.
- Для экрана без макета: ASCII-вайрфрейм мобильной и десктопной композиции и список состояний (U20).

**Как использовать скилл `frontend-design`:**
- Загружать на любой новый экран без макета (уже в `docs/design.md`). При макете макет главнее скилла: скилл не даёт
  права «улучшать» Figma.
- Его двухпроходный метод (план → ревью плана против брифа → код → самокритика) оставить. Добавить в скилл:
  - выбор режима (F4) первой строкой плана;
  - ссылку на H-правила как «floor»;
  - списки второй волны (шрифты, палитры);
  - явное «в Operate-поверхностях не применять advice про атмосферные фоны и page-load reveals». Ранняя публичная
    версия Anthropic-гайда это советует, и для админки или TMA это вредно.

**Во время:** только токены (lint на error). Новые цвета, радиусы, тени — только через DESIGN.md + `tokens.css`.

**После (самокритика со скриншотами):**
1. Матрица: светлая и тёмная × 390, 1024, 1440 (для TMA 390 и 430 в обеих темах Telegram). Анимации входа отключены
   перед снимком (impeccable: скрытое анимацией выглядит как отсутствующее).
2. Чек-лист самокритики (глазами по скриншоту, ответ да/нет):
   1. Через 1 секунду понятно, что это за продукт и что делать? Главное действие самое заметное?
   2. Можно ли убрать название бренда и спутать с любым продуктом этой категории? (Да — провал.)
   3. Сколько заливных акцентных элементов на экране? (>1 главное действие — провал.)
   4. Есть ли элемент, который ничего не кодирует (иконка, бейдж, рамка, карточка, градиент, линия)? Удалить.
   5. Совпадает ли ритм: отступ над заголовком больше, чем под ним, группы плотные, разделение явное?
   6. Цифры выровнены и табличные, единицы с неразрывным пробелом?
   7. Тексты из словаря, глагол на кнопке, нет слоганов, тире, `·`, `→`, эмодзи?
   8. Тёмная тема спроектирована (контраст, изображения, тени) или инвертирована?
   9. Все состояния есть: hover, focus-visible, pressed, disabled, loading, empty, error?
   10. Где «одна вещь» из брифа и не размыта ли она вторым акцентом?
3. `pnpm design:scan` и `pnpm lint:copy` чистые.
4. Свежий агент `design-reviewer` (без контекста сборки) получает скриншоты, DESIGN.md, H-правила. Отвечает таблицей
   «правило → pass/fail → доказательство (файл:строка или скриншот)». Не больше двух раундов исправлений (impeccable:
   бесконечная самопроверка дорога и хуже свежего ревью).

### F8. Что boilerplate должен поставлять для enforcement
1. **Stylelint-пресет `anti-slop`** (в shared config, уровень error). Набросок:
   ```js
   // packages/config/stylelint/anti-slop.js (набросок, синтаксис правил stylelint 16)
   export default {
     plugins: ['stylelint-declaration-strict-value'],
     rules: {
       'color-no-hex': true,
       'color-named': 'never',
       'scale-unlimited/declaration-strict-value': [
         ['/color$/', 'fill', 'stroke', 'font-size', 'font-family', 'font-weight', 'line-height', 'letter-spacing',
          'border-radius', 'box-shadow', 'gap', '/^padding/', '/^margin/', 'z-index', 'transition-duration',
          'transition-timing-function', 'animation-duration'],
         { ignoreValues: ['inherit', 'currentColor', 'transparent', '0', 'none', 'auto', '100%'] },
       ],
       'function-disallowed-list': ['linear-gradient', 'radial-gradient', 'conic-gradient'],
       'property-disallowed-list': ['backdrop-filter', '-webkit-backdrop-filter', 'text-shadow',
         '-webkit-background-clip'],
       'declaration-property-value-disallowed-list': {
         'transition': ['/\\ball\\b/'], 'transition-property': ['all'],
         'background-clip': ['text'],
         'text-transform': ['uppercase'],
         'animation-iteration-count': ['infinite'],
         'transition-timing-function': ['/cubic-bezier\\([^)]*,\\s*(1\\.[1-9]|[2-9])/'],
         'font-family': ['/\\b(Inter|Roboto|Open Sans|Lato|Montserrat|Poppins|Space Grotesk|Space Mono|DM Sans|DM Serif|Plus Jakarta Sans|Outfit|Syne|Instrument (Sans|Serif)|Fraunces|Playfair Display|Cormorant|Lora|Crimson|Newsreader|Bricolage Grotesque|Orbitron|Press Start 2P)\\b/i'],
         'height': ['/\\d+vh/'], 'min-height': ['/\\d+vh/'],
       },
       'unit-disallowed-list': ['vh', 'vw'],
     },
     overrides: [{ files: ['**/tokens/**/*.css', '**/primitives/**/*.css'], rules: { /* токены и allowlist-компоненты */ } }],
   };
   ```
   - Градиенты, `backdrop-filter`, `infinite`, `uppercase` разрешены через `overrides` только в allowlist-файлах:
     `tokens.css`, `Spinner`, `Skeleton`, `Scrim`, `StickyHeader`, `Kbd`.
   - `font-family` в списке проверяется везде, кроме `tokens.css`. Шрифт в токенах — решение, записанное в DESIGN.md
     с причиной. Это защищает от точечных `font-family: 'Space Grotesk'` в компонентах.
   - Для Operate-приложений правило шрифтов ослабляется: системный стек и Inter разрешены (F4).
   - Точное имя и опции плагина `stylelint-declaration-strict-value` нужно проверить при внедрении.
2. **Tailwind v4 (если выбран).** В `@theme` сбросить дефолты: `--color-*: initial; --font-*: initial;
   --radius-*: initial; --shadow-*: initial; --animate-*: initial;` и объявить только свои токены. Официальная
   документация подтверждает `--color-*: initial` (https://tailwindcss.com/docs/theme). После этого `bg-indigo-500`,
   `shadow-lg`, `animate-bounce` просто не существуют. Плюс `eslint-plugin-better-tailwindcss` → `no-restricted-classes`
   (regex; https://github.com/schoero/eslint-plugin-better-tailwindcss): запрет произвольных значений `-\[.*\]`,
   `bg-(linear|gradient|radial|conic)-`, `from-|via-|to-`, `backdrop-blur`, `uppercase`, `tracking-widest`,
   `hover:-translate-y`, `hover:scale-`, `animate-(pulse|bounce|ping)` вне allowlist.
3. **ESLint (JSX).**
   - `no-restricted-imports`: иконки только из одной обёртки; запрет `Sparkles`, `WandSparkles`, `Stars` из Lucide;
     запрет `react-countup`, `aos`, `react-awesome-reveal`, `tsparticles`.
   - `no-restricted-syntax`: `<span>` с классом акцента внутри `h1`–`h3`, литералы-эмодзи в JSX.
4. **Линтер копирайта `lint:copy`** (скрипт по i18n JSON, 50–100 строк, свой; готового нет). Проверки:
   - em dash `—` в EN-строках и в RU-ярлыках (ключи `*.title|label|button|badge|tab|menu`), конструкция
     `^\S+ — ` в любых;
   - ` · `, `→ ← ↗` в конце строки, `...` вместо `…`, прямые кавычки (RU «», EN “”);
   - эмодзи `\p{Extended_Pictographic}`;
   - строки целиком капсом длиннее 4 символов (кроме словаря аббревиатур);
   - Title Case в EN-кнопках и бейджах;
   - стоп-слова EN и RU (H34);
   - шаблоны придуманных фактов `\d+[kKкК]?\+\s*(users|teams|customers|клиент|пользоват)`, `★`, `99.9%`;
   - повтор одного CTA («Get started», «Learn more», «Начать», «Подробнее») 3+ раза в namespace;
   - плейсхолдеры `Lorem`, `Coming soon`, `[Your`.
5. **Playwright-скан `design:scan`** (DOM-эвристики по образцу pixelslop; свой, ~300 строк). Маршруты из конфига
   шаблона, 2 темы × 3 ширины. Проверки (порог в скобках):
   - градиентный текст (1);
   - цветной `box-shadow` с нулевым offset (1);
   - карточка в карточке (1);
   - одинаковая сетка карточек ≥3 на лендинге (1);
   - односторонний цветной бордер ≥2px (1);
   - иконка-плитка 32–56px с тонированным фоном (3);
   - центрированного текста >70% (Operate);
   - hero-метрика (≥2 чисел ≥24px);
   - элементов с `backdrop-filter` >2;
   - количество разных хроматических заливок крупных блоков (>4);
   - контраст текста (axe-core, уже в тестах);
   - мелкий текст <12px;
   - цели касания <40px;
   - ширина строки прозы >80ch;
   - `opacity: 0` элементов в первом экране после 1с.
   Вывод — markdown-отчёт со скриншотами в `.design-scan/`. Gate в CI: 0 абсолютных, ≤1 порогового.
   - Альтернатива: CLI impeccable (`impeccable detect`, Apache-2.0, 59 правил, умеет сверять с DESIGN.md). Минусы:
     быстро меняется (v4.5, команды переименовываются), бинарь скачивается при первом запуске, правила свои. Брать
     как опцию для ревью, не как gate.
6. **Агент `design-reviewer`** (`.claude/agents/design-reviewer.md`, модель opus, только чтение и скриншоты).
   - Вход: DESIGN.md, H-правила, скриншоты, отчёты `design:scan`/`lint:copy`, диф.
   - Выход: таблица по правилам с доказательствами плюс три вопроса: «что убрать», «где одна вещь», «чем отличается
     от шаблона категории».
   - Запускается после любой визуальной задачи без макета и по запросу.
7. **Хук PostToolUse** на `*.css|*.tsx|locales/*.json`: stylelint + `lint:copy` по изменённому файлу. Быстрая
   обратная связь агенту, как detector-hook impeccable.
8. **Документ** `docs/design.md` §8 заменить ссылкой на `docs/anti-slop.md` (H-правила с проверками) и оставить
   короткую выжимку.

### F9. Источники (дополнительно к ссылкам в тексте)
- Anthropic, Improving frontend design through Skills (2025-11-12):
  https://claude.com/resources/articles/improving-frontend-design-through-skills
- pixelslop AI Slop Pattern Catalog v0.3.8: https://cdn.jsdelivr.net/npm/pixelslop@0.3.8/dist/skill/resources/ai-slop-patterns.md
- impeccable (repo, craft-floor, new-work, operate): https://github.com/pbakaus/impeccable ; https://impeccable.style/docs/detector
- How to Fix AI Slop in Web Design, Tell by Tell: https://capitalandcompute.net/blog/fix-ai-slop-design/
- Vercel Web Interface Guidelines: https://vercel.com/design/guidelines
- Linear: https://linear.app/now/how-we-redesigned-the-linear-ui ; https://linear.app/now/behind-the-latest-design-refresh
- NN/g AI prototyping: https://www.nngroup.com/articles/ai-prototyping/ ; Sparkles: https://nngroup.com/articles/ai-sparkles-icon-problem/
- Emil Kowalski skills: https://github.com/emilkowalski/skills
- Neo-grotesk fatigue (2026-01-27): https://fontalternatives.com/blog/neo-grotesk-fatigue-2026/. Интересно как
  антипример: в качестве «альтернатив Inter» он советует Space Grotesk, Plus Jakarta и DM Sans, то есть шрифты из
  reflex-списка impeccable. Это и есть механизм второй волны.
- Microcopy, «Avoid landing page words»: https://microcopyexamples.substack.com/p/avoid-landing-page-words
- Butterick: https://practicaltypography.com/letterspacing.html ; Radix scale:
  https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- Tailwind theme reset: https://tailwindcss.com/docs/theme ; better-tailwindcss no-restricted-classes:
  https://github.com/schoero/eslint-plugin-better-tailwindcss
- DESIGN.md: https://github.com/VoltAgent/awesome-design-md
- Оговорка: большинство «каталогов слопа» — практические блоги 2025–2026, не исследования. Надёжны как список
  наблюдаемых дефолтов, не как доказательство влияния на конверсию.

## Жёсткие правила (HARD RULES)
Формат: **правило** — почему — **проверка** — исключение. [M] = машинная проверка, [S] = скриншот/ревью.
«Исключение» всегда требует строки в разделе Exceptions файла DESIGN.md с причиной. Комментарий в коде не нужен:
код без комментариев по правилам репо, стоп-лист линтера ссылается на DESIGN.md.

### Цвет и глубина
- **H1. Нет градиентного текста** (`background-clip: text`). Почему: тэлл №1 во всех каталогах, плохо читается, ломает
  тёмную тему. **[M]** stylelint `background-clip: text` + Tailwind `bg-clip-text`. Исключение: логотип как SVG-ассет.
- **H2. Нет декоративных градиентов** на кнопках, карточках, фонах секций, бейджах, баннерах. Почему: градиентная
  кнопка и фон-«wash» — дефолт генератора, градиент не кодирует информацию. **[M]** `function-disallowed-list`
  градиентов вне `tokens.css`; Tailwind `bg-linear-*|bg-gradient-*|from-*`. Исключение: скрим под текстом на фото
  (токен `--scrim`), маска затухания скролл-области, игровая графика, один брендовый градиент из брендбука (токен).
- **H3. Нет свечений.** `box-shadow` с нулевым offset и цветным blur, `text-shadow`, `filter: drop-shadow` цветом
  акцента. Почему: «dark mode with glowing accents» — тэлл с максимальной severity в pixelslop. **[M]** `text-shadow`
  запрещён; `box-shadow` только `var(--shadow-*)`; скрипт проверяет, что shadow-токены нейтральны (хрома OKLCH < 0.02)
  и имеют y-offset > 0. Исключение: игры (эффекты мира), фокус-кольцо делается `outline`, не glow.
- **H4. Нет неоновых и акцентных обводок для декора.** Бордер — роль `--border-subtle|field|strong`. Акцентный бордер
  только у состояний: focus, selected, error. Почему: неоновая рамка — костюм «tech/crypto». **[M]** `border-color`
  только из ролей, проверка имени токена по allowlist; **[S]** тёмная тема. Исключение: нет.
- **H5. Один акцентный тон + нейтраль + статусы.** Палитра в DESIGN.md: 4–6 ролей. На экране максимум 4 хроматических
  заливки крупных блоков, включая статусы. Пастельные плитки «для разнообразия» (каждой фиче свой оттенок) запрещены.
  Почему: «too many pastel colors» читается как шаблон, цвет теряет смысл статуса. **[M]** `tokens.css`: ≤1
  брендовая шкала + ≤4 статусные + нейтраль; `design:scan` считает различные оттенки фонов > 4. Исключение:
  категориальная палитра данных в графиках (по dataviz-правилам, с легендой).
- **H6. Нет иконок в цветных квадратах или кругах** («icon tile» у фич, метрик, пунктов меню). Почему: тэлл
  SaaS-карточки (02-анализ: «цветные квадраты под иконками»), Linear убрал даже цветные подложки иконок команд.
  **[M]** `design:scan` (≥3 плиток 32–56px с тонированным фоном и одним svg); **[S]**. Исключение: аватары, иконки
  приложений и токенов (монеты в криптокошельке — это данные).
- **H7. Запрещённые дефолтные палитры** как акцент или фон, если их не задаёт брендбук:
  - indigo/violet/purple Tailwind (`#6366F1`, `#4F46E5`, `#7C3AED`, `#8B5CF6`, OKLCH hue ≈ 265–305 при C > 0.12);
  - default blue `#3B82F6`/`#2563EB` как бренд;
  - cyan `#00D4FF`-подобный на тёмном;
  - крем `#F4F1EA`-подобный + терракота `#D97757`-подобная;
  - near-black `#0B0B0B`/`#111` + acid green / vermilion;
  - фиолетово-розовые или фиолетово-синие пары.
  Почему: это центры распределения первой и второй волны. **[M]** скрипт по `tokens.css` (ΔE OKLCH < 0.04 к
  стоп-цветам → ошибка); Tailwind-сброс палитры. Исключение: цвет из брендбука клиента, записанный в DESIGN.md.
- **H8. Тёмная тема спроектирована, а не инвертирована.**
  - Фон — ступень 1 нейтральной шкалы (не `#000`, не `#0A0A0A` литералом), светлота по U8.
  - Тени заменены поверхностями.
  - Изображения и SVG имеют тёмные варианты или `currentColor`.
  - `color-scheme` выставлен, `theme-color` совпадает с фоном.
  Почему: инверсия и near-black + неон — тэлл; у xRocket `#030303` был ошибкой (03). **[M]** контраст-скрипт пар
  ролей (WCAG 4.5:1 текст, 3:1 UI; APCA Lc для тонкого текста) в обеих темах; **[S]**. Исключение: игра/медиа-плеер,
  где сцена требует чёрного.
- **H9. Цвет только по смыслу.** Зелёный только «успех/готово», красный только «ошибка/опасно». Статус = цвет +
  иконка + текст. Нет серого текста на цветном фоне: вторичный текст на цветной поверхности тонируется в её оттенок.
  **[M]** роли `--status-*` используются только в компонентах с пропом `tone`; axe-контраст. **[S]**. Исключение: нет.
- **H10. Тени только у плавающих слоёв** (popover, dropdown, dialog, sheet, toast). Карточка = поверхность + бордер.
  Тень многослойная, нейтральная, с offset. Нет жёстких офсетных теней `4px 4px 0`. Почему: одна мягкая тень под
  каждой плиткой — «SaaS card kit»; xRocket и Linear строят глубину поверхностями. **[M]** `box-shadow` разрешён
  только в allowlist-компонентах оверлеев. Исключение: бриф явно выбрал необрутализм (запись в DESIGN.md).

### Типографика
- **H11. 1–2 семейства, 2–3 начертания на семейство, шрифтовых файлов ≤ 6.** Почему: Awaaz имел 3 семейства без
  ролей и 8 весов (02). **[M]** скрипт: число `@font-face`/файлов в `public/fonts`, уникальные `font-weight` в
  токенах. Исключение: отдельный шрифт письменности (урду, CJK) не считается.
- **H12. Reflex-шрифты запрещены как голос Persuade/Experience поверхностей без записанной причины.**
  - Первая волна: Inter (как display), Roboto, Open Sans, Lato, Montserrat, Poppins, Arial/Helvetica как «выбор».
  - Вторая волна: Space Grotesk, Space Mono, DM Sans, DM Serif, Plus Jakarta Sans, Outfit, Syne, Instrument
    Sans/Serif, Fraunces, Playfair Display, Cormorant, Lora, Crimson, Newsreader, Bricolage Grotesque, IBM Plex как
    «технологичный костюм».
  - Игровые клише: Orbitron, Press Start 2P, Audiowide.
  - Watchlist (пока разрешено, следить): Geist, Satoshi, General Sans, Manrope, Clash Display.
  Почему: impeccable прямо называет их «training-data defaults», причина «книги → сериф, tech → mono» не считается.
  **[M]** stylelint `font-family` regex. Исключение: Operate-поверхности (admin, TMA, кабинет, чекаут) — системный
  стек или один workhorse sans, включая Inter, разрешены (F4); брендбук клиента.
- **H13. Нет eyebrow/kicker над заголовком** (мелкая капс-метка с трекингом). Почему: абсолютный тэлл (скилл,
  impeccable «no brief earns it back», Awaaz). **[M]** stylelint `text-transform: uppercase` и Tailwind `uppercase`
  вне allowlist (Kbd, аббревиатуры); `lint:copy` строки капсом. Исключение: нет. Аббревиатуры (USD, API) пишутся
  капсом в самом тексте.
- **H14. Нет выделения одного слова в заголовке** другим цветом, курсивом, градиентом или маркером. Почему: «commonest
  tell» (скилл). **[M]** ESLint `no-restricted-syntax`: `h1–h3` с дочерним `span|em|mark` с классом; **[S]**.
  Исключение: имя собственное, которое по правилам языка пишется курсивом (название книги).
- **H15. Трекинг по правилам.** Отрицательный только у display ≥ 32px и не ниже −0.02em. Положительный только у капса
  +5–12% (Butterick). Body без трекинга. Почему: широкий трекинг меток и сжатые заголовки — авто-приём генератора.
  **[M]** `letter-spacing` только из текстовых стилей-токенов. Исключение: нет.
- **H16. Monospace только для кода, хешей, адресов кошельков, клавиш.** Числа в таблицах — `tabular-nums` основного
  шрифта. Почему: mono-метки — «tech vibes costume». **[M]** `font-family: var(--font-mono)` только в
  `Code|Kbd|Hash|Address`. Исключение: бренд, где mono — основной голос (записано).
- **H17-T. Шкала и мера.** Кегли только из текстовых стилей, минимум 12px, поле ввода 16px на мобиле, проза
  `max-width: 65–75ch`, у заголовков `text-wrap: balance`, у абзацев `pretty`. **[M]** stylelint strict-value
  `font-size`; `design:scan` (мелкий текст, длина строки). Исключение: нет.
- **H18. Цифры как данные.** `tabular-nums` в таблицах, ценах, таймерах, балансах. Выравнивание вправо в колонках.
  Неразрывный пробел между числом и единицей, формат по локали (`Intl`). Нет count-up анимации чисел. **[M]** запрет
  `react-countup`/`useCountUp`; правило в компоненте `Amount`/`Num`; **[S]**. Исключение: игровой счёт (часть
  геймплея).

### Раскладка и структура
- **H19. Нет карточки в карточке.** Внутри контейнера секция = заголовок + разделитель или список. **[M]**
  `design:scan` (вложенный элемент с радиусом > 4px и бордером/тенью). Исключение: нет.
- **H20. Нет «всё в карточках».** Сравниваемые записи — список или таблица, не плитки. На лендинге нет сетки ≥3
  одинаковых карточек «иконка + заголовок + текст» как основной структуры. **[M]** `design:scan` (одинаковые
  сиблинги ≥3, ≥100×80, разница внутренних элементов ≤2) на маршрутах Persuade; **[S]**. Исключение: каталог товаров,
  галерея, список игр (одинаковая форма — это данные).
- **H21. Радиусы из шкалы 3–4 значений + pill, иерархия радиусов** (контрол < карточка < диалог, потомок ≤ родителя).
  Не один большой радиус на всём. **[M]** strict-value `border-radius`; Tailwind сброс `--radius-*`. Исключение: нет.
- **H22. Нет цветной полоски-бордера с одной стороны** у карточек, алертов, элементов списка (`border-left` ≥ 2px
  цветом). Почему: «самая узнаваемая AI-UI сигнатура» (noqta.tn, impeccable). **[M]** `design:scan` + stylelint
  запрет `border-(left|right|inline-start|inline-end)-width` > 1px вне allowlist. Исключение: индикатор активного
  пункта навигации (это состояние), цитата `blockquote`, линия таймлайна.
- **H23. Blur и стекло только у хрома над контентом**: sticky-шапка над скроллом, скрим под шторкой. Максимум 2 на
  экран. Никогда у карточек в контенте. Почему: HIG «Don't use Liquid Glass in the content layer»; glassmorphism —
  тэлл. **[M]** `backdrop-filter` в allowlist-компонентах; `design:scan` > 2. Исключение: нет.
- **H24. Выравнивание по содержанию.** На Operate-поверхностях текст выровнен влево. На лендинге центр — максимум
  первый экран и финальный CTA. **[M]** `design:scan` (>70% центрированных текстовых блоков). Исключение: игра,
  экраны результата (успех платежа).
- **H25. Ритм отступов: отступ над заголовком больше, чем под ним; группы плотнее, чем расстояние между группами.**
  Не одинаковый `py-24` у каждой секции. **[M]** strict-value отступов; `design:scan` (margin-top заголовка ≥
  margin-bottom × 1.5); **[S]**. Исключение: нет.
- **H26. Нумерация 01/02/03 только у настоящей последовательности** (шаги, таймлайн). **[M]** grep JSX/i18n
  `^0[1-9]$`; **[S]**. Исключение: нет.
- **H27. Нет шаблонного hero.**
  - Нет связки «pill-бейдж → центрированный H1 → подзаголовок → 2 кнопки → полоса логотипов» по умолчанию.
  - Нет hero-метрики «большое число + маленькая подпись + `+X%`».
  - Нет приветствия «Good morning, Name» на дашборде.
  Первый экран показывает предмет (продукт в работе, товар, мир игры). **[M]** `design:scan` (generic hero ≥4/5
  признаков, hero-метрика); `lint:copy` (приветствия). Исключение: бриф пользователя.
- **H28. Модалка — не первый выбор.** Inline, раскрытие, отдельный экран, шторка на мобиле. **[M]** `design:scan` > 2
  dialog-узлов на маршруте; **[S]**. Исключение: подтверждение деструктивного действия, авторизация.

### Движение
- **H29. Нет анимации появления у каждой секции** (fade-up, slide-in, scroll-reveal). Лендинг — максимум один
  оркестрованный момент на страницу. Operate — ноль входных анимаций. Почему: «generic default and read as
  AI-generated» (скилл, impeccable). **[M]** grep `whileInView|data-aos|AOS|react-awesome-reveal|IntersectionObserver`
  ≤ 1 на страницу лендинга, 0 в Operate-приложениях. Исключение: нет.
- **H30. Hover без подъёма.** На hover меняются фон, цвет, бордер, подчёркивание (≤150 мс). Запрещены
  `translateY`, `scale > 1.02`, появление тени, zoom фото в карточке. Hover только в `@media (hover: hover) and
  (pointer: fine)`. Это уточняет `docs/design.md` §5: hover у каждой интерактивной строки есть, но это смена фона.
  **[M]** stylelint-плагин или скрипт: в `:hover` нет `transform`/`box-shadow`; Tailwind `hover:-translate-y-*`,
  `hover:scale-*`, `hover:shadow-*`, `group-hover:scale-*` запрещены. Исключение: press `scale(0.97)` на `:active`
  разрешён (обратная связь); игры.
- **H31. Длительности и easing только из токенов.** 100–300 мс (оверлеи до 400–500), ease-out по умолчанию. Нет
  ease-in у входа, нет bounce/elastic/overshoot (`cubic-bezier` с 2-й или 4-й координатой > 1). Нет старта с
  `scale(0)`. Нет `transition: all`. Нет бесконечных декоративных анимаций: пульсирующие точки «Live», плавающие
  блобы, бегущие градиенты, marquee логотипов. Всё отключается в `prefers-reduced-motion`. Нет анимации у действий с
  клавиатуры и у действий, которые повторяются 100+ раз в день (Emil Kowalski). **[M]** stylelint (см. F8): strict
  `transition-duration|timing-function`, запрет `infinite` вне Spinner, regex overshoot; grep
  `animate-(pulse|bounce|ping)`. Исключение: игры; спиннер; skeleton без пульса.

### Иконки, эмодзи, изображения
- **H32. Одна библиотека иконок** (Lucide по `docs/design.md`), один stroke, импорт через одну точку. Иконки не
  заменяются эмодзи и Unicode-глифами. **[M]** ESLint `no-restricted-imports`; `lint:copy` и ESLint запрещают
  `\p{Extended_Pictographic}` в JSX и словарях. Исключение: пользовательский контент; эмодзи как часть продукта
  (реакции в чате); TMA-бот-тексты вне UI.
- **H33. Иконка только если кодирует смысл.** Нет иконки над каждым заголовком, в каждой кнопке, у каждой метрики.
  Нет ✨ (Sparkles/Wand) для AI-функций: функцию называют словами (NN/g: значок понимают по-разному). Нет стоковой
  иконки как логотипа. **[M]** запрет импорта `Sparkles|WandSparkles|Stars`; `design:scan` «icon above heading» ≥3;
  **[S]**. Исключение: нет.
- **H34. Нет сгенерированных и стоковых «настроений»**: 3D-блобы, абстрактные градиентные меши, изометрические
  человечки, «diverse team smiling», случайные фото из `picsum/unsplash source/placehold`. Изображение — реальный
  продукт, скриншот, товар или авторский ассет мира. **[M]** grep `picsum.photos|source.unsplash.com|placehold.co`,
  alt со стоковыми дескрипторами; **[S]**. Исключение: явно помеченный синтетический демо-контент в dev/storybook.

### Текст (UI-копирайт)
- **H35. Пунктуация.**
  - Нет em dash `—` в EN-строках UI.
  - В RU тире разрешено только внутри полных предложений по грамматике. Запрещено в заголовках, кнопках, бейджах,
    табах, пунктах меню и в конструкции «Слово — фрагмент».
  - Нет `A · B · C` склеек (и фрагментов для склейки).
  - Нет `→`/`↗` в тексте кнопок и ссылок.
  - `…` одним символом, кавычки «» (RU) и “” (EN).
  Почему: тэллы пункта 5 скилла; склейка через `·` ломает RTL и порядок слов (02). **[M]** `lint:copy`.
  Исключение: em dash в длинном редакционном тексте блога (Read-режим).
- **H36. Стоп-слова.**
  - EN: seamless, elevate, unlock, unleash, empower, supercharge, effortless(ly), revolutionize, next-level,
    game-changer, cutting-edge, world-class, delve, leverage, harness, robust, «Built for X. Designed for Y.»
  - RU: «бесшовный», «вывести на новый уровень», «раскройте потенциал», «революционный», «инновационный», «нового
    поколения», «без лишних усилий», «идеальное решение».
  Почему: такой текст подходит любому продукту (тест «поменяй местами заголовки двух компаний»). **[M]** `lint:copy`.
  Исключение: текст дословно от пользователя или из CMS клиента.
- **H37. Названия и кнопки.**
  - Заголовок экрана — существительное из навигации, не слоган.
  - Подзаголовок только с фактом или инструкцией.
  - Кнопка начинается с глагола и называет результат («Сохранить изменения», не «Отправить»).
  - Одно действие называется одинаково по всему флоу («Опубликовать» → «Опубликовано»).
  - Sentence case везде, включая бейджи. Generic CTA максимум 1 раз на страницу.
  **[M]** `lint:copy` (Title Case EN, повтор CTA ≥3, приветствия); **[S]**. Исключение: нет. Тексты всё равно только
  из словаря пользователя: агент сообщает о плохой строке, а не переписывает её молча.
- **H38. Нет придуманных фактов.** Цифры «10 000+ команд», «99.9% uptime», рейтинги ★, отзывы, логотипы клиентов,
  «Trusted by» — только из реального источника (CMS, API, словарь пользователя). Демо-данные помечены как демо.
  **[M]** `lint:copy` regex; **[S]**. Исключение: нет.
- **H39. Бейджи и статусы только правдивые.** Нет «New», «Live», «Beta», «Hot» без реального флага из данных. Нет
  пульсирующей точки «онлайн» без реального онлайна. Нет точки внутри каждого бейджа. Один стиль бейджа. **[M]**
  компонент `Badge` требует `tone` из union статусов; grep строк; **[S]**. Исключение: нет.

### Состояния
- **H40. Пустое состояние = «что пусто» + действие.** Без настроения («Здесь пока тихо ✨»), без большой декоративной
  иллюстрации, без галочки для «нет данных». Пусто из-за фильтров — отдельный экран с «Сбросить фильтры» (U20/U22).
  **[S]** + Storybook-матрица состояний обязательна. Исключение: игра, онбординг (одна авторская иллюстрация мира
  разрешена).
- **H41. Ошибка говорит, что случилось, сохранены ли данные и что сделать.** Без извинений и «Oops!». Повтор есть
  только там, где он поможет. **[M]** `lint:copy` стоп-слова `Oops|Whoops|Упс|Something went wrong` без продолжения;
  **[S]**. Исключение: нет.
- **H42. Нет «Lorem», «Coming soon», `TODO replace`, `[Your …]` в отгружаемом UI.** **[M]** grep в `src/` и
  словарях. Исключение: storybook.
- **H43. Браузерные поверхности оформлены.** `::selection`, `caret-color`, `accent-color`, скроллбар (где
  кастомный), фокус-кольцо `:focus-visible` 2px с offset из токена, `text-underline-offset`. Почему: дешёвый сигнал
  «сделано, а не собрано» (impeccable). **[M]** наличие правил в `base.css` (тест-снимок); **[S]**. Исключение: нет.

### Процесс
- **H44. Нет визуальной работы без DESIGN.md приложения** (режим, сцена, палитра, шрифты, шкалы, одна вещь,
  исключения). **[M]** CI: в каждом `apps/*` есть DESIGN.md с обязательными заголовками; `tokens.css` не содержит
  значений, которых нет в DESIGN.md (скрипт сверки цветов и шрифтов). Исключение: нет.
- **H45. Нет сдачи визуальной задачи без скриншот-матрицы и чек-листа F7.** Пункты «не проверено» перечислены явно.
  **[S]** (агент `design-reviewer`). Исключение: правка без визуального эффекта.

## Recommendations for the boilerplate
**P0 (обязательно в первой версии)**
1. `docs/anti-slop.md` с H1–H45 (английский, как остальные docs), выжимка в `docs/design.md` §8 и в CLAUDE.md
   (пять самых частых: H2/H3, H13, H29/H30, H35, H38).
2. Stylelint-пресет `anti-slop` на уровне error + allowlist-компоненты (F8.1). Если стилевой слой Tailwind v4 — сброс
   всех дефолтных namespace в `@theme` и `no-restricted-classes` (F8.2). Это закрывает H1–H4, H10, H12–H17, H21–H23,
   H30, H31 почти бесплатно.
3. `lint:copy` для i18n-словарей (F8.4). Закрывает H13, H32, H35–H39, H41, H42. Текст у пользователя всегда из
   словаря, поэтому проверять нужно именно словарь, а не JSX.
4. Шаблон `apps/<app>/DESIGN.md` с секциями F7 и предзаполненным режимом для каждого шаблона: admin/TMA = Operate,
   landing = Persuade, shop = Persuade + Operate, game = Experience. Для TMA предзаполнить «цвета из themeParams,
   системный шрифт, нативные кнопки».
5. Обновить `.claude/skills/frontend-design/SKILL.md`: режимы F4, ссылка на H-правила, списки второй волны,
   предупреждение против «атмосферных фонов» и «page-load reveals» в Operate, тест «угадывается по категории».
   Сохранить «brief wins» и приоритет макета.

**P1**
6. Playwright `design:scan` (F8.5) с порогами. Сначала в отчётном режиме, gate в CI после стабилизации.
7. Агент `.claude/agents/design-reviewer.md` (opus, read-only, вход: скриншоты + DESIGN.md + отчёты; выход: таблица
   по правилам). Запуск обязателен для экранов без макета.
8. Хук PostToolUse: stylelint + `lint:copy` на изменённые файлы (быстрая обратная связь, как detector-hook impeccable).
9. Скрипт проверки палитры: стоп-цвета H7 (ΔE в OKLCH), нейтральность теней H3, контраст пар ролей H8/H9 в обеих
   темах.

**P2**
10. Опционально подключить CLI impeccable для ручного ревью (`detect`), не как gate (быстро меняется, свои правила).
11. Раз в полгода обновлять reflex-списки шрифтов и палитр (H7, H12). Вторая волна устаревает: источник — свежие
    каталоги и наблюдения ревьюера.

**Чего избегать**
- Заменять запреты списком «модных альтернатив»: это создаёт следующую волну.
- Ставить anti-slop правила на `warn` (урок xRocket, 03).
- Применять Persuade-смелость к admin/TMA/чекауту.
- Давать агенту «улучшать» дизайн при наличии макета: макет и словарь главнее анти-слоп эстетики. Анти-слоп правила
  — это пол для экранов без макета и проверка, а не повод менять Figma.

## Open questions for the user
1. Стилевой слой: CSS Modules/vanilla-extract + stylelint или Tailwind v4 `@theme` + ESLint-классы? От этого зависит
   форма F8.1/F8.2. Оба пути закрывают одни и те же правила.
2. Делать ли `design:scan` блокирующим в CI сразу или сначала отчётным на 1–2 проекта?
3. Шрифты в Operate-шаблонах: системный стек (как Telegram, ноль загрузки) или один выбранный sans (Inter как в
   xRocket)? Рекомендация: TMA — системный, admin — системный или Inter.
4. Разрешать ли em dash в русских полных предложениях UI (грамматически нужно) или требовать перестройки фраз без
   тире, как в выводе агентов (output style Human)?
5. TMA: допускается ли один брендовый акцент поверх Telegram-темы или строго только `themeParams`, как у Wallet
   (07a, вопрос 1)?
6. Shop: собственный чекаут через headless API или hosted checkout провайдера? От ответа зависит, применяются ли
   правила чекаута S5 (07a, вопрос 3).
7. Нужен ли отдельный «brand mode» для лендинга, где пользователь сам задаёт смелое направление (градиенты, неон по
   брендбуку)? Сейчас это решается секцией Exceptions в DESIGN.md.
