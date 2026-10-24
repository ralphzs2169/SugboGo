import { fireEvent, render, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { router } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { handleSystemError } from "@/shared/utils/apiErrors";

import InterestsSection from "../UserInterestsSection";
import useRecommendations from "../../../hooks/useRecommendations";
import { RECOMMENDATIONS_QUERY_KEY } from "../../../constants/exploreHomepageQueries";
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
jest.mock("../../../api/exploreBusiness.service", () => ({
  getRecommendations: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));
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
    display_cover_photo_url: null,
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

describe("Recommendation presentation", () => {
  it("retains recommendations after refresh failure", async () => {
    const state = {
      isPersonalized: true,
      businesses: [createBusiness(1, "Previously loaded recommendation")],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    };
    (useRecommendations as jest.Mock).mockReturnValue(state);
    const impressions = createImpressions();
    const props = {
      impressions,
      userLocation: null,
      onBusinessPress: jest.fn(),
    };
    const screen = await render(<InterestsSection {...props} />);
    (useRecommendations as jest.Mock).mockReturnValue({
      ...state,
      error: new Error("Offline"),
    });
    await screen.rerender(<InterestsSection {...props} />);
    expect(screen.getByText("Previously loaded recommendation")).toBeTruthy();
    expect(screen.queryByTestId("recommendations-error")).toBeNull();
    expect(impressions.retainBusinesses).toHaveBeenLastCalledWith([1]);
  });
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
      isPersonalized: true,
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

    expect(screen.getByText("For You")).toBeTruthy();
    expect(
      screen.getByText("Places connected to your interests and activity."),
    ).toBeTruthy();
    expect(screen.queryByText("Explore local picks")).toBeNull();
    expect(screen.queryByText("Make SugboGo yours")).toBeNull();
    expect(screen.queryByText("Choose interests")).toBeNull();
    expect(cards.map((card) => card.props.testID)).toEqual([
      "shared-business-card-22",
      "shared-business-card-4",
    ]);
    expect(mockBusinessCard).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        business: expect.objectContaining({ recommendation_reason: reason }),
        variant: "compact",
      }),
    );
    expect(mockBusinessCard.mock.calls[0][0]).not.toHaveProperty(
      "recommendationReason",
    );
    await screen.unmount();
  });

  it("replaces fallback businesses with setup and opens the existing interest editor", async () => {
    (useRecommendations as jest.Mock).mockReturnValue({
      isPersonalized: false,
      businesses: [
        createBusiness(22, "Discovery First", {
          type: "category",
          id: 8,
          label: "Cafe",
        }),
        createBusiness(4, "Discovery Second"),
      ],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const impressions = createImpressions();
    const screen = await render(
      <InterestsSection
        impressions={impressions}
        userLocation={null}
        onBusinessPress={jest.fn()}
      />,
    );

    expect(screen.getByText("Make SugboGo yours")).toBeTruthy();
    expect(
      screen.getByText(
        "Choose a few interests to get recommendations that better match your interests and activity.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("For You")).toBeNull();
    expect(screen.queryByText("Explore local picks")).toBeNull();
    expect(screen.queryAllByTestId(/shared-business-card-/)).toHaveLength(0);
    expect(screen.queryByText("Discovery First")).toBeNull();
    expect(screen.queryByText("Discovery Second")).toBeNull();
    expect(mockBusinessCard).not.toHaveBeenCalled();
    expect(impressions.retainBusinesses).toHaveBeenLastCalledWith([]);

    await fireEvent.press(
      screen.getByRole("button", { name: "Choose interests" }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/profile/your-interests",
      params: { source: "recommendations" },
    });
    await screen.unmount();
  });

  it("renders setup from cached non-personalized state without displaying cached businesses", async () => {
    const realUseRecommendations = jest.requireActual(
      "../../../hooks/useRecommendations",
    ).default;
    (useRecommendations as jest.Mock).mockImplementation(
      realUseRecommendations,
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const cached = {
      is_personalized: false,
      items: [createBusiness(81, "Cached Fallback")],
      pagination: {
        page: 1,
        page_size: 10,
        total_items: 1,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      },
    };
    client.setQueryData(RECOMMENDATIONS_QUERY_KEY, cached);
    const screen = await render(
      <QueryClientProvider client={client}>
        <InterestsSection
          impressions={createImpressions()}
          userLocation={null}
          onBusinessPress={jest.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Make SugboGo yours")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Choose interests" }),
    ).toBeTruthy();
    expect(screen.queryByText("Cached Fallback")).toBeNull();
    expect(screen.queryByText("For You")).toBeNull();
    expect(mockBusinessCard).not.toHaveBeenCalled();
    expect(client.getQueryData(RECOMMENDATIONS_QUERY_KEY)).toBe(cached);
    await screen.unmount();
    client.clear();
    (useRecommendations as jest.Mock).mockReset();
  });

  it("shows loading and successful-empty states independently", async () => {
    (useRecommendations as jest.Mock).mockReturnValue({
      isPersonalized: false,
      businesses: [],
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });
    const loading = await renderSection();
    expect(loading.getByTestId("recommendations-loading")).toBeTruthy();
    expect(loading.queryByText("Choose interests")).toBeNull();
    await loading.unmount();

    (useRecommendations as jest.Mock).mockReturnValue({
      isPersonalized: true,
      businesses: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const empty = await renderSection();
    expect(empty.getByTestId("recommendations-empty")).toBeTruthy();
    expect(empty.queryByText("Retry")).toBeNull();
    expect(empty.getByText("For You")).toBeTruthy();
    expect(empty.getByText("No matching places yet")).toBeTruthy();
    expect(empty.queryByText("Choose interests")).toBeNull();
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
    expect(screen.queryByText("Choose interests")).toBeNull();
    await screen.unmount();
  });

  it("offers See all only for genuine recommendation matches", async () => {
    const onSeeAll = jest.fn();
    (useRecommendations as jest.Mock).mockReturnValue({
      isPersonalized: false,
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
      isPersonalized: true,
      businesses: [createBusiness(2, "Matched")],
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
