import { Redirect } from "expo-router";

/** Synthetic recommendation scenarios are accessible only in development. */
export default function RecommendationsPreviewRoute() {
  if (!__DEV__) return <Redirect href="/(merchant)/(tabs)/analytics" />;
  const Preview =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load fixtures only after the development guard.
    require("@/features/merchant/dev/MerchantRecommendationsPreviewScreen").default;
  return <Preview />;
}
