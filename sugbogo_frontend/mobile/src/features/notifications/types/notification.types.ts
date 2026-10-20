export const KNOWN_NOTIFICATION_TYPES = [
  "business_review_received",
  "business_name_change_approved",
  "business_name_change_rejected",
  "business_classification_change_approved",
  "business_classification_change_rejected",
  "business_location_change_approved",
  "business_location_change_rejected",
  "review_report_approved",
  "review_report_rejected",
  "review_dispute_upheld",
  "review_dispute_dismissed",
  "review_rejected",
] as const;

export type KnownNotificationType = (typeof KNOWN_NOTIFICATION_TYPES)[number];

export type NotificationFilter = "all" | "unread";

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string;
  target_type: string;
  target_id: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string | null;
}

export interface NotificationPagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface NotificationPage {
  items: NotificationItem[];
  pagination: NotificationPagination;
}

export interface NotificationUnreadCount {
  unread_count: number;
}

export interface NotificationReadAllResult {
  updated_count: number;
}
