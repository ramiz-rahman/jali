/**
 * Development or production, as React tells it: `process.env.NODE_ENV`, which every bundler writes into what it
 * builds (and Vite's dev client defines), and Node and the test runners have. Where nothing defines `process` this is
 * production. Written so a production build folds it to `false` and drops what it guards, the messages included.
 */
declare const process: { env: { NODE_ENV?: string } };

export const DEV = typeof process === "object" && process.env.NODE_ENV !== "production";
