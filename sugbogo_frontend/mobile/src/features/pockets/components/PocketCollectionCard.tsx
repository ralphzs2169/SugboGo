import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { PocketCollection } from "../types/pockets.types";

type Props = {
  collection: PocketCollection;
};

/**
 * Displays collection metadata without navigation or management actions.
 * Long names wrap naturally while empty collections retain their business count.
 */
export default function PocketCollectionCard({ collection }: Props) {
  const businessLabel =
    collection.business_count === 1 ? "business" : "businesses";

  return (
    <View className="flex-row items-start gap-3 rounded-card border border-border-primary bg-surface p-4">
      {/* Collection identity */}
      <View
        className="h-10 w-10 shrink-0 items-center justify-center rounded-card bg-background"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <MaterialCommunityIcons
          name="folder-outline"
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
          <View className="mt-2 self-start rounded-full bg-background px-2 py-1">
            <AppText weight="medium" className="text-small text-text-secondary">
              Default
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
