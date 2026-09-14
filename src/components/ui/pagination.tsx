import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { RiArrowLeftSLine, RiArrowRightSLine, RiMoreLine } from "@remixicon/react";
import type { AnchorHTMLAttributes, HTMLAttributes, ReactElement } from "react";
import { cn } from "../../lib/cn";
import { useI18n } from "../../lib/i18n";
import { Button, type ButtonProps } from "./button";

export function Pagination({ className, ...props }: HTMLAttributes<HTMLElement>) { return <nav aria-label="pagination" data-slot="pagination" className={cn("mx-auto flex w-full justify-center", className)} {...props} />; }
export function PaginationContent({ className, ...props }: HTMLAttributes<HTMLUListElement>) { return <ul data-slot="pagination-content" className={cn("flex flex-row items-center gap-1", className)} {...props} />; }
export function PaginationItem(props: HTMLAttributes<HTMLLIElement>) { return <li data-slot="pagination-item" {...props} />; }
export interface PaginationLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> { isActive?: boolean; render?: any; }
export function PaginationLink({ className, isActive, render, ...props }: PaginationLinkProps) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps({ "aria-current": isActive ? "page" : undefined, "data-active": isActive || undefined, "data-slot": "pagination-link", className: cn("inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50", isActive && "border border-input bg-background", className) }, props),
    render,
  }) as ReactElement;
}
export function PaginationPrevious({ className, children, ...props }: PaginationLinkProps) { const { t } = useI18n(); const label = children ?? t("上一页", "Previous"); return <PaginationLink aria-label={t("上一页", "Previous page")} className={cn("gap-1", className)} {...props}><RiArrowLeftSLine className="size-4" />{label}</PaginationLink>; }
export function PaginationNext({ className, children, ...props }: PaginationLinkProps) { const { t } = useI18n(); const label = children ?? t("下一页", "Next"); return <PaginationLink aria-label={t("下一页", "Next page")} className={cn("gap-1", className)} {...props}>{label}<RiArrowRightSLine className="size-4" /></PaginationLink>; }
export function PaginationEllipsis({ className, ...props }: HTMLAttributes<HTMLSpanElement>) { const { t } = useI18n(); return <span aria-hidden data-slot="pagination-ellipsis" className={cn("flex min-w-7 justify-center", className)} {...props}><RiMoreLine className="size-4" /><span className="sr-only">{t("更多页面", "More pages")}</span></span>; }
export function PaginationButton({ active, ...props }: ButtonProps & { active?: boolean }) { return <Button data-slot="pagination-button" variant={active ? "outline" : "ghost"} size="icon-sm" {...props} />; }
