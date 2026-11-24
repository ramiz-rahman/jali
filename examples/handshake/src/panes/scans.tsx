/**
 * Bring your own scan. A browser cannot see your network, so you run one command on your machine and paste (or
 * drop) its output here: it is read in this tab, kept in this browser's storage, and never sent anywhere. The pane
 * walks through it in order: pick your OS, copy a command, paste the output, then open what you loaded in the
 * Wi-Fi, Devices or Path pane. Moving through the list of loaded scans selects them, so panes linked to this one
 * follow.
 */
import { useMemo, useState, type KeyboardEvent } from "react";
import {
  definePane,
  useCommands,
  useJaliState,
  usePaneState,
  useUnsaved,
  type PaneProps,
} from "jali-layout/react";
import { ScanSearch } from "lucide-react";
import { Alert } from "#src/vendor/cyberspec/components/ui/alert.tsx";
import { Badge } from "#src/vendor/cyberspec/components/ui/badge.tsx";
import { Button } from "#src/vendor/cyberspec/components/ui/button.tsx";
import { CodeBlock } from "#src/vendor/cyberspec/components/ui/code-block.tsx";
import { Collapsible } from "#src/vendor/cyberspec/components/ui/collapsible.tsx";
import { ItemList } from "#src/vendor/cyberspec/components/ui/item-list.tsx";
import { Panel } from "#src/vendor/cyberspec/components/ui/panel.tsx";
import { Tabs } from "#src/vendor/cyberspec/components/ui/tabs.tsx";
import { Textarea } from "#src/vendor/cyberspec/components/ui/textarea.tsx";
import { COMMANDS, guessOs, OS_LABEL, type Os, type ScanCommand } from "#src/scans/commands.ts";
import { formatInfo, parseScan, type Detected } from "#src/scans/detect.ts";
import { describeScan, kindName } from "#src/scans/kinds.ts";
import { scanRef } from "#src/scans/refs.ts";
import { scanStore, type LoadedScan } from "#src/scans/store.ts";
import { useFileDrop } from "./parts/file-drop";
import { bare } from "./parts/list-keys";
import { ScanOwner, useScans } from "./parts/scan";
import { PaneBody } from "./parts/states";
import { useStore } from "./parts/use-store";

const OSES: Os[] = ["macos", "windows", "linux"];
const isOs = (v: unknown): Os | undefined => OSES.find((o) => o === v);
/** A scan file is text of a few KB to a few hundred; anything this big is not one. */
const MAX_FILE = 2_000_000;

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** What the paste box says about text that did not parse. */
const unreadable = (r: Extract<Detected, { ok: false }>) =>
  r.format ? `Could not read it as ${formatInfo(r.format).label}` : "Not a format I know";

function Command({ c }: { c: ScanCommand }) {
  return (
    <section className="scan-command" aria-label={c.title}>
      <h4 className="scan-command-title">{c.title}</h4>
      <p className="scan-command-what">{c.what}</p>
      <CodeBlock code={c.command} language="bash" numbers={false} label={`${c.title} command`} />
      {c.alternative ? (
        <>
          <p className="scan-command-what">{c.alternative.label}</p>
          <CodeBlock
            code={c.alternative.command}
            language="bash"
            numbers={false}
            label={`${c.title}, alternative`}
          />
        </>
      ) : null}
      {c.caveat ? <p className="scan-note">{c.caveat}</p> : null}
    </section>
  );
}

type Feedback = {
  tone: "success" | "warning" | "danger";
  title: string;
  text: string;
  open?: LoadedScan;
};

