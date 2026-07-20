import apiClient from "@/shared/api/apiClient";

export const getUserData = async () => apiClient.get("/admin-panel/users/");
