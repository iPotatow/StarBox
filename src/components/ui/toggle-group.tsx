import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
const ToggleGroupPrimitive = BaseToggleGroup;
const TogglePrimitive = BaseToggle;

export function ToggleGroup({ className, ...props }: HTMLAttributes<HTMLDivElement> & { value?: string[]; defaultValue?: string[]; onValueChange?: (value: string[]) => void; multiple?: boolean }) { return <ToggleGroupPrimitive data-slot="toggle-group" className={cn("inline-flex items-center rounded-lg border border-input bg-background p-0.5", className)} {...props} />; }
export function ToggleGroupItem({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) { return <TogglePrimitive data-slot="toggle-group-item" className={cn("inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-[pressed]:bg-accent data-[pressed]:text-foreground", className)} {...props} />; }
export function ToggleGroupSeparator({ className, ...props }: HTMLAttributes<HTMLSpanElement>) { return <span data-slot="toggle-group-separator" className={cn("mx-0.5 h-5 w-px bg-border", className)} {...props} />; }
