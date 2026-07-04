import { adminPanelApi } from "../api";

export const getDashboardData = async () => 
    adminPanelApi.get("/dashboard/")