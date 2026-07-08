import { adminPanelApi } from "../api";

export const getSettingsData = async () => 
    adminPanelApi.get("/settings/")