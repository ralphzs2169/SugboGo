import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import type { PocketCollection } from "../types/pockets.types";

type Props = {
  collection: PocketCollection;
  onPress?: () => void;
  onManage?: () => void;
};

/**
 * Displays collection metadata with optional, separate navigation and management actions.
 * Long names wrap naturally while empty collections retain their business count.
 */
export default function PocketCollectionCard({
  collection,
  onPress,
  onManage,
}: Props) {
  const businessLabel =
    collection.business_count === 1 ? "business" : "businesses";

  const content = (
    <>
      {/* Collection identity */}
      <View
        className="h-12 w-12 shrink-0 items-center justify-center rounded-card bg-brand/10"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <MaterialCommunityIcons
          name={collection.is_default ? "heart-outline" : "folder-outline"}
          size={22}
          color={theme.extends.colors.brand}
        />
      </View>

      <View className="min-w-0 flex-1">
        <AppText weight="semibold" className="text-md text-text-primary">
          {collection.name}
        </AppText>

        {/* Available businesses and default status */}
        <AppText className="mt-1 text-body text-text-secondary">
          {collection.business_count} {businessLabel}
        </AppText>

        {collection.is_default && (
          <View className="mt-2 self-start rounded-full bg-brand/10 px-2 py-1">
            <AppText weight="medium" className="text-small text-text-primary">
              Default
            </AppText>
          </View>
        )}
      </View>
    </>
  );
  return (
    <View className="flex-row items-center rounded-card border border-border-primary bg-surface">
      {/* Navigation and management remain sibling touch targets. */}
      {onPress ? (
        <SafePressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${collection.name} Pocket`}
          accessibilityHint="View saved businesses"
          className="min-w-0 flex-1 cursor-pointer flex-row items-center gap-3 p-4 active:opacity-80"
          onPress={onPress}
        >
          {content}
        </SafePressable>
      ) : (
        <View className="min-w-0 flex-1 flex-row items-center gap-3 p-4">
          {content}
        </View>
      )}
      {!collection.is_default && onManage && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Manage ${collection.name} Pocket`}
          accessibilityHint="Rename or delete this Pocket"
          onPress={onManage}
          className="mr-2 h-12 w-12 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
        >
          <MaterialCommunityIcons
            name="dots-horizontal"
            size={24}
            color={theme.extends.colors.text.secondary}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Pressable>
      )}
    </View>
  );
}
