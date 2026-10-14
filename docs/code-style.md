# Code style

Each rule: what to do, and why. Marked **[lint]** where a past project enforced it by a check; everything else is a
review rule until a check is added.

## 1. Files and structure

- **One component per `.tsx`, no exceptions.** Even a tiny wrapper or provider gets its own
  `ComponentName/ComponentName.tsx`. Why: inner components are not found by file search, are not reused, hide the page
  structure and break the line limit (caught on a `MarketContent` declared inside `Market.tsx`).
- **Sibling files.** Types and props in `types.ts`, constants in `consts.ts`, helpers in `utils.ts`, styles in
  `Name.styled.ts`, hooks of a component in `lib/`. Never in the `.tsx`. Why: inline types and helpers are not reused
  and bloat the component.
- **No JSX in `utils`.** A helper that returns JSX is a component in its own file.
- **Component folder layout** (reference: the shared `Button` / `Cell` of the past project):

  ```
  Input/
  ├── Input.tsx           markup and behaviour only
  ├── Input.styled.ts     all styled() calls
  ├── Input.stories.tsx
  ├── types.ts
  ├── consts.ts
  ├── utils.ts
  ├── index.ts            only what is used outside
  ├── ui/<Sub>/           subcomponents, each in its folder
  └── lib/useXxx.ts       hooks; useXxx.native.ts for platform variants
  ```

- **Page slices stay flat.** «все папки что лежат в ui вытащи из ui и просто рядом пускай лежат». A reusable
  subcomponent gets its own folder next to its siblings, not nested in the parent's folder.
- **Page assets in one place**, `pages/<page>/images/`. Do not import images from a sibling component folder.
- **Line limits:** `.tsx` ≤ 200 lines **[lint]**, any file ≤ 700. Over the limit → extract subcomponents, not
  `eslint-disable`.
- **Barrels export only what is consumed outside the module** **[knip]**. Import a constant directly from `consts` if
  the barrel would drag a heavy hook along.
- **Named exports only.** `export default` only for lazily routed page roots.
- **Delete dead code**: unused exports, types, constants, leftover `eslint-disable` directives.

## 2. Comments

- **No new comments**, neither `//` nor JSDoc. «Комментарии не оставляй». Write self-explanatory code; the rationale
  goes into the chat reply.
- **Keep existing comments** that explain "why", including other authors'. Removing one during a refactor was flagged
  in review and restored verbatim. Do not rewrite existing doc comments.
- **Allowed exceptions:** `// TODO …` markers the user asked for, mock markers (removed before commit), a one-line JSDoc
  on shared formatters if the shared lib convention requires it, `@deprecated` on a replaced symbol (placed on the
  exported symbol, not on its props interface), and a short "why" the user explicitly requested.

## 3. TypeScript

- No `any` (use `unknown`), no non-null `!` (use guard clauses), no `as unknown as`.
- Explicit parameter and return types, including hooks and closures returned from hooks:
  `useShareLink = (): (() => Promise<void>) => …`.
- Event handler types come from the target's props, not from DOM/React event types (which do not exist on native):
  `type KeyDownHandler = NonNullable<ComponentProps<typeof Frame>['onKeyDown']>`.
- Narrowest type possible: `RefObject<ScrollView | null>`, not a union "just in case".
- Objects passed as i18n params are `type`, not `interface` (interfaces lack the implicit index signature).
- Translation keys are typed (`TranslationPath<'ns'>`), not `string`.
- Exhaustive mappings over an enum use `Record<State, …>` or `switch` with a `never` check, so a new backend status
  breaks the build instead of falling into a default.
- If a library's types do not resolve, declare a minimal local type instead of `any`.

## 4. Logic

- **A map instead of an if-chain** for value lookup:

  ```ts
  export const FIELD_FILTER_BY_CODE: Record<string, FieldFilter> = {
    'phone-number': 'phone',
    'card-number': 'digits',
  };
  ```

- **Decide by the entity itself**, not by its parent («сделай … по field.code, а не по типу»).
- **One value, one constant**: `REVEAL_DELAY_MS = 60`, not `[60]`. Design numbers are named constants
  (`GRABBER_WIDTH = 36`); a one-off value is a local constant, not a new design token («контсантой»).
- **Magic strings and attributes** live in one constant, never duplicated across files.
- **Big effects are split**: schedulers and listeners become pure factories in `utils.ts`, each timer has its own
  variable, names say what is stored (`spacerHeight`, not `room`; `focusedField`, not `focused`).
- **Callbacks in shared components** use a ref latch so a consumer's inline arrow does not cause an effect loop:

  ```ts
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => { callbackRef.current?.(metrics); }, [metrics]);
  ```

- **Inert handler bug** **[lint]**: `onPress={() => handleX}` returns the handler and does nothing. Write
  `onPress={handleX}` or `onPress={() => handleX()}`.
- **Leaked render** **[lint]**: `{items.length && <List />}` renders `0`. Use `hasItems` or `items.length > 0`.
- **Memoization** (React + MobX projects): wrap in `useCallback`/`useMemo` only values that do not depend on observable
  store data; observer components handle observable reactivity. Never destructure a store (breaks reactivity).
- **Named observer functions** **[lint]**: `observer(function Name() {…})`, never an anonymous arrow (DevTools and
  stack traces show the name).
- `console.log` only inside `catch`; the production build strips it.
- No inline style or option objects in JSX **[lint]**: hoist them to `consts.ts` or module constants.

## 5. Imports

- Between slices only via the `@/` alias **[lint]**; no `../../`.
- Group alias imports together.
- Unused imports are an error **[lint]**.
- Restricted imports **[lint]**: raw UI-library primitives that have a project wrapper (e.g. `Button`), raster images
  (only WebP), generated API files outside the API barrel.

## 6. Cross-platform code

- No `window`, `document`, `vw`, `calc(100vw - …)`, `className` or DOM event types in shared code. They break native or
  SSR. Use container padding instead of `vw`; `%` instead of `100vw`; `dvh/svh` instead of `vh`.
- SVG icons are components (for React Native: `react-native-svg`), not `?react` imports. Rename Figma ids like
  `clip0_110_13038` to unique ones: on web ids are global.
- Web-only third-party SDKs get a `.native.tsx` stub next to them.
- iOS: `vh` plus measuring on every layout made a block grow forever while the address bar hid. Use `svh` and measure
  once.
- Android shrinks the page when the keyboard opens, iOS does not. Test both.

## 7. Tests

- Tests are opt-in: write them when asked or when the task is about a rule that needs a guard. A temporary diagnostic
  test is deleted or kept only after asking.
- Logic tests construct view models and stores with fakes, without the DOM.
- Assert content, not only counts (`toContain('kyc')`, not only `length`).
- Normalize path separators in tests and lint rules for Windows: `path.split(path.sep).join('/')`.
- e2e selectors use `data-testid`, not style classes.

## 8. Formatting

Prettier config is in [tooling.md](tooling.md): single quotes, trailing commas, width 120, LF. Markdown is excluded from
Prettier (it breaks `|` inside code spans in tables); wrap prose by hand at 120.
