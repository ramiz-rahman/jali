/**
 * Every workspace command with its default keys, from jali itself (./command-data.ts): one table, grouped as the
 * palette groups them, with a column of keys for a Mac and one for Windows and Linux. A chord's steps are keycaps of
 * their own (⌘K, then ⌘←), as the landing draws them.
 */
import { commandGroups, keysOf, type CommandRow, type Platform } from "./command-data";

function Keys({ id, platform }: { id: string; platform: Platform }) {
  const keys = keysOf(id, platform);
  if (!keys.length) return <span className="ref-dash">none</span>;
  return (
    <span className="ref-keys">
      {keys.map((k, i) => (
        <span key={i} className="ref-chord">
          {i ? <span className="ref-or">or </span> : null}
          {k.split(" ").map((step, j) => (
            <kbd key={j}>{step}</kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

function Row({ row }: { row: CommandRow }) {
  return (
    <tr id={`cmd-${row.shown.replace(/[<>]/g, "")}`}>
      <td>
        <code>{row.shown}</code>
        <div className="ref-cmd-title">{row.title}</div>
      </td>
      <td className="ref-keycell" data-label="Mac">
        <Keys id={row.id} platform="mac" />
      </td>
      <td className="ref-keycell" data-label="Windows, Linux">
        <Keys id={row.id} platform="other" />
      </td>
      <td data-label="Refused">{row.refused}</td>
    </tr>
  );
}

export function CommandTable() {
  return (
    <div className="ref-cmds">
      <div className="ref-table-wrap">
        <table className="ref-table">
          <thead>
            <tr>
              <th scope="col">Command</th>
              <th scope="col">Mac</th>
              <th scope="col">Windows, Linux</th>
              <th scope="col">Refused when</th>
            </tr>
          </thead>
          <tbody>
            {commandGroups().map(([group, rows]) => [
              <tr className="ref-group-row" key={group}>
                <td colSpan={4}>{group}</td>
              </tr>,
              ...rows.map((r) => <Row key={r.id} row={r} />),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
