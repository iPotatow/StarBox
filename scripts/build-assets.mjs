import { relative, resolve } from "node:path";

/** Count static imports recursively; dynamic page chunks are deferred. */
export function summarizeBuild(metafile, distRoot) {
  const entries = Object.entries(metafile.outputs);
  const entry = entries.find(([, output]) => output.entryPoint?.endsWith("src/main.tsx"));
  if (!entry) throw new Error("Browser build has no main entry point");
  const initial = new Set();
  function visit(name) {
    if (initial.has(name)) return;
    const output = metafile.outputs[name];
    if (!output) throw new Error(`Missing bundled import: ${name}`);
    initial.add(name);
    for (const dependency of output.imports) if (!dependency.external && dependency.kind !== "dynamic-import") visit(dependency.path);
  }
  visit(entry[0]);
  return {
    entryUrl: `/${relative(distRoot, resolve(entry[0])).replaceAll("\\", "/")}`,
    initialJsBytes: [...initial].reduce((sum, name) => sum + metafile.outputs[name].bytes, 0),
    totalJsBytes: entries.filter(([name]) => name.endsWith(".js")).reduce((sum, [, output]) => sum + output.bytes, 0),
  };
}

export const ASSET_HEADERS = `/assets/*
  Cache-Control: public, max-age=31536000, immutable
/chunks/*
  Cache-Control: public, max-age=31536000, immutable
`;
