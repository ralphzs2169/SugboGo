import { adminPanelApi } from "@/shared/services/api";

export const getSettingsData = async () => adminPanelApi.get("/settings/");
