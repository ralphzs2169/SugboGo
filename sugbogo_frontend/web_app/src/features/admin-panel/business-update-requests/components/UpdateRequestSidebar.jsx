import { Link } from "react-router-dom";
import { ArrowUpRight, Store, UsersRound } from "lucide-react";

import UserAvatar from "@/shared/components/UserAvatar";
import { CLUSTER_ICONS } from "@/features/admin-panel/cluster-category/constants/clusterIcons";
import useBusinessDetail from "@/features/admin-panel/businesses/hooks/useBusinessDetail";
import ReviewChecklist from "./ReviewChecklist";
import ReviewDecision from "./ReviewDecision";
import ReviewRequestInformation from "./ReviewRequestInformation";

/**
 * Displays supporting information shared by Admin update request reviews.
 *
 * Groups request metadata, business and merchant identities, review
 * guidance, and decision history using simple section dividers within
 * the unified review card.
 */
export default function UpdateRequestSidebar({ request, checklistQuestions }) {
  const isPending = request.status === "pending";

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
  const categoryName =
    request.category_name ||
    request.current?.category?.name ||
    business?.category_name;
  const clusterName =
    request.cluster_name ||
    request.current?.cluster?.name ||
    business?.cluster_name;
  const clusterIconValue =
    request.cluster_icon ||
    request.current?.cluster?.icon ||
    business?.cluster_icon;
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
      <ReviewRequestInformation request={request} />

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
      {isPending && <ReviewChecklist questions={checklistQuestions} />}

      {/* Historical administrative decision */}
      {!isPending && <ReviewDecision request={request} />}
    </div>
  );
}
