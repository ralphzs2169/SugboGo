import { fireEvent, render } from "@testing-library/react-native";

import type { BusinessReview } from "../../../../types/review.types";
import BusinessReviewCard from "../BusinessReviewCard";

jest.mock("../../../../hooks/useAuthorReviewSource", () => ({
  useAuthorReviewSource: (_businessId: number, review: BusinessReview) =>
    review,
}));
jest.mock("../../../../stores/reviewWorkflow.store", () => ({
  useReviewWorkflowStore: (
    selector: (state: { edits: Record<number, number> }) => unknown,
  ) => selector({ edits: {} }),
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: { user: { id: number } }) => unknown) =>
    selector({ user: { id: 1 } }),
}));

jest.mock("../../../../hooks/useBusinessReviews", () => ({
  useDeleteReview: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useReportReview: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock("../../../../hooks/useReviewLike", () => ({
  useReviewLike: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: jest.fn(),
}));
jest.mock("../ReviewContent", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../MerchantReviewResponse", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/shared/components/bottom-sheets/ActionBottomSheet", () => ({
  __esModule: true,
  default: ({
    options,
    onSelect,
  }: {
    options: { label: string; value: string }[];
    onSelect: (value: string) => void;
  }) => {
    const { Pressable, Text } = jest.requireActual("react-native");
    return options.map((option) => (
      <Pressable key={option.value} onPress={() => onSelect(option.value)}>
        <Text>{option.label}</Text>
      </Pressable>
    ));
  },
}));
jest.mock("../ReportReviewSheet", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../ReviewReportReceiptSheet", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/shared/components/modals/ConfirmModal", () => ({
  __esModule: true,
  default: () => null,
}));

const heldReview = {
  id: 7,
  status: "under_review",
  is_own_review: true,
  reply: null,
  is_liked: false,
} as BusinessReview;

describe("BusinessReviewCard held review", () => {
  it("shows the publication state and keeps delete without edit", async () => {
    const onEdit = jest.fn();
    const screen = await render(
      <BusinessReviewCard
        businessId={20}
        review={heldReview}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText("Under review")).toBeTruthy();
    expect(
      screen.getByText(
        "Your review is saved privately. Its status is not yet confirmed.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Edit my review")).toBeNull();
    expect(screen.getByText("Delete my review")).toBeTruthy();
    fireEvent.press(screen.getByText("Delete my review"));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("shows the persisted view action only for an already reported review", async () => {
    const review = {
      ...heldReview,
      id: 74,
      status: "published",
      is_own_review: false,
      has_reported: false,
    } as BusinessReview;
    const screen = await render(
      <BusinessReviewCard businessId={20} review={review} />,
    );
    expect(screen.getByText("Report review")).toBeTruthy();
    expect(screen.queryByText("View your report")).toBeNull();

    await screen.rerender(
      <BusinessReviewCard
        businessId={20}
        review={{ ...review, has_reported: true }}
      />,
    );
    expect(screen.getByText("View your report")).toBeTruthy();
    expect(screen.queryByText("Report review")).toBeNull();
    screen.unmount();
  });
});
