import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import { GEM_FILL, GEM_ICON } from "@/shared/styles/hiddenGems";
import { shadows } from "@/shared/styles/shadows";

import type { MapDiscoveryBusiness } from "../types/mapDiscovery.types";

type Props = {
  business: MapDiscoveryBusiness;
  onClose: () => void;
  onViewBusiness: () => void;
};

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export const PREVIEW_MAX_HEIGHT_RATIO = 0.38;

const PHOTO_SIZE = 72;
const MEDALLION_SIZE = 24;

/**
 * Single-line metadata row with a leading icon, used for category and address.
 */
function InfoRow({
  icon,
  text,
  muted = false,
}: {
  icon: IconName;
  text: string;
  muted?: boolean;
}) {
  return (
    <View className="mt-1 flex-row items-center gap-1.5">
      <MaterialCommunityIcons
        name={icon}
        size={14}
        color={theme.extends.colors.text.secondary}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <AppText
        className={`min-w-0 flex-1 text-xs ${
          muted ? "italic text-text-secondary/70" : "text-text-secondary"
        }`}
        numberOfLines={1}
      >
        {text}
      </AppText>
    </View>
  );
}

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

  const clusterIconKey = business.cluster?.icon;
  const clusterIcon: IconName =
    (clusterIconKey ? CLUSTER_ICONS[clusterIconKey] : undefined) ??
    "store-outline";

  const classification =
    business.category?.name?.trim() || business.cluster?.name?.trim();

  const address = [business.location?.city, business.location?.province]
    .filter((part) => part?.trim())
    .join(", ");

  const tags = business.specialty_tags ?? [];
  const isHiddenGem = business.is_hidden_gem === true;

  return (
    <View
      className="gap-3 rounded-card border border-border-primary bg-surface p-3"
      style={[
        shadows.floating,
        { maxHeight: height * PREVIEW_MAX_HEIGHT_RATIO },
      ]}
    >
      {/* Business identity and specialty tags */}
      <ScrollView
        style={{ flexGrow: 0, flexShrink: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-start gap-3">
          {/* Business cover photo */}
          <View
            className="shrink-0"
            style={{ width: PHOTO_SIZE, height: PHOTO_SIZE }}
          >
            <View className="h-full w-full overflow-hidden rounded-xl bg-surface-secondary">
              {photo ? (
                <Image
                  key={photo}
                  source={{ uri: photo }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={150}
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

            {/* Hidden Gem medallion overlapping the cover photo */}
            {isHiddenGem && (
              <View
                className="items-center justify-center rounded-full"
                accessible
                accessibilityLabel="Hidden Gem"
                style={{
                  position: "absolute",
                  right: -6,
                  bottom: -6,
                  width: MEDALLION_SIZE,
                  height: MEDALLION_SIZE,
                  backgroundColor: GEM_FILL,
                  borderWidth: 2,
                  borderColor: "#FFFFFF",
                  elevation: 4,
                  shadowColor: "#000",
                  shadowOpacity: 0.2,
                  shadowRadius: 3,
                  shadowOffset: { width: 0, height: 1 },
                }}
              >
                <MaterialCommunityIcons
                  name="diamond-stone"
                  size={12}
                  color={GEM_ICON}
                />
              </View>
            )}
          </View>

          {/* Business name and classification */}
          <View className="min-w-0 flex-1 pr-10">
            <AppText
              weight="bold"
              className="text-base leading-5 text-text-primary"
              numberOfLines={2}
              accessibilityRole="header"
            >
              {business.business_name}
            </AppText>

            {classification ? (
              <InfoRow icon={clusterIcon} text={classification} />
            ) : null}

            <InfoRow
              icon="map-marker-outline"
              text={address || "Address unavailable"}
              muted={!address}
            />
          </View>

          {/* Preview dismissal */}
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close business preview"
            className="absolute right-0 top-0 h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-surface-secondary active:opacity-70"
          >
            <MaterialCommunityIcons
              name="close"
              size={18}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        </View>

        {/* Specialty tags wrap onto additional rows */}
        {tags.length > 0 && (
          <View className="mt-2 flex-row flex-wrap items-center">
            {tags.map((tag) => (
              <View key={tag.id} className="max-w-full shrink">
                <SpecialtyTagChip tag={tag} size="small" showIcon />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Business profile navigation */}
      <Button
        title="View Business"
        accessibilityLabel={`View ${business.business_name} business profile`}
        onPress={onViewBusiness}
        icon={
          <MaterialCommunityIcons
            name="arrow-right"
            size={18}
            color="#FFFFFF"
          />
        }
        iconPosition="right"
        size="sm"
        className="min-h-12"
        rounded="full"
      />
    </View>
  );
}
