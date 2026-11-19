# Studio: a Jali example

An audio session editor, for a short podcast episode or a recorded interview with a music bed. A library of sessions, a transcript that lights up word by word as it plays, a timeline of the tracks, a mixer on the real audio graph, a detail for each segment and a list of markers. One transport, in the app's own top bar, plays the session; every pane follows its playhead. It is built on `@jali/core` and `@jali/react` alone, and styled after Spoke, a Sixface recorder and transcript prototype.

```sh
pnpm install         # at the repository's root
pnpm example:studio  # http://localhost:5330
```

Build it as a static site with `pnpm exec vp build` in this folder, and serve `dist/` from any path: assets and audio clips are linked relative to the page, and the layout lives in the query string.

The audio is real. The speech is one clip per transcript segment, read by macOS system voices. The music bed and the sting are synthesised with the Web Audio API when a session loads. Nothing needs a key, a feed or a network service.

## The voices are placeholders

The speech was made with macOS system voices (`say`), as a placeholder for the lab. Replace it with properly licensed recordings before this example is published. The script is in `scripts/dialogue.mjs`: three short fictional interviews. Every show, person and place in them is made up.

## What to try

- Press Space to play and pause, wherever you are, except in a text field or on a button. The transcript lights each word as it is spoken, the timeline and the library draw the playhead, the markers light the one just passed.
- Move through the library with J and K. The transcript, the timeline, the mixer and the markers follow it, and the transport loads that session.
- Click a word or a time in the transcript to play from there. Drag across the timeline to scrub. Press / (or ⌘K ⌘J) for "Go to segment…", and type a word.
- With the transcript focused, J and K move between segments, and the segment detail beside it follows. Press L to loop a segment. "Follow playback" moves the selection with the voice.
- Press E on a segment to correct it, then Esc. The correction is unsaved work: the tab shows a dot, and choosing Mix (which has no transcript) asks first. Choose Review instead: the transcript and its draft come along. ⌘S saves.
- Click a speaker's name in the transcript to rename them. The timeline, the mixer and the segment detail follow.
- In Mix, move a fader, mute or solo a track, and watch the meters. Make the window short until the mixer folds into a tab: the sound and the mix go on, only the meters stop drawing. The folded mixer's shelf chip shows it is working.
- Press Keep on the segment detail, select another segment and press ⌥↵: two segments side by side. The Compare layout starts that way, with segment 4 kept and segment 6 following.
- Switch layouts in the top bar, then copy the link (the link button, or ⌘K "Copy a link to this layout"). The link reopens the same layout and session.
- Narrow the window. Panes fold into tabs rather than squeeze, and come back as it widens. Below 600 pixels a phone shows the library over the transcript.

## Keys

