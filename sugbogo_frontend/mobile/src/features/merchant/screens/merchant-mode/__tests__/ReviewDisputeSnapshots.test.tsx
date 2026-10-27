import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { router } from "expo-router";

import * as InfoBannerModule from "@/shared/components/InfoBanner";
import { resolveNotificationDestination } from "@/features/notifications/utils/notificationDestination";
import type { ReviewDisputeDetail } from "../../../types/review-disputes/reviewDispute.types";
import { pickReviewDisputeImages } from "../../../utils/review-disputes/pickReviewDisputeEvidence.utils";
import ReviewDisputeDetailScreen from "../ReviewDisputeDetailScreen";
import ReviewDisputesScreen from "../ReviewDisputesScreen";

const mockDetail = jest.fn();
const mockCollection = jest.fn();
const mockAddEvidence = jest.fn();
const mockDeleteEvidence = jest.fn();
const mockWithdraw = jest.fn();
const mockReviewContent = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-image", () => ({ Image: jest.requireActual("react-native").View }));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/shared/components/Avatar", () => () => null);
jest.mock("@/shared/components/modals/FullScreenPhotoViewer", () => () => null);
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({ useTabBarSpacing: () => 20 }));
jest.mock("../../../hooks/review-disputes/useReviewDisputes", () => ({
  useReviewDisputeDetail: (id: number) => mockDetail(id),
  useReviewDisputes: () => mockCollection(),
  useAddReviewDisputeEvidence: () => ({ isPending: false, mutateAsync: mockAddEvidence }),
  useDeleteReviewDisputeEvidence: () => ({ isPending: false, mutateAsync: mockDeleteEvidence }),
  useWithdrawReviewDispute: () => ({ isPending: false, mutateAsync: mockWithdraw }),
}));
jest.mock("../../../utils/review-disputes/pickReviewDisputeEvidence.utils", () => ({
  pickReviewDisputeImages: jest.fn(),
  pickReviewDisputeDocuments: jest.fn(),
}));
jest.mock("@/features/explore/components/business-profile/reviews/ReviewContent", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockReviewContent({ review }: { review: { text: string } }) {
    mockReviewContent(review);
    return <Text>{review.text}</Text>;
  };
});
jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return function MockConfirmModal({
    visible,
    title,
    confirmText,
    onConfirm,
    onCancel,
  }: {
    visible: boolean;
    title: string;
    confirmText: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) {
    return visible ? (
      <View>
        <Text>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={confirmText} onPress={onConfirm}>
          <Text>{confirmText}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel confirmation" onPress={onCancel}>
          <Text>Cancel confirmation</Text>
        </Pressable>
      </View>
    ) : null;
  };
});

function dispute(overrides: Partial<ReviewDisputeDetail> = {}): ReviewDisputeDetail {
  return {
    id: 7,
    review_id: 42,
    business_id: 8,
    status: "pending",
    reason: "fake_review",
    description: "My original dispute explanation.",
    attempt_number: 2,
    admin_notes: null,
    resolved_at: null,
    closure_reason: "",
    created_at: "2026-10-10T04:00:00Z",
    updated_at: "2026-10-10T04:00:00Z",
    material_content_changed: false,
    evidence: [],
    previous_dispute_count: 0,
    previous_disputes: [],
    review: {
      id: 42,
      text: "Current published review.",
      status: "published",
      created_at: "2026-10-09T04:00:00Z",
      author: { id: 5, first_name: "Ana", last_name: "Cruz", avatar_url: null },
      photos: [],
    },
    ...overrides,
  };
}

const evidence = {
  id: 12,
  type: "document" as const,
  file_name: "receipt.pdf",
  url: "https://example.com/receipt.pdf",
  created_at: "2026-10-10T05:00:00Z",
};

