import { ArrowsClockwise as RefreshCwIcon, CaretDown as ChevronDownIcon, Check as CheckIcon, Eye as EyeIcon, EyeSlash as EyeOffIcon, Key as KeyIcon, Plus as PlusIcon, X as XIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { HoldToConfirmButton } from "../../components/spectrumui/hold-to-confirm";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../../components/ui/collapsible";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { ResponsiveDialog } from "../../components/ui/responsive-dialog";
import { Select } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { notify } from "../../components/ui/toast";
import { addAiModel, createAiService, deleteAiModel, deleteAiService, fetchAiServices, fetchCodexDesktopPreset, setDefaultAiModel, testAiService, updateAiService } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { AiProtocol, AiService, AiServicesState } from "../../types";

type HeaderRow = { id: string; name: string; value: string };
const headerRow = (name = "", value = ""): HeaderRow => ({ id: crypto.randomUUID(), name, value });

type ServiceDraft = { name: string; protocol: AiProtocol; baseUrl: string; apiKey: string; modelId: string; modelName: string; headers: HeaderRow[]; headerPreset: AiService["headerPreset"] };
const emptyDraft = (): ServiceDraft => ({ name: "", protocol: "openai-compatible", baseUrl: "", apiKey: "", modelId: "", modelName: "", headers: [], headerPreset: null });

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

export function AiServicesSettings({ onRegistryChange }: { onRegistryChange: (services: AiServicesState) => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<AiServicesState>({ defaultModelId: null, services: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [serviceModal, setServiceModal] = useState<"create" | "edit" | null>(null);
  const [editingService, setEditingService] = useState<AiService | null>(null);
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>(emptyDraft);
  const [showKey, setShowKey] = useState(false);
  const [replaceHeaders, setReplaceHeaders] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const presetRequest = useRef<AbortController | null>(null);
  useEffect(() => { setPresetLoading(false); return () => { presetRequest.current?.abort(); }; }, [serviceModal]);
  const [modelService, setModelService] = useState<AiService | null>(null);
  const [modelId, setModelId] = useState("");
  const [modelName, setModelName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: "service"; service: AiService } | { type: "model"; service: AiService; modelId: string; modelName: string } | null>(null);

  function applyRegistry(next: AiServicesState) {
    setData(next);
    onRegistryChange(next);
  }

  async function load() {
    setLoading(true); setError("");
    try {
      const next = await fetchAiServices();
      setData(next);
      // An empty initial registry can still use the legacy provider settings.
      if (next.services.length) onRegistryChange(next);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("AI 服务读取失败", "Failed to load AI services", "AI 服務讀取失敗")); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const availableModels = useMemo(() => data.services.filter((service) => service.enabled).flatMap((service) => service.models.filter((model) => model.enabled).map((model) => ({ service, model }))), [data.services]);
  const defaultOption = availableModels.find((item) => item.model.id === data.defaultModelId);
  const headersResult = useMemo(() => parseHeaders(serviceDraft.headers), [serviceDraft.headers]);
  const headersError = headersResult.error === "name" ? t("请填写有效的请求头名称", "Enter a valid header name", "請填寫有效的請求頭名稱") : headersResult.error === "duplicate" ? t("请求头名称不能重复（不区分大小写）", "Header names must be unique (case-insensitive)", "請求頭名稱不能重複（不區分大小寫）") : headersResult.error === "value" ? t("请求头值不能包含换行", "Header values cannot contain line breaks", "請求頭值不能包含換行") : "";

  function taskError(title: string, reason: unknown, fallback = "") {
    const detail = reason instanceof Error ? reason.message : fallback;
    setError(detail ? `${title}：${detail}` : title);
  }

  function openCreate() { setError(""); setEditingService(null); setServiceDraft(emptyDraft()); setReplaceHeaders(true); setShowKey(false); setServiceModal("create"); }
  function openEdit(service: AiService) { setError(""); setEditingService(service); setServiceDraft({ name: service.name, protocol: service.protocol, baseUrl: service.baseUrl, apiKey: "", modelId: "", modelName: "", headers: [], headerPreset: service.headerPreset ?? null }); setReplaceHeaders(false); setShowKey(false); setServiceModal("edit"); }

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

  async function saveService() {
    if (presetLoading || !serviceDraft.name.trim() || !serviceDraft.baseUrl.trim() || (serviceModal === "create" && !serviceDraft.apiKey.trim()) || (replaceHeaders && headersError)) return;
    setBusy("save-service"); setError("");
    try {
      const next = serviceModal === "edit" && editingService
        ? await updateAiService(editingService.id, { name: serviceDraft.name.trim(), protocol: serviceDraft.protocol, baseUrl: serviceDraft.baseUrl.trim(), ...(serviceDraft.apiKey.trim() ? { apiKey: serviceDraft.apiKey.trim() } : {}), ...(replaceHeaders ? { headers: headersResult.headers, headerPreset: serviceDraft.headerPreset ?? null } : {}) })
        : await createAiService({ name: serviceDraft.name.trim(), protocol: serviceDraft.protocol, baseUrl: serviceDraft.baseUrl.trim(), apiKey: serviceDraft.apiKey.trim(), headers: headersResult.headers, headerPreset: serviceDraft.headerPreset ?? null, modelId: serviceDraft.modelId.trim() || undefined, modelName: serviceDraft.modelName.trim() || undefined });
      applyRegistry(next); setServiceModal(null);
      notify(serviceModal === "edit" ? t("模型服务已更新", "Model service updated", "模型服務已更新") : t("模型服务已添加", "Model service added", "模型服務已新增"), serviceDraft.name.trim(), "success");
    } catch (reason) { taskError(t("模型服务保存失败", "Failed to save model service", "模型服務儲存失敗"), reason, t("请稍后重试", "Try again later", "請稍後重試")); }
    finally { setBusy(""); }
  }

  async function toggleService(service: AiService, enabled: boolean) {
    setBusy(`service:${service.id}`); setError("");
    try { applyRegistry(await updateAiService(service.id, { enabled })); }
    catch (reason) { taskError(t("服务状态更新失败", "Failed to update service status", "服務狀態更新失敗"), reason, service.name); }
    finally { setBusy(""); }
  }

  async function test(service: AiService) {
    setBusy(`test:${service.id}`); setError("");
    try { const message = await testAiService(service.id, data.defaultModelId && service.models.some((model) => model.id === data.defaultModelId) ? data.defaultModelId : undefined); notify(t("连接测试通过", "Connection test passed", "連線測試通過"), message, "success"); }
    catch (reason) { taskError(t("连接测试失败", "Connection test failed", "連線測試失敗"), reason, service.name); }
    finally { setBusy(""); }
  }

  async function addModel() {
    if (!modelService || !modelId.trim()) return;
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

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-border/70 p-4">
        <div className="mb-3"><p className="text-sm font-medium">{t("默认模型", "Default model", "預設模型")}</p><p className="mt-1 text-xs text-muted-foreground">{t("仓库 AI 分析和 Release 总结默认使用此模型。", "Repository analysis and Release summaries use this model by default.", "儲存庫 AI 分析和 Release 總結預設使用此模型。")}</p></div>
        <Select aria-label={t("默认模型", "Default model", "預設模型")} value={data.defaultModelId || ""} disabled={loading || !availableModels.length} onValueChange={(value) => void setDefault(value)} items={[{ value: "", label: loading ? t("正在加载…", "Loading…", "正在載入…") : t("选择默认模型", "Choose default model", "選擇預設模型"), disabled: true }, ...(availableModels.map(({ service, model }) => ({ value: String(model.id), label: <>{model.displayName || model.remoteModelId}· {service.name}</> })))]} />
        {defaultOption ? <p className="mt-2 text-xs text-muted-foreground">{t("当前", "Current", "當前")}: {defaultOption.model.displayName || defaultOption.model.remoteModelId} · {defaultOption.service.name}</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">{t("模型服务", "Model services", "模型服務")} <span className="ml-1 text-muted-foreground">{data.services.length}</span></p><p className="mt-1 text-xs text-muted-foreground">{t("一个服务可以添加多个模型。API Key 由 Worker 加密保存。", "Each service can contain multiple models. API keys are encrypted by the Worker.", "一個服務可以新增多個模型。API Key 由 Worker 加密儲存。")}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void load()} loading={loading}><RefreshCwIcon className="size-4" aria-hidden="true" />{t("刷新", "Refresh", "重新整理")}</Button><Button size="sm" onClick={openCreate}><PlusIcon className="size-4" aria-hidden="true" />{t("添加模型服务", "Add model service", "新增模型服務")}</Button></div></div>
      {error ? <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {!loading && !data.services.length ? <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center"><p className="text-sm font-medium">{t("还没有模型服务", "No model services yet", "還沒有模型服務")}</p><p className="mt-1 text-xs text-muted-foreground">{t("添加第一个服务后即可为仓库分析与 Release 总结选择模型。", "Add a service to choose models for repository analysis and Release summaries.", "新增第一個服務後即可為儲存庫分析與 Release 總結選擇模型。")}</p><Button className="mt-4" size="sm" onClick={openCreate}><PlusIcon className="size-4" aria-hidden="true" />{t("添加模型服务", "Add model service", "新增模型服務")}</Button></div> : null}

      <div className="grid gap-3">
        {data.services.map((service) => (
          <article key={service.id} className="rounded-xl border border-border/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{service.name}</h3><Badge variant="secondary" size="sm">{t(protocolLabels[service.protocol].zh, protocolLabels[service.protocol].en, protocolLabels[service.protocol].tw)}</Badge>{service.credentialConfigured ? <Badge variant="success" size="sm">{t("凭据已配置", "Credential set", "憑據已配置")}</Badge> : <Badge variant="warning" size="sm">{t("缺少凭据", "Credential missing", "缺少憑據")}</Badge>}</div><p className="mt-1 truncate text-xs text-muted-foreground">{hostname(service.baseUrl)}</p></div>
              <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{service.enabled ? t("已启用", "Enabled", "已啟用") : t("已停用", "Disabled", "已停用")}</span><Switch checked={service.enabled} disabled={busy === `service:${service.id}`} onCheckedChange={(checked) => void toggleService(service, checked)} aria-label={t("启用模型服务", "Enable model service", "啟用模型服務")} /><Button variant="ghost" size="icon-sm" aria-label={t("添加模型", "Add model", "新增模型")} onClick={() => { setModelService(service); setModelId(""); setModelName(""); }}><PlusIcon className="size-4" aria-hidden="true" /></Button><Button variant="ghost" size="sm" onClick={() => void test(service)} loading={busy === `test:${service.id}`}><KeyIcon className="size-4" aria-hidden="true" />{t("测试", "Test", "測試")}</Button><Button variant="ghost" size="sm" onClick={() => openEdit(service)}>{t("编辑", "Edit", "編輯")}</Button><Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ type: "service", service })}>{t("删除", "Delete", "刪除")}</Button></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {service.models.length ? service.models.map((model) => {
                const isDefault = model.id === data.defaultModelId;
                return (
                  <div key={model.id} className={`inline-flex items-center gap-1 rounded-lg border p-1 text-xs ${isDefault ? "border-primary/40 bg-primary/5" : "border-border/70 bg-secondary/30"}`}>
                    <Button variant="link" size="xs" className="px-1.5 text-xs font-medium" disabled={!service.enabled || !model.enabled || isDefault} onClick={() => void setDefault(model.id)}>{model.displayName || model.remoteModelId}</Button>
                    {isDefault ? <Badge size="sm" variant="success"><CheckIcon className="size-3" aria-hidden="true" />{t("默认", "Default", "預設")}</Badge> : null}
                    <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive-foreground" aria-label={t("删除模型", "Delete model", "刪除模型")} onClick={() => setDeleteTarget({ type: "model", service, modelId: model.id, modelName: model.displayName || model.remoteModelId })}><XIcon className="size-3.5" aria-hidden="true" /></Button>
                  </div>
                );
              }) : <p className="text-xs text-muted-foreground">{t("暂无模型。点击 + 添加模型 ID。", "No models yet. Use + to add a model ID.", "暫無模型。點選 + 新增模型 ID。")}</p>}
            </div>
          </article>
        ))}
      </div>

      <Alert variant="info"><AlertDescription>{t("此处只管理模型连接、可用模型和默认模型；仓库分析与 Release 总结的任务提示由 StarBox 统一管理。", "This section manages model connections, available models, and the default model. StarBox manages the task prompts used for repository analysis and Release summaries.", "此處只管理模型連線、可用模型和預設模型；儲存庫分析與 Release 總結的任務提示由 StarBox 統一管理。")}</AlertDescription></Alert>

      <ResponsiveDialog
        open={Boolean(serviceModal)}
        title={serviceModal === "edit" ? t("编辑模型服务", "Edit model service", "編輯模型服務") : t("添加模型服务", "Add model service", "新增模型服務")}
        description={t("凭据会在 Worker 端加密保存，不会从安全读取接口回显。", "Credentials are encrypted by the Worker and are never returned by safe read APIs.", "憑據會在 Worker 端加密儲存，不會從安全讀取介面回顯。")}
        onClose={() => setServiceModal(null)}
        className="sm:max-w-xl"
        footer={<><Button variant="ghost" onClick={() => setServiceModal(null)}>{t("取消", "Cancel", "取消")}</Button><Button loading={busy === "save-service"} disabled={presetLoading || !serviceDraft.name.trim() || !serviceDraft.baseUrl.trim() || (serviceModal === "create" && !serviceDraft.apiKey.trim()) || Boolean(replaceHeaders && headersError)} onClick={() => void saveService()}>{serviceModal === "edit" ? t("保存", "Save", "儲存") : t("添加服务", "Add service", "新增服務")}</Button></>}
      >
        <div className="grid gap-4">
          {error ? <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2"><Field label={t("服务名称", "Service name", "服務名稱")}><Input type="text" value={serviceDraft.name} onChange={(event) => setServiceDraft((current) => ({ ...current, name: event.target.value }))} /></Field><Field label={t("API 协议", "API protocol", "API 協議")}><Select value={serviceDraft.protocol} onValueChange={(value) => setServiceDraft((current) => ({ ...current, protocol: value as AiProtocol }))} items={[{ value: "openai-compatible", label: "OpenAI Compatible" }, { value: "anthropic-messages", label: "Anthropic Messages" }, { value: "google-gemini", label: "Google Gemini" }]} /></Field></div>
          <Field label="Base URL"><Input type="text" inputMode="url" placeholder={serviceDraft.protocol === "anthropic-messages" ? "https://api.anthropic.com" : serviceDraft.protocol === "google-gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1"} value={serviceDraft.baseUrl} onChange={(event) => setServiceDraft((current) => ({ ...current, baseUrl: event.target.value }))} /></Field>
          <Field label="API Key" description={serviceModal === "edit" && editingService?.credentialConfigured ? t("已保存；留空保持现有凭据。", "Already saved; leave blank to keep the existing credential.", "已儲存；留空保持現有憑據。") : undefined}><InputGroup><InputGroupInput type={showKey ? "text" : "password"} autoComplete="off" value={serviceDraft.apiKey} onChange={(event) => setServiceDraft((current) => ({ ...current, apiKey: event.target.value }))} /><InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? t("隐藏 API Key", "Hide API Key", "隱藏 API Key") : t("显示 API Key", "Show API Key", "顯示 API Key")}>{showKey ? <EyeOffIcon className="size-4" aria-hidden="true" /> : <EyeIcon className="size-4" aria-hidden="true" />}</Button></InputGroupAddon></InputGroup></Field>
          {serviceModal === "create" ? <div className="grid gap-4 sm:grid-cols-2"><Field label={t("首个模型 ID（可选）", "First model ID (optional)", "首個模型 ID（可選）")}><Input type="text" placeholder="gpt-5.4" value={serviceDraft.modelId} onChange={(event) => setServiceDraft((current) => ({ ...current, modelId: event.target.value }))} /></Field><Field label={t("显示名称（可选）", "Display name (optional)", "顯示名稱（可選）")}><Input type="text" value={serviceDraft.modelName} onChange={(event) => setServiceDraft((current) => ({ ...current, modelName: event.target.value }))} /></Field></div> : null}
          <Collapsible className="rounded-xl border border-border/70">
            <CollapsibleTrigger render={<Button type="button" variant="ghost" className="h-auto w-full justify-between rounded-xl px-4 py-3 text-sm font-medium" />}>
              {t("高级设置", "Advanced settings", "進階設定")}<ChevronDownIcon className="size-4" aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <div className="grid gap-3 px-4 pb-4 pt-1">
                {serviceModal === "edit" ? <div className="flex items-center justify-between gap-3"><span className="min-w-0 text-xs text-muted-foreground">{t("保留现有请求头；开启后替换，删除所有行可清空。", "Keep existing headers. Enable to replace them; remove all rows to clear.", "保留現有請求頭；開啟後替換，刪除所有行可清空。")}</span><Switch checked={replaceHeaders} disabled={presetLoading} onCheckedChange={setReplaceHeaders} aria-label={t("替换自定义请求头", "Replace custom headers", "替換自定義請求頭")} /></div> : null}
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("请求头预设", "Header presets", "請求頭預設")}>
                  <span className="text-xs text-muted-foreground">{t("请求头预设", "Header presets", "請求頭預設")}</span>
                  <Button type="button" variant="outline" size="xs" loading={presetLoading} onClick={() => void applyDesktopPreset()}>Codex Desktop</Button>
                </div>
                <div className="grid gap-2" role="group" aria-label={t("自定义请求头", "Custom headers", "自定義請求頭")}>
                  <p className="text-sm font-medium">{t("自定义请求头", "Custom headers", "自定義請求頭")}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{t("逐行填写名称和值；选择 Codex Desktop 会自动使用官方最新版；编辑列表会切换为手动模式。", "Enter a name and value per row. Codex Desktop follows the latest official release; editing the list switches to manual mode.", "逐行填寫名稱和值；選擇 Codex Desktop 會自動使用官方最新版；編輯清單會切換為手動模式。")}</p>
                  {serviceDraft.headerPreset === "codex-desktop-latest" ? <p className="text-xs text-muted-foreground" role="status">{t("自动使用官方最新稳定版本（版本缓存 5 分钟）", "Automatically uses the latest official stable release (version cached for 5 minutes)", "自動使用官方最新穩定版本（版本快取 5 分鐘）")}</p> : null}
                  <div className="overflow-hidden rounded-xl border border-border/70">
                    {serviceDraft.headers.map((row, index) => <div key={row.id} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] items-center gap-2 border-b border-border/70 p-2">
                      <Input type="text" disabled={!replaceHeaders || presetLoading} aria-label={t(`请求头名称 ${index + 1}`, `Header name ${index + 1}`, `請求頭名稱 ${index + 1}`)} placeholder={t("名称", "Name", "名稱")} className="min-w-0 font-mono text-xs" autoComplete="off" spellCheck={false} value={row.name} onChange={(event) => setServiceDraft((current) => ({ ...current, headerPreset: null, headers: current.headers.map((item) => item.id === row.id ? { ...item, name: event.target.value } : item) }))} />
                      <Input type="text" disabled={!replaceHeaders || presetLoading} aria-label={t(`请求头值 ${index + 1}`, `Header value ${index + 1}`, `請求頭值 ${index + 1}`)} placeholder={t("值", "Value", "值")} className="min-w-0 font-mono text-xs" autoComplete="off" spellCheck={false} value={row.value} onChange={(event) => setServiceDraft((current) => ({ ...current, headerPreset: null, headers: current.headers.map((item) => item.id === row.id ? { ...item, value: event.target.value } : item) }))} />
                      <Button type="button" variant="ghost" size="icon-sm" disabled={!replaceHeaders || presetLoading} className="text-destructive-foreground" aria-label={t(`删除请求头 ${index + 1}`, `Remove header ${index + 1}`, `刪除請求頭 ${index + 1}`)} onClick={() => setServiceDraft((current) => ({ ...current, headerPreset: null, headers: current.headers.filter((item) => item.id !== row.id) }))}><XIcon className="size-4" aria-hidden="true" /></Button>
                    </div>)}
                    <Button type="button" variant="ghost" disabled={presetLoading} className="w-full justify-start rounded-none" onClick={() => { setReplaceHeaders(true); setServiceDraft((current) => ({ ...current, headerPreset: null, headers: [...current.headers, headerRow()] })); }}><PlusIcon className="size-4" aria-hidden="true" />{t("添加请求头", "Add header", "新增請求頭")}</Button>
                  </div>
                  {replaceHeaders && headersError ? <p className="text-xs text-destructive-foreground" role="alert">{headersError}</p> : null}
                </div>
              </div>
            </CollapsiblePanel>
          </Collapsible>
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={Boolean(modelService)}
        title={t("添加模型", "Add model", "新增模型")}
        description={modelService ? `${modelService.name} · ${hostname(modelService.baseUrl)}` : undefined}
        onClose={() => setModelService(null)}
        footer={<><Button variant="ghost" onClick={() => setModelService(null)}>{t("取消", "Cancel", "取消")}</Button><Button loading={busy === "add-model"} disabled={!modelId.trim()} onClick={() => void addModel()}>{t("添加模型", "Add model", "新增模型")}</Button></>}
      >
        <div className="grid gap-4">{error ? <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert> : null}<Field label={t("模型 ID", "Model ID", "模型 ID")}><Input type="text" autoFocus placeholder="gpt-5.4" value={modelId} onChange={(event) => setModelId(event.target.value)} /></Field><Field label={t("显示名称（可选）", "Display name (optional)", "顯示名稱（可選）")}><Input type="text" value={modelName} onChange={(event) => setModelName(event.target.value)} /></Field></div>
      </ResponsiveDialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{deleteTarget?.type === "service" ? t("删除模型服务？", "Delete model service?", "刪除模型服務？") : t("删除模型？", "Delete model?", "刪除模型？")}</AlertDialogTitle><AlertDialogDescription>{deleteTarget?.type === "service" ? t("服务、其模型和加密凭据都会被删除。此操作不可撤销。", "The service, its models, and encrypted credential will be deleted. This cannot be undone.", "服務、其模型和加密憑據都會被刪除。此操作不可撤銷。") : t(`将删除模型「${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}」。`, `The model “${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}” will be deleted.`, `將刪除模型「${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}」。`)}</AlertDialogDescription></AlertDialogHeader>{error ? <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert> : null}<AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel", "取消")}</AlertDialogClose><HoldToConfirmButton size="sm" duration={1200} disabled={busy === "delete"} label={t("按住删除", "Hold to delete", "按住刪除")} confirmedLabel={t("正在删除", "Deleting", "正在刪除")} ariaLabel={deleteTarget?.type === "service" ? t(`按住 1.2 秒删除模型服务 ${deleteTarget.service.name}`, `Hold for 1.2 seconds to delete model service ${deleteTarget.service.name}`, `按住 1.2 秒刪除模型服務 ${deleteTarget.service.name}`) : t(`按住 1.2 秒删除模型 ${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}`, `Hold for 1.2 seconds to delete model ${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}`, `按住 1.2 秒刪除模型 ${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}`)} onConfirm={() => confirmDelete()} /></AlertDialogFooter></AlertDialogPopup></AlertDialog>
    </div>
  );
}
