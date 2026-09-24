"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import type { ReactElement } from "react";
import { cn } from "../../lib/cn";

type CollapsiblePanelProps = Omit<CollapsiblePrimitive.Panel.Props, "className"> & { className?: string };

export function Collapsible(props: CollapsiblePrimitive.Root.Props): ReactElement {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

export function CollapsibleTrigger(props: CollapsiblePrimitive.Trigger.Props): ReactElement {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />;
}

export function CollapsiblePanel({ className, ...props }: CollapsiblePanelProps): ReactElement {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-panel"
      className={cn(
        "h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export { CollapsiblePrimitive, CollapsiblePanel as CollapsibleContent };
