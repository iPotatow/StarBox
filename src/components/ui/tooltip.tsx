"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";

export const TooltipCreateHandle: typeof TooltipPrimitive.createHandle = TooltipPrimitive.createHandle;
export const TooltipProvider: typeof TooltipPrimitive.Provider = TooltipPrimitive.Provider;
export const TooltipRoot: typeof TooltipPrimitive.Root = TooltipPrimitive.Root;

export function TooltipTrigger(props: TooltipPrimitive.Trigger.Props): ReactElement {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

export function TooltipPopup({
  className,
  align = "center",
  sideOffset = 4,
  side = "top",
  anchor,
  children,
  portalProps,
  ...props
}: Omit<TooltipPrimitive.Popup.Props, "className"> & {
  className?: string;
  align?: TooltipPrimitive.Positioner.Props["align"];
  side?: TooltipPrimitive.Positioner.Props["side"];
  sideOffset?: TooltipPrimitive.Positioner.Props["sideOffset"];
  anchor?: TooltipPrimitive.Positioner.Props["anchor"];
  portalProps?: TooltipPrimitive.Portal.Props;
}): ReactElement {
  return (
    <TooltipPrimitive.Portal {...portalProps}>
      <TooltipPrimitive.Positioner
        align={align}
        anchor={anchor}
        className="z-[100] h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom,transform] data-[instant]:transition-none motion-reduce:transition-none"
        data-slot="tooltip-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          className={cn(
            "relative flex h-(--popup-height,auto) w-(--popup-width,auto) origin-(--transform-origin) text-balance rounded-md border bg-popover not-dark:bg-clip-padding text-popover-foreground text-xs shadow-md/5 transition-[width,height,scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-[ending-style]:scale-98 data-[starting-style]:scale-98 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[instant]:duration-0 dark:before:shadow-[0_-1px_--theme(--color-white/6%)] motion-reduce:transition-none",
            className,
          )}
          data-slot="tooltip-popup"
          {...props}
        >
          <TooltipPrimitive.Viewport
            className="relative size-full overflow-clip px-2 py-1"
            data-slot="tooltip-viewport"
          >
            {children}
          </TooltipPrimitive.Viewport>
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export function Tooltip({
  children,
  content,
  side = "top",
}: {
  children: ReactElement;
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipRoot>
      <TooltipTrigger render={children} />
      <TooltipPopup side={side} sideOffset={6}>
        {content}
      </TooltipPopup>
    </TooltipRoot>
  );
}

export { TooltipPrimitive, TooltipPopup as TooltipContent };
