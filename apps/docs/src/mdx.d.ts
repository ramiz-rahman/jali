declare module "*.mdx" {
  import type { ComponentType } from "react";
  const Component: ComponentType;
  export default Component;
}

declare module "*?raw" {
  const text: string;
  export default text;
}
