import apiClient from "@/shared/api/apiClient.service";
import authClient from "@/shared/api/authClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

export interface PendingEmailChange {
  new_email: string;
  expires_at: string;
}
export interface EmailChangeStatus {
  current_email: string;
  pending: PendingEmailChange | null;
}
export interface RequestEmailChange {
  new_email: string;
  current_password: string;
}
export interface ConfirmEmailChange {
  request_id: string;
  token: string;
  current_password: string;
}
export interface ConfirmedEmailChange {
  user_id: number;
  email: string;
}

/** Reads authoritative pending state without exposing verification secrets. */
export function getEmailChangeStatus(): Promise<
  ApiResponse<EmailChangeStatus>
> {
  return request(apiClient.get("/auth/change-email/status/"));
}

/** Requests or replaces a verification link while retaining the active email. */
export function requestEmailChange(
  payload: RequestEmailChange,
): Promise<ApiResponse<PendingEmailChange>> {
  return request(apiClient.post("/auth/change-email/", payload));
}

/** Cancels the current account's pending verification link. */
export function cancelEmailChange(): Promise<ApiResponse<null>> {
  return request(apiClient.post("/auth/change-email/cancel/"));
}

/** Confirms emailed ownership proof without relying on a stored access token. */
export function confirmEmailChange(
  payload: ConfirmEmailChange,
): Promise<ApiResponse<ConfirmedEmailChange>> {
  return request(authClient.post("/auth/change-email/confirm/", payload));
}
