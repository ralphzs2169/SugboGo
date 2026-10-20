import type { ExploreBusinessPagination } from "@/features/explore/types/exploreBusiness.types";

export interface LoginEvent {
  id: number;
  method: "password" | "admin" | "google" | "facebook";
  outcome: "success" | "failed" | "unavailable";
  ip_address: string | null;
  platform: string;
  client: string;
  created_at: string;
}

export interface LoginHistoryResponse {
  items: LoginEvent[];
  pagination: ExploreBusinessPagination;
}
