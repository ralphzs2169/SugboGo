import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { AppState, View } from "react-native";

import useBusinessImpressions from "../../../hooks/useBusinessImpressions";
import type { ExploreBusiness } from "../../../types/exploreBusiness.types";
import ExploreBusinessCarousel from "../ExploreBusinessCarouselSection";

const mockSubmit = jest.fn();

jest.mock("expo-router", () => ({
  useIsFocused: () => true,
}));
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: () => null,
}));
jest.mock("../../../hooks/useVisibilityMutations", () => ({
  useRecordBusinessImpressions: () => ({ mutateAsync: mockSubmit }),
}));
jest.mock("@/features/pockets/components/PocketBusinessCard", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../ExploreSectionHeader", () => ({
  __esModule: true,
  default: () => null,
}));

type Screen = Awaited<ReturnType<typeof render>>;

function createBusiness(id: number): ExploreBusiness {
  return {
    id,
    business_name: `Business ${id}`,
    cover_photo_url: null,
    display_cover_photo_url: null,
    review_count: 0,
    overall_vibe: null,
    is_pocketed: false,
    cluster: { id: 1, name: "Culinary", icon: "utensils" },
    category: { id: 1, name: "Cafe" },
    specialty_tags: [],
    location: {
      address: "Cebu",
      city: "Cebu City",
      province: "Cebu",
      latitude: 10.31,
      longitude: 123.9,
    },
  };
}

/** Keeps the real observer mounted when the carousel alone is removed. */
function CarouselHarness({
  businesses,
  showCarousel = true,
}: {
  businesses: ExploreBusiness[];
  showCarousel?: boolean;
}) {
  const impressions = useBusinessImpressions(0);

  return (
    <View testID="viewport" onLayout={impressions.onViewportLayout}>
      {showCarousel && (
        <ExploreBusinessCarousel
          title="Businesses"
          subtitle="Discover businesses"
          businesses={businesses}
          impressions={impressions}
          userLocation={null}
          sectionTestID="section"
          scrollTestID="carousel"
          impressionTestIDPrefix="card"
          onBusinessPress={() => undefined}
        />
      )}
    </View>
  );
}

async function measure(
  screen: Screen,
  testID: string,
  x = 0,
) {
  await fireEvent(screen.getByTestId(testID), "layout", {
    nativeEvent: { layout: { x, y: 0, width: 100, height: 100 } },
  });
}

async function measureCarousel(screen: Screen) {
  await measure(screen, "viewport");
  await measure(screen, "section");
  await measure(screen, "carousel");
}

async function scrollTo(
  screen: Screen,
  x: number,
) {
  await fireEvent.scroll(screen.getByTestId("carousel"), {
    nativeEvent: { contentOffset: { x, y: 0 } },
  });
}

async function advanceTime(milliseconds: number) {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
  });
}

describe("carousel impression measurement lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSubmit.mockReset().mockResolvedValue(undefined);
    AppState.currentState = "active";
    jest.spyOn(AppState, "addEventListener").mockReturnValue({
      remove: jest.fn(),
    });
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("preserves retained measurements across data updates without another layout", async () => {
    const screen = await render(
      <CarouselHarness businesses={[createBusiness(1)]} />,
    );
    await measureCarousel(screen);
    await measure(screen, "card-1", 100);
    await advanceTime(1250);
    expect(mockSubmit).not.toHaveBeenCalled();

    await screen.rerender(
      <CarouselHarness businesses={[createBusiness(1)]} />,
    );
    await scrollTo(screen, 100);
    await advanceTime(499);
    expect(mockSubmit).not.toHaveBeenCalled();
    await advanceTime(1);
    await advanceTime(750);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });

  it("discards removed measurements and cancels their incomplete dwell", async () => {
    const screen = await render(
      <CarouselHarness businesses={[createBusiness(1)]} />,
    );
    await measureCarousel(screen);
    await measure(screen, "card-1");
    await advanceTime(250);
    await screen.rerender(<CarouselHarness businesses={[]} />);
    await advanceTime(1250);
    expect(mockSubmit).not.toHaveBeenCalled();

    await screen.rerender(
      <CarouselHarness businesses={[createBusiness(1)]} />,
    );
    await scrollTo(screen, 0);
    await advanceTime(1250);
    expect(mockSubmit).not.toHaveBeenCalled();

    await measure(screen, "card-1");
    await advanceTime(1250);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });

  it("clears measurements and incomplete dwell when the carousel unmounts", async () => {
    const businesses = [createBusiness(1)];
    const screen = await render(<CarouselHarness businesses={businesses} />);
    await measureCarousel(screen);
    await measure(screen, "card-1");
    await advanceTime(250);
    await screen.rerender(
      <CarouselHarness businesses={businesses} showCarousel={false} />,
    );
    await advanceTime(1250);
    expect(mockSubmit).not.toHaveBeenCalled();

    await screen.rerender(<CarouselHarness businesses={businesses} />);
    await measureCarousel(screen);
    await scrollTo(screen, 0);
    await advanceTime(1250);
    expect(mockSubmit).not.toHaveBeenCalled();

    await measure(screen, "card-1");
    await advanceTime(250);
    await screen.unmount();
    await advanceTime(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("keeps impression deduplication intact across updates and visible reentry", async () => {
    const screen = await render(
      <CarouselHarness businesses={[createBusiness(1)]} />,
    );
    await measureCarousel(screen);
    await measure(screen, "card-1");
    await advanceTime(1250);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);

    await screen.rerender(
      <CarouselHarness businesses={[createBusiness(1), createBusiness(2)]} />,
    );
    await measure(screen, "card-2", 100);
    await scrollTo(screen, 100);
    await advanceTime(250);
    await scrollTo(screen, 0);
    await advanceTime(1250);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);

    await scrollTo(screen, 100);
    await advanceTime(1250);
    expect(mockSubmit.mock.calls).toEqual([[[1]], [[2]]]);
  });
});
