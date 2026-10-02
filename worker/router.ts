import { handleSystemInfo } from "./routes/system-info.js";
import { handleMcp } from "./mcp/server.js";
import { handleMcpConnections } from "./routes/mcp-connections.js";
import { caughtError } from "./http.js";
import { handleHealth } from "./routes/health.js";
import { handleGithubUser, handleRateLimit } from "./github.js";
import { handleStarred, handleWatched, handleBatchStars, handleReadme, handleRepository, handleStarMutation } from "./routes/repositories.js";
import { handleReleaseFeed, handleReleaseDetail } from "./routes/releases.js";
import { error, json } from "./http.js";
import { handleForkStatus, handleForkList, handleForkDetails, handleForkSync, handleForkWorkflowDispatch } from "./routes/forks.js";
import { handleDiscover } from "./routes/discover.js";
import { handleAiTest, handleAiOrganize, handleAiReleaseSummary } from "./routes/ai.js";
import type { StarBoxEnv, Identity } from "./types.js";
import { handleSession, handleLogin, validateMutationRequest, handleLogout, authenticate, handleDevices, handleRevokeOtherDevices } from "./auth.js";
import { handleAiServices, handleAiDefaultModel } from "./ai-services.js";
import { handleGithubCredential, hydrateGithubToken } from "./routes/credentials.js";
import { handleAiConfig } from "./routes/ai-config.js";
import { handlePreferences } from "./preferences.js";
import { handleSync, handleBootstrap, handleSyncMutation, handleNotifications } from "./routes/sync.js";
import { toErrorResponse } from "./errors.js";

