import { useEffect, useState } from "react";
import { Copy } from "@phosphor-icons/react";
import { parseBuildInfo, sameBuild, type BuildInfo, type SystemInfo } from "../../../shared/system-info";
import { jsonRequest } from "../../lib/api-client";
import { useI18n } from "../../lib/i18n";
import { notify } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";

const identity = __STARBOX_BUILD_IDENTITY__;
export function AboutSettings() {
  const { t } = useI18n();
  const [server, setServer] = useState<SystemInfo | null>(null);
  const [clientBuild, setClientBuild] = useState<BuildInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState("");
  async function collect(signal?: AbortSignal) {
    setLoading(true); setError("");
    const [instance, manifest] = await Promise.allSettled([
      jsonRequest<SystemInfo>("/api/system/info", { signal, cache: "no-store" }),
      jsonRequest<unknown>("/build-info.json", { signal, cache: "no-store" }),
    ]);
    if (signal?.aborted) return;
    if (instance.status === "fulfilled") setServer(instance.value);
    else { setServer(null); setError(instance.reason instanceof Error ? instance.reason.message : t("实例信息暂不可用", "Instance information is unavailable", "實例資訊暫不可用")); }
    const metadata = manifest.status === "fulfilled" ? parseBuildInfo(manifest.value) : null;
    // The current deployment's timestamp must not be attributed to an older loaded bundle.
    setClientBuild(metadata && sameBuild(identity, metadata) ? metadata : null);
    setLoading(false);
  }
  useEffect(() => {
    const controller = new AbortController();
    void collect(controller.signal);
    return () => controller.abort();
  }, []);

  async function copy() {
    setCopying(true);
    try {
      const client = await import("../../lib/system-info").then(({ captureSystemClient }) => captureSystemClient());
      const diagnostics = { instanceError: error || null, application: "StarBox", clientBuild: { ...identity, builtAt: clientBuild?.builtAt ?? null }, instance: server, client, capturedAt: new Date().toISOString() };
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      notify(t("诊断信息已复制", "Diagnostics copied", "診斷資訊已複製"), t("可粘贴到问题反馈中", "Paste it into your issue report", "可貼到問題回報中"), "success");
    } catch { notify(t("复制失败", "Copy failed", "複製失敗"), t("请检查浏览器剪贴板权限后重试", "Check browser clipboard permissions and try again", "請檢查瀏覽器剪貼簿權限後重試"), "error"); }
    finally { setCopying(false); }
  }
  return <section className="mt-7 border-t border-border/70 pt-5" aria-label={t("关于", "About", "關於")}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-medium">{t("关于", "About", "關於")} StarBox</h2><p className="mt-1 text-xs text-muted-foreground">v{identity.version}</p></div>
      <Button type="button" variant="ghost" size="sm" disabled={loading || copying} onClick={() => void copy()}><Copy className="size-4" aria-hidden="true" />{t("复制诊断信息", "Copy diagnostics", "複製診斷資訊")}</Button>
    </div>
    {server?.build && !sameBuild(identity, server.build) ? <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span>{t("有新部署，刷新可获取当前版本。", "A new deployment is available. Reload to get the current version.", "有新部署，重新整理可取得目前版本。")}</span><Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>{t("刷新页面", "Reload", "重新整理頁面")}</Button></div> : null}
  </section>;
}
