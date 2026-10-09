import { useEffect } from "react";
import { Alert, AlertDescription } from "./alert";
import { notify } from "./toast";
import { cn } from "../../lib/utils";

export function StatusBanner({ error, warning, success, className }: { error?: string; warning?: string; success?: string; className?: string }) {
  const message = error || warning || success || "";
  const variant = error ? "error" : warning ? "warning" : "success";
  const type = error ? "error" : "warning";

  useEffect(() => {
    if (!message || (!error && !warning)) return;
    notify(message, "", type);
  }, [error, message, type, warning]);

  if (!message) return null;
  return (
    <Alert className={cn("mb-4", className)} variant={variant} role={error || warning ? "alert" : "status"}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
