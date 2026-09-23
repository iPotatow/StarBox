"use client";

import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowSquareOut,
  ArrowsClockwise,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  DownloadSimple,
  Eye,
  EyeSlash,
  Key,
  List,
  MagnifyingGlass,
  Plus,
  Question,
  ShieldCheck,
  Sparkle,
  SpinnerGap,
  UploadSimple,
  Warning,
  X,
  Gear,
  type Icon,
  type IconProps,
} from "@phosphor-icons/react";
import { cn } from "./cn";

type AnimatedIconProps = IconProps;
type IconComponent = Icon;

function AnimatedIcon({
  icon: IconComponent,
  className,
  ...props
}: AnimatedIconProps & { icon: IconComponent }) {
  return (
    <IconComponent
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

export function SearchIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={MagnifyingGlass} {...props} />; }
export function SettingsIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={Gear} {...props} />; }
export function RefreshCwIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={ArrowsClockwise} {...props} />; }
export function DownloadIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={DownloadSimple} {...props} />; }
export function UploadIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={UploadSimple} {...props} />; }
export function ChevronDownIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={CaretDown} {...props} />; }
export function ChevronLeftIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={CaretLeft} {...props} />; }
export function ChevronRightIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={CaretRight} {...props} />; }
export function ArrowDownIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={ArrowDown} {...props} />; }
export function ArrowLeftIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={ArrowLeft} {...props} />; }
export function XIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={X} {...props} />; }
export function CheckIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={Check} {...props} />; }
export function CircleCheckIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={CheckCircle} {...props} />; }
export function EyeIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={Eye} {...props} />; }
export function EyeOffIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={EyeSlash} {...props} />; }
export function ShieldCheckIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={ShieldCheck} {...props} />; }
export function ExternalLinkIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={ArrowSquareOut} {...props} />; }
export function SparklesIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={Sparkle} {...props} />; }
export function ArchiveIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={Archive} {...props} />; }
export function MenuIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={List} {...props} />; }
export function CircleHelpIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={Question} {...props} />; }
export function BadgeAlertIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={Warning} {...props} />; }
export function LoaderCircleIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={SpinnerGap} {...props} />; }
export function KeyIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={Key} {...props} />; }
export function ClockIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={Clock} {...props} />; }
export function PlusIcon(props: AnimatedIconProps) { return <AnimatedIcon icon={Plus} {...props} />; }
