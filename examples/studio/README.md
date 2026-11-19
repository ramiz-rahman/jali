# Studio: a Jali example

An audio session editor, for a short podcast episode or a recorded interview with a music bed. A library of sessions, a transcript that lights up word by word as it plays, a timeline of the tracks, a mixer on the real audio graph, a detail for each segment and a list of markers. One transport, in the app's own top bar, plays the session; every pane follows its playhead. It is built on `@jali/core` and `@jali/react` alone, with a hardware-inspired look: each pane is a device on a desk.

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
- Click a word or a time in the transcript to play from there. Drag across the timeline, or turn the jog wheel in the transport, to scrub. Press / (or ⌘K ⌘J) for "Go to segment…", and type a word.
- With the transcript focused, J and K move between segments, and the segment detail beside it follows. Press L to loop a segment. "Follow playback" moves the selection with the voice.
- The selected segment's keys sit above the transcript: play, correct, loop, detail and rename. Nothing sits inside a row, so every row is one option a screen reader can move through.
- Press E on a segment to correct it, then Esc. The correction is unsaved work: the tab shows a dot, and choosing Mix (which has no transcript) asks first. Choose Review instead: the transcript and its draft come along. ⌘S saves.
- Click a speaker's name in the transcript to rename them. The timeline, the mixer and the segment detail follow.
- In Mix, move a fader, mute or solo a track, and watch the meters. Make the window short until the mixer folds into a tab: the sound and the mix go on, only the meters stop drawing. The folded mixer's shelf chip shows it is working.
- Press Keep on the segment detail, select another segment and press ⌥↵: two segments side by side. The Compare layout starts that way, with segment 4 kept and segment 6 following.
- Switch layouts in the top bar, then copy the link (the link button, or ⌘K "Copy a link to this layout"). The link reopens the same layout and session.
- Narrow the window. Panes fold into tabs rather than squeeze, and come back as it widens. Below 600 pixels a phone shows the library over the transcript.

## Keys

