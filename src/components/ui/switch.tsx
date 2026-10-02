import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

const SwitchPrimitive = BaseSwitch;

export interface SwitchProps extends Omit<BaseSwitch.Root.Props, "className"> {
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
}

export function Switch({ className, checked, defaultChecked, onCheckedChange, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      {...props}
      data-slot="switch"
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-secondary outline-none ring-ring transition-[background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 motion-reduce:transition-none",
        className,
      )}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className="pointer-events-none block size-4 translate-x-0.5 origin-left rounded-full bg-background shadow-sm will-change-transform transition-[translate,scale,border-radius] duration-150 data-[checked]:origin-right data-[checked]:translate-x-[18px] in-[[data-slot=switch]:active]:scale-x-110 in-[[data-slot=switch]:active]:rounded-[0.45rem] motion-reduce:scale-100 motion-reduce:transition-none" />
    </SwitchPrimitive.Root>
  );
}
