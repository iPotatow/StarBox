import { rmSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const compiler = require.resolve("typescript/bin/tsc");

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

rmSync(resolve(root, ".test-build"), { recursive: true, force: true });
mkdirSync(resolve(root, ".test-build/worker"), { recursive: true });
mkdirSync(resolve(root, ".test-build/client"), { recursive: true });

for (const project of ["tsconfig.test.json", "tsconfig.storage-test.json"]) {
  run([compiler, "-p", project, "--pretty", "false"]);
}

const testFiles = readdirSync(resolve(root, "tests"))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => `tests/${name}`);
if (!testFiles.length) {
  console.error("No automated tests were found.");
  process.exit(1);
}
run(["--test", ...testFiles]);
