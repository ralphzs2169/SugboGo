import { File } from "expo-file-system";

/** Rejects missing cached selections before replacing any merchant draft media. */
export function ensureMerchantMediaAvailable(uri: string) {
  if (!uri || (uri.startsWith("file://") && !new File(uri).exists)) {
    throw new Error(
      "The selected file is no longer available. Select it again.",
    );
  }
}
