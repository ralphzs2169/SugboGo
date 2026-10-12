import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Clock3,
  ExternalLink,
  Image as ImageIcon,
  Pencil,
  Quote,
  Store,
  ThumbsUp,
  UserRound,
} from "lucide-react";

import Button from "@/shared/components/Button";
import ClusterDisplay from "@/shared/components/ClusterDisplay";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import StatusBadge from "@/shared/components/StatusBadge";
import UserAvatar from "@/shared/components/UserAvatar";
import { formatDateTime, formatRelativeDate } from "@/shared/utils/dateUtils";

import { fetchClusters } from "../../cluster-category/services/clusterCategoryService";
import useUnderReviewReview from "../hooks/useUnderReviewReview";
import UnderReviewFindings from "./UnderReviewFindings";

function DetailPlaceholder({ title, description }) {
  return (
    <div className="flex min-h-[460px] flex-col items-center justify-center px-8 text-center">
      <ShieldIcon />
      <h2 className="mt-4 text-base font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">{description}</p>
    </div>
  );
}

function ShieldIcon() {
  return <UserRound className="h-9 w-9 text-text-secondary" />;
}

function formatHeaderTimestamp(value) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  const day = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${day} · ${time}`;
}

export default function UnderReviewDetail({
  reviewId,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  onStale,
}) {
  const scrollContainerRef = useRef(null);
  const reviewHeaderRef = useRef(null);
  const [showContextBar, setShowContextBar] = useState(false);
  const { review, isLoading, error, refetch } = useUnderReviewReview(reviewId);
  const clusterName = review?.business.cluster_name;
  const { data: clusterResults } = useQuery({
    queryKey: ["admin", "taxonomy", "clusters", "by-name", clusterName],
    queryFn: () => fetchClusters({ search: clusterName, page_size: 100 }),
    enabled: Boolean(clusterName),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const reviewHeader = reviewHeaderRef.current;

    if (!scrollContainer || !reviewHeader) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowContextBar(!entry.isIntersecting);
      },
      {
        root: scrollContainer,
        threshold: 0,
      },
    );

    observer.observe(reviewHeader);

    return () => observer.disconnect();
  }, [review?.id]);

  if (!reviewId) {
    return (
      <DetailPlaceholder
        title="Select a review"
        description="Choose a review from the queue to inspect its content and moderation findings."
      />
    );
  }

  if (isLoading) {
    return (
      <div aria-busy="true" className="space-y-5 p-6">
        <div className="h-6 w-52 animate-pulse rounded bg-surface" />
        <div className="h-24 animate-pulse rounded bg-surface" />
        <div className="h-48 animate-pulse rounded bg-surface" />
      </div>
    );
  }

  if (error) {
    return (
      <DataErrorState
        title="Unable to load this review"
        message="The review may have been resolved by another Admin. Refresh the queue or try again."
        onRetry={() => {
          if (error.response?.status === 404) {
            onStale?.();
          } else {
            refetch();
          }
        }}
      />
    );
  }

  if (!review) {
    return null;
  }

  const authorName = [review.author.first_name, review.author.last_name]
    .filter(Boolean)
    .join(" ");
  const clusterIcon = clusterResults?.items?.find(
    (cluster) => cluster.name === clusterName,
  )?.icon;
  const isSubmitting = isApproving || isRejecting;

  return (
    <div className="flex min-h-[640px] flex-col">
      <div
        className="min-h-0 flex-1 overflow-y-auto lg:max-h-[calc(100vh-250px)]"
        ref={scrollContainerRef}
      >
        <div className="pointer-events-none sticky top-0 z-30 h-0">
          <div
            aria-hidden={!showContextBar}
            className={`flex h-12 items-center justify-between gap-3 border-b border-stroke bg-background/80 px-5 backdrop-blur-md lg:px-6 ${showContextBar ? "opacity-100" : "opacity-0"}`}
          >
            <span className="truncate text-sm font-semibold text-text-primary">
              Review #{review.id}
            </span>
            <StatusBadge variant="info">Under Review</StatusBadge>
          </div>
        </div>
        <header ref={reviewHeaderRef} className="border-b border-stroke bg-background px-5 py-4 lg:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-text-primary">
                Review #{review.id}
              </h2>
              <StatusBadge variant="info">Under Review</StatusBadge>
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
                  {formatHeaderTimestamp(review.submitted_at)}
                </time>
              </div>
            </div>
          </div>
        </header>

        <section className="mx-5 mt-5 rounded-lg border border-stroke bg-surface p-4 lg:mx-6 lg:mt-6">
          <div className="flex items-center gap-2">
            <Quote className="h-3.5 w-3.5 text-text-secondary" strokeWidth={2} aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
              Review content
            </h3>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
            {review.text || "No written review."}
          </p>
          {review.photos.length ? (
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Review photos ({review.photos.length})
                </h3>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {review.photos.map((photo, index) => (
                  <a
                    key={photo.id}
                    href={photo.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-lg border border-stroke focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    aria-label={`Open review photo ${index + 1}`}
                  >
                    <img
                      src={photo.photo_url}
                      alt={`Review photo ${index + 1}`}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <span className="block px-2 py-1 text-xs text-text-secondary">
                      Photo {index + 1}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              {review.like_count ?? 0} {(review.like_count ?? 0) === 1 ? "like" : "likes"}
            </span>
            {review.photos.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {review.photos.length} {review.photos.length === 1 ? "photo" : "photos"}
              </span>
            )}
            {review.is_edited && (
              <span className="inline-flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                {review.edited_at
                  ? `Edited ${formatHeaderTimestamp(review.edited_at)}`
                  : "Edited"}
              </span>
            )}
          </div>
          {review.reply && (
            <div className="mt-6 border-l-2 border-primary bg-surface-muted/40 px-4 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                  Merchant Response
                </h4>
                {review.reply.created_at && (
                  <time
                    dateTime={review.reply.created_at}
                    className="text-xs text-text-secondary"
                    title={formatDateTime(review.reply.created_at)}
                  >
                    {formatRelativeDate(review.reply.created_at)}
                  </time>
                )}
              </div>
              <p className="mt-2 text-xs font-medium text-text-primary">
                {review.business.name}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
                {review.reply.text || "No response content available."}
              </p>
            </div>
          )}
        </section>

        <div className="mx-5 my-6 lg:mx-6">
          <UnderReviewFindings review={review} />
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-stroke bg-background p-4 lg:px-6">
        <Button
          variant="danger-outline"
          onClick={onReject}
          disabled={isSubmitting}
        >
          Reject Review
        </Button>
        <Button
          variant="success"
          onClick={onApprove}
          loading={isApproving}
          disabled={isSubmitting}
        >
          Approve &amp; Publish
        </Button>
      </div>
    </div>
  );
}
