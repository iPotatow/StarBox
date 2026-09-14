import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiRefreshLine, RiShieldCheckLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "../../components/ui/alert.js";
import { Button } from "../../components/ui/button.js";
import { Modal } from "../../components/ui/modal.js";
import { Field } from "../../components/ui/field.js";
import { Input } from "../../components/ui/input.js";
import { notify } from "../../components/ui/toast.js";
import { fetchLoginDevices, renameLoginDevice, revokeLoginDevice, revokeOtherLoginDevices } from "../../lib/api.js";
import { useI18n } from "../../lib/i18n.js";
function locationLabel(device, fallback) {
    const parts = [device.city, device.region, device.countryCode].filter(Boolean);
    return parts.length ? parts.join(" · ") : fallback;
}
function formatDate(value, locale) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
        return value;
    return date.toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function LoginDevicesSettings({ username, onCurrentRevoked, onSignOut }) {
    const { t, locale } = useI18n();
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState("");
    const [error, setError] = useState("");
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    async function load() {
        setLoading(true);
        setError("");
        try {
            setDevices(await fetchLoginDevices());
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("登录设备读取失败", "Failed to load login devices"));
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { void load(); }, []);
    async function rename() {
        if (!renameTarget || !renameValue.trim())
            return;
        setBusyId(renameTarget.id);
        setError("");
        try {
            setDevices(await renameLoginDevice(renameTarget.id, renameValue.trim()));
            notify(t("设备名称已更新", "Device name updated"), renameValue.trim(), "success");
            setRenameTarget(null);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("设备改名失败", "Failed to rename device"));
        }
        finally {
            setBusyId("");
        }
    }
    async function revoke(device) {
        setBusyId(device.id);
        setError("");
        try {
            const result = await revokeLoginDevice(device.id);
            if (result.currentRevoked) {
                onCurrentRevoked();
                return;
            }
            setDevices(result.devices);
            notify(t("设备已退出", "Device signed out"), device.name, "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("退出设备失败", "Failed to sign out device"));
        }
        finally {
            setBusyId("");
        }
    }
    async function revokeOthers() {
        setBusyId("others");
        setError("");
        try {
            setDevices(await revokeOtherLoginDevices());
            notify(t("其他设备已退出", "Other devices signed out"), t("当前设备保持登录", "This device stays signed in"), "success");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : t("退出其他设备失败", "Failed to sign out other devices"));
        }
        finally {
            setBusyId("");
        }
    }
    const otherCount = devices.filter((device) => !device.current).length;
    return (_jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 px-4 py-3", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [_jsx("span", { className: "grid size-9 shrink-0 place-items-center rounded-lg bg-secondary", children: _jsx(RiShieldCheckLine, { className: "size-4" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate text-sm font-medium", children: username || t("已登录", "Signed in") }), _jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: t("管理当前账户的登录设备和会话。", "Manage devices and sessions signed in to this account.") })] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => void load(), loading: loading, children: [_jsx(RiRefreshLine, { className: "size-4" }), t("刷新", "Refresh")] }), otherCount ? _jsx(Button, { variant: "outline", size: "sm", loading: busyId === "others", onClick: () => void revokeOthers(), children: t("退出其他设备", "Sign out other devices") }) : null, _jsx(Button, { variant: "ghost", size: "sm", onClick: onSignOut, children: t("退出当前设备", "Sign out this device") })] })] }), error ? _jsx(Alert, { variant: "error", children: _jsx(AlertDescription, { children: error }) }) : null, !loading && !devices.length ? _jsx("div", { className: "rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground", children: t("暂无可显示的登录设备。", "No login devices to show.") }) : null, _jsx("div", { className: "overflow-hidden rounded-xl border border-border/70", children: devices.map((device, index) => (_jsxs("div", { className: `flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center ${index ? "border-t border-border/70" : ""}`, children: [_jsx("span", { className: "grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold", children: device.type === "mobile" ? "M" : device.type === "tablet" ? "T" : "D" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "truncate text-sm font-medium", children: device.name }), device.current ? _jsx("span", { className: "rounded-md bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success-foreground", children: t("当前设备", "Current device") }) : null] }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: [device.os, device.browser].filter(Boolean).join(" · ") || t("未知设备", "Unknown device") }), _jsxs("p", { className: "mt-1 text-xs text-muted-foreground", children: [t("位置", "Location"), ": ", locationLabel(device, t("未知", "Unknown")), device.ipAddress ? ` · ${device.ipAddress}` : ""] }), _jsxs("p", { className: "mt-1 text-xs text-muted-foreground", children: [t("上次访问", "Last active"), ": ", formatDate(device.lastSeenAt, locale), " \u00B7 ", t("登录时间", "Signed in"), ": ", formatDate(device.createdAt, locale)] })] }), _jsxs("div", { className: "flex shrink-0 gap-2 self-end sm:self-auto", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => { setRenameTarget(device); setRenameValue(device.name); }, children: t("改名", "Rename") }), _jsx(Button, { variant: device.current ? "outline" : "destructive", size: "sm", loading: busyId === device.id, onClick: () => void revoke(device), children: t("退出设备", "Sign out") })] })] }, device.id))) }), _jsx(Modal, { open: Boolean(renameTarget), title: t("修改设备名称", "Rename device"), description: t("名称仅用于帮助你识别登录设备。", "The name only helps you identify this login device."), onClose: () => setRenameTarget(null), children: _jsxs("div", { className: "grid gap-4", children: [_jsx(Field, { label: t("设备名称", "Device name"), children: _jsx(Input, { autoFocus: true, value: renameValue, onChange: (event) => setRenameValue(event.target.value), maxLength: 80 }) }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "ghost", onClick: () => setRenameTarget(null), children: t("取消", "Cancel") }), _jsx(Button, { loading: Boolean(renameTarget && busyId === renameTarget.id), disabled: !renameValue.trim(), onClick: () => void rename(), children: t("保存", "Save") })] })] }) })] }));
}
