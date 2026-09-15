import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import type { ReactElement } from "react";
import { cn } from "../../lib/cn";

type AvatarRootProps = Omit<AvatarPrimitive.Root.Props, "className"> & { className?: string };
type AvatarImageProps = Omit<AvatarPrimitive.Image.Props, "className"> & { className?: string };
type AvatarFallbackProps = Omit<AvatarPrimitive.Fallback.Props, "className"> & { className?: string };

export function Avatar({ className, ...props }: AvatarRootProps): ReactElement {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative isolate inline-flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-background align-middle text-xs font-medium", className)}
      {...props}
    />
  );
}

export function AvatarImage({ className, ...props }: AvatarImageProps): ReactElement {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("absolute inset-0 z-10 size-full object-cover data-error:invisible data-loading:invisible", className)}
      {...props}
    />
  );
}

export function AvatarFallback({ className, ...props }: AvatarFallbackProps): ReactElement {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("absolute inset-0 flex size-full items-center justify-center rounded-full bg-secondary", className)}
      {...props}
    />
  );
}

export { AvatarPrimitive };
