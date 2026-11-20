/**
 * An island: a component the browser hydrates on its own, inside a page that is otherwise static HTML. Pages use the
 * wrapped component exactly like the plain one (`<TreeView layout="two" />`).
 *
 * While prerendering (inside src/shell/render.tsx), the wrapper writes a placeholder carrying the island's name and
 * props, and records the island; the renderer then renders the island on its own and puts its HTML in the
 * placeholder, so the browser can hydrate that HTML with the same tree and the same ids (src/client/islands.ts).
 * Outside the prerender it renders the component itself. Props must be JSON: strings, numbers, booleans.
 */
import { useContext, type ComponentType } from "react";
import { Collect } from "./collect";
import type { IslandName, IslandWhen } from "../client/island-id";

export const islandMarker = (n: number) => `<!--jali-island-${n}-->`;

export function island<P extends object>(
  name: IslandName,
  Component: ComponentType<P>,
  when: IslandWhen = "visible",
): ComponentType<P> {
  function Island(props: P) {
    const collect = useContext(Collect);
    if (!collect) return <Component {...props} />;
    const n = collect.islands.length;
    collect.islands.push({ name, props, Component: Component as ComponentType<object> });
    return (
      <div
        data-island={name}
        data-island-id={n}
        data-when={when}
        data-props={JSON.stringify(props)}
        dangerouslySetInnerHTML={{ __html: islandMarker(n) }}
      />
    );
  }
  Island.displayName = `Island(${name})`;
  return Island;
}