| Key                | Where                            | Does                                                         |
| ------------------ | -------------------------------- | ------------------------------------------------------------ |
| Space              | anywhere but a field or a button | Play or pause                                                |
| /                  | anywhere but a field             | Go to segment…                                               |
| ⌘K ⌘P, ⌘K ⌘J       | anywhere                         | Play or pause; Go to segment… (Jali's keymap)                |
| J, K, arrows       | a list                           | Move                                                         |
| Enter              | library, transcript, markers     | Open the transcript; play from the segment; go to the marker |
| ⌥Enter             | transcript                       | Open the segment's detail beside it                          |
| ⇧Space             | library, transcript              | Show the row in its detail now (Jali's peek)                 |
| E, L, ⌘S           | transcript                       | Correct the segment, loop it, save corrections               |
| M, R, Delete       | markers                          | Add a marker at the playhead, rename it, delete it           |
| ← →, Home, End     | timeline                         | Step a second (⇧: five), go to either end                    |
| ↑ ↓ ← →, Home, End | a knob, the jog wheel            | Turn it (⇧: ten steps); drag it too; double-click resets     |

### Space, and how it is shared with Jali

Every audio tool plays and pauses with Space, and Jali's lists use Space to peek. Jali binds no single keys itself: they belong to the focused content. So there is nothing of Jali's to move, and the app takes Space in one handler on the window (`src/shell/keys.ts`), in the bubble phase, after the focused content has had it:

1. A pane that wants Space claims it with `preventDefault()`. None of Studio's do; the peek moved to ⇧Space.
2. A text field keeps Space, and so does a control that Space presses for a keyboard user: a button, a tab, a checkbox. Jali's tabs and header buttons are such controls. Studio's own toolbar buttons don't take focus when clicked, so after a click Space still plays.
3. Jali's dialogs keep it.
4. Anything else plays or pauses.

`createJali({ reservedKeys: ["Space"] })` says the key is the app's, so a later Jali binding on Space would be refused at start-up instead of fighting the transport. Play and pause is also an app command with a Jali chord (⌘K ⌘P), so it is in ⌘K and in the keymap. See FINDINGS.md for what this took.

## Styling: hardware-inspired

Studio looks like a set of hardware modules on a desk. It is inspired by a design language of small audio instruments, not a copy of any product: there are no product names, model numbers or logos in it.

- **The top row.** One row of one height in four groups, the way a console groups its controls: identity (a name plate), layouts (edit, mix, review, compare), the player (its display, back, play, stop, forward, loop, then scrub and speed as a matched pair of rotary cells) and tools (link, theme, ⌘K). Inside a group the cells meet at a 2px seam in one recessed bezel; between groups there is a 10px gutter. The player's display takes the spare width, with the session's progress as a hairline track across its glass. Play is the one orange cap; it is the same size as its neighbours. As the window narrows, groups give way in order: the speed knob; then the layout keys fold into one layout key (a real `<select>` under its face); then the studio name and the display's title line; then scrub, loop and link; then stop. On a phone it becomes two rows: identity, layout and tools, then the player across the full width.
- **The key face.** Every key in the row, and the larger keys in the panes, use one face: the glyph centred, its middle 8px above the key's middle; the legend centred under it on one baseline 9px from the foot; the lamp 7px in from the top right corner, only on keys that latch. Positions are fixed, so a longer legend or a latched key never moves its neighbours' baselines. A latched key doesn't travel: it shows its state with a darker face and its lit lamp. A press travels 1px. The layout keys carry a small plan of their layout as their glyph.
- **Keysets.** In the panes, related keys share a bezel the same way: the transcript's segment keys in three sets (play and loop; correct and rename; detail), the segment detail's play and loop, each mixer strip's mute and solo.
- **Bodies.** Each Jali pane is a faceplate: bead-blasted aluminium in light, with a lit top edge, a rim and a side wall at its foot. The mixer is black anodised beside them; in dark mode every device is black anodised. Seams are cut lines with a lit edge under them. No screws.
- **Corners.** Square: one `--corner` token (2px) for every key, block, faceplate, glass, paper, menu and dialog, Jali's included. Only what is round by nature stays round: knobs, the jog wheel, fader caps and lamps.
- **One set of parts.** `src/styles/parts.css` defines each part once (housing, tray, key in four sizes, latch, lamp, knob, jog, fader, readout, LCD, paper, legend), each rule listing the app's classes and Jali's public parts together. Everything button-like is one of them: the top row, pane header buttons, tabs, Keep, shelf chips, the phone switcher, palette and chooser rows, dialog buttons, the launcher, the library's session cards, the transcript's segment keys, mute and solo, loop, save and revert.
- **Controls.** Keys stand in their holes (a 3 to 4px side wall) and travel down when pressed. A latched key (the layout in use, Follow playback, Loop, Mute, Solo, the shown tab) stays down with its lamp lit, so its state never rests on a shadow alone. The transport has four big square keys with an orange play legend and lamp, a loop latch, a knurled jog wheel to scrub and a speed knob. Pan is a rotary knob with a pointer and a printed scale, on blue, green, white and orange caps. Faders are round white caps riding in slots cut into the plate.
- **Screens.** The waveforms, the timeline, the meters, the transport's readout and ⌘K's field sit behind black glass with light marks. The markers are dark print behind a grey-green LCD, and the segment detail's speaker and track sit in one too.
- **Type.** One face, Chakra Petch, for everything printed: legends, keys, headers, the transcript and Jali's chrome (`--jali-font`). It has no tabular figures (its 1 is narrower than its 0), so a running clock would jitter. The numbers that tick, and what sits behind glass or on the LCD (the clock, timecodes, the timeline's ruler, dB values, the markers' times), are set in IBM Plex Mono (`--font-readout`).
- **Paper.** The transcript is read, so it is printed on a recessed sheet of paper rather than shown on a screen: 17px Chakra Petch on a 1.62 line height (it runs wider and squarer than a text face, so a little larger and looser), dark ink on near white (more than 15:1), light on near black in dark mode.
- **Header buttons (temporary comparison).** The pane header's tuck, maximise and close come in four treatments, to choose one: A printed glyphs (the default: no cap at rest, a shallow key on hover and press), B recessed wells, C one low strip, D small round push-buttons. ⌘K "Header buttons: printed / wells / strip / round…" switches them at runtime; the choice is kept on this device. The switch (`src/ui/headerButtons.ts` and its rules in `chrome.css`) is temporary and goes once one is chosen. Close-ups: `screens/header-buttons-{a,b,c,d}{,-dark}.png`.
- **Colour.** Neutral bodies, Spoke's signal orange (#ff4f00) for the one primary key, lamps and what is live; blue, green and white only on encoder caps.
- **How.** CSS gradients, inset and layered shadows, `repeating-conic-gradient` for the knurling, and SVG for the knob scales and transport glyphs. No photos or raster textures. Jali's chrome follows through its `--jali-*` tokens and rules on its public `jali-*` parts (`src/styles/chrome.css`); what could not be reached that way is in FINDINGS.md.
- **Motion.** Keys travel 70ms with a mechanical ease and no bounce; under reduced motion they don't animate.

### Credits

The typeface is [Chakra Petch](https://fonts.google.com/specimen/Chakra+Petch) by Cadson Demak, under the SIL Open Font License 1.1; the readouts use [IBM Plex Mono](https://github.com/IBM/plex), also under the SIL Open Font License 1.1.

The way the bodies, keys and screens are built (a molded body with a lit top edge and a hard side-wall shadow, keys that drop by their wall when pressed, recessed glass with a lit lower lip, lower-case printed legends) takes ideas from [SPEC-01 Hardware](https://github.com/shuding/spec-01) by Shu Ding, MIT licence. No code, values or files were copied from it.

## How it is built

| File                       | What it shows                                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/audio/engine.ts`      | The engine and transport, outside the panes: clips scheduled on one clock, a strip of gain, pan and meter per track, loop, speed.                     |
| `src/audio/synth.ts`       | The music bed and the sting, rendered in an `OfflineAudioContext`. The bed ducks under the voices by itself.                                          |
| `src/audio/react.ts`       | `usePosition(paused)` and `useFrame(paused, draw)`: a pane reads the clock and draws only while Jali says it is on screen.                            |
| `src/edits.ts`             | The person's changes, saved on this device: corrections, speaker names, notes, markers and the mix. The engine applies the mix from here.             |
| `src/panes/*.tsx`          | The six kinds of pane (and the launcher), each one `definePane` with params, a title, an icon and honest widths.                                      |
| `src/panes/follow.ts`      | How one library drives followers of several kinds: each kind's `follow`.                                                                              |
| `src/panes/transcript.tsx` | A list that is also a follower: `usePaneState` for the draft, `useUnsaved` for unsaved corrections, `useCommands`, `select`.                          |
| `src/panes/clip.tsx`       | The segment detail: its own waveform, loop, attribution, a note with `useUnsaved`, and `useTitle` for the speaker's current name.                     |
| `src/panes/mixer.tsx`      | Strips on the real graph, meters drawn only while on screen, `useActivity("working")` while the sound goes through it.                                |
| `src/presets.ts`           | Edit, Mix, Review and Compare, written with `row`, `column` and `pane`: short wide panes stacked in columns.                                          |
| `src/workspace.ts`         | `createJali`: the kinds, layouts, launcher, keymap, `reservedKeys`, and ⌘K commands that ask with `jali.actions.choose`.                              |
| `src/shell/`               | The app's chrome inside `<JaliRoot>`: a top bar with the layouts and the transport, a status line with Jali's `<Shelf />`, the app's keys.            |
| `src/styles/tokens.css`    | The hardware family on Jali's `--jali-*` tokens and the app's own: bodies, key caps, screens, the LCD, paper. Light and dark as `light-dark()` pairs. |
| `src/styles/parts.css`     | The parts, defined once: housing, tray, key, latch, lamp, knob, jog, fader, readout, LCD, paper, legend.                                              |
| `src/styles/chrome.css`    | Jali's own chrome as part of the family: faceplates, header keys, tabs as latched keys, the shelf, ⌘K and the chooser with a screen for a field.      |
| `src/ui/Knob.tsx`          | The knobs and the jog wheel: drawn in CSS and SVG, built as `role="slider"` with names, values, keys and drag.                                        |
| `scripts/make-voices.mjs`  | Makes the speech (`say`, `afconvert`) and `src/sessions/generated.ts`: segment times from the clips' real lengths, word times interpolated.           |

Run the script again after changing the dialogue: `node examples/studio/scripts/make-voices.mjs` (macOS only). Its output is committed, so the example runs without it.

Panes keep drawing only while they are on screen: each one passes Jali's `paused` to `usePosition` or `useFrame`. The sound itself never depends on a pane: it is in the engine, so it keeps playing whatever Jali does with the mixer or the timeline. The playback speed is Web Audio's `playbackRate`, so a faster voice is also higher; there is no time stretching.

## Tests

- `src/workspace.test.ts`: a workspace made with the app's kinds and layouts, in memory: following, pinning to compare, links, folding, unsaved work, commands and the chooser, the Space rule, and the silent transport (play, speed, loop, the end).
- `e2e/studio.spec.ts`: a Playwright smoke test against this app's own server, in real Chrome (it decodes the AAC clips). Run it from the repository's root with `pnpm exec playwright test -c examples/studio`.
- `e2e/screens.spec.ts`: the screenshots in `screens/`, every layout at three widths, a phone and dark mode. `SCREENS=1 pnpm exec playwright test -c examples/studio screens`.
