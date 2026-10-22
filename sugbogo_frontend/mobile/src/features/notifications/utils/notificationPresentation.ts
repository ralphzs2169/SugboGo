import type { ComponentProps } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { KnownNotificationType } from "../types/notification.types";

export type NotificationCategory =
  | "business"
  | "vouch"
  | "review"
  | "review-moderation"
  | "review-dispute"
  | "general";

const CATEGORY_BY_TYPE: Record<KnownNotificationType, NotificationCategory> = {
  business_vouch_received: "vouch",
  business_review_received: "review",
  business_name_change_approved: "business",
  business_name_change_rejected: "business",
  business_classification_change_approved: "business",
  business_classification_change_rejected: "business",
  business_location_change_approved: "business",
  business_location_change_rejected: "business",
  review_report_approved: "review-moderation",
  review_report_rejected: "review-moderation",
  review_rejected: "review-moderation",
  review_dispute_upheld: "review-dispute",
  review_dispute_dismissed: "review-dispute",
};

const ICON_BY_CATEGORY: Record<
  NotificationCategory,
  ComponentProps<typeof MaterialCommunityIcons>["name"]
> = {
  business: "storefront-outline",
  vouch: "heart-outline",
  review: "message-text-outline",
  "review-moderation": "message-text-outline",
  "review-dispute": "shield-check-outline",
  general: "bell-outline",
};

/** Resolves backend event codes into a small, stable visual category system. */
export function getNotificationPresentation(type: string) {
  const category = CATEGORY_BY_TYPE[type as KnownNotificationType] ?? "general";

  return {
    category,
    icon: ICON_BY_CATEGORY[category],
  };
}

/** Formats notification timestamps without adding a date-library dependency. */
export function formatNotificationTime(
  value: string | null | undefined,
  now = new Date(),
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const differenceMs = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(differenceMs / 60_000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const notificationDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const calendarDays = Math.round(
    (today.getTime() - notificationDay.getTime()) / 86_400_000,
  );

  if (calendarDays === 1) {
    return "Yesterday";
  }

  if (calendarDays < 7) {
    return `${Math.max(1, calendarDays)} days ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
