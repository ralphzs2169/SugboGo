import { adminPanelApi } from "@/shared/services/api";

export const getSuspiciousActivityData = async () =>
  adminPanelApi.get("/suspicious-activities/");
