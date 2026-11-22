/**
 * Development or production, as React tells it: `process.env.NODE_ENV`, which every bundler writes into what it
 * builds (Vite in development too), and Node and the test runners have. Where nothing defines it, reading `process`
 * throws and this is production. The same check as @jali/core's.
 */
declare const process: { env: { NODE_ENV?: string } };

export const DEV = (() => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
})();
