/**
 * Adapted from Spectrum UI Hold to Confirm:
 * https://ui.spectrumhq.in/docs/hold-to-confirm
 *
 * Keeps the progress ring, early-release cancellation, pointer/keyboard input
 * and reduced-motion behavior while using StarBox Phosphor icons and tokens.
 */
"use client";

import { TrashSimple as TrashIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface HoldToConfirmButtonProps {
  onConfirm: () => void;
  duration?: number;
  label?: string;
  confirmedLabel?: string;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
  resetDelay?: number;
  disabled?: boolean;
  className?: string;
  iconOnly?: boolean;
  ariaLabel?: string;
}
type HoldSource = "pointer" | "keyboard";

const SIZES = {
  sm: { button: "h-8 gap-1.5 pl-2 pr-3 text-xs", icon: 12, ring: 20, stroke: 2, iconOnly: "size-8 p-0" },
  md: { button: "h-10 gap-2 pl-2.5 pr-4 text-sm", icon: 14, ring: 24, stroke: 2, iconOnly: "size-10 p-0" },
  lg: { button: "h-12 gap-2.5 pl-3 pr-5 text-base", icon: 17, ring: 30, stroke: 2.5, iconOnly: "size-12 p-0" },
} as const;

function easedOut(value: number) { return 1 - Math.pow(1 - value, 3); }

export function HoldToConfirmButton({
  onConfirm,
  duration = 1200,
  label = "Hold to delete",
  confirmedLabel = "Deleted",
  icon,
  size = "md",
  resetDelay = 1500,
  disabled = false,
  className,
  iconOnly = false,
  ariaLabel,
}: HoldToConfirmButtonProps) {
  const [holding, setHolding] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progressRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmedRef = useRef(false);
  const sourcesRef = useRef<Set<HoldSource>>(new Set());
  const sizes = SIZES[size];
  const radius = (sizes.ring - sizes.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const holdSeconds = (duration / 1000).toFixed(1).replace(/\.0$/, "");

  const setProgressValue = useCallback((value: number) => {
    const next = Math.max(0, Math.min(1, value));
    progressRef.current = next;
    setProgress(next);
  }, []);

  const stopAnimation = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const animateProgress = useCallback((target: number, milliseconds: number, linear: boolean, onComplete?: () => void) => {
    stopAnimation();
    const from = progressRef.current;
    if (milliseconds <= 0 || from === target) {
      setProgressValue(target);
      onComplete?.();
      return;
    }
    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / milliseconds);
      const phase = linear ? elapsed : easedOut(elapsed);
      setProgressValue(from + (target - from) * phase);
      if (elapsed >= 1) {
        frameRef.current = null;
        onComplete?.();
      } else {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [setProgressValue, stopAnimation]);

  const handleComplete = useCallback(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    sourcesRef.current.clear();
    setHolding(false);
    setConfirmed(true);
    setProgressValue(1);
    onConfirm();
    if (resetDelay > 0) {
      resetTimerRef.current = setTimeout(() => {
        setConfirmed(false);
        confirmedRef.current = false;
        animateProgress(0, reduceMotion ? 80 : 260, false);
      }, resetDelay);
    }
  }, [animateProgress, onConfirm, reduceMotion, resetDelay, setProgressValue]);

  const startHold = useCallback((source: HoldSource) => {
    if (disabled || confirmedRef.current) return;
    const sources = sourcesRef.current;
    const alreadyHolding = sources.size > 0;
    sources.add(source);
    if (alreadyHolding) return;
    setHolding(true);
    animateProgress(1, duration * Math.max(0, 1 - progressRef.current), true, handleComplete);
  }, [animateProgress, disabled, duration, handleComplete]);

  const cancelHold = useCallback((source?: HoldSource) => {
    const sources = sourcesRef.current;
    if (source) sources.delete(source);
    else sources.clear();
    if (sources.size > 0) return;
    setHolding(false);
    if (confirmedRef.current) return;
    animateProgress(0, reduceMotion ? 80 : 220, false);
  }, [animateProgress, reduceMotion]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => () => {
    stopAnimation();
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, [stopAnimation]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* no-op */ }
    startHold("pointer");
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) startHold("keyboard");
  };
  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    cancelHold("keyboard");
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel ?? `${label}. Press and hold for ${holdSeconds} seconds to confirm`}
      data-holding={holding ? "" : undefined}
      data-confirmed={confirmed ? "" : undefined}
      onPointerDown={handlePointerDown}
      onPointerUp={() => cancelHold("pointer")}
      onPointerLeave={() => cancelHold("pointer")}
      onPointerCancel={() => cancelHold("pointer")}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={() => cancelHold()}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        "relative inline-flex touch-none select-none items-center justify-center rounded-full border border-input bg-popover font-medium text-destructive-foreground outline-none transition-[background-color,border-color,color,transform] hover:bg-destructive/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 motion-reduce:transform-none",
        confirmed && "border-foreground/20 bg-accent text-foreground",
        holding && !reduceMotion && "scale-[0.97]",
        iconOnly ? sizes.iconOnly : sizes.button,
        className,
      )}
    >
      <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: sizes.ring, height: sizes.ring }} aria-hidden="true">
        <span className={cn("inline-flex items-center justify-center transition-[opacity,transform] duration-150", confirmed && "scale-0 opacity-0")}>
          {icon ?? <TrashIcon size={sizes.icon} weight="regular" />}
        </span>
        <span className={cn("absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-150", confirmed ? "scale-100 opacity-100" : "scale-0 opacity-0")}>
          <svg viewBox="0 0 24 24" width={sizes.icon} height={sizes.icon} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <svg viewBox={`0 0 ${sizes.ring} ${sizes.ring}`} width={sizes.ring} height={sizes.ring} className={cn("absolute inset-0 -rotate-90 transition-opacity", progress > 0 ? "opacity-100" : "opacity-0")}>
          <circle cx={sizes.ring / 2} cy={sizes.ring / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth={sizes.stroke} />
          <circle cx={sizes.ring / 2} cy={sizes.ring / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={sizes.stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
        </svg>
      </span>
      {!iconOnly ? <span className={cn("whitespace-nowrap transition-opacity duration-150", holding && "opacity-60")}>{confirmed ? confirmedLabel : label}</span> : null}
      <span className="sr-only" role="status" aria-live="polite">{confirmed ? confirmedLabel : ""}</span>
    </button>
  );
}
