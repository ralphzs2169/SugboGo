import { adminPanelApi } from "../api";

export const getSuspiciousActivityData = async () => 
    adminPanelApi.get("/suspicious-activities/")