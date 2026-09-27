import { fireEvent, render, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";

import { handleSystemError } from "@/shared/utils/apiErrors";

import InterestsSection from "../UserInterestsSection";
import useRecommendations from "../../../hooks/useRecommendations";
import type {
  ExploreBusiness,
  RecommendationBusiness,
  RecommendationReason,
} from "../../../types/exploreBusiness.types";

const mockBusinessCard = jest.fn(
  ({
    business,
    onPress,
  }: {
    business: ExploreBusiness;
    onPress: () => void;
  }) => {
    const { Pressable, Text } = jest.requireActual("react-native");

    return (
      <Pressable
        testID={`shared-business-card-${business.id}`}
        onPress={onPress}
      >
        <Text>{business.business_name}</Text>
      </Pressable>
    );
  },
);

jest.mock("../../../hooks/useRecommendations");
jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));
jest.mock("../../new-businesses/BusinessCard", () => ({
  __esModule: true,
  default: (props: unknown) => mockBusinessCard(props as never),
}));
jest.mock("@/shared/components/ErrorState", () => ({
  __esModule: true,
  default: ({ onPrimaryAction }: { onPrimaryAction: () => void }) => {
    const { Pressable, Text } = jest.requireActual("react-native");

    return (
      <Pressable testID="recommendations-retry" onPress={onPrimaryAction}>
        <Text>Retry</Text>
      </Pressable>
    );
  },
}));

function createBusiness(
  id: number,
  name: string,
  recommendationReason: RecommendationReason | null = null,
): RecommendationBusiness {
  return {
    id,
    business_name: name,
    cover_photo_url: null,
    review_count: 0,
    overall_vibe: null,
    is_pocketed: false,
    cluster: { id: 1, name: "Culinary", icon: "utensils" },
    category: { id: 8, name: "Cafe" },
    specialty_tags: [],
    location: {
      address: "Cebu",
      city: "Cebu City",
      province: "Cebu",
      latitude: 10.31,
      longitude: 123.89,
    },
    recommendation_reason: recommendationReason,
  };
}

function createImpressions() {
  return {
    onViewportLayout: jest.fn(),
    onSectionLayout: jest.fn(),
    onListLayout: jest.fn(),
    onVerticalScroll: jest.fn(),
    onHorizontalScroll: jest.fn(),
    onCardLayout: jest.fn(),
    retainBusinesses: jest.fn(),
  };
}

async function renderSection() {
  return render(
    <InterestsSection
      impressions={createImpressions()}
      userLocation={null}
      onBusinessPress={jest.fn()}
    />,
  );
}

describe("Based on Your Interests", () => {
  beforeEach(() => {
    mockBusinessCard.mockClear();
  });

  it("reuses BusinessCard and preserves backend order", async () => {
    const reason: RecommendationReason = {
      type: "specialty_tag",
      id: 14,
      label: "Local Coffee",
    };
    (useRecommendations as jest.Mock).mockReturnValue({
      businesses: [
        createBusiness(22, "Backend First", reason),
        createBusiness(4, "Backend Second"),
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await renderSection();
    const cards = screen.getAllByTestId(/shared-business-card-/);

    expect(screen.getByText("Based on Your Interests")).toBeTruthy();
    expect(screen.getByText("Places matched to what you enjoy.")).toBeTruthy();
    expect(cards.map((card) => card.props.testID)).toEqual([
      "shared-business-card-22",
      "shared-business-card-4",
    ]);
    expect(mockBusinessCard).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        recommendationReason: reason,
        variant: "compact",
      }),
    );
    await screen.unmount();
  });

  it("shows loading and successful-empty states independently", async () => {
    (useRecommendations as jest.Mock).mockReturnValue({
      businesses: [],
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });
    const loading = await renderSection();
    expect(loading.getByTestId("recommendations-loading")).toBeTruthy();
    await loading.unmount();

    (useRecommendations as jest.Mock).mockReturnValue({
      businesses: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const empty = await renderSection();
    expect(empty.getByTestId("recommendations-empty")).toBeTruthy();
    expect(empty.getByText("No matching places yet.")).toBeTruthy();
    expect(empty.queryByText("Retry")).toBeNull();
    await empty.unmount();
  });

  it("uses persistent retry and avoids duplicate Toast after global handling", async () => {
    const refetch = jest.fn();
    (handleSystemError as jest.Mock).mockReturnValue(true);
    (useRecommendations as jest.Mock).mockReturnValue({
      businesses: [],
      isLoading: false,
      error: {
        success: false,
        code: "NETWORK_ERROR",
        message: "Offline",
      },
      refetch,
    });

    const screen = await renderSection();
    await waitFor(() => {
      expect(screen.getByTestId("recommendations-error")).toBeTruthy();
    });
    await fireEvent.press(screen.getByTestId("recommendations-retry"));

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(handleSystemError).toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it("offers See all only for genuine recommendation matches", async () => {
    const onSeeAll = jest.fn();
    (useRecommendations as jest.Mock).mockReturnValue({
      businesses: [createBusiness(1, "Discovery Fallback")],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const fallback = await render(
      <InterestsSection
        impressions={createImpressions()}
        userLocation={null}
        onBusinessPress={jest.fn()}
        onSeeAll={onSeeAll}
      />,
    );
    expect(fallback.queryByText("See all")).toBeNull();
    await fallback.unmount();

    (useRecommendations as jest.Mock).mockReturnValue({
      businesses: [
        createBusiness(2, "Matched", {
          type: "category",
          id: 8,
          label: "Cafe",
        }),
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const matched = await render(
      <InterestsSection
        impressions={createImpressions()}
        userLocation={null}
        onBusinessPress={jest.fn()}
        onSeeAll={onSeeAll}
      />,
    );
    fireEvent.press(matched.getByText("See all"));
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });
});
