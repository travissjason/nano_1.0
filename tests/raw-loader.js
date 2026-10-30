import { readFile } from "node:fs/promises";
// Vite's ?raw import, for dependency-free Node engine tests.
export async function load(url, context, nextLoad) {
  if (url.endsWith("?raw")) return {
    format: "module", shortCircuit: true,
    source: `export default ${JSON.stringify(await readFile(new URL(url), "utf8"))}`,
  };
  return nextLoad(url, context);
}
