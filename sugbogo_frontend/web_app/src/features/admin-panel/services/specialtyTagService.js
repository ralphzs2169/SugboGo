import apiClient from "@/shared/api/apiClient";

export const getSpecialtyTagData = async () =>
  apiClient.get("/admin-panel/specialty-tags/");
