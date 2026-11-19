/**
 * @jali/react/bare: `@jali/react` without Phosphor. `<JaliRoot icons>` and `<JaliProvider icons>` take every icon Jali
 * draws (`JaliIcons`, enforced by the types), so a host with its own icon set never bundles Phosphor.
 */
export * from "./common";
export {
  BareJaliRoot as JaliRoot,
  BareJaliProvider as JaliProvider,
  type BareJaliRootProps as JaliRootProps,
} from "./JaliRoot";
