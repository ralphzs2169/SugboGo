import { router } from "expo-router";
import { Platform, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import { shadows } from "@/shared/styles/shadows";
import BusinessLocationMap from "../components/business-profile/BusinessLocationMap";
import RoadRouteContextCard from "../components/getting-there/road-route/RoadRouteContextCard";
import RoadRouteMapSkeleton from "../components/getting-there/road-route/RoadRouteMapSkeleton";
import useBusinessDetailSource from "../hooks/useBusinessDetailSource";
import { getBusinessAddressDisplay } from "../utils/businessLocation.utils";
import { LiveBusinessVisitActions } from "./LiveBusinessProfile";

type Props = { businessId: number };

/** Map-first transportation hub using the same destination header and guidance workflows as route maps. */
export default function GettingThereScreen({ businessId }: Props) {
  const detail = useBusinessDetailSource(businessId);
  const insets = useSafeAreaInsets();
  const business = detail.source === "live" ? detail.business : null;

  if (!business) {
    if (detail.isLoading)
      return <RoadRouteMapSkeleton message="Loading your destination…" />;
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ErrorState
          title={
            detail.denied ? "Destination unavailable" : "Connection required"
          }
          description={
            detail.denied
              ? "This business is no longer available."
              : "Connect to choose a route or ride to this business."
          }
          primaryActionTitle="Retry"
          onPrimaryAction={() => void detail.refetch()}
          secondaryActionTitle="Go back"
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }
  const { latitude, longitude } = business.location;
  const validCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  const { addressLine, cityLine } = getBusinessAddressDisplay(
    business.location,
  );

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      {/* Destination map and familiar floating back/identity surface */}
      <View className="flex-1 bg-surface-secondary">
        {validCoordinates && Platform.OS !== "web" ? (
          <BusinessLocationMap location={business.location} interactive />
        ) : (
          <View className="flex-1 items-center justify-center px-5">
            <AppText className="text-sm text-text-secondary">
              Map unavailable
            </AppText>
          </View>
        )}
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 px-screen-x"
          style={{ top: insets.top + 12 }}
        >
          <RoadRouteContextCard
            businessName={business.business_name}
            businessCoverPhotoUrl={business.display_cover_photo_url}
            onBack={() => router.back()}
          />
        </View>
      </View>
      {/* Persistent transport choices; no origin permission or route fetch until selected */}
      <View
        className="rounded-t-3xl border-t border-border-primary bg-surface px-4 pb-3 pt-3.5"
        style={shadows.docked}
      >
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <AppText weight="bold" className="text-base text-text-primary">
              How to get there
            </AppText>

            <AppText className="mt-0.5 text-xs text-text-secondary">
              Choose a route or ride to your destination
            </AppText>
          </View>

          <View className="h-8 w-8 items-center justify-center rounded-full bg-surface-secondary">
            <MaterialCommunityIcons
              name="transit-connection-variant"
              size={17}
              color={theme.extends.colors.text.secondary}
            />
          </View>
        </View>
        <View className="my-4 rounded-xl bg-surface-muted px-3 py-3">
          <AppText weight="semibold" className="text-sm text-text-primary">
            {business.business_name}
          </AppText>
          <AppText className="mt-1 text-sm leading-5 text-text-secondary">
            {[addressLine, cityLine].filter(Boolean).join(", ")}
          </AppText>
        </View>
        <LiveBusinessVisitActions
          business={business}
          businessId={business.id}
          distance={null}
          distanceAccuracy={null}
          previewAsExplorer
        />
      </View>
    </SafeAreaView>
  );
}
