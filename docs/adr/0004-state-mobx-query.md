# 0004. State: MobX plain classes without DI + TanStack Query via `MobxQuery v2`

- Status: Accepted
- Date: 2026-10-15
- Deciders: user (MobX where a state manager is needed, no DI), orchestrator

## Context

xRocket used MobX MVVM with tsyringe DI and decorators. The view model pattern ("logic outside the view", "VM never
navigates") worked; DI and decorators added magic, startup cost and a hard-to-follow graph. Server state needs caching,
dedup and retries that TanStack Query solves. xRocket's own Query↔MobX bridge took 512 lines and had hydration and
unsubscribe races.

## Decision

- Server state: TanStack Query. Client state: MobX plain classes with `makeAutoObservable`; no tsyringe, no DI, no
  decorators, no Zustand, no Redux. React Compiler off.
- Server data reaches MobX only through our own `MobxQuery v2` bridge (`QueryObserver` → observable); imports of
  `mobx-tanstack-query` and `mobx-utils` are banned by lint.
- Global stores are created in `app/` and passed by React context. A VM is created explicitly with
  `useViewModel(() => new XViewModel({ ... }))`; store thin, VM rich, `pageState` as a union.
- A VM is optional: simple screens may use Query and components directly; a VM is used for screens with orchestration.
- A VM never navigates and never calls an SDK: a handler returns a result and the button owner navigates.
- `site`: RSC prefetch + `HydrationBoundary`; stores and VMs only in client components, created per request.
- Astro (`landing`, `blog`): no MobX; build-time data, islands keep local state.
- Per-frame values (games, animations) live outside React and MobX.

## Consequences

- Fewer concepts than xRocket; no container to debug. Dependencies are passed explicitly in constructors.
- `MobxQuery v2` is our code and needs tests on `QueryObserver` and a reference example in rules; wave 0 smoke.
- xRocket MobX lint rules carry over (`no-store-in-page-view` on `pages/**`, guard only in page root).

## Alternatives considered

- Keep MobX + tsyringe DI: magic and boot cost, rejected by the user.
- Zustand + hook as view model (orchestrator's first frame): rejected by the user in favour of MobX.
- `mobx-tanstack-query` library: less control over races found in xRocket.

## References

- `research/01-xrocket-architecture.md` §4, `research/02-xrocket-tech.md` F3, `research/17f-admin.md` R1,
  `research/12-frame.md` §5 #2, `research/12-master-plan.md` §3.1, §4, `research/21-user-validation.md` #12.
