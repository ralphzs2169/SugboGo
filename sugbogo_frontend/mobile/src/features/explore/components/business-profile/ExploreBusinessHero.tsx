import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";

import type { ExploreBusiness } from "../../types/exploreBusiness.types";
import BusinessPocketButton from "./BusinessPocketButton";
import BusinessSentimentRating from "./BusinessSentimentRating";

type Props = {
  business:
    | (Pick<
        ExploreBusiness,
        | "id"
        | "business_name"
        | "cluster"
        | "category"
        | "display_cover_photo_url"
      > & {
        is_pocketed?: boolean;
        sentiment_rating?: ExploreBusiness["sentiment_rating"];
      })
    | null;
  isOwnBusiness: boolean;
  identityOnly?: boolean;
  children?: ReactNode;
  onShare: () => void;
  onGoBack: () => void;
};

/**
 * Displays the business cover photo and primary identity information.
 *
 * Connects a compact cover to a rounded identity surface while exposing
 * navigation, Share, and Pocket actions.
 */
export default function ExploreBusinessHero({
  business,
  isOwnBusiness,
  identityOnly = false,
  children,
  onShare,
  onGoBack,
}: Props) {
  const [failedCover, setFailedCover] = useState<string | null>(null);
  if (!business) {
    return (
      <View className="bg-surface">
        <View className="relative h-72 w-full overflow-hidden bg-surface-secondary">
          <Skeleton className="h-full w-full rounded-none" />
          <Pressable
            onPress={onGoBack}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="absolute left-4 top-4 h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/95"
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={26}
              color={theme.extends.colors.text.primary}
            />
          </Pressable>
        </View>
        <View className="-mt-7 rounded-t-[28px] bg-surface px-5 pb-3 pt-6">
          <Skeleton className="h-7 w-3/4 rounded-md" />
          <Skeleton className="mt-2 h-4 w-2/3 rounded-md" />
          {children}
        </View>
      </View>
    );
  }
  const clusterIconName = CLUSTER_ICONS[business.cluster.icon] ?? "store";
  const cover =
    business.display_cover_photo_url !== failedCover
      ? business.display_cover_photo_url
      : null;

  return (
    <View className="bg-surface">
      <View className="relative h-72 w-full overflow-hidden bg-surface-secondary">
        {/* Cover photo */}
        {cover ? (
          <Image
            source={{ uri: cover }}
            onError={() => setFailedCover(cover)}
            style={{
              width: "100%",
              height: "100%",
            }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="h-full w-full items-center justify-center bg-brand/8">
            <MaterialCommunityIcons
              name="store-outline"
              size={64}
              color={theme.extends.colors.brand}
              style={{ opacity: 0.45 }}
            />
          </View>
        )}

        {/* Navigation and business actions */}
        <View className="absolute left-3 right-3 top-3 h-12 flex-row items-center justify-between px-1">
          {/* Back */}
          <Pressable
            onPress={onGoBack}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="relative h-10 w-10 cursor-pointer items-center justify-center rounded-full active:opacity-80"
            android_ripple={{
              color: "rgba(0,0,0,0.08)",
              borderless: true,
            }}
          >
            {/* White button surface */}
            <View
              pointerEvents="none"
              className="absolute h-10 w-10 rounded-full bg-white/95"
            />

            <MaterialCommunityIcons
              name="chevron-left"
              size={26}
              color={theme.extends.colors.text.primary}
            />
          </Pressable>

          {/* Business actions */}
          {identityOnly ? (
            <View
              className="h-12 flex-row items-center gap-2"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </View>
          ) : (
            <View className="-mx-1 h-12 flex-row items-center gap-2 px-1">
              {/* Share */}
              <Pressable
                onPress={onShare}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`Share ${business.business_name}`}
                className="relative h-10 w-10 cursor-pointer items-center justify-center rounded-full active:opacity-80"
                android_ripple={{
                  color: "rgba(0,0,0,0.08)",
                  borderless: true,
                }}
              >
                {/* White button surface */}
                <View
                  pointerEvents="none"
                  className="absolute h-10 w-10 rounded-full bg-white/95"
                />

                <MaterialCommunityIcons
                  name="share-variant"
                  size={20}
                  color={theme.extends.colors.text.primary}
                />
              </Pressable>

              {/* Pocket */}
              <BusinessPocketButton
                businessId={business.id}
                isPocketed={business.is_pocketed ?? null}
              />
            </View>
          )}
        </View>
      </View>

      {/* Business identity */}
      <View className="-mt-7 rounded-t-[28px] bg-surface px-5 pb-3 pt-6">
        {isOwnBusiness && (
          <View className="mb-2 flex-row items-center self-start rounded-full bg-brand px-2.5 py-1">
            <MaterialCommunityIcons
              name="store-check-outline"
              size={12}
              color="#FFFFFF"
            />

            <AppText
              weight="bold"
              className="ml-1 text-[10px] uppercase tracking-wide text-white"
            >
              Your Business
            </AppText>
          </View>
        )}

        {/* Business name and available rating */}
        <View className="flex-row items-start gap-3">
          <AppText
            weight="superbold"
            className="min-w-0 flex-1 text-xl leading-7 text-text-primary"
            numberOfLines={2}
          >
            {business.business_name}
          </AppText>
          {!identityOnly && (
            <BusinessSentimentRating
              businessId={business.id}
              rating={business.sentiment_rating}
              variant="stat"
            />
          )}
        </View>

        {/* Classification */}
        <View className="mt-1.5 flex-row items-center">
          <MaterialCommunityIcons
            name={clusterIconName}
            size={16}
            color={theme.extends.colors.text.secondary}
          />

          <AppText
            weight="medium"
            className="ml-1.5 min-w-0 flex-1 text-sm text-text-secondary"
            numberOfLines={2}
          >
            {business.cluster.name} · {business.category.name}
          </AppText>
        </View>
        {children}
      </View>
    </View>
  );
}
