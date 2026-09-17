import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";

const TooltipPrimitive = BaseTooltip;

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
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger render={children} />
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner
            side={side}
            sideOffset={6}
            className="z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom,transform] data-[instant]:transition-none"
          >
            <TooltipPrimitive.Popup
              className={cn(
                "max-w-64 origin-(--transform-origin) rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md",
                "transition-[scale,opacity] duration-150 data-[starting-style]:scale-98 data-[ending-style]:scale-98 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[instant]:duration-0 motion-reduce:transition-none",
              )}
            >
              {content}
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
  );
}

export const TooltipProvider = BaseTooltip.Provider;
export const TooltipRoot = BaseTooltip.Root;
export const TooltipTrigger = BaseTooltip.Trigger;
export const TooltipPopup = BaseTooltip.Popup;
