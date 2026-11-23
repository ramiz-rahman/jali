/**
 * Serves the built site (tooling/build-site.mjs) as Netlify does, for `pnpm preview:site` and the site's browser
 * check: netlify.toml's redirects first, then a file as it is, `/page` from page.html, `/folder/` from
 * folder/index.html, `/folder` redirected to `/folder/` when only the folder is there, and 404.html for anything else.
 *
 *   node tooling/serve-site.mjs [--port=5480] [--dir=site]
 */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const root = resolve(import.meta.dirname, "..", arg("dir", "site"));
const port = Number(process.env.PORT ?? arg("port", "5480"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".tar.gz": "application/gzip",
  ".gz": "application/gzip",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".pcap": "application/vnd.tcpdump.pcap",
  ".pcapng": "application/octet-stream",
  ".webmanifest": "application/manifest+json",
};

/** netlify.toml's redirects, from → [to, status]. */
const redirects = new Map(
  [
    ...readFileSync(resolve(import.meta.dirname, "../netlify.toml"), "utf8").matchAll(
      /\[\[redirects\]\][^[]*?from\s*=\s*"([^"]+)"[^[]*?to\s*=\s*"([^"]+)"(?:[^[]*?status\s*=\s*(\d+))?/g,
    ),
  ].map((m) => [m[1], [m[2], Number(m[3] ?? 301)]]),
);

const isFile = (p) => existsSync(p) && statSync(p).isFile();
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

const send = (res, status, file) => {
  res.writeHead(status, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://site");
  const redirect = redirects.get(url.pathname);
  if (redirect) {
    res.writeHead(redirect[1], { location: redirect[0] });
    return res.end();
  }
  const path = normalize(decodeURIComponent(url.pathname));
  const file = join(root, path);
  if (!file.startsWith(root)) return send(res, 404, join(root, "404.html"));
  if (path.endsWith("/") && isFile(join(file, "index.html")))
    return send(res, 200, join(file, "index.html"));
  if (!path.endsWith("/") && isFile(file)) return send(res, 200, file);
  if (!path.endsWith("/") && isFile(`${file}.html`)) return send(res, 200, `${file}.html`);
  if (!path.endsWith("/") && isDir(file) && isFile(join(file, "index.html"))) {
    res.writeHead(301, { location: `${url.pathname}/${url.search}` });
    return res.end();
  }
  return send(res, 404, join(root, "404.html"));
}).listen(port, () => console.log(`serve-site: ${root} on http://localhost:${port}`));
