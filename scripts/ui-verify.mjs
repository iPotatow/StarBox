import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const outputDir = resolve(process.env.STARBOX_UI_VERIFY_DIR || join(root, ".ui-verify"));
const runtimeDir = join(outputDir, "runtime");
const sourceDir = join(outputDir, "src");
const rasterRequested = !process.argv.includes("--no-raster") && process.env.STARBOX_UI_VERIFY_RASTER !== "0";

const seed = {
  version: 4,
  settings: {
    githubToken: "token",
    theme: "light",
    density: "comfortable",
    accent: "blue",
    navOrder: ["repositories", "releases", "forks", "discover", "settings"],
    hiddenNav: [],
    ai: { providerName: "OpenAI Compatible", baseUrl: "", apiKey: "", model: "", headers: {}, credentialConfigured: false },
  },
  repositories: [
    {
      id: 1,
      name: "react",
      full_name: "facebook/react",
      description: "The library for web and native user interfaces.",
      html_url: "https://github.com/facebook/react",
      stargazers_count: 240000,
      forks_count: 50000,
      language: "JavaScript",
      license: "MIT",
      updated_at: "2026-09-10T12:00:00Z",
      pushed_at: "2026-09-11T03:00:00Z",
      starred_at: "2026-09-10T01:00:00Z",
      archived: false,
      topics: ["ui", "frontend"],
      owner: { login: "facebook", avatar_url: "" },
    },
    {
      id: 2,
      name: "coss",
      full_name: "cosscom/coss",
      description: "Accessible and composable React UI components.",
      html_url: "https://github.com/cosscom/coss",
      stargazers_count: 12000,
      forks_count: 800,
      language: "TypeScript",
      license: "MIT",
      updated_at: "2026-09-10T12:00:00Z",
      pushed_at: "2026-09-11T02:00:00Z",
      starred_at: "2026-09-09T01:00:00Z",
      archived: false,
      topics: ["components", "design-system"],
      owner: { login: "cosscom", avatar_url: "" },
    },
  ],
  repositoryMeta: {
    "facebook/react": { category: "前端", note: "核心 UI 库", aiSummary: "构建 Web 与原生用户界面的组件库", aiTags: ["UI", "React"], aiPlatforms: ["macos"] },
    "cosscom/coss": { category: "设计系统", note: "", aiSummary: "可访问、可组合的界面组件", aiTags: ["组件", "设计"], aiPlatforms: ["windows"] },
  },
  categories: [
    { id: "cat-frontend", name: "前端", color: "blue", order: 0, locked: true },
    { id: "cat-design", name: "设计系统", color: "violet", order: 1, locked: false },
  ],
  releaseSubscriptions: ["facebook/react"],
  releases: [
    {
      id: 101,
      repoFullName: "facebook/react",
      tagName: "v19.3.0",
      name: "React 19.3.0",
      body: "Release notes for verification.",
      htmlUrl: "https://github.com/facebook/react/releases/tag/v19.3.0",
      publishedAt: "2026-09-11T02:00:00Z",
      createdAt: "2026-09-11T01:00:00Z",
      draft: false,
      prerelease: false,
      author: { login: "react-team", avatarUrl: "" },
      assets: [{ id: 1001, name: "react-darwin-arm64.dmg", size: 1024, downloadCount: 12, browserDownloadUrl: "https://example.com/react.dmg" }],
    },
  ],
  releaseSettings: { latestOnly: false, includePrereleases: true, assetRules: { macos: { includePattern: "", excludePattern: "" }, windows: { includePattern: "", excludePattern: "" }, linux: { includePattern: "", excludePattern: "" } }, pageSize: 20, syncPages: 3 },
  forkJobs: [
    {
      id: "ready",
      sourceFullName: "facebook/react",
      targetOwner: "demo",
      targetName: "react",
      targetFullName: "demo/react",
      htmlUrl: "https://github.com/demo/react",
      status: "ready",
      createdAt: "2026-09-11T01:00:00Z",
      updatedAt: "2026-09-11T02:00:00Z",
      error: "",
    },
    {
      id: "pending",
      sourceFullName: "cosscom/coss",
      targetOwner: "demo",
      targetName: "coss-copy",
      targetFullName: "demo/coss-copy",
      htmlUrl: null,
      status: "pending",
      createdAt: "2026-09-11T02:00:00Z",
      updatedAt: "2026-09-11T02:00:00Z",
      error: "",
    },
  ],
  lastSyncAt: "2026-09-11T03:00:00Z",
  lastReleaseSyncAt: "2026-09-11T03:10:00Z",
};

