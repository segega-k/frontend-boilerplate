# 22e. Стартовые ADR (wave 0, агент E)

Status: done · 2026-10-15

## Resume notes

Работа закончена: ADR 0001–0013, `docs/adr/README.md`, `docs/adr/template.md`, список правок плана
`research/22e-plan-fold-in.md`. Только документы, без установок. Мастер-план не правился.

## Summary

- Написаны 13 ADR (MADR-lite, английский, ≤ 1 страницы): 0001–0012 по предложенному набору и 0013 (деплой и
  ops-дефолты), потому что решения валидации #14, #15, #28–#30 не ложились ни в один из двенадцати.
- Источник истины при расхождении: `21-user-validation.md` > `12-master-plan.md` > `12-frame.md` > отчёты.
- В ADR уже отражены решения валидации (auth-адаптеры, память в обоих местах, без provably fair, shop = свой API,
  CMS в blog, `en`+`ru`, без префикса тикета, GitHub only, weekly-матрица, Caddy, Sentry и аналитика выкл.).
- Найдено 12 противоречий между источниками (ниже); 1–6 закрыты валидацией, 7–9 требуют решения или уточнения.

## Results table

| ADR | Файл | Главные источники |
| --- | --- | --- |
| 0001 | `docs/adr/0001-monorepo-by-subtraction.md` | 06, план §8, 21 #1 #2 #4 |
| 0002 | `docs/adr/0002-template-set.md` | 05, 16, 17, frame §5–§7, 21 #8 #9 |
| 0003 | `docs/adr/0003-styling-tailwind-tv.md` | 13, 07, frame §5, 21 #11 #27 |
| 0004 | `docs/adr/0004-state-mobx-query.md` | 01, 02, 17f, frame §5, 21 #12 |
| 0005 | `docs/adr/0005-api-client-error-mapping.md` | 18, frame §8, 21 #17 #18 |
| 0006 | `docs/adr/0006-i18n-catalogs.md` | 18 §3, 19, 21 #16 |
| 0007 | `docs/adr/0007-component-catalog.md` | 19, frame §8, 21 #25 |
| 0008 | `docs/adr/0008-utils-site.md` | 19, 18, frame §8 |
| 0009 | `docs/adr/0009-screen-transitions.md` | 16 §4, 17, 17e |
| 0010 | `docs/adr/0010-game-stack.md` | 14, 14a, 15, 17g, 21 #7 |
| 0011 | `docs/adr/0011-ai-layer.md` | 08, 04, 10a, 15, 20, 21 #10 #20–#24 |
| 0012 | `docs/adr/0012-auth-adapters.md` | 05d, 17f, 16, 18, 21 #5 #6 #10 #18 |
| 0013 | `docs/adr/0013-deploy-and-ops-defaults.md` | 05, 10, 11, 16, 21 #14 #15 #28–#30 |
| — | `docs/adr/README.md` (индекс, когда писать ADR), `docs/adr/template.md` | 11 |

## Противоречия между источниками

Закрыты валидацией [21] (ADR следуют [21]; правки плана — в `22e-plan-fold-in.md`):

1. Память: план §5 «только в репо, auto memory выключена» ↔ [21 #22] «обе».
2. CMS: план §1 «сознательно нет … CMS» ↔ опция `content-cms` в том же плане ↔ [21 #9] CMS в blog по умолчанию.
3. Provably fair: план §3.3 и [14 R5] берут его ↔ [21 #7] убрать полностью.
4. Префикс тикета: [08] husky `commit-msg` дописывает префикс ↔ [21 #23] без префикса и без хука.
5. Auth: frame §6 #4 и план §12 «PKCE по умолчанию для admin» ↔ [21 #5] адаптеры, init спрашивает.
6. Realtime: план §3.1 «одноразовый тикет из BFF» (код) ↔ [21 #10] только AI-правило + auth-хук.

Требуют решения или уточнения:

7. `DESIGN.md`: план §6 — `apps/<id>/DESIGN.md` на приложение; [21 #26] — «в `DESIGN.md` проекта (per repository)».
   В ADR 0003 нейтрально: «шрифт из `DESIGN.md` шаблона». Нужно уточнить: один файл на репо или на приложение.
8. Планы агента: frame §2 «`.work/plans/` gitignored» ↔ план §5 «`.work/plans/` в git, агент их не коммитит».
   В ADR не попало; уточнить.
9. Шрифты: [07 T7] и [07a] рекомендуют системный стек для TMA/Operate; [21 #27] запрещает. ADR следует [21]; правило
   T7 в [07a] надо пометить отменённым при переносе в rules.

Устаревшие формулировки в отчётах (план новее, ADR следуют плану):

10. [13] называет файл `Name.styles.ts`, план и [21 #11] — `Name.styled.ts`.
11. [06]: команда `pnpm run init`, манифест удаляется после init; план: `pnpm run setup`, init и манифест остаются
    (`--purge-init`). Frame §2 ещё говорит «init удаляет себя (`--keep-init`)».
12. [17f] R2 — Orval по умолчанию; frame §2 — Hey API; решение оркестратора по [18] — `openapi-fetch` (ADR 0005).
    Мелочь: [17f] предлагает `node:24.21-alpine`, план — `node:24-slim` (ADR 0013 следует плану).

## What wave 1 should take as is

`docs/adr/` целиком; при правке решений писать новый ADR со статусом `Superseded by`. `/record-decision` и `/onboard`
должны читать `docs/adr/README.md`.

## Plan changes proposed

См. `research/22e-plan-fold-in.md` (36 точечных правок по строкам). Дополнительно: в плане §10 и §11 заменить
«ADR 0001–0012 / 8–12 ADR» на «0001–0013».

## Open issues

Пункты 7–9 выше.
