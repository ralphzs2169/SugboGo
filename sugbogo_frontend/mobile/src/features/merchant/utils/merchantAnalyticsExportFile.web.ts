import type { MerchantAnalyticsPdf } from "../api/merchantAnalyticsExport.service";

/** Downloads a private blob locally on web without publishing a report URL. */
export async function shareMerchantAnalyticsPdf(
  pdf: MerchantAnalyticsPdf,
  assertCurrent: () => void,
) {
  assertCurrent();
  const blob = new Blob([new Uint8Array(pdf.bytes)], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = pdf.filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Give the browser time to consume the object URL before revoking it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
