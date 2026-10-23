import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import Button from "@/shared/components/Button";
import { useCachedReviewPreview } from "../../../hooks/useAuthorReviewSource";
import { useAuthorReviewSubmissions } from "../../../hooks/useAuthorReviewSubmissions";
import {
  settleReviewSubmission,
  useReviewWorkflowStore,
  type ReviewSubmissionDraft,
} from "../../../stores/reviewWorkflow.store";
import { reviewModerationFeedback } from "../../../utils/reviewModeration.utils";
import ReviewContent from "./ReviewContent";

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
    data?.user_review?.author.id === draft.userId ? data.user_review : null;
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
    if ((draft.state !== "confirming" && draft.state !== "failed") || !server)
      return;
    settleReviewSubmission(draft.token, {
      id: server.id,
      business_id: draft.businessId,
      user_id: draft.userId,
      status: server.status,
      moderation_progress: server.moderation_progress,
    });
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

  const feedback = server
    ? reviewModerationFeedback(server)
    : draft.result
      ? reviewModerationFeedback(draft.result)
      : draft.state === "submitting"
        ? {
            label: "Submitting",
            description:
              "Only you can see this. Your review hasn't been confirmed yet.",
          }
        : draft.state === "failed"
          ? {
              label: "Not submitted",
              description:
                "Your draft is kept here. Open the review to try again.",
            }
          : {
              label: "Still confirming",
              description:
                "We haven't confirmed your submission yet. Check your review before trying again.",
            };
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
      {/* Quiet private status; ordinary published reviews have no badge. */}
      {(server?.status ?? draft.result?.status) !== "published" && (
        <View
          accessibilityLiveRegion="polite"
          className="mt-3 rounded-lg bg-surface-secondary px-3 py-2"
        >
          <View className="flex-row items-center gap-2">
            {draft.state === "submitting" && !server && (
              <ActivityIndicator
                size="small"
                color={theme.extends.colors.text.secondary}
              />
            )}
            <AppText weight="semibold" className="text-xs text-text-primary">
              {feedback.label}
            </AppText>
          </View>
          <AppText className="mt-1 text-xs text-text-secondary">
            {feedback.description}
          </AppText>
          {draft.state === "failed" && !server && onResume && (
            <Button
              title="Continue review"
              onPress={onResume}
              variant="soft"
              size="sm"
              rounded="full"
              className="mt-2 self-start"
            />
          )}
        </View>
      )}
    </View>
  );
}
