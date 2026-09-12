import { jsx as _jsx } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/jsx-runtime.js";
import { StrictMode } from "file:///Users/apple/Documents/ChatGPT/StarBox/.ui-verify/runtime/react.js";
import { createRoot } from "react-dom/client";
import App from "./app.js";
import { ToastProvider } from "./components/ui/toast.js";

createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsx(ToastProvider, { children: _jsx(App, {}) }) }));
