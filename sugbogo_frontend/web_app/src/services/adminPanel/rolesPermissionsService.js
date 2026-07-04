import { adminPanelApi } from "../api";

export const getRolesPermissionsData = async () => 
    adminPanelApi.get("/roles-permissions/")