const reactRuntime = String.raw`
let currentKey = "";
let hookIndex = 0;
const hooks = new Map();
export const StrictMode = ({ children }) => children;
export function __resetHooks() { hooks.clear(); currentKey = ""; hookIndex = 0; }
export function __withComponent(key, fn) {
  const previousKey = currentKey;
  const previousIndex = hookIndex;
  currentKey = key;
  hookIndex = 0;
  try { return fn(); } finally { currentKey = previousKey; hookIndex = previousIndex; }
}
function bucket() {
  if (!hooks.has(currentKey)) hooks.set(currentKey, []);
  return hooks.get(currentKey);
}
export function useState(initial) {
  const store = bucket();
  const index = hookIndex++;
  if (!(index in store)) store[index] = typeof initial === "function" ? initial() : initial;
  return [store[index], () => {}];
}
export function useMemo(factory) { hookIndex++; return factory(); }
export function useCallback(fn) { hookIndex++; return fn; }
export function useSyncExternalStore(_subscribe, getSnapshot, getServerSnapshot) {
  hookIndex++;
  return (getServerSnapshot || getSnapshot)();
}
export function useRef(initial) {
  const store = bucket();
  const index = hookIndex++;
  if (!(index in store)) store[index] = { current: initial };
  return store[index];
}
export function useEffect() { hookIndex++; }
export function useLayoutEffect() { hookIndex++; }
export function createContext(defaultValue) {
  const context = { _current: defaultValue };
  context.Provider = ({ value, children }) => { context._current = value; return children; };
  return context;
}
export function useContext(context) { hookIndex++; return context._current; }
export const Children = { toArray(value) { if (value == null) return []; return Array.isArray(value) ? value.flat(Infinity).filter((item) => item != null && item !== false) : [value]; } };
export function isValidElement(value) { return Boolean(value && typeof value === "object" && "type" in value && "props" in value); }
`;

const jsxRuntime = String.raw`
export const Fragment = Symbol.for("starbox.fragment");
export function jsx(type, props, key) { return { type, props: props || {}, key }; }
export const jsxs = jsx;
`;

await rm(outputDir, { recursive: true, force: true });
await mkdir(runtimeDir, { recursive: true });

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

function verificationSpecifier(specifier) {
  if (!specifier.startsWith(".")) return specifier;
  if (specifier.endsWith(".css")) return null;
  if (/\.[cm]?js$/.test(specifier)) return specifier;
  return `${specifier}.js`;
}

function rewriteVerificationImports(code) {
  return code.replace(/(from\s+|import\s*)["']([^"']+)["']/g, (statement, prefix, specifier) => {
    const replacement = verificationSpecifier(specifier);
    if (replacement === null) return "";
    return `${prefix}"${replacement}"`;
  });
}

async function transpileVerificationSource() {
  const srcRoot = join(root, "src");
  for (const file of await walk(srcRoot)) {
    if (!/\.(ts|tsx)$/.test(file) || file.endsWith(".d.ts")) continue;
    const code = ts.transpileModule(await readFile(file, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        verbatimModuleSyntax: false,
      },
      fileName: file,
    }).outputText;
    const outputPath = join(sourceDir, relative(srcRoot, file).replace(/\.tsx?$/, ".js"));
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, rewriteVerificationImports(code));
  }
}

await transpileVerificationSource();
await writeFile(join(runtimeDir, "react.js"), reactRuntime);
await writeFile(join(runtimeDir, "jsx-runtime.js"), jsxRuntime);

