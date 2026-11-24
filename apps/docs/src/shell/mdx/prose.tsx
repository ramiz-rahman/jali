/** The plain Markdown elements the site draws its own way: tables (a named region that scrolls) and links. */
import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { textOf } from "./text";

/** The text of a table's header cells, "Token, Light, Dark": what tells one table's region from another's. */
function headerText(children: ReactNode): string {
  const cells: string[] = [];
  const walk = (node: ReactNode, inHead: boolean) =>
    Children.forEach(node, (c) => {
      if (!isValidElement<{ children?: ReactNode }>(c)) return;
      if (inHead && c.type === "th") cells.push(textOf(c.props.children).trim());
      else walk(c.props.children, inHead || c.type === "thead");
    });
  walk(children, false);
  return cells.filter(Boolean).join(", ");
}

/** A table that scrolls sideways when it is wide: a named region, reachable from the keyboard. */
export function Table(props: ComponentPropsWithoutRef<"table">) {
  const head = headerText(props.children);
  return (
    <div
      className="table-wrap"
      tabIndex={0}
      role="region"
      aria-label={head ? `Table: ${head}` : "Table"}
    >
      <table {...props} />
    </div>
  );
}

/** A link; one to another site opens in a new tab. */
export function Anchor({ href = "", ...rest }: ComponentPropsWithoutRef<"a">) {
  const external = /^https?:\/\//.test(href);
  return <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} {...rest} />;
}
