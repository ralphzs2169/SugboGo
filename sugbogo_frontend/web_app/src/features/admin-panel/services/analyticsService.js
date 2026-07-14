import { adminPanelApi } from "@/shared/services/api";

export const getAnalyticsData = async () => adminPanelApi.get("/analytics/");
