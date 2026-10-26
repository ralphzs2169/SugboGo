import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import ReviewDisputeDetailScreen from "../ReviewDisputeDetailScreen";

const mockDetail = jest.fn();
jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("../../../hooks/review-disputes/useReviewDisputes", () => ({
  useReviewDisputeDetail: () => mockDetail(),
  useAddReviewDisputeEvidence: () => ({ isPending: false }),
  useDeleteReviewDisputeEvidence: () => ({ isPending: false }),
  useWithdrawReviewDispute: () => ({ isPending: false }),
}));
jest.mock(
  "../../../utils/review-disputes/pickReviewDisputeEvidence.utils",
  () => ({
    pickReviewDisputeDocuments: jest.fn(),
    pickReviewDisputeImages: jest.fn(),
  }),
);
jest.mock(
  "../../../components/review-disputes/dispute-detail-screen/ReviewDisputedReviewSection",
  () => () => null,
);
jest.mock(
  "../../../components/review-disputes/dispute-detail-screen/ReviewDisputeStickyHeader",
  () => () => null,
);
jest.mock(
  "../../../components/review-disputes/dispute-detail-screen/ReviewDisputeOverviewSection",
  () => () => null,
);
jest.mock(
  "../../../components/review-disputes/dispute-detail-screen/ReviewDisputeEvidenceSection",
  () => () => null,
);
jest.mock(
  "../../../components/review-disputes/dispute-detail-screen/ReviewDisputeHistorySection",
  () => () => null,
);
jest.mock("@/shared/components/modals/ConfirmModal", () => () => null);
const dispute = {
  id: 7,
  business_id: 8,
  status: "pending",
  evidence: [],
  previous_disputes: [],
  review: {},
  attempt_number: 1,
};

describe("dispute detail cached recovery", () => {
  it("retains cached content and safe actions until a successful targeted retry", async () => {
    const refetch = jest.fn();
    mockDetail.mockReturnValue({
      dispute,
      isLoading: false,
      error: { code: "NETWORK_ERROR" },
      refetch,
    });
    const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);
    expect(screen.getByText("Withdraw dispute")).toBeTruthy();
    expect(screen.getByText("Unable to refresh dispute")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: /Tap to retry/i }),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    mockDetail.mockReturnValue({
      dispute,
      isLoading: false,
      error: null,
      refetch,
    });
    await screen.rerender(<ReviewDisputeDetailScreen disputeId={7} />);
    expect(screen.queryByText("Unable to refresh dispute")).toBeNull();
  });
  it.each(["NOT_FOUND", "PERMISSION_DENIED"])(
    "hides stale content for %s",
    async (code) => {
      mockDetail.mockReturnValue({
        dispute,
        isLoading: false,
        error: { code },
        refetch: jest.fn(),
      });
      const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);
      expect(screen.queryByText("Withdraw dispute")).toBeNull();
      expect(screen.getByText("Unable to load dispute")).toBeTruthy();
    },
  );
  it("shows full persistent recovery on initial failure", async () => {
    mockDetail.mockReturnValue({
      dispute: null,
      isLoading: false,
      error: { code: "NETWORK_ERROR" },
      refetch: jest.fn(),
    });
    const screen = await render(<ReviewDisputeDetailScreen disputeId={7} />);
    expect(screen.getByText("Unable to load dispute")).toBeTruthy();
  });
});
