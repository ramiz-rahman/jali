# Findings: Handshake

What Jali, or building Jali with CyberSpec, made hard. Each entry: what we wanted, what got in the way, what we did.

## Readability (the whole app)

- **Wanted:** text that reads calmly for a long session, in CyberSpec's look. **In the way:** the kit derives
  `--cy-ink` and `--cy-ink-mute` from the accent, so every label, list title, note and table cell came out red, which
  reads as an error and tires the eye. **Did:** neutral inks in `tokens.css` and `light.css`; the accent is left to
  frames, controls' edges, the active state and focus.
- **Wanted:** lesson paragraphs that are easy to read for twenty minutes. **In the way:** CyberSpec has one face,
  Rajdhani, a narrow display face with a small x-height; at body size a paragraph of it is hard work. **Did:** prose
  that is read as sentences (lesson steps, the lab and try-it cards, the self-check, glossary definitions) is set in
  Atkinson Hyperlegible Next at 16px, 1.65 leading, 64ch measure, in the reading ink rather than the brightest.
  Headings, labels, badges and controls stay in Rajdhani, so the skin looks the same.
- **Wanted:** one type system across the app. **In the way:** CyberSpec upper-cases units, table cells, select values
  and list meta (so "Home-5G" read "HOME-5G", and "Mbps" read "MBPS", which is a different unit); its micro-print is
  8px; it names "JetBrains Mono Variable" first and uses mono at 600 and 700, weights the app hadn't loaded, so they
  were synthesised; and its panel titles are 17 or 18px depending on the variant. **Did:** case is never transformed
  on data or units; `--cy-text-micro` is the app's 11px floor; `--cy-mono` is the app's mono, with 600 and 700
  loaded; one panel-title size. The rule is written at the top of `tokens.css`: a word or label is Rajdhani, a
  sentence is the reading face (16px in lessons, 14px in panes), a value someone might copy is mono.
- **Wanted:** the focused pane, the chosen tab and ⌘K's cursor in the theme's colour. **In the way:** nothing; Jali
  derives its focus ring and tints from `--jali-accent`. **Did:** set it from the accent on the skin.
- **Wanted:** plain figures. **In the way:** `Readout` defaults to `tone="signal"`, so every count was cyan and colour
  stopped meaning anything. **Did:** signal-toned readouts take the reading ink; yellow is kept for something to
  watch (CGNAT, a silent hop, no ARP reply).
- **Wanted:** keyboard keys that are discoverable without crowding the pane. **In the way:** `KeyHint` rows sit in
  the layout as text and read like extra buttons ("Previous ← Back → Next Next"). **Did:** no hint rows; the keys
  are in `aria-keyshortcuts`, tooltips and ⌘K.
- **Wanted:** lists of titles that scan. **In the way:** `ItemList` names are tracked upper case. **Did:** sentence
  case for item names, app-wide in `parts.css`.

## Setting up CyberSpec

- **Wanted:** CyberSpec's components inside a Jali example, installed the way CyberSpec documents (shadcn registry).
  **In the way:** the installer writes imports through an `@/` alias, which would have to be mapped repo-wide, and
  its files import with `.ts`/`.tsx` extensions. **Did:** aliases set to `#src/*` (package.json `imports`, which
  TypeScript and Vite resolve with no config), and `allowImportingTsExtensions` in the root tsconfig.
- **Wanted:** the vendored source to pass the repo's strict checks. **In the way:** about 70 errors under
  `noUncheckedIndexedAccess` (most in the map and globe). **Did:** minimal guards and defaults in the vendored files.
- **Wanted:** light and dark, as every example has. **In the way:** CyberSpec ships a dark skin only. **Did:** a
  daylight skin in `src/styles/light.css`, set on CyberSpec's surface and ink tokens.
- **Wanted:** no request to a font service. **In the way:** the installer adds a Google Fonts `@import`. **Did:**
  removed it; Rajdhani and JetBrains Mono come from `@fontsource`.

## Measure

- **Wanted:** one readable type scale for the connection and probe tools at phone width. **In the way:**
  CyberSpec's decorative `Panel` codes use 8px micro-print and mixed ink that fails contrast in both themes.
  **Did:** mapped the kit's type tokens to `--hs-*` within these panes and gave panel codes the normal muted ink;
  vendored components are unchanged.
- **Wanted:** compact selectable latency series with sample counts. **In the way:** `HexStat` is always a button,
  so using it as a passive statistic would imply an action. **Did:** made its three nodes switch the signal graph
  between idle, download-loaded, and upload-loaded samples, with the selected state identifying the series.
- **Wanted:** a transfer ledger with no implied bulk operation. **In the way:** `DataTable` always includes
  row-selection checkboxes and an "N of M selected" footer. **Did:** hid both with CSS in `live.css`, as the scan
  tables do; the result is the largest completed size, not a selected row.
- **Wanted:** browser timing phases without disturbing other panes' performance entries. **In the way:** the
  development module graph can fill the browser's Resource Timing buffer before a run. **Did:** observed each
  request's completion with `PerformanceObserver`, without clearing the shared buffer; timing remains marked
  unavailable when Timing-Allow-Origin does not expose it.

## The course (lessons, lesson, glossary)

- **Wanted:** a lesson pane that changes its own `step` param, so the step is in the address. **In the way:** no
  documented way for a pane to change its own params; `openHere` is documented as "show another object in this pane".
  **Did:** `openHere(lesson({ id, step }))`. Checked in the browser: the pane stays a follower of the outline
  ("Following", not "Kept"), the address changes, and the tool panes linked to the lesson keep following it. It
  works; it should be written down as the way a pane steps through its own object.
