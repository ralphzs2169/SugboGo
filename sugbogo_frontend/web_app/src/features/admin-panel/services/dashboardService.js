import { adminPanelApi } from "@/shared/services/api";

export const getDashboardData = async () => adminPanelApi.get("/dashboard/");
