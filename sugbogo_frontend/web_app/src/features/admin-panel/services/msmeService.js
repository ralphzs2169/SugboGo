import apiClient from "@/shared/api/apiClient";

export const getMSMEData = async () => apiClient.get("/admin-panel/msmes/");
