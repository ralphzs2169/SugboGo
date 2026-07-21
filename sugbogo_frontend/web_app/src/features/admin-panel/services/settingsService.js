import apiClient from "@/shared/api/apiClient";

export const getSettingsData = async () =>
  apiClient.get("/admin-panel/settings/");
