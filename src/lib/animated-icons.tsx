"use client";

import {
  ArchiveIcon as LucideArchiveIcon,
  ArrowDownIcon as LucideArrowDownIcon,
  ArrowLeftIcon as LucideArrowLeftIcon,
  CheckIcon as LucideCheckIcon,
  ChevronDownIcon as LucideChevronDownIcon,
  ChevronLeftIcon as LucideChevronLeftIcon,
  ChevronRightIcon as LucideChevronRightIcon,
  CircleCheckIcon as LucideCircleCheckIcon,
  CircleHelpIcon as LucideCircleHelpIcon,
  ClockIcon as LucideClockIcon,
  DownloadIcon as LucideDownloadIcon,
  EyeIcon as LucideEyeIcon,
  EyeOffIcon as LucideEyeOffIcon,
  ExternalLinkIcon as LucideExternalLinkIcon,
  KeyRoundIcon as LucideKeyRoundIcon,
  LoaderCircleIcon as LucideLoaderCircleIcon,
  MenuIcon as LucideMenuIcon,
  PlusIcon as LucidePlusIcon,
  RefreshCwIcon as LucideRefreshCwIcon,
  SearchIcon as LucideSearchIcon,
  SettingsIcon as LucideSettingsIcon,
  ShieldCheckIcon as LucideShieldCheckIcon,
  SparklesIcon as LucideSparklesIcon,
  TriangleAlertIcon as LucideTriangleAlertIcon,
  UploadIcon as LucideUploadIcon,
  XIcon as LucideXIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "./cn";

type AnimatedIconProps = ComponentProps<typeof LucideSearchIcon>;
type IconComponent = typeof LucideSearchIcon;

function AnimatedIcon({
  icon: Icon,
  className,
  ...props
}: AnimatedIconProps & { icon: IconComponent }) {
  return (
    <Icon
      focusable="false"
      data-animated-icon=""
      className={cn(
        "shrink-0 transition-transform duration-150 ease-out in-[[data-slot=button]:hover]:scale-[1.06] in-[[data-slot=button]:active]:scale-[0.94] motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export function SearchIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideSearchIcon} {...props} />;
}

export function SettingsIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideSettingsIcon} {...props} />;
}

export function RefreshCwIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideRefreshCwIcon} {...props} />;
}

export function DownloadIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideDownloadIcon} {...props} />;
}

export function UploadIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideUploadIcon} {...props} />;
}

export function ChevronDownIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideChevronDownIcon} {...props} />;
}

export function ChevronLeftIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideChevronLeftIcon} {...props} />;
}

export function ChevronRightIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideChevronRightIcon} {...props} />;
}

export function ArrowDownIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideArrowDownIcon} {...props} />;
}

export function ArrowLeftIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideArrowLeftIcon} {...props} />;
}

export function XIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideXIcon} {...props} />;
}

export function CheckIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideCheckIcon} {...props} />;
}

export function CircleCheckIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideCircleCheckIcon} {...props} />;
}

export function EyeIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideEyeIcon} {...props} />;
}

export function EyeOffIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideEyeOffIcon} {...props} />;
}

export function ShieldCheckIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideShieldCheckIcon} {...props} />;
}

export function ExternalLinkIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideExternalLinkIcon} {...props} />;
}

export function SparklesIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideSparklesIcon} {...props} />;
}

export function ArchiveIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideArchiveIcon} {...props} />;
}

export function MenuIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideMenuIcon} {...props} />;
}

export function CircleHelpIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideCircleHelpIcon} {...props} />;
}

export function BadgeAlertIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideTriangleAlertIcon} {...props} />;
}

export function LoaderCircleIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideLoaderCircleIcon} {...props} />;
}

export function KeyIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideKeyRoundIcon} {...props} />;
}

export function ClockIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucideClockIcon} {...props} />;
}

export function PlusIcon(props: AnimatedIconProps) {
  return <AnimatedIcon icon={LucidePlusIcon} {...props} />;
}