function setDetail(value: ReviewDisputeDetail) {
  mockDetail.mockReturnValue({
    dispute: value,
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch: jest.fn(),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAddEvidence.mockResolvedValue(undefined);
  mockDeleteEvidence.mockResolvedValue(undefined);
  mockWithdraw.mockResolvedValue(undefined);
  setDetail(dispute());
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("merchant dispute snapshot compatibility", () => {
  it.each([
    ["author_deleted", "Review Deleted"],
    ["review_removed", "Review Removed"],
  ] as const)("shows %s as a closed case while retaining evidence and explanation", async (status, title) => {
    setDetail(dispute({
      status,
      review: null,
      business_id: null,
      resolved_at: "2026-10-11T04:00:00Z",
      material_content_changed: true,
      evidence: [evidence],
    }));
    const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);

    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    expect(screen.getByText(/closed without an administrator decision/)).toBeTruthy();
    expect(screen.getByText("My original dispute explanation.")).toBeTruthy();
    expect(screen.getByText("Review #42")).toBeTruthy();
    expect(screen.getByText("receipt.pdf")).toBeTruthy();
    expect(screen.queryByText("Withdrawn")).toBeNull();
    expect(screen.queryByText("Withdraw dispute")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add evidence images" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add evidence documents" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete receipt.pdf" })).toBeNull();
    expect(screen.queryByText("Review updated")).toBeNull();
    expect(mockReviewContent).not.toHaveBeenCalled();
    await fireEvent.press(screen.getAllByRole("button", { name: "Open receipt.pdf" })[0]);
    expect(Linking.openURL).toHaveBeenCalledWith(evidence.url);
  });

  it("reuses InfoBanner's existing informational variant for an active changed review", async () => {
    const banner = jest.spyOn(InfoBannerModule, "default");
    setDetail(dispute({ material_content_changed: true }));
    const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);

    expect(banner.mock.calls.map(([props]) => props)).toContainEqual(
      expect.objectContaining({ title: "Review updated", variant: "info" }),
    );
    expect(screen.getByText(
      "The reviewer has updated their review since you submitted this dispute. Your dispute remains active, and the original content has been preserved for administrator review.",
    )).toBeTruthy();
    expect(screen.getByText("Withdraw dispute")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add evidence images" })).toBeTruthy();
  });

  it.each([false, null])("does not infer a change when the API indicator is %s", async (changed) => {
    setDetail(dispute({
      material_content_changed: changed,
      updated_at: "2026-10-15T04:00:00Z",
    }));
    const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);
    expect(screen.queryByText("Review updated")).toBeNull();
    expect(screen.getByText("Current published review.")).toBeTruthy();
  });

  it.each(["upheld", "dismissed", "withdrawn"] as const)("preserves %s history without claiming the dispute is active", async (status) => {
    setDetail(dispute({
      status,
      material_content_changed: true,
      resolved_at: "2026-10-11T04:00:00Z",
      admin_notes: "The administrator's original decision explanation.",
    }));
    const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);
    expect(screen.queryByText("Review updated")).toBeNull();
    expect(screen.queryByText("Withdraw dispute")).toBeNull();
    expect(screen.getByText("The administrator's original decision explanation.")).toBeTruthy();
  });

  it("keeps previous attempts navigable when the review and retained identifiers are unavailable", async () => {
    setDetail(dispute({
      review: null,
      review_id: null,
      business_id: null,
      status: "review_removed",
      previous_dispute_count: 1,
      previous_disputes: [{
        id: 3,
        status: "author_deleted",
        reason: "fake_review",
        description: "Earlier explanation.",
        admin_notes: null,
        resolved_at: "2026-10-08T04:00:00Z",
        created_at: "2026-10-07T04:00:00Z",
        evidence: [],
      }],
    }));
    const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);
    expect(screen.getByText("Review no longer available")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "View dispute attempt 1" }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(merchant)/review-disputes/[disputeId]",
      params: { disputeId: "3" },
    });
  });

  it("opens a deleted-review dispute from its retained notification target", async () => {
    const destination = resolveNotificationDestination({ target_type: "review_dispute", target_id: 7 });
    expect(destination.kind).toBe("destination");
    if (destination.kind !== "destination") {
      throw new Error("Expected an existing dispute destination");
    }
    expect(destination.destination.href).toEqual({
      pathname: "/(merchant)/review-disputes/[disputeId]",
      params: { disputeId: "7" },
    });
    setDetail(dispute({ review: null, status: "author_deleted" }));
    const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);
    expect(mockDetail).toHaveBeenCalledWith(7);
    expect(screen.getByText("My original dispute explanation.")).toBeTruthy();
    expect(screen.queryByText("Unable to load dispute")).toBeNull();
  });

  it("retains pending withdrawal and evidence removal behavior", async () => {
    setDetail(dispute({ evidence: [evidence] }));
    const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete receipt.pdf" }));
    await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mockDeleteEvidence).toHaveBeenCalledWith({ disputeId: 7, evidenceId: 12 }));
    await fireEvent.press(screen.getByText("Withdraw dispute"));
    await fireEvent.press(screen.getByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(mockWithdraw).toHaveBeenCalledWith({ disputeId: 7 }));
  });

  it("invalidates an already-open confirmation when the case closes", async () => {
    const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);
    await fireEvent.press(screen.getByText("Withdraw dispute"));
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeTruthy();
    setDetail(dispute({ status: "author_deleted", review: null }));
    await screen.rerender(<ReviewDisputeDetailScreen disputeId={7} />);
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
    expect(mockWithdraw).not.toHaveBeenCalled();
  });

  it("does not finalize a picker upload after the dispute has closed", async () => {
    let finishPicking: (value: Awaited<ReturnType<typeof pickReviewDisputeImages>>) => void;
    jest.mocked(pickReviewDisputeImages).mockReturnValueOnce(new Promise((resolve) => {
      finishPicking = resolve;
    }));
    const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);
    await fireEvent.press(screen.getByRole("button", { name: "Add evidence images" }));
    setDetail(dispute({ status: "review_removed", review: null }));
    await screen.rerender(<ReviewDisputeDetailScreen disputeId={7} />);
    await act(async () => finishPicking!([{
      uri: "file:///evidence.jpg",
      type: "image",
      fileName: "evidence.jpg",
      mimeType: "image/jpeg",
    }]));
    expect(mockAddEvidence).not.toHaveBeenCalled();
  });

  it("does not offer editing for a missing live review even if a stale status says pending", async () => {
    setDetail(dispute({ review: null, material_content_changed: true }));
    const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);
    expect(screen.queryByText("Withdraw dispute")).toBeNull();
    expect(screen.queryByText("Review updated")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add evidence images" })).toBeNull();
  });

  it.each([42, null])("keeps deleted-review list entries accessible with retained review ID %s", async (reviewId) => {
    const item = dispute({ status: "author_deleted", review: null, review_id: reviewId, business_id: null });
    mockCollection.mockReturnValue({
      disputes: [item],
      hasData: true,
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      fetchNextPage: jest.fn(),
    });
    const screen = await render(<ReviewDisputesScreen />);
    expect(screen.getByText("Dispute attempt 2")).toBeTruthy();
    const identity = reviewId ? `Review #${reviewId}` : "Review no longer available";
    await fireEvent.press(screen.getByRole("button", { name: `Open dispute attempt 2 for ${identity}` }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(merchant)/review-disputes/[disputeId]",
      params: { disputeId: "7" },
    });
  });
});
