/**
 * Every workspace command with its default keys, from jali itself (./command-data.ts): one table, grouped as the
 * palette groups them, the keys printed for a Mac and for Windows and Linux.
 */
import { commandGroups, keysOf, type CommandRow, type Platform } from "./command-data";

function Keys({ id, platform }: { id: string; platform: Platform }) {
  const keys = keysOf(id, platform);
  if (!keys.length) return <span className="ref-dash">none</span>;
  return (
    <span className="ref-keys">
      {keys.map((k, i) => (
        <span key={i}>
          {i ? <span>or </span> : null}
          <kbd>{k}</kbd>
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
      <td className="ref-keycell">
        <div>
          <span className="ref-keys-os">Mac</span>
          <Keys id={row.id} platform="mac" />
        </div>
        <div>
          <span className="ref-keys-os">Windows, Linux</span>
          <Keys id={row.id} platform="other" />
        </div>
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
              <th scope="col">Default keys</th>
              <th scope="col">Refused when</th>
            </tr>
          </thead>
          <tbody>
            {commandGroups().map(([group, rows]) => [
              <tr className="ref-group-row" key={group}>
                <td colSpan={3}>{group}</td>
              </tr>,
              ...rows.map((r) => <Row key={r.id} row={r} />),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
