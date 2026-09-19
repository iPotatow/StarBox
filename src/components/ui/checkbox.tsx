import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { CheckIcon } from "../../lib/animated-icons";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const CheckboxPrimitive = BaseCheckbox;
export interface CheckboxProps extends Omit<BaseCheckbox.Root.Props, "className" | "onCheckedChange"> {
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}
export function Checkbox({ className, checked, defaultChecked, onCheckedChange, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      {...props}
      data-slot="checkbox"
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={(next: boolean) => onCheckedChange?.(Boolean(next))}
      className={cn("relative inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background shadow-xs outline-none ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background data-[checked]:border-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60", className)}
    >
      <CheckboxPrimitive.Indicator className="absolute -inset-px flex items-center justify-center rounded-full bg-primary text-primary-foreground data-[unchecked]:hidden">
        <CheckIcon className="size-3" aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
