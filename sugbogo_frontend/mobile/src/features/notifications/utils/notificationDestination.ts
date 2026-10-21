import type { Href } from "expo-router";

import type { NotificationItem } from "../types/notification.types";

export const SUPPORTED_NOTIFICATION_TARGET_TYPES = [
  "business_review",
  "merchant_application",
  "review_dispute",
  "business_name_change",
  "business_classification_change",
  "business_location_change",
] as const;

export type SupportedNotificationTargetType =
  (typeof SUPPORTED_NOTIFICATION_TARGET_TYPES)[number];

export type NotificationDestination = {
  href: Href;
  label: string;
  requiredMode: "explorer" | "merchant";
  targetType: SupportedNotificationTargetType;
};

export type NotificationDestinationResolution =
  | { kind: "destination"; destination: NotificationDestination }
  | { kind: "unavailable" }
  | { kind: "informational" };

type DestinationFactory = (targetId: number) => NotificationDestination;

const destinationFactories: Record<
  SupportedNotificationTargetType,
  DestinationFactory
> = {
  business_review: (targetId) => ({
    href: {
      pathname: "/(merchant)/(tabs)/reviews",
      params: {
        reviewId: String(targetId),
        filter: "all",
        ordering: "newest",
      },
    } as unknown as Href,
    label: "review",
    requiredMode: "merchant",
    targetType: "business_review",
  }),
  // ApplicationSummaryScreen loads the signed-in user's single application.
  merchant_application: () => ({
    href: "/(explorer)/merchant-registration/submitted-application",
    label: "merchant application",
    requiredMode: "explorer",
    targetType: "merchant_application",
  }),
  // The checked-in Expo route declarations omit existing Merchant stack paths.
  // These casts remain safe because every path below maps to a confirmed route file.
  review_dispute: (targetId) => ({
    href: {
      pathname: "/(merchant)/review-disputes/[disputeId]",
      params: { disputeId: String(targetId) },
    } as unknown as Href,
    label: "review dispute",
    requiredMode: "merchant",
    targetType: "review_dispute",
  }),
  business_name_change: (targetId) => ({
    href: {
      pathname: "/(merchant)/business-update-requests/[requestId]",
      params: { requestId: String(targetId) },
    } as unknown as Href,
    label: "business name request",
    requiredMode: "merchant",
    targetType: "business_name_change",
  }),
  business_classification_change: (targetId) => ({
    href: {
      pathname:
        "/(merchant)/business-update-requests/classification/[requestId]",
      params: { requestId: String(targetId) },
    } as unknown as Href,
    label: "business classification request",
    requiredMode: "merchant",
    targetType: "business_classification_change",
  }),
  business_location_change: (targetId) => ({
    href: {
      pathname: "/(merchant)/business-update-requests/location/[requestId]",
      params: { requestId: String(targetId) },
    } as unknown as Href,
    label: "business location request",
    requiredMode: "merchant",
    targetType: "business_location_change",
  }),
};

function isSupportedTargetType(
  targetType: string,
): targetType is SupportedNotificationTargetType {
  return Object.prototype.hasOwnProperty.call(destinationFactories, targetType);
}

/** Resolves trusted backend target types to confirmed Expo Router destinations. */
export function resolveNotificationDestination(
  notification: Pick<NotificationItem, "target_type" | "target_id">,
): NotificationDestinationResolution {
  if (!isSupportedTargetType(notification.target_type)) {
    return { kind: "informational" };
  }

  if (
    !Number.isSafeInteger(notification.target_id) ||
    (notification.target_id ?? 0) <= 0
  ) {
    return { kind: "unavailable" };
  }

  return {
    kind: "destination",
    destination: destinationFactories[notification.target_type](
      notification.target_id as number,
    ),
  };
}
