import { render } from "@testing-library/react-native";

import type { BusinessReview } from "../../../../types/review.types";
import ReviewContent from "../ReviewContent";

jest.mock("@/shared/components/modals/FullScreenPhotoViewer", () => ({
  __esModule: true,
  default: () => null,
}));

const baseReview = {
  text: "The Lechon was great. Best LECHON in Cebu.",
  created_at: "2026-09-28T00:00:00Z",
  author: {
    id: 1,
    first_name: "Ana",
    last_name: "Cruz",
    avatar_url: null,
  },
  photos: [],
} as BusinessReview;

describe("ReviewContent topic highlighting", () => {
  it("highlights every case-insensitive literal match with original casing", async () => {
    const screen = await render(
      <ReviewContent
        review={baseReview}
        highlightedTopic="lechon"
        showEngagement={false}
        showSpecialtyVouches={false}
      />,
    );

    expect(
      screen
        .getAllByTestId("review-topic-highlight")
        .map((match) => match.props.children),
    ).toEqual(["Lechon", "LECHON"]);
  });

  it("does not fabricate a highlight when the literal phrase is absent", async () => {
    const screen = await render(
      <ReviewContent
        review={{
          ...baseReview,
          text: "The staff were welcoming and helpful.",
        }}
        highlightedTopic="friendly staff"
        showEngagement={false}
        showSpecialtyVouches={false}
      />,
    );

    expect(screen.queryAllByTestId("review-topic-highlight")).toHaveLength(0);
    expect(
      screen.getByText("The staff were welcoming and helpful."),
    ).toBeTruthy();
  });
});
