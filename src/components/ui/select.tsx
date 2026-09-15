import { Select as BaseSelect } from "@base-ui/react/select";
import { RiArrowDownSLine, RiCheckLine } from "@remixicon/react";
import { Children, isValidElement, type ReactElement, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const SelectPrimitive = BaseSelect as any;

export type SelectItemRecord = { label: ReactNode; value: string; disabled?: boolean };
type OptionRecord = SelectItemRecord & { text: string };

function optionRecords(children: ReactNode): OptionRecord[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type === "option") {
      const props = (child as ReactElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>).props;
      const value = String(props.value ?? (typeof props.children === "string" || typeof props.children === "number" ? props.children : ""));
      const text = typeof props.children === "string" || typeof props.children === "number" ? String(props.children) : value;
      return [{ label: props.children, text, value, disabled: Boolean(props.disabled) }];
    }
    return optionRecords((child as ReactElement<{ children?: ReactNode }>).props?.children);
  });
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange" | "children"> {
  children?: ReactNode;
  items?: readonly SelectItemRecord[];
  onChange?: SelectHTMLAttributes<HTMLSelectElement>["onChange"];
  onValueChange?: (value: string) => void;
  sizeVariant?: "sm" | "default" | "lg";
}

export function Select({ className, children, items: explicitItems, value, defaultValue, onChange, onValueChange, disabled, name, required, sizeVariant = "lg", ...props }: SelectProps) {
  const fallbackOptions = optionRecords(children);
  const options: OptionRecord[] = explicitItems
    ? explicitItems.map((item) => ({ ...item, text: typeof item.label === "string" || typeof item.label === "number" ? String(item.label) : item.value, disabled: Boolean(item.disabled) }))
    : fallbackOptions;
  const stringValue = value == null ? undefined : String(value);
  const stringDefault = defaultValue == null ? undefined : String(defaultValue);
  const rootItems = options.map((item) => ({ label: item.text, value: item.value }));

  function handleValueChange(next: unknown) {
    const nextValue = String(next ?? "");
    onValueChange?.(nextValue);
    if (!onChange) return;
    const target = { value: nextValue, name: name ?? "" } as HTMLSelectElement;
    onChange({ target, currentTarget: target } as any);
  }

  return (
    <SelectPrimitive.Root
      value={stringValue}
      defaultValue={stringDefault}
      onValueChange={handleValueChange}
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
