/**
 * The 404 file hosts serve for an unknown address: the shell around Not found. It is prerendered for "/404" and
 * hydrates for "/404" too, so the two match; right after, the shell follows the address actually asked for (Not
 * found with that address, or the page, if a public page lives there).
 */
import Site from "./Site";

export default function NotFoundSite() {
  return <Site path="/404" />;
}
