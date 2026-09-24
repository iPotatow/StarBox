/**
 * Adapted from Spectrum UI Morph Button:
 * https://ui.spectrumhq.in/docs/morph-button
 *
 * Preserves StarBox's COSS Button primitive, semantic tokens and shared Spinner
 * while animating the control width across idle/loading/success/error states.
 */
"use client";

import { Check as CheckIcon, X as XIcon } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEventHandler, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button, type ButtonSize, type ButtonVariant } from "../ui/button";
import { Spinner } from "../ui/spinner";

export type MorphButtonState = "idle" | "loading" | "success" | "error";

export interface MorphButtonProps {
  state: MorphButtonState;
  children: ReactNode;
  loadingLabel: string;
  successLabel: string;
  errorLabel: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  resetDelay?: number;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
}

export function MorphButton({
  state,
  children,
  loadingLabel,
  successLabel,
  errorLabel,
  onClick,
  resetDelay = 1400,
  variant = "default",
  size = "default",
  disabled = false,
  className,
}: MorphButtonProps) {
  const [visualState, setVisualState] = useState<MorphButtonState>(state);
  const [width, setWidth] = useState<number | null>(null);
  const sourceState = useRef(state);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (sourceState.current === state) return;
    sourceState.current = state;
    setVisualState(state);
  }, [state]);

  useEffect(() => {
    if (visualState !== "success" && visualState !== "error") return;
    const timer = window.setTimeout(() => setVisualState("idle"), resetDelay);
    return () => window.clearTimeout(timer);
  }, [resetDelay, visualState]);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    const content = contentRef.current;
    if (!button || !content) return;
    const styles = getComputedStyle(button);
    const target = Math.ceil(
      content.getBoundingClientRect().width
      + parseFloat(styles.paddingLeft)
      + parseFloat(styles.paddingRight)
      + parseFloat(styles.borderLeftWidth)
      + parseFloat(styles.borderRightWidth),
    );
    setWidth((current) => current === target ? current : target);
  }, [children, errorLabel, loadingLabel, successLabel, visualState]);

  const content = visualState === "loading"
    ? <><Spinner className="size-4 shrink-0" aria-hidden="true" /><span>{loadingLabel}</span></>
    : visualState === "success"
      ? <><CheckIcon className="size-4 shrink-0" weight="bold" aria-hidden="true" /><span>{successLabel}</span></>
      : visualState === "error"
        ? <><XIcon className="size-4 shrink-0" weight="bold" aria-hidden="true" /><span>{errorLabel}</span></>
        : children;

  const announcement = visualState === "loading"
    ? loadingLabel
    : visualState === "success"
      ? successLabel
      : visualState === "error"
        ? errorLabel
        : "";

  return (
    <Button
      ref={buttonRef}
      variant={variant}
      size={size}
      disabled={disabled || visualState !== "idle"}
      aria-busy={visualState === "loading" || undefined}
      data-morph-state={visualState}
      onClick={visualState === "idle" ? onClick : undefined}
      style={{ width: width == null ? undefined : `${width}px` }}
      className={cn(
        "overflow-hidden transition-[width,background-color,border-color,box-shadow,color,transform] duration-200 ease-out motion-reduce:transition-none",
        visualState === "success" && "border-success/40 bg-success/10 text-success-foreground hover:bg-success/10",
        visualState === "error" && "border-destructive/40 bg-destructive/10 text-destructive-foreground hover:bg-destructive/10",
        className,
      )}
    >
      <span ref={contentRef} className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
        {content}
      </span>
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </Button>
  );
}
