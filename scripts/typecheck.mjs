import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import process from "node:process";

const require = createRequire(import.meta.url);
const requiredPackages = ["react", "react-dom", "lucide-react", "@base-ui/react", "@types/react/package.json", "@types/react-dom/package.json"];
const requireInstalled = process.argv.includes("--require-installed");
const hasInstalledAppTypes = requiredPackages.every((name) => {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
});

function runTsc(args) {
  const result = spawnSync("tsc", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (hasInstalledAppTypes) {
  console.log("Typecheck mode: installed package types");
  runTsc(["-b", "--pretty", "false"]);
  process.exit(0);
}

if (requireInstalled) {
  console.error("Installed React/Lucide type packages are required for this verification mode. Run npm install first.");
  process.exit(2);
}

const fallbackDir = ".typecheck-fallback";
rmSync(fallbackDir, { recursive: true, force: true });
mkdirSync(fallbackDir, { recursive: true });
writeFileSync(`${fallbackDir}/vendor.d.ts`, `
declare namespace React { type ReactNode = any; }
declare namespace JSX {
  interface IntrinsicElements { [elemName: string]: any }
  interface IntrinsicAttributes { key?: any }
  interface Element {}
}
declare module "react" {
  export type ReactNode = any;
  export type SetStateAction<T> = T | ((prev: T) => T);
  export type Dispatch<A> = (value: A) => void;
  export type ButtonHTMLAttributes<T> = any;
  export type InputHTMLAttributes<T> = any;
  export type TextareaHTMLAttributes<T> = any;
  export type SelectHTMLAttributes<T> = any;
  export type HTMLAttributes<T> = any;
  export type AnchorHTMLAttributes<T> = any;
  export type TableHTMLAttributes<T> = any;
  export type TdHTMLAttributes<T> = any;
  export type ThHTMLAttributes<T> = any;
  export type Context<T> = { Provider: any; __value?: T };
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(context: Context<T>): T;
  export function useState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: any[]): T;
  export function useRef<T>(initial: T | null): { current: T | null };
  export const Children: { toArray(children: any): any[] };
  export function isValidElement(value: any): boolean;
  export type ReactElement<P = any> = { type: any; props: P; key?: any };
  export const StrictMode: any;
}
declare module "react/jsx-runtime" {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
}
declare module "react-dom/client" {
  export function createRoot(element: Element): { render(node: any): void };
}
declare module "@base-ui/react/button" { export const Button: any; }
declare module "@base-ui/react/input" { export const Input: any; }
declare module "@base-ui/react/field" { export const Field: any; }
declare module "@base-ui/react/dialog" { export const Dialog: any; }
declare module "@base-ui/react/select" { export const Select: any; }
declare module "@base-ui/react/checkbox" { export const Checkbox: any; }
declare module "@base-ui/react/switch" { export const Switch: any; }
declare module "@base-ui/react/tooltip" { export const Tooltip: any; }
declare module "@base-ui/react/merge-props" { export function mergeProps(...args: any[]): any; }
declare module "@base-ui/react/use-render" { export function useRender(options: any): any; }
declare module "@base-ui/react/menu" { export const Menu: any; }
declare module "@base-ui/react/tabs" { export const Tabs: any; }
declare module "@base-ui/react/toast" { export const Toast: any; }
declare module "@base-ui/react/autocomplete" { export const Autocomplete: any; }
declare module "@base-ui/react/toolbar" { export const Toolbar: any; }
declare module "@base-ui/react/toggle-group" { export const ToggleGroup: any; }
declare module "@base-ui/react/toggle" { export const Toggle: any; }
declare module "@base-ui/react/alert-dialog" { export const AlertDialog: any; }
declare module "lucide-react" {
  const icon: any;
  export { icon as ArchiveIcon, icon as ArrowDownIcon, icon as ArrowLeftIcon, icon as ArrowUpIcon,
    icon as BellIcon, icon as BellOffIcon, icon as CheckIcon, icon as ChevronDownIcon, icon as ChevronLeftIcon,
    icon as ChevronRightIcon, icon as CircleCheckIcon, icon as CircleHelpIcon, icon as ClockIcon,
    icon as DownloadIcon, icon as EllipsisVerticalIcon, icon as EyeIcon, icon as EyeOffIcon,
    icon as ExternalLinkIcon, icon as GithubIcon, icon as GitForkIcon, icon as InfoIcon, icon as KeyRoundIcon,
    icon as LaptopIcon, icon as LoaderCircleIcon, icon as MenuIcon, icon as MonitorIcon, icon as PencilIcon,
    icon as PlusIcon, icon as RefreshCwIcon, icon as SearchIcon, icon as SettingsIcon, icon as ShieldCheckIcon,
    icon as SmartphoneIcon, icon as SparklesIcon, icon as StarIcon, icon as TabletIcon, icon as TagIcon,
    icon as TriangleAlertIcon, icon as UploadIcon, icon as XIcon };
}
`);
writeFileSync(`${fallbackDir}/tsconfig.app.json`, JSON.stringify({
  extends: "../tsconfig.app.json",
  include: ["../src", "./vendor.d.ts"],
}, null, 2));

console.log("Typecheck mode: fallback shims because package types are unavailable in this execution environment");
runTsc(["-p", `${fallbackDir}/tsconfig.app.json`, "--pretty", "false"]);
runTsc(["-p", "tsconfig.worker.json", "--pretty", "false"]);
rmSync(fallbackDir, { recursive: true, force: true });
