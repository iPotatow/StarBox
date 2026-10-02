import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredPackages = ["typescript/bin/tsc", "react", "react-dom", "react-markdown", "remark-gfm", "@phosphor-icons/react", "@base-ui/react", "@types/react/package.json", "@types/react-dom/package.json"];
const missing = requiredPackages.filter((name) => {
  try { require.resolve(name); return false; }
  catch { return true; }
});

if (missing.length) {
  console.error(`Missing installed dependencies: ${missing.join(", ")}. Run npm ci before checking types.`);
  process.exit(2);
}

console.log("Typecheck mode: installed package types");
const result = spawnSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-b", "--pretty", "false"], {
  cwd: root,
  stdio: "inherit",
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
