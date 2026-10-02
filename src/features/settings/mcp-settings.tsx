import { useEffect, useState } from "react";
import { ArrowsClockwise, Copy, Plug, Trash } from "@phosphor-icons/react";
import type { McpConnections, McpToken, McpTokenCreated } from "../../../shared/mcp";
import { MCP_READ_TOOLS } from "../../../shared/mcp";
import { jsonRequest } from "../../lib/api-client";
import { useI18n } from "../../lib/i18n";
import { notify } from "../../components/ui/toast";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Switch } from "../../components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { SettingsList, SettingsRow, SettingsRowActions, SettingsRowContent, SettingsRowDescription, SettingsRowTitle } from "../../components/patterns/settings-list";

export function McpSettings() {
  const { t, locale } = useI18n();
  const [connections, setConnections] = useState<McpConnections>({ endpoint: new URL("/mcp", window.location.origin).href, tokens: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [writeMetadata, setWriteMetadata] = useState(false);
  const [days, setDays] = useState("90");
  const [created, setCreated] = useState<McpTokenCreated | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<McpToken | null>(null);
  const [testStatus, setTestStatus] = useState("");
  const disabled = loading || busy;
  const configuration = JSON.stringify({ mcpServers: { starbox: { url: connections.endpoint, headers: { Authorization: `Bearer ${created?.token ?? "<STARBOX_MCP_TOKEN>"}` } } } }, null, 2);
  const formatDate = (value: string) => new Date(value).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    let active = true;
    void jsonRequest<McpConnections>("/api/mcp/connections").then((data) => { if (active) setConnections(data); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t("读取连接失败", "Failed to load connections", "讀取連線失敗")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function refresh() {
    setBusy(true); setError("");
    try { setConnections(await jsonRequest<McpConnections>("/api/mcp/connections")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("读取连接失败", "Failed to load connections", "讀取連線失敗")); }
    finally { setBusy(false); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); notify(t("已复制", "Copied", "已複製"), "", "success"); }
    catch { setError(t("复制失败，请手动选择文本复制", "Copy failed. Select the text and copy it manually.", "複製失敗，請手動選取文字複製")); }
  }
  async function create() {
    setBusy(true); setError(""); setTestStatus("");
    try {
      const data = await jsonRequest<McpTokenCreated>("/api/mcp/connections", { method: "POST", body: JSON.stringify({ name: name.trim(), writeMetadata, expiresInDays: Number(days) }) });
      setCreated(data); setName(""); setWriteMetadata(false);
      setConnections((current) => ({ ...current, tokens: [data.connection, ...current.tokens] }));
      notify(t("MCP 连接已创建", "MCP connection created", "MCP 連線已建立"), data.connection.name, "success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("创建连接失败", "Failed to create connection", "建立連線失敗")); }
    finally { setBusy(false); }
  }
  async function updatePermission(token: McpToken, enabled: boolean) {
    setBusy(true); setError("");
    try {
      await jsonRequest(`/api/mcp/connections/${token.id}`, { method: "PATCH", body: JSON.stringify({ writeMetadata: enabled }) });
      setConnections((current) => ({ ...current, tokens: current.tokens.map((item) => item.id === token.id ? { ...item, writeMetadata: enabled } : item) }));
      setTestStatus("");
      notify(t("连接权限已更新", "Connection permissions updated", "連線權限已更新"), token.name, "success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("更新权限失败", "Failed to update permissions", "更新權限失敗")); }
    finally { setBusy(false); }
  }
  async function revoke() {
    if (!revokeTarget) return;
    const target = revokeTarget;
    setBusy(true); setError("");
    try {
      await jsonRequest(`/api/mcp/connections/${target.id}`, { method: "DELETE" });
      setConnections((current) => ({ ...current, tokens: current.tokens.filter((item) => item.id !== target.id) }));
      if (created?.connection.id === target.id) { setCreated(null); setTestStatus(""); }
      setRevokeTarget(null);
      notify(t("MCP 连接已撤销", "MCP connection revoked", "MCP 連線已撤銷"), target.name, "success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("撤销失败", "Failed to revoke connection", "撤銷失敗")); }
    finally { setBusy(false); }
  }
  async function testConnection() {
    if (!created) return;
    setBusy(true); setError(""); setTestStatus("");
    try {
      const response = await jsonRequest<{ result?: { tools?: Array<{ name: string }> }; error?: { message: string } }>(connections.endpoint, { method: "POST", credentials: "omit", headers: { Authorization: `Bearer ${created.token}`, Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-11-25" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
      if (response.error || !response.result?.tools) throw new Error(response.error?.message || t("MCP 返回无效", "Invalid MCP response", "MCP 回傳無效"));
      setTestStatus(t(`连接正常 · ${response.result.tools.length} 个工具可用`, `Connected · ${response.result.tools.length} tools available`, `連線正常 · ${response.result.tools.length} 個工具可用`));
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("连接测试失败", "Connection test failed", "連線測試失敗")); }
    finally { setBusy(false); }
  }

  return <div className="min-w-0 max-w-5xl divide-y divide-border/60">
    <section className="grid min-w-0 gap-4 py-7">
      <header><h2 className="flex items-center gap-2 text-base font-semibold"><Plug className="size-5" aria-hidden="true" />{t("MCP 连接", "MCP connections", "MCP 連線")}</h2><p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{t("让 AI 助手搜索你的收藏、阅读备注和 README、查询订阅版本。每个连接使用独立凭据，默认只读。", "Let AI assistants search your collection, read notes and READMEs, and check subscribed releases. Each connection has its own token and starts read-only.", "讓 AI 助手搜尋你的收藏、閱讀備註和 README、查詢訂閱版本。每個連線使用獨立憑據，預設唯讀。")}</p></header>
      {error ? <Alert variant="error"><AlertDescription role="alert">{error}</AlertDescription></Alert> : null}
      <Field label={t("连接地址", "Endpoint", "連線位址")}><div className="flex min-w-0 gap-2"><Input type="text" readOnly value={connections.endpoint} className="min-w-0 flex-1 font-mono text-xs" /><Button type="button" variant="outline" aria-label={t("复制连接地址", "Copy endpoint", "複製連線位址")} onClick={() => void copy(connections.endpoint)}><Copy className="size-4" aria-hidden="true" /></Button></div></Field>
      <p className="text-xs leading-5 text-muted-foreground">{t("支持 Streamable HTTP 和 Bearer 请求头认证的客户端。收藏查询使用已同步的数据；README 和 Release 从 GitHub 实时读取。", "Use a client supporting Streamable HTTP and Bearer headers. Collection queries use synced data; READMEs and releases are fetched live from GitHub.", "支援 Streamable HTTP 和 Bearer 請求標頭驗證的客戶端。收藏查詢使用已同步的資料；README 和 Release 從 GitHub 即時讀取。")}</p>
    </section>
    <section className="grid min-w-0 gap-4 py-7">
      <h2 className="text-base font-semibold">{t("创建连接", "Create connection", "建立連線")}</h2>
      <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void create(); }}>
        <Field label={t("连接名称", "Connection name", "連線名稱")}><Input type="text" value={name} maxLength={80} required disabled={disabled || Boolean(created)} placeholder={t("例如：我的 AI 助手", "For example: My AI assistant", "例如：我的 AI 助手")} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label={t("有效期", "Expires after", "有效期")}><ToggleGroup aria-label={t("有效期", "Expires after", "有效期")} value={[days]} onValueChange={(value) => { if (value[0]) setDays(value[0]); }} disabled={disabled || Boolean(created)}>{["7", "30", "90"].map((value) => <ToggleGroupItem className="w-auto min-w-16 px-3" key={value} value={value}>{t(`${value} 天`, `${value} days`, `${value} 天`)}</ToggleGroupItem>)}</ToggleGroup></Field>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4"><div><p id="mcp-write-label" className="text-sm font-medium">{t("允许整理收藏", "Allow collection edits", "允許整理收藏")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{t("允许修改备注、分类和标签。AI 应先展示方案；版本冲突会阻止覆盖。", "Allow notes, categories and tags to be edited. The AI should show its proposal first; revision conflicts prevent overwrites.", "允許修改備註、分類和標籤。AI 應先展示方案；版本衝突會阻止覆寫。")}</p></div><Switch aria-labelledby="mcp-write-label" checked={writeMetadata} onCheckedChange={setWriteMetadata} disabled={disabled || Boolean(created)} /></div>
        <Button type="submit" className="w-fit" disabled={disabled || !name.trim() || Boolean(created)}>{busy ? t("处理中…", "Working…", "處理中…") : t("创建连接凭据", "Create connection token", "建立連線憑據")}</Button>
      </form>
      {created ? <div className="grid min-w-0 gap-3 rounded-xl border border-border/70 bg-muted/40 p-4">
        <p className="text-sm font-medium">{t("凭据仅显示这一次，请保存到你的客户端。", "This token is shown only once. Save it in your client.", "憑據僅顯示這一次，請儲存到你的客戶端。")}</p>
        <Field label={t("连接凭据", "Connection token", "連線憑據")}><Input type="text" readOnly value={created.token} className="font-mono text-xs" /></Field>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void copy(created.token)}>{t("复制凭据", "Copy token", "複製憑據")}</Button><Button type="button" variant="outline" onClick={() => void testConnection()} disabled={disabled}>{t("测试连接", "Test connection", "測試連線")}</Button><Button type="button" variant="ghost" disabled={disabled} onClick={() => { setCreated(null); setTestStatus(""); }}>{t("已保存，隐藏凭据", "Saved, hide token", "已儲存，隱藏憑據")}</Button></div>
        {testStatus ? <p role="status" className="text-sm text-success-foreground">{testStatus}</p> : null}
      </div> : null}
      <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{t("客户端配置示例", "Client configuration example", "客戶端設定範例")}</h3><Button type="button" variant="outline" size="sm" onClick={() => void copy(configuration)}>{t("复制配置", "Copy configuration", "複製設定")}</Button></div>
      <pre className="max-w-full overflow-x-auto rounded-xl border border-border/70 bg-muted/40 p-4 text-xs leading-6"><code>{configuration}</code></pre>
      <p className="text-xs leading-5 text-muted-foreground">{t("客户端配置格式可能不同，请将连接地址与 Authorization 请求头填入对应位置。", "Client configuration formats vary. Enter the endpoint and Authorization header in the corresponding fields.", "客戶端設定格式可能不同，請將連線位址與 Authorization 請求標頭填入對應位置。")}</p>
    </section>
    <section className="grid gap-4 py-7">
      <div className="flex items-center justify-between"><h2 className="text-base font-semibold">{t("已创建的连接", "Your connections", "已建立的連線")}</h2><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => void refresh()}><ArrowsClockwise className="size-4" aria-hidden="true" />{t("刷新", "Refresh", "重新整理")}</Button></div>
      {loading ? <p role="status" className="text-sm text-muted-foreground">{t("正在读取连接…", "Loading connections…", "正在讀取連線…")}</p> : connections.tokens.length ? <SettingsList>{connections.tokens.map((token) => {
        const expired = Date.parse(token.expiresAt) <= Date.now();
        return <SettingsRow key={token.id}>
          <SettingsRowContent><SettingsRowTitle>{token.name}</SettingsRowTitle><SettingsRowDescription>{expired ? t("已过期", "Expired", "已過期") : t("有效期至", "Expires", "有效期至")} · {formatDate(token.expiresAt)}</SettingsRowDescription><SettingsRowDescription>{t("最近使用", "Last used", "最近使用")} · {token.lastUsedAt ? formatDate(token.lastUsedAt) : t("尚未使用", "Never used", "尚未使用")}</SettingsRowDescription></SettingsRowContent>
          <SettingsRowActions><div className="flex items-center gap-2 text-xs"><span>{t("整理收藏", "Edit collection", "整理收藏")}</span><Switch aria-label={t(`允许 ${token.name} 整理收藏`, `Allow ${token.name} to edit collection`, `允許 ${token.name} 整理收藏`)} disabled={disabled || expired} checked={token.writeMetadata} onCheckedChange={(enabled) => void updatePermission(token, enabled)} /></div><Button type="button" variant="destructive-outline" size="sm" disabled={disabled} onClick={() => setRevokeTarget(token)}><Trash className="size-4" aria-hidden="true" />{t("撤销", "Revoke", "撤銷")}</Button></SettingsRowActions>
        </SettingsRow>;
      })}</SettingsList> : <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t("还没有连接。创建一个凭据即可开始。", "No connections yet. Create a token to get started.", "還沒有連線。建立一個憑據即可開始。")}</p>}
    </section>
    <section className="grid gap-3 py-7"><h2 className="text-base font-semibold">{t("可用能力", "Available tools", "可用能力")}</h2><p className="text-sm leading-6 text-muted-foreground">{t("试着问 AI：“我的收藏里有什么适合当前项目？”或“我订阅的项目最近发布了哪些版本？”", "Ask your AI: “Which projects in my collection suit this project?” or “What are the latest releases from my subscriptions?”", "試著問 AI：「我的收藏裡有什麼適合當前專案？」或「我訂閱的專案最近發布了哪些版本？」")}</p><div className="flex flex-wrap gap-2">{[...MCP_READ_TOOLS, "update_repository_metadata"].map((tool) => <code key={tool} className="max-w-full break-all rounded-md bg-muted px-2 py-1 text-xs">{tool}</code>)}</div><p className="text-xs text-muted-foreground">{t("修改工具仅向开启「整理收藏」权限的连接提供。", "The edit tool is available only to connections with collection edit permission.", "修改工具僅向開啟「整理收藏」權限的連線提供。")}</p></section>
    <AlertDialog open={Boolean(revokeTarget)} onOpenChange={(open) => { if (!open && !busy) setRevokeTarget(null); }}><AlertDialogPopup><AlertDialogHeader><AlertDialogTitle>{t("撤销 MCP 连接", "Revoke MCP connection", "撤銷 MCP 連線")}</AlertDialogTitle><AlertDialogDescription>{t(`撤销「${revokeTarget?.name ?? ""}」后，该客户端将无法继续访问 StarBox。`, `After revoking “${revokeTarget?.name ?? ""}”, that client will lose access to StarBox.`, `撤銷「${revokeTarget?.name ?? ""}」後，該客戶端將無法繼續存取 StarBox。`)}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogClose render={<Button type="button" variant="outline" disabled={busy} />}>{t("取消", "Cancel", "取消")}</AlertDialogClose><Button type="button" variant="destructive" disabled={busy} onClick={() => void revoke()}>{t("撤销连接", "Revoke connection", "撤銷連線")}</Button></AlertDialogFooter></AlertDialogPopup></AlertDialog>
  </div>;
}
