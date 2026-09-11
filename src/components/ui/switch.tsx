import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const SwitchPrimitive = BaseSwitch as any;
export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}
export function Switch({ className, checked, defaultChecked, onCheckedChange, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      {...props}
      data-slot="switch"
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={(next: boolean) => onCheckedChange?.(Boolean(next))}
      className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-secondary outline-none ring-ring transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60", className)}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform data-[checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}
