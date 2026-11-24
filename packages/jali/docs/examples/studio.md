# Studio

An audio session editor: a transcript that lights up word by word, a timeline, a mixer and markers, all following one playhead.

[Open Studio](https://jali.ramizrahman.com/apps/studio/?preset=edit) · [Source](https://github.com/ramiz-rahman/jali/tree/master/examples/studio)

## What it shows

Each link opens Studio in the state that shows it, so you can try it at once.

- **[Every pane follows one playhead](https://jali.ramizrahman.com/apps/studio/?preset=edit)**: Press Space to play. The transcript lights each word as it is spoken; the timeline, library and markers follow the same playhead. ([how it works](https://jali.ramizrahman.com/learn/following))
- **[Unsaved work that travels](https://jali.ramizrahman.com/apps/studio/?preset=review)**: Press E on a segment to correct it. Mix has no transcript, so choosing it asks first; Review takes the transcript and its draft along. ([how it works](https://jali.ramizrahman.com/guides/unsaved-work-and-pane-state))
- **[Kept and following, side by side](https://jali.ramizrahman.com/apps/studio/?preset=compare)**: One segment is kept, the other follows the transcript's selection: two moments of the landing, read against each other. ([how it works](https://jali.ramizrahman.com/learn/following))

## Its data

Three real recordings: radio traffic from the Apollo 11 landing, a song from its multitrack masters, and a dinner-party conversation from a research corpus.

## Run it yourself

Run `pnpm studio` at the repository's root, then open http://localhost:5330.
