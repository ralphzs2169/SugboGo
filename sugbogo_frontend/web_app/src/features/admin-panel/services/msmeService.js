import { adminPanelApi } from "@/shared/services/api";

export const getMSMEData = async () => adminPanelApi.get("/msmes/");
