import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import { ToastProvider } from "./components/ui/toast";
import "./styles.css";
import "./responsive-fixes.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
