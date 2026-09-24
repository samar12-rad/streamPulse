import { useContext } from "react";
import { DashboardContext, type DashboardContextValue } from "./DashboardProvider";

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard must be used inside <DashboardProvider>");
  return context;
}
