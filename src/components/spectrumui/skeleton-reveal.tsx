/**
 * Adapted from Spectrum UI Skeleton Reveal:
 * https://ui.spectrumhq.in/docs/skeleton-reveal
 *
 * Uses a grid overlap so existing COSS Skeleton layouts keep their intrinsic
 * height while content cross-fades and un-blurs into place.
 */
"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SkeletonRevealProps {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SkeletonReveal({ loading, skeleton, children, className }: SkeletonRevealProps) {
  return (
    <div data-slot="skeleton-reveal" aria-busy={loading || undefined} className={cn("grid min-w-0", className)}>
      <div
        aria-hidden="true"
        className={cn(
          "col-start-1 row-start-1 min-w-0 transition-[opacity,filter] duration-200 ease-out motion-reduce:transition-none motion-reduce:blur-none",
          loading ? "opacity-100 blur-0" : "pointer-events-none opacity-0 blur-[2px]",
        )}
      >
        {skeleton}
      </div>
      <div
        aria-hidden={loading || undefined}
        inert={loading ? true : undefined}
        className={cn(
          "col-start-1 row-start-1 min-w-0 transition-[opacity,filter] duration-200 ease-out motion-reduce:transition-none motion-reduce:blur-none",
          loading ? "pointer-events-none opacity-0 blur-[2px]" : "opacity-100 blur-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}