export async function routeCore(request: Request, env?: StarBoxEnv, identity?: Identity): Promise<Response> {
  const url = new URL(request.url); if (!url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
  try {
    if (url.pathname === "/api/health" && request.method === "GET") return handleHealth(env);
    if (url.pathname === "/api/github/user" && request.method === "GET") return handleGithubUser(request);
    if (url.pathname === "/api/github/rate-limit" && request.method === "GET") return handleRateLimit(request);
    if (url.pathname === "/api/github/starred" && request.method === "GET") return handleStarred(request, env);
    if (url.pathname === "/api/github/watched" && request.method === "GET") return handleWatched(request);
    if (url.pathname === "/api/github/stars/batch" && request.method === "POST") return handleBatchStars(request, env);
    if (url.pathname === "/api/releases/feed" && request.method === "POST") return handleReleaseFeed(request, env);
    if (url.pathname === "/api/forks" && request.method === "POST") return error("StarBox 不提供 Fork 创建；请先在 GitHub 创建 Fork，再回到 Fork 页面刷新。", 405);
    if (url.pathname === "/api/forks/status" && request.method === "GET") return handleForkStatus(request, url, env);
    if (url.pathname === "/api/forks/list" && request.method === "GET") return handleForkList(request, env);
    if (url.pathname === "/api/forks/details" && request.method === "GET") return handleForkDetails(request, url);
    if (url.pathname === "/api/forks/sync" && request.method === "POST") return handleForkSync(request, env);
    if (url.pathname === "/api/forks/workflows/dispatch" && request.method === "POST") return handleForkWorkflowDispatch(request);
    if (url.pathname === "/api/discover" && request.method === "GET") return handleDiscover(request, url);
    if (url.pathname === "/api/ai/test" && request.method === "POST") return handleAiTest(request, env);
    if (url.pathname === "/api/ai/organize" && request.method === "POST") return handleAiOrganize(request, env);
    if (url.pathname === "/api/ai/release-summary" && request.method === "POST") return handleAiReleaseSummary(request, env);
    const readmeMatch = url.pathname.match(/^\/api\/github\/repos\/([^/]+)\/([^/]+)\/readme$/); if (readmeMatch && request.method === "GET") return handleReadme(request, decodeURIComponent(readmeMatch[1]), decodeURIComponent(readmeMatch[2]), url.searchParams.get("lang"));
    const repoMatch = url.pathname.match(/^\/api\/github\/repos\/([^/]+)\/([^/]+)$/); if (repoMatch && request.method === "GET") return handleRepository(request, decodeURIComponent(repoMatch[1]), decodeURIComponent(repoMatch[2]));
    const starMatch = url.pathname.match(/^\/api\/github\/stars\/([^/]+)\/([^/]+)$/); if (starMatch && (request.method === "PUT" || request.method === "DELETE")) return handleStarMutation(request, decodeURIComponent(starMatch[1]), decodeURIComponent(starMatch[2]), env);
    const releaseMatch = url.pathname.match(/^\/api\/releases\/([^/]+)\/([^/]+)\/(\d+)$/); if (releaseMatch && request.method === "GET") return handleReleaseDetail(request, decodeURIComponent(releaseMatch[1]), decodeURIComponent(releaseMatch[2]), releaseMatch[3]);
    return error("API 路由不存在", 404);
  } catch (reason) { if (reason instanceof Response) return reason; return caughtError(reason, "请求失败", 400); }
}

export function unauthenticated() { return json({ error: "需要 StarBox 登录会话" }, { status: 401 }); }

export async function routeRequest(request: Request, env?: StarBoxEnv): Promise<Response> {
  // Direct route(request) calls are retained for the pre-D1 contract tests. The
  // deployed Worker always receives env and therefore always takes this gate.
  if (!env) return routeCore(request);
  const url = new URL(request.url);
  if (url.pathname === "/mcp") return handleMcp(request, env);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
  if (url.pathname === "/api/auth/session" && request.method === "GET") return handleSession(request, env);
  if (url.pathname === "/api/auth/login" && request.method === "POST") return handleLogin(request, env);
  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const invalid = validateMutationRequest(request, true); if (invalid) return invalid;
    return handleLogout(request, env);
  }
  if (url.pathname === "/api/health" && request.method === "GET") return routeCore(request, env);
  if (request.method !== "GET") { const invalid = validateMutationRequest(request, true); if (invalid) return invalid; }
  const authResult = await authenticate(request, env);
  if (!("identity" in authResult)) return authResult.response.status === 200 ? unauthenticated() : authResult.response;
  const identity = authResult.identity!;
  if (url.pathname === "/api/system/info" && request.method === "GET") return handleSystemInfo(request, env);
  if (url.pathname === "/api/mcp/connections" && ["GET", "POST"].includes(request.method)) return handleMcpConnections(request, env);
  const mcpConnectionMatch = url.pathname.match(/^\/api\/mcp\/connections\/([0-9a-f-]{36})$/);
  if (mcpConnectionMatch && ["PATCH", "DELETE"].includes(request.method)) return handleMcpConnections(request, env, mcpConnectionMatch[1]);
  if (url.pathname === "/api/auth/devices" && request.method === "GET") return handleDevices(request, env, identity);
  if (url.pathname === "/api/auth/devices/revoke-others" && request.method === "POST") return handleRevokeOtherDevices(request, env, identity);
  const deviceMatch = url.pathname.match(/^\/api\/auth\/devices\/([^/]+)$/);
  if (deviceMatch && ["PATCH", "DELETE"].includes(request.method)) return handleDevices(request, env, identity, decodeURIComponent(deviceMatch[1]));
  if (url.pathname === "/api/ai/services" && ["GET", "POST"].includes(request.method)) return handleAiServices(request, env, identity, []);
  const aiServiceMatch = url.pathname.match(/^\/api\/ai\/services\/([^/]+)(?:\/(.*))?$/);
  if (aiServiceMatch) return handleAiServices(request, env, identity, [decodeURIComponent(aiServiceMatch[1]), ...(aiServiceMatch[2] ? aiServiceMatch[2].split("/").map(decodeURIComponent) : [])]);
  if (url.pathname === "/api/ai/default-model" && request.method === "PUT") return handleAiDefaultModel(request, env, identity);
  if (url.pathname === "/api/github/credential" && ["GET", "PUT", "DELETE"].includes(request.method)) return handleGithubCredential(request, env, identity);
  if (url.pathname === "/api/ai/config" && ["GET", "PUT"].includes(request.method)) return handleAiConfig(request, env, identity);
  if (url.pathname === "/api/preferences" && ["GET", "PUT"].includes(request.method)) return handlePreferences(request, env, identity);
  if (url.pathname === "/api/data/changes" && request.method === "GET") return handleSync(request, env, identity, "delta");
  if (url.pathname === "/api/sync/delta" && request.method === "GET") return handleSync(request, env, identity, "delta");
  if (url.pathname === "/api/sync/cursor" && request.method === "POST") return handleSync(request, env, identity, "cursor");
  if (url.pathname === "/api/bootstrap" && request.method === "GET") return handleBootstrap(request, env, identity);
  if (url.pathname === "/api/sync/mutate" && request.method === "POST") return handleSyncMutation(request, env, identity);
  if (url.pathname === "/api/sync/release-state" && request.method === "POST") return handleSync(request, env, identity, "release");
  if (url.pathname === "/api/sync/fork-state" && request.method === "POST") return handleSync(request, env, identity, "fork");
  if (url.pathname === "/api/notifications" && request.method === "GET") return handleNotifications(request, env, identity);
  const notificationMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (notificationMatch && request.method === "POST") return handleNotifications(request, env, identity, decodeURIComponent(notificationMatch[1]));
  return routeCore(await hydrateGithubToken(request, env, identity), env, identity);
}

export async function route(request: Request, env?: StarBoxEnv): Promise<Response> {
  try { return await routeRequest(request, env); }
  catch (reason) {
    if (reason instanceof Response) return reason;
    return toErrorResponse(reason, "internal_error", "请求处理失败");
  }
}
