/**
 * The styling contract, from @jali/react itself (packages/react/src/parts.ts): every public part, its selector, what
 * it is, and the state attributes it carries.
 */
import type { ReactNode } from "react";
import { parts, type PartArea } from "../../../../packages/react/src/parts";
import "./reference.css";

/** Backticks in the contract's sentences as code. */
function prose(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`)/)
    .map((s, i) => (s.startsWith("`") ? <code key={i}>{s.slice(1, -1)}</code> : s));
}

/** An element name as code, keeping any note after it: `button`, or `div` (`role="menu"`). */
const element = (e: string) => (e.startsWith("`") ? e : e.replace(/^(\w+)/, "`$1`"));

/** The parts, all of them or one area's (`<PartsTable area="Tabs" />`). */
export function PartsTable({ area }: { area?: PartArea }) {
  return (
    <div className="ref-table-wrap">
      <table className="ref-table">
        <thead>
          <tr>
            <th scope="col">Part</th>
            <th scope="col">Element</th>
            <th scope="col">State attributes</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(parts)
            .filter(([, part]) => !area || part.area === area)
            .map(([name, part]) => (
              <tr key={name} id={`part-${name}`}>
                <td>
                  <code>{part.selector}</code>
                  <div className="ref-cmd-title">{prose(part.what)}</div>
                </td>
                <td data-label="Element">{prose(element(part.element))}</td>
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
