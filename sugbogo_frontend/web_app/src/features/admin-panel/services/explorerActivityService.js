import apiClient from "@/shared/api/apiClient";

export const getExplorerActivityData = async () =>
  apiClient.get("/admin-panel/explorer-activities/");
