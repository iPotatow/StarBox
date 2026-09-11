import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app.js";
import { ToastProvider } from "./components/ui/toast.js";

createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsx(ToastProvider, { children: _jsx(App, {}) }) }));