const iconNames = new Set();
for (const file of await walk(join(root, "src"))) {
  if (!/\.tsx?$/.test(file) || file.endsWith(".d.ts")) continue;
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*["']lucide-react["']/g)) {
    for (const item of match[1].split(",")) {
      const name = item.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim();
      if (name) iconNames.add(name);
    }
  }
}
const lucideRuntime = `import { jsx } from ${JSON.stringify(pathToFileURL(join(runtimeDir, "jsx-runtime.js")).href)};\nfunction icon(props = {}) { return jsx("span", { ...props, style: { display: "inline-block", width: "1em", textAlign: "center", ...(props.style || {}) }, "aria-hidden": "true", children: "◆" }); }\n${[...iconNames].sort().map((name) => `export const ${name} = icon;`).join("\n")}\n`;
await writeFile(join(runtimeDir, "lucide-react.js"), lucideRuntime);

const baseUiRuntime = String.raw`
import { jsx, Fragment } from ${JSON.stringify(pathToFileURL(join(runtimeDir, "jsx-runtime.js")).href)};
const passthrough = ({ children }) => children ?? null;
const mergeClassNames = (...values) => values.filter(Boolean).join(" ");
export function mergeProps(...values) {
  const out = {};
  for (const value of values) {
    if (!value) continue;
    if (out.className && value.className) out.className = mergeClassNames(out.className, value.className);
    Object.assign(out, value);
  }
  return out;
}
export function useRender({ defaultTagName, props = {}, render }) {
  if (render && typeof render === "object") return { ...render, props: mergeProps(render.props || {}, props) };
  return jsx(defaultTagName, props);
}
const renderControl = ({ render, children, ...props } = {}) => typeof render === "function" ? render({ ...props, children }) : render && typeof render === "object" ? { ...render, props: mergeProps(render.props || {}, props, { children: children ?? render.props?.children }) } : children ?? null;
const primitive = (tag) => function Primitive(props = {}) { return jsx(tag, props); };
const button = primitive("button");
const input = primitive("input");
const span = primitive("span");
const div = primitive("div");
const section = primitive("section");
const label = primitive("label");
const p = primitive("p");
const h2 = primitive("h2");
export const Button = button;
export const Input = input;
export const Field = { Root: div, Label: label, Description: p, Error: p, Item: div, Control: renderControl, Validity: passthrough };
export const Dialog = { Root: passthrough, Portal: passthrough, Backdrop: div, Viewport: div, Popup: section, Title: h2, Description: p, Close: button, Trigger: button };
export const Popover = { Root: passthrough, Portal: passthrough, Trigger: renderControl, Positioner: div, Popup: div, Viewport: div, Close: button, Title: h2, Description: p };
export const Select = { Root: passthrough, Trigger: button, Value: span, Icon: span, Portal: passthrough, Positioner: div, Popup: div, List: div, Item: div, ItemIndicator: span, ItemText: span, Separator: div, Group: div, Label: label, GroupLabel: label };
export const Checkbox = { Root: button, Indicator: span };
export const Switch = { Root: button, Thumb: span };
export const Tooltip = { Provider: passthrough, Root: passthrough, Trigger: renderControl, Portal: passthrough, Positioner: div, Popup: div, Arrow: span };
export const Menu = { Root: passthrough, Portal: passthrough, Trigger: renderControl, Positioner: div, Popup: div, Item: div, Group: div, GroupLabel: div, Separator: div };
export const Tabs = { Root: div, List: div, Tab: button, Panel: div, Indicator: div };
const toastStore = [];
export const Toast = { createToastManager() { return { add(value) { toastStore.push({ id: String(toastStore.length + 1), ...value }); } }; }, useToastManager() { return { toasts: toastStore }; }, Provider: passthrough, Portal: passthrough, Viewport: div, Root: div, Content: div, Title: div, Description: div, Action: button };
export const Autocomplete = { Root: div, Input: input, List: div, Item: div, Empty: div, Group: div, Separator: div };
export const Toolbar = { Root: div, Group: div, Button: button, Link: primitive("a"), Separator: div };
export const ToggleGroup = div;
export const Toggle = button;
export const AlertDialog = { Root: passthrough, Trigger: renderControl, Close: button, Portal: passthrough, Backdrop: div, Viewport: div, Popup: section, Title: h2, Description: p };
`;
await writeFile(join(runtimeDir, "base-ui.js"), baseUiRuntime);

