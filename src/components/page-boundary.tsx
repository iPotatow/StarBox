import { Component, type PropsWithChildren } from "react";
import { Button } from "./ui/button";
import { useI18n } from "../lib/i18n";

function PageLoadFailure() {
  const { t } = useI18n();
  return <div className="grid min-h-48 place-content-center justify-items-center gap-4 p-6" role="alert">
    <p className="text-sm text-muted-foreground">{t("页面暂时无法加载，请重新加载。", "This page could not load. Please reload.", "頁面暫時無法載入，請重新載入。")}</p>
    <Button variant="outline" onClick={() => window.location.reload()}>{t("重新加载", "Reload", "重新載入")}</Button>
  </div>;
}

/** A failed page chunk leaves navigation and account controls available. */
export class PageBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <PageLoadFailure /> : this.props.children; }
}
