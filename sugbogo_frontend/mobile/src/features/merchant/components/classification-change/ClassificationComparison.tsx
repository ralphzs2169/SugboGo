import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import type { ClassificationSnapshot } from "../../types/classificationChange.types";

/** Displays a captured classification snapshot without treating it as live state. */
export default function ClassificationComparison({
  title,
  classification,
}: {
  title: string;
  classification: ClassificationSnapshot;
}) {
  return (
    <View className="rounded-card border border-border-primary bg-surface p-4">
      <AppText weight="bold" className="text-base text-text-primary">
        {title}
      </AppText>
      {/* Category and its derived cluster */}
      <AppText className="mt-4 text-xs text-text-secondary">Cluster</AppText>
      <AppText className="mt-1 text-sm text-text-primary">
        {classification.cluster.name}
      </AppText>
      <AppText className="mt-3 text-xs text-text-secondary">Category</AppText>
      <AppText weight="semibold" className="mt-1 text-sm text-text-primary">
        {classification.category.name}
      </AppText>
      {/* Specialty set */}
      <AppText className="mt-3 text-xs text-text-secondary">
        Specialties
      </AppText>
      {classification.specialty_tags.length > 0 ? (
        classification.specialty_tags.map((tag) => (
          <AppText key={tag.id} className="mt-1 text-sm text-text-primary">
            {tag.name}
          </AppText>
        ))
      ) : (
        <AppText className="mt-1 text-sm text-text-secondary">
          No active specialties
        </AppText>
      )}
    </View>
  );
}
