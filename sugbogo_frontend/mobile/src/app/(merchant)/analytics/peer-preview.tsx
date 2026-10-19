import { Redirect } from "expo-router";

/** The fixture screen is reachable only in development builds. */
export default function PeerPreviewRoute() {
  if (!__DEV__) return <Redirect href="/(merchant)/(tabs)/analytics" />;
  // Keep fixture imports behind the development guard.
  const Preview =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load synthetic fixtures only after the development guard.
    require("@/features/merchant/dev/MerchantPeerPreviewScreen").default;
  return <Preview />;
}
