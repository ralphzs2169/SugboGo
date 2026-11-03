import { useState } from "react";
import { Eye } from "lucide-react";
import Button from "@/shared/components/Button";
import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import BusinessDetailSkeleton from "./BusinessDetailSkeleton";
import BusinessDetailHero from "./BusinessDetailHero";
import BusinessDetailMetrics from "./BusinessDetailMetrics";
import ReviewInsightsCard from "./ReviewInsightsCard";
import BusinessReviewsPreview from "./review-preview-section/BusinessReviewsPreview";
import BusinessPhotosPreview from "./BusinessPhotosPreview";
import BusinessAdministrativeHistory from "./BusinessAdministrativeHistory";
import BusinessApplicationSummary from "./BusinessApplicationSummary";
import {
  businessFixture,
  historyFixture,
  visitsFixture,
} from "./businessDetail.fixtures";

const PREVIEW_STATES = [
  ["live", "Live data"],
  ["ready", "Ready · populated"],
  ["loading", "Initial loading"],
  ["unavailable", "Page unavailable"],
  ["empty", "Empty · no reviews, photos or application"],
  ["insufficient", "Insufficient reviews"],
  ["processing", "Insights processing · retained content"],
  ["retry_wait", "Insights retry wait"],
  ["outdated", "Insights outdated"],
  ["insights_failed", "Insights unavailable"],
  ["rating_unavailable", "Rating unavailable"],
  ["rating_disabled", "Rating disabled"],
  ["analytics_unavailable", "Profile visits unavailable"],
  ["history_unavailable", "History unavailable"],
  ["refresh_failed", "Background refresh failed"],
  ["suspended", "Suspended business"],
  ["photo_1", "Gallery · 1 photo"],
  ["photo_2", "Gallery · 2 photos"],
  ["photo_3", "Gallery · 3 photos"],
  ["broken_images", "Images unavailable"],
];

/** Switch between the live page and isolated visual fixtures in development only. */
export default function BusinessDetailPreview({ renderLive }) {
  const [mode, setMode] = useState("live");
  const reset = () => setMode("ready");

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-stroke bg-surface-muted p-4">
        <label
          htmlFor="business-detail-preview"
          className="flex items-center gap-2 text-sm font-semibold text-text-primary"
        >
          <Eye aria-hidden="true" className="h-4 w-4" />
          Preview state
        </label>
        <select
          id="business-detail-preview"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          className="min-w-0 max-w-full cursor-pointer rounded-lg border border-stroke bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-info"
        >
          {PREVIEW_STATES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {mode !== "live" && (
          <Button variant="secondary" size="sm" onClick={() => setMode("live")}>
            Return to live data
          </Button>
        )}
        <p className="w-full text-xs text-text-secondary" role="status">
          {mode === "live"
            ? "Development preview controls. Currently showing the real business."
            : "Preview only: synthetic data. This page’s live fetching is paused. Maps and navigation are inactive; actions do not change real records."}
        </p>
      </div>
      {mode === "live" ? (
        renderLive()
      ) : (
        <PreviewContent key={mode} mode={mode} onReset={reset} />
      )}
    </>
  );
}

