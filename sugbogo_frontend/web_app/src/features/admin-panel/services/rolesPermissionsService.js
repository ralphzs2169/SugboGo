import apiClient from "@/shared/api/apiClient";

export const getRolesPermissionsData = async () =>
  apiClient.get("/admin-panel/roles-permissions/");
