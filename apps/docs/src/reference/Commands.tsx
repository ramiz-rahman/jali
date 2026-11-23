/**
 * Every workspace command with its default keys, from jali itself: commandDefsOf for ids, titles and groups,
 * DEFAULT_KEYMAP through createKeymap for keys, printed for a Mac and for Windows and Linux.
 */
import {
  DEFAULT_KEYMAP,
  PALETTE_ID,
  createKeymap,
  formatKeys,
  type CommandDef,
} from "jali/adapter";
import { COMMANDS, REFUSED, displayId } from "./command-data";

const MAC = createKeymap({}, { platform: "mac" });
const OTHER = createKeymap({}, { platform: "other" });

function Keys({ id, platform }: { id: string; platform: "mac" | "other" }) {
  const km = platform === "mac" ? MAC : OTHER;
  const seqs = km.sequences(id);
  if (!seqs.length) return <span className="ref-dash">none</span>;
  return (
    <span className="ref-keys">
      {seqs.map((s, i) => (
        <span key={i}>
          {i ? <span>or </span> : null}
          <kbd>{formatKeys(s, platform)}</kbd>
        </span>
      ))}
    </span>
  );
}

function Row({ id, title, refused }: { id: string; title: string; refused: string }) {
  const shown = displayId(id);
  return (
    <tr id={`cmd-${shown.replace(/[<>]/g, "")}`}>
      <td>
        <code>{shown}</code>
        <div className="ref-cmd-title">{title}</div>
      </td>
      <td className="ref-keycell">
        <div>
          <span className="ref-keys-os">Mac</span>
          <Keys id={id} platform="mac" />
        </div>
        <div>
          <span className="ref-keys-os">Windows, Linux</span>
          <Keys id={id} platform="other" />
        </div>
      </td>
      <td data-label="Refused">{refused}</td>
    </tr>
  );
}

/** One table, grouped as the palette groups them; the palette chord first (it is a key, not a palette command). */
export function CommandTable() {
  const groups: [string, CommandDef[]][] = [];
  for (const c of COMMANDS) {
    const g = groups.find(([name]) => name === c.group);
    if (g) g[1].push(c);
    else groups.push([c.group, [c]]);
  }
  return (
    <div className="ref-cmds">
      <div className="ref-table-wrap">
        <table className="ref-table">
          <thead>
            <tr>
              <th scope="col">Command</th>
              <th scope="col">Default keys</th>
              <th scope="col">Refused when</th>
            </tr>
          </thead>
          <tbody>
            <tr className="ref-group-row">
              <td colSpan={3}>Palette</td>
            </tr>
            <Row
              id={PALETTE_ID}
              title="Open or close the command palette, and start a two-step chord"
              refused="Never. Works with a dialog open too."
            />
            {groups.map(([group, list]) => [
              <tr className="ref-group-row" key={group}>
                <td colSpan={3}>{group}</td>
              </tr>,
              ...list.map((c) => (
                <Row
                  key={c.id}
                  id={c.id}
                  title={c.title}
                  refused={REFUSED[displayId(c.id)] ?? "Not documented."}
                />
              )),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Ids bound by default, for prose that counts them. */
export const DEFAULT_IDS = Object.keys(DEFAULT_KEYMAP);
