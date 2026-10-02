import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

async function filesUnder(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(file));
    else if (/\.(?:tsx?|css|mjs|sql)$/.test(file)) files.push(file);
  }
  return files;
}
export function sourceBuildId(entries) {
  const hash = createHash("sha256");
  for (const [name, content] of [...entries].sort(([left], [right]) => left.localeCompare(right, "en"))) {
    hash.update(name); hash.update("\0"); hash.update(String(Buffer.byteLength(content))); hash.update("\0"); hash.update(content);
  }
  return hash.digest("hex").slice(0, 24);
}
export async function createBuildInfo(root, { now = new Date(), env = process.env } = {}) {
  const files = ["package.json", "package-lock.json", "wrangler.jsonc"].map((name) => join(root, name));
  for (const dir of ["src", "shared", "worker", "scripts", "migrations"]) files.push(...await filesUnder(join(root, dir)));
  const entries = await Promise.all(files.map(async (file) => [relative(root, file).replaceAll("\\", "/"), await readFile(file)]));
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  return { version: pkg.version, buildId: sourceBuildId(entries), builtAt: now.toISOString(), source: env.GITHUB_ACTIONS === "true" ? "github-actions" : "local" };
}
