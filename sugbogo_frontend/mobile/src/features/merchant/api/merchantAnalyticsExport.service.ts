import { isAxiosError } from "axios";
import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import type { MerchantAnalyticsPeriod } from "../types/merchantAnalytics.types";

export type MerchantAnalyticsPdf = {
  bytes: Uint8Array;
  filename: string;
};

/** Decodes bounded UTF-8 JSON errors from binary-response requests. */
function binaryError(data: unknown): unknown {
  if (!(data instanceof ArrayBuffer) || data.byteLength > 65_536) return data;
  try {
    const encoded = Array.from(
      new Uint8Array(data),
      (byte) => `%${byte.toString(16).padStart(2, "0")}`,
    ).join("");
    return JSON.parse(decodeURIComponent(encoded));
  } catch {
    return undefined;
  }
}

/** Downloads a private PDF through the existing JWT/refresh client without caching it. */
export async function getMerchantAnalyticsPdf(
  period: MerchantAnalyticsPeriod,
  signal?: AbortSignal,
): Promise<ApiResponse<MerchantAnalyticsPdf>> {
  try {
    const response = await apiClient.get<ArrayBuffer>(
      "/merchant/analytics/premium/report/export/",
      {
        params: { period, interval: period === "7" ? "daily" : "weekly" },
        headers: { Accept: "application/pdf" },
        responseType: "arraybuffer",
        timeout: 60_000,
        signal,
      },
    );
    const data = response.data;
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : null;
    const contentType = String(response.headers["content-type"] ?? "");
    if (
      !bytes ||
      bytes.byteLength < 5 ||
      bytes.byteLength > 10 * 1024 * 1024 ||
      !contentType.toLowerCase().startsWith("application/pdf") ||
      String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-"
    ) {
      return {
        success: false,
        code: "INVALID_EXPORT",
        message: "A valid PDF could not be downloaded. Please try again.",
      };
    }
    // Accept only the server's controlled filename; never trust a path from a header.
    const disposition = String(response.headers["content-disposition"] ?? "");
    const filename =
      disposition.match(
        /filename="?(sugbogo-merchant-report-\d+-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.pdf)"?(?:;|$)/i,
      )?.[1] ?? `sugbogo-merchant-report-${period}-days.pdf`;
    return {
      success: true,
      message: "PDF downloaded",
      data: { bytes, filename },
    };
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      error.response.data = binaryError(error.response.data);
    }
    return request<ApiResponse<MerchantAnalyticsPdf>>(Promise.reject(error));
  }
}
