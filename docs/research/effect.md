# Should Jali adopt Effect?

22 Nov 2026 · read-only investigation of the repo at 5157dbc (Effect 4.1.5, rolldown 1.3.3; the size probes were throwaway bundles outside the repo)

## Recommendation

**No. Do not use Effect inside `@jali/core` or `@jali/react`, and keep it out of the public API.** Effect 4 is a much better library than Effect 3, and it now works with the whole toolchain. But the smallest useful slice of it (a fiber runtime with interruption) costs 11–13 KB gzipped, and Schema decoding costs about 24 KB. Against a core budget of 55 KB, which the next phase wants to cut to 25–30 KB, that one dependency would use up most of the reduction. Jali has also already refused much smaller dependencies (Phosphor as an optional peer, Radix). The problems Effect would solve are real, but they are small and synchronous in Jali. The engine is pure and sync, the ports are sync, and only a handful of promises exist (beforeClose, `settled`, pop out). In-house primitives of a few hundred bytes fix every open finding. TanStack-grade libraries that ship to any app do not depend on Effect either. The one well-known library that does (UploadThing) pins an exact Effect 3 version and is mostly server-side. Use Effect where it fits well: the owner's servers, data pipelines, agent backends and long-running jobs. Bridge Jali to it with **Standard Schema** in `params`, so a host that uses Effect Schema (or Zod or Valibot) can plug its own schemas in, while Jali itself ships none of them.

## Effect's state, late 2026

