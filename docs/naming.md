# Naming

## 1. Files and folders

| Kind                         | Convention                     | Example                        |
| ---------------------------- | ------------------------------ | ------------------------------ |
| Component file and folder    | PascalCase                     | `WalletCard/WalletCard.tsx`    |
| Styles                       | `<Component>.styled.ts`        | `WalletCard.styled.ts`         |
| Utility file                 | camelCase                      | `formatDate.ts`                |
| Regular folder               | camelCase                      | `shared/`, `lib/`              |
| Layer folders                | plural                         | `pages/`, `widgets/`, `domains/` |
| Hook                         | `use` + camelCase              | `useWalletBalance`             |
| Store / view model           | PascalCase + suffix            | `WalletStore`, `WalletViewModel` |
| Types file / constants file  | `types.ts` / `consts.ts`       |                                |
| Constant                     | UPPER_SNAKE_CASE               | `MAX_AMOUNT`                   |
| Test / story                 | `*.test.ts(x)` / `*.stories.tsx` |                              |
| Asset                        | kebab-case, WebP for raster    | `arrow-right.svg`, `hero-dark.webp` |

- Component names are never ALL-CAPS: `Kyc`, not `KYC` (react-refresh treats it as a constant). A route name may stay
  `KYC`.
- `ComponentName.tsx` for components, `index.ts` only as a barrel.

## 2. Booleans

| Prefix          | Meaning                       | Example                          |
| --------------- | ----------------------------- | -------------------------------- |
| `is`            | a fact now                    | `isModalOpen`, `isDisabled`      |
| `has`           | possession                    | `hasItems`                       |
| `can`           | capability or permission      | `canSubmit`                      |
| `should`        | our decision                  | `shouldShowHint`                 |
| `will` / `did`  | future / past event           | `didSubmit`                      |
| `needs`         | requirement                   | `needsConfirmation`              |

- `shouldShowModal`, not `shouldModalVisible`. A verb first is a method (`showModal()`); the flag is `isModalVisible`.
- No negation in names: `isReady`, `isFooterVisible`, `isSubmitEnabled` instead of `isNotReady`, `hideFooter`,
  `disableSubmit`.
- Component state props are `isDisabled`, `isLoading`, `isError`, `isClearable`, `isResizable`. No custom `state` enum
  and no extra `unavailable` state («unavailable и есть disabled»). Pick one scheme for the whole kit; the past project
  had `disabled` on Button and `isDisabled` on Cell, do not repeat that.

## 3. Handlers and callbacks

- Props are `on*`: `onSelect`, `onClose`, never `onSelectHandler`.
- Implementations are `handle<Subject><Event>`:

  | ❌                 | ✅                    |
  | ------------------ | --------------------- |
  | `handlePress`      | `handleAssetSelect`   |
  | `handleChange`     | `handleAmountChange`  |
  | `handleClick2`     | `handleRetry`         |
  | `handleChangeName` | `handleNameChange`    |
  | `handleFocusIn`    | `handleFieldFocusIn`  |

- Renaming a forwarder to `handle*` does not fix it. If a view model method only calls `updateState({ type })`, delete
  it and write `onChange={(type) => vm.updateState({ type })}` in the view.

## 4. Variables

Names say what is stored: `spacerHeight` over `room`, `focusedField` over `focused`, `cancelPendingPaint` over
`cancelPaint`. A boolean without a prefix (`result`, `prev`) is a lint warning.

## 5. Domain names

- Use the name the product, the mockup and the existing code already use. «запомни что название не Row — а Cell также
  как у старого компонента». When replacing a component, the new one takes the established name and the old one
  becomes `CellOld`. Never rename an entity on your own initiative, even with a good argument.
- Name things after their role: `rightAction` over `titleRight`; `CellIcon` over `CellAvatar` when it is an icon slot.
- Generic shared helpers get generic type names: `KycTextPart` → `AnchorTextPart` when moved to shared.
- Styled components are named by meaning (`Row`, `SummaryRow`, `ProviderLogo`), never by mechanism (`RowBetween`,
  `TextCol`, `*Wrapper`).
- Match the backend's names for domain entities (`NoteForm` for `ClinicalNote`, not `TextForm`).
- i18n keys: keys exported from Figma keep their form; keys for texts the user sends by hand are descriptive
  (`cameraError`, `supportMessageFailedAttempt`).
