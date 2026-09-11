import { Autocomplete as BaseAutocomplete } from "@base-ui/react/autocomplete";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { RiSearchLine } from "@remixicon/react";
import type { HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
const Auto = BaseAutocomplete as any;
const Dialog = BaseDialog as any;
export const Command = Auto.Root;
export function CommandInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <div className="flex items-center gap-2 border-b border-border px-3"><RiSearchLine className="size-4 text-muted-foreground" /><Auto.Input data-slot="command-input" className={cn("h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground", className)} {...props} /></div>; }
export function CommandList({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <Auto.List data-slot="command-list" className={cn("max-h-80 overflow-y-auto p-1", className)} {...props} />; }
export function CommandItem({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <Auto.Item data-slot="command-item" className={cn("flex min-h-8 cursor-default select-none items-center rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:opacity-50", className)} {...props} />; }
export function CommandEmpty({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <Auto.Empty data-slot="command-empty" className={cn("p-6 text-center text-sm text-muted-foreground", className)} {...props} />; }
export function CommandGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <Auto.Group data-slot="command-group" className={cn("py-1", className)} {...props} />; }
export function CommandSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <Auto.Separator data-slot="command-separator" className={cn("my-1 h-px bg-border", className)} {...props} />; }
export function CommandDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (value: boolean) => void; children: ReactNode }) { return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-black/32 backdrop-blur-sm" /><Dialog.Viewport className="fixed inset-0 z-50 flex items-start justify-center px-4 py-[10vh]"><Dialog.Popup className="w-full max-w-xl overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-xl outline-none">{children}</Dialog.Popup></Dialog.Viewport></Dialog.Portal></Dialog.Root>; }
