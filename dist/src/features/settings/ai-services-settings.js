import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiCheckLine, RiEyeLine, RiEyeOffLine, RiKey2Line, RiRefreshLine } from "@remixicon/react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert.js";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog.js";
import { Badge } from "../../components/ui/badge.js";
import { Button } from "../../components/ui/button.js";
import { Field } from "../../components/ui/field.js";
import { Input } from "../../components/ui/input.js";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group.js";
import { Modal } from "../../components/ui/modal.js";
import { Select } from "../../components/ui/select.js";
import { Switch } from "../../components/ui/switch.js";
import { Textarea } from "../../components/ui/textarea.js";
import { notify } from "../../components/ui/toast.js";
import { addAiModel, createAiService, deleteAiModel, deleteAiService, fetchAiServices, setDefaultAiModel, testAiService, updateAiService } from "../../lib/api.js";
import { useI18n } from "../../lib/i18n.js";
const emptyDraft = () => ({ name: "", protocol: "openai-compatible", baseUrl: "", apiKey: "", modelId: "", modelName: "", headersText: "{}" });
const protocolLabels = {
    "openai-compatible": { zh: "OpenAI 兼容协议", en: "OpenAI Compatible" },
    "anthropic-messages": { zh: "Anthropic Messages", en: "Anthropic Messages" },
    "google-gemini": { zh: "Google Gemini", en: "Google Gemini" },
};
function hostname(url) { try {
    return new URL(url).hostname;
}
catch {
    return url;
} }
function parseHeaders(raw) {
    try {
        const parsed = raw.trim() ? JSON.parse(raw) : {};
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
            throw new Error("Headers must be a JSON object");
        return { headers: Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)])), error: "" };
    }
    catch (reason) {
        return { headers: {}, error: reason instanceof Error ? reason.message : "Invalid headers" };
    }
}
export function AiServicesSettings() {
    const { t } = useI18n();
    const [data, setData] = useState({ defaultModelId: null, services: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");
    const [serviceModal, setServiceModal] = useState(null);
    const [editingService, setEditingService] = useState(null);
    const [serviceDraft, setServiceDraft] = useState(emptyDraft);
    const [showKey, setShowKey] = useState(false);
    const [modelService, setModelService] = useState(null);
    const [modelId, setModelId] = useState("");
    const [modelName, setModelName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    async function load() {
        setLoading(true);
        setError("");
        try {
            setData(await fetchAiServices());
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("AI 服务读取失败", "Failed to load AI services"));
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { void load(); }, []);
    const availableModels = useMemo(() => data.services.filter((service) => service.enabled).flatMap((service) => service.models.filter((model) => model.enabled).map((model) => ({ service, model }))), [data.services]);
    const defaultOption = availableModels.find((item) => item.model.id === data.defaultModelId);
    const headersResult = useMemo(() => parseHeaders(serviceDraft.headersText), [serviceDraft.headersText]);
    function openCreate() { setEditingService(null); setServiceDraft(emptyDraft()); setShowKey(false); setServiceModal("create"); }
    function openEdit(service) { setEditingService(service); setServiceDraft({ name: service.name, protocol: service.protocol, baseUrl: service.baseUrl, apiKey: "", modelId: "", modelName: "", headersText: "{}" }); setShowKey(false); setServiceModal("edit"); }
    async function saveService() {
        if (!serviceDraft.name.trim() || !serviceDraft.baseUrl.trim() || (serviceModal === "create" && !serviceDraft.apiKey.trim()) || headersResult.error)
            return;
        setBusy("save-service");
        setError("");
        try {
            const next = serviceModal === "edit" && editingService
                ? await updateAiService(editingService.id, { name: serviceDraft.name.trim(), protocol: serviceDraft.protocol, baseUrl: serviceDraft.baseUrl.trim(), ...(serviceDraft.apiKey.trim() ? { apiKey: serviceDraft.apiKey.trim() } : {}), ...(serviceDraft.headersText.trim() !== "{}" ? { headers: headersResult.headers } : {}) })
                : await createAiService({ name: serviceDraft.name.trim(), protocol: serviceDraft.protocol, baseUrl: serviceDraft.baseUrl.trim(), apiKey: serviceDraft.apiKey.trim(), headers: headersResult.headers, modelId: serviceDraft.modelId.trim() || undefined, modelName: serviceDraft.modelName.trim() || undefined });
            setData(next);
            setServiceModal(null);
            notify(serviceModal === "edit" ? t("模型服务已更新", "Model service updated") : t("模型服务已添加", "Model service added"), serviceDraft.name.trim(), "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("模型服务保存失败", "Failed to save model service"));
        }
        finally {
            setBusy("");
        }
    }
    async function toggleService(service, enabled) {
        setBusy(`service:${service.id}`);
        setError("");
        try {
            setData(await updateAiService(service.id, { enabled }));
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("服务状态更新失败", "Failed to update service status"));
        }
        finally {
            setBusy("");
        }
    }
    async function test(service) {
        setBusy(`test:${service.id}`);
        setError("");
        try {
            const message = await testAiService(service.id, data.defaultModelId && service.models.some((model) => model.id === data.defaultModelId) ? data.defaultModelId : undefined);
            notify(t("连接测试通过", "Connection test passed"), message, "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("连接测试失败", "Connection test failed"));
        }
        finally {
            setBusy("");
        }
    }
    async function addModel() {
        if (!modelService || !modelId.trim())
            return;
        setBusy("add-model");
        setError("");
        try {
            setData(await addAiModel(modelService.id, modelId.trim(), modelName.trim()));
            setModelService(null);
            setModelId("");
            setModelName("");
            notify(t("模型已添加", "Model added"), modelName.trim() || modelId.trim(), "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("模型添加失败", "Failed to add model"));
        }
        finally {
            setBusy("");
        }
    }
    async function setDefault(modelIdValue) {
        if (!modelIdValue)
            return;
        setBusy(`default:${modelIdValue}`);
        setError("");
        try {
            setData(await setDefaultAiModel(modelIdValue));
            notify(t("默认模型已更新", "Default model updated"), "", "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("默认模型更新失败", "Failed to update default model"));
        }
        finally {
            setBusy("");
        }
    }
    async function confirmDelete() {
        if (!deleteTarget)
            return;
        setBusy("delete");
        setError("");
        try {
            setData(deleteTarget.type === "service" ? await deleteAiService(deleteTarget.service.id) : await deleteAiModel(deleteTarget.service.id, deleteTarget.modelId));
            notify(deleteTarget.type === "service" ? t("模型服务已删除", "Model service deleted") : t("模型已删除", "Model deleted"), "", "success");
            setDeleteTarget(null);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("删除失败", "Delete failed"));
        }
        finally {
            setBusy("");
        }
    }
    return (_jsxs("div", { className: "grid gap-5", children: [_jsxs("div", { className: "rounded-xl border border-border/70 p-4", children: [_jsxs("div", { className: "mb-3", children: [_jsx("p", { className: "text-sm font-medium", children: t("默认模型", "Default model") }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: t("仓库 AI 分析和 Release 总结默认使用此模型。内置提示词保持不变。", "Repository analysis and Release summaries use this model by default. Built-in prompts stay unchanged.") })] }), _jsxs(Select, { value: data.defaultModelId || "", disabled: loading || !availableModels.length, onChange: (event) => void setDefault(event.target.value), children: [_jsx("option", { value: "", disabled: true, children: loading ? t("正在加载…", "Loading…") : t("选择默认模型", "Choose default model") }), availableModels.map(({ service, model }) => _jsxs("option", { value: model.id, children: [model.displayName || model.remoteModelId, " \u00B7 ", service.name] }, model.id))] }), defaultOption ? _jsxs("p", { className: "mt-2 text-xs text-muted-foreground", children: [t("当前", "Current"), ": ", defaultOption.model.displayName || defaultOption.model.remoteModelId, " \u00B7 ", defaultOption.service.name] }) : null] }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-sm font-medium", children: [t("模型服务", "Model services"), " ", _jsx("span", { className: "ml-1 text-muted-foreground", children: data.services.length })] }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: t("一个服务可以添加多个模型。API Key 由 Worker 加密保存。", "Each service can contain multiple models. API keys are encrypted by the Worker.") })] }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => void load(), loading: loading, children: [_jsx(RiRefreshLine, { className: "size-4" }), t("刷新", "Refresh")] }), _jsxs(Button, { size: "sm", onClick: openCreate, children: ["+ ", t("添加模型服务", "Add model service")] })] })] }), error ? _jsx(Alert, { variant: "error", children: _jsx(AlertDescription, { children: error }) }) : null, !loading && !data.services.length ? _jsxs("div", { className: "rounded-xl border border-dashed border-border px-4 py-10 text-center", children: [_jsx("p", { className: "text-sm font-medium", children: t("还没有模型服务", "No model services yet") }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: t("添加第一个服务后即可为仓库分析与 Release 总结选择模型。", "Add a service to choose models for repository analysis and Release summaries.") }), _jsxs(Button, { className: "mt-4", size: "sm", onClick: openCreate, children: ["+ ", t("添加模型服务", "Add model service")] })] }) : null, _jsx("div", { className: "grid gap-3", children: data.services.map((service) => (_jsxs("article", { className: "rounded-xl border border-border/70 p-4", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("h3", { className: "truncate text-sm font-semibold", children: service.name }), _jsx(Badge, { variant: "secondary", size: "sm", children: t(protocolLabels[service.protocol].zh, protocolLabels[service.protocol].en) }), service.credentialConfigured ? _jsx(Badge, { variant: "success", size: "sm", children: t("凭据已配置", "Credential set") }) : _jsx(Badge, { variant: "warning", size: "sm", children: t("缺少凭据", "Credential missing") })] }), _jsx("p", { className: "mt-1 truncate text-xs text-muted-foreground", children: hostname(service.baseUrl) })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: service.enabled ? t("已启用", "Enabled") : t("已停用", "Disabled") }), _jsx(Switch, { checked: service.enabled, disabled: busy === `service:${service.id}`, onCheckedChange: (checked) => void toggleService(service, checked), "aria-label": t("启用模型服务", "Enable model service") }), _jsx(Button, { variant: "ghost", size: "icon-sm", "aria-label": t("添加模型", "Add model"), onClick: () => { setModelService(service); setModelId(""); setModelName(""); }, children: "+" }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: () => void test(service), loading: busy === `test:${service.id}`, children: [_jsx(RiKey2Line, { className: "size-4" }), t("测试", "Test")] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => openEdit(service), children: t("编辑", "Edit") }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setDeleteTarget({ type: "service", service }), children: t("删除", "Delete") })] })] }), _jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: service.models.length ? service.models.map((model) => {
                                const isDefault = model.id === data.defaultModelId;
                                return _jsxs("div", { className: `inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs ${isDefault ? "border-primary/40 bg-primary/5" : "border-border/70 bg-secondary/30"}`, children: [_jsx("button", { type: "button", className: "font-medium outline-none", disabled: !service.enabled || !model.enabled || isDefault, onClick: () => void setDefault(model.id), children: model.displayName || model.remoteModelId }), isDefault ? _jsxs(Badge, { size: "sm", variant: "success", children: [_jsx(RiCheckLine, { className: "size-3" }), t("默认", "Default")] }) : null, _jsx("button", { type: "button", className: "ml-1 text-muted-foreground hover:text-destructive-foreground", "aria-label": t("删除模型", "Delete model"), onClick: () => setDeleteTarget({ type: "model", service, modelId: model.id, modelName: model.displayName || model.remoteModelId }), children: "\u00D7" })] }, model.id);
                            }) : _jsx("p", { className: "text-xs text-muted-foreground", children: t("暂无模型。点击 + 添加模型 ID。", "No models yet. Use + to add a model ID.") }) })] }, service.id))) }), _jsx(Alert, { variant: "info", children: _jsx(AlertDescription, { children: t("Repository 与 Release 的内置 AI 提示词本轮保持原样；这里只改变模型服务和默认模型的选择方式。", "The built-in Repository and Release prompts are unchanged; this only changes model service management and default-model selection.") }) }), _jsx(Modal, { open: Boolean(serviceModal), title: serviceModal === "edit" ? t("编辑模型服务", "Edit model service") : t("添加模型服务", "Add model service"), description: t("凭据会在 Worker 端加密保存，不会从安全读取接口回显。", "Credentials are encrypted by the Worker and are never returned by safe read APIs."), onClose: () => setServiceModal(null), className: "sm:max-w-xl", children: _jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx(Field, { label: t("服务名称", "Service name"), children: _jsx(Input, { value: serviceDraft.name, onChange: (event) => setServiceDraft((current) => ({ ...current, name: event.target.value })) }) }), _jsx(Field, { label: t("API 协议", "API protocol"), children: _jsxs(Select, { value: serviceDraft.protocol, onChange: (event) => setServiceDraft((current) => ({ ...current, protocol: event.target.value })), children: [_jsx("option", { value: "openai-compatible", children: "OpenAI Compatible" }), _jsx("option", { value: "anthropic-messages", children: "Anthropic Messages" }), _jsx("option", { value: "google-gemini", children: "Google Gemini" })] }) })] }), _jsx(Field, { label: "Base URL", children: _jsx(Input, { inputMode: "url", placeholder: serviceDraft.protocol === "anthropic-messages" ? "https://api.anthropic.com" : serviceDraft.protocol === "google-gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1", value: serviceDraft.baseUrl, onChange: (event) => setServiceDraft((current) => ({ ...current, baseUrl: event.target.value })) }) }), _jsx(Field, { label: "API Key", description: serviceModal === "edit" && editingService?.credentialConfigured ? t("已保存；留空保持现有凭据。", "Already saved; leave blank to keep the existing credential.") : undefined, children: _jsxs(InputGroup, { children: [_jsx(InputGroupInput, { type: showKey ? "text" : "password", autoComplete: "off", value: serviceDraft.apiKey, onChange: (event) => setServiceDraft((current) => ({ ...current, apiKey: event.target.value })) }), _jsx(InputGroupAddon, { align: "inline-end", children: _jsx(Button, { type: "button", variant: "ghost", size: "icon-sm", onClick: () => setShowKey((value) => !value), "aria-label": showKey ? t("隐藏 API Key", "Hide API Key") : t("显示 API Key", "Show API Key"), children: showKey ? _jsx(RiEyeOffLine, { className: "size-4" }) : _jsx(RiEyeLine, { className: "size-4" }) }) })] }) }), serviceModal === "create" ? _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx(Field, { label: t("首个模型 ID（可选）", "First model ID (optional)"), children: _jsx(Input, { placeholder: "gpt-5.4", value: serviceDraft.modelId, onChange: (event) => setServiceDraft((current) => ({ ...current, modelId: event.target.value })) }) }), _jsx(Field, { label: t("显示名称（可选）", "Display name (optional)"), children: _jsx(Input, { value: serviceDraft.modelName, onChange: (event) => setServiceDraft((current) => ({ ...current, modelName: event.target.value })) }) })] }) : null, _jsxs("details", { className: "rounded-xl border border-border/70 px-4 py-3", children: [_jsx("summary", { className: "cursor-pointer text-sm font-medium", children: t("高级设置", "Advanced settings") }), _jsx("div", { className: "mt-4", children: _jsx(Field, { label: t("自定义请求头", "Custom headers"), error: headersResult.error, children: _jsx(Textarea, { className: "min-h-28 font-mono text-xs", spellCheck: false, value: serviceDraft.headersText, onChange: (event) => setServiceDraft((current) => ({ ...current, headersText: event.target.value })) }) }) })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => setServiceModal(null), children: t("取消", "Cancel") }), _jsx(Button, { loading: busy === "save-service", disabled: !serviceDraft.name.trim() || !serviceDraft.baseUrl.trim() || (serviceModal === "create" && !serviceDraft.apiKey.trim()) || Boolean(headersResult.error), onClick: () => void saveService(), children: serviceModal === "edit" ? t("保存", "Save") : t("添加服务", "Add service") })] })] }) }), _jsx(Modal, { open: Boolean(modelService), title: t("添加模型", "Add model"), description: modelService ? `${modelService.name} · ${hostname(modelService.baseUrl)}` : undefined, onClose: () => setModelService(null), children: _jsxs("div", { className: "grid gap-4", children: [_jsx(Field, { label: t("模型 ID", "Model ID"), children: _jsx(Input, { autoFocus: true, placeholder: "gpt-5.4", value: modelId, onChange: (event) => setModelId(event.target.value) }) }), _jsx(Field, { label: t("显示名称（可选）", "Display name (optional)"), children: _jsx(Input, { value: modelName, onChange: (event) => setModelName(event.target.value) }) }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => setModelService(null), children: t("取消", "Cancel") }), _jsx(Button, { loading: busy === "add-model", disabled: !modelId.trim(), onClick: () => void addModel(), children: t("添加模型", "Add model") })] })] }) }), _jsx(AlertDialog, { open: Boolean(deleteTarget), onOpenChange: (open) => { if (!open)
                    setDeleteTarget(null); }, children: _jsxs(AlertDialogPopup, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: deleteTarget?.type === "service" ? t("删除模型服务？", "Delete model service?") : t("删除模型？", "Delete model?") }), _jsx(AlertDialogDescription, { children: deleteTarget?.type === "service" ? t("服务、其模型和加密凭据都会被删除。此操作不可撤销。", "The service, its models, and encrypted credential will be deleted. This cannot be undone.") : t(`将删除模型「${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}」。`, `The model “${deleteTarget?.type === "model" ? deleteTarget.modelName : ""}” will be deleted.`) })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogClose, { render: _jsx(Button, { variant: "ghost" }), children: t("取消", "Cancel") }), _jsx(Button, { variant: "destructive", loading: busy === "delete", onClick: () => void confirmDelete(), children: t("删除", "Delete") })] })] }) })] }));
}
