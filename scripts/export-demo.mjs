import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Inline the existing production bundle: the exported demo needs no web server.
const root = fileURLToPath(new URL("../", import.meta.url));
const dist = path.join(root, "dist");
const output = path.join(root, "exports", "NANO-demo.html");
const mimeTypes = { ".svg": "image/svg+xml", ".woff2": "font/woff2" };

async function inlineAsset(assetPath) {
  const file = path.resolve(dist, assetPath.replace(/^\/+/, ""));
  if (!file.startsWith(dist + path.sep))
    throw new Error("Unexpected asset path");
  const content = await readFile(file);
  const type = mimeTypes[path.extname(file)];
  if (!type) throw new Error(`Unsupported asset: ${assetPath}`);
  return `data:${type};base64,${content.toString("base64")}`;
}

let html = await readFile(path.join(dist, "index.html"), "utf8");
const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(/<link\b[^>]*\brel="stylesheet"[^>]*>/);
if (!script || !stylesheet)
  throw new Error("Run npm run build before exporting");
const stylesheetPath = stylesheet[0].match(/\bhref="([^"]+)"/)[1];
let css = await readFile(
  path.join(dist, stylesheetPath.replace(/^\/+/, "")),
  "utf8",
);
const fontPaths = [...css.matchAll(/url\(["']?(\/assets\/[^"')]+)["']?\)/g)];
for (const match of fontPaths) {
  css = css.replace(match[0], `url("${await inlineAsset(match[1])}")`);
}
let js = await readFile(path.join(dist, script[1].replace(/^\/+/, "")), "utf8");
js = js.replaceAll(
  '"/cabin.svg"',
  JSON.stringify(await inlineAsset("/cabin.svg")),
);
const favicon = await inlineAsset("/favicon.svg");
html = html.replace('href="/favicon.svg"', `href="${favicon}"`);
html = html.replace(stylesheet[0], () => `<style>${css}</style>`);
// The bundle is self-contained; a classic script also works in opaque-origin frames.
html = html.replace(script[0], "");
html = html.replace(
  "</body>",
  () => `<script>${js.replace(/<\/script/gi, "<\\/script")}</script></body>`,
);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(
  `Standalone demo: ${output} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB)`,
);
