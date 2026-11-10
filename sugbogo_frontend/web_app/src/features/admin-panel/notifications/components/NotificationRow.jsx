import { Bell, ClipboardList, Flag, MessageSquareWarning, ShieldAlert } from "lucide-react";

import { formatDateTime } from "@/shared/utils/dateUtils";
import { formatNotificationTime } from "../utils/notificationPresentation";

const eventIcons = {
  admin_merchant_application_submitted: ClipboardList,
  admin_review_moderation_required: ShieldAlert,
  admin_review_report_received: Flag,
  admin_review_dispute_filed: MessageSquareWarning,
};

/** Present one readable, keyboard-operable inbox item without interpreting URLs. */
export default function NotificationRow({ notification, onSelect, disabled }) {
  const Icon = eventIcons[notification.type] ?? Bell;
  return (
    <li className="border-b border-stroke last:border-b-0">
      <button
        type="button"
        onClick={() => onSelect(notification)}
        disabled={disabled}
        className={`flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-interaction-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info disabled:cursor-wait ${notification.is_read ? "bg-background" : "bg-primary/5"}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block break-words text-sm text-text-primary ${notification.is_read ? "font-medium" : "font-semibold"}`}>
            {notification.title}
          </span>
          <span className="mt-1 block break-words text-sm leading-relaxed text-text-secondary">
            {notification.body}
          </span>
          <time
            dateTime={notification.created_at || undefined}
            title={formatDateTime(notification.created_at)}
            className="mt-2 block text-xs text-text-secondary"
          >
            {formatNotificationTime(notification.created_at)}
          </time>
        </span>
        <span className="shrink-0 pt-1">
          {!notification.is_read && <span aria-hidden="true" className="block h-2 w-2 rounded-full bg-primary" />}
          <span className="sr-only">{notification.is_read ? "Read" : "Unread"}</span>
        </span>
      </button>
    </li>
  );
}
