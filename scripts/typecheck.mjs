import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import process from "node:process";

const require = createRequire(import.meta.url);
const requiredPackages = ["react", "react-dom", "@remixicon/react", "@types/react/package.json", "@types/react-dom/package.json"];
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
  console.error("Installed React/RemixIcon type packages are required for this verification mode. Run npm install first.");
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
  export function useState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: any[]): T;
  export function useRef<T>(initial: T | null): { current: T | null };
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
declare module "@remixicon/react" {
  const icon: any;
  export { icon as RiAddLine, icon as RiArchiveLine, icon as RiArrowDownLine, icon as RiArrowDownSLine,
    icon as RiCheckLine, icon as RiCheckboxCircleLine, icon as RiCloseCircleLine, icon as RiCloseLine,
    icon as RiDatabase2Line, icon as RiDownload2Line, icon as RiErrorWarningLine, icon as RiExternalLinkLine,
    icon as RiEyeLine, icon as RiEyeOffLine, icon as RiFolder3Line, icon as RiGitForkLine, icon as RiGithubFill,
    icon as RiKey2Line, icon as RiLoader4Line, icon as RiMagicLine, icon as RiMoonLine, icon as RiMore2Line,
    icon as RiNotification2Line, icon as RiNotificationOffLine, icon as RiPriceTag3Line, icon as RiPushpin2Fill,
    icon as RiPushpin2Line, icon as RiRefreshLine, icon as RiRobot2Line, icon as RiSearchLine, icon as RiSettings4Line,
    icon as RiShieldCheckLine, icon as RiStarFill, icon as RiStarLine, icon as RiSunLine, icon as RiTimeLine,
    icon as RiUpload2Line };
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
