import { RiAndroidLine, RiComputerLine, RiMacbookLine, RiRefreshLine, RiShieldCheckLine, RiSmartphoneLine, RiTabletLine, RiWindowsLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { notify } from "../../components/ui/toast";
import { fetchLoginDevices, revokeLoginDevice, revokeOtherLoginDevices } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { LoginDevice } from "../../types";

function locationLabel(device: LoginDevice, fallback: string) {
  const parts = [device.city, device.region, device.countryCode].filter(Boolean);
  return parts.length ? parts.join(" · ") : fallback;
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DeviceTypeIcon({ device }: { device: LoginDevice }) {
  const os = device.os.trim().toLowerCase();
  const iconProps = { className: "size-4", "aria-hidden": true } as const;

  if (os.includes("mac")) return <RiMacbookLine {...iconProps} />;
  if (os.includes("windows")) return <RiWindowsLine {...iconProps} />;
  if (os.includes("android")) return <RiAndroidLine {...iconProps} />;
  if (os.includes("ipad")) return <RiTabletLine {...iconProps} />;
  if (os.includes("ios") || os.includes("iphone")) return device.type === "tablet" ? <RiTabletLine {...iconProps} /> : <RiSmartphoneLine {...iconProps} />;
  if (device.type === "tablet") return <RiTabletLine {...iconProps} />;
  if (device.type === "mobile") return <RiSmartphoneLine {...iconProps} />;
  return <RiComputerLine {...iconProps} />;
}

export function LoginDevicesSettings({ username, onCurrentRevoked, onSignOut }: { username?: string; onCurrentRevoked: () => void; onSignOut: () => void }) {
  const { t, locale } = useI18n();
  const [devices, setDevices] = useState<LoginDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { setDevices(await fetchLoginDevices()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t("登录设备读取失败", "Failed to load login devices")); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function revoke(device: LoginDevice) {
    setBusyId(device.id); setError("");
    try {
      const result = await revokeLoginDevice(device.id);
      if (result.currentRevoked) { onCurrentRevoked(); return; }
      setDevices(result.devices);
      notify(t("设备已退出", "Device signed out"), device.name, "success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("退出设备失败", "Failed to sign out device")); }
    finally { setBusyId(""); }
  }

  async function revokeOthers() {
    setBusyId("others"); setError("");
    try {
      setDevices(await revokeOtherLoginDevices());
      notify(t("其他设备已退出", "Other devices signed out"), t("当前设备保持登录", "This device stays signed in"), "success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("退出其他设备失败", "Failed to sign out other devices")); }
    finally { setBusyId(""); }
  }

  const otherCount = devices.filter((device) => !device.current).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary"><RiShieldCheckLine className="size-4" /></span>
          <div className="min-w-0"><p className="truncate text-sm font-medium">{username || t("已登录", "Signed in")}</p><p className="mt-0.5 text-xs text-muted-foreground">{t("管理当前账户的登录设备和会话。", "Manage devices and sessions signed in to this account.")}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} loading={loading}><RiRefreshLine className="size-4" />{t("刷新", "Refresh")}</Button>
          {otherCount ? <Button variant="outline" size="sm" loading={busyId === "others"} onClick={() => void revokeOthers()}>{t("退出其他设备", "Sign out other devices")}</Button> : null}
          <Button variant="ghost" size="sm" onClick={onSignOut}>{t("退出当前设备", "Sign out this device")}</Button>
        </div>
      </div>

      {error ? <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {!loading && !devices.length ? <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{t("暂无可显示的登录设备。", "No login devices to show.")}</div> : null}

      <div className="overflow-hidden rounded-xl border border-border/70">
        {devices.map((device, index) => (
          <div key={device.id} className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center ${index ? "border-t border-border/70" : ""}`}>
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground"><DeviceTypeIcon device={device} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-medium">{device.name}</p>{device.current ? <span className="rounded-md bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success-foreground">{t("当前设备", "Current device")}</span> : null}</div>
              <p className="mt-1 text-xs text-muted-foreground">{[device.os, device.browser].filter(Boolean).join(" · ") || t("未知设备", "Unknown device")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("位置", "Location")}: {locationLabel(device, t("未知", "Unknown"))}{device.ipAddress ? ` · ${device.ipAddress}` : ""}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("上次访问", "Last active")}: {formatDate(device.lastSeenAt, locale)} · {t("登录时间", "Signed in")}: {formatDate(device.createdAt, locale)}</p>
            </div>
            <div className="flex shrink-0 gap-2 self-end sm:self-auto">
              <Button variant={device.current ? "outline" : "destructive"} size="sm" loading={busyId === device.id} onClick={() => void revoke(device)}>{t("退出设备", "Sign out")}</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
