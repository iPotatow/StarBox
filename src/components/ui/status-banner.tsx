import { useEffect } from "react";
import { notify } from "./toast";

export function StatusBanner({ error, warning, success }: { error?: string; warning?: string; success?: string }) {
  const message = error || warning || success || "";
  const type = error ? "error" : warning ? "warning" : "success";

  useEffect(() => {
    if (!message) return;
    notify(message, "", type);
  }, [message, type]);

  return null;
}
