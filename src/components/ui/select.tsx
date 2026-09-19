"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon } from "../../lib/animated-icons";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type SelectItemRecord = { label: ReactNode; value: string; disabled?: boolean };
export type SelectSize = "sm" | "default" | "lg";

const triggerSizeClass: Record<SelectSize, string> = {
  sm: "min-h-8 px-2.5 sm:min-h-7",
  default: "min-h-9 px-3 sm:min-h-8",
  lg: "min-h-10 px-3 sm:min-h-9",
};

type StyledTriggerProps = Omit<SelectPrimitive.Trigger.Props, "className"> & { className?: string; size?: SelectSize };
type StyledValueProps = Omit<SelectPrimitive.Value.Props, "className"> & { className?: string };
type StyledPopupProps = Omit<SelectPrimitive.Popup.Props, "className"> & {
  className?: string;
  portalProps?: SelectPrimitive.Portal.Props;
  side?: SelectPrimitive.Positioner.Props["side"];
  sideOffset?: SelectPrimitive.Positioner.Props["sideOffset"];
  align?: SelectPrimitive.Positioner.Props["align"];
  alignOffset?: SelectPrimitive.Positioner.Props["alignOffset"];
  alignItemWithTrigger?: SelectPrimitive.Positioner.Props["alignItemWithTrigger"];
  anchor?: SelectPrimitive.Positioner.Props["anchor"];
};
type StyledItemProps = Omit<SelectPrimitive.Item.Props, "className"> & { className?: string };
type StyledSeparatorProps = Omit<SelectPrimitive.Separator.Props, "className"> & { className?: string };
type StyledGroupLabelProps = Omit<SelectPrimitive.GroupLabel.Props, "className"> & { className?: string };

export const SelectRoot: typeof SelectPrimitive.Root = SelectPrimitive.Root;
export const SelectPortal: typeof SelectPrimitive.Portal = SelectPrimitive.Portal;
export const SelectPositioner: typeof SelectPrimitive.Positioner = SelectPrimitive.Positioner;
export const SelectGroup: typeof SelectPrimitive.Group = SelectPrimitive.Group;

export function SelectTrigger({ className, size = "default", children, ...props }: StyledTriggerProps): ReactElement {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "relative inline-flex w-full min-w-28 select-none items-center justify-between gap-2 rounded-lg border border-input bg-background text-left text-sm text-foreground shadow-xs outline-none ring-ring/25 transition-shadow pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 focus-visible:border-ring focus-visible:ring-[3px] data-disabled:pointer-events-none data-disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        triggerSizeClass[size],
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon data-slot="select-icon">
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectValue({ className, ...props }: StyledValueProps): ReactElement {
  return <SelectPrimitive.Value data-slot="select-value" className={cn("min-w-0 flex-1 truncate data-placeholder:text-muted-foreground", className)} {...props} />;
}

export function SelectPopup({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = true,
  anchor,
  portalProps,
  ...props
}: StyledPopupProps): ReactElement {
  return (
    <SelectPrimitive.Portal {...portalProps}>
      <SelectPrimitive.Positioner
        data-slot="select-positioner"
        className="z-[100] select-none"
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        anchor={anchor}
      >
        <SelectPrimitive.Popup data-slot="select-popup" className="min-w-[var(--anchor-width)] rounded-lg border border-border bg-popover text-popover-foreground shadow-xl outline-none" {...props}>
          <SelectPrimitive.List data-slot="select-list" className={cn("max-h-[min(20rem,var(--available-height))] overflow-y-auto p-1", className)}>
            {children}
          </SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: StyledItemProps): ReactElement {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "grid min-h-8 cursor-default grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-md px-2 py-1 text-sm text-foreground outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="col-start-1"><CheckIcon className="size-3.5" aria-hidden="true" /></SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="col-start-2 min-w-0 truncate">{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({ className, ...props }: StyledSeparatorProps): ReactElement {
  return <SelectPrimitive.Separator data-slot="select-separator" className={cn("mx-2 my-1 h-px bg-border", className)} {...props} />;
}

export function SelectGroupLabel({ className, ...props }: StyledGroupLabelProps): ReactElement {
  return <SelectPrimitive.GroupLabel data-slot="select-group-label" className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />;
}

export interface SelectProps extends Omit<SelectPrimitive.Trigger.Props, "className" | "value" | "defaultValue" | "onChange" | "children"> {
  className?: string;
  items: readonly SelectItemRecord[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  sizeVariant?: SelectSize;
}

export function Select({ className, items, value, defaultValue, onValueChange, disabled, name, required, sizeVariant = "lg", ...props }: SelectProps): ReactElement {
  const options = items;
  const rootItems = options.map((item) => ({ label: item.label, value: item.value }));

  return (
    <SelectRoot
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.(next ?? "")}
      disabled={disabled}
      name={name}
      required={required}
      items={rootItems}
    >
      <SelectTrigger {...props} className={className} size={sizeVariant}>
        <SelectValue>
          {(selected: unknown) => {
            const selectedValue = selected == null ? "" : String(selected);
            return options.find((option) => option.value === selectedValue)?.label ?? selectedValue;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>
        ))}
      </SelectPopup>
    </SelectRoot>
  );
}

export { SelectPrimitive, SelectPopup as SelectContent };
