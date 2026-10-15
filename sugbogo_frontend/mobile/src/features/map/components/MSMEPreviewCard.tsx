import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import { shadows } from "@/shared/styles/shadows";

import type { MapDiscoveryBusiness } from "../types/mapDiscovery.types";

type Props = {
  business: MapDiscoveryBusiness;
  onClose: () => void;
  onViewBusiness: () => void;
};

const VISIBLE_TAG_COUNT = 2;

/**
 * Presents a concise API-backed business preview without moving the map.
 * Longer content scrolls within the card while its profile action stays visible.
 */
export default function MSMEPreviewCard({
  business,
  onClose,
  onViewBusiness,
}: Props) {
  const { height } = useWindowDimensions();
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const photo = [
    business.display_cover_photo_url,
    business.cover_photo_url,
  ].find((url) => url?.trim() && !failedPhotos.includes(url));
  const clusterIcon = CLUSTER_ICONS[business.cluster?.icon] ?? "store-outline";
  const classification =
    business.category?.name?.trim() || business.cluster?.name?.trim();
  const address = [
    business.location?.address,
    business.location?.city,
    business.location?.province,
  ]
    .filter((part) => part?.trim())
    .join(", ");
  const tags = business.specialty_tags ?? [];
  const visibleTags = tags.slice(0, VISIBLE_TAG_COUNT);
  const remainingTagCount = tags.length - visibleTags.length;

  return (
    <View
      className="gap-3 rounded-card border border-border-primary bg-surface p-3"
      style={[shadows.floating, { maxHeight: height * 0.45 }]}
    >
      {/* Bounded identity and specialties leave the map visible. */}
      <ScrollView
        style={{ flexGrow: 0, flexShrink: 1 }}
        showsVerticalScrollIndicator
      >
        <View className="flex-row items-start gap-3">
          <View className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-secondary">
            {photo ? (
              <Image
                key={photo}
                source={{ uri: photo }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                accessibilityLabel={`${business.business_name} cover photo`}
                onError={() => {
                  setFailedPhotos((previous) => [...previous, photo]);
                }}
              />
            ) : (
              <View
                className="h-full w-full items-center justify-center bg-brand/8"
                accessibilityLabel="Business photo unavailable"
                accessible
              >
                <MaterialCommunityIcons
                  name={clusterIcon}
                  size={32}
                  color={theme.extends.colors.brand}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </View>
            )}
          </View>

          <View className="min-w-0 flex-1 pr-12">
            <AppText
              weight="bold"
              className="text-base leading-5 text-text-primary"
              numberOfLines={2}
              accessibilityRole="header"
            >
              {business.business_name}
            </AppText>
            {classification && (
              <AppText
                className="mt-1 text-xs text-text-secondary"
                numberOfLines={1}
              >
                {classification}
              </AppText>
            )}
            <AppText
              className="mt-1 text-xs text-text-secondary"
              numberOfLines={2}
            >
              {address || "Address unavailable"}
            </AppText>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close business preview"
            className="absolute right-0 top-0 h-12 w-12 cursor-pointer items-center justify-center rounded-full active:bg-background active:opacity-70"
          >
            <MaterialCommunityIcons
              name="close"
              size={22}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        </View>

        {/* Reuse Explore's soft display chips without inventing vouch state. */}
        {visibleTags.length > 0 && (
          <View className="mt-3 flex-row flex-wrap items-center">
            {visibleTags.map((tag) => (
              <View key={tag.id} className="max-w-full shrink">
                <SpecialtyTagChip tag={tag} size="small" showIcon />
              </View>
            ))}
            {remainingTagCount > 0 && (
              <AppText className="mb-2 text-xs text-text-secondary">
                +{remainingTagCount} more
              </AppText>
            )}
          </View>
        )}
      </ScrollView>

      {/* Explicit profile navigation remains reachable at larger text sizes. */}
      <Button
        title="View Business"
        accessibilityLabel={`View ${business.business_name} business profile`}
        onPress={onViewBusiness}
        size="sm"
        className="min-h-12"
      />
    </View>
  );
}
