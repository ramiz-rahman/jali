# jali-layout/testing

An instance for tests, keys, and what a rendered pane would report, without the adapter's internals.

What your app's own tests need. See [Test an instance](../guides/testing.md).

## Make an instance

### createTestJali

*function*, from `jali-layout/testing`

```ts
createTestJali(options: TestJaliOptions): { jali: Jali; location: TestLocation }
```

`createJali`, kept apart from the page and from other tests: its address in memory (`location`), storage in memory, a size of 1440 by 900 unless `size` says otherwise, keys as on a Mac, and no DOM focus moved. `search` opens it on a link. Its features are the ones you give, with the address always in memory.

### testJaliOptions

*function*, from `jali-layout/testing`

```ts
testJaliOptions(options?: { search?: string; size?: { width: number; height: number } }): { options: Partial<JaliOptions>; location: TestLocation }
```

The same options, for an app that makes its instance in a function of its own: pass `options` to it, and put your own features before its `features` (`[...defaultFeatures(), ...(options.features ?? [])]`), so its memory address takes the place of `urlSync()`.

## Report, read and answer

### reportUnsaved

*function*, from `jali-layout/testing`

```ts
reportUnsaved(jali: AnyJali, pane: string, what: string | null): ActionResult
```

What a rendered pane's `useUnsaved` reports: `what` is unsaved in `pane`, or nothing is (`null`).

### reportPaneState

*function*, from `jali-layout/testing`

```ts
reportPaneState(jali: AnyJali, pane: string, key: string, value: unknown): ActionResult
```

What a rendered pane's `usePaneState` keeps: `value` under `key`, for the object the pane shows.

### paneStateOf

*function*, from `jali-layout/testing`

```ts
paneStateOf(jali: AnyJali, pane: string): Record<string, unknown> | undefined
```

A pane's own state, for the object it shows now.

### discardQuestion

*function*, from `jali-layout/testing`

```ts
discardQuestion(jali: AnyJali): { panes: readonly string[] } | null
```

"Discard unsaved changes?", while it is asked: the panes that would lose work.

### answerDiscard

*function*, from `jali-layout/testing`

```ts
answerDiscard(jali: AnyJali, answer: "discard" | "keep"): ActionResult
```

Answers the question as the person would: Discard makes the change it held, Keep editing doesn't.

### chooserRequest

*function*, from `jali-layout/testing`

```ts
chooserRequest(jali: AnyJali): ChooseOptions<unknown> | null
```

What `jali.dialogs.choose` is asking the person now, or `null`. Choose by calling its `onChoose`.

### lastAnnouncement

*function*, from `jali-layout/testing`

```ts
lastAnnouncement(jali: AnyJali): string
```

The last thing the instance said to assistive technology.

## Types

### TestJaliOptions

*type*, from `jali-layout/testing`

```ts
interface TestJaliOptions extends JaliOptions { search?: string }
```

`createTestJali`'s options: an instance's, and the link it opens on.

### TestLocation

*type*, from `jali-layout/testing`

```ts
type TestLocation = LocationPort & { entries: string[]; visit(search: string): void }
```

An address in memory: `entries` lists every address written, and `visit` changes it as Back or a router link would.
