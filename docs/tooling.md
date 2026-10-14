# Tooling and infrastructure

What the boilerplate will ship, based on what worked (and what drifted) in the past project. Concrete versions are
fixed when presets are chosen.

## 1. Toolchain

- **Node and pnpm pinned in one place.** `.nvmrc`, `engines` and the Docker base image must agree; in the past project
  `.nvmrc` said 22 while Docker built on 24.
- `packageManager` field set; `engines.npm = "please-use-pnpm"`; `.npmrc` with `engine-strict=true`.
- pnpm 10+ reads overrides, patched dependencies and build allowlists only from `pnpm-workspace.yaml`, not from
  `package.json#pnpm`.
- Supply-chain guard: `minimumReleaseAge` (7 days) in `pnpm-workspace.yaml`, plus an explicit allowlist of packages that
  may run install scripts.
- Pin versions of UI-framework packages that must move together via overrides.

## 2. Prettier

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "printWidth": 120,
  "endOfLine": "lf",
  "arrowParens": "always",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "jsxSingleQuote": false,
  "proseWrap": "always",
  "quoteProps": "as-needed",
  "semi": true,
  "useTabs": false
}
```

`.prettierignore`: build output, coverage, lockfiles, `*.yaml`, `*.json` catalogs if they are generated, `*.template`,
`*.md` (Prettier breaks `|` inside code spans in Markdown tables).

## 3. Line endings

The past repo mixed CRLF working copies (`core.autocrlf=true`) with `endOfLine: lf`; formatters then rewrote whole files
and checks failed on hundreds of files. The boilerplate ships `.gitattributes` with `* text=auto eol=lf`, so every
machine gets LF and diffs contain only real changes.

## 4. ESLint

Base: TypeScript recommended + strict + stylistic, react-hooks (`exhaustive-deps` as error), react-refresh, the query
library plugin, eslint-comments, unused-imports, Prettier compatibility.

Rules worth carrying over regardless of stack:

| Rule                                          | Why                                                         |
| --------------------------------------------- | ----------------------------------------------------------- |
| `curly: all`, `no-else-return`                | uniform control flow                                        |
| `padding-line-between-statements`             | blank line before `return`, after declarations, before types |
| `max-lines` 200 for `*.tsx`                   | forces component extraction                                 |
| `unused-imports/no-unused-imports` error      | dead imports                                                |
| `no-unused-vars` with `_` prefix allowed      | intentional unused params                                   |
| `react/no-unstable-nested-components`         | components declared inside components                       |
| `react/jsx-handler-names`                     | `on*` props / `handle*` implementations                     |
| `switch-exhaustiveness-check` in stores/VMs   | new enum values break the build                             |
| boolean `naming-convention` in stores/VMs     | `is/has/can/should/will/did/needs`                          |
| `no-restricted-imports`                       | raw primitives with project wrappers, PNG/JPG, deep API imports, `../../` across slices, layer direction |
| `no-restricted-syntax` for important URLs     | legal links only through one helper                         |

Custom rules from the past project (kept in `tools/eslint-rules/<name>/` with a RuleTester test each, messages explain
why, paths normalized for Windows):

| Rule                                        | Guards against                                            |
| ------------------------------------------- | --------------------------------------------------------- |
| `no-inert-handler`                          | `onPress={() => handleX}`                                 |
| `no-leaked-render-children`                 | `{count && <X/>}` rendering `0`                            |
| `observer-named-function`                   | anonymous observer/memo/forwardRef                        |
| `no-store-in-page-view`                     | page views reading stores directly                        |
| `no-page-query-guard-outside-page-root`     | error guard in the wrong place                            |
| `no-platform-navigation-outside-page-root`  | platform router below the page root                       |
| `no-platform-globals-in-store`              | `window`, DOM types, platform SDK in stores and VMs        |
| `no-i18n-in-getter`                         | translated strings frozen in computed values              |
| `require-i18n-namespace`                    | lazy namespace used but not declared                      |
| `require-mobx-default-values`, `require-viewmodel-autobind` | uninitialized observables, unbound VM methods |
| `no-transition-property-all`                | string transitions animating every property               |
| `no-color-literals`, `no-inline-styles` (UI-lib aware) | hard-coded colors and style objects in JSX      |
| `no-viewport-height`                        | `vh` inside screen layouts                                |
| `no-direct-persist-import`                  | persistence bypassing the SSR-safe adapter                |
| `public-api`                                | deep imports into another slice                           |
| `no-modal-icon-with-back`, `no-clearable-password` | impossible prop combinations                       |

Pitfalls seen:

- Flat config: a later block with the same rule replaces the earlier one. Several bans were silently disabled. Check
  that every rule is active where it should be.
- A nested package's lint rules are not applied when ESLint runs from the repo root; run it from the package or wire it
  per project.

## 5. Dead code

knip with one config file (the past repo had two). Ignore generated code and lazy page default exports. Run it in CI
with `--max-issues 0` only if it really runs there; the past project's docs claimed a knip CI gate that did not exist.

## 6. Git hooks

`pre-commit` (husky):

1. Diff size limit (e.g. 40 000 inserted lines, excluding generated files, lockfiles, translations); skip variable
   only on request.
2. Optional overlap check against other open branches (warns when the same lines change elsewhere).
3. Block new PNG/JPG (with exceptions for favicons and OG images) and point to the WebP converter.
4. Translation catalogs sync, if the project keeps a merged source catalog.
5. `lint-staged`: `eslint --cache --fix` and `prettier --write` on staged files.
6. Typecheck of every tsconfig.

The typecheck in the hook was heavy and sometimes ran out of memory on big merges; keep it per project and fast.

`prepare-commit-msg` adds `[TICKET-123]` from the branch name; skips merges, squashes, `fixup!` and messages already
starting with `[`.

## 7. Scripts

| Group    | Scripts                                                                        |
| -------- | ------------------------------------------------------------------------------ |
| Quality  | `lint`, `lint:fix`, `typecheck`, `check` (= lint + typecheck + i18n checks)    |
| Tests    | `test:unit`, `test:unit:coverage`, `test:e2e`, `test:visual`, `test:visual:update` (in Docker) |
| i18n     | `i18n:check`, `i18n:check:baseline`                                            |
| Dead code| `knip`, `knip:fix`                                                             |
| API      | `api:generate:<service>` (types and error mappings together)                   |
| Assets   | `convert:webp`                                                                 |
| Setup    | `init` (one-time preset script), `reinstall`, `clean`                          |

## 8. Tests in CI

- Unit tests with coverage and JUnit reports.
- Lint job collects all exit codes and returns the first non-zero.
- Visual regression (2 themes × 3 widths) with baselines regenerated only in Docker: the CI image's fonts and browser
  differ from a developer machine.
- Runtime smoke test: no raw i18n keys on rendered pages.

## 9. Docker and deploy

- One multi-stage Dockerfile with targets per app (static app on nginx, SSR app on Node, Storybook, a `tests` image for
  CI with the browser installed).
- Runtime env injection (`window.env` written at container start) so one image goes to every environment.
- Deploys triggered by tags `<env>-<timestamp>`.
- The build number must be identical in parent and child pipelines or the image is rebuilt.

## 10. Editor

- `.vscode/settings.json`: format on save with Prettier (off for Markdown), workspace TypeScript, file associations for
  `*.ts.template` snippets.
- `.vscode/extensions.json`: ESLint, Prettier, i18n Ally, Vitest, dotenv, Error Lens.
- Code snippets for the project's recurring patterns (store, query, mutation, view model, styled).

## 11. Windows notes

The user works on Windows with a Cyrillic path (`C:\Работа\…`).

- `.sh` scripts called through pnpm on Windows go to WSL bash and fail; run them with Git Bash `sh script.sh` or write
  scripts in Node (`.mjs`). The boilerplate's own scripts, including `init`, are Node to stay cross-platform.
- Cyrillic paths broke `fileURLToPath`-based aliases in Vitest config and a pnpm shim. Test the toolchain from such a
  path.
- Heredocs in Bash eat backslashes and template strings: write complex edits through files or Node scripts.
- Multi-line `sed`/`perl` edits misbehave on CRLF files.
- Python may be missing; use Node for helper scripts.
- Use the system Edge (`channel: 'msedge'`) for Playwright when browsers are not downloaded.
- `nx reset` fixes "Maximum call stack size exceeded" in the project graph (stale daemon cache).
