import { Redirect } from "expo-router";

/** The gallery never mounts in production builds. */
export default function AnalyticsDevelopmentPreviewRoute() {
  if (!__DEV__) return <Redirect href="/(merchant)/(tabs)/analytics" />;
  const Preview =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Fixtures load only after the development guard.
    require("@/features/merchant/dev/MerchantAnalyticsPreviewScreen").default;
  return <Preview />;
}
