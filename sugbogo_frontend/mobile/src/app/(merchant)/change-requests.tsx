import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import BusinessChangeRequestMenuItem from "@/features/merchant/components/change-requests/BusinessChangeRequestMenuItem";
import { useMerchantBusinessNameChangeRequests } from "@/features/merchant/hooks/business-name-change/useMerchantBusinessNameChanges";
import { useMerchantClassificationChangeRequests } from "@/features/merchant/hooks/classification-change/useMerchantClassificationChanges";
import { useMerchantLocationChangeRequests } from "@/features/merchant/hooks/location-change/useMerchantLocationChanges";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

/** Groups reviewed business-change destinations with cached request summaries. */
export default function ChangeRequestsRoute() {
  const name = useMerchantBusinessNameChangeRequests();
  const classification = useMerchantClassificationChangeRequests();
  const location = useMerchantLocationChangeRequests();

  useQueryErrorNotification({
    error: name.error,
    toastId: "business-change-name-summary-error",
    title: "Unable to load name requests",
    fallbackMessage: "Please try again.",
  });
  useQueryErrorNotification({
    error: classification.error,
    toastId: "business-change-classification-summary-error",
    title: "Unable to load classification requests",
    fallbackMessage: "Please try again.",
  });
  useQueryErrorNotification({
    error: location.error,
    toastId: "business-change-location-summary-error",
    title: "Unable to load location requests",
    fallbackMessage: "Please try again.",
  });

  const histories = [
    {
      title: "Business name",
      description: "Change your business's display name",
      icon: "storefront-outline" as const,
      route: "/(merchant)/business-update-requests" as Href,
      summary: name,
    },
    {
      title: "Classification",
      description: "Update your category and specialty tags",
      icon: "shape-outline" as const,
      route: "/(merchant)/business-update-requests/classification" as Href,
      summary: classification,
    },
    {
      title: "Location & landmarks",
      description: "Update your map pin, address, or landmarks",
      icon: "map-marker-outline" as const,
      route: "/(merchant)/business-update-requests/location" as Href,
      summary: location,
    },
  ];

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="px-5 pb-8 pt-5">
        {/* Introduction and request destinations */}
        <AppText className="mb-4 text-sm leading-5 text-text-secondary">
          Request updates to your business information and track their approval
          status.
        </AppText>
        <View className="overflow-hidden rounded-2xl border border-border-primary/70 bg-surface">
          {histories.map((history, index) => (
            <BusinessChangeRequestMenuItem
              key={history.title}
              title={history.title}
              description={history.description}
              icon={history.icon}
              totalRequests={history.summary.totalRequests}
              pending={Boolean(history.summary.pendingRequest)}
              showDivider={index < histories.length - 1}
              onPress={() => router.push(history.route)}
            />
          ))}
        </View>

        {/* Localized summary recovery keeps all routes available */}
        {histories.map((history) =>
          history.summary.error ? (
            <View key={history.title} className="mt-3">
              <ErrorState
                size="section"
                title={`Unable to load ${history.title.toLowerCase()} status`}
                description="Request history is still available."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void history.summary.refetch()}
              />
            </View>
          ) : null,
        )}

        {/* Approval information */}
        <View className="mt-5 flex-row items-start gap-2">
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />
          <AppText className="min-w-0 flex-1 text-xs leading-5 text-text-secondary">
            Changes require administrator approval before becoming visible to
            explorers.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
