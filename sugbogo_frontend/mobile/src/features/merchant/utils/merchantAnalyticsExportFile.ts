import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { MerchantAnalyticsPdf } from "../api/merchantAnalyticsExport.service";

/** Shares a temporary private PDF and removes its local copy after the native sheet closes. */
export async function shareMerchantAnalyticsPdf(
  pdf: MerchantAnalyticsPdf,
  assertCurrent: () => void,
) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("File sharing is unavailable on this device.");
  }
  assertCurrent();
  const file = new File(Paths.cache, `${Date.now()}-${pdf.filename}`);
  try {
    file.create({ overwrite: false });
    file.write(pdf.bytes);
    assertCurrent();
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Save or share your analytics report",
    });
  } finally {
    if (file.exists) file.delete();
  }
}
