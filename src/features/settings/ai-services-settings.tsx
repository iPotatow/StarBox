import { ArrowsClockwise as RefreshCwIcon, CaretDown as ChevronDownIcon, Check as CheckIcon, Eye as EyeIcon, EyeSlash as EyeOffIcon, Key as KeyIcon, Plus as PlusIcon, X as XIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { CardFrame, CardFrameAction, CardFrameDescription, CardFrameHeader, CardFrameTitle } from "../../components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "../../components/ui/empty";
import { HoldToConfirmButton } from "../../components/spectrumui/hold-to-confirm";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../../components/ui/collapsible";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { ResponsiveDialog } from "../../components/ui/responsive-dialog";
import { Select } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { notify } from "../../components/ui/toast";
import { addAiModel, deleteAiModel, deleteAiService, fetchAiServices, fetchCodexDesktopPreset, setDefaultAiModel, testAiService } from "../../lib/api";
import { asRuntimeAiServices, createRuntimeAiService, fetchWorkersAiUsage, updateRuntimeAiService, type AiServiceTransport, type RuntimeAiService, type RuntimeAiServicesState, type WorkersAiUsage } from "../../lib/workers-ai-api";
import { useI18n } from "../../lib/i18n";
import type { AiProtocol, AiServicesState } from "../../types";

type HeaderRow = { id: string; name: string; value: string };
const headerRow = (name = "", value = ""): HeaderRow => ({ id: crypto.randomUUID(), name, value });

type ServiceDraft = {
  name: string;
  transport: AiServiceTransport;
  protocol: AiProtocol;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  modelName: string;
  headers: HeaderRow[];
  headerPreset: RuntimeAiService["headerPreset"];
  gatewayId: string;
};

const workersDraft = (): ServiceDraft => ({ name: "Cloudflare Workers AI", transport: "workers-ai", protocol: "openai-compatible", baseUrl: "", apiKey: "", modelId: "@cf/zai-org/glm-4.7-flash", modelName: "GLM-4.7-Flash", headers: [], headerPreset: null, gatewayId: "default" });
const httpDraft = (): ServiceDraft => ({ name: "", transport: "http", protocol: "openai-compatible", baseUrl: "", apiKey: "", modelId: "", modelName: "", headers: [], headerPreset: null, gatewayId: "default" });

const protocolLabels: Record<AiProtocol, { zh: string; en: string; tw: string }> = {
  "openai-compatible": { zh: "OpenAI 兼容协议", en: "OpenAI Compatible", tw: "OpenAI 相容協定" },
  "anthropic-messages": { zh: "Anthropic Messages", en: "Anthropic Messages", tw: "Anthropic Messages" },
  "google-gemini": { zh: "Google Gemini", en: "Google Gemini", tw: "Google Gemini" },
};

function hostname(url: string) { try { return new URL(url).hostname; } catch { return url; } }
function parseHeaders(rows: HeaderRow[]): { headers: Record<string, string>; error: "" | "name" | "duplicate" | "value" } {
  const entries: Array<[string, string]> = [];
  const names = new Set<string>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name && !row.value.trim()) continue;
    if (!name || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) return { headers: {}, error: "name" };
    if (names.has(name.toLowerCase())) return { headers: {}, error: "duplicate" };
    if (/[\r\n]/.test(row.value)) return { headers: {}, error: "value" };
    names.add(name.toLowerCase());
    entries.push([name, row.value]);
  }
  return { headers: Object.fromEntries(entries), error: "" };
}

function runtimeOf(service: RuntimeAiService): AiServiceTransport { return service.transport === "workers-ai" ? "workers-ai" : "http"; }
function formatNumber(value: number, maximumFractionDigits = 0) { return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value); }

