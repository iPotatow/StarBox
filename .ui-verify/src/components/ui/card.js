import { mergeProps } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/base-ui.js";
import { useRender } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/base-ui.js";
import { cn } from "../../lib/cn.js";
function renderDiv(slot, base, { className, render, ...props }) {
    return useRender({
        defaultTagName: "div",
        props: mergeProps({ className: cn(base, className), "data-slot": slot }, props),
        render,
    });
}
// Adapted from coss apps/ui registry card.
export function Card(props) { return renderDiv("card", "relative flex flex-col rounded-2xl border bg-card text-card-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-xl)-1px)]", props); }
export function CardHeader(props) { return renderDiv("card-header", "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 p-6 has-data-[slot=card-action]:grid-cols-[1fr_auto]", props); }
export function CardTitle(props) { return renderDiv("card-title", "font-semibold text-lg leading-none", props); }
export function CardDescription(props) { return renderDiv("card-description", "text-sm text-muted-foreground", props); }
export function CardAction(props) { return renderDiv("card-action", "col-start-2 row-span-2 row-start-1 inline-flex self-start justify-self-end", props); }
export function CardPanel(props) { return renderDiv("card-panel", "flex-1 p-6", props); }
export function CardFooter(props) { return renderDiv("card-footer", "flex items-center p-6 pt-0", props); }