- **Wanted:** a preset that names tool panes of another area by plain ref. **In the way:** while the kinds were not
  registered, clicking the layout did nothing at all: no console message, no toast. The top bar's select then warned
  that its value "stayed". **Did:** nothing in the example; a preset naming an unknown kind should say so.
- **Wanted:** CyberSpec's item list for the outline of nine long lesson titles. **In the way:** the name column is
  one line with an ellipsis, the meta column is 10px (under the app's 11px floor) and disappears below 260px.
  **Did:** overrides in `course.css` that let the name wrap and put the meta under it, at the app's micro size.
- **Wanted:** paragraphs of prose in CyberSpec's ink. **In the way:** `--cy-ink` is the accent (a saturated red in the
  dark skin and a dark red in daylight), fine for labels and unreadable for a page of text. **Did:** lesson and
  glossary text use `--cy-ink-hi`; the accent stays on headings' kickers, buttons and the kit's own parts.
- **Wanted:** a Collapsible whose label is a question with `code` in it. **In the way:** `label` is a plain string.
  **Did:** the question is rendered above a Collapsible labelled "Show the answer".
- **Wanted:** a visually hidden class for the "(open in the glossary)" text on a link. **In the way:** the kit has
  only the `data-sr-only` attribute, scoped to its own components, and the app had no `.sr-only`. **Did:** used the
  attribute.

## Scans (Scans, Wi-Fi, Devices, Path)

- **Wanted:** a read-only table of devices and networks. **In the way:** CyberSpec's DataTable always draws a
  selection column and an "N of M selected" footer. **Did:** hid both with CSS in `scans.css`; the tables are read, and
  sorted by their headings.
- **Wanted:** a tooltip on a badge that explains it ("Private MAC"). **In the way:** the kit's Tooltip warns in the
  console that the trigger has no accessible name unless the child is interactive (a Badge is a span). **Did:** used
  the `title` attribute, and put the same explanation in text on the page, since a tooltip is never the only place
  to say something.
- **Wanted:** SVG labels that stay at the type scale at 360px. **In the way:** a scaled viewBox shrinks text below
  11px. **Did:** the channel map re-measures its width and draws in real pixels.
- **Wanted:** the Scans list to drive three followers of different kinds. **In the way:** nothing, but `selects`
  names one kind, so the list does not use it; each row reports `select(ref of its own kind)` and the pane of that
  kind follows. Worked as the docs say.
- **Wanted:** panes that open each other without an import cycle (Scans opens Wi-Fi; Wi-Fi's empty state opens
  Scans). **Did:** plain refs in `scans/refs.ts`.

## Packets (packet list, dissection, bytes, layers, ladder, compare)

- **Wanted:** a packet list of thousands of rows in seven columns, drawn only where it is in view. **In the way:**
  CyberSpec's DataTable always adds a selection column and draws every row; ItemList has four fixed columns and
  draws every row too. Neither takes a row renderer or a window. **Did:** a listbox of absolutely placed rows of my
  own (`panes/packets.tsx`), in the kit's tokens, with `aria-setsize`/`aria-posinset` and the cursor's row always
  drawn so `aria-activedescendant` never points at nothing.
- **Wanted:** the dissection as CyberSpec's Tree, read in the case it was written in. **In the way:** the tree sets
  rows in upper case with wide tracking and its meta at 10px (under the 11px floor); labels are plain strings, so a
  row can't carry its layer's colour or a warning glyph; and there is no pointer-hover callback (only `onHighlight`,
  for the keyboard), so hovering a field can't light its bytes. **Did:** overrides in `styles/packets/`; a "!" in the
  meta for a bad checksum or a cut header; keyboard movement and clicks in the tree light the bytes, and hovering a
  byte lights the tree.
- **Wanted:** no axe violations. **In the way:** an expanded Tree branch fails `label-content-name-mismatch`
  (WCAG 2.5.3): the treeitem is named by its row (`aria-labelledby`) but its text includes its children's. It comes
  from the kit's Tree markup, which the example doesn't edit. **Did:** nothing: it needs a `known` entry in the e2e
  axe check, or a fix in CyberSpec's tree.
- **Wanted:** the dissection's open branches to stay open as the pane follows the list from packet to packet (open
  TCP options on one packet, see them on the next). **In the way:** `usePaneState` belongs to the object shown, so
  every follow step drops it, as documented. **Did:** React state keyed by field ids, which are the same for a
  protocol in every packet (`tcp.options`); it survives following but not a reload.
- **Wanted:** clicking an arrow in the ladder, which follows the packet list, to move the list's cursor so every
  follower moves. **In the way:** `PaneProps.select` reports the ladder's own selection, which only its own
  followers see; nothing in the props says "select on the pane I follow". **Did:** `jali.actions.select(node.linkedTo,
  ref)` when the source's kind `selects` packets (`jali.env.kinds.get(kind)?.selects`), else `select(ref)`
  (`selectUpstream` in `panes/parts/lab.ts`), and the ladder reads the source's selection with
  `useJaliState((s) => s.selection[linkedTo])` to mark the current arrow. It works; it took reading the core types.
- **Wanted:** a source pane (a lesson, the packet list) to know whether anything beside it shows what it selects,
  and to open a pane when nothing does. **In the way:** no hook answers "which of my followers would show this
  ref"; the parts exist (`model.panes` with `linkedTo`/`follows`, `model.visible`, `jali.env.kinds.follow`) but
  every app must put them together. **Did:** `useLab` and `openFollower` in `panes/parts/lab.ts`, asking each
  visible follower's kind through `env.kinds.follow`, so no pane keeps its own list of which kinds show what. A
  `useFollowers(nodeId)` in Jali would make this one line.
- **Wanted:** a pane title for a capture opened from a file. **In the way:** `title(params)` sees only the id
  (`file-…`), not the file's name, which is known once it is read. **Did:** `useTitle` in the list once it has loaded.
