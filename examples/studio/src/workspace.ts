/**
 * The workspace: the pane kinds, the layouts (presets), the launcher, and the app's own commands in ⌘K.
 * `createStudioJali` takes the app's services and Jali's usual options, so a test can give it a memory address,
 * memory storage and a fixed size (workspace.test.ts).
 *
 * Space: every audio tool plays and pauses with it. Jali binds no single keys (they belong to the focused content),
 * so nothing of Jali's needs moving; the app takes Space itself (shell/keys.ts) and names it in `keyboard.reserved`, so a
 * later Jali binding on Space would be refused at start-up rather than fight the transport.
 */
import { credits } from "./panes/credits";
import { catalogueOf } from "./sessions/catalog";
import { copyLink, createJali, type Command, type Jali, type JaliOptions } from "jali";
import { makerCommand } from "@jali-examples/shared/maker/maker";
import { themeCommand } from "@jali-examples/shared/theme";
import { cue, show } from "./actions";
import { SPEEDS } from "./audio/engine";
import { viewOf } from "./edits";
import { clip } from "./panes/clip";
import { launcher } from "./panes/launcher";
import { library } from "./panes/library";
import { markers } from "./panes/markers";
import { mixer } from "./panes/mixer";
import { timeline } from "./panes/timeline";
import { transcript } from "./panes/transcript";
import { presets } from "./presets";
import type { Services } from "./services";
import { clock, opening, SESSION_IDS } from "./sessions/sessions";
import { controlsPlace, setControlsPlace } from "./ui/controlsPlace";
import { feelSounds, setFeelSounds } from "./ui/feel";
import { defaultFeatures } from "jali/features";

export const kinds = [library, transcript, timeline, mixer, markers, clip, credits];

type Options = Pick<
  JaliOptions,
  "features" | "storage" | "size" | "moveFocus" | "preset" | "keyboard"
> & {
  /** A short message for the person ("Marker added at 00:42"). */
  notify?: (text: string) => void;
};

/** The layout in use back to its design: forget how it was left, then let Jali rebuild it (it asks about unsaved
 *  work first). */
export function resetLayout(jali: Jali, services: Services) {
  const id = jali.get().presetId;
  if (id) services.layouts.forget(id);
  return jali.actions.resetLayout();
}

export function createStudioJali(services: Services, options: Options = {}): Jali {
  const { notify = () => {}, ...jaliOptions } = options;
  const { engine, edits } = services;
  const now = () => {
    const s = engine.session();
    return viewOf(s, edits.of(s.id));
  };

  /** Show the segment in the transcript that shows its session, if there is one: its detail follows. */
  const selectSegment = (jali: Jali, session: string, segment: string) => {
    const pane = jali
      .model()
      .panes.find((p) => p.ref.kind === "transcript" && p.ref.params.session === session);
    if (pane) jali.actions.select(pane.id, clip({ session, segment }));
  };

  // ⌘K lists these after Jali's own, under the app's groups. "…" ones ask first, in Jali's chooser.
  const commands: Command[] = [
    {
      id: "studio.play",
      title: "Play or pause",
      group: "Transport",
      run: () => engine.toggle(),
    },
    {
      id: "studio.back",
      title: "Back 5 seconds",
      group: "Transport",
      run: () => engine.skip(-5),
    },
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
        const v = now();
        jali.dialogs.choose({
          title: "Go to segment…",
          items: v.session.segments,
          label: (seg) => opening(v.textOf(seg), 9),
          // Who, then when: the list sets hints flush right, so the times line up down its edge.
          hint: (seg) => `${v.speakerName(v.speakerOf(seg))}  ${clock(seg.start)}`,
          placeholder: "A word, a name or a time",
          onChoose: (seg) => {
            cue(engine, v.session.id, seg.start, engine.get().playing);
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
        const v = now();
        jali.dialogs.choose({
          title: "Jump to marker…",
          items: v.markers,
          label: (m) => m.label,
          hint: (m) => clock(m.time),
          placeholder: "A marker's name",
          onChoose: (m) => cue(engine, v.session.id, m.time, engine.get().playing),
        });
      },
    },
    {
      id: "studio.add-marker",
      title: "Add a marker at the playhead",
      group: "Transport",
      run: () => {
        const t = engine.position();
        edits.addMarker(engine.get().session, t, `Marker at ${clock(t)}`);
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
        const v = now();
        const t = engine.position();
        const seg = v.session.segments.find((s) => t < s.end) ?? v.session.segments.at(-1)!;
        engine.setLoop({ start: seg.start, end: seg.end, segment: seg.id });
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
          onChoose: (s) => {
            const lib = jali.model().panes.find((p) => p.ref.kind === "library");
            if (lib) jali.actions.select(lib.id, transcript({ session: s }));
            engine.load(s);
          },
        }),
    },
    {
      id: "studio.mixer",
      title: "Show the mixer",
      group: "Studio",
      run: (jali) => show(jali, mixer({ session: engine.get().session })),
    },
    {
      id: "studio.markers",
      title: "Show the markers",
      group: "Studio",
      run: (jali) => show(jali, markers({ session: engine.get().session })),
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
      run: (jali) => resetLayout(jali, services),
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
      run: () => setControlsPlace(controlsPlace() === "top" ? "bottom" : "top"),
    },
    {
      id: "studio.feel-sounds",
      title: "Key and dial sounds: turn on or off",
      group: "Settings",
      run: () => {
        setFeelSounds(!feelSounds());
        notify(feelSounds() ? "Key and dial sounds are on" : "Key and dial sounds are off");
      },
    },
    themeCommand("studio.theme"),
  ];

  const jali = createJali({
    panes: kinds,
    launcher,
    // Each layout comes back as the person left it; Reset builds its design again.
    presets: presets.map((p) => ({ ...p, saved: () => services.layouts.get(p.id) })),
    commands: [...commands, makerCommand],
    name: "Studio",
    // Header shortcuts: Maximise and Close. Tuck, Full screen and Pop out are in the pane's ⋯ menu (and ⌘K), so a
    // header carries two keys and the pane's name stays its strongest mark.
    buttons: (defaults) => defaults.filter((b) => b !== "tuck"),
    storage: "studio",
    phone: { stack: true },
    ...jaliOptions,
    // Jali's usual features; a test's own (its address in memory) take their places.
    features: [...defaultFeatures(), ...(jaliOptions.features ?? [])],
    keyboard: {
      ...jaliOptions.keyboard,
      // Bound like Jali's own commands: ⌘K then ⌘P plays, ⌘K then ⌘J goes to a segment.
      keymap: { "studio.play": "Mod+K Mod+P", "studio.segment": "Mod+K Mod+J" },
      // Space is the transport's (shell/keys.ts). Jali binds nothing to it; this keeps it that way.
      reserved: ["Space"],
    },
  });
  services.layouts.track(jali);
  return jali;
}
