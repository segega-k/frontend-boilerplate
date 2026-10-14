# Workflow — how to work with the user

Distilled from months of sessions. Most rules here exist because the opposite happened and the user corrected it.
Quotes are the user's own words where they matter.

## 1. Communication

- Reply in Russian ("на русском" was a correction). Identifiers, code and commands stay as they are. AI-facing docs in
  the repo are English.
- Output style is `Human` (`.claude/output-styles/Human.md`): outcome first, no process narration, no recap, short
  sentences, identifiers out of prose.
- Explain "why" before changing something the user questioned. On "зачем это / что это / почему так" answer with an
  explanation and options, do not edit code until the user decides ("Почему? И поправь после ответа").
- Plain words, no jargon. "4 — что за расхождения?" was asked because the report was cryptic.
- Admit mistakes directly: "Причины не было, это мой недосмотр", "Нет, этого не просили, и я это откатил".
- Text for QA or non-developers has no file or component names: "пиши чтобы человек не видящий кода понимал где смотреть
  и проверять". Describe the path through screens and the visible texts.
- A question for the backend or a manager: separate what the frontend can fix from what it cannot, and give a ready
  text of the question.

## 2. Scope: do only what was asked

The single most repeated correction across all sessions.

| ❌ Don't                                                                  | ✅ Do                                                         |
| ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Add buttons, reorder actions, recolor icons because "Figma seems to want" | Implement exactly the spec or request; ask about the rest     |
| Add a prop, flag, token or variant "for the future"                       | Add it when a real consumer needs it                          |
| Fix neighbouring problems silently                                        | List them in a separate "found outside the task" block        |
| Touch old code that already broke a rule ("если раньше так было то не трошь") | Leave it; mention it if relevant                          |
| Make mass changes (e.g. switch all modals to left alignment) on inference | Only on an explicit requirement                               |
| Keep working on what the user deferred ("не трогать пока что")            | Stop at the boundary the user set                             |

Quotes: «а зачем появились кастомные кнопки снизу? Это просилось?», «Иконка… стала красной — убери», «поправь все баги.
по поводу правил команды — если раньше так было то не трошь. все остальное не трожь».

When a feature is removed, remove all of it: state, types, constants, tests, stories, styles.

Decisions you had to make on your own go into a separate block of the report ("Решения, которые я принял сам") with a
way to revert each.

## 3. Reuse before writing

- «ты что с нуля его создал? … создавать с нуля не нужно». Before creating a component, hook or helper: search the
  codebase. Reuse exported parts; duplicate only what is not exported, and say so.
- Use the project helper over the "correct" raw primitive: «openIfExists используй» instead of a raw `openURL`.
- «А зачем ты создал IconButton если можно использовать простой Button». If an existing component covers the case,
  do not create a sibling. A 1px mismatch is fixed in the base component as a separate decision.
- «а у нас разве не существует готового решения для нижнего мобильного бара?» Check shared UI first.
- Reuse by default, but not at the cost of breaking the design: «постарайся использовать существующий Informer — если не
  подходит идеально по дизайну, игнорируй».
- A block that is visually not a list row is not forced into the shared row component: «реализуй его просто отдельным
  блоком».

## 4. Simplicity

- «зачем так сложно если можно просто verified true or false». A seven-line `Record<State, boolean>` where six values
  are `true` is replaced by one getter. A map is for states that differ in several values.
- «Я не уверен что новый стор отдельно для модалки это не избыточно». Modal state is a few fields in the existing view
  model, not a new store and a new view model.
- No containers with hidden magic (`cloneElement` over children) that the task did not ask for.
- No global machinery for a local need: «Мне не нравится впринципе так глубоко и для всех страниц это прописывать.
  Пускай это решение лежит на каждой отдельной странице».

## 5. Large tasks: phases with an approval gate

For anything bigger than a small fix:

1. **Read context first.** `CLAUDE.md`, the relevant `docs/`, feature `CLAUDE.md`, existing code. Report contradictions
   between docs, lint and code instead of choosing silently.
2. **Plan.** Numbered items, files to create/modify/delete, and questions. Everything you cannot decide yourself is
   marked ⚠️. Never invent values ("составь план разработки и придумай вопросы").
