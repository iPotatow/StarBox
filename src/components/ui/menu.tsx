"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Check as CheckIcon, CaretRight as ChevronRightIcon } from "@phosphor-icons/react";
import type { ComponentProps, ReactElement } from "react";
import { cn } from "../../lib/cn";

export const MenuCreateHandle: typeof MenuPrimitive.createHandle = MenuPrimitive.createHandle;
export const Menu: typeof MenuPrimitive.Root = MenuPrimitive.Root;
export const MenuPortal: typeof MenuPrimitive.Portal = MenuPrimitive.Portal;

export function MenuTrigger({ className, children, ...props }: MenuPrimitive.Trigger.Props): ReactElement {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" className={className} {...props}>{children}</MenuPrimitive.Trigger>;
}

type MenuPopupProps = Omit<MenuPrimitive.Popup.Props, "className"> & {
  className?: string;
  align?: MenuPrimitive.Positioner.Props["align"];
  sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"];
  alignOffset?: MenuPrimitive.Positioner.Props["alignOffset"];
  side?: MenuPrimitive.Positioner.Props["side"];
  anchor?: MenuPrimitive.Positioner.Props["anchor"];
  portalProps?: MenuPrimitive.Portal.Props;
};

export function MenuPopup({
  className,
  children,
  sideOffset = 4,
  align = "center",
  alignOffset,
  side = "bottom",
  anchor,
  portalProps,
  ...props
}: MenuPopupProps): ReactElement {
  return (
    <MenuPortal {...portalProps}>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="z-[100]"
        side={side}
        sideOffset={sideOffset}
        data-slot="menu-positioner"
      >
        <MenuPrimitive.Popup
          data-slot="menu-popup"
          className={cn("relative flex min-w-40 origin-[var(--transform-origin)] rounded-lg border bg-popover text-popover-foreground shadow-lg/5 outline-none", className)}
          {...props}
        >
          <div className="max-h-[var(--available-height)] w-full overflow-y-auto p-1">{children}</div>
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPortal>
  );
}

const menuItemClassName =
  "flex min-h-8 cursor-default select-none items-center gap-2 rounded-md px-2 py-1 text-sm text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive-foreground [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:shrink-0";

export function MenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: Omit<MenuPrimitive.Item.Props, "className"> & { className?: string; inset?: boolean; variant?: "default" | "destructive" }): ReactElement {
  return (
    <MenuPrimitive.Item
      data-slot="menu-item"
      data-inset={inset || undefined}
      data-variant={variant}
      className={cn(menuItemClassName, className)}
      {...props}
    />
  );
}

export function MenuLinkItem({
  className,
  inset,
  variant = "default",
  closeOnClick = true,
  ...props
}: Omit<MenuPrimitive.LinkItem.Props, "className"> & { className?: string; inset?: boolean; variant?: "default" | "destructive" }): ReactElement {
  return (
    <MenuPrimitive.LinkItem
      data-slot="menu-link-item"
      data-inset={inset || undefined}
      data-variant={variant}
      closeOnClick={closeOnClick}
      className={cn(menuItemClassName, className)}
      {...props}
    />
  );
}

export function MenuCheckboxItem({
  className,
  children,
  checked,
  variant = "default",
  ...props
}: Omit<MenuPrimitive.CheckboxItem.Props, "className"> & { className?: string; variant?: "default" | "switch" }): ReactElement {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menu-checkbox-item"
      checked={checked}
      className={cn(
        "grid min-h-8 cursor-default items-center gap-2 rounded-md py-1 ps-2 text-sm text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50",
        variant === "switch" ? "grid-cols-[1fr_auto] gap-4 pe-1.5" : "grid-cols-[.75rem_1fr] pe-4",
        className,
      )}
      {...props}
    >
      {variant === "switch" ? (
        <>
          <span className="col-start-1">{children}</span>
          <MenuPrimitive.CheckboxItemIndicator
            keepMounted
            className="inline-flex h-5 w-8 shrink-0 items-center rounded-full bg-input p-0.5 transition-colors data-checked:bg-primary"
          >
            <span className="size-4 rounded-full bg-background shadow-sm transition-transform in-[[data-slot=menu-checkbox-item][data-checked]]:translate-x-3" />
          </MenuPrimitive.CheckboxItemIndicator>
        </>
      ) : (
        <>
          <MenuPrimitive.CheckboxItemIndicator className="col-start-1 -ms-0.5">
            <CheckIcon aria-hidden="true" />
          </MenuPrimitive.CheckboxItemIndicator>
          <span className="col-start-2">{children}</span>
        </>
      )}
    </MenuPrimitive.CheckboxItem>
  );
}

