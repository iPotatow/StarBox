import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
const Primitive = BaseAlertDialog as any;
export const AlertDialog = Primitive.Root;
export const AlertDialogTrigger = Primitive.Trigger;
export const AlertDialogClose = Primitive.Close;
export function AlertDialogPopup({ className, children }: { className?: string; children: ReactNode }) { return <Primitive.Portal><Primitive.Backdrop className="fixed inset-0 z-[70] bg-black/32 backdrop-blur-sm" /><Primitive.Viewport className="fixed inset-0 z-[70] grid place-items-center p-4"><Primitive.Popup className={cn("w-full max-w-md overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none", className)}>{children}</Primitive.Popup></Primitive.Viewport></Primitive.Portal>; }
export function AlertDialogHeader({ children }: { children: ReactNode }) { return <div className="grid gap-1.5 px-5 pb-3 pt-5">{children}</div>; }
export function AlertDialogTitle({ children }: { children: ReactNode }) { return <Primitive.Title className="text-base font-semibold">{children}</Primitive.Title>; }
export function AlertDialogDescription({ children }: { children: ReactNode }) { return <Primitive.Description className="text-sm leading-6 text-muted-foreground">{children}</Primitive.Description>; }
export function AlertDialogFooter({ children }: { children: ReactNode }) { return <div className="flex justify-end gap-2 border-t border-border bg-secondary/30 px-5 py-4">{children}</div>; }
