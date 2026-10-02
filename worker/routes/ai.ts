import { caughtError } from "../http.js";
import { parseBody, json, error, sha256Hex } from "../http.js";
import { githubToken, parseFullName, githubFetch } from "../github.js";
import { resolveReleasePlatforms } from "../services/release-platforms.js";
import type { StarBoxEnv } from "../types.js";
import type { ProviderConfig } from "../provider.js";
import { loadAiProviderConfig } from "./ai-config.js";
import { callProvider } from "../provider.js";
import { DataRepository } from "../repository.js";

export type RepositoryInput = { name: string; description: string | null; language: string | null; topics: string[] };

export async function handleAiTest(request: Request, env?: StarBoxEnv) { try { const draft = await parseBody<ProviderConfig>(request); const ai = env ? await loadAiProviderConfig(env, draft) : draft; await callProvider(ai, [{ role: "system", content: "Reply with exactly: STARBOX_OK" }, { role: "user", content: "Connectivity test." }]); return json({ message: `${ai.providerName?.trim() || "Custom HTTP"} 连接成功` }); } catch (reason) { return caughtError(reason, "AI 服务连接失败", 400); } }

export function extractJsonObject(content: string) { const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]; const candidate = fenced || content; const start = candidate.indexOf("{"); const end = candidate.lastIndexOf("}"); if (start < 0 || end <= start) throw new Error("AI 返回内容不是有效 JSON"); return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>; }

export function truncateReadmeByParagraph(readme: string, targetChars = 2_000) {
  const paragraphs = readme.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const selected: string[] = [];
  let length = 0;

  for (const paragraph of paragraphs) {
    const separatorLength = selected.length ? 2 : 0;
    selected.push(paragraph);
    length += separatorLength + paragraph.length;
    if (length >= targetChars) break;
  }

  return selected.join("\n\n");
}

export async function fetchAiReadme(request: Request, fullName: string) {
  const token = githubToken(request);
  if (!token) return "";

  try {
    const { owner, repo } = parseFullName(fullName);
    const response = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`, token, {
      headers: { Accept: "application/vnd.github.raw+json" },
    });
    if (!response.ok) return "";
    return truncateReadmeByParagraph(await response.text());
  } catch {
    return "";
  }
}

export async function handleAiOrganize(request: Request, env?: StarBoxEnv) {
  try {
    const body = await parseBody<{ ai?: ProviderConfig; fullName: string; repository: RepositoryInput; skipIfCurrent?: boolean; previousAnalysis?: { inputHash?: string; promptVersion?: string; modelId?: string } }>(request);
    const repo = body.repository;
    const fullName = body.fullName?.trim() || "";
    const ai = env ? await loadAiProviderConfig(env) : body.ai!;
    if (!fullName || !repo?.name) throw new Error("缺少仓库信息");

    const [readme, platforms] = await Promise.all([
      fetchAiReadme(request, fullName),
      resolveReleasePlatforms(request, env, fullName),
    ]);
    const promptVersion = "repository-organize-v1";
    const inputHash = await sha256Hex(JSON.stringify({
      name: repo.name,
      description: repo.description || "",
      language: repo.language || "",
      topics: repo.topics || [],
      readme,
    }));
    const analysisMeta = { inputHash, promptVersion, modelId: ai.model };
    if (
      body.skipIfCurrent
      && body.previousAnalysis?.inputHash === inputHash
      && body.previousAnalysis?.promptVersion === promptVersion
      && body.previousAnalysis?.modelId === ai.model
    ) {
      return json({ unchanged: true, platforms, analysisMeta });
    }

    const repositoryContext = [
      `Name: ${repo.name}`,
      `Description: ${repo.description || ""}`,
      `Language: ${repo.language || ""}`,
      `Topics: ${(repo.topics || []).join(", ")}`,
      ...(readme ? ["README:", readme] : []),
      "Return JSON only with: summary (Chinese, <= 80 chars), category (Chinese, concise), tags (2-5 short Chinese strings).",
      "Do not include markdown.",
    ];

    const content = await callProvider(ai, [
      { role: "system", content: "You organize GitHub repositories into concise, practical personal-library metadata." },
      { role: "user", content: repositoryContext.join("\n") },
    ], true);

    const parsed = extractJsonObject(content);
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 160) : "";
    const category = typeof parsed.category === "string" ? parsed.category.trim().slice(0, 40) : "";
    const tags = Array.isArray(parsed.tags)
      ? Array.from(new Set(parsed.tags.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 32)).filter(Boolean))).slice(0, 5)
      : [];
    if (!summary || !category) throw new Error("AI 返回缺少 summary/category");
    return json({ summary, category, tags, platforms, analysisMeta });
  } catch (reason) {
    return caughtError(reason, "AI 分析失败", 400);
  }
}

export async function handleAiReleaseSummary(request: Request, env?: StarBoxEnv) {
  try {
    const body = await parseBody<{ ai?: ProviderConfig; release: { id?: number; repoFullName?: string; tagName?: string; name?: string; body?: string; prerelease?: boolean; assets?: Array<{ name?: string }> } }>(request);
    const release = body.release;
    const releaseId = Number(release?.id);
    if (!release?.repoFullName || !release.tagName || !Number.isSafeInteger(releaseId) || releaseId <= 0) throw new Error("缺少 Release 信息");
    const ai = env ? await loadAiProviderConfig(env) : body.ai!;
    const notes = (release.body || "").slice(0, 16_000);
    const assets = (release.assets || []).map((item) => item.name).filter(Boolean).slice(0, 30).join(", ");
    const content = await callProvider(ai, [
      { role: "system", content: "You summarize GitHub releases for a technical personal library. Return useful, concise Chinese JSON only." },
      { role: "user", content: [`Repository: ${release.repoFullName}`, `Version: ${release.tagName}`, `Title: ${release.name || release.tagName}`, `Prerelease: ${release.prerelease ? "yes" : "no"}`, `Assets: ${assets}`, "Release notes:", notes || "(empty)", "Return JSON only with: overview (Chinese, <=120 chars), highlights (0-5 concise Chinese strings), fixes (0-5 concise Chinese strings), breakingChanges (0-4 concise Chinese strings). Do not include markdown."].join("\n") },
    ], true);
    const parsed = extractJsonObject(content);
    const strings = (value: unknown, limit: number) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 160)).filter(Boolean).slice(0, limit) : [];
    const overview = typeof parsed.overview === "string" ? parsed.overview.trim().slice(0, 240) : "";
    if (!overview) throw new Error("AI 返回缺少 overview");
    const summary = { overview, highlights: strings(parsed.highlights, 5), fixes: strings(parsed.fixes, 5), breakingChanges: strings(parsed.breakingChanges, 4) };
    if (env?.DB) await new DataRepository(env.DB).saveReleaseAiSummary(release.repoFullName, releaseId, release.tagName, summary, ai.model);
    return json(summary);
  } catch (reason) { return caughtError(reason, "AI 总结失败", 400); }
}
