# Review of 22 Nov 2026

Six read-only reviews of master at `93526af`, two per area: one by an Opus reviewer and one by Codex GPT 6.2 Sol (high). Ids are per report, so `CORE-3` in `core-opus.md` and `CORE-3` in `core-codex.md` are different findings. Cite them as `core-opus CORE-3`.

| Area | Opus | Codex |
| --- | --- | --- |
| `@jali/core` | [core-opus.md](core-opus.md): 21 findings (P0 1, P1 4) | [core-codex.md](core-codex.md): 18 findings (P0 4, P1 6) |
| `@jali/react` | [react-opus.md](react-opus.md): 23 findings (P1 5) | [react-codex.md](react-codex.md): 19 findings (P0 3, P1 6) |
| Docs | [docs-opus.md](docs-opus.md): 40 findings (P0 4, P1 13) | [docs-codex.md](docs-codex.md): 17 findings (P0 1, P1 6) |

The plan that follows from them:

1. **Core correctness:** validation of layouts and kinds, pane state as one record per pane, teardown, a current address after a refit, measured geometry, event order, read-only snapshots.
2. **React correctness and accessibility:** a stable host node per pane, selector equality, more boundaries, DOM ids scoped per instance, `"use client"`, and the a11y findings.
3. **API**, after an API review doc: one action path, one record per pane, kind and param types through the API, opt-in feature modules, Standard Schema for params, deprecated names removed, one unscoped `jali` package with subpaths.
4. **Pop out made stable.**
5. **Docs**, written once in the final words. "Workspace" leaves the prose.

Effect was considered for the packages and not taken: [../../research/effect.md](../../research/effect.md).
