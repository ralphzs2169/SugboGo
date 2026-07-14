import { adminPanelApi } from "@/shared/services/api";

export const getExplorerActivityData = async () =>
  adminPanelApi.get("/explorer-activities/");
