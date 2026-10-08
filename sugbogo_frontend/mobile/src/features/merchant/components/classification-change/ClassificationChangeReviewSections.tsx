import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import type { SpecialtyTag } from "@/shared/types/specialtyTag.types";

import RegistrationSection from "../registration/RegistrationSection";

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
  presentation?: "section" | "card";
};

/**
 * Displays category and specialty differences in a classification request.
 *
 * Supports registration sections for submission review and bordered cards
 * for request details. Historical specialty tags without colors receive
 * neutral styling while preserving their captured names.
 */
export default function ClassificationChangeReviewSections({
  current,
  proposed,
  currentTags,
  proposedTags,
  status,
  presentation = "section",
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
  const wasNotApplied = status === "rejected" || status === "withdrawn";

  const currentLabel = isHistorical ? "At submission" : "Currently live";

  const proposedLabel = isApproved
    ? "Approved"
    : isHistorical
      ? "Requested"
      : "Proposed";

  const addedLabel = isApproved
    ? "Added"
    : wasNotApplied
      ? "Requested to add"
      : "To be added";

  const removedLabel = isApproved
    ? "Removed"
    : wasNotApplied
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
    <View className="gap-5">
      {/* Specialties being added */}
      {addedTags.length > 0 ? (
        <View>
          <View className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons
              name="plus-circle-outline"
              size={19}
              color={theme.extends.colors.text.info}
            />

            <AppText weight="semibold" className="text-sm text-text-primary">
              {addedLabel}
            </AppText>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {addedTags.map(renderTagChip)}
          </View>
        </View>
      ) : null}

      {/* Specialties being removed */}
      {removedTags.length > 0 ? (
        <View>
          <View className="mb-3 flex-row items-center gap-2">
            <MaterialCommunityIcons
              name="minus-circle-outline"
              size={19}
              color={theme.extends.colors.text.secondary}
            />

            <AppText weight="semibold" className="text-sm text-text-primary">
              {removedLabel}
            </AppText>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {removedTags.map(renderTagChip)}
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      <>
        {/* Category comparison */}
        {categoryChanged ? (
          presentation === "card" ? (
            <View className="mb-4 rounded-2xl border border-border-primary/70 bg-surface p-4">
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
          ) : (
            <RegistrationSection title="Category change" icon="shape-outline">
              {categoryContent}
            </RegistrationSection>
          )
        ) : null}
      </>

      {/* Specialty additions and removals */}
      {hasSpecialtyChanges ? (
        presentation === "card" ? (
          <View className="mb-4 rounded-2xl border border-border-primary/70 bg-surface p-4">
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

            {/* Specialty changes content */}
            <View className="pt-4">{specialtyContent}</View>
          </View>
        ) : (
          <RegistrationSection title="Specialty changes" icon="tag-outline">
            {specialtyContent}
          </RegistrationSection>
        )
      ) : null}
    </>
  );
}
