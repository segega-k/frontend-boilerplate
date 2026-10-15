# 0007. One Storybook in `packages/ui` with Matrix stories as the component catalog

- Status: Accepted
- Date: 2026-10-15
- Deciders: user (catalog for every project larger than a landing, step 1 of design), orchestrator (Storybook)

## Context

Agents tend to build new components instead of reusing existing ones, and visual drift appears when screens are built
before the parts are agreed. The user wants a component catalog in every project larger than a landing, built first and
approved before screens. xRocket's Storybook was costly; a self-written gallery would be another tool to maintain. The
awaaz `/showcase` page showed that one scroll of all variants is what reviewers actually look at.

## Decision

- One Storybook 10 in `packages/ui` (`addon-vitest`, `addon-a11y`, `addon-mcp`); app stories are picked up by the same
  glob. Exact pin; the MCP is an accelerator, not a dependency.
- Every exported kit component has a mandatory **Matrix** story: all variants × sizes × states with captions, an RTL
  specimen, realistic data, both themes and a narrow width. `catalog:coverage` in the gate.
- The catalog is the Catalog tab of `apps/utils` (see [0008](0008-utils-site.md)): it opens a showcase-style overview
  (index + all Matrix stories on one scroll, theme/locale/width switches). Storybook starts with utils by one command.
- Design process step 1: inventory from `DESIGN.md` or the Figma snapshot → search existing components through
  Storybook MCP → stories with Matrix for new or extended components → tests, a11y, VRT in Docker → user approval →
  only then screens, only from the catalog. A new visual element during screen work means going back to step 1.
- Small tasks without new components skip the catalog step.
- No showcase routes inside product apps (check in `tools/checks`).
- Enabled automatically when any template other than `landing`/`blog` is picked.

## Consequences

- Reuse becomes checkable; the user approves components once, not per screen.
- Storybook is a heavy dependency with preview-stage MCP; version pinned, upgrades in one PR.

## Alternatives considered

- Self-written gallery in utils: duplicates Storybook features (controls, a11y, test runner, MCP).
- Storybook per app: duplicated config, kit stories split.
- Showcase routes in product apps: leak into production bundles.

## References

- `research/19-utils-site.md` §3–§7, `research/12-frame.md` §8, `research/12-master-plan.md` §6,
  `research/21-user-validation.md` #25.
