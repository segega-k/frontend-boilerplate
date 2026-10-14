# Design and layout

The user does not ask for a "wow" design. They want the interface to look intentional: faithful to the mockup where one
exists, built from tokens and existing components, with careful states, restrained motion, working themes and adaptive
layouts, and nothing extra. "AI-looking" for them means self-initiative, extra flags and tokens, decorative elements
without meaning, hard-coded colors, and components built from scratch instead of reused.

The `frontend-design` skill (`.claude/skills/frontend-design`) adds a checklist of generated-design tells; use it for any
new screen without a mockup.

## 1. The mockup is the source of truth

- Pixel accuracy matters and is checked: «Размер иконок шрифта и тд не совпадает с Logout кнопкой», «оно в целом похоже
  но очень далеко от правды».
- Build block by block from specific node ids, starting with a block that does not change: «давай пошагово».
- Re-read every node before implementing, including edge cases, combination tables and divider settings. Missing those
  was corrected twice.
- Workflow with the Figma MCP: metadata first → the narrowest frame as baseline → screenshot of the baseline (for
  orientation, never for pixel values) → design context only for leaf nodes in the measurement plan, never for the
  frame root → variable definitions (they give tokens and i18n keys).
- Figma strokes are inside; CSS borders add to padding. Subtract the border width (a 2px mismatch the user caught).
- Source hierarchy is set by the user. Example: the "what changed in the layout" frame is primary, documentation and
  the guide only clarify. Guide rules are followed literally («если есть backButton оно автоматически становится left»).
  Reused logic is checked against the spec, not assumed to match it.
- A design/code conflict is listed for the user to decide, not resolved silently. The user usually chooses the code
  value («бери кодовую»). Project constants beat mockup geometry: content max width is the project's 1198, not what one
  frame shows.
- A value with no matching token is marked ⚠️. Never silently substitute the nearest token.
- Texts come from the dictionary, not from the mockup layer (see [architecture.md](architecture.md) §7). Check
  punctuation and per-line bold against the screenshot.
- Before handing work back, list everything that was changed but is not described in the spec.

## 2. Usability beats pixels

- Touch targets ≥ 40×40.
- On mobile, focused inputs scroll to the top of the visible area together with their label, in one smooth movement:
  no jerks, no repeated scrolls, no grey background flashes, no "crouching" modals.
- A fix for one platform must not break another; desktop and mobile behaviour may differ on purpose (header scrolls
  only on mobile).
- Mobile and desktop are different compositions, not one layout squeezed.

## 3. Tokens and themes

Three layers:

1. **Primitives** — scales, not roles: a 12-step neutral scale plus brand, success, warning, danger scales.
2. **Semantic roles** — surfaces, borders, text, accent, focus, statuses as bg/border/fg triples.
3. **Component tokens** — only where a component has a state table.

The neutral 12-step scale has fixed roles in the past project: 1 page/modal background; 2–4 surface, hover, pressed;
4–5 borders and dividers; 8–9 field borders; 10 secondary text; 11 captions; 12 primary text. A theme swaps the scale;
components barely know about the theme.

Rules:

- Colors only from tokens **[lint]**. No hex in components. Exported SVG with a hard-coded `#181818` was rejected.
- Both themes must work: «свг картинки не оптимизированы под разные темы», «почему иконка верификации не адаптивна под
  тему». SVG uses `currentColor` with a color that actually propagates; raster images ship light and dark versions
  switched by a theme flag.
- A color used in one place does not become a theme token: «зачем плодить для этого отдельную переменную в конфиге.
  Просто сделай константой». Keep a local constant with light/dark values.
- Depth comes from surface and border, not shadows. Card: surface 2, border 4, radius 12.
- One accent per screen: the main action is filled, the rest outline or ghost.
- Status is color + icon + text together, never color alone.
- Spacing, radius and type from scales. Pick one set of radii (past project: 8, 12, 16, pill) and do not invent 9.
- Named text styles are worth adding (the past project lacked them and drifted to off-scale sizes like 13 and 30).
  Minimum text size 12px. Field font 16px on mobile so iOS does not zoom on focus.

