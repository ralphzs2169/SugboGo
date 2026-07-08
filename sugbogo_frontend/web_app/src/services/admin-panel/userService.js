import { adminPanelApi } from "../api";

export const getUserData = async () => 
    adminPanelApi.get("/users/")