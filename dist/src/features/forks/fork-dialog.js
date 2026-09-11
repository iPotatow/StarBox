import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiGitForkLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button.js";
import { Checkbox } from "../../components/ui/checkbox.js";
import { Field } from "../../components/ui/field.js";
import { Input } from "../../components/ui/input.js";
import { Modal } from "../../components/ui/modal.js";
import { createFork } from "../../lib/api.js";
export function ForkDialog({ open, token, credentialConnected, sourceFullName, onClose, onCreated, }) {
    const [organization, setOrganization] = useState("");
    const [name, setName] = useState("");
    const [defaultBranchOnly, setDefaultBranchOnly] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        if (!open)
            return;
        setOrganization("");
        setName("");
        setDefaultBranchOnly(false);
        setError("");
    }, [open, sourceFullName]);
    async function submit() {
        if (!token.trim() && !credentialConnected) {
            setError("请先在设置中连接 GitHub 凭据");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const result = await createFork(token.trim(), {
                sourceFullName,
                organization: organization.trim() || undefined,
                name: name.trim() || undefined,
                defaultBranchOnly,
            });
            const now = new Date().toISOString();
            onCreated({
                id: crypto.randomUUID(),
                sourceFullName,
                targetOwner: result.targetOwner,
                targetName: result.targetName,
                targetFullName: result.targetFullName,
                htmlUrl: result.htmlUrl,
                status: result.status,
                createdAt: now,
                updatedAt: now,
                error: "",
                pollAttempts: 0,
                nextPollAt: result.status === "pending" ? now : null,
            });
            onClose();
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Fork 创建失败");
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx(Modal, { open: open, title: `Fork ${sourceFullName}`, description: "\u76EE\u6807\u7EC4\u7EC7\u4E0E\u4ED3\u5E93\u540D\u53EF\u7559\u7A7A\uFF1B\u7559\u7A7A\u65F6\u4F7F\u7528\u5F53\u524D GitHub \u7528\u6237\u548C\u539F\u4ED3\u5E93\u540D\u3002", onClose: onClose, children: _jsxs("div", { className: "grid gap-4", children: [_jsx(Field, { label: "\u76EE\u6807\u7EC4\u7EC7", description: "\u53EF\u9009\u3002\u586B\u5199\u540E\u9700\u8981 Token \u5BF9\u8BE5\u7EC4\u7EC7\u5177\u5907\u521B\u5EFA\u4ED3\u5E93\u6743\u9650\u3002", children: _jsx(Input, { value: organization, onChange: (event) => setOrganization(event.target.value), placeholder: "my-org" }) }), _jsx(Field, { label: "\u76EE\u6807\u4ED3\u5E93\u540D", description: "\u53EF\u9009\u3002GitHub \u652F\u6301\u4E3A Fork \u6307\u5B9A\u65B0\u540D\u79F0\u3002", children: _jsx(Input, { value: name, onChange: (event) => setName(event.target.value), placeholder: sourceFullName.split("/")[1] || "repo" }) }), _jsxs("label", { className: "flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm", children: [_jsx(Checkbox, { checked: defaultBranchOnly, onCheckedChange: setDefaultBranchOnly, "aria-label": "\u4EC5 Fork \u9ED8\u8BA4\u5206\u652F" }), "\u4EC5 Fork \u9ED8\u8BA4\u5206\u652F"] }), error ? _jsx("p", { className: "text-sm text-destructive-foreground", children: error }) : null, _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "ghost", onClick: onClose, children: "\u53D6\u6D88" }), _jsxs(Button, { onClick: () => void submit(), loading: loading, children: [_jsx(RiGitForkLine, { className: "size-4" }), "\u521B\u5EFA Fork"] })] })] }) }));
}