## 4. Icons and images

- Icons come from the icon library (Lucide), not exported SVG files: «что саппорт что вериф возьми из lucid-icons а
  прошлые удали». Do not switch libraries for one glyph: a switch to another set broke SSR and was reverted («бери
  старый Lucide»).
- Match stroke width to the mockup by recalculating for a 24 viewBox (`1.67 × 24/32 ≈ 1.25`). The package version of a
  glyph may differ slightly from the mockup; that is accepted.
- Raster images are WebP only **[lint + hook]**. Convert with the project script, delete the PNG.

## 5. Interaction and motion

- Every interactive row and card has its own hover, `cursor: pointer` and smooth transitions: «Почему кнопка раскрытия
  списка регионов не имеет hover эффект и курсора а также появление не плавное», «hover эффект не плавный».
- Hover/press styles go on each row, not on the whole container.
- Transitions name their properties **[lint]**. A string transition compiles to `transition-property: all` and animates
  font size on breakpoint changes and every color on theme switch.
- Motion is restrained and comes from one preset list (fast 150ms, 200ms, medium 300ms…). Mobile expand: height +
  fade; desktop: simple fade in/out. Modals: fade with a short offset. Chevron rotates 180°, the icon is not swapped.
- Expanding uses an animated measured height with `overflow: hidden`; content stays mounted.
- Nothing closes abruptly («Почему модалка резко закрывается?»). Exit duration covers the longest exit animation.
- Motion answers user actions. No fade-up on every section, no lifting cards. Respect `prefers-reduced-motion`.
- Native smooth scroll over hand-written rAF animation (it stuttered on iOS: «как будто по ребрам двигается»).

## 6. States

Every data view designs all of these:

- loading — a skeleton of the exact content shape;
- empty without filters and empty because of filters (with a "clear filters" action) — different screens;
- error with retry;
- degraded service — an informer in place of the actions;
- refreshing — the old list dimmed, not replaced by a spinner;
- a page-loading error for a next page is its own row with retry and does not break the whole list.

## 7. Layout

- Mobile-first breakpoints: base, ≥600, ≥1024, ≥1280, ≥1440. No raw `@media` with pixel values **[lint]**.
- If only styles change by breakpoint → media props in styles. If the tree changes → breakpoint flag from the app store
  through the view model.
- Bounded content containers (past project: 1198 desktop, 440 mobile), fixed side columns where the design has them.
- A fixed bottom bar on mobile uses the shared bottom actions component; content gets bottom clearance.
- Heights: `dvh`/`svh`, never `vh`; width `%`, never `vw`.
- Every adaptive route uses the adaptive screen layout («ты забыл лэяут и экран не был адаптивным»).
- Real `h1`/`h2` tags on web pages.

## 8. Avoiding a generated look

Principles collected from the design analysis of a project whose UI read as AI-generated:

1. A screen title is a noun, not a slogan. No ALL-CAPS eyebrow above headings. A subtitle only if it states a fact or
   an instruction.
2. Each screen answers "what should I do now". The main action and the urgent queue dominate; counters are secondary.
3. Color carries status, not decoration. No gradients, no colored squares under icons, no hues for variety.
4. Structure is information: a border, card, badge or icon appears only if it encodes a difference. No card inside a
   card; a section inside a card is a heading plus a divider or a list.
5. Lists and tables where rows are compared, not tiles. Tabular numerals for times and amounts.
6. No middle-dot joined meta strings (`A · B · C`), no `→` appended to buttons, no monospace for small labels, no
   sparkle icons for "AI" features, no stock icon as a logo.
7. One or two typefaces, a short type scale, a short radius scale.
8. First delete, then add. Most fixes of a generated look are removals.
9. Reuse the UI kit's own components and style them through tokens instead of parallel classes.
10. Copy is neutral and functional: verbs first on buttons («Cancel deal»), errors say what happened, whether data is
    safe, and what to do. One case style for all buttons.