3. **Approval gate.** Wait for the user's answers to every ⚠️ and an explicit go-ahead. After each plan or report that
   needs a decision, wait for the next instruction ("После отправки каждого плана или отчета … нужно ждать моего
   следующего предупреждения").
4. **Implementation.** Item by item. Typecheck and lint after each. New questions are raised before the next item.
5. **Review by a fresh agent** without the development context but with the project rules (see §6).
6. **Report.** Then wait. No commit.

The user answers decisions as a numbered list ("поправь 1, 4, 5, 6, 7"); number your questions and findings.

For a design-heavy task the user's reference pipeline is: plan by items → one agent per item → merged implementation
plan → fresh reviewer with the code rules → check against documentation → final report → code only after approval.

## 6. Subagents

The user likes multi-agent work and asks for it explicitly. Patterns that worked:

- **Parallel split.** One agent implements a mock, another researches the problem and only writes a plan.
- **Isolated opinions.** «важно чтобы мнение этих агентов никак не влияло на того агента который занимается ресерчем
  существующего». Agents that research the mockup do not see the current code.
- **Many readers for pixel checks.** «отправь много мультиагентов на параллельную проверку разных кусков фрейма»:
  read-only agents per frame section, merged into one table "problem / cause / fix".
- **Two independent reviewers** after implementation: one for correctness bugs, one for project rules and
  cross-platform. «без контекста о разработке но с достаточным контекстом о правилах». A second pass after fixes.
- **Consumer audit** after refactoring a shared component: check every page that uses it.

Reviewer findings are verified by hand before being relayed. Conflicting advice is resolved by the project docs (a
reviewer once said "wrap shared UI in observer", which the rules forbid). Review bots can be wrong; say so with proof.

"take your time на исследование — не жалей": deep research is welcome.

## 7. Bugs

- **Reproduce first.** A scroll bug survived several "fixes" written from reading code («Оно ультра хуево сейчас не
  работает», «НА ЭКРАНЕ ВСЕ ЕЩЕ НЕТ. Проведи абсолютно с нуля полное исследование»). It was solved only after
  reproduction in Playwright with touch emulation.
- Before saying "fixed", re-check in code: «первых двух пунктов в ревью… мы же чинили это — перепроверь» — it was not
  fixed.
- A user's hypothesis about the cause is checked against the code, not accepted on faith.
- A fix for one platform must not break another («это хуево, ведь в кейсах для пк нужно это»).
- A failed iteration is reverted completely, not patched over: «откати на один запрос назад», «нет откати — нормально
  было все». Keep each experiment on top of a staged version so the revert is one command.
- After a working variant is accepted: re-read the module and cut experiment leftovers («Проверь еще раз весь код»).

## 8. Mocks and experiments

- A mock only simulates the backend response, at the network boundary, behind a flag that is off by default and never
  on in production. It never changes stores or components: «НИ В КОЕМ СЛУЧАЕ ЭТОТ МОК НЕ ДОЛЖЕН ВЛИЯТЬ НА ПРАВКИ…
  ТОЛЬКО СИМУЛИРОВАТЬ ОТВЕТ С БЕКЕНДА».
- Every mock place is marked `// TODO remove after development` (the one allowed comment type).
- Before any commit, mocks and TODOs are gone: «Удаляй моки и коммить». Removal is complete: files, methods, mount
  points, types.
- Do not spend long on temporary things («Удали теперь весь этот мок который ты ебашил 15 минут»).
- A local experiment is labelled "не коммитить" with a revert command.
- Temporary harness pages and diagnostic tests are deleted after use; ask before keeping a test.

## 9. Git

- Commit, push, merge only on a direct request («коммит», «commit», «коммить и пушь»).
- Message: one English line, no body, no `Co-Authored-By`. If the project uses ticket prefixes, a hook adds
  `[TICKET-123]` from the branch name. Rationale that would have gone into the body goes to chat.
- "Commit what is staged" means only the staged files.
- Logically different changes are different commits. Moving files is its own commit (`git mv`, no other edits) so
  history survives.
- Never bypass hooks (`--no-verify`) without a direct request. If a hook catches a real problem, fix the problem. A hook
  skip variable is used only when the user said so; explain it in the report.
- No irreversible operations on your own: `reset --hard`, `merge --abort`, force push. Explain and wait.
- Before amending, stash files a hook auto-stages (e.g. translations) or they leak into the commit.
- A merge commit gets an explicit `-m`. A new branch must not track someone else's branch; push with
  `git push -u origin <branch>`.
- Moving work between branches: only your current changes, via a separate worktree if needed. On conflict with a fix
  already in the main branch, take the main branch version.
- Check the git state yourself: branch, unfinished merge, manual reverts the user made. Report oddities.
- Do not run `install` that rewrites the lockfile without asking.
- Line endings: keep each file's existing endings. Revert formatter changes that only touched line endings or files
  outside the task.

## 10. Verification and reports

Before reporting:

- typecheck, lint and format on touched files, i18n check, tests of the touched area, dead-code check;
- separate your new errors from pre-existing ones;
- visual work: Storybook and/or Playwright screenshots and DOM measurements (`getBoundingClientRect`,
  `getComputedStyle`) against the mockup, both themes, mobile and desktop;
- say plainly what was not checked: «в браузере не проверял», «на айфоне не проверял».

Report shape:

1. Outcome in one sentence.
2. What changed, grouped; tables for measurements and before/after.
3. Decisions made on your own, trade-offs and limitations ("Минус…", "Ограничение…").
4. Found outside the task.
5. Questions, numbered.
6. Verification status and commit status ("не коммитил, не пушил").

Specification vs implementation checks are a table: scenario / requirement / ✅⚠️❌.

## 11. Memory and continuity

- "Заложи к себе в память" → save it. But anything other devices or teammates need goes into the repo: a doc in
  `docs/`, or a `CLAUDE.md` inside the feature folder with statuses, layers, gotchas, "Open work" and
  "Deliberate, do not fix" sections. The repo file is the source of truth; memory only points to it.
- Decisions the user accepted as intended ("3, 4, 6 — так и должно быть") are recorded under "Deliberate, do not fix",
  otherwise the next review raises them again.
- Plans the user wants to return to are saved with a status that is updated after each step.
- Memory can be stale: verify a remembered file, flag or function exists before relying on it.

## 12. Background processes and environment

- A dev server or Storybook killed by the system is not restarted silently; report it and give the command.
- Restart Storybook after switching branches.
- No access to something (token, tracker, network tab): say so and propose what the user can send or check.
- If the task description is unavailable (no tracker access), ask for the text.
