import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useUserLocation from "@/shared/hooks/useUserLocation";

import DirectJourneyList from "../components/getting-there/DirectJourneyList";
import GettingThereEmptyState from "../components/getting-there/GettingThereEmptyState";
import GettingThereLoadingState from "../components/getting-there/GettingThereLoadingState";
import LocationUnavailableState from "../components/getting-there/LocationUnavailableState";
import RoadRouteEntryCard from "../components/getting-there/RoadRouteEntryCard";
import useDirectJourneys from "../hooks/useDirectJourneys";
import useExploreBusinessProfile from "../hooks/useExploreBusinessProfile";

type Props = {
  businessId: number;
};

/**
 * Shows Explorer-facing direct jeepney guidance to one business.
 *
 * A single current-location snapshot enables the backend-ranked query, while
 * permission, no-route, request-error, and journey states remain distinct.
 */
export default function GettingThereScreen({ businessId }: Props) {
  const businessQuery = useExploreBusinessProfile(businessId);
  const userLocation = useUserLocation();

  const hasUsableLocation = userLocation.status === "available";
  const latitude = hasUsableLocation ? userLocation.latitude : null;
  const longitude = hasUsableLocation ? userLocation.longitude : null;

  const journeyQuery = useDirectJourneys(
    businessId,
    latitude,
    longitude,
  );

  useApiErrorNotification({
    error: businessQuery.error,
    toastId: "getting-there-business-error",
    title: "Unable to load destination",
    fallbackMessage: "We couldn't load this business right now.",
  });

  useApiErrorNotification({
    error: journeyQuery.error,
    toastId: "direct-journeys-error",
    title: "Unable to load jeepney guidance",
    fallbackMessage: "We couldn't check direct jeepney routes right now.",
  });

  if (businessQuery.error && !businessQuery.business) {
    return (
      <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
        <ErrorState
          title="Unable to load destination"
          description="We couldn't load this business right now."
          primaryActionTitle="Retry"
          secondaryActionTitle="Go back"
          onPrimaryAction={() => void businessQuery.refetch()}
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const businessName = businessQuery.business?.business_name ?? "Destination";

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-screen-x pb-8 pt-5"
      >
        {/* Destination context */}
        <View className="mb-6">
          <AppText className="text-sm text-text-secondary">
            Directions to
          </AppText>

          {businessQuery.isLoading && !businessQuery.business ? (
            <View className="mt-2 h-7 w-48 rounded-full bg-border-primary" />
          ) : (
            <AppText
              weight="extrabold"
              className="mt-1 text-2xl text-text-primary"
            >
              {businessName}
            </AppText>
          )}
        </View>

        {/* Independent road-route option */}
        <RoadRouteEntryCard
          onViewRoute={() => {
            router.push({
              pathname: "/(explorer)/business/[businessId]/road-route",
              params: {
                businessId: String(businessId),
              },
            });
          }}
        />

        {/* Guide identity */}
        <View className="mb-4 flex-row items-center">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
            <MaterialCommunityIcons
              name="bus"
              size={22}
              color={theme.extends.colors.brand}
            />
          </View>

          <View className="ml-3 flex-1">
            <AppText weight="bold" className="text-lg text-text-primary">
              Jeepney Guide
            </AppText>
            <AppText className="text-sm text-text-secondary">
              Direct routes from your current location
            </AppText>
          </View>
        </View>

        {/* Location and journey states */}
        {userLocation.status === "loading" ? (
          <GettingThereLoadingState message="Finding your current location…" />
        ) : userLocation.status === "denied" ||
          userLocation.status === "unavailable" ? (
          <LocationUnavailableState
            status={userLocation.status}
            isRetrying={userLocation.isRefreshingLocation}
            onRetry={() => void userLocation.refreshLocation()}
          />
        ) : journeyQuery.isLoading && !journeyQuery.result ? (
          <GettingThereLoadingState message="Checking direct jeepney routes…" />
        ) : journeyQuery.error && !journeyQuery.result ? (
          <ErrorState
            size="small"
            title="Unable to load jeepney guidance"
            description="We couldn't check direct jeepney routes right now."
            primaryActionTitle="Retry"
            onPrimaryAction={() => void journeyQuery.refetch()}
          />
        ) : journeyQuery.journeys.length > 0 ? (
          <DirectJourneyList
            journeys={journeyQuery.journeys}
            businessName={businessName}
          />
        ) : journeyQuery.result ? (
          <GettingThereEmptyState
            reason={journeyQuery.reason}
            onRetry={() => void journeyQuery.refetch()}
          />
        ) : null}

        {/* Distance clarification */}
        {journeyQuery.journeys.length > 0 ? (
          <View className="mt-5 flex-row rounded-xl bg-info px-4 py-3">
            <MaterialCommunityIcons
              name="information-outline"
              size={18}
              color={theme.extends.colors.text.info}
            />
            <AppText className="ml-2 flex-1 text-xs leading-4 text-text-info">
              Access distances are approximate straight-line distances, not
              turn-by-turn walking routes.
            </AppText>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
