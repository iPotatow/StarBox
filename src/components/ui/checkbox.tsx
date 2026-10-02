import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check as CheckIcon, Minus as MinusIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const CheckboxPrimitive = BaseCheckbox;
export interface CheckboxProps extends Omit<BaseCheckbox.Root.Props, "className"> {
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
}
export function Checkbox({ className, checked, defaultChecked, onCheckedChange, indeterminate, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      {...props}
      data-slot="checkbox"
      checked={checked}
      defaultChecked={defaultChecked}
      indeterminate={indeterminate}
      onCheckedChange={onCheckedChange}
      className={cn("relative inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background shadow-xs outline-none ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 aria-invalid:border-destructive/50 data-[checked]:border-primary data-[indeterminate]:border-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60", className)}
    >
      <CheckboxPrimitive.Indicator className="absolute -inset-px flex items-center justify-center rounded-full bg-primary text-primary-foreground data-[unchecked]:hidden">
        {indeterminate ? <MinusIcon className="size-3" aria-hidden="true" /> : <CheckIcon className="size-3" aria-hidden="true" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