export function MenuRadioGroup(props: MenuPrimitive.RadioGroup.Props): ReactElement {
  return <MenuPrimitive.RadioGroup data-slot="menu-radio-group" {...props} />;
}

export function MenuRadioItem({ className, children, ...props }: Omit<MenuPrimitive.RadioItem.Props, "className"> & { className?: string }): ReactElement {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menu-radio-item"
      className={cn(
        "grid min-h-8 cursor-default grid-cols-[.75rem_1fr] items-center gap-2 rounded-md py-1 ps-2 pe-4 text-sm text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <MenuPrimitive.RadioItemIndicator className="col-start-1 -ms-0.5">
        <CheckIcon aria-hidden="true" />
      </MenuPrimitive.RadioItemIndicator>
      <span className="col-start-2">{children}</span>
    </MenuPrimitive.RadioItem>
  );
}

export function MenuGroup(props: MenuPrimitive.Group.Props): ReactElement {
  return <MenuPrimitive.Group data-slot="menu-group" {...props} />;
}

export function MenuGroupLabel({
  className,
  inset,
  ...props
}: Omit<MenuPrimitive.GroupLabel.Props, "className"> & { className?: string; inset?: boolean }): ReactElement {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="menu-label"
      data-inset={inset || undefined}
      className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground data-[inset]:pl-8", className)}
      {...props}
    />
  );
}

export function MenuSeparator({ className, ...props }: Omit<MenuPrimitive.Separator.Props, "className"> & { className?: string }): ReactElement {
  return <MenuPrimitive.Separator data-slot="menu-separator" className={cn("mx-2 my-1 h-px bg-border", className)} {...props} />;
}

export function MenuShortcut({ className, ...props }: ComponentProps<"kbd">): ReactElement {
  return <kbd data-slot="menu-shortcut" className={cn("ml-auto text-xs font-medium tracking-widest text-muted-foreground", className)} {...props} />;
}

export function MenuSub(props: MenuPrimitive.SubmenuRoot.Props): ReactElement {
  return <MenuPrimitive.SubmenuRoot data-slot="menu-sub" {...props} />;
}

export function MenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Omit<MenuPrimitive.SubmenuTrigger.Props, "className"> & { className?: string; inset?: boolean }): ReactElement {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="menu-sub-trigger"
      data-inset={inset || undefined}
      className={cn(
        "flex min-h-8 items-center gap-2 rounded-md px-2 py-1 text-sm text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-popup-open:bg-accent data-highlighted:text-accent-foreground data-popup-open:text-accent-foreground data-disabled:opacity-50 data-[inset]:pl-8 [&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4 opacity-80" aria-hidden="true" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

export function MenuSubPopup({
  className,
  sideOffset = 0,
  alignOffset,
  align = "start",
  ...props
}: Omit<MenuPrimitive.Popup.Props, "className"> & {
  className?: string;
  align?: MenuPrimitive.Positioner.Props["align"];
  sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"];
  alignOffset?: MenuPrimitive.Positioner.Props["alignOffset"];
}): ReactElement {
  const defaultAlignOffset = align !== "center" ? -5 : undefined;
  return <MenuPopup align={align} alignOffset={alignOffset ?? defaultAlignOffset} className={className} data-slot="menu-sub-content" side="inline-end" sideOffset={sideOffset} {...props} />;
}

export {
  MenuPrimitive,
  MenuCreateHandle as DropdownMenuCreateHandle,
  Menu as DropdownMenu,
  MenuPortal as DropdownMenuPortal,
  MenuTrigger as DropdownMenuTrigger,
  MenuPopup as DropdownMenuContent,
  MenuGroup as DropdownMenuGroup,
  MenuItem as DropdownMenuItem,
  MenuLinkItem as DropdownMenuLinkItem,
  MenuCheckboxItem as DropdownMenuCheckboxItem,
  MenuRadioGroup as DropdownMenuRadioGroup,
  MenuRadioItem as DropdownMenuRadioItem,
  MenuGroupLabel as DropdownMenuLabel,
  MenuSeparator as DropdownMenuSeparator,
  MenuShortcut as DropdownMenuShortcut,
  MenuSub as DropdownMenuSub,
  MenuSubTrigger as DropdownMenuSubTrigger,
  MenuSubPopup as DropdownMenuSubContent,
};
