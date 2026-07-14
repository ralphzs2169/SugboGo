import { adminPanelApi } from "@/shared/services/api";

export const getUserData = async () => adminPanelApi.get("/users/");
