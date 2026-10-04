import { useState } from "react";
import { ScrollView, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";

import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import { useMerchantBusinessNameChangeRequests } from "../../hooks/business-name-change/useMerchantBusinessNameChanges";
import { useMerchantClassificationChangeRequests } from "../../hooks/classification-change/useMerchantClassificationChanges";
import { useMerchantLocationChangeRequests } from "../../hooks/location-change/useMerchantLocationChanges";

type Section = "name" | "classification" | "location" | null;

/** Groups direct edits and reviewed changes behind deliberate navigation. */
export default function ManageBusinessScreen() {
  const [expanded, setExpanded] = useState<Section>(null);
  const { business, isLoading, refetch } = useMerchantBusinessProfile();
  const name = useMerchantBusinessNameChangeRequests();
  const classification = useMerchantClassificationChangeRequests();
  const location = useMerchantLocationChangeRequests();

  if (isLoading && !business) {
    return (
      <LoadingScreen
        title="Loading Business"
        description="Fetching your business information..."
      />
    );
  }

  if (!business) {
    return (
      <ErrorState
        title="Unable to load business"
        description="Please try again."
        primaryActionTitle="Try Again"
        onPrimaryAction={refetch}
      />
    );
  }

  const canEdit = business.status === "active";

  const directRows = [
    {
      title: "Business information",
      detail: "Description & contact details",
      route: "/(merchant)/business-information",
    },
    {
      title: "Operating hours",
      detail: "Weekly schedule",
      route: "/(merchant)/operating-hours",
    },
    {
      title: "Photos",
      detail: `${business.photos.length} business photos`,
      route: "/(merchant)/business-photos",
    },
  ];

  const reviewedRows = [
    {
      key: "name" as const,
      title: "Business name",
      detail: business.business_name,
      pending: name.pendingRequest,
      checking: name.isLoading || Boolean(name.error),
      requestRoute: "/(merchant)/business-name-change",
      detailRoute: name.pendingRequest
        ? `/(merchant)/business-update-requests/${name.pendingRequest.id}`
        : "",
    },
    {
      key: "classification" as const,
      title: "Classification",
      detail: `${business.category.name} · ${business.cluster.name}`,
      pending: classification.pendingRequest,
      checking: classification.isLoading || Boolean(classification.error),
      requestRoute: "/(merchant)/classification-change",
      detailRoute: classification.pendingRequest
        ? `/(merchant)/business-update-requests/classification/${classification.pendingRequest.id}`
        : "",
    },
    {
      key: "location" as const,
      title: "Location & landmarks",
      detail: business.location.address,
      pending: location.pendingRequest,
      checking: location.isLoading || Boolean(location.error),
      requestRoute: "/(merchant)/location-change",
      detailRoute: location.pendingRequest
        ? `/(merchant)/business-update-requests/location/${location.pendingRequest.id}`
        : "",
    },
  ];

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="pb-8">
        {/* Management introduction */}
        <View className="px-5 pb-4 pt-5">
          <AppText weight="bold" className="text-xl text-text-primary">
            Manage Business
          </AppText>
          <AppText className="mt-1 text-sm text-text-secondary">
            Keep your live listing accurate and up to date.
          </AppText>
          {!canEdit ? (
            <AppText className="mt-3 text-sm text-text-error">
              Changes are unavailable while your business is suspended.
            </AppText>
          ) : null}
        </View>

        {/* Direct edits */}
        <View className="mb-3 bg-surface px-5 py-2">
          {directRows.map((row) => (
            <Pressable
              key={row.title}
              onPress={() => router.push(row.route as Href)}
              disabled={!canEdit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canEdit }}
              className="min-h-16 cursor-pointer flex-row items-center border-b border-border-primary/60 py-3 active:opacity-70"
            >
              <View className="flex-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  {row.title}
                </AppText>
                <AppText
                  className="mt-0.5 text-xs text-text-secondary"
                  numberOfLines={2}
                >
                  {row.detail}
                </AppText>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.extends.colors.text.secondary}
              />
            </Pressable>
          ))}
        </View>

        {/* Reviewed changes */}
        <AppText
          weight="bold"
          className="px-5 pb-2 text-base text-text-primary"
        >
          Changes requiring review
        </AppText>
        <View className="bg-surface px-5">
          {reviewedRows.map((row) => {
            const isExpanded = expanded === row.key;
            return (
              <View key={row.key} className="border-b border-border-primary/60">
                <Pressable
                  onPress={() => setExpanded(isExpanded ? null : row.key)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  className="min-h-16 cursor-pointer flex-row items-center py-3 active:opacity-70"
                >
                  <View className="flex-1">
                    <AppText
                      weight="semibold"
                      className="text-sm text-text-primary"
                    >
                      {row.title}
                    </AppText>
                    <AppText
                      className="mt-0.5 text-xs text-text-secondary"
                      numberOfLines={2}
                    >
                      {row.detail}
                    </AppText>
                  </View>
                  {row.pending ? (
                    <AppText
                      weight="semibold"
                      className="mr-2 text-xs text-brand"
                    >
                      Pending
                    </AppText>
                  ) : null}
                  <MaterialCommunityIcons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={theme.extends.colors.text.secondary}
                  />
                </Pressable>
                {isExpanded ? (
                  <View className="pb-4">
                    <AppText className="mb-3 text-sm text-text-secondary">
                      Changes to this information require Admin review.
                    </AppText>
                    {row.pending ? (
                      <Pressable
                        onPress={() => router.push(row.detailRoute as Href)}
                        accessibilityRole="button"
                        className="min-h-11 cursor-pointer justify-center"
                      >
                        <AppText
                          weight="semibold"
                          className="text-sm text-brand"
                        >
                          View pending request ›
                        </AppText>
                      </Pressable>
                    ) : canEdit && !row.checking ? (
                      <Pressable
                        onPress={() => router.push(row.requestRoute as Href)}
                        accessibilityRole="button"
                        className="min-h-11 cursor-pointer justify-center"
                      >
                        <AppText
                          weight="semibold"
                          className="text-sm text-brand"
                        >
                          Request change ›
                        </AppText>
                      </Pressable>
                    ) : row.checking ? (
                      <AppText className="text-xs text-text-secondary">
                        Request status unavailable. Pull down on your profile to
                        retry.
                      </AppText>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
