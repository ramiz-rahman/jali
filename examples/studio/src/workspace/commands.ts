/**
 * The app's own commands in ⌘K, after Jali's, under the app's groups. "…" ones ask first, in Jali's chooser.
 */
import { copyLink, type Command } from "jali";
import { makerCommand } from "@jali-examples/shared/maker/maker";
import { themeCommand } from "@jali-examples/shared/theme";
import { SPEEDS } from "../audio/engine";
import { viewNow } from "../model/view";
import { credits } from "../panes/credits";
import { workOn } from "../panes/library";
import { show } from "../panes/links";
import { markers } from "../panes/markers";
import { mixer } from "../panes/mixer";
import { selectSegment } from "../panes/transcript";
import type { Services } from "../services";
import { catalogueOf } from "../sessions/catalog";
import { segmentForLoop } from "../sessions/derive";
import { clock, opening } from "../sessions/format";
import { SESSION_IDS } from "../sessions/ids";

export function studioCommands({ engine, edits, layouts, settings, notify }: Services): Command[] {
  const view = () => viewNow(edits, engine.session());
  const session = () => engine.get().session;
  return [
    { id: "studio.play", title: "Play or pause", group: "Transport", run: () => engine.toggle() },
    { id: "studio.back", title: "Back 5 seconds", group: "Transport", run: () => engine.skip(-5) },
    {
      id: "studio.forward",
      title: "Forward 5 seconds",
      group: "Transport",
      run: () => engine.skip(5),
    },
    {
      id: "studio.segment",
      title: "Go to segment…",
      group: "Transport",
      run: (jali) => {
        const v = view();
        jali.dialogs.choose({
          title: "Go to segment…",
          items: v.session.segments,
          label: (seg) => opening(v.textOf(seg), 9),
          // Who, then when: the list sets hints flush right, so the times line up down its edge.
          hint: (seg) => `${v.speakerName(v.speakerOf(seg))}  ${clock(seg.start)}`,
          placeholder: "A word, a name or a time",
          onChoose: (seg) => {
            engine.cue(v.session.id, seg.start, engine.get().playing);
            selectSegment(jali, v.session.id, seg.id);
          },
        });
      },
    },
    {
      id: "studio.marker",
      title: "Jump to marker…",
      group: "Transport",
      run: (jali) => {
        const v = view();
        jali.dialogs.choose({
          title: "Jump to marker…",
          items: v.markers,
          label: (m) => m.label,
          hint: (m) => clock(m.time),
          placeholder: "A marker's name",
          onChoose: (m) => engine.cue(v.session.id, m.time, engine.get().playing),
        });
      },
    },
    {
      id: "studio.add-marker",
      title: "Add a marker at the playhead",
      group: "Transport",
      run: () => {
        const t = engine.position();
        edits.session(engine.session()).addMarker(t, `Marker at ${clock(t)}`);
        notify(`Marker added at ${clock(t)}`);
      },
    },
    {
      id: "studio.speed",
      title: "Playback speed…",
      group: "Transport",
      run: (jali) =>
        jali.dialogs.choose({
          title: "Playback speed…",
          items: [...SPEEDS],
          label: (r) => `${r}×`,
          hint: (r) => (r === 1 ? "as recorded" : ""),
          current: engine.get().rate,
          onChoose: (r) => engine.setRate(r),
        }),
    },
    {
      id: "studio.loop",
      title: "Loop the segment playing, or stop looping",
      group: "Transport",
      run: () => {
        if (engine.get().loop) return engine.setLoop(null);
        engine.toggleSegmentLoop(session(), segmentForLoop(engine.session(), engine.position()));
      },
    },
    {
      id: "studio.session",
      title: "Open session…",
      group: "Studio",
      run: (jali) =>
        jali.dialogs.choose({
          title: "Open session…",
          items: [...SESSION_IDS],
          label: (s) => catalogueOf(s).title,
          hint: (s) => `${catalogueOf(s).source} · ${catalogueOf(s).tracks} tracks`,
          onChoose: (s) => workOn(jali, engine, s),
        }),
    },
    {
      id: "studio.mixer",
      title: "Show the mixer",
      group: "Studio",
      run: (jali) => show(jali, mixer({ session: session() })),
    },
    {
      id: "studio.markers",
      title: "Show the markers",
      group: "Studio",
      run: (jali) => show(jali, markers({ session: session() })),
    },
    {
      id: "studio.credits",
      title: "Credits and licences",
      group: "Studio",
      run: (jali) => show(jali, credits()),
    },
    {
      id: "studio.reset",
      title: "Reset this layout to its design",
      group: "Studio",
      run: (jali) => layouts.reset(jali),
    },
    {
      id: "studio.copy-link",
      title: "Copy a link to this layout",
      group: "Studio",
      run: (jali) => copyLink(jali),
    },
    {
      id: "studio.controls-place",
      title: "Controls: move to the bottom / top",
      group: "Settings",
      run: () => settings.setControls(settings.get().controls === "top" ? "bottom" : "top"),
    },
    {
      id: "studio.feel-sounds",
      title: "Key and dial sounds: turn on or off",
      group: "Settings",
      run: () => {
        const on = !settings.get().sounds;
        settings.setSounds(on);
        notify(on ? "Key and dial sounds are on" : "Key and dial sounds are off");
      },
    },
    themeCommand("studio.theme"),
    makerCommand,
  ];
}
