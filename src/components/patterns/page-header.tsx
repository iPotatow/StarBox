import type { ComponentProps } from "react";
import { cn } from "../../lib/cn";

export type PageHeaderLayout = "default" | "responsive" | "simple";

export function PageHeader({
  className,
  layout = "default",
  ...props
}: ComponentProps<"header"> & { layout?: PageHeaderLayout }) {
  return (
    <header
      data-slot="page-header"
      data-layout={layout}
      className={cn(
        layout === "default" && "mb-5 flex items-end justify-between gap-4",
        layout === "responsive" && "mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeaderContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="page-header-content" className={className} {...props} />;
}

export function PageHeaderTitle({ className, ...props }: ComponentProps<"h1">) {
  return <h1 data-slot="page-header-title" className={cn("text-xl font-semibold tracking-tight", className)} {...props} />;
}

export function PageHeaderDescription({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="page-header-description" className={cn("mt-1 text-sm text-muted-foreground", className)} {...props} />;
}

export function PageHeaderActions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="page-header-actions" className={cn("flex items-center gap-2", className)} {...props} />;
}
