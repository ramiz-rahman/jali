/** The 404 file hosts serve for an unknown address: the shell around Not found, for the address actually asked for. */
import Site from "./Site";
import { currentPath } from "../site/router";

export default function NotFoundSite() {
  return <Site path={typeof window === "undefined" ? "/404" : currentPath()} />;
}
