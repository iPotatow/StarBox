import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { MenuItemProps as BaseMenuItemProps } from "@base-ui/react/menu";
import { Children, isValidElement, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

const MenuPrimitive = BaseMenu as any;
export const Menu = MenuPrimitive.Root;
export const MenuPortal = MenuPrimitive.Portal;

export function MenuTrigger(props: Record<string, unknown>) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />;
}

function isMenuPart(node: ReactNode, component: unknown) {
  return isValidElement(node) && node.type === component;
}

function normalizeGroupedChildren(children: ReactNode) {
  const nodes = Children.toArray(children);
  const normalized: ReactNode[] = [];
  let index = 0;
  while (index < nodes.length) {
    const current = nodes[index];
    if (!isMenuPart(current, MenuGroupLabel)) {
      normalized.push(current);
      index += 1;
      continue;
    }

    const group: ReactNode[] = [current];
    index += 1;
    while (index < nodes.length && !isMenuPart(nodes[index], MenuGroupLabel) && !isMenuPart(nodes[index], MenuSeparator)) {
      group.push(nodes[index]);
      index += 1;
    }
    normalized.push(<MenuPrimitive.Group key={`menu-group-${normalized.length}`}>{group}</MenuPrimitive.Group>);
  }
  return normalized;
}

export function MenuPopup({ className, children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner className="z-50" sideOffset={4} data-slot="menu-positioner">
        <MenuPrimitive.Popup
          data-slot="menu-popup"
          className={cn("min-w-40 origin-[var(--transform-origin)] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg/5 outline-none", className)}
          {...props}
        >
          {normalizeGroupedChildren(children)}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

type MenuItemProps = Omit<BaseMenuItemProps, "className"> & { className?: string; inset?: boolean };
export function MenuItem({ className, inset, ...props }: MenuItemProps) {
  return <MenuPrimitive.Item data-slot="menu-item" className={cn("flex min-h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50", inset && "pl-8", className)} {...props} />;
}

export function MenuGroup(props: Record<string, unknown>) {
  return <MenuPrimitive.Group data-slot="menu-group" {...props} />;
}

export function MenuGroupLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <MenuPrimitive.GroupLabel data-slot="menu-label" className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />;
}

export function MenuSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <MenuPrimitive.Separator data-slot="menu-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

export function MenuShortcut({ className, children, ...props }: HTMLAttributes<HTMLElement> & { children?: ReactNode }) {
  return <kbd data-slot="menu-shortcut" className={cn("ml-auto text-xs font-medium tracking-widest text-muted-foreground", className)} {...props}>{children}</kbd>;
}