/** Build disposable display snapshots without fetching or mutating business records. */
function createSnapshot(mode) {
  const business = businessFixture();
  const visits = {
    data: visitsFixture(),
    isPending: false,
    isFetching: false,
    error: null,
  };
  const history = {
    data: { pages: [historyFixture(1), historyFixture(2)] },
    isPending: false,
    isFetching: false,
    error: null,
    hasNextPage: false,
  };

  if (mode === "empty" || mode === "insufficient") {
    const count = mode === "empty" ? 0 : 1;
    business.sentiment_rating = {
      ...business.sentiment_rating,
      state: "insufficient_data",
      value: null,
      contributing_review_count: count,
    };
    business.review_insights = {
      ...business.review_insights,
      state: "insufficient_reviews",
      state_message: "At least five eligible recent reviews are required.",
      content_available: false,
      narrative: null,
      frequent_mentions: [],
      eligible_review_count: count,
      analyzed_review_count: 0,
      generated_at: null,
    };
    business.published_review_count = count;
    business.review_insight_regeneration.content_available = false;
    business.review_insight_regeneration.content_is_current = false;
  }

  if (mode === "empty") {
    business.photos = [];
    business.latest_reviews = [];
    business.application = null;
    business.operating_hours = [];
    business.cover_photo_url = null;
    business.current_specialty_vouch_count = 0;
    business.current_saved_count = 0;
    business.current_specialty_support = business.current_specialty_support.map(
      (tag) => ({ ...tag, valid_vouches: 0, distinct_supporters: 0 }),
    );
    business.specialty_tags = business.specialty_tags.map(
      (tag) => ({ ...tag, vouch_count: 0 }),
    );
    visits.data = visitsFixture(0);
    history.data = { pages: [{ items: [] }] };
  }

  if (mode === "processing" || mode === "retry_wait") {
    business.review_insight_regeneration = {
      ...business.review_insight_regeneration,
      status: mode,
      is_outstanding: true,
    };
    business.review_insights.state = "outdated";
    business.sentiment_rating.state = "pending";
  }

  if (mode === "outdated") {
    business.review_insights.state = "outdated";
    business.review_insights.state_message = "Newer reviews are not included in this content yet.";
  }

  if (mode === "insights_failed") {
    business.review_insights = {
      ...business.review_insights,
      state: "unavailable",
      content_available: false,
      narrative: null,
      frequent_mentions: [],
      state_message: "Review insights could not be generated. Please try again.",
    };
  }

  if (mode === "rating_unavailable") {
    business.sentiment_rating.state = "unavailable";
    business.sentiment_rating.value = null;
  }
  if (mode === "rating_disabled") {
    business.sentiment_rating_enabled = false;
  }
  if (mode === "analytics_unavailable") {
    visits.data = visitsFixture(null);
  }
  if (mode === "history_unavailable") {
    history.data = undefined;
    history.error = new Error("Preview: history unavailable");
  }
  if (mode === "suspended") {
    business.status = "suspended";
  }
  if (mode.startsWith("photo_")) {
    business.photos = business.photos.slice(0, Number(mode.slice(-1)));
  }
  if (mode === "broken_images") {
    business.cover_photo_url = null;
    business.photos = business.photos.map((photo) => ({ ...photo, photo_url: null }));
  }

  return { business, visits, history };
}

/** Render the existing cards with local-only retry and refresh interactions. */
function PreviewContent({ mode, onReset }) {
  const [syncState, setSyncState] = useState(
    mode === "processing" || mode === "retry_wait" ? "observing" : "idle",
  );
  const { business, visits, history } = createSnapshot(mode);
  const status = {
    data: {
      status: business.status,
      suspension_reason: "Preview suspension reason: listing information needs review.",
    },
    refetch: onReset,
  };
  const refreshPreview = async () => ({
    message: "Preview only: no refresh request was sent.",
  });

  return (
    <div
      onClickCapture={(event) => {
        if (event.target.closest("a")) event.preventDefault();
      }}
    >
      <DetailPageLayout
        title="Business Details · Preview"
        backLabel="Return to ready preview"
        onBack={onReset}
        isLoading={mode === "loading"}
        hasData={mode !== "unavailable"}
        error={mode === "unavailable" ? new Error("Preview unavailable") : null}
        errorTitle="Business unavailable"
        errorMessage="Preview of the initial load failure. Retry returns to the ready preview."
        onRetry={onReset}
        loadingContent={<BusinessDetailSkeleton />}
      >
        <div className="min-w-0 space-y-6 sm:space-y-8">
          {mode === "refresh_failed" && (
            <DataErrorState
              compact
              title="Business refresh failed"
              message="The last successfully loaded details remain visible."
              onRetry={onReset}
            />
          )}
          <BusinessDetailHero
            business={business}
            statusInfo={status}
            onOpenLocation={() => {}}
          />
          <section aria-label="Business engagement preview">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
              Business Engagement
            </h2>
            <BusinessDetailMetrics
              business={business}
              visits={{ ...visits, refetch: onReset }}
            />
          </section>
          <ReviewInsightsCard
            business={business}
            syncState={syncState}
            onObserve={() => setSyncState("complete")}
            requestRefresh={refreshPreview}
          />
          <section aria-label="Reviews and photo gallery preview">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
              Recent Reviews & Photo Gallery
            </h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="min-w-0 lg:col-span-3">
                <BusinessReviewsPreview
                  reviews={business.latest_reviews}
                  businessId={business.id}
                  totalReviews={business.total_review_count}
                />
              </div>
              <div className="min-w-0 self-start lg:col-span-2">
                <BusinessPhotosPreview
                  photos={business.photos}
                  businessName={business.business_name}
                />
              </div>
            </div>
          </section>
          <BusinessAdministrativeHistory
            businessId={business.id}
            history={{ ...history, refetch: onReset }}
          />
          <BusinessApplicationSummary application={business.application} />
        </div>
      </DetailPageLayout>
    </div>
  );
}
