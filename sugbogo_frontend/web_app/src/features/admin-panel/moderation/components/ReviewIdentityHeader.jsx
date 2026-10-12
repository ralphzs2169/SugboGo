import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Clock3, ExternalLink, Store } from "lucide-react";

import ClusterDisplay from "@/shared/components/ClusterDisplay";
import StatusBadge from "@/shared/components/StatusBadge";
import UserAvatar from "@/shared/components/UserAvatar";

import { fetchClusters } from "../../cluster-category/services/clusterCategoryService";
import { formatReviewTimestamp } from "./reviewPresentation";

const STATUS_PRESENTATION = {
  published: { label: "Published", variant: "success" },
  rejected: { label: "Rejected", variant: "muted" },
  under_review: { label: "Under Review", variant: "info" },
};

export function ReviewStatusBadge({ status }) {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <StatusBadge variant={presentation?.variant ?? "neutral"}>
      {presentation?.label ?? "Unknown status"}
    </StatusBadge>
  );
}

export default function ReviewIdentityHeader({ review }) {
  const clusterName = review.business.cluster_name;
  const { data: clusterResults } = useQuery({
    queryKey: ["admin", "taxonomy", "clusters", "by-name", clusterName],
    queryFn: () => fetchClusters({ search: clusterName, page_size: 100 }),
    enabled: Boolean(clusterName),
    staleTime: 5 * 60 * 1000,
  });
  const clusterIcon = clusterResults?.items?.find(
    (cluster) => cluster.name === clusterName,
  )?.icon;
  const authorName = [review.author.first_name, review.author.last_name]
    .filter(Boolean)
    .join(" ") || "Unknown author";

  return (
    <header className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-text-primary">
          Review #{review.id}
        </h2>
        <ReviewStatusBadge status={review.status} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <UserAvatar
          avatarUrl={review.author.avatar_url}
          avatarKey={review.author.avatar_key}
          size="sm"
        />
        <Link
          className="group inline-flex min-w-0 items-center gap-1.5 rounded-sm font-medium text-text-primary hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          to={`/admin-panel/users/${review.author.id}`}
        >
          <span className="truncate">{authorName}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-text-secondary group-hover:text-primary" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-1 flex items-center gap-2 text-sm">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stroke bg-surface-muted">
          {review.business.cover_photo_url ? (
            <img
              src={review.business.cover_photo_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Store className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          )}
        </span>
        <Link
          className="group inline-flex min-w-0 items-center gap-1.5 rounded-sm font-medium text-text-primary hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          to={`/admin-panel/businesses/${review.business.id}`}
        >
          <span className="truncate">{review.business.name}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-text-secondary group-hover:text-primary" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-text-secondary">
        {(review.business.cluster_name || review.business.category_name) && (
          <div className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
            {review.business.cluster_name && (
              <ClusterDisplay
                clusterName={review.business.cluster_name}
                clusterIcon={clusterIcon}
                variant="small"
              />
            )}
            {review.business.cluster_name && review.business.category_name && (
              <span aria-hidden="true">·</span>
            )}
            {review.business.category_name && (
              <span>{review.business.category_name}</span>
            )}
          </div>
        )}
        <div className="ml-auto inline-flex shrink-0 items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <time dateTime={review.submitted_at}>
            {formatReviewTimestamp(review.submitted_at)}
          </time>
        </div>
      </div>
    </header>
  );
}
