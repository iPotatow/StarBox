import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { HTMLAttributes, ReactElement } from "react";
import { cn } from "../../lib/cn";

type DivProps = HTMLAttributes<HTMLDivElement> & { render?: any };
function renderDiv(slot: string, base: string, { className, render, ...props }: DivProps) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps({ className: cn(base, className), "data-slot": slot }, props),
    render,
  }) as ReactElement;
}

// Adapted from coss apps/ui registry card.
export function Card(props: DivProps) { return renderDiv("card", "relative flex flex-col rounded-2xl border bg-card text-card-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)]", props); }
export function CardHeader(props: DivProps) { return renderDiv("card-header", "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 p-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]", props); }
export function CardTitle(props: DivProps) { return renderDiv("card-title", "font-semibold text-lg leading-none", props); }
export function CardDescription(props: DivProps) { return renderDiv("card-description", "text-sm text-muted-foreground", props); }
export function CardAction(props: DivProps) { return renderDiv("card-action", "col-start-2 row-span-2 row-start-1 inline-flex self-start justify-self-end", props); }
export function CardPanel(props: DivProps) { return renderDiv("card-panel", "flex-1 p-6", props); }
export function CardFooter(props: DivProps) { return renderDiv("card-footer", "flex items-center p-6 pt-0", props); }
