import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { formatDate } from "@/shared/utils/date.utils";

import type { ClassificationChangeRequest } from "../../types/classificationChange.types";
import BusinessNameChangeStatusBadge from "../business-name-change/BusinessNameChangeStatusBadge";

/**
 * Summarizes only the changes captured in a classification request.
 *
 * Compares historical snapshots to identify category, cluster, and specialty
 * tag changes without presenting unchanged information as requested changes.
 */
export default function ClassificationChangeRequestCard({
  request,
  onPress,
}: {
  request: ClassificationChangeRequest;
  onPress: () => void;
}) {
  const { previous, proposed } = request;

  const categoryChanged = previous.category.id !== proposed.category.id;

  const clusterChanged = previous.cluster.name !== proposed.cluster.name;

  const previousTagIds = new Set(
    previous.specialty_tags.map((tag) => String(tag.id)),
  );

  const proposedTagIds = new Set(
    proposed.specialty_tags.map((tag) => String(tag.id)),
  );

  const addedTags = proposed.specialty_tags.filter(
    (tag) => !previousTagIds.has(String(tag.id)),
  );

  const removedTags = previous.specialty_tags.filter(
    (tag) => !proposedTagIds.has(String(tag.id)),
  );

  const hasCategoryChanges = categoryChanged || clusterChanged;

  const hasSpecialtyChanges = addedTags.length > 0 || removedTags.length > 0;

  const changeTitle =
    hasCategoryChanges && hasSpecialtyChanges
      ? "Category and specialty changes"
      : hasCategoryChanges
        ? "Category change"
        : hasSpecialtyChanges
          ? "Specialty tag changes"
          : "Classification request";

  const changeIcon = hasCategoryChanges ? "shape-outline" : "tag-outline";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View classification request ${request.id}: ${changeTitle}`}
      className="cursor-pointer rounded-2xl border border-border-primary/70 bg-surface p-4 active:opacity-75"
    >
      {/* Request identifier and status */}
      <View className="flex-row items-center justify-between gap-3 border-b border-border-primary/60 pb-3">
        <AppText
          weight="semibold"
          className="text-xs tracking-wide text-text-secondary"
        >
          REQUEST #{request.id}
        </AppText>

        <BusinessNameChangeStatusBadge status={request.status} />
      </View>

      {/* Summary of actual classification changes */}
      <View className="flex-row items-start gap-3 py-4">
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background">
          <MaterialCommunityIcons
            name={changeIcon}
            size={21}
            color={theme.extends.colors.text.secondary}
          />
        </View>

        <View className="min-w-0 flex-1">
          <AppText weight="semibold" className="text-sm text-text-primary">
            {changeTitle}
          </AppText>

          {/* Changed category */}
          {categoryChanged ? (
            <View className="mt-2">
              <AppText className="text-xs text-text-secondary">
                Category
              </AppText>

              <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
                <AppText className="text-xs text-text-secondary">
                  {previous.category.name}
                </AppText>

                <MaterialCommunityIcons
                  name="arrow-right"
                  size={15}
                  color={theme.extends.colors.text.tertiary}
                />

                <AppText
                  weight="semibold"
                  className="text-xs text-text-primary"
                >
                  {proposed.category.name}
                </AppText>
              </View>
            </View>
          ) : null}

          {/* Changed cluster */}
          {clusterChanged ? (
            <View className="mt-2">
              <AppText className="text-xs text-text-secondary">Cluster</AppText>

              <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
                <AppText className="text-xs text-text-secondary">
                  {previous.cluster.name}
                </AppText>

                <MaterialCommunityIcons
                  name="arrow-right"
                  size={15}
                  color={theme.extends.colors.text.tertiary}
                />

                <AppText
                  weight="semibold"
                  className="text-xs text-text-primary"
                >
                  {proposed.cluster.name}
                </AppText>
              </View>
            </View>
          ) : null}

          {/* Specialty tags being added */}
          {addedTags.length > 0 ? (
            <View className="mt-2 flex-row items-start gap-2">
              <MaterialCommunityIcons
                name="plus-circle-outline"
                size={17}
                color={theme.extends.colors.text.secondary}
              />

              <AppText className="min-w-0 flex-1 text-xs leading-5 text-text-secondary">
                <AppText
                  weight="semibold"
                  className="text-xs text-text-primary"
                >
                  Added:
                </AppText>{" "}
                {addedTags.map((tag) => tag.name).join(" · ")}
              </AppText>
            </View>
          ) : null}

          {/* Specialty tags being removed */}
          {removedTags.length > 0 ? (
            <View className="mt-2 flex-row items-start gap-2">
              <MaterialCommunityIcons
                name="minus-circle-outline"
                size={17}
                color={theme.extends.colors.text.secondary}
              />

              <AppText className="min-w-0 flex-1 text-xs leading-5 text-text-secondary">
                <AppText
                  weight="semibold"
                  className="text-xs text-text-primary"
                >
                  Removed:
                </AppText>{" "}
                {removedTags.map((tag) => tag.name).join(" · ")}
              </AppText>
            </View>
          ) : null}

          {/* Fallback for unchanged historical snapshots */}
          {!hasCategoryChanges && !hasSpecialtyChanges ? (
            <AppText className="mt-1 text-xs leading-5 text-text-secondary">
              View the submitted request details.
            </AppText>
          ) : null}
        </View>
      </View>

      {/* Submission metadata */}
      <View className="flex-row items-center justify-between border-t border-border-primary/60 pt-3">
        <AppText className="text-xs text-text-secondary">
          Submitted {formatDate(request.submitted_at)}
        </AppText>

        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.extends.colors.text.tertiary}
        />
      </View>
    </Pressable>
  );
}
