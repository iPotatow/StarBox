import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import { ToastProvider } from "./components/ui/toast";
import "./styles.css";
import { TooltipProvider } from "./components/ui/tooltip";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </TooltipProvider>
  </StrictMode>,
);
