/**
 * Loan review's two personas, a demo switch of the app's own: a credit reviewer investigates (links open beside, in
 * Split view), a loan officer looks without opening panes (`allow: { open: false }`: links open as a peek). The
 * persona comes from the address (`?role=officer`, `?role=reviewer`, default reviewer), read once when the app makes
 * its instance; the switch in the header goes to the other persona's address, which makes the instance again.
 */
import type { Allow } from "jali";

export type Role = "reviewer" | "officer";

const LABEL: Record<Role, string> = { reviewer: "Credit reviewer", officer: "Loan officer" };

const roleIn = (search: string): Role =>
  new URLSearchParams(search).get("role") === "officer" ? "officer" : "reviewer";

let current: Role = "reviewer";

/** Reads the persona from the address, once, as the app makes its instance: what the instance may do as it. */
export function startRole(search = typeof location === "undefined" ? "" : location.search): Allow {
  current = roleIn(search);
  return current === "officer" ? { open: false } : {};
}

/** The persona the instance was made for. */
export const role = (): Role => current;

/** The current address as the other persona's. */
function otherHref(): string {
  const url = new URL(location.href);
  url.searchParams.set("role", current === "officer" ? "reviewer" : "officer");
  return url.href;
}

/** "Loan officer · View as credit reviewer": the persona, and a link to the other's address. */
export function RoleSwitch() {
  const other: Role = current === "officer" ? "reviewer" : "officer";
  return (
    <span className="item-role">
      {LABEL[current]}
      <a
        href={otherHref()}
        // Read at the click: the address has moved on since this rendered (the item, the view, opened panes).
        onClick={(e) => {
          e.preventDefault();
          location.assign(otherHref());
        }}
      >
        View as {LABEL[other].toLowerCase()}
      </a>
    </span>
  );
}
