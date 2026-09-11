import { RiCheckboxCircleLine, RiErrorWarningLine } from "@remixicon/react";

export function StatusBanner({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  const isError = Boolean(error);
  return (
    <div
      role={isError ? "alert" : "status"}
      className={isError
        ? "mb-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive-foreground"
        : "mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300"}
    >
      {isError ? <RiErrorWarningLine className="mt-0.5 size-4 shrink-0" /> : <RiCheckboxCircleLine className="mt-0.5 size-4 shrink-0" />}
      <span>{error || success}</span>
    </div>
  );
}
