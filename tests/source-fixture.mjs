import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Source assertions follow actual local imports after domain-module extraction.
// Assertions stay unchanged; public entry points must still reach their implementation.
export function sourceTree(file) {
  const seen = new Set();
  function visit(path) {
    const absolute = resolve(path);
    if (seen.has(absolute)) return "";
    seen.add(absolute);
    const source = readFileSync(absolute, "utf8");
    const dependencies = [...source.matchAll(/(?:from\s*|import\s*\()(["'])(\.[^"']+)\1/g)].map((match) => match[2]);
    const children = dependencies.flatMap((dependency) => {
      if (file === "src/lib/api.ts" && dependency === "./storage") return [];
      const base = resolve(dirname(absolute), dependency.replace(/\.js$/, ""));
      const target = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
      return target ? [visit(target)] : [];
    });
    return [source, ...children].join("\n");
  }
  return visit(file);
}


export function sourceFixture(file) {
  const entries = ["worker/index.ts", "worker/v5.ts", "worker/repository.ts", "src/types.ts", "src/lib/release-platform-core.ts", "src/lib/api.ts"];
  return entries.includes(file) ? sourceTree(file) : readFileSync(file, "utf8");
}
