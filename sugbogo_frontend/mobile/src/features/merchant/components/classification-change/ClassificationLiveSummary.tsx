import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import type { SpecialtyTag } from "@/shared/types/specialtyTag.types";

type Props = {
  category: string;
  cluster: string;
  clusterIcon?: string;
  specialties: (SpecialtyTag & { id: number })[];
};

/** Shows the live classification compactly, with its specialties available on expansion. */
export default function ClassificationLiveSummary({
  category,
  cluster,
  clusterIcon,
  specialties,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mb-2 bg-surface px-6 py-5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Current classification"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        className="flex-row items-center gap-3"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-background">
          <MaterialCommunityIcons
            testID="live-cluster-icon"
            name={CLUSTER_ICONS[clusterIcon ?? ""] ?? "store-outline"}
            size={21}
            color={theme.extends.colors.text.secondary}
          />
        </View>
        <View className="min-w-0 flex-1">
          <AppText className="text-xs text-text-secondary">
            Currently live
          </AppText>
          <AppText weight="semibold" className="text-base text-text-primary">
            {category}
          </AppText>
          <AppText className="text-sm text-text-secondary">
            {cluster} · {specialties.length} specialties
          </AppText>
        </View>
        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.extends.colors.text.secondary}
        />
      </Pressable>
      {expanded ? (
        <View className="mt-4 flex-row flex-wrap gap-2 border-t border-border-primary/60 pt-4">
          {specialties.map((tag) => (
            <SpecialtyTagChip key={tag.id} tag={tag} size="small" showIcon />
          ))}
        </View>
      ) : null}
    </View>
  );
}