| Key            | Where                            | Does                                                         |
| -------------- | -------------------------------- | ------------------------------------------------------------ |
| Space          | anywhere but a field or a button | Play or pause                                                |
| /              | anywhere but a field             | Go to segment…                                               |
| ⌘K ⌘P, ⌘K ⌘J   | anywhere                         | Play or pause; Go to segment… (Jali's keymap)                |
| J, K, arrows   | a list                           | Move                                                         |
| Enter          | library, transcript, markers     | Open the transcript; play from the segment; go to the marker |
| ⌥Enter         | transcript                       | Open the segment's detail beside it                          |
| ⇧Space         | library, transcript              | Show the row in its detail now (Jali's peek)                 |
| E, L, ⌘S       | transcript                       | Correct the segment, loop it, save corrections               |
| M, R, Delete   | markers                          | Add a marker at the playhead, rename it, delete it           |
| ← →, Home, End | timeline                         | Step a second (⇧: five), go to either end                    |

### Space, and how it is shared with Jali

Every audio tool plays and pauses with Space, and Jali's lists use Space to peek. Jali binds no single keys itself: they belong to the focused content. So there is nothing of Jali's to move, and the app takes Space in one handler on the window (`src/shell/keys.ts`), in the bubble phase, after the focused content has had it:

1. A pane that wants Space claims it with `preventDefault()`. None of Studio's do; the peek moved to ⇧Space.
2. A text field keeps Space, and so does a control that Space presses for a keyboard user: a button, a tab, a checkbox. Jali's tabs and header buttons are such controls. Studio's own toolbar buttons don't take focus when clicked, so after a click Space still plays.
3. Jali's dialogs keep it.
4. Anything else plays or pauses.

`createJali({ reservedKeys: ["Space"] })` says the key is the app's, so a later Jali binding on Space would be refused at start-up instead of fighting the transport. Play and pause is also an app command with a Jali chord (⌘K ⌘P), so it is in ⌘K and in the keymap. See FINDINGS.md for what this took.

## How it is built

| File                       | What it shows                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/audio/engine.ts`      | The engine and transport, outside the panes: clips scheduled on one clock, a strip of gain, pan and meter per track, loop, speed.           |
| `src/audio/synth.ts`       | The music bed and the sting, rendered in an `OfflineAudioContext`. The bed ducks under the voices by itself.                                |
| `src/audio/react.ts`       | `usePosition(paused)` and `useFrame(paused, draw)`: a pane reads the clock and draws only while Jali says it is on screen.                  |
| `src/edits.ts`             | The person's changes, saved on this device: corrections, speaker names, notes, markers and the mix. The engine applies the mix from here.   |
| `src/panes/*.tsx`          | The six kinds of pane (and the launcher), each one `definePane` with params, a title, an icon and honest widths.                            |
| `src/panes/follow.ts`      | How one library drives followers of several kinds: each kind's `follow`.                                                                    |
| `src/panes/transcript.tsx` | A list that is also a follower: `usePaneState` for the draft, `useUnsaved` for unsaved corrections, `useCommands`, `select`.                |
| `src/panes/clip.tsx`       | The segment detail: its own waveform, loop, attribution, a note with `useUnsaved`, and `useTitle` for the speaker's current name.           |
| `src/panes/mixer.tsx`      | Strips on the real graph, meters drawn only while on screen, `useActivity("working")` while the sound goes through it.                      |
| `src/presets.ts`           | Edit, Mix, Review and Compare, written with `row`, `column` and `pane`: short wide panes stacked in columns.                                |
| `src/workspace.ts`         | `createJali`: the kinds, layouts, launcher, keymap, `reservedKeys`, and ⌘K commands that ask with `jali.actions.choose`.                    |
| `src/shell/`               | The app's chrome inside `<JaliRoot>`: a top bar with the layouts and the transport, a status line with Jali's `<Shelf />`, the app's keys.  |
| `src/styles/tokens.css`    | Spoke's look on Jali's `--jali-*` tokens: zinc, white paper, signal orange, IBM Plex. Light and dark as `light-dark()` pairs.               |
| `scripts/make-voices.mjs`  | Makes the speech (`say`, `afconvert`) and `src/sessions/generated.ts`: segment times from the clips' real lengths, word times interpolated. |

Run the script again after changing the dialogue: `node examples/studio/scripts/make-voices.mjs` (macOS only). Its output is committed, so the example runs without it.

Panes keep drawing only while they are on screen: each one passes Jali's `paused` to `usePosition` or `useFrame`. The sound itself never depends on a pane: it is in the engine, so it keeps playing whatever Jali does with the mixer or the timeline. The playback speed is Web Audio's `playbackRate`, so a faster voice is also higher; there is no time stretching.

## Tests

- `src/workspace.test.ts`: a workspace made with the app's kinds and layouts, in memory: following, pinning to compare, links, folding, unsaved work, commands and the chooser, the Space rule, and the silent transport (play, speed, loop, the end).
- `e2e/studio.spec.ts`: a Playwright smoke test against this app's own server, in real Chrome (it decodes the AAC clips). Run it from the repository's root with `pnpm exec playwright test -c examples/studio`.
- `e2e/screens.spec.ts`: the screenshots in `screens/`, every layout at three widths, a phone and dark mode. `SCREENS=1 pnpm exec playwright test -c examples/studio screens`.
