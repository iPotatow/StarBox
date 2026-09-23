/**
 * Adapted from Spectrum UI BeamCard:
 * https://ui.spectrumhq.in/docs/beam-card
 *
 * StarBox keeps its existing COSS Card surface and uses this wrapper for the
 * Spectrum themed border-beam behavior.
 */
"use client";

import type { ReactNode } from "react";
import { BorderBeam, type BorderBeamColorVariant, type BorderBeamSize } from "border-beam";
import { cn } from "../../lib/cn";
import { useSurfaceTheme, type SurfaceTheme } from "./use-surface-theme";

export interface BeamCardProps {
  children: ReactNode;
  size?: Extract<BorderBeamSize, "md" | "sm" | "pulse-inner" | "pulse-outside">;
  colorVariant?: BorderBeamColorVariant;
  theme?: SurfaceTheme;
  active?: boolean;
  strength?: number;
  className?: string;
  "data-repository-full-name"?: string;
}

export function BeamCard({
  children,
  size = "md",
  colorVariant = "colorful",
  theme = "auto",
  active = true,
  strength = 1,
  className,
  "data-repository-full-name": repositoryFullName,
}: BeamCardProps) {
  const resolved = useSurfaceTheme(theme);
  return (
    <BorderBeam
      size={size}
      colorVariant={colorVariant}
      theme={resolved}
      active={active}
      strength={strength}
      data-repository-full-name={repositoryFullName}
      className={cn("h-full w-full min-w-0", className)}
    >
      {children}
    </BorderBeam>
  );
}
