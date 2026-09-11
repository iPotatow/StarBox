import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../dist/", import.meta.url).pathname;
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json" };

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      response.writeHead(501, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "本地静态预览不运行 Worker API；完整联调请使用 wrangler dev。" }));
      return;
    }
    let path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root)) throw new Error("Invalid path");
    try { if ((await stat(path)).isDirectory()) path = join(path, "index.html"); } catch { path = join(root, "index.html"); }
    const body = await readFile(path);
    response.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
    response.end(body);
  } catch {
    response.writeHead(404); response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`StarBox preview: http://127.0.0.1:${port}`));
