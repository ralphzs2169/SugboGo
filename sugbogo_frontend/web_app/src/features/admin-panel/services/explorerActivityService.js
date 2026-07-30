import apiClient from "@/shared/api/apiClient";

export const getExplorerActivityData = async () =>
  apiClient.get("/admin/explorer-activities/");