- **Effect 4.0 is stable.** It was published 1 Oct 2026 (npm time; InfoQ says 30 Sep) after eight months of beta (the "effect-smol" rewrite). `latest` is **4.1.5** (20 Nov 2026), and `prev` is 3.22.5. Sources: [InfoQ](https://infoq.com/news/2026/11/effect-4-0-release), [v4 beta post](https://effect.website/blog/releases/effect/40-beta), `npm view effect dist-tags`.
- **One package with zero runtime dependencies.** v4 folds platform, rpc, cluster, sql, ai and reactivity into `effect`. Effect 3.22 depended on `fast-check` and `@standard-schema/spec`; 4.1.5 has no dependencies. The unpacked tarball is 64 MB (3.22: 27 MB). Install size matters little to bundles, but it shows how much surface the package has.
- **Stability:** modules under `effect/unstable/*` (17 of them, including `reactivity`, which the React bindings use) "may receive breaking changes in minor releases" ([beta post](https://effect.website/blog/releases/effect/40-beta)).
- **Official size claims:** "A minimal program using Effect, Stream, and Schema drops from roughly 70 kB in v3 to about 20 kB in v4." The post gives no method ([beta post](https://effect.website/blog/releases/effect/40-beta)). InfoQ repeats a secondary figure of "7.1 kB against 35.6 kB in 3.x", which I could not find in an official source and which my measurements don't reproduce for anything that includes Schema.
- **React:** `@effect/atom-react` 4.1.5 has the peer dependency `react >=19 <20`, which does not cover Jali's `^18.2 || ^19` ([docs](https://effect.website/docs/v4/api/atom-react/Hooks)). It is an app-level state library, not a building block for a library.

## Measured sizes

Tiny entry points, bundled for the browser, minified, gzip -9. Effect 4.1.5 and 3.22.5; rolldown 1.3.3 (the bundler behind Vite+ and `vp pack`) and esbuild 0.28.2; valibot 1.5.0; zod 4.6.7. The entries are in `effect-probe/entries/`, and the Effect 4 builds are in `effect-probe/v4/src/`.

| Entry (what it does)                                                                                         | rolldown min | rolldown gz |            esbuild gz |
| ------------------------------------------------------------------------------------------------------------ | -----------: | ----------: | --------------------: |
| Effect 4: `runFork(Effect.sync(...))` (smallest runtime)                                                     |       23.4 K |  **8.3 KB** |                9.9 KB |
| Effect 4: `Effect.gen` + `sleep` + `runFork` + `Fiber.interrupt`                                             |       33.3 K | **11.4 KB** |               12.6 KB |
| Effect 4: a Jali-shaped lifetime (Scope, `forkIn` a follow + a `tryPromise` guard, finalizer, `Scope.close`) |       38.9 K | **12.9 KB** |                     – |
| Effect 4: `Schema.Struct` of a number, an optional string and literals + `decodeUnknownSync`                 |       78.5 K | **24.8 KB** |               25.2 KB |
| Effect 4: `Schema.is` only                                                                                   |       74.7 K |     23.7 KB |               24.9 KB |
| Effect 4: recursive layout-tree schema (id pattern, px or weight > 0)                                        |       79.9 K |     25.2 KB |                     – |
| Effect 4: Scope + Schema + Stream.debounce + Layer/Context                                                   |       94.0 K | **30.0 KB** |                     – |
| Effect 4, **barrel import** `from "effect"`, fiber entry                                                     |       33.4 K |     11.4 KB |           **59.2 KB** |
| Effect 4, barrel import, Schema entry                                                                        |       78.5 K |     24.8 KB |          **101.3 KB** |
| Effect 3.22: minimal / fiber / Schema struct (esbuild, deep imports)                                         |            – |           – | 46.3 / 46.5 / 55.8 KB |
| Valibot: the same params schema (string to number, optional, picklist) + `safeParse`                         |        4.4 K |  **1.5 KB** |                     – |
| Zod Mini: the same schema                                                                                    |       15.2 K |  **5.1 KB** |                     – |
| In-house lifetime (AbortController + a timer set + a guarded `then`, ~15 lines)                              |        0.4 K | **0.24 KB** |                     – |

How these compare with Jali (DECISIONS, 21 Nov):

- Budgets are core 55 KB (minimal) / 49.2 (headless) / 10.7 (layout only).
- The layout engine's own codec and validator are about 6.0 KB minified (Opus review, CORE-9).
- Effect Schema alone would be about **2.3× the whole layout-only build**, and **45% of the minimal core budget**. Swapping out the existing validator would not offset it (6 K minified versus 78 K minified).
- The fiber runtime alone is about 20% of today's core, and 40% of the 25–30 KB target.

The barrel-import rows matter for a library. Rolldown tree-shakes `import { Effect } from "effect"` well, but esbuild-based pipelines do not (5× bigger). Jali can't control the bundler its hosts use.

## Tooling compatibility

| Tool                            | Status with Effect 4                                                                                                                                                                                                                           | Evidence                                                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rolldown / Vite+ (`vp build`)   | Works. Tree-shakes barrel and deep imports equally.                                                                                                                                                                                            | Measured above                                                                                                                                                                                          |
| tsdown (`vp pack`)              | Works. Dependencies stay external by default, so consumers' bundlers pay the cost. `sideEffects` in Effect 4 lists only the Schema JIT enable file.                                                                                            | `effect/package.json`                                                                                                                                                                                   |
| esbuild-based consumers         | Works, but barrel imports defeat tree-shaking (59 KB vs 12.6 KB)                                                                                                                                                                               | Measured above                                                                                                                                                                                          |
| Vitest 5.1                      | `@effect/vitest` 4.1.5 has the peer dependency `vitest >=5 <6`, which fits the workspace catalog (5.1.0). Not needed to test plain code.                                                                                                       | `npm view @effect/vitest`                                                                                                                                                                               |
| TypeScript 7 (tsgo)             | Type-checks. A probe of 5 Effect entries ran under Jali's `tsc` 7.0.2 with `strict` and `exactOptionalPropertyTypes`, with no compatibility errors. It instantiated 255k types for ~40 lines of code; type-level cost is real.                 | `effect-probe/v4/tsconfig.json`                                                                                                                                                                         |
| Effect language service on TS 7 | Supported only through **`@effect/tsgo` (0.73.2, pre-1.0)**, a separate build of TypeScript-Go with Effect's diagnostics. The old `@effect/language-service` patcher is for TS 5/6. You would run it instead of plain `tsc`, not alongside it. | [Effect-TS/tsgo](https://github.com/Effect-TS/tsgo), [language-service README](https://github.com/Effect-TS/language-service), [devtools docs](https://effect.website/docs/v4/getting-started/devtools) |
| Oxlint                          | No Effect rules (for example floating Effects or a missing `yield*`). Those checks live only in the language service above.                                                                                                                    | Oxlint plugin list; Effect docs put the checks in the LSP                                                                                                                                               |
| React 18                        | Effect itself doesn't care. `@effect/atom-react` needs React 19.                                                                                                                                                                               | `npm view @effect/atom-react`                                                                                                                                                                           |

So tooling is not the blocker. Effect 4 works with all of it. The cost is bytes, and a second typechecker if you want Effect's diagnostics.

## How libraries that ship to any app handle this

| Library                                                                    | Runtime dependencies (`npm view`, today)                                                                                                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @tanstack/react-query 5.108                                                | `@tanstack/query-core` only                                                                                                                                            |
| @tanstack/react-form 1.33                                                  | own `@tanstack/store`, `pacer-lite`, `devtools-event-client`                                                                                                           |
| @tanstack/router-core                                                      | `seroval`, `cookie-es`, `@tanstack/history`                                                                                                                            |
| zustand 5.1, jotai 3.0, react-resizable-panels 4.24, flexlayout-react 0.11 | none (React peer only)                                                                                                                                                 |
| xstate 5.33, dockview-core 8.9                                             | none                                                                                                                                                                   |
| **uploadthing 7.7**                                                        | **`effect` 3.17.7 pinned exactly**, plus `@effect/platform` 0.90.3. Its client `@uploadthing/react` gets Effect through `@uploadthing/shared` (also pinned to 3.17.7). |

None of the libraries Jali measures itself against depends on Effect. TanStack's pattern is a small in-house core and **Standard Schema** to accept users' validators. UploadThing shows what Effect costs consumers:

- Exact pins are needed because Effect's types and runtime must match.
- A host on a different Effect version gets two runtimes.
- UploadThing is still on Effect 3, so the v3 to v4 migration is the library's problem and its users wait on it.

If Effect types show up in Jali's `.d.ts` (`Effect<A, E, R>`, `Schema.Codec`), every host has to install Effect and learn it just to read the signatures. That cuts against "framework-free core, React optional peer, any app".

There is a contributor cost too. Jali's code is plain TypeScript with plain-English comments, and the docs are written for agents and hosts. Effect's generators, `pipe`, services and Layers are a second language every contributor and every reviewer (Opus, Codex) would have to read.

## Problem by problem

### 1. Teardown and cancellation (Opus CORE-3, Codex CORE-5: a pending `beforeClose` commits after `destroy()`)

- **Code:**
  - `destroy()` clears timers, cancels the URL write and settles an open discard question (`state/store.ts:738-757`).
  - The held host answer still runs `answer.then(... io.later(again) ...)` (`state/apply.ts:652-656`).
  - `io.later` is an unguarded `store.apply` (`state/store.ts:767`).
  - `defer` checks `destroyed` only when it schedules, not when the timer fires (`state/store.ts:508-520`).
- **With Effect:** a workspace `Scope`, each follow, debounce and guard forked into it, and `Scope.close` on destroy. That works, and interruption is structural. But the host's promise can't actually be interrupted anyway (it is the host's), so you still need "ignore the answer when it arrives". Every port call and timer would have to become an Effect to get the benefit, which means rewriting the store's IO layer. Cost: about 13 KB gzipped (measured).
- **In-house:** one lifetime object, as the Codex fix describes (an AbortController, a timer set, `guard(promise, fn)`). `destroyed` is checked in `store.apply`, in the `later` callback and when a deferred timer fires. Held `settled` promises are kept in a set and resolved `"kept"` on destroy, the same way the discard question already is. An `AbortSignal` is passed to async ports (`beforeClose(…, { signal })`, `requestWindow`), so a host's fetch can cancel too. Cost: about 0.24 KB gzipped (measured). It uses the web-standard API hosts already know.
- **Small library:** none needed.
- **Verdict:** in-house. The bug is one missing guard and one missing set, not a missing runtime.

### 2. Validation at trust boundaries (Opus CORE-1: the initial layout is unchecked; Codex CORE-2: a page item is not parsed; CORE-4: weights of 1e308; CORE-13: agent arguments)

- **Code:**
  - `validate()` is hand-rolled and hardened: a node-id regex, `MAX_NODES = 256`, depth 128, cycle and shared-node detection, legacy-node refusal, px or weight > 0 (`layout/codec/validate.ts:10-60`).
  - Params use constructors as types: `Number`, `String`, `Boolean`, `oneOf`, `optional`, `appOnly` (`pane-kinds.ts:48, 63, 224`). They are parsed by `parseParams`, which collects problems (`pane-kinds.ts:298-320`).
  - The reviews' "Keep as is" lists name the codec and validator limits and `checkRef`.
- **What the findings actually are:**
  - A path that skips the validator (the initial layout and presets).
  - A missing upper bound (finite but huge weights).
  - A page item that isn't run through the profile's parser.
  - Agent arguments read as `unknown` and cast.

  None of these exists because the validator can't express something. They are about where it is called, plus one bound.

- **With Effect Schema:** a recursive layout schema works (measured 25 KB gzipped) and gives good error trees and types derived from the schema. But it would replace a 6 K-minified validator that is tuned for hostile input (cycles, shared nodes, `own()` null-prototype reads) with a general one that you would then have to harden again. Hosts would see `Schema` in `params`.
- **In-house:** route `createJali({ layout })` and preset `build()` through `validate` + `readLayout`. Add a maximum weight, or normalise weights, in `validate`. Give pages an item parser. Add a tiny per-action argument table for the agent bridge (the shape `parseParams` already has).
- **Small library or standard:** accept **Standard Schema v1** (`~standard.validate`) as a `ParamType`, next to `Number` and `oneOf`. That is a type-only spec and roughly 20 lines of runtime: Jali calls `schema["~standard"].validate(value)`. Any host can then pass a Valibot (1.5 KB), Zod Mini (5.1 KB) or Effect Schema validator, paying only for its own. Effect Schema supports Standard Schema, and TanStack Form and Router accept schemas the same way.
- **Verdict:** keep the in-house validator, fix the entry points, and add a Standard Schema door for params and page items.

### 3. Typed errors and refusals

- **Code:**
  - `RefusalReason` is a closed union of 11 reasons (`state/apply.ts:144-155`).
  - `ActionResult = Done | Refusal` (`state/apply.ts:239`).
  - `settled: Promise<ActionResult>` never rejects (DECISIONS, 21 Nov).
  - The reviews say to keep `apply()`, held intents and `settled` as they are.
- **With Effect:** `Effect<Done, Refusal>` gives a typed error channel. But every host would have to run an Effect to call `jali.actions.close()`. That is the most visible kind of API leak, and it is worse than the plain `{ ok, reason }` that React Query or TanStack-style APIs use.
- **In-house:** already best-in-class. If wanted, make `Refusal` a union keyed by `reason` in 2.0 (DECISIONS 21 Nov deferred that for compatibility).
- **Verdict:** keep it. Effect adds nothing here that hosts would want.

### 4. Async ports

- **Code:**
  - `LocationPort` and `StoragePort` are synchronous (`ports.ts:26-34, 83`).
  - About 13 non-test `Promise` mentions exist in all of core (grep).
  - The only async edges are the host's `beforeClose` answer, `settled`, and Pop out's `requestWindow`, whose rejection the command drops (Codex CORE-11, `commands/registry.ts`).
- **With Effect:** `Effect.tryPromise` with interruption and typed failures. But it is used in three places.
- **In-house:** await `requestWindow` and map a rejection to a refusal (`"unavailable"`). Pass the lifetime's `signal`. Recheck pane identity and lifetime when the promise resolves.
- **Verdict:** in-house. A runtime for three promises is the wrong trade.

### 5. Event ordering (Codex CORE-12: a nested commit's `layout` event is delivered before the outer one, so the last event is stale)

- **Code:** subscribers run synchronously inside `write()` (`state/store.ts`, notify and commit path, around 495 and 605 in the reviewed tree).
- **With Effect:** `PubSub`, `Queue` or `Stream` can serialise delivery, but they deliver asynchronously. Jali's contract is synchronous events per commit (a host reads `getLayout()` right after an action), so you would be fighting the runtime.
- **In-house:** what the review's fix describes: a revision counter at commit, a FIFO of finished batches drained after the outermost commit, re-entrant notifications queued behind it, and subscriber errors caught. About 30 lines.
- **Verdict:** in-house.

### Summary

| Problem                 | Effect                                             | In-house                                     | Small library                                                 | Pick                       |
| ----------------------- | -------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------- | -------------------------- |
| Teardown / cancellation | Scope + fibers, ~13 KB gz, rewrite of the IO layer | lifetime token + AbortSignal, ~0.24 KB       | –                                                             | in-house                   |
| Boundary validation     | Schema, ~24–25 KB gz, API leak                     | existing validator + fix the entry points    | Standard Schema accepted (host brings Valibot, Zod or Effect) | in-house + Standard Schema |
| Typed refusals          | typed error channel; forces Effect on hosts        | `ActionResult` (already the reviews' "keep") | –                                                             | keep                       |
| Async ports             | `tryPromise` + interruption                        | handle rejection, signal, recheck lifetime   | –                                                             | in-house                   |
| Event ordering          | Queue/PubSub (async, against the contract)         | revision + FIFO drain                        | –                                                             | in-house                   |

## What to adopt instead

1. **A workspace lifetime primitive** (internal; adapter-visible at most): `alive()`, `later(ms, fn)`, `guard(promise, fn)`, `signal`, `close()`.
   - Every timer, deferred step, held answer, address arrival and URL write goes through it.
   - `store.apply` refuses `"unavailable"` after destroy.
   - Held `settled` promises live in a set, and destroy resolves them `"kept"`.
   - A test sits beside `tests/destroy.test.ts:118`.
   - This is the AbortController pattern hosts already use with `fetch`.
2. **`signal` on async host hooks:** `beforeClose(info, { signal })`. Additive, standard, and lets the host cancel its own work.
3. **One entry path for outside layouts:** initial layout, presets, links, storage and `setLayout` all go through `validate` + `readLayout`. Add a weight bound. Add a serialisation budget shared by actions and the codec (Codex CORE-9).
4. **Standard Schema as a `ParamType` and page-item parser** (type-only `@standard-schema/spec`, or inline the ~15-line interface to stay at zero dependencies). Keep `Number`, `String`, `Boolean`, `oneOf`, `optional` and `appOnly` as the zero-cost defaults. Infer `ParamsOf` from `StandardSchemaV1.InferOutput`.
5. **Event revisions + FIFO batch drain** (Codex CORE-12 fix).
6. **Agent bridge argument table** built from the same small param readers. Return structured `invalid` refusals; don't cast.

All six are additive or internal, cost well under 1 KB gzipped together, and keep the zero-dependency promise.

## Where Effect does fit in the owner's ecosystem

- **Good fit:**
  - Servers and backends: API services, the research portal's backend, any HTTP, RPC or SQL layer.
  - Data pipelines and ETL for consulting work, and long-running workflows: retries, schedules, resource safety, `effect/sql`, `effect/workflow`, observability.
  - Agent backends that orchestrate tools with timeouts and cancellation (`effect/ai`).
  - CLIs (`effect/cli`).

  These are places where bundle size doesn't matter, concurrency and failure handling are central, and one team owns all the code.

- **Possible, but probably not worth it:** app-level code in a single product (for example Data Studio's PGlite queries, retries and background loads). It works, and Atom needs React 19, which Data Studio already uses. But Jali's examples exist to show hosts how to use Jali, and Effect in an example would make them less representative of typical React apps. TanStack Query already covers Data Studio's async needs.
- **Not a fit:**
  - `@jali/core` and `@jali/react` themselves (size, API leak, contributor cost, no async-heavy core to serve).
  - Tooling scripts such as `scripts/size.mjs` and `scripts/verify.mjs`: short, sequential Node scripts, where Effect adds ceremony.
  - The docs site.

## Sources

- InfoQ, Effect 4.0 release: https://infoq.com/news/2026/11/effect-4-0-release
- Effect v4 beta post (size claim, unstable modules): https://effect.website/blog/releases/effect/40-beta
- Effect TS 7 language service: https://github.com/Effect-TS/tsgo · https://github.com/Effect-TS/language-service · https://effect.website/docs/v4/getting-started/devtools
- `@effect/atom-react` hooks: https://effect.website/docs/v4/api/atom-react/Hooks
- npm registry (`npm view`, 22 Nov 2026): effect, @effect/vitest, @effect/tsgo, @effect/atom-react, uploadthing, @uploadthing/shared, TanStack, zustand, jotai, xstate, dockview-core, react-resizable-panels, flexlayout-react
- Jali: `docs/DECISIONS.md` (19 Nov icons; 20 Nov primitives, destroy, opt-in page and size; 21 Nov budgets, `settled`, destroy and question), `packages/core/src/state/{store,apply}.ts`, `layout/codec/validate.ts`, `pane-kinds.ts`, `ports.ts`; the Opus and Codex core reviews in `scratchpad/reviews/`
