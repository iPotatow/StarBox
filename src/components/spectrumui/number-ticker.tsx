/**
 * Adapted from Spectrum UI Number Ticker:
 * https://ui.spectrumhq.in/docs/number-ticker
 *
 * Implements the rolling digit column with CSS transitions so StarBox does not
 * add Spectrum's optional Motion dependency.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/cn";

export interface NumberTickerProps {
  value: number;
  locale?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
  digitClassName?: string;
}

const DIGIT_HEIGHT_EM = 1.1;
const DIGITS = Array.from({ length: 10 }, (_, value) => value);

export function NumberTicker({
  value,
  locale = false,
  prefix,
  suffix,
  className,
  digitClassName,
}: NumberTickerProps) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const text = useMemo(() => {
    const rounded = Math.round(value);
    return locale ? rounded.toLocaleString() : rounded.toString();
  }, [locale, value]);
  const glyphs = useMemo(() => {
    const chars = text.split("");
    return chars.map((char, index) => ({ char, id: `g-${chars.length - 1 - index}` }));
  }, [text]);
  const readable = `${prefix ?? ""}${text}${suffix ?? ""}`;

  return (
    <span className={cn("inline-flex items-center tabular-nums", className)}>
      <span className="sr-only">{readable}</span>
      <span aria-hidden="true" className="inline-flex items-center">
        {prefix ? <span>{prefix}</span> : null}
        {glyphs.map(({ char, id }) => /\d/.test(char)
          ? <Digit key={id} digit={armed ? Number(char) : 0} className={digitClassName} />
          : <span key={id} className="inline-block">{char}</span>)}
        {suffix ? <span>{suffix}</span> : null}
      </span>
    </span>
  );
}

function Digit({ digit, className }: { digit: number; className?: string }) {
  return (
    <span
      className={cn("relative inline-block overflow-hidden", className)}
      style={{ height: `${DIGIT_HEIGHT_EM}em`, width: "1ch" }}
    >
      <span
        className="absolute inset-x-0 top-0 flex flex-col items-center transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none"
        style={{ transform: `translateY(-${digit * DIGIT_HEIGHT_EM}em)` }}
      >
        {DIGITS.map((value) => (
          <span key={value} className="flex h-[1.1em] items-center justify-center leading-none">{value}</span>
        ))}
      </span>
    </span>
  );
}
