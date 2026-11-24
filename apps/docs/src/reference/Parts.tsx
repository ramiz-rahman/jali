/** The styling contract as a table (./parts-data.ts): every public part, all of them or one area's. */
import { withCode } from "../ui/lib/with-code";
import { elementCode, partWhat, partsIn, type PartArea } from "./parts-data";

/** `<PartsTable area="Tabs" />`: one area's parts; without `area`, every part. */
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
          {partsIn(area).map(([name, part]) => (
            <tr key={name} id={`part-${name}`}>
              <td>
                <code>{part.selector}</code>
                <div className="ref-cmd-title">{withCode(partWhat(part))}</div>
              </td>
              <td data-label="Element">{withCode(elementCode(part.element))}</td>
              <td data-label="State attributes">
                {part.attributes.length ? (
                  <dl className="ref-part-attrs">
                    {part.attributes.map((a) => (
                      <div key={a.name}>
                        <dt>
                          <code>{a.name}</code>
                        </dt>
                        <dd>{withCode(a.means)}</dd>
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
