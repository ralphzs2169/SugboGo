import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";

import type { PocketCollection } from "../types/pockets.types";

type Props = {
  collection: PocketCollection;
  compact?: boolean;
};

/** Displays a collection cover with its existing icon as a fallback. */
export default function PocketCollectionThumbnail({
  collection,
  compact = false,
}: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = collection.thumbnail_url;
  const showPhoto = Boolean(url && url !== failedUrl);

  return (
    <View
      className={`shrink-0 items-center justify-center overflow-hidden rounded-card ${
        compact ? "h-10 w-10" : "h-12 w-12 bg-surface-muted"
      }`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {showPhoto && url ? (
        <Image
          source={url}
          recyclingKey={url}
          contentFit="cover"
          style={{ width: "100%", height: "100%" }}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <MaterialCommunityIcons
          name={collection.is_default ? "heart-outline" : "wallet-outline"}
          size={compact ? 21 : 22}
          color={theme.extends.colors.text.secondary}
        />
      )}
    </View>
  );
}
