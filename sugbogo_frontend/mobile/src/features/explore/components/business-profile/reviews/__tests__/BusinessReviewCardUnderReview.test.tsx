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
  it.each(["pending", "processing", "awaiting_retry"] as const)(
    "keeps %s checks inline and private",
    async (state) => {
      const message =
        state === "awaiting_retry"
          ? "Taking a little longer than usual · Only you can see this"
          : "Checking before publishing · Only you can see this";
      const screen = await render(
        <BusinessReviewCard
          businessId={20}
          review={{ ...heldReview, moderation_progress: { state } }}
        />,
      );
      expect(screen.getByText(message)).toBeTruthy();
      expect(screen.queryByText("Checking")).toBeNull();
      expect(screen.queryByText("Delayed")).toBeNull();
      expect(
        screen.queryByText(
          "We're checking your review before it appears publicly.",
        ),
      ).toBeNull();

      await screen.rerender(
        <BusinessReviewCard
          businessId={20}
          review={{
            ...heldReview,
            is_own_review: false,
            moderation_progress: { state },
          }}
        />,
      );
      expect(screen.queryByText(message)).toBeNull();
    },
  );

  it.each([
    ["flagged", "awaiting_admin_review", "Under review"],
    ["under_review", "retries_exhausted", "Needs review"],
    ["rejected", "rejected", "Not published"],
  ] as const)("preserves %s / %s feedback", async (status, state, label) => {
    const screen = await render(
      <BusinessReviewCard
        businessId={20}
        review={{ ...heldReview, status, moderation_progress: { state } }}
      />,
    );
    expect(screen.getByText(label)).toBeTruthy();
    expect(
      screen.queryByText("Checking before publishing · Only you can see this"),
    ).toBeNull();
  });

  it("does not add a status badge to a published review", async () => {
    const screen = await render(
      <BusinessReviewCard
        businessId={20}
        review={{ ...heldReview, status: "published" }}
      />,
    );
    expect(screen.queryByText("Published")).toBeNull();
    expect(
      screen.queryByText("Checking before publishing · Only you can see this"),
    ).toBeNull();
  });

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
