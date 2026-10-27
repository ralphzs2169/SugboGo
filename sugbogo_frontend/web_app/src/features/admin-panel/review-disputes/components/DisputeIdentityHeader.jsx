import { Link } from "react-router-dom";
import { ArrowDown, Clock3, ExternalLink, Store } from "lucide-react";

import StatusBadge from "@/shared/components/StatusBadge";
import ClusterDisplay from "@/shared/components/ClusterDisplay";
import UserAvatar from "@/shared/components/UserAvatar";
import { formatLabel } from "@/shared/utils/stringUtils";
import { formatReviewTimestamp } from "../../moderation/components/reviewPresentation";

import { REVIEW_DISPUTE_STATUS_BADGE_VARIANT } from "../constants/reviewDisputeStatus";

const identityLinkClass =
  "group inline-flex min-w-0 items-center gap-1.5 rounded-sm " +
  "text-sm font-medium text-text-primary transition-colors " +
  "hover:text-primary hover:underline " +
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-primary";

function IdentityLink({ to, children }) {
  if (!to) {
    return (
      <span className="inline-flex min-w-0 text-sm font-medium text-text-primary">
        <span className="truncate">{children}</span>
      </span>
    );
  }

  return (
    <Link to={to} className={identityLinkClass}>
      <span className="truncate">{children}</span>

      <ExternalLink
        className="
          h-3.5 w-3.5 shrink-0 text-text-secondary
          transition-colors group-hover:text-primary
        "
        aria-hidden="true"
      />
    </Link>
  );
}

export default function DisputeIdentityHeader({ dispute }) {
  const business = dispute.business ?? {};
  const merchant = dispute.merchant ?? {};
  const merchantName = merchant.name || (
    dispute.original_merchant_id
      ? `Merchant #${dispute.original_merchant_id}`
      : "Merchant"
  );
  const businessName = business.name || (
    dispute.original_business_id
      ? `Business #${dispute.original_business_id}`
      : "Unknown business"
  );

  const classification = [business.cluster_name, business.category_name]
    .filter(Boolean)
    .join(" · ");

  return (
    <header className="min-w-0">
      {/* Case identity */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">
          Dispute #{dispute.id}
        </h2>

        <StatusBadge
          variant={
            REVIEW_DISPUTE_STATUS_BADGE_VARIANT[dispute.status] || "mutedSoft"
          }
        >
          {formatLabel(dispute.status)}
        </StatusBadge>
      </div>

      {/* Involved identities */}
      <div
        className="
          mt-4 grid min-w-0
          grid-cols-[4.5rem_minmax(0,1fr)]
          items-start gap-x-3 gap-y-3
          sm:grid-cols-[5rem_minmax(0,1fr)]
        "
      >
        {/* Merchant */}
        <span className="pt-1 text-xs font-medium text-text-secondary">
          Merchant
        </span>

        <div className="flex min-w-0 items-center gap-2">
          <UserAvatar
            avatarUrl={merchant.avatar_url}
            avatarKey={merchant.avatar_key}
            size="sm"
          />

          <IdentityLink
            to={dispute.merchant && dispute.merchant_id
              ? `/admin-panel/users/${dispute.merchant_id}`
              : null}
          >
            {merchantName}
          </IdentityLink>
        </div>

        {/* Business */}
        <span className="pt-1 text-xs font-medium text-text-secondary">
          Business
        </span>

        <div className="flex min-w-0 items-start gap-2">
          <span
            className="
              flex h-7 w-7 shrink-0 items-center justify-center
              overflow-hidden rounded-md border border-stroke
              bg-surface-muted
            "
          >
            {business.cover_photo_url ? (
              <img
                src={business.cover_photo_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Store
                className="h-4 w-4 text-text-secondary"
                aria-hidden="true"
              />
            )}
          </span>

          <div className="min-w-0">
            <IdentityLink
              to={business.id ? `/admin-panel/businesses/${business.id}` : null}
            >
              {businessName}
            </IdentityLink>

            {classification && (
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-text-secondary">
                {business.cluster_name && (
                  <ClusterDisplay
                    clusterName={business.cluster_name}
                    clusterIcon={business.cluster_icon}
                    variant="small"
                  />
                )}
                {business.cluster_name && business.category_name && (
                  <span aria-hidden="true">·</span>
                )}
                {business.category_name && (
                  <span className="truncate">{business.category_name}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Review */}
        <span className="pt-0.5 text-xs font-medium text-text-secondary">
          Review
        </span>

        <a href="#dispute-original-review" className={identityLinkClass}>
          <span>Review #{dispute.original_review_id ?? dispute.current_review?.id ?? dispute.review?.id}</span>

          <ArrowDown
            className="
              h-3.5 w-3.5 shrink-0 text-text-secondary
              transition-colors group-hover:text-primary
            "
            aria-hidden="true"
          />
        </a>
      </div>

      {/* Case metadata */}
      <div
        className="
          mt-4 flex flex-wrap items-center justify-between
          gap-x-4 gap-y-2 border-t border-stroke pt-3
          text-xs text-text-secondary
        "
      >
        <span className="font-medium">Attempt #{dispute.attempt_number}</span>

        {dispute.created_at && (
          <div className="ml-auto inline-flex shrink-0 items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />

            <time dateTime={dispute.created_at}>
              Filed {formatReviewTimestamp(dispute.created_at)}
            </time>
          </div>
        )}
      </div>
    </header>
  );
}
