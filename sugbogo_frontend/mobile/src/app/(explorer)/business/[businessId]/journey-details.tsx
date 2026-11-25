import { Redirect, useLocalSearchParams } from "expo-router";
/** Preserve old links while opening the map-first experience directly. */
export default function JourneyDetailsRedirect() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const id = Number(businessId);
  if (!Number.isSafeInteger(id) || id < 1) return <Redirect href="/" />;
  return (
    <Redirect
      href={{
        pathname: "/(explorer)/business/[businessId]/journey-map",
        params: { businessId: id },
      }}
    />
  );
}
