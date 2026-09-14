import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RiCloseLine } from "@remixicon/react";
import { Button } from "./button.js";
import { useI18n } from "../../lib/i18n.js";
import { Dialog, DialogBackdrop, DialogClose, DialogDescription, DialogHeader, DialogPanel, DialogPopup, DialogPortal, DialogTitle, DialogViewport, } from "./dialog.js";
export function Modal({ open, title, description, onClose, children, className, }) {
    const { t } = useI18n();
    return (_jsx(Dialog, { open: open, onOpenChange: (nextOpen) => { if (!nextOpen)
            onClose(); }, children: _jsxs(DialogPortal, { children: [_jsx(DialogBackdrop, {}), _jsx(DialogViewport, { children: _jsxs(DialogPopup, { className: className, children: [_jsxs(DialogHeader, { children: [_jsxs("div", { className: "min-w-0", children: [_jsx(DialogTitle, { children: title }), description ? _jsx(DialogDescription, { children: description }) : null] }), _jsx(DialogClose, { render: _jsx(Button, { variant: "ghost", size: "icon-sm", "aria-label": t("关闭", "Close") }), children: _jsx(RiCloseLine, { className: "size-4", "aria-hidden": "true" }) })] }), _jsx(DialogPanel, { children: children })] }) })] }) }));
}
