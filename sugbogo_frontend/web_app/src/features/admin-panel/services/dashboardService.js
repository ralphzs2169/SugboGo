import apiClient from "@/shared/api/apiClient";

export const getDashboardData = async () =>
  apiClient.get("/admin-panel/dashboard/");
