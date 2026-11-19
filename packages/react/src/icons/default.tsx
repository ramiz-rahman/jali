/**
 * Jali's default icons: Phosphor's, in the regular weight, copied into the package (default-paths.ts), so an app
 * never installs an icon library for them. A host's `<JaliRoot icons>` replaces any of them by name.
 */
import type { JaliIcon, JaliIconName, JaliIcons } from "./types";
import { defaultIconPaths } from "./default-paths";

function svgIcon(name: JaliIconName, d: string, mirrored: boolean): JaliIcon {
  const Icon: JaliIcon = ({ size = 16, className, "aria-hidden": hidden }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      transform={mirrored ? "scale(-1, 1)" : undefined}
      className={className}
      aria-hidden={hidden}
      data-jali-icon={name}
    >
      <path d={d} />
    </svg>
  );
  Icon.displayName = `JaliIcon(${name})`;
  return Icon;
}

/** Jali's icon for every name it draws. Spread it under your own: `{ ...defaultIcons, close: MyClose }`. */
export const defaultIcons = Object.fromEntries(
  Object.entries(defaultIconPaths).map(([name, path]) => {
    const [d, mirrored] = typeof path === "string" ? [path, false] : [path[0], true];
    return [name, svgIcon(name as JaliIconName, d, mirrored)];
  }),
) as JaliIcons;
