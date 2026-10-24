import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useWindowDimensions, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import type { OfflineBusinessSnapshotRead } from "../validation/offlineBusinessSnapshot";
import OfflineBusinessCover from "./OfflineBusinessCover";

/** Presents a compact saved-business row using only its managed local cover and snapshot. */
export default function OfflineBusinessCard({
  entry,
  onPress,
  localCoverUri,
}: {
  entry: OfflineBusinessSnapshotRead;
  onPress: () => void;
  localCoverUri?: string;
}) {
  const snapshot = entry.status === "available" ? entry.snapshot : null;
  const business = snapshot?.business;
  const { width: screenWidth } = useWindowDimensions();
  const coverWidth = Math.min(
    176,
    Math.max(128, Math.round((screenWidth - 32) * 0.44)),
  );
  return (
    <SafePressable
      accessibilityRole="button"
      accessibilityLabel={
        business
          ? `View saved business ${business.business_name}`
          : "View unreadable saved business"
      }
      onPress={onPress}
      className="mb-3 min-h-40 w-full cursor-pointer overflow-hidden rounded-card border border-border-primary bg-surface active:opacity-90"
    >
      <View className="flex-row">
        {/* Cover and fallback share the same fixed media column. */}
        <View
          className="relative min-h-40 shrink-0 self-stretch items-center justify-center overflow-hidden bg-surface-muted"
          style={{ width: coverWidth }}
        >
          {business ? (
            <OfflineBusinessCover
              uri={localCoverUri}
              clusterIcon={business.cluster.icon}
            />
          ) : (
            <MaterialCommunityIcons
              name="database-alert-outline"
              size={32}
              color={theme.extends.colors.text.tertiary}
              accessible={false}
            />
          )}
        </View>
        <View className="min-h-40 min-w-0 flex-1 justify-between p-3">
          <View>
            <AppText
              weight="bold"
              className="text-[13px] leading-5 text-text-primary"
              numberOfLines={2}
            >
              {business?.business_name ?? "Unreadable saved business"}
            </AppText>
            <View className="mt-1 flex-row items-center">
              {business && (
                <MaterialCommunityIcons
                  name={CLUSTER_ICONS[business.cluster.icon] ?? "store"}
                  size={12}
                  color={theme.extends.colors.text.tertiary}
                  accessible={false}
                />
              )}
              <AppText
                weight="medium"
                className={`${business ? "ml-1" : ""} min-w-0 flex-1 text-[10px] text-text-secondary`}
                numberOfLines={1}
              >
                {business?.category.name ?? "Open to review this device copy"}
              </AppText>
            </View>
          </View>
          {/* Saved specialty identity never implies current Vouch state. */}
          {business && business.specialty_tags.length > 0 && (
            <View className="mt-2 flex-row flex-wrap items-center">
              {business.specialty_tags.map((tag) => (
                <SpecialtyTagChip key={tag.id} tag={tag} size="xs" showIcon />
              ))}
            </View>
          )}
        </View>
      </View>
    </SafePressable>
  );
}
