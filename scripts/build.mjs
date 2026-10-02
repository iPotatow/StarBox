import { createHash } from "node:crypto";
import { summarizeBuild, ASSET_HEADERS } from "./build-assets.mjs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { compile } from "tailwindcss";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");
const distRoot = join(root, "dist");
const require = createRequire(import.meta.url);

async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result;
}

async function buildApp() {
  const result = await build({
    entryPoints: [join(srcRoot, "main.tsx")],
    outdir: distRoot,
    entryNames: "assets/app-[hash]",
    chunkNames: "chunks/[name]-[hash]",
    splitting: true,
    metafile: true,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["es2022"],
    jsx: "automatic",
    minify: true,
    sourcemap: false,
    loader: { ".css": "empty" },
    logLevel: "warning",
  });
  return summarizeBuild(result.metafile, distRoot);
}

async function resolveStylesheet(id, base) {
  if (id.startsWith(".")) return resolve(base, id);
  if (id === "tailwindcss") {
    const entry = require.resolve("tailwindcss");
    return resolve(dirname(entry), "..", "index.css");
  }
  return require.resolve(id);
}

async function loadStylesheet(id, base) {
  const path = await resolveStylesheet(id, base);
  return { path, base: dirname(path), content: await readFile(path, "utf8") };
}

function extractCandidates(content) {
  const tokens = content.match(/[!@A-Za-z0-9_./:%#,+*=&'()\[\]<>~-]+/g) || [];
  return tokens.filter((token) => token.length < 180);
}

async function buildCss() {
  const stylesheet = await readFile(join(srcRoot, "styles.css"), "utf8");
  const compiler = await compile(stylesheet, { base: srcRoot, from: join(srcRoot, "styles.css"), loadStylesheet });
  const sourceFiles = (await walk(srcRoot)).filter((path) => /\.(ts|tsx)$/.test(path));
  const candidates = new Set();
  for (const file of sourceFiles) {
    for (const token of extractCandidates(await readFile(file, "utf8"))) candidates.add(token);
  }
  const css = compiler.build([...candidates]);
  const filename = `assets/styles-${createHash("sha256").update(css).digest("hex").slice(0, 12)}.css`;
  await mkdir(join(distRoot, "assets"), { recursive: true });
  await writeFile(join(distRoot, filename), css);
  return `/${filename}`;
}

async function buildHtml(appUrl, cssUrl) {
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#ffffff" />
    <meta name="description" content="StarBox — GitHub Stars, Releases, Forks and discovery on Cloudflare Workers" />
    <title>StarBox</title>
    <link rel="stylesheet" href="${cssUrl}" />
  </head>
  <body>
    <div id="root"><div style="min-height:100vh;display:grid;place-items:center;font:14px system-ui;color:#666">StarBox 正在启动…</div></div>
    <script type="module" src="${appUrl}"></script>
  </body>
</html>`;
  await writeFile(join(distRoot, "index.html"), html);
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });
const [app, cssUrl] = await Promise.all([buildApp(), buildCss()]);
await buildHtml(app.entryUrl, cssUrl);
await writeFile(join(distRoot, "_headers"), ASSET_HEADERS);
console.log(`JavaScript: initial static graph ${(app.initialJsBytes / 1024).toFixed(1)} KiB; total ${(app.totalJsBytes / 1024).toFixed(1)} KiB`);
console.log(`Built StarBox -> ${relative(root, distRoot)} (bundled local dependencies)`);
