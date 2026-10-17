import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, CaretRight, Eye, EyeSlash, LockSimple, X } from "@phosphor-icons/react";
import { Dialog, DialogClose, DialogDescription, DialogBackdrop, DialogViewport, DialogPortal, DialogPrimitive, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../../components/ui/collapsible";
import { FieldRoot, FieldLabel, FieldError } from "../../components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { notify } from "../../components/ui/toast";
import { replaceGithubCredential } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { StateChange } from "../../types";

export function GithubConnectionPanel({ open, onClose, onStateChange, onConnected }: {
  open: boolean; onClose: () => void; onStateChange: StateChange; onConnected?: () => void;
}) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  return <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
    <DialogPortal>
      <DialogBackdrop className="sb-github-dialog-backdrop" />
      <DialogViewport className="sb-github-dialog-viewport">
      <DialogPrimitive.Popup data-slot="github-connection-panel" className="sb-github-panel">
        <header className="sb-github-panel-header">
          <div><DialogTitle>{t("连接 GitHub", "Connect GitHub", "連線 GitHub")}</DialogTitle><DialogDescription>{t("连接后可同步 Stars、Release 和 Fork。", "Connect to sync Stars, Releases, and Forks.", "連線後可同步 Stars、Release 和 Fork。")}</DialogDescription></div>
          <DialogClose disabled={saving} render={<Button type="button" variant="ghost" size="icon" aria-label={t("关闭", "Close", "關閉")} />}><X aria-hidden="true" className="size-4" /></DialogClose>
        </header>
        {open ? <ConnectionForm onClose={onClose} onStateChange={onStateChange} onConnected={onConnected} onPendingChange={setSaving} /> : null}
      </DialogPrimitive.Popup>
      </DialogViewport>
    </DialogPortal>
  </Dialog>;
}

function ConnectionForm({ onClose, onStateChange, onConnected, onPendingChange }: Omit<Parameters<typeof GithubConnectionPanel>[0], "open"> & { onPendingChange: (pending: boolean) => void }) {
  const { t } = useI18n();
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState("");
  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token.trim() || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true); onPendingChange(true); setError("");
    try {
      const credential = await replaceGithubCredential(token.trim());
      onStateChange((current) => ({ ...current, settings: { ...current.settings, githubToken: "", githubIdentity: credential.identity, credentialConnected: credential.connected } }));
      setToken("");
      notify(t("GitHub 已连接", "GitHub connected", "GitHub 已連線"), t("可以同步你的 Stars 了。", "You can now sync your Stars.", "可以同步你的 Stars 了。"), "success");
      onClose(); onConnected?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("暂时无法连接 GitHub，请稍后重试。", "Cannot connect to GitHub. Try again later.", "暫時無法連線 GitHub，請稍後重試。"));
    } finally { pendingRef.current = false; setPending(false); onPendingChange(false); }
  }
  return <form className="sb-github-panel-form" onSubmit={connect} aria-busy={pending}>
    <div className="sb-github-panel-body">
      <FieldRoot invalid={Boolean(error) || undefined}>
        <div className="sb-github-label-row"><FieldLabel>Personal Access Token</FieldLabel>
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer" className="sb-github-create-link">{t("前往 GitHub 创建 Token", "Create a Token on GitHub", "前往 GitHub 建立 Token")}<ArrowUpRight aria-hidden="true" className="size-4" /></a></div>
        <InputGroup><InputGroupInput type={visible ? "text" : "password"} autoComplete="off" spellCheck={false} autoCapitalize="none" value={token} placeholder="github_pat_…" disabled={pending} onChange={(event) => { setToken(event.target.value); setError(""); }} /><InputGroupAddon align="inline-end"><Button type="button" variant="ghost" size="icon-sm" aria-label={visible ? t("隐藏 Token", "Hide Token", "隱藏 Token") : t("显示 Token", "Show Token", "顯示 Token")} onClick={() => setVisible((value) => !value)}>{visible ? <EyeSlash aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}</Button></InputGroupAddon></InputGroup>
        {error ? <FieldError match={true} role="alert">{error}</FieldError> : null}
      </FieldRoot>
      <Collapsible className="sb-github-permissions">
        <CollapsibleTrigger render={<Button type="button" variant="ghost" />}><CaretRight className="size-4" aria-hidden="true" />{t("如何配置权限", "Configure permissions", "如何設定權限")}</CollapsibleTrigger>
        <CollapsiblePanel><div className="sb-github-permissions-copy">
          <p>{t("支持 Fine-grained 和 Classic Token。建议优先使用 Fine-grained，并设置有效期。", "Fine-grained and Classic tokens are supported. Prefer a fine-grained token with an expiration date.", "支援 Fine-grained 和 Classic Token。建議優先使用 Fine-grained，並設定有效期。")}</p>
          <ul><li>{t("同步 Stars：账户权限 Starring → Read-only。", "Sync Stars: account permission Starring → Read-only.", "同步 Stars：帳戶權限 Starring → Read-only。")}</li><li>{t("需要取消 Star 时，再启用 Starring → Read and write。", "To unstar repositories, enable Starring → Read and write.", "需要取消 Star 時，再啟用 Starring → Read and write。")}</li><li>{t("访问私有仓库需将其加入授权范围；查看其工作流状态还需 Actions → Read-only。", "Include private repositories in the token scope; reading their workflow status also requires Actions → Read-only.", "存取私有儲存庫需將其加入授權範圍；查看其工作流程狀態還需 Actions → Read-only。")}</li></ul>
          <a href="https://docs.github.com/en/rest/activity/starring#list-repositories-starred-by-the-authenticated-user" target="_blank" rel="noopener noreferrer">{t("查看 GitHub 权限文档", "GitHub permission reference", "查看 GitHub 權限文件")}<ArrowUpRight className="size-3" aria-hidden="true" /></a>
          <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer">{t("改用 Classic Token", "Create a Classic token instead", "改用 Classic Token")}<ArrowUpRight className="size-3" aria-hidden="true" /></a>
        </div></CollapsiblePanel>
      </Collapsible>
    </div>
    <footer className="sb-github-panel-footer"><p><LockSimple aria-hidden="true" className="size-4 shrink-0" />{t("Token 加密保存在你的 StarBox 服务中，保存后不会显示明文。", "Your Token is encrypted on your StarBox server and is never displayed after saving.", "Token 加密儲存在你的 StarBox 服務中，儲存後不會顯示明文。")}</p><div><Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("取消", "Cancel", "取消")}</Button><Button type="submit" loading={pending} disabled={!token.trim() || pending}>{pending ? t("正在验证…", "Verifying…", "正在驗證…") : t("验证并连接", "Verify and connect", "驗證並連線")}</Button></div></footer>
  </form>;
}
