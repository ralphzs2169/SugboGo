import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import type { SpecialtyTag } from "@/shared/types/specialtyTag.types";

type ClassificationValue = {
  category: { id: number; name: string };
  cluster: { name: string; icon?: string };
};

type TagValue = {
  id: number;
  name: string;
  color?: SpecialtyTag["color"];
};

type RequestStatus = "pending" | "approved" | "rejected" | "withdrawn";

type Props = {
  current: ClassificationValue;
  proposed: ClassificationValue;
  currentTags: TagValue[];
  proposedTags: TagValue[];
  status?: RequestStatus;
  showBorder?: boolean;
};

/**
 * Displays category and specialty differences in a classification request.
 *
 * Uses bordered comparison cards in submission review and request details.
 * Specialty additions and removals retain their captured names and use neutral
 * styling when historical colors are unavailable.
 */
export default function ClassificationChangeReviewSections({
  current,
  proposed,
  currentTags,
  proposedTags,
  status,
  showBorder = true,
}: Props) {
  const categoryChanged = current.category.id !== proposed.category.id;

  const addedTags = proposedTags.filter(
    (tag) => !currentTags.some((currentTag) => currentTag.id === tag.id),
  );

  const removedTags = currentTags.filter(
    (tag) => !proposedTags.some((proposedTag) => proposedTag.id === tag.id),
  );

  const hasSpecialtyChanges = addedTags.length > 0 || removedTags.length > 0;

  const isHistorical = status !== undefined;
  const isApproved = status === "approved";

  const currentLabel = isHistorical ? "At submission" : "Currently live";

  const proposedLabel = isApproved
    ? "Approved"
    : isHistorical
      ? "Requested"
      : "Proposed";

  const addedLabel = isApproved
    ? "Added"
    : isHistorical
      ? "Requested to add"
      : "To be added";

  const removedLabel = isApproved
    ? "Removed"
    : isHistorical
      ? "Requested to remove"
      : "To be removed";

  function renderTagChip(tag: TagValue) {
    // Historical snapshots may not include the specialty's color.
    if (tag.color === undefined) {
      return (
        <View
          key={tag.id}
          className="rounded-full border border-border-primary bg-background px-3 py-1.5"
        >
          <AppText className="text-xs text-text-secondary">{tag.name}</AppText>
        </View>
      );
    }

    return (
      <SpecialtyTagChip
        key={tag.id}
        tag={{
          name: tag.name,
          color: tag.color,
        }}
        size="small"
        showIcon
      />
    );
  }

  const categoryContent = (
    <View className="gap-3">
      {/* Original category */}
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-background">
          <MaterialCommunityIcons
            name={CLUSTER_ICONS[current.cluster.icon ?? ""] ?? "store-outline"}
            size={21}
            color={theme.extends.colors.text.secondary}
          />
        </View>

        <View className="min-w-0 flex-1">
          <AppText className="text-xs text-text-secondary">
            {currentLabel}
          </AppText>

          <AppText
            weight="semibold"
            className="mt-0.5 text-sm text-text-primary"
          >
            {current.category.name}
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            {current.cluster.name}
          </AppText>
        </View>
      </View>

      {/* Category transition */}
      <View className="flex-row items-center gap-3">
        <View className="h-8 w-10 items-center justify-center">
          <MaterialCommunityIcons
            name="arrow-down"
            size={20}
            color={theme.extends.colors.text.secondary}
          />
        </View>

        <View className="h-px flex-1 bg-border-primary" />
      </View>

      {/* Proposed or approved category */}
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-background">
          <MaterialCommunityIcons
            name={CLUSTER_ICONS[proposed.cluster.icon ?? ""] ?? "store-outline"}
            size={21}
            color={theme.extends.colors.text.secondary}
          />
        </View>

        <View className="min-w-0 flex-1">
          <AppText className="text-xs text-text-secondary">
            {proposedLabel}
          </AppText>

          <AppText
            weight="semibold"
            className="mt-0.5 text-sm text-text-primary"
          >
            {proposed.category.name}
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            {proposed.cluster.name}
          </AppText>
        </View>
      </View>
    </View>
  );

  const specialtyContent = (
    <View className="gap-3">
      {/* Specialty additions */}
      {addedTags.length > 0 ? (
        <View className="rounded-xl bg-background px-4 py-3">
          <AppText
            weight="semibold"
            className="mb-1 text-xs text-text-secondary"
          >
            {addedLabel} ({addedTags.length})
          </AppText>

          {addedTags.map((tag) => (
            <View
              key={tag.id}
              className="flex-row items-center border-b border-border-primary/60 py-3 last:border-b-0 last:pb-0"
            >
              <MaterialCommunityIcons
                name="plus-circle-outline"
                size={20}
                color={theme.extends.colors.text.info}
              />

              <View className="ml-3 min-w-0 flex-1 flex-row flex-wrap">
                {renderTagChip(tag)}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Specialty removals */}
      {removedTags.length > 0 ? (
        <View className="rounded-xl bg-background px-4 py-3">
          <AppText
            weight="semibold"
            className="mb-1 text-xs text-text-secondary"
          >
            {removedLabel} ({removedTags.length})
          </AppText>

          {removedTags.map((tag) => (
            <View
              key={tag.id}
              className="flex-row items-center border-b border-border-primary/60 py-3 last:border-b-0 last:pb-0"
            >
              <MaterialCommunityIcons
                name="minus-circle-outline"
                size={20}
                color={theme.extends.colors.text.secondary}
              />

              <View className="ml-3 min-w-0 flex-1 flex-row flex-wrap">
                {renderTagChip(tag)}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      {/* Category comparison */}
      {categoryChanged ? (
        <View
          className={`mb-4 bg-surface p-4 ${
            showBorder ? "border rounded-xl border-border-primary/70" : ""
          }`}
        >
          {/* Card header */}
          <View className="flex-row items-center justify-between border-b border-border-primary/60 pb-3">
            <AppText weight="bold" className="text-sm text-text-primary">
              Category change
            </AppText>

            <MaterialCommunityIcons
              name="shape-outline"
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          </View>

          {/* Category comparison content */}
          <View className="pt-4">{categoryContent}</View>
        </View>
      ) : null}

      {/* Specialty additions and removals */}
      {hasSpecialtyChanges ? (
        <View
          className={`mb-4 bg-surface p-4 ${
            showBorder ? "border rounded-xl border-border-primary/70" : ""
          }`}
        >
          {/* Card header */}
          <View className="flex-row items-center justify-between border-b border-border-primary/60 pb-3">
            <AppText weight="bold" className="text-sm text-text-primary">
              Specialty changes
            </AppText>

            <MaterialCommunityIcons
              name="tag-outline"
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          </View>

          {/* Grouped specialty changes */}
          <View className="pt-4">{specialtyContent}</View>
        </View>
      ) : null}
    </>
  );
}
