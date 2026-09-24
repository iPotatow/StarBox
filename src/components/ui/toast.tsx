import { Toast as BaseToast } from "@base-ui/react/toast";
import { Warning as BadgeAlertIcon, CheckCircle as CircleCheckIcon, Question as CircleHelpIcon, SpinnerGap as LoaderCircleIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

const ToastPrimitive = BaseToast;

export const toastManager = ToastPrimitive.createToastManager();

export function notify(
  title: string,
  description = "",
  type: "success" | "error" | "info" | "warning" | "loading" = "info",
) {
  return toastManager.add({ title, description, type });
}

const icons: Record<string, typeof CircleHelpIcon> = {
  error: BadgeAlertIcon,
  success: CircleCheckIcon,
  info: CircleHelpIcon,
  loading: LoaderCircleIcon,
  warning: BadgeAlertIcon,
};

function ToastViewport() {
  const { toasts } = ToastPrimitive.useToastManager();

  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport
        data-position="top-center"
        data-slot="toast-viewport"
        className="fixed top-4 left-1/2 z-[80] mx-auto flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2"
      >
        {toasts.map((toast) => {
          const Icon = icons[toast.type ?? "info"] ?? CircleHelpIcon;
          return (
            <ToastPrimitive.Root
              key={toast.id}
              toast={toast}
              swipeDirection={["up"]}
              data-type={toast.type}
              className={cn(
                "absolute top-0 left-0 right-0 z-[calc(9999-var(--toast-index))] h-(--toast-calc-height) w-full select-none rounded-xl border bg-popover text-popover-foreground shadow-lg/10",
                "[--toast-calc-height:var(--toast-frontmost-height,var(--toast-height))] [--toast-gap:0.75rem] [--toast-peek:0.75rem] [--toast-scale:calc(max(0,1-(var(--toast-index)*.1)))] [--toast-shrink:calc(1-var(--toast-scale))]",
                "[--toast-calc-offset-y:calc(var(--toast-offset-y)+var(--toast-index)*var(--toast-gap)+var(--toast-swipe-movement-y))]",
                "transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+(var(--toast-index)*var(--toast-peek))+(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
                "[transition:transform_.5s_cubic-bezier(.22,1,.36,1),opacity_.5s,height_.15s,background-color_.5s]",
                "data-[limited]:opacity-0 data-[expanded]:h-(--toast-height) data-[expanded]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--toast-calc-offset-y))]",
                "data-[starting-style]:transform-[translateY(calc(-100%-1rem))] data-[ending-style]:opacity-0",
                "data-[ending-style]:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%-1rem))]",
                "motion-reduce:transition-none",
              )}
            >
              <ToastPrimitive.Content className="pointer-events-auto flex items-start gap-2 overflow-hidden px-3.5 py-3 text-sm transition-opacity duration-200 data-[behind]:pointer-events-none data-[behind]:opacity-0 data-[expanded]:pointer-events-auto data-[expanded]:opacity-100 motion-reduce:transition-none">
                <Icon
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    toast.type === "loading" && "animate-spin",
                    toast.type === "success" && "text-success-foreground",
                    toast.type === "error" && "text-destructive-foreground",
                    toast.type === "info" && "text-info-foreground",
                    toast.type === "warning" && "text-warning-foreground",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <ToastPrimitive.Title className="font-medium" />
                  <ToastPrimitive.Description className="mt-0.5 text-muted-foreground" />
                </div>
              </ToastPrimitive.Content>
            </ToastPrimitive.Root>
          );
        })}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastPrimitive.Provider toastManager={toastManager}>
      {children}
      <ToastViewport />
    </ToastPrimitive.Provider>
  );
}
