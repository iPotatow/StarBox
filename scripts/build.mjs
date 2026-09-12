import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");
const distRoot = join(root, "dist");
const require = createRequire(import.meta.url);

async function importPackage(name) {
  try {
    return await import(name);
  } catch (error) {
    let globalRoot = "";
    try {
      globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    } catch {
      throw error;
    }
    const packageJson = join(globalRoot, name, "package.json");
    try {
      const pkg = JSON.parse(await readFile(packageJson, "utf8"));
      const entry = typeof pkg.exports === "object" && typeof pkg.exports["."] === "object"
        ? (pkg.exports["."].import || pkg.exports["."].default)
        : pkg.module || pkg.main || "index.js";
      return await import(pathToFileURL(join(globalRoot, name, entry)).href);
    } catch {
      throw error;
    }
  }
}

const [{ compile }, tsModule] = await Promise.all([importPackage("tailwindcss"), importPackage("typescript")]);
const ts = tsModule.default ?? tsModule;

async function bundleInstalledDependencies() {
  try {
    const esbuild = await import("esbuild");
    await esbuild.build({
      entryPoints: [join(srcRoot, "main.tsx")],
      outfile: join(distRoot, "app.js"),
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
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ERR_MODULE_NOT_FOUND") return false;
    if (String(error).includes("Cannot find package 'esbuild'")) return false;
    throw error;
  }
}

async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else result.push(path);
  }
  return result;
}

function browserSpecifier(specifier, sourcePath) {
  if (!specifier.startsWith(".")) return specifier;
  if (specifier.endsWith(".css")) return null;
  const sourceDir = dirname(sourcePath);
  const absolute = resolve(sourceDir, specifier);
  const target = extname(absolute) ? absolute : `${absolute}.js`;
  let next = relative(sourceDir, target).replaceAll("\\", "/");
  if (!next.startsWith(".")) next = `./${next}`;
  return next;
}

function rewriteImports(code, sourcePath) {
  return code.replace(/(?:import\s+[^;]+?\s+from\s+|export\s+[^;]+?\s+from\s+|import\s*)["']([^"']+)["'];?/g, (statement, specifier) => {
    const replacement = browserSpecifier(specifier, sourcePath);
    if (replacement === null) return "";
    return statement.replace(specifier, replacement);
  });
}

async function transpileSource() {
  const files = (await walk(srcRoot)).filter((path) => /\.(ts|tsx)$/.test(path) && !path.endsWith(".d.ts"));
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        verbatimModuleSyntax: false,
      },
      fileName: file,
    }).outputText;
    const outputPath = join(distRoot, "src", relative(srcRoot, file).replace(/\.tsx?$/, ".js"));
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, rewriteImports(output, file));
  }
}

async function resolveStylesheet(id, base) {
  if (id.startsWith(".")) return resolve(base, id);
  if (id === "tailwindcss") {
    try {
      const entry = require.resolve("tailwindcss");
      return resolve(dirname(entry), "..", "index.css");
    } catch {
      const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
      return join(globalRoot, "tailwindcss", "index.css");
    }
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
  await writeFile(join(distRoot, "styles.css"), compiler.build([...candidates]));
}

async function buildHtml(bundled) {
  const imports = bundled ? "" : `
    <script type="importmap">{
      "imports": {
        "react": "https://esm.sh/react@19.3.0",
        "react/jsx-runtime": "https://esm.sh/react@19.3.0/jsx-runtime",
        "react-dom/client": "https://esm.sh/react-dom@19.3.0/client?deps=react@19.3.0",
        "@remixicon/react": "https://esm.sh/@remixicon/react@4.9.0?deps=react@19.3.0",
        "@base-ui/react/button": "https://esm.sh/@base-ui/react@1.8.0/button?deps=react@19.3.0,react-dom@19.3.0",
        "@base-ui/react/input": "https://esm.sh/@base-ui/react@1.8.0/input?deps=react@19.3.0,react-dom@19.3.0",
        "@base-ui/react/field": "https://esm.sh/@base-ui/react@1.8.0/field?deps=react@19.3.0,react-dom@19.3.0",
        "@base-ui/react/dialog": "https://esm.sh/@base-ui/react@1.8.0/dialog?deps=react@19.3.0,react-dom@19.3.0",
        "@base-ui/react/select": "https://esm.sh/@base-ui/react@1.8.0/select?deps=react@19.3.0,react-dom@19.3.0",
        "@base-ui/react/checkbox": "https://esm.sh/@base-ui/react@1.8.0/checkbox?deps=react@19.3.0,react-dom@19.3.0",
        "@base-ui/react/switch": "https://esm.sh/@base-ui/react@1.8.0/switch?deps=react@19.3.0,react-dom@19.3.0",
        "@base-ui/react/tooltip": "https://esm.sh/@base-ui/react@1.8.0/tooltip?deps=react@19.3.0,react-dom@19.3.0",
        "@base-ui/react/toolbar": "https://esm.sh/@base-ui/react@1.8.0/toolbar?deps=react@19.3.0,react-dom@19.3.0",
        "@base-ui/react/toggle-group": "https://esm.sh/@base-ui/react@1.8.0/toggle-group?deps=react@19.3.0,react-dom@19.3.0",
        "@base-ui/react/toggle": "https://esm.sh/@base-ui/react@1.8.0/toggle?deps=react@19.3.0,react-dom@19.3.0",
        "@base-ui/react/alert-dialog": "https://esm.sh/@base-ui/react@1.8.0/alert-dialog?deps=react@19.3.0,react-dom@19.3.0"
      }
    }</script>`;
  const entry = bundled ? "/app.js" : "/src/main.js";
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#ffffff" />
    <meta name="description" content="StarBox — GitHub Stars, Releases, Forks, Lists and discovery on Cloudflare Workers" />
    <title>StarBox</title>
    <link rel="stylesheet" href="/styles.css" />${imports}
  </head>
  <body>
    <div id="root"><div style="min-height:100vh;display:grid;place-items:center;font:14px system-ui;color:#666">StarBox 正在启动…</div></div>
    <script type="module" src="${entry}"></script>
  </body>
</html>`;
  await writeFile(join(distRoot, "index.html"), html);
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });
await Promise.all([transpileSource(), buildCss()]);
const bundled = await bundleInstalledDependencies();
await buildHtml(bundled);
console.log(`Built StarBox -> ${relative(root, distRoot)} (${bundled ? "bundled local dependencies" : "fallback import-map mode"})`);
