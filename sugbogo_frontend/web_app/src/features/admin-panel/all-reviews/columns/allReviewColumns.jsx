import { createColumnHelper } from "@tanstack/react-table";
import { Eye, MessageSquareText } from "lucide-react";
import Button from "@/shared/components/Button";
import UserAvatar from "@/shared/components/UserAvatar";
import BusinessImage from "../../businesses/components/business-detail/BusinessImage";
import ReviewDate from "../components/ReviewDate";
import ReviewStateBadge from "../components/ReviewStateBadge";
import { reviewAuthorName } from "../utils/allReviewPresentation";

const column = createColumnHelper();

/** Render the detailed directory using the existing Businesses cell density and tokens. */
export default function allReviewColumns(onView) {
  return [
    column.display({
      id: "rowNumber",
      header: "No.",
      size: 60,
      meta: { skeleton: "number" },
      cell: ({ row, table }) => {
        const { pageIndex, pageSize } = table.getState().pagination;
        return (
          <span className="text-sm tabular-nums text-text-secondary">
            {pageIndex * pageSize + row.index + 1}
          </span>
        );
      },
    }),
    column.display({
      id: "review",
      header: "Review",
      size: 340,
      meta: { skeleton: "longText" },
      cell: ({ row }) => {
        const review = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            {review.first_photo_url ? (
              <BusinessImage
                src={review.first_photo_url}
                alt=""
                fallback=""
                className="h-16 w-16 shrink-0 rounded-lg border border-stroke"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-stroke bg-surface-muted">
                <MessageSquareText
                  aria-hidden="true"
                  className="h-5 w-5 text-text-secondary"
                />
              </div>
            )}
            <div className="min-w-0">
              <p
                className="line-clamp-2 break-words text-sm font-medium leading-5 text-text-primary"
                title={review.text}
              >
                {review.text || "No written review"}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {review.photo_count > 0
                  ? `${review.photo_count} ${review.photo_count === 1 ? "photo" : "photos"}`
                  : "Text only"}
              </p>
            </div>
          </div>
        );
      },
    }),
    column.display({
      id: "author",
      header: "Reviewer",
      size: 240,
      meta: { skeleton: "longText" },
      cell: ({ row }) => {
        const author = row.original.author;
        const name = reviewAuthorName(author);
        return (
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              avatarUrl={author?.avatar_url}
              avatarKey={author?.avatar_key}
              size="lg"
            />
            <div className="min-w-0">
              <p
                title={name}
                className="truncate text-sm font-medium text-text-primary"
              >
                {name}
              </p>
              {author?.email && (
                <p
                  title={author.email}
                  className="mt-1 truncate text-xs text-text-secondary"
                >
                  {author.email}
                </p>
              )}
            </div>
          </div>
        );
      },
    }),
    column.display({
      id: "business",
      header: "Business",
      size: 280,
      meta: { skeleton: "longText" },
      cell: ({ row }) => {
        const business = row.original.business;
        const classification = [business?.category_name, business?.cluster_name]
          .filter(Boolean)
          .join(" · ");
        return (
          <div className="flex min-w-0 items-center gap-3">
            <BusinessImage
              src={business?.cover_photo_url}
              alt=""
              fallback=""
              className="h-12 w-12 shrink-0 rounded-lg border border-stroke"
            />
            <div className="min-w-0">
              <p
                title={business?.name}
                className="truncate text-sm font-bold text-text-primary"
              >
                {business?.name || "Business unavailable"}
              </p>
              {classification && (
                <p
                  title={classification}
                  className="mt-1 truncate text-xs text-text-secondary"
                >
                  {classification}
                </p>
              )}
            </div>
          </div>
        );
      },
    }),
    column.display({
      id: "status",
      header: "Status",
      size: 145,
      meta: { skeleton: "text" },
      cell: ({ row }) => <ReviewStateBadge status={row.original.status} />,
    }),
    column.display({
      id: "reports",
      header: "Reports",
      size: 130,
      meta: { skeleton: "text" },
      cell: ({ row }) => {
        const { report_count: total, pending_report_count: pending } =
          row.original;
        return (
          <div className="space-y-1">
            <p
              className={`text-sm tabular-nums ${total > 0 ? "font-medium text-text-primary" : "text-text-secondary"}`}
            >
              {total === 0
                ? "—"
                : `${total} ${total === 1 ? "report" : "reports"}`}
            </p>
            {pending > 0 && (
              <p className="text-xs font-medium text-text-primary">
                {pending} pending
              </p>
            )}
          </div>
        );
      },
    }),
    column.display({
      id: "submitted",
      header: "Submitted",
      size: 145,
      meta: { skeleton: "text" },
      cell: ({ row }) => <ReviewDate value={row.original.submitted_at} />,
    }),
    column.display({
      id: "actions",
      header: "Actions",
      size: 90,
      meta: { skeleton: "actions" },
      cell: ({ row }) => (
        <Button
          variant="action"
          size="md"
          icon={Eye}
          iconOnly
          aria-label={`View review #${row.original.id}`}
          title="View review"
          onClick={() => onView(row.original.id)}
        />
      ),
    }),
  ];
}
