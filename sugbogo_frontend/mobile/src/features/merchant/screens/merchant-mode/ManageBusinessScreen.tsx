import { Pressable, ScrollView, View } from "react-native";
import { router, type Href } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";

import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * Provides merchants with a central place to manage their live business listing.
 *
 * Groups directly editable listing information separately from protected
 * changes that require Admin approval. Reviewed rows open their histories,
 * where merchants can inspect pending work or start an eligible request.
 */
export default function ManageBusinessScreen() {
  const { business, isLoading, refetch } = useMerchantBusinessProfile();

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

  const directRows: {
    title: string;
    detail: string;
    route: string;
    icon: IconName;
  }[] = [
    {
      title: "Business information",
      detail: "Description & contact details",
      route: "/(merchant)/business-information",
      icon: "store-edit-outline",
    },
    {
      title: "Operating hours",
      detail: "Weekly schedule",
      route: "/(merchant)/operating-hours",
      icon: "clock-outline",
    },
    {
      title: "Photos",
      detail: `${business.photos.length} business photos`,
      route: "/(merchant)/business-photos",
      icon: "image-multiple-outline",
    },
  ];

  const reviewedRows = [
    {
      title: "Business name",
      detail: business.business_name,
      icon: "storefront-outline" as IconName,
      route: "/(merchant)/business-update-requests",
    },
    {
      title: "Classification",
      detail: `${business.category.name} · ${business.cluster.name}`,
      icon: "shape-outline" as IconName,
      route: "/(merchant)/business-update-requests/classification",
    },
    {
      title: "Location & landmarks",
      detail: business.location.address,
      icon: "map-marker-outline" as IconName,
      route: "/(merchant)/business-update-requests/location",
    },
  ];

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-surface">
      <ScrollView
        contentContainerClassName="px-4 pb-10 pt-5"
        showsVerticalScrollIndicator={false}
      >
        {/* Page introduction */}
        <View className="mb-6 px-1">
          <AppText className="text-sm leading-5 text-text-secondary">
            Keep your live listing accurate and up to date.
          </AppText>

          {!canEdit ? (
            <View className="mt-4 flex-row items-start rounded-xl border border-error/15 bg-error/10 px-3 py-3">
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={20}
                color={theme.extends.colors.error}
              />

              <AppText className="ml-2 flex-1 text-sm leading-5 text-text-error">
                Changes are unavailable while your business is suspended.
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Direct business details */}
        <View className="mb-7">
          <View className="mb-2 px-1">
            <AppText weight="bold" className="text-base text-text-primary">
              Business details
            </AppText>

            <AppText className="mt-1 text-xs leading-5 text-text-secondary">
              Information you can update directly.
            </AppText>
          </View>

          <View className="overflow-hidden rounded-2xl border border-border-primary/70 bg-surface">
            {directRows.map((row, index) => (
              <Pressable
                key={row.title}
                onPress={() => router.push(row.route as Href)}
                disabled={!canEdit}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canEdit }}
                className={`min-h-[72px] cursor-pointer flex-row items-center px-4 py-3.5 active:bg-background disabled:opacity-50 ${
                  index < directRows.length - 1
                    ? "border-b border-border-primary/60"
                    : ""
                }`}
              >
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-background">
                  <MaterialCommunityIcons
                    name={row.icon}
                    size={21}
                    color={theme.extends.colors.text.secondary}
                  />
                </View>

                <View className="flex-1 pr-3">
                  <AppText
                    weight="semibold"
                    className="text-sm text-text-primary"
                  >
                    {row.title}
                  </AppText>

                  <AppText
                    className="mt-0.5 text-xs leading-4 text-text-secondary"
                    numberOfLines={2}
                  >
                    {row.detail}
                  </AppText>
                </View>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={21}
                  color={theme.extends.colors.text.secondary}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Approval-required business details */}
        <View className="mb-7">
          <View className="mb-3 px-1">
            <View className="flex-row items-center">
              <AppText weight="bold" className="text-base text-text-primary">
                Changes requiring approval
              </AppText>
            </View>

            {/* Approval process information */}
            <View className="mt-3 flex-row items-start rounded-xl bg-info px-3 py-3">
              <MaterialCommunityIcons
                name="information-outline"
                size={20}
                color={theme.extends.colors.text.info}
              />

              <View className="ml-2 flex-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  How approval works
                </AppText>

                <AppText className="mt-1 text-xs leading-5 text-text-secondary">
                  Changes to your business name, classification, or location
                  require SugboGo approval. Your current listing remains
                  unchanged until the request is approved.
                </AppText>
              </View>
            </View>
          </View>

          <View className="overflow-hidden rounded-2xl border border-border-primary/70 bg-surface">
            {reviewedRows.map((row, index) => (
              <Pressable
                key={row.title}
                onPress={() => router.push(row.route as Href)}
                accessibilityRole="button"
                accessibilityLabel={`View ${row.title.toLowerCase()} requests`}
                className={`min-h-[72px] cursor-pointer flex-row items-center px-4 py-3.5 active:bg-background ${
                  index < reviewedRows.length - 1
                    ? "border-b border-border-primary/60"
                    : ""
                }`}
              >
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-background">
                  <MaterialCommunityIcons
                    name={row.icon}
                    size={21}
                    color={theme.extends.colors.text.secondary}
                  />
                </View>

                <View className="flex-1 pr-2">
                  <AppText
                    weight="semibold"
                    className="text-sm text-text-primary"
                  >
                    {row.title}
                  </AppText>
                  <AppText
                    className="mt-0.5 text-xs leading-4 text-text-secondary"
                    numberOfLines={2}
                  >
                    {row.detail}
                  </AppText>
                </View>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={21}
                  color={theme.extends.colors.text.secondary}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
