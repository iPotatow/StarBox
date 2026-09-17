import { Select as BaseSelect } from "@base-ui/react/select";
import { RiArrowDownSLine, RiCheckLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

const SelectPrimitive = BaseSelect;

export type SelectItemRecord = { label: ReactNode; value: string; disabled?: boolean };

export interface SelectProps extends Omit<BaseSelect.Trigger.Props, "className" | "value" | "defaultValue" | "onChange" | "children"> {
  className?: string;
  items: readonly SelectItemRecord[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  sizeVariant?: "sm" | "default" | "lg";
}

export function Select({ className, items, value, defaultValue, onValueChange, disabled, name, required, sizeVariant = "lg", ...props }: SelectProps) {
  const options = items;
  const rootItems = options.map((item) => ({ label: item.label, value: item.value }));

  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.(next ?? "")}
      disabled={disabled}
      name={name}
      required={required}
      items={rootItems}
    >
      <SelectPrimitive.Trigger
        {...props}
        data-slot="select-trigger"
        className={cn(
          "relative inline-flex w-full min-w-28 select-none items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm text-foreground shadow-xs outline-none ring-ring/25 transition-shadow focus-visible:border-ring focus-visible:ring-[3px] data-[disabled]:pointer-events-none data-[disabled]:opacity-60",
          sizeVariant === "sm" ? "h-8" : sizeVariant === "default" ? "h-8" : "h-9",
          className,
        )}
      >
        <SelectPrimitive.Value className="min-w-0 flex-1 truncate" data-slot="select-value">
          {(selected: unknown) => {
            const selectedValue = selected == null ? "" : String(selected);
            return options.find((option) => option.value === selectedValue)?.label ?? selectedValue;
          }}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon data-slot="select-icon"><RiArrowDownSLine className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner className="z-[60] select-none" side="bottom" sideOffset={4} align="start" data-slot="select-positioner">
          <SelectPrimitive.Popup data-slot="select-popup" className="min-w-[var(--anchor-width)] rounded-lg border border-border bg-popover p-1 text-foreground shadow-xl outline-none">
            <SelectPrimitive.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto" data-slot="select-list">
              {options.map((option) => (
                <SelectPrimitive.Item key={option.value} value={option.value} disabled={option.disabled} data-slot="select-item" className="grid min-h-8 cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-md px-2 py-1 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent">
                  <SelectPrimitive.ItemIndicator className="col-start-1"><RiCheckLine className="size-3.5" aria-hidden="true" /></SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText className="col-start-2 truncate">{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

// Typed primitives remain available for custom compositions.
export const SelectRoot = BaseSelect.Root;
export const SelectTrigger = BaseSelect.Trigger;
export const SelectValue = BaseSelect.Value;
export const SelectItem = BaseSelect.Item;
export const SelectGroup = BaseSelect.Group;
export const SelectGroupLabel = BaseSelect.GroupLabel;
export const SelectPopup = BaseSelect.Popup;
export const SelectPortal = BaseSelect.Portal;
export const SelectPositioner = BaseSelect.Positioner;
