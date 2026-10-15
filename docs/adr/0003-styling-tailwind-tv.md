# 0003. Styling: Tailwind v4 through `tv()` in `Name.styled.ts`, typed variant props

- Status: Accepted
- Date: 2026-10-15
- Deciders: user (styles in a sibling file, confirmed `tv()`), orchestrator

## Context

The user requires styles outside the `.tsx` file, as with `Name.styled.ts` in Tamagui projects. The layer must work in
Next 16 with Turbopack, Vite and Astro islands, without runtime CSS-in-JS (RSC). Agents write Tailwind most reliably,
but raw utility strings in JSX make styling unreviewable and invite "AI-looking" classes.

## Decision

- Tailwind v4 with the default theme reset to our tokens (`packages/tokens` → `tokens.css`, `@theme inline`,
  `canvas.ts`); primitives → roles → component tokens; hover tokens under `(hover: hover)`.
- Classes only through `tailwind-variants` `tv()` recipes in a sibling `Name.styled.ts`; `.tsx` only calls the recipe:
  `className={button({ tone, size })}`.
- About 90% of styling lives in `Name.styled.ts`. Styling variance through props is allowed, but the kit exposes typed
  variant and layout props only; no raw `className` or `style` strings in JSX, and the kit is closed to an external
  `className`. `style` is allowed only to set a CSS variable.
- Plain `.css` only in `packages/tokens`, `packages/ui/src/styles/`, `apps/*/src/styles/`, all under stylelint.
- Every template uses a deliberately chosen, self-hosted font from its `DESIGN.md`; no system font stack.
- Enforcement on `error`: `better-tailwindcss` (`no-unknown-classes`, no arbitrary `[..]`, restricted classes),
  ESLint (`className` only from a recipe, `tv`/`clsx` only in `*.styled.ts`, no hex/rgb/oklch there), stylelint.
- Fallback if the wave 0 smoke fails: CSS Modules + CSS variables + `data-*` variants.

## Consequences

- Styles stay reviewable and themeable without rebuild (classes reference `var()`).
- Extra file per component; lint setup is non-trivial and must be proven by the wave 0 style smoke (9 risks).
- TMA maps `--tg-theme-*` to roles; a brand layer is switched on by a flag.

## Alternatives considered

- CSS Modules + variables: lowest risk, kept as fallback.
- vanilla-extract: Turbopack support experimental, dev memory issue.
- Panda, StyleX, Linaria, Pigment, styled-components, emotion: codegen fragility, Windows/Turbopack bugs, runtime or
  abandoned.

## References

- `research/13-styling.md` (R1–R6), `research/03-xrocket-design.md`, `research/07-anti-ai-design.md`,
  `research/12-frame.md` §5 #9, `research/12-master-plan.md` §3.1, §4, §6, `research/21-user-validation.md` #11, #27.
