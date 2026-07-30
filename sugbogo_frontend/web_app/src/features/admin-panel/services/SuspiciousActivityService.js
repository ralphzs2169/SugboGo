import apiClient from "@/shared/api/apiClient";

export const getSuspiciousActivityData = async () =>
  apiClient.get("/admin/suspicious-activities/");
