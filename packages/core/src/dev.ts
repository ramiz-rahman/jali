/**
 * Development or production, as React and most libraries tell: `process.env.NODE_ENV`, which every bundler (Vite,
 * webpack, Next.js, esbuild, Rollup with its replace plugin) writes into the code it builds, and which Node and the
 * test runners have. Not `import.meta.env.DEV`, which only Vite defines: under any other bundler the development
 * checks were silently off. Where nothing defines it (a page that loads the package unbundled), reading `process`
 * throws and Jali is in production. Read when a workspace is made, so a test can switch it.
 */
declare const process: { env: { NODE_ENV?: string } };

export function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}
