/**
 * The token page's parts. Swatches are real: each sits in a `.light` or `.dark` scope, so the colour on screen is the
 * one Jali's theme gives that token there, read through the CSS variable itself.
 */
import type { CSSProperties } from "react";
import {
  BRIDGE,
  PUBLIC_TOKENS,
  TOKEN_PURPOSE,
  inPlaceDefault,
  partsReading,
  valuesOf,
  type SwatchKind,
  type TokenGroup,
} from "./token-data";

function Swatch({
  token,
  kind,
  theme,
  value,
}: {
  token: string;
  kind: SwatchKind;
  theme: "light" | "dark";
  value: string;
}) {
  // A token read in place isn't declared on the root, so the swatch gives it its default the same way.
  const fallback = inPlaceDefault(token);
  const v = fallback ? `var(${token}, ${fallback})` : `var(${token})`;
  const inner = (() => {
    switch (kind) {
      case "color":
        return <span className="ref-swatch-fill" style={{ background: v }} />;
      case "text":
        return (
          <span className="ref-swatch-text" style={{ color: v }}>
            Aa
          </span>
        );
      case "shadow":
        return <span className="ref-swatch-shadow" style={{ boxShadow: v }} />;
      case "scrim":
        return <span className="ref-swatch-scrim" style={{ background: v }} />;
      case "radius":
        return (
          <span className="ref-swatch-radius" style={{ borderTopLeftRadius: v } as CSSProperties} />
        );
      case "size":
        return <span className="ref-swatch-size" style={{ width: v, height: v }} />;
      case "type":
        return (
          <span className="ref-swatch-font" style={{ fontSize: v }}>
            Ag 12
          </span>
        );
      case "tracking":
        return (
          <span className="ref-swatch-font" style={{ letterSpacing: v, fontSize: "0.875rem" }}>
            Tracking
          </span>
        );
      case "font":
        return (
          <span className="ref-swatch-font" style={{ fontFamily: v }}>
            Ag 12
          </span>
        );
    }
  })();
  return (
    <div className="ref-swatch">
      <div className={`ref-swatch-scope ${theme}`} data-theme={theme} aria-hidden>
        {inner}
      </div>
      <div className="ref-swatch-label">
        <span>{theme === "light" ? "Light" : "Dark"}</span>
        <code>{short(value)}</code>
      </div>
    </div>
  );
}

/** Long values (font stacks, shadows) are cut for the label; the full value is in the title. */
const short = (value: string) => (value.length > 28 ? `${value.slice(0, 26)}…` : value);

/** Every public token of `group` (or all), each with what reads it and its light and dark values. */
export function TokenTable({ group }: { group?: TokenGroup }) {
  const tokens = PUBLIC_TOKENS.filter((t) => !group || TOKEN_PURPOSE[t]?.group === group).sort(
    (a, b) => Object.keys(TOKEN_PURPOSE).indexOf(a) - Object.keys(TOKEN_PURPOSE).indexOf(b),
  );
  return (
    <div className="ref-tokens-wrap">
      <div className="ref-tokens">
        {tokens.map((t) => {
          const info = TOKEN_PURPOSE[t];
          const parts = partsReading(t);
          const { light, dark } = valuesOf(t);
          const same = light === dark;
          return (
            <div className="ref-token" key={t} id={t.slice(2)}>
              <div>
                <h3 className="ref-token-name">
                  <a className="ref-anchor" href={`#${t.slice(2)}`}>
                    <code>{t}</code>
                  </a>
                </h3>
                <p className="ref-token-purpose">{info?.purpose ?? "Not documented."}</p>
                <p className="ref-token-parts" aria-label="Read by">
                  {parts.length ? (
                    parts.map((p) => <code key={p}>{p}</code>)
                  ) : (
                    <span className="ref-token-none">Not read by Jali's styles.</span>
                  )}
                </p>
              </div>
              <div className="ref-swatches" title={same ? light : `Light: ${light}\nDark: ${dark}`}>
                <Swatch token={t} kind={info?.swatch ?? "color"} theme="light" value={light} />
                <Swatch token={t} kind={info?.swatch ?? "color"} theme="dark" value={dark} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** jali-tailwind.css as a table: the Jali token, the host's variables it reads in order, and the fallback. */
export function BridgeTable() {
  return (
    <div className="ref-table-wrap">
      <table className="ref-table">
        <thead>
          <tr>
            <th scope="col">Jali token</th>
            <th scope="col">Reads from your theme, first found</th>
            <th scope="col">Else</th>
          </tr>
        </thead>
        <tbody>
          {BRIDGE.map((r) => (
            <tr key={r.token}>
              <td className="ref-nowrap">
                <a className="ref-link" href={`#${r.token.slice(2)}`}>
                  <code>{r.token}</code>
                </a>
              </td>
              <td>
                <span className="ref-chain">
                  {r.host.map((h, i) => (
                    <span key={h} className="ref-chain-item">
                      {i ? <span>then </span> : null}
                      <code>{h}</code>
                    </span>
                  ))}
                </span>
              </td>
              <td>
                <code>{r.fallback}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
