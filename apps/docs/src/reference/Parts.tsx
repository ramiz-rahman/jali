/**
 * The styling contract, from @jali/react itself (packages/react/src/parts.ts): every public part, its selector, what
 * it is, and the state attributes it carries.
 */
import type { ReactNode } from "react";
import { parts } from "../../../../packages/react/src/parts";
import "./reference.css";

/** Backticks in the contract's sentences as code. */
function prose(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`)/)
    .map((s, i) => (s.startsWith("`") ? <code key={i}>{s.slice(1, -1)}</code> : s));
}

export function PartsTable() {
  return (
    <div className="ref-table-wrap">
      <table className="ref-table">
        <thead>
          <tr>
            <th scope="col">Part</th>
            <th scope="col">State attributes</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(parts).map(([name, part]) => (
            <tr key={name} id={`part-${name}`}>
              <td>
                <code>{part.selector}</code>
                <div className="ref-cmd-title">{prose(part.what)}</div>
              </td>
              <td data-label="State attributes">
                {part.attributes.length ? (
                  <dl className="ref-part-attrs">
                    {part.attributes.map((a) => (
                      <div key={a.name}>
                        <dt>
                          <code>{a.name}</code>
                        </dt>
                        <dd>{prose(a.means)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <span className="ref-dash">none</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