function ScansPane({ node, openBeside, select }: PaneProps) {
  const [os, setOs] = usePaneState<Os>("os", guessOs(navigator.userAgent), { parse: isOs });
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const all = useScans();
  const persisted = useStore(scanStore.state, (s) => s.persisted);
  const own = all.filter((s) => !s.sample);
  // The cursor is the pane's selection in Jali, so panes linked to this one follow it.
  const selectedId = useJaliState((s) => s.selection[node.id]?.ref.params.scan);
  const picked = all.find((s) => s.id === selectedId);
  const detected = useMemo(() => parseScan(text), [text]);

  // Pasted text that has not been loaded yet is work that a close would lose.
  useUnsaved(text.trim() !== "" && "pasted output that is not loaded yet");

  const open = (s: LoadedScan) => openBeside(scanRef(s.kind, s.id));
  const pick = (s: LoadedScan) => select(scanRef(s.kind, s.id));

  const load = (raw: string, name?: string) => {
    const r = scanStore.add(raw);
    if (!r.ok) {
      setFeedback({
        tone: r.format ? "danger" : "warning",
        title: unreadable(r),
        text: `${name ? `${name}: ` : ""}${r.error}`,
      });
      return false;
    }
    const loaded = r.id ? scanStore.get(r.id) : undefined;
    setFeedback({
      tone: "success",
      title: `Loaded ${formatInfo(r.format).label}`,
      text: `${loaded?.title ?? "Scan"}${name ? ` from ${name}` : ""}. It is kept in this browser only.`,
      open: loaded,
    });
    if (loaded) pick(loaded);
    return true;
  };

  const submit = () => {
    if (load(text)) setText("");
  };

  const file = useFileDrop({
    accept: ".txt,.json,.xml,.log,text/*,application/json,application/xml",
    multiple: true,
    label: "Choose scan files",
    onFiles: async (files) => {
      for (const f of files) {
        if (f.size > MAX_FILE) {
          setFeedback({
            tone: "danger",
            title: "That file is too big",
            text: `${f.name} is over 2 MB: a scan is text of a few KB.`,
          });
          continue;
        }
        load(await f.text(), f.name);
      }
    },
  });

  const fromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.trim() === "") {
        setFeedback({
          tone: "warning",
          title: "The clipboard is empty",
          text: "Copy a command's output first.",
        });
        return;
      }
      load(clip);
    } catch {
      setFeedback({
        tone: "warning",
        title: "The browser did not give access to the clipboard",
        text: "Paste into the box instead (⌘V or Ctrl+V).",
      });
    }
  };

  useCommands([
    { id: "paste", title: "Load scan from clipboard", run: () => void fromClipboard() },
    { id: "choose-file", title: "Load scan from a file…", run: file.pick },
    ...OSES.map((o) => ({
      id: `os-${o}`,
      title: `Show ${OS_LABEL[o]} commands`,
      run: () => setOs(o),
    })),
    {
      id: "forget-all",
      title: "Forget all my scans",
      disabled: own.length ? false : "No scans of yours are loaded",
      run: () => scanStore.forgetAll(),
    },
  ]);

  const onListKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && picked && bare(e, { shift: true })) {
      e.preventDefault();
      open(picked);
    }
  };

  return (
    <PaneBody className="scans">
      <div className="scans-grid">
        <div className="scans-col">
          <Panel
            title="Your scans"
            actions={<Badge count={all.length} label="scans" tone="mute" />}
          >
            <p className="scan-note">
              Kept in this browser only. Nothing is uploaded, and a link you send will not carry
              them.
            </p>
            {!persisted ? (
              <Alert tone="warning" title="Scans are not being kept">
                This browser is blocking storage (or it is full), so your scans last until you close
                this tab.
              </Alert>
            ) : null}
            <div onKeyDown={onListKey}>
              <ItemList
                label="Scans"
                value={picked?.id}
                onValueChange={(v) => {
                  const s = all.find((x) => x.id === v);
                  if (s) pick(s);
                }}
                items={all.map((s) => ({
                  value: s.id,
                  label: s.title,
                  meta: s.sample
                    ? "Sample · made up"
                    : `${describeScan(s.scan).summary(s.scan)} · ${s.addedAt ? time(s.addedAt) : ""}`,
                }))}
              />
            </div>
            {picked ? (
              <div className="scan-picked">
                <div className="scan-head-line">
                  <b>{picked.title}</b>
                  <ScanOwner loaded={picked} />
                </div>
                <p className="scan-note">{formatInfo(picked.format).label}</p>
                <div className="scan-actions">
                  <Button tone="primary" onClick={() => open(picked)}>
                    Open in {kindName(picked.kind)}
                  </Button>
                  {picked.sample ? null : (
                    <Button onClick={() => scanStore.forget(picked.id)}>Forget this scan</Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="scan-note">
                Pick a scan to open it beside this pane. Panes linked to this one follow your
                choice.
              </p>
            )}
            {own.length > 0 ? (
              <div className="scan-actions">
                <Button tone="ghost" onClick={() => scanStore.forgetAll()}>
                  Forget all my scans ({own.length})
                </Button>
              </div>
            ) : null}
          </Panel>
        </div>
        <div className="scans-col">
          {/* The samples are loaded from the start, so adding your own is one step away, not the whole pane. */}
          <Collapsible label="Scan your own network" summary="2 steps" defaultOpen={own.length > 0}>
            <div className="scans-col">
              <Panel title="1 · Run a command">
                <p className="scan-note">
                  A web page cannot see your local network, so you run one line on your own machine
                  and bring the output here.
                </p>
                <Tabs
                  label="Your operating system"
                  variant="key"
                  value={os}
                  onValueChange={(v) => v && setOs(isOs(v) ?? "macos")}
                  tabs={OSES.map((o) => ({
                    value: o,
                    label: OS_LABEL[o],
                    content: (
                      <div className="scan-commands">
                        {COMMANDS[o].map((c) => (
                          <Command key={c.kind + c.command} c={c} />
                        ))}
                      </div>
                    ),
                  }))}
                />
              </Panel>

              <Panel title="2 · Paste the output">
                <div className="scan-drop" {...file.dropProps}>
                  <Textarea
                    label="Output"
                    hint="Paste here, or drop a text file anywhere in this box. Which tool printed it is detected."
                    rows={6}
                    value={text}
                    onValueChange={(v) => {
                      setText(v);
                      setFeedback(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && detected.ok) {
                        e.preventDefault();
                        submit();
                      }
                    }}
                    spellCheck={false}
                    className="scan-textarea"
                  />
                  {text.trim() === "" ? null : detected.ok ? (
                    <Alert tone="info" title={`Looks like ${formatInfo(detected.format).label}`}>
                      {describeScan(detected.scan).count(detected.scan)}, ready to load.
                    </Alert>
                  ) : (
                    <Alert tone="warning" title={unreadable(detected)}>
                      {detected.error}
                    </Alert>
                  )}
                  <div className="scan-actions">
                    <Button tone="primary" disabled={!detected.ok} onClick={submit}>
                      Load scan
                    </Button>
                    <Button onClick={file.pick}>Choose a file…</Button>
                    <Button tone="ghost" onClick={() => void fromClipboard()}>
                      Paste from clipboard
                    </Button>
                    {text ? (
                      <Button
                        tone="ghost"
                        onClick={() => {
                          setText("");
                          setFeedback(null);
                        }}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                  {file.input}
                </div>
                {feedback ? (
                  <Alert
                    tone={feedback.tone}
                    title={feedback.title}
                    action={
                      feedback.open ? (
                        <Button
                          size="sm"
                          tone="primary"
                          onClick={() => feedback.open && open(feedback.open)}
                        >
                          Open in {kindName(feedback.open.kind)}
                        </Button>
                      ) : undefined
                    }
                  >
                    {feedback.text}
                  </Alert>
                ) : null}
              </Panel>
            </div>
          </Collapsible>
        </div>
      </div>
    </PaneBody>
  );
}

export const scans = definePane("scans", {
  title: "Scans",
  icon: ScanSearch,
  width: { min: 320, comfortable: 560 },
  Component: ScansPane,
});
