import { rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

rmSync(".test-build", { recursive: true, force: true });
mkdirSync(".test-build/worker", { recursive: true });
mkdirSync(".test-build/client", { recursive: true });

function tsc(project) {
  const result = spawnSync("tsc", ["-p", project, "--pretty", "false"], { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
tsc("tsconfig.test.json");
tsc("tsconfig.storage-test.json");

const tests = spawnSync(process.execPath, ["--test", "tests/worker.test.mjs", "tests/storage.test.mjs", "tests/contracts.test.mjs"], { stdio: "inherit" });
process.exit(tests.status ?? 1);
