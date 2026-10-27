import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import MerchantReviewCard from "../MerchantReviewCard";
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("@/features/explore/hooks/useReviewLike", () => ({
  useReviewLike: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock("../../../hooks/review-reply/useReviewReplies", () => ({
  useDeleteReviewReply: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock(
  "@/shared/components/bottom-sheets/ActionBottomSheet",
  () => () => null,
);
jest.mock("@/shared/components/modals/ConfirmModal", () => () => null);
jest.mock(
  "@/features/explore/components/business-profile/reviews/ReviewContent",
  () => () => null,
);
jest.mock(
  "@/features/explore/components/business-profile/reviews/MerchantReviewResponse",
  () => () => null,
);
const review = { id: 7, active_dispute_id: 12, reply: null } as any;
test("pending dispute keeps its text and navigation with shared typography and valid tokens", async () => {
  const screen = await render(
    <MerchantReviewCard businessId={8} review={review} onReply={jest.fn()} />,
  );
  expect(screen.getByText("Awaiting administrator review")).toBeTruthy();
  const text = screen.getByText("Dispute pending");
  expect(text.props.className).toContain("text-text-info");
  expect(text.props.className).toContain("font-nunito");
  const banner = screen.getByRole("button", {
    name: "View pending review dispute",
  });
  expect(banner.props.className).toContain("bg-info");
  expect(banner.props.className).not.toContain("bg-info-muted");
  await fireEvent.press(banner);
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/(merchant)/review-disputes/[disputeId]",
    params: { disputeId: "12" },
  });
});
test("no dispute banner is rendered without pending state", async () => {
  const screen = await render(
    <MerchantReviewCard
      businessId={8}
      review={{ ...review, active_dispute_id: null }}
      onReply={jest.fn()}
    />,
  );
  expect(screen.queryByText("Dispute pending")).toBeNull();
});
