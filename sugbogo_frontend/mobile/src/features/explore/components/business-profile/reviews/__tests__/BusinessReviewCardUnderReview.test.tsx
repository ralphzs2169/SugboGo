import { fireEvent, render } from "@testing-library/react-native";

import type { BusinessReview } from "../../../../types/review.types";
import BusinessReviewCard from "../BusinessReviewCard";

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
  default: ({ options, onSelect }: {
    options: { label: string; value: string }[];
    onSelect: (value: string) => void;
  }) => {
    const { Pressable, Text } = require("react-native");
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
      screen.getByText("We're reviewing this before it appears publicly."),
    ).toBeTruthy();
    expect(screen.queryByText("Edit my review")).toBeNull();
    expect(screen.getByText("Delete my review")).toBeTruthy();
    fireEvent.press(screen.getByText("Delete my review"));
    expect(onEdit).not.toHaveBeenCalled();
  });
});
