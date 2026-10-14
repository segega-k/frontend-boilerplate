# Component API

The reference is the shared `Button` of the past project, and the new `Cell`, `Input`/`TextArea`, `TitleItem` and
`Modal v2` built after it. Almost every rule below was a direct correction by the user.

## 1. Texts are strings, slots are ReactNode

«зачем title, caption, subtitle, value, valueSubtitle — ReactNode? почему не просто текст с заранее указанными стилями —
как оно сделано в кнопке?»

- Text props take `string` and render with the component's fixed typography, like `label` on `Button`.
- `ReactNode` only for slots the design actually has (`left`, `right`, `extraRow`, `subtitleExtra`). A free slot is
  styled by the caller.
- No render props that let a caller break the type scale.

```tsx
// ❌
<Cell title={<Text fontSize={10}>Balance</Text>} />
// ✅
<Cell title="Balance" right={<Badge label="New" />} />
```

## 2. No flags for what can be derived or passed

| ❌ Rejected prop                      | ✅ What replaced it                                          | User's words                                                        |
| ------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `hasHelperIcon: boolean`             | `helperIcon` — pass the icon itself                          | «Зачем нужен флаг hasHelperIcon без возможности выбрать иконку?»     |
| `hasCounter: boolean`                | counter shows whenever `maxLength` is set                    | «пускай показывается всегда когда указан maxLength»                 |
| `hasFooterDivider = true`            | divider appears automatically when content overflows         | «удали этот проп… показывается только тогда, когда контент не влезает» |
| `tone` enum on a field               | `isError` + `helperColor` token                              | «нужно убрать tone, добавь isError и helperColor»                   |
| `state` enum, `unavailable`          | `isDisabled`, `isLoading`                                    | «unavailable и есть disabled»                                      |
| `hasBleed`, `position`               | behaviour baked into a variant, prop removed                 | «что делает hasBleed» → «удали его»                                  |
| `labelTrailing`, `autoFocus` "kept from the old component" | removed until someone needs them    | «удали оба»                                                         |
| `rightAction` on a modal             | removed with its stories                                     | «его не должно быть вовсе в модалке»                                |

Rule of thumb: if a boolean only turns on something that has nothing to configure, either derive it or accept the
content itself. Never keep a prop "for the future".

## 3. Variants, not boolean piles

- Every visual state is a variant with `defaultVariants`, not runtime branching.
- Three related flags become one tag: `divider?: 'none' | 'full' | 'inset'`, not a boolean plus an enum.
- No style handles exposed to callers (background, radius, padding, height). The old `Cell` had 26 such props; that was
  the main complaint.
- Two variants must not write the same style property: the order is not guaranteed.

## 4. Forbid impossible combinations at compile or lint time

«нужно запретить отдельным линт правилом делать и тот и другой пропс». Examples:

- `icon` together with `onBack` on a modal — lint rule.
- `type="password"` together with `isClearable` — lint rule.
- A pressable affix without an accessibility label — type-level (`never` in a discriminated union).

Prefer types; fall back to a custom lint rule with a test. Never silently ignore one of the props.

## 5. Sibling components share one API

«почему не все пропсы у textArea и input не совпадают». `Input` and `TextArea` take the same props (`leading`,
`trailing`, `isClearable`, `isError`, `helperIcon`…). Differences only where the element dictates (`type` on Input,
`isResizable` on TextArea). Options interact logically: a non-resizable TextArea keeps its height and scrolls.

## 6. Slots behave honestly

- An optional slot is passed only when it has content. An empty element still reserves space (a 40px empty strip bug):

  ```tsx
  left={iconUrl ? <CellIcon src={iconUrl} /> : undefined}   // ✅
  left={<CellIcon src={iconUrl ?? ''} />}                   // ❌
  ```

- Empty space under a missing icon is a bug.
- A clear button replaces the trailing slot instead of appearing next to it («нужно просто вместо правой иконки
  ставить этот крестик»).
- An element appearing must not shift its neighbours («Почему при появлении крестика иконка смещается левее»).

## 7. Interaction and accessibility

- A row is interactive only if `onPress` is passed and it is not disabled or loading. A pressable row uses a real button
  primitive (semantics, focus, keyboard). A static row does not pretend to be a button.
- Every interactive element has hover, pressed, focus-visible, disabled and loading styles, `cursor: pointer`, and a
  transition on named properties only.
- Disabled opacity is one constant across the kit (0.5, as on Button), not per-component values from the mockup.
- Loading: spinner in the centre, content at opacity 0, handlers off.
- Clickable elements are never nested inside another clickable element (double firing through bubbling).
- Touch targets stay ≥ 40×40 even if the mockup is tighter («пальцу не удобно будет»).
- `aria-label` texts come from the dictionary like any other text.

## 8. Skeletons

A skeleton repeats the shape of this instance: «скелетон должен быть адаптивным — если не задано value, то и
рисоваться value не будет». Each list primitive owns its skeleton.

## 9. Shared UI is props-only

- No store access, no observer wrapper, no view model, no navigation hook. Data a shared component needs (for example
  `isTelegram`) comes as a prop from the page. That keeps it working in Storybook without DI.
- Shared props are optional with defaults.
- Shared UI does not import a navigation-layer component. If a modal header and a screen title are one element in the
  design, extract a pure presentational component (`TitleItem`) used by both.
- Do not grow a shared primitive with variants for one consumer. A local one-off (a modal close button) is its own
  component inside its parent (`Modal/ui/ModalClose`).

## 10. Storybook

- Every shared component, variant and shared utility has stories. Stories cover every case from the mockup: States,
  Combinations, Edge cases, a light/dark Matrix, a Playground with controls («добавь все варианты что были в фигме в
  сторис»).
- ReactNode props in args use `argTypes` with `options` + `mapping`, otherwise JSX is serialized and Playground crashes.
- Utilities get `Utils/<name>` stories with a table per mode and one `AllOptions` story; SDK calls are stubbed.
- Deprecated components move to a `Deprecated/` section.
- Story descriptions are updated when behaviour changes.

## 11. Replacing a component

1. The new component takes the established name; the old one is renamed `<Name>Old` and marked `@deprecated` with a
   pointer to the replacement.
2. Consumers are migrated in clusters, each cluster its own commit, with a list of visual changes worth checking by eye.
3. The old component is deleted when it has no consumers.
4. In plans, separate exact facts (15 direct consumers) from adjacent candidates. Start with direct consumers.
