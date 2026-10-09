import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { formatDate } from "@/shared/utils/date.utils";

import type { LocationChangeRequest } from "../../types/locationChange.types";
import { getLocationReviewChanges } from "../../utils/locationReview.utils";
import BusinessNameChangeStatusBadge from "../business-name-change/BusinessNameChangeStatusBadge";

type RequestSummary = {
  title: string;
  detail: string;
  kind: "address" | "pin" | "landmarks" | "mixed";
};

/** Builds a concise summary from the differences captured in a location request. */
function getRequestSummary(request: LocationChangeRequest): RequestSummary {
  const { addressChanges, pinMoved, addedLandmarks, removedLandmarks } =
    getLocationReviewChanges(
      request.previous.location,
      request.proposed.location,
      request.previous.landmarks,
      request.proposed.landmarks,
    );

  const hasAddressChanges = addressChanges.length > 0;
  const hasLandmarkChanges =
    addedLandmarks.length > 0 || removedLandmarks.length > 0;

  const landmarkDetails = [
    ...(addedLandmarks.length > 0
      ? [
          `${addedLandmarks.length} ${
            addedLandmarks.length === 1 ? "addition" : "additions"
          }`,
        ]
      : []),
    ...(removedLandmarks.length > 0
      ? [
          `${removedLandmarks.length} ${
            removedLandmarks.length === 1 ? "removal" : "removals"
          }`,
        ]
      : []),
  ].join(" · ");

  // Multiple types of changes in the same request.
  if (
    (hasAddressChanges && pinMoved) ||
    (hasAddressChanges && hasLandmarkChanges) ||
    (pinMoved && hasLandmarkChanges)
  ) {
    const details = [
      ...addressChanges.map((change) => change.label),
      ...(pinMoved ? ["Map pin"] : []),
      ...(hasLandmarkChanges ? [`Landmarks (${landmarkDetails})`] : []),
    ];

    return {
      title: hasLandmarkChanges
        ? "Location and landmark changes"
        : "Location details change",
      detail: details.join(" · "),
      kind: "mixed",
    };
  }

  // A single address field was changed.
  if (addressChanges.length === 1) {
    const change = addressChanges[0];

    return {
      title: `${change.label} change`,
      detail: `Proposed: ${change.requested || "Not provided"}`,
      kind: "address",
    };
  }

  // Several address fields were changed.
  if (addressChanges.length > 1) {
    return {
      title: "Address details change",
      detail: addressChanges.map((change) => change.label).join(" · "),
      kind: "address",
    };
  }

  // Only the geographic map pin was changed.
  if (pinMoved) {
    return {
      title: "Map pin change",
      detail: "A new business map position was requested.",
      kind: "pin",
    };
  }

  // Only nearby landmarks were changed.
  if (hasLandmarkChanges) {
    return {
      title: "Landmark changes",
      detail: landmarkDetails,
      kind: "landmarks",
    };
  }

  return {
    title: "Location change request",
    detail: "View the submitted request details.",
    kind: "mixed",
  };
}

/**
 * Displays a change-aware summary of a merchant's location request.
 *
 * Highlights only modified address fields, pin movement, or landmark
 * additions and removals while preserving request status and date.
 */
export default function LocationChangeRequestCard({
  request,
  onPress,
}: {
  request: LocationChangeRequest;
  onPress: () => void;
}) {
  const summary = getRequestSummary(request);

  const summaryIcon =
    summary.kind === "landmarks"
      ? "map-marker-radius-outline"
      : summary.kind === "pin"
        ? "map-marker-outline"
        : summary.kind === "mixed"
          ? "map-outline"
          : "map-marker-outline";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View location request: ${summary.title}`}
      className="cursor-pointer rounded-2xl border border-border-primary/70 bg-surface p-4 active:opacity-75"
    >
      {/* Request title and review status */}
      <View className="flex-row items-center justify-between gap-3 border-b border-border-primary/60 pb-3">
        <AppText className="text-xs font-semibold tracking-wide text-text-secondary">
          REQUEST #{request.id}
        </AppText>

        <BusinessNameChangeStatusBadge status={request.status} />
      </View>

      {/* Summary of actual requested changes */}
      <View className="flex-row items-start gap-3 py-4">
        <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background">
          <MaterialCommunityIcons
            name={summaryIcon}
            size={21}
            color={theme.extends.colors.text.secondary}
          />
        </View>

        <View className="min-w-0 flex-1">
          <AppText weight="semibold" className="text-sm text-text-primary">
            {summary.title}
          </AppText>

          <AppText
            className="mt-1 text-xs leading-5 text-text-secondary"
            numberOfLines={3}
          >
            {summary.detail}
          </AppText>
        </View>
      </View>

      {/* Submission metadata and navigation */}
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
