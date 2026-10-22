import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import type { OfflineBusinessSnapshotRead } from "../validation/offlineBusinessSnapshot";
import OfflineBusinessCover from "./OfflineBusinessCover";

/** Uses the discovery card's surface and proportions with an optional managed local cover. */
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
  return (
    <SafePressable
      accessibilityRole="button"
      accessibilityLabel={
        business
          ? `View saved business ${business.business_name}`
          : "View unreadable saved business"
      }
      onPress={onPress}
      className="mb-3 cursor-pointer overflow-hidden rounded-card border border-border-primary bg-surface active:opacity-70"
    >
      <View className="flex-row">
        {/* Cover and fallback share the same fixed media column. */}
        <View
          className="w-24 items-center justify-center bg-surface-muted"
          style={{ minHeight: 144 }}
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
        <View className="min-w-0 flex-1 gap-1 p-3">
          <AppText
            weight="bold"
            className="text-base text-text-primary"
            numberOfLines={3}
          >
            {business?.business_name ?? "Unreadable saved business"}
          </AppText>
          <AppText className="text-xs text-text-secondary" numberOfLines={2}>
            {business?.category.name ?? "Open to review this device copy"}
          </AppText>
          {business && (
            <AppText
              className="mt-1 text-sm text-text-secondary"
              numberOfLines={2}
            >
              {business.location.address ||
                [business.location.city, business.location.province]
                  .filter(Boolean)
                  .join(", ")}
            </AppText>
          )}
          {snapshot && (
            <AppText className="mt-1 text-xs text-text-tertiary">
              Saved {new Date(snapshot.fetchedAt).toLocaleDateString()}
            </AppText>
          )}
        </View>
        <View className="justify-center pr-2">
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.extends.colors.text.tertiary}
            accessible={false}
          />
        </View>
      </View>
    </SafePressable>
  );
}
