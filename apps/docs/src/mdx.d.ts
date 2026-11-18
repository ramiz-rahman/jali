declare module "*.mdx" {
  import type { ComponentType } from "react";
  export const frontmatter: { title: string; summary: string };
  const Component: ComponentType;
  export default Component;
}

declare module "*?raw" {
  const text: string;
  export default text;
}
