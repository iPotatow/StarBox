"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { ReactElement } from "react";
import { cn } from "../../lib/cn";

type CardProps = useRender.ComponentProps<"div">;

function renderDiv(slot: string, base: string, { className, render, ...props }: CardProps): ReactElement {
  return useRender({
    defaultTagName: "div",
    props: mergeProps({ className: cn(base, className), "data-slot": slot } as any, props),
    render,
  });
}

// Existing StarBox Card visuals intentionally remain stable while the export surface tracks COSS.
export function Card(props: CardProps) {
  return renderDiv("card", "relative flex flex-col rounded-2xl border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]", props);
}

export function CardFrame(props: CardProps) {
  return renderDiv(
    "card-frame",
    "relative flex flex-col rounded-2xl border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5 [--clip-bottom:-1rem] [--clip-top:-1rem] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)] before:bg-muted/72 before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)] has-data-[slot=table-container]:overflow-hidden *:data-[slot=card]:-m-px *:data-[slot=table-container]:-m-px *:data-[slot=table-container]:w-[calc(100%+2px)]",
    props,
  );
}

export function CardFrameHeader(props: CardProps) {
  return renderDiv("card-frame-header", "relative grid auto-rows-min grid-rows-[auto_auto] items-start gap-x-4 px-6 py-4 has-data-[slot=card-frame-action]:grid-cols-[1fr_auto]", props);
}
export function CardFrameTitle(props: CardProps) { return renderDiv("card-frame-title", "self-center text-sm font-semibold", props); }
export function CardFrameDescription(props: CardProps) { return renderDiv("card-frame-description", "self-center text-sm text-muted-foreground", props); }
export function CardFrameAction(props: CardProps) { return renderDiv("card-frame-action", "col-start-2 row-span-2 row-start-1 inline-flex self-center justify-self-end", props); }
export function CardFrameFooter(props: CardProps) { return renderDiv("card-frame-footer", "px-6 py-4", props); }

export function CardHeader(props: CardProps) { return renderDiv("card-header", "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 p-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]", props); }
export function CardTitle(props: CardProps) { return renderDiv("card-title", "font-heading font-semibold text-lg leading-none", props); }
export function CardDescription(props: CardProps) { return renderDiv("card-description", "text-sm text-muted-foreground", props); }
export function CardAction(props: CardProps) { return renderDiv("card-action", "col-start-2 row-span-2 row-start-1 inline-flex self-start justify-self-end", props); }
export function CardPanel(props: CardProps) { return renderDiv("card-panel", "flex-1 p-6", props); }
export function CardFooter(props: CardProps) { return renderDiv("card-footer", "flex items-center p-6 pt-0", props); }

export { CardPanel as CardContent };
