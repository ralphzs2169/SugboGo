import { useContext, useLayoutEffect, useState } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { AppState, type AppStateStatus, type View } from "react-native";
import { router } from "expo-router";

import { BusinessProfileImpressionsContext } from "../../../hooks/BusinessProfileImpressionsContext";
import useSimilarBusinesses from "../../../hooks/useSimilarBusinesses";
import type { ExploreBusiness } from "../../../types/exploreBusiness.types";
import BusinessProfileScrollView from "../BusinessProfileScrollView";
import SimilarPlacesSection from "../SimilarPlacesSection";
import BusinessProfileFooter from "../BusinessProfileFooter";

const mockSubmit = jest.fn();
let mockFocused = true;
let tracking: React.ContextType<typeof BusinessProfileImpressionsContext>;
let changeAppState: (state: AppStateStatus) => void;

jest.mock("expo-router", () => ({
  useIsFocused: () => mockFocused,
  router: { push: jest.fn() },
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("../../../hooks/useVisibilityMutations", () => ({
  useRecordBusinessImpressions: () => ({ mutateAsync: mockSubmit }),
}));
jest.mock("../../../hooks/useSimilarBusinesses");
jest.mock("@/shared/hooks/useUserLocation", () => ({
  __esModule: true,
  default: () => ({ location: null }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock("../BusinessProfileStickyHeader", () => ({
  __esModule: true,
  default: ({ onIdentityLayout }: { onIdentityLayout: () => void }) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="sticky-header" onLayout={onIdentityLayout} />;
  },
}));
jest.mock("@/features/pockets/components/PocketBusinessCard", () => ({
  __esModule: true,
  default: ({ onPress }: { onPress: () => void }) => {
    const { Pressable } = jest.requireActual("react-native");
    return <Pressable testID="similar-card-action" onPress={onPress} />;
  },
}));
jest.mock("@/shared/utils/apiErrors", () => ({ handleSystemError: jest.fn() }));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

const business: ExploreBusiness = {
  id: 1,
  business_name: "Similar business",
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

/** Exposes only the native measurement boundary; observer and tracker stay real. */
function MeasurementProbe() {
  const value = useContext(BusinessProfileImpressionsContext);
  useLayoutEffect(() => {
    tracking = value;
  }, [value]);
  return null;
}

function Profile({
  enabled = true,
  isOwnBusiness = false,
}: {
  enabled?: boolean;
  isOwnBusiness?: boolean;
}) {
  const [footerHeight, setFooterHeight] = useState(0);
  return (
    <>
      <BusinessProfileScrollView
        business={business}
        isRefreshing={false}
        onRefresh={() => undefined}
        isOwnBusiness={isOwnBusiness}
        ownerFooterHeight={footerHeight}
        impressionsEnabled={enabled}
      >
        <MeasurementProbe />
        <SimilarPlacesSection businessId={20} />
      </BusinessProfileScrollView>
      <BusinessProfileFooter
        isOwnBusiness={isOwnBusiness}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      />
    </>
  );
}

type Screen = Awaited<ReturnType<typeof render>>;

async function layout(
  screen: Screen,
  testID: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  await fireEvent(screen.getByTestId(testID), "layout", {
    nativeEvent: { layout: { x, y, width, height } },
  });
}

async function measure(screen: Screen, listY = 1000, cardX = 0) {
  await layout(screen, "business-profile-scroll", 0, 0, 400, 600);
  await layout(screen, "sticky-header", 0, 64, 400, 56);
  // Native measureLayout resolves the list through all nested profile wrappers.
  tracking!.listRef.current = {
    measureLayout: (_ancestor, success) => success(16, listY, 368, 200),
  } as View;
  await layout(screen, "similar-places-list", 0, 0, 368, 200);
  await layout(screen, "similar-place-impression-1", cardX, 0, 368, 100);
}

async function scroll(screen: Screen, y: number) {
  await fireEvent.scroll(screen.getByTestId("business-profile-scroll"), {
    nativeEvent: { contentOffset: { x: 0, y } },
  });
}

async function advance(milliseconds: number) {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
  });
}

describe("Similar Places impressions", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFocused = true;
    AppState.currentState = "active";
    mockSubmit.mockReset().mockResolvedValue(undefined);
    jest.mocked(useSimilarBusinesses).mockReturnValue({
      businesses: [business],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, callback) => {
        changeAppState = callback;
        return { remove: jest.fn() };
      });
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("clips owner-footer occlusion and qualifies only after an unobscured 500 ms dwell", async () => {
    const screen = await render(<Profile isOwnBusiness={true} />);
    await measure(screen, 463);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    const footer = screen.getByRole("button", { name: "Manage My Business" });
    await fireEvent(footer, "layout", {
      nativeEvent: { layout: { x: 0, y: 512, width: 400, height: 88 } },
    });
    // Only 49 of this 100px card's pixels are above the opaque footer.
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await scroll(screen, 1);
    await advance(499);
    expect(mockSubmit).not.toHaveBeenCalled();
    await advance(1);
    expect(mockSubmit).not.toHaveBeenCalled();
    await advance(750);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
    await screen.rerender(<Profile isOwnBusiness={true} />);
    await scroll(screen, 0);
    await scroll(screen, 1);
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });

  it("removes owner-footer clipping on non-owner profiles without losing retained card measurements", async () => {
    const screen = await render(<Profile isOwnBusiness={true} />);
    await measure(screen, 463);
    const footer = screen.getByRole("button", { name: "Manage My Business" });
    await fireEvent(footer, "layout", {
      nativeEvent: { layout: { x: 0, y: 512, width: 400, height: 88 } },
    });
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await screen.rerender(<Profile isOwnBusiness={false} />);
    expect(
      screen.queryByRole("button", { name: "Manage My Business" }),
    ).toBeNull();
    await advance(499);
    expect(mockSubmit).not.toHaveBeenCalled();
    await advance(751);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });

  it("qualifies a visible card only after the shared dwell and batch delay", async () => {
    const screen = await render(<Profile />);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await measure(screen, 200);
    await advance(499);
    expect(mockSubmit).not.toHaveBeenCalled();
    await advance(1);
    expect(mockSubmit).not.toHaveBeenCalled();
    await advance(750);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
    await fireEvent.press(screen.getByTestId("similar-card-action"));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          businessId: "1",
          profileSource: "SIMILAR_BUSINESSES",
        }),
      }),
    );
  });

  it("excludes offscreen and insufficiently visible cards including header and list clipping", async () => {
    const screen = await render(<Profile />);
    await measure(screen);
    await advance(1250);
    await measure(screen, 551);
    await advance(1250);
    await measure(screen, 20);
    await advance(1250);
    await measure(screen, 200, 300);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("qualifies after vertical scrolling and cancels a rapid pass", async () => {
    const screen = await render(<Profile />);
    await measure(screen);
    await scroll(screen, 800);
    await advance(250);
    await scroll(screen, 0);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await scroll(screen, 800);
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });

  it("waits for fresh native measurements when ancestor content reflows", async () => {
    const screen = await render(<Profile />);
    await measure(screen, 200);
    await advance(250);
    let finishMeasurement!: (
      x: number,
      y: number,
      width: number,
      height: number,
    ) => void;
    const measureLayout = jest.fn((_ancestor, success) => {
      finishMeasurement = success;
    });
    tracking!.listRef.current = { measureLayout } as unknown as View;

    await fireEvent(
      screen.getByTestId("business-profile-scroll"),
      "contentSizeChange",
      400,
      2000,
    );
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await act(async () => {
      finishMeasurement(16, 1000, 368, 200);
    });
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();

    await fireEvent(
      screen.getByTestId("business-profile-scroll"),
      "contentSizeChange",
      400,
      1200,
    );
    await act(async () => {
      finishMeasurement(16, 200, 368, 200);
    });
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });

  it("restarts dwell after focus loss and background activity", async () => {
    const screen = await render(<Profile />);
    await measure(screen, 200);
    await advance(250);
    mockFocused = false;
    await screen.rerender(<Profile />);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    mockFocused = true;
    await screen.rerender(<Profile />);
    await advance(250);
    await act(async () => {
      AppState.currentState = "background";
      changeAppState("background");
    });
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await act(async () => {
      AppState.currentState = "active";
      changeAppState("active");
    });
    await advance(499);
    expect(mockSubmit).not.toHaveBeenCalled();
    await advance(751);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });

  it("preserves measurements through data updates and deduplicates ordinary rerenders", async () => {
    const screen = await render(<Profile />);
    await measure(screen);
    jest.mocked(useSimilarBusinesses).mockReturnValue({
      businesses: [{ ...business }],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    await screen.rerender(<Profile />);
    await scroll(screen, 800);
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
    await screen.rerender(<Profile />);
    await scroll(screen, 0);
    await scroll(screen, 800);
    await advance(1250);
    expect(mockSubmit.mock.calls).toEqual([[[1]]]);
  });

  it("pauses dwell while the profile is obscured and prunes hidden results", async () => {
    const screen = await render(<Profile />);
    await measure(screen, 200);
    await advance(250);
    await screen.rerender(<Profile enabled={false} />);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
    await screen.rerender(<Profile />);
    await advance(250);
    jest.mocked(useSimilarBusinesses).mockReturnValue({
      businesses: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    await screen.rerender(<Profile />);
    await advance(1250);
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
