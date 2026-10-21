import { Redirect } from "expo-router";

export default function SpecialtiesPreviewRoute() {
  if (!__DEV__) return <Redirect href="/(merchant)/(tabs)/analytics" />;
  const Preview =
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load fixtures only after the development guard.
    require("@/features/merchant/dev/MerchantSpecialtiesPreviewScreen").default;
  return <Preview />;
}