const borderBeamRuntime = String.raw`
export function BorderBeam({ children }) { return children ?? null; }
`;
await writeFile(join(runtimeDir, "border-beam.js"), borderBeamRuntime);

const reactUrl = pathToFileURL(join(runtimeDir, "react.js")).href;
const jsxUrl = pathToFileURL(join(runtimeDir, "jsx-runtime.js")).href;
const lucideUrl = pathToFileURL(join(runtimeDir, "lucide-react.js")).href;
const baseUiUrl = pathToFileURL(join(runtimeDir, "base-ui.js")).href;
const borderBeamUrl = pathToFileURL(join(runtimeDir, "border-beam.js")).href;
for (const file of await walk(sourceDir)) {
  if (!file.endsWith(".js")) continue;
  let source = await readFile(file, "utf8");
  source = source
    .replaceAll('from "react/jsx-runtime"', `from ${JSON.stringify(jsxUrl)}`)
    .replaceAll("from 'react/jsx-runtime'", `from ${JSON.stringify(jsxUrl)}`)
    .replaceAll('from "react"', `from ${JSON.stringify(reactUrl)}`)
    .replaceAll("from 'react'", `from ${JSON.stringify(reactUrl)}`)
    .replaceAll('from "lucide-react"', `from ${JSON.stringify(lucideUrl)}`)
    .replaceAll("from 'lucide-react'", `from ${JSON.stringify(lucideUrl)}`)
    .replaceAll('from "border-beam"', `from ${JSON.stringify(borderBeamUrl)}`)
    .replaceAll("from 'border-beam'", `from ${JSON.stringify(borderBeamUrl)}`)
    .replace(/from ["']@base-ui\/react\/(?:button|input|field|dialog|popover|select|checkbox|switch|tooltip|merge-props|use-render|menu|tabs|toast|autocomplete|toolbar|toggle-group|toggle|alert-dialog)["']/g, `from ${JSON.stringify(baseUiUrl)}`);
  await writeFile(file, source);
}

const memory = new Map();
globalThis.localStorage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); },
  clear() { memory.clear(); },
};
globalThis.window = {
  location: { pathname: "/" },
  history: { pushState() {} },
  matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
  addEventListener() {},
  removeEventListener() {},
  confirm() { return true; },
};

