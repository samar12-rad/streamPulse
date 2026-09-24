import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { DashboardProvider } from "./features/dashboard/state/DashboardProvider";
import { createQueryClient } from "./shared/api/queryClient";
import "./styles/global.css";

const queryClient = createQueryClient();

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DashboardProvider>
        <App />
      </DashboardProvider>
    </QueryClientProvider>
  </StrictMode>
);
