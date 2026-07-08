import { adminPanelApi } from "../api";

export const getAnalyticsData = async () => 
    adminPanelApi.get("/analytics/")