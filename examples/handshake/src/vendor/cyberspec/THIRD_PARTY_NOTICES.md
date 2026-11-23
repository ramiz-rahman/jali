# Third-party notices

CyberSpec's original source code is licensed under the MIT License in
`LICENSE`. Third-party software and recordings retain their own terms.

## Bundled recordings

The recorded audio in `registry/cyber/lib/sound-samples.ts` is **excluded
from CyberSpec's MIT license**. The following recordings were supplied for
the project and are embedded as PCM data:

| Recording | Use |
| --- | --- |
| `ticking.mp3` | Hover, selection, typing, navigation and continuous adjustment |
| `moving-slider-to-left.wav` | Increment and decrement |
| `ES_User Interface, Beep, Button Interaction, Confirm, Small, Bright, Futuristic, Scifi, Variations 02 - Epidemic Sound.mp3` | On and off |
| `ES_User Interface, Motion, Hitech GUI, Scifi, Interact, Digital, Glitch 01 - Epidemic Sound.mp3` | Modal and drawer transitions |
| `ES_User Interface, Alert, Futuristic Technology, UI Confirm Tone, Bright 02 - Epidemic Sound.mp3` | Button presses, tab changes and segmented control changes |

The three Epidemic Sound recordings are from the
[Epidemic Sound catalog](https://www.epidemicsound.com/sound-effects/).
Their use is subject to a separate applicable license from Epidemic Sound.
The source license for the two other supplied recordings is not documented
in this repository. Inclusion here does not grant permission to use,
redistribute or sublicense these recordings. Confirm the rights required
for your intended use, or replace the recorded samples with audio you may
use and distribute. Interface sounds are off by default.

Extraction, trimming, tempo changes and encoding do not change the source
recordings' licensing. The source filenames, extraction ranges and source
hashes are preserved in `docs/SOUNDS.md`, `scripts/sound-samples.py` and the
generated sample module. The audio engine and synthesized outcome voices
are CyberSpec code covered by MIT; the recorded PCM data is not.

Registry installations include this notice and CyberSpec's MIT license under
the project's configured library directory in `cyberspec/`.

## Map geography

The map component uses land, lake and country boundary data from
[Natural Earth v5.1.2](https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson)
at 1:110 million scale. CyberSpec projects and simplifies these layers for its
SVG basemap. Natural Earth provides the data in the
[public domain](https://www.naturalearthdata.com/about/terms-of-use/).

## Software, fonts and icons

- [UI SDK](https://ui-sdk.dev): Apache-2.0. Installed as the public
  `@ui-sdk/core` and `@ui-sdk/react` packages, with their own license files.
- [Lucide](https://lucide.dev): ISC, with MIT notices for Feather-derived
  icons. Installed through `lucide-react`; retain its complete license file.
- [Rajdhani](https://fonts.google.com/specimen/Rajdhani) and
  [JetBrains Mono](https://www.jetbrains.com/lp/mono/): SIL Open Font
  License 1.1. The registry adds Google Fonts imports; the demo site also
  uses the corresponding Fontsource packages.
- The homepage serves Kode Mono from the Fontsource variable package.
  [Copyright and SIL Open Font License 1.1](public/licenses/kode-mono.txt)
- [React](https://react.dev): MIT. Supplied by the consuming application.

The structure and iOS haptics technique follow
[SPEC-01](https://github.com/shuding/spec-01) by Shu Ding, which is
MIT-licensed. CyberSpec's README credits that project. Other dependencies
retain the notices and licenses included in their packages.
