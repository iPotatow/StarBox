/**
 * Adapted from Spectrum UI Beam Search:
 * https://ui.spectrumhq.in/docs/beam-search
 *
 * Keeps StarBox's COSS/Base UI input composition intact and adds only the
 * focus-driven Spectrum border beam.
 */
"use client";

import { BorderBeam, type BorderBeamColorVariant } from "border-beam";
import { useState, type FocusEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { useSurfaceTheme, type SurfaceTheme } from "./use-surface-theme";

export interface BeamSearchProps {
  children: ReactNode;
  alwaysOn?: boolean;
  colorVariant?: BorderBeamColorVariant;
  theme?: SurfaceTheme;
  className?: string;
}

export function BeamSearch({
  children,
  alwaysOn = false,
  colorVariant = "colorful",
  theme = "auto",
  className,
}: BeamSearchProps) {
  const resolved = useSurfaceTheme(theme);
  const [focused, setFocused] = useState(false);

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  }

  return (
    <BorderBeam
      size="line"
      colorVariant={colorVariant}
      theme={resolved}
      active={alwaysOn || focused}
      className={cn("w-full min-w-0", className)}
    >
      <div
        data-slot="beam-search"
        className="min-w-0"
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={handleBlur}
      >
        {children}
      </div>
    </BorderBeam>
  );
}
