/**
 * The install command on one line: the package manager (its mark and name, a button that opens a menu of all five),
 * the command for it, and Copy. Every command is in the HTML and one shows. The line is a choice group of its own,
 * "pm" (./choice.client.ts), so every install line and every package-manager <Tabs> follows the reader's choice;
 * ./install.client.ts makes the menu work.
 */
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { CodeBody, CopyButton } from "./Code";
import { PackageManagerMark } from "./pm-marks";
import { usePlainId } from "./text";

/** The package managers, and the command each adds a package with. The first is the default. */
export const MANAGERS = [
  { label: "npm", cmd: "npm install" },
  { label: "pnpm", cmd: "pnpm add" },
  { label: "yarn", cmd: "yarn add" },
  { label: "bun", cmd: "bun add" },
  { label: "vp", cmd: "vp add" },
] as const;

export function Install({ packages }: { packages: string }) {
  const id = usePlainId();
  const first = MANAGERS[0].label;
  return (
    <figure className="code install" data-choice-group="pm">
      <div className="install-pm">
        <button
          type="button"
          className="install-trigger"
          id={`${id}-pm`}
          aria-haspopup="listbox"
          aria-expanded="false"
          aria-controls={`${id}-pm-list`}
          data-pm-trigger=""
        >
          {/* The button's name is this and the manager showing: "Package manager: npm". */}
          <span className="visually-hidden">Package manager: </span>
          {MANAGERS.map((m) => (
            <span
              key={m.label}
              className="install-current"
              data-choice-panel={m.label}
              hidden={m.label !== first}
            >
              <PackageManagerMark name={m.label} />
              {m.label}
            </span>
          ))}
          <CaretDownIcon aria-hidden size={11} weight="bold" className="install-caret" />
        </button>
        <ul
          className="install-menu"
          id={`${id}-pm-list`}
          role="listbox"
          aria-label="Package manager"
          tabIndex={-1}
          hidden
          data-pm-menu=""
        >
          {MANAGERS.map((m) => (
            <li
              key={m.label}
              id={`${id}-pm-${m.label}`}
              className="install-option"
              role="option"
              aria-selected={m.label === first}
              data-choice-option={m.label}
            >
              <PackageManagerMark name={m.label} />
              <span className="install-option-name">{m.label}</span>
              <CheckIcon aria-hidden size={13} weight="bold" className="install-check" />
            </li>
          ))}
        </ul>
      </div>
      {MANAGERS.map((m) => (
        <div
          key={m.label}
          className="install-command"
          data-choice-panel={m.label}
          hidden={m.label !== first}
        >
          <CodeBody code={`${m.cmd} ${packages}`} lang="sh" numbers={false} />
        </div>
      ))}
      <CopyButton label="Copy command" />
    </figure>
  );
}
