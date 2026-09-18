import { animate } from "motion";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/cn";

type AnimatedProgressProps = {
  value?: number;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
  "aria-label"?: string;
};

export function AnimatedProgress({ value = 0, className, trackClassName, indicatorClassName, "aria-label": ariaLabel }: AnimatedProgressProps) {
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const normalizedValue = Math.min(100, Math.max(0, Number(value ?? 0)));

  useEffect(() => {
    const indicator = indicatorRef.current;
    if (!indicator) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let controls: ReturnType<typeof animate> | undefined;

    const sync = () => {
      controls?.stop();
      controls = undefined;

      if (reducedMotion.matches) {
        indicator.style.width = `${normalizedValue}%`;
        return;
      }

      controls = animate(
        indicator,
        { width: `${normalizedValue}%` },
        { type: "spring", stiffness: 100, damping: 30, mass: 1 },
      );
    };

    sync();
    reducedMotion.addEventListener("change", sync);
    return () => {
      controls?.stop();
      reducedMotion.removeEventListener("change", sync);
    };
  }, [normalizedValue]);

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(normalizedValue)}
      className={cn("w-full", className)}
      data-slot="animated-progress"
    >
      <div className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-input", trackClassName)} data-slot="animated-progress-track">
        <div
          ref={indicatorRef}
          style={{ width: `${normalizedValue}%` }}
          className={cn("h-full rounded-full bg-primary", indicatorClassName)}
          data-slot="animated-progress-indicator"
        />
      </div>
    </div>
  );
}
