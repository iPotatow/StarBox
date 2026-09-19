import { CheckIcon, ChevronDownIcon, EyeIcon, EyeOffIcon, KeyIcon, PlusIcon, RefreshCwIcon } from "../../lib/animated-icons";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../../components/ui/collapsible";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { ResponsiveDialog } from "../../components/ui/responsive-dialog";
import { Select } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Textarea } from "../../components/ui/textarea";
import { notify } from "../../components/ui/toast";
import { addAiModel, createAiService, deleteAiModel, deleteAiService, fetchAiServices, setDefaultAiModel, testAiService, updateAiService } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { AiProtocol, AiService, AiServicesState } from "../../types";

type ServiceDraft = { name: string; protocol: AiProtocol; baseUrl: string; apiKey: string; modelId: string; modelName: string; headersText: string };
const emptyDraft = (): ServiceDraft => ({ name: "", protocol: "openai-compatible", baseUrl: "", apiKey: "", modelId: "", modelName: "", headersText: "{}" });

const protocolLabels: Record<AiProtocol, { zh: string; en: string }> = {
  "openai-compatible": { zh: "OpenAI 兼容协议", en: "OpenAI Compatible" },
  "anthropic-messages": { zh: "Anthropic Messages", en: "Anthropic Messages" },
  "google-gemini": { zh: "Google Gemini", en: "Google Gemini" },
};

function hostname(url: string) { try { return new URL(url).hostname; } catch { return url; } }
function parseHeaders(raw: string): { headers: Record<string, string>; error: string } {
  try {
    const parsed = raw.trim() ? JSON.parse(raw) as unknown : {};
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Headers must be a JSON object");
    return { headers: Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)])), error: "" };
  } catch (reason) { return { headers: {}, error: reason instanceof Error ? reason.message : "Invalid headers" }; }
}

