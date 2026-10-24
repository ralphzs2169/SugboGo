import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import type { BusinessReview } from "../../../types/review.types";
import { useCachedReviewPreview } from "../../../hooks/useAuthorReviewSource";
import { useAuthorReviewSubmissions } from "../../../hooks/useAuthorReviewSubmissions";
import {
  checkReviewSubmissionAgain,
  confirmReviewSubmission,
  matchesReviewSubmission,
  useReviewWorkflowStore,
  type ReviewSubmissionDraft,
} from "../../../stores/reviewWorkflow.store";
import ReviewContent from "./ReviewContent";
import AuthorReviewStatus from "./AuthorReviewStatus";

type Props = {
  businessId?: number;
  representedIds?: number[];
  showBusiness?: boolean;
  onResume?: () => void;
};

/** Reuses ordinary review content for private, session-local submission feedback. */
export default function AuthorReviewSubmissions(props: Props) {
  const drafts = useAuthorReviewSubmissions(props.businessId);
  return (
    <>
      {drafts.map((draft) => (
        <Submission key={draft.token} draft={draft} {...props} />
      ))}
    </>
  );
}

/** Server-confirmed content replaces the local snapshot as soon as it is read. */
function Submission({
  draft,
  representedIds = [],
  showBusiness = false,
  onResume,
}: Props & { draft: ReviewSubmissionDraft }) {
  // Subscribe to the existing cache; R6.1 owns all polling and recovery.
  const data = useCachedReviewPreview(draft.businessId);
  const server =
    data?.user_review &&
    matchesReviewSubmission(draft, data.user_review, draft.businessId)
      ? data.user_review
      : null;
  useEffect(() => {
    if (server && !draft.serverObserved) {
      useReviewWorkflowStore.setState((current) => ({
        submissions: current.submissions.map((item) =>
          item.token === draft.token ? { ...item, serverObserved: true } : item,
        ),
      }));
    }
    if (!server && data?.user_review === null && draft.serverObserved) {
      // A confirmed server record has since disappeared; don't revive its draft.
      useReviewWorkflowStore.setState((current) => ({
        submissions: current.submissions.filter(
          (item) => item.token !== draft.token,
        ),
      }));
    }
    if (server) confirmReviewSubmission(server, draft.businessId);
  }, [
    draft.state,
    draft.token,
    draft.businessId,
    draft.userId,
    draft.serverObserved,
    data,
    server,
  ]);
  if (draft.serverObserved && !server) return null;
  if (server && representedIds.includes(server.id)) return null;
  if (draft.result && representedIds.includes(draft.result.id)) return null;

  return (
    <ReviewSubmissionCard
      draft={draft}
      server={server}
      showBusiness={showBusiness}
      onResume={
        onResume ??
        (() =>
          router.push({
            pathname: "/(explorer)/business/[businessId]",
            params: { businessId: String(draft.businessId) },
          }))
      }
      onCheckAgain={() => checkReviewSubmissionAgain(draft.token)}
    />
  );
}

/** Renders submission feedback without subscribing to or changing workflow state. */
export function ReviewSubmissionCard({
  draft,
  server = null,
  showBusiness = false,
  onResume,
  onCheckAgain,
}: {
  draft: ReviewSubmissionDraft;
  server?: BusinessReview | null;
  showBusiness?: boolean;
  onResume?: () => void;
  onCheckAgain?: () => void;
}) {
  const moderatedReview = server ?? draft.result;
  const content = server ?? {
    author: draft.author,
    text: draft.text,
    created_at: draft.createdAt,
    photos: draft.photos.map((photo, index) => ({
      id: index,
      photo_url: photo.uri,
    })),
    is_own_review: true,
  };

  return (
    <View
      testID="author-review-submission"
      className="border-t border-border-primary bg-surface px-4 py-5"
    >
      {/* Optional history context */}
      {showBusiness && (
        <SafePressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${draft.businessName} business profile`}
          onPress={() =>
            router.push({
              pathname: "/(explorer)/business/[businessId]",
              params: { businessId: String(draft.businessId) },
            })
          }
          className="min-h-11 justify-center"
        >
          <AppText weight="semibold" className="text-sm text-text-primary">
            {draft.businessName}
          </AppText>
        </SafePressable>
      )}
      <ReviewContent
        review={content}
        showEngagement={false}
        showSpecialtyVouches={false}
      />
      {/* Author-only status and recovery actions */}
      <AuthorReviewStatus
        review={moderatedReview}
        submissionState={draft.state}
        onResume={onResume}
        onCheckAgain={onCheckAgain}
      />
    </View>
  );
}
