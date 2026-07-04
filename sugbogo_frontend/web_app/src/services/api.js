import axios from "axios";

export const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export const adminPanelApi = axios.create({
  baseURL: "http://127.0.0.1:8000/api/admin-panel",
  headers: {
    "Content-Type": "application/json",
  },
});