export function AiServicesSettings() {
  const { t } = useI18n();
  const [data, setData] = useState<AiServicesState>({ defaultModelId: null, services: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [serviceModal, setServiceModal] = useState<"create" | "edit" | null>(null);
  const [editingService, setEditingService] = useState<AiService | null>(null);
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>(emptyDraft);
  const [showKey, setShowKey] = useState(false);
  const [modelService, setModelService] = useState<AiService | null>(null);
  const [modelId, setModelId] = useState("");
  const [modelName, setModelName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: "service"; service: AiService } | { type: "model"; service: AiService; modelId: string; modelName: string } | null>(null);

  async function load() {
    setLoading(true); setError("");
    try { setData(await fetchAiServices()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("AI 服务读取失败", "Failed to load AI services")); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const availableModels = useMemo(() => data.services.filter((service) => service.enabled).flatMap((service) => service.models.filter((model) => model.enabled).map((model) => ({ service, model }))), [data.services]);
  const defaultOption = availableModels.find((item) => item.model.id === data.defaultModelId);
  const headersResult = useMemo(() => parseHeaders(serviceDraft.headersText), [serviceDraft.headersText]);

  function openCreate() { setEditingService(null); setServiceDraft(emptyDraft()); setShowKey(false); setServiceModal("create"); }
  function openEdit(service: AiService) { setEditingService(service); setServiceDraft({ name: service.name, protocol: service.protocol, baseUrl: service.baseUrl, apiKey: "", modelId: "", modelName: "", headersText: "{}" }); setShowKey(false); setServiceModal("edit"); }

  async function saveService() {
    if (!serviceDraft.name.trim() || !serviceDraft.baseUrl.trim() || (serviceModal === "create" && !serviceDraft.apiKey.trim()) || headersResult.error) return;
    setBusy("save-service"); setError("");
    try {
      const next = serviceModal === "edit" && editingService
        ? await updateAiService(editingService.id, { name: serviceDraft.name.trim(), protocol: serviceDraft.protocol, baseUrl: serviceDraft.baseUrl.trim(), ...(serviceDraft.apiKey.trim() ? { apiKey: serviceDraft.apiKey.trim() } : {}), ...(serviceDraft.headersText.trim() !== "{}" ? { headers: headersResult.headers } : {}) })
        : await createAiService({ name: serviceDraft.name.trim(), protocol: serviceDraft.protocol, baseUrl: serviceDraft.baseUrl.trim(), apiKey: serviceDraft.apiKey.trim(), headers: headersResult.headers, modelId: serviceDraft.modelId.trim() || undefined, modelName: serviceDraft.modelName.trim() || undefined });
      setData(next); setServiceModal(null);
      notify(serviceModal === "edit" ? t("模型服务已更新", "Model service updated") : t("模型服务已添加", "Model service added"), serviceDraft.name.trim(), "success");
    } catch (reason) { notify(t("模型服务保存失败", "Failed to save model service"), reason instanceof Error ? reason.message : t("请稍后重试", "Try again later"), "error"); }
    finally { setBusy(""); }
  }

  async function toggleService(service: AiService, enabled: boolean) {
    setBusy(`service:${service.id}`); setError("");
    try { setData(await updateAiService(service.id, { enabled })); }
    catch (reason) { notify(t("服务状态更新失败", "Failed to update service status"), reason instanceof Error ? reason.message : service.name, "error"); }
    finally { setBusy(""); }
  }

  async function test(service: AiService) {
    setBusy(`test:${service.id}`); setError("");
    try { const message = await testAiService(service.id, data.defaultModelId && service.models.some((model) => model.id === data.defaultModelId) ? data.defaultModelId : undefined); notify(t("连接测试通过", "Connection test passed"), message, "success"); }
    catch (reason) { notify(t("连接测试失败", "Connection test failed"), reason instanceof Error ? reason.message : service.name, "error"); }
    finally { setBusy(""); }
  }

  async function addModel() {
    if (!modelService || !modelId.trim()) return;
    setBusy("add-model"); setError("");
    try { setData(await addAiModel(modelService.id, modelId.trim(), modelName.trim())); setModelService(null); setModelId(""); setModelName(""); notify(t("模型已添加", "Model added"), modelName.trim() || modelId.trim(), "success"); }
    catch (reason) { notify(t("模型添加失败", "Failed to add model"), reason instanceof Error ? reason.message : modelId.trim(), "error"); }
    finally { setBusy(""); }
  }

  async function setDefault(modelIdValue: string) {
    if (!modelIdValue) return;
    setBusy(`default:${modelIdValue}`); setError("");
    try { setData(await setDefaultAiModel(modelIdValue)); notify(t("默认模型已更新", "Default model updated"), "", "success"); }
    catch (reason) { notify(t("默认模型更新失败", "Failed to update default model"), reason instanceof Error ? reason.message : modelIdValue, "error"); }
    finally { setBusy(""); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy("delete"); setError("");
    try {
      setData(deleteTarget.type === "service" ? await deleteAiService(deleteTarget.service.id) : await deleteAiModel(deleteTarget.service.id, deleteTarget.modelId));
      notify(deleteTarget.type === "service" ? t("模型服务已删除", "Model service deleted") : t("模型已删除", "Model deleted"), "", "success");
      setDeleteTarget(null);
    } catch (reason) { notify(t("删除失败", "Delete failed"), reason instanceof Error ? reason.message : t("请稍后重试", "Try again later"), "error"); }
    finally { setBusy(""); }
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-border/70 p-4">
        <div className="mb-3"><p className="text-sm font-medium">{t("默认模型", "Default model")}</p><p className="mt-1 text-xs text-muted-foreground">{t("仓库 AI 分析和 Release 总结默认使用此模型。内置提示词保持不变。", "Repository analysis and Release summaries use this model by default. Built-in prompts stay unchanged.")}</p></div>
        <Select value={data.defaultModelId || ""} disabled={loading || !availableModels.length} onValueChange={(value) => void setDefault(value)} items={[{ value: "", label: loading ? t("正在加载…", "Loading…") : t("选择默认模型", "Choose default model"), disabled: true }, ...(availableModels.map(({ service, model }) => ({ value: String(model.id), label: <>{model.displayName || model.remoteModelId}· {service.name}</> })))]} />
        {defaultOption ? <p className="mt-2 text-xs text-muted-foreground">{t("当前", "Current")}: {defaultOption.model.displayName || defaultOption.model.remoteModelId} · {defaultOption.service.name}</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">{t("模型服务", "Model services")} <span className="ml-1 text-muted-foreground">{data.services.length}</span></p><p className="mt-1 text-xs text-muted-foreground">{t("一个服务可以添加多个模型。API Key 由 Worker 加密保存。", "Each service can contain multiple models. API keys are encrypted by the Worker.")}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void load()} loading={loading}><RefreshCwIcon className="size-4" aria-hidden="true" />{t("刷新", "Refresh")}</Button><Button size="sm" onClick={openCreate}><PlusIcon className="size-4" aria-hidden="true" />{t("添加模型服务", "Add model service")}</Button></div></div>
      {error ? <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {!loading && !data.services.length ? <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center"><p className="text-sm font-medium">{t("还没有模型服务", "No model services yet")}</p><p className="mt-1 text-xs text-muted-foreground">{t("添加第一个服务后即可为仓库分析与 Release 总结选择模型。", "Add a service to choose models for repository analysis and Release summaries.")}</p><Button className="mt-4" size="sm" onClick={openCreate}><PlusIcon className="size-4" aria-hidden="true" />{t("添加模型服务", "Add model service")}</Button></div> : null}

      <div className="grid gap-3">
        {data.services.map((service) => (
          <article key={service.id} className="rounded-xl border border-border/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{service.name}</h3><Badge variant="secondary" size="sm">{t(protocolLabels[service.protocol].zh, protocolLabels[service.protocol].en)}</Badge>{service.credentialConfigured ? <Badge variant="success" size="sm">{t("凭据已配置", "Credential set")}</Badge> : <Badge variant="warning" size="sm">{t("缺少凭据", "Credential missing")}</Badge>}</div><p className="mt-1 truncate text-xs text-muted-foreground">{hostname(service.baseUrl)}</p></div>
              <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{service.enabled ? t("已启用", "Enabled") : t("已停用", "Disabled")}</span><Switch checked={service.enabled} disabled={busy === `service:${service.id}`} onCheckedChange={(checked) => void toggleService(service, checked)} aria-label={t("启用模型服务", "Enable model service")} /><Button variant="ghost" size="icon-sm" aria-label={t("添加模型", "Add model")} onClick={() => { setModelService(service); setModelId(""); setModelName(""); }}><PlusIcon className="size-4" aria-hidden="true" /></Button><Button variant="ghost" size="sm" onClick={() => void test(service)} loading={busy === `test:${service.id}`}><KeyIcon className="size-4" aria-hidden="true" />{t("测试", "Test")}</Button><Button variant="ghost" size="sm" onClick={() => openEdit(service)}>{t("编辑", "Edit")}</Button><Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ type: "service", service })}>{t("删除", "Delete")}</Button></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {service.models.length ? service.models.map((model) => {
                const isDefault = model.id === data.defaultModelId;
                return (
                  <div key={model.id} className={`inline-flex items-center gap-1 rounded-lg border p-1 text-xs ${isDefault ? "border-primary/40 bg-primary/5" : "border-border/70 bg-secondary/30"}`}>
                    <Button variant="link" size="xs" className="px-1.5 text-xs font-medium" disabled={!service.enabled || !model.enabled || isDefault} onClick={() => void setDefault(model.id)}>{model.displayName || model.remoteModelId}</Button>
                    {isDefault ? <Badge size="sm" variant="success"><CheckIcon className="size-3" aria-hidden="true" />{t("默认", "Default")}</Badge> : null}
                    <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive-foreground" aria-label={t("删除模型", "Delete model")} onClick={() => setDeleteTarget({ type: "model", service, modelId: model.id, modelName: model.displayName || model.remoteModelId })}>×</Button>
                  </div>
                );
              }) : <p className="text-xs text-muted-foreground">{t("暂无模型。点击 + 添加模型 ID。", "No models yet. Use + to add a model ID.")}</p>}
            </div>
          </article>
        ))}
      </div>

      <Alert variant="info"><AlertDescription>{t("Repository 与 Release 的内置 AI 提示词本轮保持原样；这里只改变模型服务和默认模型的选择方式。", "The built-in Repository and Release prompts are unchanged; this only changes model service management and default-model selection.")}</AlertDescription></Alert>

      <ResponsiveDialog
        open={Boolean(serviceModal)}
        title={serviceModal === "edit" ? t("编辑模型服务", "Edit model service") : t("添加模型服务", "Add model service")}
        description={t("凭据会在 Worker 端加密保存，不会从安全读取接口回显。", "Credentials are encrypted by the Worker and are never returned by safe read APIs.")}
        onClose={() => setServiceModal(null)}
        className="sm:max-w-xl"
        footer={<><Button variant="ghost" onClick={() => setServiceModal(null)}>{t("取消", "Cancel")}</Button><Button loading={busy === "save-service"} disabled={!serviceDraft.name.trim() || !serviceDraft.baseUrl.trim() || (serviceModal === "create" && !serviceDraft.apiKey.trim()) || Boolean(headersResult.error)} onClick={() => void saveService()}>{serviceModal === "edit" ? t("保存", "Save") : t("添加服务", "Add service")}</Button></>}
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2"><Field label={t("服务名称", "Service name")}><Input value={serviceDraft.name} onChange={(event) => setServiceDraft((current) => ({ ...current, name: event.target.value }))} /></Field><Field label={t("API 协议", "API protocol")}><Select value={serviceDraft.protocol} onValueChange={(value) => setServiceDraft((current) => ({ ...current, protocol: value as AiProtocol }))} items={[{ value: "openai-compatible", label: "OpenAI Compatible" }, { value: "anthropic-messages", label: "Anthropic Messages" }, { value: "google-gemini", label: "Google Gemini" }]} /></Field></div>
          <Field label="Base URL"><Input inputMode="url" placeholder={serviceDraft.protocol === "anthropic-messages" ? "https://api.anthropic.com" : serviceDraft.protocol === "google-gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1"} value={serviceDraft.baseUrl} onChange={(event) => setServiceDraft((current) => ({ ...current, baseUrl: event.target.value }))} /></Field>
          <Field label="API Key" description={serviceModal === "edit" && editingService?.credentialConfigured ? t("已保存；留空保持现有凭据。", "Already saved; leave blank to keep the existing credential.") : undefined}><InputGroup><InputGroupInput type={showKey ? "text" : "password"} autoComplete="off" value={serviceDraft.apiKey} onChange={(event) => setServiceDraft((current) => ({ ...current, apiKey: event.target.value }))} /><InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon-sm" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? t("隐藏 API Key", "Hide API Key") : t("显示 API Key", "Show API Key")}>{showKey ? <EyeOffIcon className="size-4" aria-hidden="true" /> : <EyeIcon className="size-4" aria-hidden="true" />}</Button></InputGroupAddon></InputGroup></Field>
          {serviceModal === "create" ? <div className="grid gap-4 sm:grid-cols-2"><Field label={t("首个模型 ID（可选）", "First model ID (optional)")}><Input placeholder="gpt-5.4" value={serviceDraft.modelId} onChange={(event) => setServiceDraft((current) => ({ ...current, modelId: event.target.value }))} /></Field><Field label={t("显示名称（可选）", "Display name (optional)")}><Input value={serviceDraft.modelName} onChange={(event) => setServiceDraft((current) => ({ ...current, modelName: event.target.value }))} /></Field></div> : null}
          <Collapsible className="rounded-xl border border-border/70">
            <CollapsibleTrigger render={<Button type="button" variant="ghost" className="h-auto w-full justify-between rounded-xl px-4 py-3 text-sm font-medium" />}>
              {t("高级设置", "Advanced settings")}<ChevronDownIcon className="size-4" aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsiblePanel><div className="px-4 pb-4 pt-1"><Field label={t("自定义请求头", "Custom headers")} error={headersResult.error}><Textarea className="min-h-28 font-mono text-xs" spellCheck={false} value={serviceDraft.headersText} onChange={(event) => setServiceDraft((current) => ({ ...current, headersText: event.target.value }))} /></Field></div></CollapsiblePanel>
          </Collapsible>
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={Boolean(modelService)}
        title={t("添加模型", "Add model")}
        description={modelService ? `${modelService.name} · ${hostname(modelService.baseUrl)}` : undefined}
        onClose={() => setModelService(null)}
        footer={<><Button variant="ghost" onClick={() => setModelService(null)}>{t("取消", "Cancel")}</Button><Button loading={busy === "add-model"} disabled={!modelId.trim()} onClick={() => void addModel()}>{t("添加模型", "Add model")}</Button></>}
      >
        <div className="grid gap-4"><Field label={t("模型 ID", "Model ID")}><Input autoFocus placeholder="gpt-5.4" value={modelId} onChange={(event) => setModelId(event.target.value)} /></Field><Field label={t("显示名称（可选）", "Display name (optional)")}><Input value={modelName} onChange={(event) => setModelName(event.target.value)} /></Field></div>
      </ResponsiveDialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{deleteTarget?.type === "service" ? t("删除模型服务？", "Delete model service?") : t("删除模型？", "Delete model?")}</AlertDialogTitle><AlertDialogDescription>{deleteTarget?.type === "service" ? t("服务、其模型和加密凭据都会被删除。此操作不可撤销。", "The service, its models, and encrypted credential will be deleted. This cannot be undone.") : t(`将删除模型「${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}」。`, `The model “${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}” will be deleted.`)}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button variant="ghost" />}>{t("取消", "Cancel")}</AlertDialogClose><Button variant="destructive" loading={busy === "delete"} onClick={() => void confirmDelete()}>{t("删除", "Delete")}</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
    </div>
  );
}
