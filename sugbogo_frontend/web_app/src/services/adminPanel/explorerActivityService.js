import { adminPanelApi } from "../api";

export const getExplorerActivityData = async () => 
    adminPanelApi.get("/explorer-activities/")