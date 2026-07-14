import { adminPanelApi } from "@/shared/services/api";

export const getSpecialtyTagData = async () =>
  adminPanelApi.get("/specialty-tags/");
