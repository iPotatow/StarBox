import { RiCheckboxCircleLine, RiErrorWarningLine } from "@remixicon/react";
import { Alert, AlertDescription } from "./alert";

export function StatusBanner({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  const isError = Boolean(error);
  return (
    <Alert className="mb-4" variant={isError ? "error" : "success"} role={isError ? "alert" : "status"}>
      {isError ? <RiErrorWarningLine className="mt-0.5 size-4 shrink-0" /> : <RiCheckboxCircleLine className="mt-0.5 size-4 shrink-0" />}
      <AlertDescription>{error || success}</AlertDescription>
    </Alert>
  );
}