export function AiServicesSettings({ onRegistryChange }: { onRegistryChange: (services: AiServicesState) => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<RuntimeAiServicesState>({ defaultModelId: null, services: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [usage, setUsage] = useState<WorkersAiUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [serviceModal, setServiceModal] = useState<"create" | "edit" | null>(null);
  const [editingService, setEditingService] = useState<RuntimeAiService | null>(null);
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>(workersDraft);
  const [showKey, setShowKey] = useState(false);
  const [replaceHeaders, setReplaceHeaders] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const presetRequest = useRef<AbortController | null>(null);
  useEffect(() => { setPresetLoading(false); return () => { presetRequest.current?.abort(); }; }, [serviceModal]);
  const [modelService, setModelService] = useState<RuntimeAiService | null>(null);
  const [modelId, setModelId] = useState("");
  const [modelName, setModelName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: "service"; service: RuntimeAiService } | { type: "model"; service: RuntimeAiService; modelId: string; modelName: string } | null>(null);

  function applyRegistry(next: RuntimeAiServicesState | AiServicesState) {
    const runtime = asRuntimeAiServices(next as AiServicesState);
    setData(runtime);
    onRegistryChange(runtime as AiServicesState);
  }

  async function load() {
    setLoading(true); setError("");
    try {
      const next = asRuntimeAiServices(await fetchAiServices());
      setData(next);
      if (next.services.length) onRegistryChange(next as AiServicesState);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("AI 服务读取失败", "Failed to load AI services", "AI 服務讀取失敗")); }
    finally { setLoading(false); }
  }

  async function loadUsage() {
    setUsageLoading(true);
    try { setUsage(await fetchWorkersAiUsage()); }
    catch { setUsage(null); }
    finally { setUsageLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  const hasWorkersAi = data.services.some((service) => runtimeOf(service) === "workers-ai");
  useEffect(() => {
    if (!hasWorkersAi) { setUsage(null); return; }
    void loadUsage();
    const timer = window.setInterval(() => { void loadUsage(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [hasWorkersAi]);

  const availableModels = useMemo(() => data.services.filter((service) => service.enabled).flatMap((service) => service.models.filter((model) => model.enabled).map((model) => ({ service, model }))), [data.services]);
  const defaultOption = availableModels.find((item) => item.model.id === data.defaultModelId);
  const headersResult = useMemo(() => parseHeaders(serviceDraft.headers), [serviceDraft.headers]);
  const headersError = headersResult.error === "name" ? t("请填写有效的请求头名称", "Enter a valid header name", "請填寫有效的請求頭名稱") : headersResult.error === "duplicate" ? t("请求头名称不能重复（不区分大小写）", "Header names must be unique (case-insensitive)", "請求頭名稱不能重複（不區分大小寫）") : headersResult.error === "value" ? t("请求头值不能包含换行", "Header values cannot contain line breaks", "請求頭值不能包含換行") : "";
  const invalidWorkersModel = serviceDraft.transport === "workers-ai" && serviceDraft.modelId.trim() && !serviceDraft.modelId.trim().startsWith("@cf/");
  const canSaveService = Boolean(serviceDraft.name.trim()) && !presetLoading && !invalidWorkersModel && (
    serviceDraft.transport === "workers-ai"
      ? Boolean(serviceDraft.gatewayId.trim())
      : Boolean(serviceDraft.baseUrl.trim()) && (serviceModal === "edit" || Boolean(serviceDraft.apiKey.trim())) && !(replaceHeaders && headersError)
  );

  function taskError(title: string, reason: unknown, fallback = "") {
    const detail = reason instanceof Error ? reason.message : fallback;
    setError(detail ? `${title}：${detail}` : title);
  }

  function openCreate() { setError(""); setEditingService(null); setServiceDraft(workersDraft()); setReplaceHeaders(true); setShowKey(false); setServiceModal("create"); }
  function openEdit(service: RuntimeAiService) {
    const serviceRuntime = runtimeOf(service);
    setError(""); setEditingService(service);
    setServiceDraft({ name: service.name, transport: serviceRuntime, protocol: service.protocol, baseUrl: service.baseUrl, apiKey: "", modelId: "", modelName: "", headers: [], headerPreset: service.headerPreset ?? null, gatewayId: service.gatewayId || "default" });
    setReplaceHeaders(false); setShowKey(false); setServiceModal("edit");
  }

  function changeTransport(next: AiServiceTransport) {
    setReplaceHeaders(next === "http");
    setServiceDraft((current) => next === "workers-ai"
      ? { ...workersDraft(), name: current.name.trim() && current.name !== "Custom HTTP" ? current.name : "Cloudflare Workers AI" }
      : { ...httpDraft(), name: current.name === "Cloudflare Workers AI" ? "" : current.name });
  }

  async function applyDesktopPreset() {
    presetRequest.current?.abort();
    const controller = new AbortController();
    presetRequest.current = controller;
    setPresetLoading(true);
    try {
      const preset = await fetchCodexDesktopPreset(controller.signal);
      if (controller.signal.aborted) return;
      setReplaceHeaders(true);
      setServiceDraft((current) => ({ ...current, headerPreset: "codex-desktop-latest", headers: Object.entries(preset.headers).map(([name, value]) => headerRow(name, value)) }));
      if (preset.stale) notify(t("官方版本暂未刷新", "Official version could not be refreshed", "官方版本暫未重新整理"), t("暂时使用上次成功获取的版本，后续请求会继续自动检查。", "Using the last verified version; later requests will check again.", "暫時使用上次成功取得的版本，後續請求會繼續自動檢查。"), "warning");
    } catch (reason) {
      if (!controller.signal.aborted) notify(t("Codex Desktop 预设获取失败", "Failed to fetch Codex Desktop preset", "Codex Desktop 預設取得失敗"), reason instanceof Error ? reason.message : "", "error");
    } finally {
      if (presetRequest.current === controller) { presetRequest.current = null; setPresetLoading(false); }
    }
  }

  function applyCliPreset() {
    setReplaceHeaders(true);
    setServiceDraft((current) => ({ ...current, headerPreset: "codex-cli", headers: [headerRow("originator", "codex_cli_rs")] }));
  }

  async function saveService() {
    if (!canSaveService) return;
    setBusy("save-service"); setError("");
    try {
      const common = { name: serviceDraft.name.trim(), transport: serviceDraft.transport, gatewayId: serviceDraft.gatewayId.trim() || "default" } as const;
      const next = serviceModal === "edit" && editingService
        ? await updateRuntimeAiService(editingService.id, serviceDraft.transport === "workers-ai" ? common : { ...common, protocol: serviceDraft.protocol, baseUrl: serviceDraft.baseUrl.trim(), ...(serviceDraft.apiKey.trim() ? { apiKey: serviceDraft.apiKey.trim() } : {}), ...(replaceHeaders ? { headers: headersResult.headers, headerPreset: serviceDraft.headerPreset ?? null } : {}) })
        : await createRuntimeAiService(serviceDraft.transport === "workers-ai"
          ? { ...common, modelId: serviceDraft.modelId.trim() || undefined, modelName: serviceDraft.modelName.trim() || undefined }
          : { ...common, protocol: serviceDraft.protocol, baseUrl: serviceDraft.baseUrl.trim(), apiKey: serviceDraft.apiKey.trim(), headers: headersResult.headers, headerPreset: serviceDraft.headerPreset ?? null, modelId: serviceDraft.modelId.trim() || undefined, modelName: serviceDraft.modelName.trim() || undefined });
      applyRegistry(next); setServiceModal(null);
      notify(serviceModal === "edit" ? t("模型服务已更新", "Model service updated", "模型服務已更新") : t("模型服务已添加", "Model service added", "模型服務已新增"), serviceDraft.name.trim(), "success");
      if (serviceDraft.transport === "workers-ai") void loadUsage();
    } catch (reason) { taskError(t("模型服务保存失败", "Failed to save model service", "模型服務儲存失敗"), reason, t("请稍后重试", "Try again later", "請稍後重試")); }
    finally { setBusy(""); }
  }

  async function toggleService(service: RuntimeAiService, enabled: boolean) {
    setBusy(`service:${service.id}`); setError("");
    try { applyRegistry(await updateRuntimeAiService(service.id, { enabled })); }
    catch (reason) { taskError(t("服务状态更新失败", "Failed to update service status", "服務狀態更新失敗"), reason, service.name); }
    finally { setBusy(""); }
  }

  async function test(service: RuntimeAiService) {
    setBusy(`test:${service.id}`); setError("");
    try { const message = await testAiService(service.id, data.defaultModelId && service.models.some((model) => model.id === data.defaultModelId) ? data.defaultModelId : undefined); notify(t("连接测试通过", "Connection test passed", "連線測試通過"), message, "success"); if (runtimeOf(service) === "workers-ai") void loadUsage(); }
    catch (reason) { taskError(t("连接测试失败", "Connection test failed", "連線測試失敗"), reason, service.name); }
    finally { setBusy(""); }
  }

  async function addModel() {
    if (!modelService || !modelId.trim() || (runtimeOf(modelService) === "workers-ai" && !modelId.trim().startsWith("@cf/"))) return;
    setBusy("add-model"); setError("");
    try { applyRegistry(await addAiModel(modelService.id, modelId.trim(), modelName.trim())); setModelService(null); setModelId(""); setModelName(""); notify(t("模型已添加", "Model added", "模型已新增"), modelName.trim() || modelId.trim(), "success"); }
    catch (reason) { taskError(t("模型添加失败", "Failed to add model", "模型新增失敗"), reason, modelId.trim()); }
    finally { setBusy(""); }
  }

  async function setDefault(modelIdValue: string) {
    if (!modelIdValue) return;
    setBusy(`default:${modelIdValue}`); setError("");
    try { applyRegistry(await setDefaultAiModel(modelIdValue)); notify(t("默认模型已更新", "Default model updated", "預設模型已更新"), "", "success"); }
    catch (reason) { taskError(t("默认模型更新失败", "Failed to update default model", "預設模型更新失敗"), reason, modelIdValue); }
    finally { setBusy(""); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy("delete"); setError("");
    try {
      applyRegistry(deleteTarget.type === "service" ? await deleteAiService(deleteTarget.service.id) : await deleteAiModel(deleteTarget.service.id, deleteTarget.modelId));
      notify(deleteTarget.type === "service" ? t("模型服务已删除", "Model service deleted", "模型服務已刪除") : t("模型已删除", "Model deleted", "模型已刪除"), "", "success");
      setDeleteTarget(null);
    } catch (reason) { taskError(t("删除失败", "Delete failed", "刪除失敗"), reason, t("请稍后重试", "Try again later", "請稍後重試")); return false; }
    finally { setBusy(""); }
  }

  const usageMessage = usage?.error === "analytics_not_configured"
    ? t("Workers AI 可直接使用；配置 CLOUDFLARE_ACCOUNT_ID 与具有 Account Analytics Read 权限的 CLOUDFLARE_API_TOKEN 后，可显示 Cloudflare 官方今日免费额度用量。", "Workers AI is ready. Configure CLOUDFLARE_ACCOUNT_ID and a CLOUDFLARE_API_TOKEN with Account Analytics Read permission to show official daily free-allocation usage.", "Workers AI 可直接使用；設定 CLOUDFLARE_ACCOUNT_ID 與具有 Account Analytics Read 權限的 CLOUDFLARE_API_TOKEN 後，可顯示 Cloudflare 官方今日免費額度用量。")
    : usage?.error === "analytics_permission_denied"
      ? t("Cloudflare Analytics Token 权限不足，请授予 Account > Account Analytics > Read。", "The Cloudflare Analytics token lacks permission. Grant Account > Account Analytics > Read.", "Cloudflare Analytics Token 權限不足，請授予 Account > Account Analytics > Read。")
      : t("暂时无法读取 Cloudflare Workers AI 官方用量。", "Cloudflare Workers AI official usage is temporarily unavailable.", "暫時無法讀取 Cloudflare Workers AI 官方用量。");

  return (
    <div className="grid gap-5">
      {hasWorkersAi ? (
        <CardFrame>
          <CardFrameHeader>
            <CardFrameTitle>{t("Workers AI 今日免费额度", "Workers AI daily free allocation", "Workers AI 今日免費額度")}</CardFrameTitle>
            <CardFrameDescription>{t("来自 Cloudflare Analytics 的账号级累计用量，包含此账号下所有 Workers AI 调用。", "Account-level cumulative usage from Cloudflare Analytics, including all Workers AI calls in this account.", "來自 Cloudflare Analytics 的帳號級累計用量，包含此帳號下所有 Workers AI 呼叫。")}</CardFrameDescription>
            <CardFrameAction><Button variant="ghost" size="sm" loading={usageLoading} onClick={() => void loadUsage()}><RefreshCwIcon className="size-4" aria-hidden="true" />{t("刷新", "Refresh", "重新整理")}</Button></CardFrameAction>
          </CardFrameHeader>
          <div className="relative grid gap-4 px-6 pb-6">
            {usage?.available ? <>
              <div className="grid gap-2">
                <div className="flex items-baseline justify-between gap-3"><span className="text-sm font-medium">{formatNumber(usage.freeUsedNeurons, 1)} / {formatNumber(usage.freeAllocation)} Neurons</span><span className="text-sm text-muted-foreground">{formatNumber(usage.usagePercent, 1)}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usage.usagePercent)} aria-label={t("Workers AI 今日免费额度使用率", "Workers AI daily free allocation usage", "Workers AI 今日免費額度使用率")}><div className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${Math.min(100, usage.usagePercent)}%` }} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">{t("免费额度剩余", "Free remaining", "免費額度剩餘")}</p><p className="mt-1 text-sm font-medium tabular-nums">{formatNumber(usage.remainingNeurons, 1)}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("今日总用量", "Total today", "今日總用量")}</p><p className="mt-1 text-sm font-medium tabular-nums">{formatNumber(usage.usedNeurons, 1)}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("超出免费额度", "Above free allocation", "超出免費額度")}</p><p className="mt-1 text-sm font-medium tabular-nums">{formatNumber(usage.overageNeurons, 1)}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("今日调用", "Inferences", "今日呼叫")}</p><p className="mt-1 text-sm font-medium tabular-nums">{formatNumber(usage.inferences)}</p></div>
                <div><p className="text-xs text-muted-foreground">Input tokens</p><p className="mt-1 text-sm font-medium tabular-nums">{formatNumber(usage.inputTokens)}</p></div>
                <div><p className="text-xs text-muted-foreground">Output tokens</p><p className="mt-1 text-sm font-medium tabular-nums">{formatNumber(usage.outputTokens)}</p></div>
              </div>
              {usage.overageNeurons > 0 ? <Alert variant="warning"><AlertDescription>{t("已超出每日免费额度。Workers Paid 账户可继续按量计费；Workers Free 账户达到限额后会停止推理。Analytics Token 不提供当前套餐信息。", "The daily free allocation has been exceeded. Workers Paid accounts can continue with usage-based billing; Workers Free accounts stop inference at the limit. The Analytics token does not expose the current plan.", "已超出每日免費額度。Workers Paid 帳戶可繼續按量計費；Workers Free 帳戶達到限額後會停止推理。Analytics Token 不提供目前方案資訊。")}</AlertDescription></Alert> : null}
              <p className="text-xs text-muted-foreground">{t("重置时间", "Resets", "重置時間")} · {new Date(usage.resetAt).toLocaleString()}</p>
            </> : <Alert variant="info"><AlertDescription>{usageMessage}</AlertDescription></Alert>}
          </div>
        </CardFrame>
      ) : null}

      <CardFrame>
        <CardFrameHeader>
          <CardFrameTitle>{t("默认模型", "Default model", "預設模型")}</CardFrameTitle>
          <CardFrameDescription>{t("仓库 AI 分析和 Release 总结默认使用此模型。", "Repository analysis and Release summaries use this model by default.", "儲存庫 AI 分析和 Release 總結預設使用此模型。")}</CardFrameDescription>
        </CardFrameHeader>
        <div className="relative px-6 pb-6"><Select aria-label={t("默认模型", "Default model", "預設模型")} value={data.defaultModelId || ""} disabled={loading || !availableModels.length} onValueChange={(value) => void setDefault(value)} items={[{ value: "", label: loading ? t("正在加载…", "Loading…", "正在載入…") : t("选择默认模型", "Choose default model", "選擇預設模型"), disabled: true }, ...availableModels.map(({ service, model }) => ({ value: String(model.id), label: <>{model.displayName || model.remoteModelId} · {service.name}</> }))]} />{defaultOption ? <p className="mt-2 text-xs text-muted-foreground">{t("当前", "Current", "當前")}: {defaultOption.model.displayName || defaultOption.model.remoteModelId} · {defaultOption.service.name}</p> : null}</div>
      </CardFrame>

      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">{t("模型服务", "Model services", "模型服務")} <span className="ml-1 text-muted-foreground">{data.services.length}</span></p><p className="mt-1 text-xs text-muted-foreground">{t("Workers AI 无需 API Key；HTTP 服务的 API Key 由 Worker 加密保存。", "Workers AI needs no API key; HTTP service API keys are encrypted by the Worker.", "Workers AI 無需 API Key；HTTP 服務的 API Key 由 Worker 加密儲存。")}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void load()} loading={loading}><RefreshCwIcon className="size-4" aria-hidden="true" />{t("刷新", "Refresh", "重新整理")}</Button><Button size="sm" onClick={openCreate}><PlusIcon className="size-4" aria-hidden="true" />{t("添加模型服务", "Add model service", "新增模型服務")}</Button></div></div>
      {error ? <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {!loading && !data.services.length ? <Empty><EmptyContent><EmptyTitle>{t("还没有模型服务", "No model services yet", "還沒有模型服務")}</EmptyTitle><EmptyDescription>{t("推荐直接添加 Cloudflare Workers AI：无需 API Key，即可使用仓库分析和 Release 总结。", "Start with Cloudflare Workers AI: no API key required for repository analysis and Release summaries.", "建議直接新增 Cloudflare Workers AI：無需 API Key，即可使用儲存庫分析和 Release 總結。")}</EmptyDescription><Button className="mt-4" size="sm" onClick={openCreate}><PlusIcon className="size-4" aria-hidden="true" />{t("添加模型服务", "Add model service", "新增模型服務")}</Button></EmptyContent></Empty> : null}

      <div className="grid gap-3">
        {data.services.map((service) => {
          const runtime = runtimeOf(service);
          return <CardFrame key={service.id}>
            <CardFrameHeader>
              <CardFrameTitle><span className="flex flex-wrap items-center gap-2">{service.name}<Badge variant="secondary" size="sm">{runtime === "workers-ai" ? "Workers AI" : t(protocolLabels[service.protocol].zh, protocolLabels[service.protocol].en, protocolLabels[service.protocol].tw)}</Badge>{runtime === "workers-ai" ? <Badge variant="success" size="sm">{t("无需凭据", "No credential", "無需憑據")}</Badge> : service.credentialConfigured ? <Badge variant="success" size="sm">{t("凭据已配置", "Credential set", "憑據已配置")}</Badge> : <Badge variant="warning" size="sm">{t("缺少凭据", "Credential missing", "缺少憑據")}</Badge>}</span></CardFrameTitle>
              <CardFrameDescription>{runtime === "workers-ai" ? `AI binding · Gateway ${service.gatewayId || "default"}` : hostname(service.baseUrl)}</CardFrameDescription>
              <CardFrameAction><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{service.enabled ? t("已启用", "Enabled", "已啟用") : t("已停用", "Disabled", "已停用")}</span><Switch checked={service.enabled} disabled={busy === `service:${service.id}`} onCheckedChange={(checked) => void toggleService(service, checked)} aria-label={t("启用模型服务", "Enable model service", "啟用模型服務")} /></div></CardFrameAction>
            </CardFrameHeader>
            <div className="relative grid gap-4 px-6 pb-5">
              <div className="flex flex-wrap gap-2">
                {service.models.length ? service.models.map((model) => {
                  const isDefault = model.id === data.defaultModelId;
                  return <div key={model.id} className={`inline-flex items-center gap-1 rounded-lg border p-1 text-xs ${isDefault ? "border-primary/40 bg-primary/5" : "border-border/70 bg-secondary/30"}`}><Button variant="link" size="xs" className="px-1.5 text-xs font-medium" disabled={!service.enabled || !model.enabled || isDefault} onClick={() => void setDefault(model.id)}>{model.displayName || model.remoteModelId}</Button>{isDefault ? <Badge size="sm" variant="success"><CheckIcon className="size-3" aria-hidden="true" />{t("默认", "Default", "預設")}</Badge> : null}<Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive-foreground" aria-label={t("删除模型", "Delete model", "刪除模型")} onClick={() => setDeleteTarget({ type: "model", service, modelId: model.id, modelName: model.displayName || model.remoteModelId })}><XIcon className="size-3.5" aria-hidden="true" /></Button></div>;
                }) : <p className="text-xs text-muted-foreground">{t("暂无模型。添加一个模型 ID 后即可使用。", "No models yet. Add a model ID to use this service.", "暫無模型。新增一個模型 ID 後即可使用。")}</p>}
              </div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { setModelService(service); setModelId(runtime === "workers-ai" ? "@cf/" : ""); setModelName(""); }}><PlusIcon className="size-4" aria-hidden="true" />{t("添加模型", "Add model", "新增模型")}</Button><Button variant="ghost" size="sm" onClick={() => void test(service)} loading={busy === `test:${service.id}`}><KeyIcon className="size-4" aria-hidden="true" />{t("测试", "Test", "測試")}</Button><Button variant="ghost" size="sm" onClick={() => openEdit(service)}>{t("编辑", "Edit", "編輯")}</Button><Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ type: "service", service })}>{t("删除", "Delete", "刪除")}</Button></div>
            </div>
          </CardFrame>;
        })}
      </div>

      <Alert variant="info"><AlertDescription>{t("Workers AI 通过 Cloudflare AI binding 调用，并默认经过 AI Gateway `default`；其他 HTTP Provider 保持原有加密凭据与协议适配。", "Workers AI uses the Cloudflare AI binding and defaults to AI Gateway `default`; existing HTTP providers keep encrypted credentials and protocol adapters.", "Workers AI 透過 Cloudflare AI binding 呼叫，並預設經過 AI Gateway `default`；其他 HTTP Provider 保持原有加密憑據與協議適配。")}</AlertDescription></Alert>

      <ResponsiveDialog
        open={Boolean(serviceModal)}
        title={serviceModal === "edit" ? t("编辑模型服务", "Edit model service", "編輯模型服務") : t("添加模型服务", "Add model service", "新增模型服務")}
        description={serviceDraft.transport === "workers-ai" ? t("Workers AI 使用当前 Cloudflare 账号的 AI binding，不需要保存 API Key。", "Workers AI uses this Cloudflare account's AI binding and stores no API key.", "Workers AI 使用目前 Cloudflare 帳號的 AI binding，不需要儲存 API Key。") : t("HTTP Provider 凭据会在 Worker 端加密保存，不会从安全读取接口回显。", "HTTP provider credentials are encrypted by the Worker and are never returned by safe read APIs.", "HTTP Provider 憑據會在 Worker 端加密儲存，不會從安全讀取介面回顯。")}
        onClose={() => setServiceModal(null)}
        className="sm:max-w-xl"
        footer={<><Button variant="ghost" onClick={() => setServiceModal(null)}>{t("取消", "Cancel", "取消")}</Button><Button loading={busy === "save-service"} disabled={!canSaveService} onClick={() => void saveService()}>{serviceModal === "edit" ? t("保存", "Save", "儲存") : t("添加服务", "Add service", "新增服務")}</Button></>}
      >
        <div className="grid gap-4">
          {error ? <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2"><Field label={t("服务类型", "Service type", "服務類型")}><Select value={serviceDraft.transport} disabled={serviceModal === "edit"} onValueChange={(value) => changeTransport(value as AiServiceTransport)} items={[{ value: "workers-ai", label: "Cloudflare Workers AI" }, { value: "http", label: t("HTTP API 服务", "HTTP API service", "HTTP API 服務") }]} /></Field><Field label={t("服务名称", "Service name", "服務名稱")}><Input type="text" value={serviceDraft.name} onChange={(event) => setServiceDraft((current) => ({ ...current, name: event.target.value }))} /></Field></div>
          {serviceDraft.transport === "workers-ai" ? <>
            <Field label="AI Gateway" description={t("默认使用 `default` Gateway，可在 Cloudflare AI Gateway 中查看日志与分析。", "Defaults to the `default` Gateway for Cloudflare AI Gateway logs and analytics.", "預設使用 `default` Gateway，可在 Cloudflare AI Gateway 中查看日誌與分析。")}><Input type="text" value={serviceDraft.gatewayId} onChange={(event) => setServiceDraft((current) => ({ ...current, gatewayId: event.target.value }))} /></Field>
            {serviceModal === "create" ? <div className="grid gap-4 sm:grid-cols-2"><Field label={t("首个 Workers AI 模型", "First Workers AI model", "首個 Workers AI 模型")} description={invalidWorkersModel ? t("模型 ID 必须以 @cf/ 开头", "Model IDs must start with @cf/", "模型 ID 必須以 @cf/ 開頭") : undefined}><Input type="text" placeholder="@cf/zai-org/glm-4.7-flash" value={serviceDraft.modelId} onChange={(event) => setServiceDraft((current) => ({ ...current, modelId: event.target.value }))} /></Field><Field label={t("显示名称（可选）", "Display name (optional)", "顯示名稱（可選）")}><Input type="text" value={serviceDraft.modelName} onChange={(event) => setServiceDraft((current) => ({ ...current, modelName: event.target.value }))} /></Field></div> : null}
            <Alert variant="info"><AlertDescription>{t("官方免费额度面板是可选增强：推理本身只需要 AI binding；用量查询额外需要 Account Analytics Read Token。", "The official free-allocation panel is optional: inference only needs the AI binding; usage queries additionally need an Account Analytics Read token.", "官方免費額度面板是可選增強：推理本身只需要 AI binding；用量查詢額外需要 Account Analytics Read Token。")}</AlertDescription></Alert>
          </> : <>
            <Field label={t("API 协议", "API protocol", "API 協議")}><Select value={serviceDraft.protocol} onValueChange={(value) => setServiceDraft((current) => ({ ...current, protocol: value as AiProtocol }))} items={[{ value: "openai-compatible", label: "OpenAI Compatible" }, { value: "anthropic-messages", label: "Anthropic Messages" }, { value: "google-gemini", label: "Google Gemini" }]} /></Field>
            <Field label="Base URL"><Input type="text" inputMode="url" placeholder={serviceDraft.protocol === "anthropic-messages" ? "https://api.anthropic.com" : serviceDraft.protocol === "google-gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1"} value={serviceDraft.baseUrl} onChange={(event) => setServiceDraft((current) => ({ ...current, baseUrl: event.target.value }))} /></Field>
            <Field label="API Key" description={serviceModal === "edit" && editingService?.credentialConfigured ? t("已保存；留空保持现有凭据。", "Already saved; leave blank to keep the existing credential.", "已儲存；留空保持現有憑據。") : undefined}><InputGroup><InputGroupInput type={showKey ? "text" : "password"} autoComplete="off" value={serviceDraft.apiKey} onChange={(event) => setServiceDraft((current) => ({ ...current, apiKey: event.target.value }))} /><InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? t("隐藏 API Key", "Hide API Key", "隱藏 API Key") : t("显示 API Key", "Show API Key", "顯示 API Key")}>{showKey ? <EyeOffIcon className="size-4" aria-hidden="true" /> : <EyeIcon className="size-4" aria-hidden="true" />}</Button></InputGroupAddon></InputGroup></Field>
            {serviceModal === "create" ? <div className="grid gap-4 sm:grid-cols-2"><Field label={t("首个模型 ID（可选）", "First model ID (optional)", "首個模型 ID（可選）")}><Input type="text" placeholder="gpt-5.4" value={serviceDraft.modelId} onChange={(event) => setServiceDraft((current) => ({ ...current, modelId: event.target.value }))} /></Field><Field label={t("显示名称（可选）", "Display name (optional)", "顯示名稱（可選）")}><Input type="text" value={serviceDraft.modelName} onChange={(event) => setServiceDraft((current) => ({ ...current, modelName: event.target.value }))} /></Field></div> : null}
            <Collapsible className="rounded-xl border border-border/70"><CollapsibleTrigger render={<Button type="button" variant="ghost" className="h-auto w-full justify-between rounded-xl px-4 py-3 text-sm font-medium" />}>{t("高级设置", "Advanced settings", "進階設定")}<ChevronDownIcon className="size-4" aria-hidden="true" /></CollapsibleTrigger><CollapsiblePanel><div className="grid gap-3 px-4 pb-4 pt-1">{serviceModal === "edit" ? <p className="text-xs leading-5 text-muted-foreground">{t("已保存的请求头不会回显。不修改则保留现有请求头；新增、修改或删除请求头后，保存时会替换现有请求头。", "Saved headers are not echoed back. Leave them untouched to keep the current headers; adding, editing, or removing headers replaces them on save.", "已儲存的請求頭不會回顯。不修改則保留現有請求頭；新增、修改或刪除請求頭後，儲存時會替換現有請求頭。")}</p> : null}<div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("请求头预设", "Header presets", "請求頭預設")}><span className="text-xs text-muted-foreground">{t("请求头预设", "Header presets", "請求頭預設")}</span><Button type="button" variant="outline" size="xs" loading={presetLoading} onClick={() => void applyDesktopPreset()}>Codex Desktop</Button><Button type="button" variant="outline" size="xs" disabled={presetLoading} onClick={applyCliPreset}>Codex CLI</Button>{serviceModal === "edit" ? <Button type="button" variant="ghost" size="xs" disabled={presetLoading} onClick={() => { setReplaceHeaders(true); setServiceDraft((current) => ({ ...current, headerPreset: null, headers: [] })); }}>{t("清空请求头", "Clear headers", "清空請求頭")}</Button> : null}</div><div className="grid gap-2" role="group" aria-label={t("自定义请求头", "Custom headers", "自定義請求頭")}><p className="text-sm font-medium">{t("自定义请求头", "Custom headers", "自定義請求頭")}</p><div className="overflow-hidden rounded-xl border border-border/70">{serviceDraft.headers.map((row, index) => <div key={row.id} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] items-center gap-2 border-b border-border/70 p-2"><Input type="text" disabled={presetLoading} aria-label={t(`请求头名称 ${index + 1}`, `Header name ${index + 1}`, `請求頭名稱 ${index + 1}`)} placeholder={t("名称", "Name", "名稱")} className="min-w-0 font-mono text-xs" autoComplete="off" spellCheck={false} value={row.name} onChange={(event) => { setReplaceHeaders(true); setServiceDraft((current) => ({ ...current, headerPreset: null, headers: current.headers.map((item) => item.id === row.id ? { ...item, name: event.target.value } : item) })); }} /><Input type="text" disabled={presetLoading} aria-label={t(`请求头值 ${index + 1}`, `Header value ${index + 1}`, `請求頭值 ${index + 1}`)} placeholder={t("值", "Value", "值")} className="min-w-0 font-mono text-xs" autoComplete="off" spellCheck={false} value={row.value} onChange={(event) => { setReplaceHeaders(true); setServiceDraft((current) => ({ ...current, headerPreset: null, headers: current.headers.map((item) => item.id === row.id ? { ...item, value: event.target.value } : item) })); }} /><Button type="button" variant="ghost" size="icon-sm" disabled={presetLoading} className="text-destructive-foreground" aria-label={t(`删除请求头 ${index + 1}`, `Remove header ${index + 1}`, `刪除請求頭 ${index + 1}`)} onClick={() => { setReplaceHeaders(true); setServiceDraft((current) => ({ ...current, headerPreset: null, headers: current.headers.filter((item) => item.id !== row.id) })); }}><XIcon className="size-4" aria-hidden="true" /></Button></div>)}<Button type="button" variant="ghost" disabled={presetLoading} className="w-full justify-start rounded-none" onClick={() => { setReplaceHeaders(true); setServiceDraft((current) => ({ ...current, headerPreset: null, headers: [...current.headers, headerRow()] })); }}><PlusIcon className="size-4" aria-hidden="true" />{t("添加请求头", "Add header", "新增請求頭")}</Button></div>{replaceHeaders && headersError ? <p className="text-xs text-destructive-foreground" role="alert">{headersError}</p> : null}</div></div></CollapsiblePanel></Collapsible>
          </>}
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog open={Boolean(modelService)} title={t("添加模型", "Add model", "新增模型")} description={modelService ? (runtimeOf(modelService) === "workers-ai" ? `${modelService.name} · Workers AI` : `${modelService.name} · ${hostname(modelService.baseUrl)}`) : undefined} onClose={() => setModelService(null)} footer={<><Button variant="ghost" onClick={() => setModelService(null)}>{t("取消", "Cancel", "取消")}</Button><Button loading={busy === "add-model"} disabled={!modelId.trim() || Boolean(modelService && runtimeOf(modelService) === "workers-ai" && !modelId.trim().startsWith("@cf/"))} onClick={() => void addModel()}>{t("添加模型", "Add model", "新增模型")}</Button></>}>
        <div className="grid gap-4">{error ? <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert> : null}<Field label={t("模型 ID", "Model ID", "模型 ID")} description={modelService && runtimeOf(modelService) === "workers-ai" && modelId.trim() && !modelId.trim().startsWith("@cf/") ? t("Workers AI 模型 ID 必须以 @cf/ 开头", "Workers AI model IDs must start with @cf/", "Workers AI 模型 ID 必須以 @cf/ 開頭") : undefined}><Input type="text" autoFocus placeholder={modelService && runtimeOf(modelService) === "workers-ai" ? "@cf/zai-org/glm-4.7-flash" : "gpt-5.4"} value={modelId} onChange={(event) => setModelId(event.target.value)} /></Field><Field label={t("显示名称（可选）", "Display name (optional)", "顯示名稱（可選）")}><Input type="text" value={modelName} onChange={(event) => setModelName(event.target.value)} /></Field></div>
      </ResponsiveDialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{deleteTarget?.type === "service" ? t("删除模型服务？", "Delete model service?", "刪除模型服務？") : t("删除模型？", "Delete model?", "刪除模型？")}</AlertDialogTitle><AlertDialogDescription>{deleteTarget?.type === "service" ? t("服务、其模型和加密凭据都会被删除。此操作不可撤销。", "The service, its models, and encrypted credential will be deleted. This cannot be undone.", "服務、其模型和加密憑據都會被刪除。此操作不可撤銷。") : t(`将删除模型「${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}」。`, `The model “${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}” will be deleted.`, `將刪除模型「${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}」。`)}</AlertDialogDescription></AlertDialogHeader>{error ? <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert> : null}<AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel", "取消")}</AlertDialogClose><HoldToConfirmButton size="sm" duration={1200} disabled={busy === "delete"} label={t("按住删除", "Hold to delete", "按住刪除")} confirmedLabel={t("正在删除", "Deleting", "正在刪除")} ariaLabel={deleteTarget?.type === "service" ? t(`按住 1.2 秒删除模型服务 ${deleteTarget.service.name}`, `Hold for 1.2 seconds to delete model service ${deleteTarget.service.name}`, `按住 1.2 秒刪除模型服務 ${deleteTarget.service.name}`) : t(`按住 1.2 秒删除模型 ${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}`, `Hold for 1.2 seconds to delete model ${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}`, `按住 1.2 秒刪除模型 ${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}`)} onConfirm={() => confirmDelete()} /></AlertDialogFooter></AlertDialogPopup></AlertDialog>
    </div>
  );
}
