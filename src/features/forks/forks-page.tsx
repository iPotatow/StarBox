import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiExternalLinkLine,
  RiGitForkLine,
  RiLoader4Line,
  RiRefreshLine,
  RiSearchLine,
  RiSettings4Line,
} from "@remixicon/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { Select } from "../../components/ui/select";
import { StatusBanner } from "../../components/ui/status-banner";
import { fetchForkDetails, fetchForkRepositories, fetchForkStatus, syncForkUpstream } from "../../lib/api";
import { runOptimisticMutation } from "../../lib/mutations";
import type { ForkJob, ForkRepository, PersistedState } from "../../types";
import { ForkDialog } from "./fork-dialog";

export function ForksPage({ state, onStateChange, goToSettings }: { state: PersistedState; onStateChange: (next: PersistedState) => void; goToSettings: () => void }) {
  const token = state.settings.githubToken.trim();
  const hasGithubCredential = Boolean(token || state.settings.credentialConnected);
  const [source, setSource] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [forks, setForks] = useState<ForkRepository[]>([]);
  const [selected, setSelected] = useState<ForkRepository | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState("");
  const [syncing, setSyncing] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const repositories = useMemo(() => [...state.repositories].sort((a, b) => a.full_name.localeCompare(b.full_name)), [state.repositories]);

  const loadForks = useCallback(async () => {
    if (!hasGithubCredential) return; setLoading(true); setError("");
    try { const next = await fetchForkRepositories(token); setForks(next); setSuccess(`已读取 ${next.length} 个 Fork`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Fork 清单读取失败"); } finally { setLoading(false); }
  }, [hasGithubCredential, token]);
  useEffect(() => { if (hasGithubCredential) void loadForks(); }, [hasGithubCredential, loadForks]);

  async function addJob(job: ForkJob) { try { await runOptimisticMutation(state, { ...state, forkJobs: [job, ...state.forkJobs.filter((item) => item.targetFullName !== job.targetFullName)] }, onStateChange, { operation: "fork.create", payload: { fullName: job.targetFullName, parentFullName: job.sourceFullName, status: job.status } }); setSuccess(`Fork 已提交：${job.targetFullName}`); setSource(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Fork 任务保存失败"); } }
  async function refreshJob(job: ForkJob) {
    if (!hasGithubCredential) return job;
    try {
      const result = await fetchForkStatus(token, job.targetFullName);
      if (result.status === "ready") return { ...job, status: "ready", htmlUrl: result.htmlUrl || job.htmlUrl, updatedAt: new Date().toISOString(), error: "", pollAttempts: 0, nextPollAt: null } as ForkJob;
      const attempts = (job.pollAttempts ?? 0) + 1;
      if (attempts >= 8) return { ...job, status: "failed", updatedAt: new Date().toISOString(), error: "Fork 创建等待超时，可手动重试", pollAttempts: attempts, nextPollAt: null } as ForkJob;
      const delayMs = Math.min(60000, 2000 * (2 ** Math.max(0, attempts - 1)));
      return { ...job, status: "pending", htmlUrl: result.htmlUrl || job.htmlUrl, updatedAt: new Date().toISOString(), error: "", pollAttempts: attempts, nextPollAt: new Date(Date.now() + delayMs).toISOString() } as ForkJob;
    } catch (reason) { return { ...job, status: "failed" as const, updatedAt: new Date().toISOString(), error: reason instanceof Error ? reason.message : "状态读取失败", nextPollAt: null }; }
  }
  const pollPending = useCallback(async () => {
    const now = Date.now();
    const pending = state.forkJobs.filter((job) => job.status === "pending" && (!job.nextPollAt || new Date(job.nextPollAt).getTime() <= now)); if (!hasGithubCredential || !pending.length) return;
    const updates = await Promise.all(pending.map(refreshJob)); const byId = new Map(updates.map((job) => [job.id, job])); const next = state.forkJobs.map((job) => byId.get(job.id) ?? job);
    if (updates.some((job) => job.status === "ready")) void loadForks(); onStateChange({ ...state, forkJobs: next });
  }, [hasGithubCredential, token, state.forkJobs, loadForks]);
  useEffect(() => { if (!state.forkJobs.some((job) => job.status === "pending")) return; const timer = window.setInterval(() => { void pollPending(); }, 1000); return () => window.clearInterval(timer); }, [state.forkJobs, pollPending]);

  async function refreshAllJobs() { if (!hasGithubCredential) return goToSettings(); setLoading(true); setError(""); try { const next: ForkJob[] = []; for (let index = 0; index < state.forkJobs.length; index += 5) next.push(...await Promise.all(state.forkJobs.slice(index, index + 5).map(refreshJob))); onStateChange({ ...state, forkJobs: next }); setSuccess("Fork 创建任务状态已刷新"); await loadForks(); } catch (reason) { setError(reason instanceof Error ? reason.message : "刷新失败"); } finally { setLoading(false); } }
  async function retryJob(job: ForkJob) { const nextJob = { ...job, status: "pending" as const, error: "", pollAttempts: 0, nextPollAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; try { await runOptimisticMutation(state, { ...state, forkJobs: state.forkJobs.map((item) => item.id === job.id ? nextJob : item) }, onStateChange, { operation: "fork.retry", payload: { fullName: job.targetFullName } }); setSuccess(`已重试 ${job.targetFullName}`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Fork 重试失败"); } }

  async function removeJob(job: ForkJob) { try { await runOptimisticMutation(state, { ...state, forkJobs: state.forkJobs.filter((item) => item.id !== job.id) }, onStateChange, { operation: "fork.remove", payload: { fullName: job.targetFullName, status: "deleted" } }); setSuccess(`已移除 ${job.targetFullName}`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Fork 任务移除失败"); } }

  async function inspectFork(fork: ForkRepository) {
    if (!hasGithubCredential) return goToSettings(); setDetailLoading(fork.fullName); setError("");
    try { const detail = await fetchForkDetails(token, fork.fullName); setForks((current) => current.map((item) => item.fullName === detail.fullName ? detail : item)); setSelected(detail); await runOptimisticMutation(state, { ...state, forkReadAt: { ...state.forkReadAt, [detail.fullName]: new Date().toISOString() } }, onStateChange, { operation: "fork.read", payload: { fullName: detail.fullName } }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Fork 详情读取失败"); } finally { setDetailLoading(""); }
  }
  async function syncUpstream(fork: ForkRepository) {
    if (!hasGithubCredential) return goToSettings(); setSyncing(fork.fullName); setError("");
    try { const result = await syncForkUpstream(token, fork.fullName, fork.defaultBranch); setSuccess(result.message || `已同步 ${fork.fullName}`); const detail = await fetchForkDetails(token, fork.fullName); setForks((current) => current.map((item) => item.fullName === detail.fullName ? detail : item)); setSelected(detail); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "上游同步失败"); } finally { setSyncing(""); }
  }

  const filtered = useMemo(() => { const needle = query.trim().toLowerCase(); return forks.filter((fork) => !needle || [fork.fullName, fork.parentFullName, fork.description].filter(Boolean).join(" ").toLowerCase().includes(needle)); }, [forks, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)); const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-xl font-semibold tracking-tight">Fork</h1><p className="mt-1 text-sm text-muted-foreground">完整 Fork 清单、创建任务自动轮询、上游差异、一键同步与最新 Actions 状态。</p></div><div className="flex gap-2"><Button variant="outline" onClick={goToSettings}><RiSettings4Line className="size-4" />GitHub 设置</Button><Button onClick={() => void refreshAllJobs()} loading={loading}><RiRefreshLine className="size-4" />刷新全部</Button></div></header>
      <StatusBanner error={error} success={!error ? success : ""} />
      <div className="mb-5 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3 shadow-card"><Select value={source} onChange={(event) => setSource(event.target.value)} className="min-w-[260px] flex-1"><option value="">选择要 Fork 的 Stars 仓库…</option>{repositories.map((repo) => <option key={repo.full_name} value={repo.full_name}>{repo.full_name}</option>)}</Select><Button disabled={!source} onClick={() => setDialogOpen(true)}><RiAddLine className="size-4" />创建 Fork</Button><div className="relative min-w-[240px] flex-1"><RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索 Fork / 上游仓库" /></div><Select value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="10">10 / 页</option><option value="20">20 / 页</option><option value="50">50 / 页</option></Select></div>

      {state.forkJobs.length ? <section className="mb-5 rounded-xl border border-border bg-card shadow-card"><div className="border-b border-border px-4 py-3 text-sm font-semibold">创建任务</div>{state.forkJobs.map((job, index) => { const Icon = job.status === "ready" ? RiCheckboxCircleLine : job.status === "failed" ? RiCloseCircleLine : RiLoader4Line; return <article key={job.id} className={`grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] ${index ? "border-t border-border" : ""}`}><div className="min-w-0"><div className="flex items-center gap-2"><Icon className={`size-4 ${job.status === "pending" ? "animate-spin text-muted-foreground" : job.status === "ready" ? "text-emerald-600" : "text-destructive"}`} /><span className="truncate text-sm font-medium">{job.targetFullName}</span><Badge>{job.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">来源 {job.sourceFullName} · 更新 {new Date(job.updatedAt).toLocaleString("zh-CN")}{job.status === "pending" ? ` · 第 ${job.pollAttempts ?? 0} 次检查` : ""}</p>{job.error ? <p className="mt-1 text-xs text-destructive-foreground">{job.error}</p> : null}</div><div className="flex items-center gap-1">{job.htmlUrl ? <a href={job.htmlUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><RiExternalLinkLine className="size-4" />目标</Button></a> : null}{job.status === "failed" ? <Button size="sm" variant="outline" onClick={() => { void retryJob(job); }}>重试</Button> : null}<Button size="sm" variant="ghost" onClick={() => { void removeJob(job); }}>移除</Button></div></article>; })}</section> : null}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card"><div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground"><span>我的 Forks · {filtered.length}</span><span>上游 / Actions</span></div>{visible.map((fork, index) => { const readAt = state.forkReadAt[fork.fullName]; const unread = !readAt || new Date(fork.pushedAt).getTime() > new Date(readAt).getTime(); return <article key={fork.fullName} className={`grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto] ${index ? "border-t border-border" : ""}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><RiGitForkLine className="size-4 text-muted-foreground" /><button onClick={() => void inspectFork(fork)} className="truncate text-left text-sm font-semibold hover:underline">{fork.fullName}</button>{unread ? <Badge>unread</Badge> : null}{fork.behindBy != null && fork.behindBy > 0 ? <Badge>{fork.behindBy} behind</Badge> : null}</div><p className="mt-1 truncate text-xs text-muted-foreground">{fork.parentFullName ? `上游 ${fork.parentFullName}` : "上游信息待加载"} · pushed {new Date(fork.pushedAt).toLocaleString("zh-CN")}</p>{fork.latestWorkflow ? <p className="mt-1 text-xs text-muted-foreground">Actions: {fork.latestWorkflow.name} · {fork.latestWorkflow.conclusion || fork.latestWorkflow.status}</p> : null}</div><div className="flex flex-wrap items-center justify-end gap-1"><Button size="sm" variant="outline" loading={detailLoading === fork.fullName} onClick={() => void inspectFork(fork)}>检查</Button>{fork.behindBy != null && fork.behindBy > 0 ? <Button size="sm" loading={syncing === fork.fullName} onClick={() => void syncUpstream(fork)}>同步上游</Button> : null}<a href={fork.htmlUrl} target="_blank" rel="noreferrer"><Button variant="ghost" size="icon-sm"><RiExternalLinkLine className="size-4" /></Button></a></div></article>; })}{!visible.length ? <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">{loading ? "正在读取 Fork 清单…" : "没有匹配的 Fork"}</div> : null}</section>
      {filtered.length > pageSize ? <div className="mt-5 flex items-center justify-center gap-3"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</Button><span className="text-xs text-muted-foreground">{page}/{totalPages}</span><Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>下一页</Button></div> : null}

      <ForkDialog open={dialogOpen} token={state.settings.githubToken} credentialConnected={state.settings.credentialConnected} sourceFullName={source} onClose={() => setDialogOpen(false)} onCreated={(job) => { void addJob(job); }} />
      <Modal open={Boolean(selected)} title={selected?.fullName || "Fork 详情"} description={selected?.parentFullName ? `上游 ${selected.parentFullName}` : "Fork 详情"} onClose={() => setSelected(null)}><div className="grid gap-4">{selected ? <><div className="grid grid-cols-3 gap-2"><div className="rounded-lg bg-secondary/50 p-3 text-xs"><div className="text-muted-foreground">Ahead</div><div className="mt-1 text-lg font-semibold">{selected.aheadBy ?? "—"}</div></div><div className="rounded-lg bg-secondary/50 p-3 text-xs"><div className="text-muted-foreground">Behind</div><div className="mt-1 text-lg font-semibold">{selected.behindBy ?? "—"}</div></div><div className="rounded-lg bg-secondary/50 p-3 text-xs"><div className="text-muted-foreground">Compare</div><div className="mt-1 truncate text-sm font-semibold">{selected.compareStatus}</div></div></div>{selected.latestWorkflow ? <div className="rounded-xl border border-border p-3"><div className="text-xs text-muted-foreground">最新 Actions</div><div className="mt-1 flex items-center justify-between gap-3 text-sm"><span>{selected.latestWorkflow.name} · {selected.latestWorkflow.conclusion || selected.latestWorkflow.status}</span><a href={selected.latestWorkflow.htmlUrl} target="_blank" rel="noreferrer" className="text-xs hover:underline">查看</a></div></div> : <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">暂无 Actions 运行记录或 Token 无 Actions 读取权限。</div>}<div className="flex gap-2">{(selected.behindBy ?? 0) > 0 ? <Button loading={syncing === selected.fullName} onClick={() => void syncUpstream(selected)}>同步上游</Button> : <Button variant="secondary" disabled>无需同步</Button>}<a href={selected.htmlUrl} target="_blank" rel="noreferrer"><Button variant="outline"><RiExternalLinkLine className="size-4" />GitHub</Button></a></div></> : null}</div></Modal>
    </div>
  );
}
