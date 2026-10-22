import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { theme } from "@/constants/theme";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";

/** Renders local covers only, preserving the Explore placeholder when decoding or storage fails. */
export default function OfflineBusinessCover({
  uri,
  clusterIcon,
  hero = false,
}: {
  uri?: string;
  clusterIcon?: string;
  hero?: boolean;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const localUri = uri?.startsWith("file://") && uri !== failedUri ? uri : null;
  return (
    <View
      className="absolute inset-0 items-center justify-center bg-brand/8"
      accessible={false}
    >
      {/* Identical media bounds for the image and its fallback prevent layout shifts. */}
      <MaterialCommunityIcons
        name={CLUSTER_ICONS[clusterIcon ?? ""] ?? "store-outline"}
        size={hero ? 64 : 36}
        color={theme.extends.colors.brand}
        style={{ opacity: 0.45 }}
        accessible={false}
      />
      {localUri && (
        <Image
          key={localUri}
          source={{ uri: localUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="none"
          recyclingKey={localUri}
          accessible={false}
          onError={() => setFailedUri(localUri)}
        />
      )}
    </View>
  );
}
