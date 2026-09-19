"use client";

import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type MotionSvgProps = ComponentProps<typeof motion.svg>;
type AnimatedIconProps = Omit<MotionSvgProps, "children" | "className"> & {
  className?: string;
  children?: ReactNode;
  hover?: MotionSvgProps["whileHover"];
};

function AnimatedIcon({ children, className, hover, ...props }: AnimatedIconProps) {
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <motion.svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={cn("shrink-0", className)}
      whileHover={reduceMotion ? undefined : hover}
      whileTap={reduceMotion ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.6 }}
      {...props}
    >
      {children}
    </motion.svg>
  );
}

export function SearchIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ x: [0, -1.5, 1, 0], y: [0, -1.5, 0] }} {...props}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></AnimatedIcon>;
}

export function SettingsIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ rotate: 35 }} {...props}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></AnimatedIcon>;
}

export function RefreshCwIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ rotate: 90 }} {...props}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></AnimatedIcon>;
}

export function DownloadIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ y: 2 }} {...props}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></AnimatedIcon>;
}

export function UploadIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ y: -2 }} {...props}><path d="M12 21V9" /><path d="m17 14-5-5-5 5" /><path d="M5 3h14" /></AnimatedIcon>;
}

export function ChevronDownIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ y: 1.5 }} {...props}><path d="m6 9 6 6 6-6" /></AnimatedIcon>;
}
export function ChevronLeftIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ x: -1.5 }} {...props}><path d="m15 18-6-6 6-6" /></AnimatedIcon>;
}
export function ChevronRightIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ x: 1.5 }} {...props}><path d="m9 18 6-6-6-6" /></AnimatedIcon>;
}
export function ArrowDownIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ y: 2 }} {...props}><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></AnimatedIcon>;
}
export function ArrowLeftIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ x: -2 }} {...props}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></AnimatedIcon>;
}

export function XIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ rotate: 90 }} {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></AnimatedIcon>;
}
export function CheckIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ scale: 1.12 }} {...props}><path d="M20 6 9 17l-5-5" /></AnimatedIcon>;
}
export function CircleCheckIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ scale: 1.08 }} {...props}><path d="M22 11.1V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></AnimatedIcon>;
}
export function EyeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ scale: 1.08 }} {...props}><path d="M2.06 12.35a1 1 0 0 1 0-.7C3.73 7.6 7.7 5 12 5c4.3 0 8.27 2.6 9.94 6.65a1 1 0 0 1 0 .7C20.27 16.4 16.3 19 12 19c-4.3 0-8.27-2.6-9.94-6.65Z" /><circle cx="12" cy="12" r="3" /></AnimatedIcon>;
}
export function EyeOffIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ x: 1 }} {...props}><path d="m2 2 20 20" /><path d="M6.71 6.71C4.9 7.95 3.5 9.65 2.66 11.65a1 1 0 0 0 0 .7C4.33 16.4 8.3 19 12.6 19c1.4 0 2.76-.28 4-.78" /><path d="M10.73 5.08A9.8 9.8 0 0 1 12 5c4.3 0 8.27 2.6 9.94 6.65a1 1 0 0 1 0 .7 10.3 10.3 0 0 1-2.1 3.3" /><path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" /></AnimatedIcon>;
}
export function ShieldCheckIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ scale: 1.08, y: -1 }} {...props}><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z" /><path d="m9 12 2 2 4-4" /></AnimatedIcon>;
}
export function ExternalLinkIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ x: 1.5, y: -1.5 }} {...props}><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></AnimatedIcon>;
}
export function SparklesIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ rotate: 8, scale: 1.1 }} {...props}><path d="m12 3-1.9 5.1a2 2 0 0 1-1.18 1.18L4 11l4.92 1.72a2 2 0 0 1 1.18 1.18L12 19l1.9-5.1a2 2 0 0 1 1.18-1.18L20 11l-4.92-1.72a2 2 0 0 1-1.18-1.18L12 3Z" /><path d="M5 3v4" /><path d="M3 5h4" /><path d="M19 17v4" /><path d="M17 19h4" /></AnimatedIcon>;
}
export function ArchiveIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ y: -1.5 }} {...props}><rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v13h16V8" /><path d="M10 12h4" /></AnimatedIcon>;
}
export function MenuIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ scaleX: 1.12 }} {...props}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></AnimatedIcon>;
}
export function CircleHelpIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ y: -1.5, scale: 1.05 }} {...props}><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 1 1 5.83 1c0 2-3 2-3 4" /><path d="M12 18h.01" /></AnimatedIcon>;
}
export function BadgeAlertIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ y: -1.5, scale: 1.05 }} {...props}><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.78 4 4 0 0 1 0-6.75Z" /><path d="M12 8v4" /><path d="M12 16h.01" /></AnimatedIcon>;
}
export function LoaderCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ rotate: 180 }} {...props}><path d="M21 12a9 9 0 1 1-6.22-8.56" /></AnimatedIcon>;
}
export function KeyIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ rotate: -8, x: -1 }} {...props}><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></AnimatedIcon>;
}
export function ClockIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ rotate: 8 }} {...props}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></AnimatedIcon>;
}
export function PlusIcon(props: AnimatedIconProps) {
  return <AnimatedIcon hover={{ rotate: 90 }} {...props}><path d="M5 12h14" /><path d="M12 5v14" /></AnimatedIcon>;
}
