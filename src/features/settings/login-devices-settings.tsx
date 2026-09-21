import { RiAndroidLine, RiComputerLine, RiMacbookLine, RiSmartphoneLine, RiTabletLine, RiWindowsLine } from "@remixicon/react";
import { RefreshCwIcon, ShieldCheckIcon } from "../../lib/animated-icons";
import { useEffect, useState } from "react";
import { SettingsList, SettingsRow, SettingsRowActions, SettingsRowContent, SettingsRowDescription, SettingsRowHeader, SettingsRowIcon, SettingsRowTitle } from "../../components/patterns/settings-list";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
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
    } catch (reason) { setError(reason instanceof Error ? reason.message : t(`退出设备失败：${device.name}`, `Failed to sign out device: ${device.name}`)); }
    finally { setBusyId(""); }
  }

  async function revokeOthers() {
    setBusyId("others"); setError("");
    try {
      setDevices(await revokeOtherLoginDevices());
      notify(t("其他设备已退出", "Other devices signed out"), t("当前设备保持登录", "This device stays signed in"), "success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("退出其他设备失败，请稍后重试", "Failed to sign out other devices. Try again later.")); }
    finally { setBusyId(""); }
  }

  const otherCount = devices.filter((device) => !device.current).length;

  return (
    <div className="grid gap-4">
      <SettingsList>
        <SettingsRow className="py-3">
          <SettingsRowIcon><ShieldCheckIcon className="size-4" aria-hidden="true" /></SettingsRowIcon>
          <SettingsRowContent>
            <SettingsRowTitle>{username || t("已登录", "Signed in")}</SettingsRowTitle>
            <SettingsRowDescription>{t("管理当前账户的登录设备和会话。", "Manage devices and sessions signed in to this account.")}</SettingsRowDescription>
          </SettingsRowContent>
          <SettingsRowActions>
            <Button variant="outline" size="sm" onClick={() => void load()} loading={loading}><RefreshCwIcon className="size-4" aria-hidden="true" />{t("刷新", "Refresh")}</Button>
            {otherCount ? <Button variant="outline" size="sm" loading={busyId === "others"} onClick={() => void revokeOthers()}>{t("退出其他设备", "Sign out other devices")}</Button> : null}
            <Button variant="ghost" size="sm" onClick={onSignOut}>{t("退出当前设备", "Sign out this device")}</Button>
          </SettingsRowActions>
        </SettingsRow>
      </SettingsList>

      {error ? <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {!loading && !devices.length ? <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{t("暂无可显示的登录设备。", "No login devices to show.")}</div> : null}

      <SettingsList>
        {devices.map((device) => (
          <SettingsRow key={device.id}>
            <SettingsRowIcon><DeviceTypeIcon device={device} /></SettingsRowIcon>
            <SettingsRowContent>
              <SettingsRowHeader>
                <SettingsRowTitle>{device.name}</SettingsRowTitle>
                {device.current ? <Badge variant="success" size="sm">{t("当前设备", "Current device")}</Badge> : null}
              </SettingsRowHeader>
              <SettingsRowDescription>{[device.os, device.browser].filter(Boolean).join(" · ") || t("未知设备", "Unknown device")}</SettingsRowDescription>
              <SettingsRowDescription>{t("位置", "Location")}: {locationLabel(device, t("未知", "Unknown"))}{device.ipAddress ? ` · ${device.ipAddress}` : ""}</SettingsRowDescription>
              <SettingsRowDescription>{t("上次访问", "Last active")}: {formatDate(device.lastSeenAt, locale)} · {t("登录时间", "Signed in")}: {formatDate(device.createdAt, locale)}</SettingsRowDescription>
            </SettingsRowContent>
            <SettingsRowActions>
              <Button variant={device.current ? "outline" : "destructive"} size="sm" loading={busyId === device.id} onClick={() => void revoke(device)}>{t("退出设备", "Sign out")}</Button>
            </SettingsRowActions>
          </SettingsRow>
        ))}
      </SettingsList>
    </div>
  );
}
