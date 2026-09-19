import { BadgeAlertIcon, CircleCheckIcon } from "../../lib/animated-icons";
import { Alert, AlertDescription } from "./alert";

export function StatusBanner({ error, warning, success }: { error?: string; warning?: string; success?: string }) {
  if (!error && !warning && !success) return null;
  const isError = Boolean(error);
  const isWarning = !isError && Boolean(warning);
  return (
    <Alert className="mb-4" variant={isError ? "error" : isWarning ? "warning" : "success"} role={isError || isWarning ? "alert" : "status"}>
      {isError || isWarning ? <BadgeAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
      <AlertDescription>{error || warning || success}</AlertDescription>
    </Alert>
  );
}