const { jsx, Fragment } = await import(jsxUrl);
const react = await import(reactUrl);
const { default: App } = await import(pathToFileURL(join(sourceDir, "app.js")).href);
const css = await readFile(join(dist, "styles.css"), "utf8");
const canRasterize = rasterRequested && spawnSync("weasyprint", ["--version"], { stdio: "ignore" }).status === 0
  && spawnSync("pdftoppm", ["-v"], { stdio: "ignore" }).status === 0;

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function kebab(value) { return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`); }
function styleText(style) {
  return Object.entries(style).map(([key, value]) => `${kebab(key)}:${value}`).join(";");
}
const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
function renderNode(value, path = "0") {
  if (value == null || value === false || value === true) return "";
  if (Array.isArray(value)) return value.map((item, index) => renderNode(item, `${path}.${index}`)).join("");
  if (typeof value === "string" || typeof value === "number") return escapeHtml(value);
  if (value.type === Fragment) return renderNode(value.props?.children, `${path}.f`);
  if (typeof value.type === "function") {
    const name = value.type.name || "Component";
    const result = react.__withComponent(`${path}:${name}:${value.key ?? ""}`, () => value.type(value.props || {}));
    return renderNode(result, `${path}.c`);
  }
  if (typeof value.type !== "string") return "";
  const props = value.props || {};
  const attributes = [];
  for (const [key, prop] of Object.entries(props)) {
    if (key === "children" || key === "ref" || key === "key" || key.startsWith("on") || prop == null || prop === false) continue;
    const name = key === "className" ? "class" : key === "htmlFor" ? "for" : key;
    if (key === "style" && typeof prop === "object") { attributes.push(`style="${escapeHtml(styleText(prop))}"`); continue; }
    if (prop === true) { attributes.push(name); continue; }
    attributes.push(`${name}="${escapeHtml(prop)}"`);
  }
  const open = `<${value.type}${attributes.length ? ` ${attributes.join(" ")}` : ""}>`;
  if (voidTags.has(value.type)) return open;
  const children = renderNode(props.children, `${path}.children`);
  return `${open}${children}</${value.type}>`;
}

const cases = [
  { route: "/", marker: "facebook/react", name: "stars" },
  { route: "/releases", marker: "按所选平台和架构推荐安装包", name: "releases" },
  { route: "/forks", marker: "查看与上游的差异", name: "forks" },
  { route: "/discover", marker: "搜索 GitHub 上值得关注的仓库", name: "discover" },
  { route: "/settings", marker: "账户与 GitHub", name: "settings" },
];
for (const item of cases) {
  react.__resetHooks();
  memory.clear();
  localStorage.setItem("starbox:state:v4", JSON.stringify(seed));
  window.__STARBOX_TEST_SESSION__ = { authenticated: true, username: "admin", defaultCredentialsActive: true };
  window.location.pathname = item.route;
  const body = renderNode(jsx(App, {}));
  if (!body.includes(item.marker)) throw new Error(`${item.name}: 未找到 UI 标记 ${item.marker}`);
  if (!body.includes("StarBox")) throw new Error(`${item.name}: 应用外壳未渲染`);
  if (!body.includes("content-surface")) throw new Error(`${item.name}: Content Surface 未渲染`);
  if (item.name === "stars" && (!body.includes("Stars 工具栏") || !body.includes("搜索仓库、描述、标签、备注…") || !body.includes("筛选") || body.includes("stars-category-strip"))) throw new Error("stars: 单一卡片 + 合并排序/筛选合同未渲染");
  if (item.name === "releases" && (body.includes("导入 Watching") || body.includes("Asset 快速过滤") || body.includes("下载规则") || !body.includes("检查更新") || !body.includes("设备"))) throw new Error("releases: 单入口目标设备推荐 UI 合同未渲染");
  if (item.name === "forks" && (body.includes("未读") || !body.includes("Actions") || !body.includes("Workflow") || !body.includes("查看与上游的差异"))) throw new Error("forks: existing-fork + Actions/Workflow + product copy contract 未渲染");
  if (item.name === "settings" && (!body.includes("账户与 GitHub") || !body.includes("导航") || !body.includes("数据") || !body.includes("分类") || !body.includes("AI 集成") || !body.includes("登录设备"))) throw new Error("settings: Tabs 信息架构未完整渲染");
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>@page{size:1440px 960px;margin:0}${css}</style></head><body>${body}</body></html>`;
  const htmlPath = join(outputDir, `${item.name}.html`);
  const pdfPath = join(outputDir, `${item.name}.pdf`);
  const pngPrefix = join(outputDir, item.name);
  await writeFile(htmlPath, html);
  if (canRasterize) {
    execFileSync("weasyprint", [htmlPath, pdfPath], { stdio: "ignore", timeout: 30000 });
    execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-png", "-r", "96", pdfPath, pngPrefix], { stdio: "ignore", timeout: 30000 });
  }
}

await writeFile(join(outputDir, "RESULT.txt"), [
  "StarBox UI verification: PASS",
  "Renderer: deterministic React-compatible SSR harness + production Tailwind CSS",
  canRasterize ? "Visual rasterizer: WeasyPrint + pdftoppm" : rasterRequested ? "Visual rasterizer: unavailable; structural route render checks completed" : "Visual rasterizer: skipped by fast structural verification mode",
  "Routes: Star, Release, Fork, Discover, Settings",
].join("\n") + "\n");
console.log(`UI verification passed: ${relative(root, outputDir)}`);