import { adminPanelApi } from "../api";

export const getMSMEData = async () => 
    adminPanelApi.get("/msmes/")