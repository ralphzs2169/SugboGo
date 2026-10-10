import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarCheck2,
  CalendarDays,
  CircleCheck,
  CircleHelp,
  ClipboardCheck,
  Info,
  Store,
  UsersRound,
} from "lucide-react";

import UserAvatar from "@/shared/components/UserAvatar";
import { formatDateTime } from "@/shared/utils/dateUtils";
import { CLUSTER_ICONS } from "@/features/admin-panel/cluster-category/constants/clusterIcons";
import useBusinessDetail from "@/features/admin-panel/businesses/hooks/useBusinessDetail";

const NAME_REVIEW_CHECKLIST = [
  "Does the requested name appropriately represent the business?",
  "Does the name align with the business's existing information?",
  "Could the name be misleading or confused with another business?",
  "Does the merchant's explanation reasonably support the change?",
];

/**
 * Displays supporting information for a business name change review.
 *
 * Groups request metadata, business and merchant identities, review
 * guidance, and decision history using simple section dividers within
 * the unified review card.
 */
export default function BusinessNameRequestSidebar({ request }) {
  const isPending = request.status === "pending";

  const reviewer = request.reviewer?.name || request.reviewer?.email || "Admin";
  const needsBusinessContext =
    request.category_name === undefined ||
    request.cluster_name === undefined ||
    request.cluster_icon === undefined ||
    request.cover_photo_url === undefined ||
    (request.merchant?.avatar_url === undefined &&
      request.merchant?.avatar_key === undefined);
  const {
    business,
    isLoading: isBusinessLoading,
    error: businessError,
    refetch: refetchBusiness,
  } = useBusinessDetail(request.business_id, {
    enabled: Boolean(request.business_id) && needsBusinessContext,
  });
  const coverPhotoUrl = request.cover_photo_url || business?.cover_photo_url;
  const categoryName = request.category_name || business?.category_name;
  const clusterName = request.cluster_name || business?.cluster_name;
  const clusterIconValue = request.cluster_icon || business?.cluster_icon;
  const merchantAvatarUrl =
    request.merchant?.avatar_url || business?.owner?.avatar_url;
  const merchantAvatarKey =
    request.merchant?.avatar_key || business?.owner?.avatar_key;
  const clusterIcon = CLUSTER_ICONS.find(
    (icon) => icon.value === clusterIconValue,
  );
  const ClusterIcon = clusterIcon?.icon;

  return (
    <div className="min-w-0">
      {/* Request information */}
      <section className="p-5 sm:p-6">
        <div className="flex items-center gap-2 text-text-secondary">
          <Info size={16} aria-hidden="true" />

          <h3 className="text-xs font-bold uppercase tracking-wider">
            Request Information
          </h3>
        </div>

        <dl className="mt-5 space-y-4">
          {/* Request identifier */}
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
            <dt className="text-sm text-text-secondary">Request</dt>

            <dd className="text-sm font-semibold text-text-primary">
              #{request.id}
            </dd>
          </div>

          {/* Submission date */}
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
            <dt className="text-sm text-text-secondary">Submitted</dt>

            <dd className="flex min-w-0 items-start gap-2 text-sm font-medium text-text-primary">
              <CalendarDays
                size={15}
                className="mt-0.5 shrink-0 text-text-secondary"
                aria-hidden="true"
              />

              <span>{formatDateTime(request.submitted_at)}</span>
            </dd>
          </div>

          {/* Resolution date */}
          {request.resolved_at && (
            <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
              <dt className="text-sm text-text-secondary">Resolved</dt>

              <dd className="flex min-w-0 items-start gap-2 text-sm font-medium text-text-primary">
                <CalendarCheck2
                  size={15}
                  className="mt-0.5 shrink-0 text-text-secondary"
                  aria-hidden="true"
                />

                <span>{formatDateTime(request.resolved_at)}</span>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Business and merchant identities */}
      <section className="border-t border-stroke p-5 sm:p-6">
        <div className="flex items-center gap-2 text-text-secondary">
          <UsersRound size={16} aria-hidden="true" />

          <h3 className="text-xs font-bold uppercase tracking-wider">
            Business & Merchant
          </h3>
        </div>

        {/* Business identity */}
        <div className="mt-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            Business
          </p>

          <div className="flex min-w-0 items-center gap-3">
            {coverPhotoUrl ? (
              <img
                src={coverPhotoUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface text-text-secondary"
                aria-hidden="true"
              >
                <Store size={22} />
              </div>
            )}

            {/* Business information */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">
                {request.current_business_name || "Unnamed business"}
              </p>

              {categoryName || clusterName ? (
                <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                  {ClusterIcon && (
                    <ClusterIcon
                      className="h-3 w-3 shrink-0 text-text-secondary"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  )}
                  <p className="truncate text-xs text-text-secondary">
                    {categoryName || "—"}
                    {clusterName && ` · ${clusterName}`}
                  </p>
                </div>
              ) : isBusinessLoading ? (
                <p className="mt-1.5 text-xs text-text-secondary">
                  Loading business details…
                </p>
              ) : (
                <div className="mt-1.5 text-xs text-text-secondary">
                  <span>Business details unavailable.</span>
                  {businessError && (
                    <button
                      type="button"
                      className="ml-1 cursor-pointer font-semibold text-primary underline"
                      onClick={() => void refetchBusiness()}
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              <p className="mt-1 text-xs text-text-secondary">
                Business #{request.business_id}
              </p>
            </div>

            {request.business_id && (
              <Link
                to={`/admin-panel/businesses/${request.business_id}`}
                aria-label={`View ${request.current_business_name || "business"} details`}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                View
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>

        {/* Merchant identity */}
        <div className="mt-5 border-t border-stroke/70 pt-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            Submitted by
          </p>

          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              avatarUrl={merchantAvatarUrl}
              avatarKey={merchantAvatarKey}
              size="lg"
            />

            {/* Merchant information */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">
                {request.merchant?.name || request.merchant?.email || "—"}
              </p>

              {request.merchant?.name && request.merchant?.email && (
                <p
                  className="mt-1 truncate text-xs text-text-secondary"
                  title={request.merchant.email}
                >
                  {request.merchant.email}
                </p>
              )}
            </div>

            {request.merchant?.id && (
              <Link
                to={`/admin-panel/users/${request.merchant.id}`}
                aria-label={`View ${request.merchant.name || "merchant"} profile`}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                View
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Informational review checklist */}
      {isPending && (
        <section className="border-t border-stroke p-5 sm:p-6">
          {/* Section heading and guidance */}
          <div className="flex items-start gap-2">
            <ClipboardCheck
              size={16}
              className="shrink-0 text-text-secondary"
              aria-hidden="true"
            />

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Review Checklist
              </h3>

              <p className="mt-2 text-xs leading-5 text-text-secondary">
                Consider the following before making a decision.
              </p>
            </div>
          </div>

          {/* Read-only review considerations */}
          <ul className="mt-5">
            {NAME_REVIEW_CHECKLIST.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 border-b border-stroke/70 py-3 first:pt-0 last:border-b-0 last:pb-0"
              >
                <CircleHelp
                  size={16}
                  className="mt-0.5 shrink-0 text-text-secondary"
                  aria-hidden="true"
                />

                <span className="text-sm font-medium leading-6 text-text-primary">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Historical administrative decision */}
      {!isPending && (
        <section className="border-t border-stroke p-5 sm:p-6">
          <div className="flex items-center gap-2 text-text-secondary">
            <CircleCheck size={16} aria-hidden="true" />

            <h3 className="text-xs font-bold uppercase tracking-wider">
              Review Decision
            </h3>
          </div>

          {/* Approved decision */}
          {request.status === "approved" && (
            <p className="mt-4 text-sm leading-6 text-text-primary">
              Approved by <span className="font-semibold">{reviewer}</span>
              {request.resolved_at
                ? ` on ${formatDateTime(request.resolved_at)}`
                : ""}
              .
            </p>
          )}

          {/* Rejected decision */}
          {request.status === "rejected" && (
            <>
              <p className="mt-4 text-xs font-medium text-text-secondary">
                Administrator's feedback
              </p>

              <div className="mt-2 rounded-lg bg-surface p-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
                  {request.rejection_reason || "No feedback recorded."}
                </p>
              </div>

              <p className="mt-4 text-xs text-text-secondary">
                Rejected by {reviewer}
                {request.resolved_at
                  ? ` on ${formatDateTime(request.resolved_at)}`
                  : ""}
                .
              </p>
            </>
          )}

          {/* Withdrawn request */}
          {request.status === "withdrawn" && (
            <p className="mt-4 text-sm leading-6 text-text-secondary">
              Withdrawn by the merchant
              {request.resolved_at
                ? ` on ${formatDateTime(request.resolved_at)}`
                : ""}
              . No further review is required.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
