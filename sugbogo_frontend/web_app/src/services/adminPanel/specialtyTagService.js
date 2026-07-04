import { adminPanelApi } from "../api";

export const getSpecialtyTagData = async () => 
    adminPanelApi.get("/specialty-tags/")