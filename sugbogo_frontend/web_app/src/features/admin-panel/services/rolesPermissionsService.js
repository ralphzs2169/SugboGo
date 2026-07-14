import { adminPanelApi } from "@/shared/services/api";

export const getRolesPermissionsData = async () =>
  adminPanelApi.get("/roles-permissions/");
