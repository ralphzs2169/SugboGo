import apiClient from "@/shared/api/apiClient";

export const getAnalyticsData = async () =>
  apiClient.get("/admin-panel/analytics/");
