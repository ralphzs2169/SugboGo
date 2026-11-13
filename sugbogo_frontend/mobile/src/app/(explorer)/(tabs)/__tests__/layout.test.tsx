import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { useEffect } from "react";
import { AccessibilityInfo, AppState, BackHandler, Text, View } from "react-native";
import { withTiming } from "react-native-reanimated";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useLogoutConfirmationStore } from "@/features/auth/store/logoutConfirmation.store";
import { useExplorerTour } from "@/features/guided-tour/hooks/useExplorerTour";
import ExplorerTourHost from "@/features/guided-tour/components/ExplorerTourHost";
import { BookmarkTourSurfaceContext, useBookmarkTourSurface } from "@/features/guided-tour/hooks/useBookmarkTourSurface";
import PocketBusinessCard from "@/features/pockets/components/PocketBusinessCard";
import type { ExploreBusiness } from "@/features/explore/types/exploreBusiness.types";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";

import ExplorerTabs from "../_layout";

const mockTabNames = ["explore", "map", "community", "profile"];
const mockTabX = [0, 100, 200, 300];
const mockDisk = new Map<string, string>();
const mockNavigateTab = jest.fn();
let mockPathname = "/explore";
let mockFocused = true;
let mockKeyboardOpen = false;
let mockLocationReady = true;
let mockPickerOpen = false;
const mockOpenPicker = jest.fn();
let mockShowBookmarkCard = false;
let mockBookmarkY = 290;
let mockBookmarkBlocked = false;
let measuredTabWidth = 100;
let measuredViewportHeight = 800;

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const easing = (value: number) => value;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    Easing: { out: () => easing, cubic: easing, quad: easing },
    ReduceMotion: { Never: "never" },
    useAnimatedProps: (read: () => unknown) => read(),
    useAnimatedStyle: (read: () => unknown) => read(),
    useSharedValue: <Value,>(initial: Value) => {
      const value = React.useRef(initial);
      const [, refresh] = React.useReducer((count: number) => count + 1, 0);
      return React.useMemo(
        () => ({
          get: () => value.current,
          set: (next: Value) => {
            value.current = next;
            refresh();
          },
        }),
        [],
      );
    },
    withTiming: jest.fn((value: unknown) => value),
  };
});
jest.mock("expo-image", () => ({
  Image: jest.requireActual<typeof import("react-native")>("react-native").View,
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (key: string) => mockDisk.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockDisk.set(key, value);
  }),
}));
jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useIsRestoring: () => false,
}));
jest.mock("@expo/vector-icons", () => ({
  Feather: () => null,
  MaterialCommunityIcons: () => null,
}));
jest.mock("react-native-keyboard-controller", () => ({
  useKeyboardState: () => mockKeyboardOpen,
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/features/pockets/providers/PocketPickerContext", () => ({
  usePocketPicker: () => ({ isOpen: mockPickerOpen, openPocketPicker: mockOpenPicker }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 20, left: 0, right: 0 }),
}));
jest.mock("react-native-svg", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
  Path: ({ animatedProps, d }: { animatedProps?: { d: string }; d?: string }) => {
    const React = jest.requireActual<typeof import("react")>("react");
    const { View } = jest.requireActual<typeof import("react-native")>("react-native");
    return React.createElement(View, {
      testID: animatedProps ? "spotlight-mask" : "spotlight-pointer",
      accessibilityLabel: animatedProps?.d ?? d,
    });
  },
}));
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const TabBarContext = React.createContext(null);

  type MockTabBarProps = {
    state: { index: number; routes: { name: string; key: string }[] };
    navigation: { emit: () => object; navigate: typeof mockNavigateTab };
  };

  function MockTabs({ children, tabBar }: {
    children: React.ReactNode;
    tabBar: (props: MockTabBarProps) => React.ReactNode;
  }) {
    return React.createElement(
      View,
      null,
      children,
      React.createElement(MockExplore),
      // Match Expo Router's context render callback. React types it as a prop.
      // eslint-disable-next-line react/no-children-prop
      React.createElement(TabBarContext.Consumer, {
        children: () =>
          tabBar({
            state: {
              index: Math.max(0, mockTabNames.indexOf(mockPathname.slice(1))),
              routes: mockTabNames.map((name) => ({ name, key: name })),
            },
            navigation: { emit: () => ({}), navigate: mockNavigateTab },
          }),
      }),
    );
  }

  function MockTabScreen({ name }: { name: string }) {
    return React.createElement(View, { testID: `explorer-tab-${name}` });
  }

  MockTabs.Screen = MockTabScreen;
  return {
    Tabs: MockTabs,
    router: { navigate: jest.fn() },
    useIsFocused: () => mockFocused,
    useNavigation: () => ({ isFocused: () => mockFocused }),
    usePathname: () => mockPathname,
  };
});

function MockExplore() {
  const tour = useExplorerTour();
  const setReady = tour?.setExploreLocationReady;
  const locationReady = mockLocationReady;
  const { surface, attachNativeViewport, onTouchStart, onTouchEnd, onLayout } =
    useBookmarkTourSurface(mockPathname, mockBookmarkBlocked);
  useEffect(() => {
    setReady?.(locationReady);
  }, [setReady, locationReady]);

  return (
    <View>
      <Text>No businesses</Text>
      <Text onPress={tour?.requestReplay}>Replay test action</Text>
      <BookmarkTourSurfaceContext.Provider value={surface}>
        <View
          ref={attachNativeViewport}
          testID="bookmark-viewport"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onLayout={onLayout}
        >
          {mockShowBookmarkCard && (
            <PocketBusinessCard
              business={bookmarkBusiness}
              distance={null}
              distanceAccuracy={null}
              onPress={mockNavigateTab}
            />
          )}
        </View>
      </BookmarkTourSurfaceContext.Provider>
    </View>
  );
}

function TabLayout() {
  return <ExplorerTourHost><ExplorerTabs /></ExplorerTourHost>;
}

const bookmarkBusiness: ExploreBusiness = {
  id: 42,
  business_name: "Card Cafe",
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
    longitude: 123.89,
  },
};

const user: User = {
  id: 101,
  first_name: "Cebu",
  last_name: "Explorer",
  gender: null,
  email: "explorer@example.com",
  role: "explorer",
  status: "active",
  has_completed_interest_selection: true,
  has_custom_profile_picture: false,
  has_oauth_accounts: false,
};

function signIn(id = user.id) {
  beginAuthSession();
  useAuthStore.getState().setUser({ ...user, id });
}

function signOut() {
  invalidateAuthSession();
  useAuthStore.getState().clearUser();
}

async function layoutTabs(
  screen: Awaited<ReturnType<typeof render>>,
  width = 100,
  height = 800,
) {
  const host = screen.getByTestId("explorer-tour-viewport");
  measuredTabWidth = width;
  measuredViewportHeight = height;
  await fireEvent(host, "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height } },
  });
}

function queryMask(screen: Awaited<ReturnType<typeof render>>) {
  return screen.queryByTestId("spotlight-mask", { includeHiddenElements: true });
}

async function expectStep(
  screen: Awaited<ReturnType<typeof render>>,
  title: string,
  startOfCutout: number,
) {
  expect(await screen.findByText(title)).toBeTruthy();
  const mask = screen.getByTestId("spotlight-mask", {
    includeHiddenElements: true,
  });
  await waitFor(() => {
    expect(mask.props.accessibilityLabel).toContain(`M ${startOfCutout} 712 H`);
  });
}

describe("Explorer navigation tour", () => {
  beforeEach(() => {
    mockDisk.clear();
    mockPathname = "/explore";
    mockFocused = true;
    mockKeyboardOpen = false;
    mockLocationReady = true;
    mockPickerOpen = false;
    mockShowBookmarkCard = false;
    mockBookmarkY = 290;
    mockBookmarkBlocked = false;
    AppState.currentState = "active";
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(View.prototype, "measureLayout").mockImplementation(function (
      this: { props: { accessibilityLabel?: string } },
      _host,
      measure,
    ) {
      const index = mockTabNames.indexOf(
        this.props.accessibilityLabel?.toLowerCase() ?? "",
      );
      if (index >= 0) {
        measure(mockTabX[index], measuredViewportHeight - 84, measuredTabWidth, 64);
      }
    });
    jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    jest.spyOn(View.prototype, "measureInWindow").mockImplementation(function (
      this: { props: { accessibilityLabel?: string; testID?: string } },
      measure,
    ) {
      if (this.props.accessibilityLabel === "Save Card Cafe to Pockets") {
        measure(240, mockBookmarkY, 48, 48);
      } else if (this.props.testID === "bookmark-viewport") {
        measure(0, 120, 400, 680);
      } else if (this.props.testID === "explorer-tour-viewport") {
        measure(0, 0, 400, 800);
      }
    });
    useAuthStore.getState().setLoading(false);
    signIn();
  });

  afterEach(async () => {
    await act(signOut);
    jest.restoreAllMocks();
  });

  it("keeps four real tab spotlights on Explore without requiring any businesses", async () => {
    const screen = await render(<TabLayout />);
    expect(screen.getByTestId("explorer-tab-explore")).toBeTruthy();
    expect(screen.getByTestId("explorer-tab-profile")).toBeTruthy();
    expect(screen.queryByTestId("explorer-tab-notifications")).toBeNull();
    expect(screen.getByText("No businesses")).toBeTruthy();
    await layoutTabs(screen);
    await expectStep(screen, "Discover Cebu's hidden gems!", 12);
    expect(screen.getByTestId("spotlight-mascot", { includeHiddenElements: true }))
      .toBeTruthy();
    expect(screen.getByTestId("spotlight-pointer", { includeHiddenElements: true }))
      .toBeTruthy();

    await fireEvent.press(screen.getByText("Next"));
    await expectStep(screen, "Explore the map", 108);
    expect(withTiming).toHaveBeenCalledWith(
      expect.objectContaining({ left: 96, pointerLeft: 119 }),
      expect.objectContaining({ duration: 220 }),
    );
    expect(withTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: 180 }),
    );
    await fireEvent.press(screen.getByText("Back"));
    await expectStep(screen, "Discover Cebu's hidden gems!", 12);
    await fireEvent.press(screen.getByText("Next"));
    await fireEvent.press(screen.getByText("Next"));
    await expectStep(screen, "Join the community", 208);
    await fireEvent.press(screen.getByText("Next"));
    await expectStep(screen, "Your SugboGo profile", 308);

    expect(mockNavigateTab).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Got it!"));
    expect(queryMask(screen)).toBeNull();
    expect(mockDisk.get("guided-tour:explorer-navigation:v1:101")).toBe("true");
  });

  it("remembers Skip across remount and same-account relogin and isolates other accounts", async () => {
    const first = await render(<TabLayout />);
    await layoutTabs(first);
    await fireEvent.press(await first.findByText("Skip"));
    await first.unmount();

    signOut();
    signIn();
    const restored = await render(<TabLayout />);
    await layoutTabs(restored);
    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("guided-tour:pockets-bookmark:v1:101");
    });
    expect(queryMask(restored)).toBeNull();

    await act(() => signIn(202));
    await expectStep(restored, "Discover Cebu's hidden gems!", 12);
    await act(signOut);
    expect(queryMask(restored)).toBeNull();
    expect(mockDisk.has("guided-tour:explorer-navigation:v1:202")).toBe(false);
  });

  it("replays from step one after returning to Explore and keeps completion", async () => {
    mockDisk.set("guided-tour:explorer-navigation:v1:101", "true");
    mockPathname = "/profile";
    const screen = await render(<TabLayout />);
    await layoutTabs(screen);
    await fireEvent.press(screen.getByText("Replay test action"));
    expect(router.navigate).toHaveBeenCalledWith("/(explorer)/(tabs)/explore");
    expect(queryMask(screen)).toBeNull();

    mockPathname = "/explore";
    await screen.rerender(<TabLayout />);
    await expectStep(screen, "Discover Cebu's hidden gems!", 12);
    await fireEvent.press(screen.getByText("Skip"));
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(mockDisk.get("guided-tour:explorer-navigation:v1:101")).toBe("true");
  });

  it("waits for valid geometry and an unobstructed Explore screen", async () => {
    const screen = await render(<TabLayout />);
    await layoutTabs(screen, 0);
    await waitFor(() => expect(View.prototype.measureLayout).toHaveBeenCalled());
    expect(queryMask(screen)).toBeNull();

    mockLocationReady = false;
    mockKeyboardOpen = true;
    mockPickerOpen = true;
    await act(() => useLogoutConfirmationStore.getState().open());
    await screen.rerender(<TabLayout />);
    await layoutTabs(screen, 100, 801);
    expect(queryMask(screen)).toBeNull();

    mockLocationReady = true;
    mockKeyboardOpen = false;
    mockPickerOpen = false;
    await screen.rerender(<TabLayout />);
    await act(() => useLogoutConfirmationStore.getState().close());
    await layoutTabs(screen);

    await expectStep(screen, "Discover Cebu's hidden gems!", 12);
    mockPathname = "/search-filter-results";
    mockFocused = false;
    await screen.rerender(<TabLayout />);
    expect(queryMask(screen)).toBeNull();
  });

  it("consumes Android Back while visible without recording completion", async () => {
    const remove = jest.fn();
    let back: () => boolean | null | undefined = () => false;
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, handler) => {
      back = () => handler({} as Parameters<typeof handler>[0]);
      return { remove };
    });
    const screen = await render(<TabLayout />);
    await layoutTabs(screen);
    await expectStep(screen, "Discover Cebu's hidden gems!", 12);

    await act(() => {
      expect(back()).toBe(true);
    });
    expect(remove).toHaveBeenCalled();
    expect(queryMask(screen)).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("ignores an old preference read after the account changes", async () => {
    let resolveOldRead: (value: string | null) => void = () => {};
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveOldRead = resolve;
      }),
    );
    mockDisk.set("guided-tour:explorer-navigation:v1:202", "true");
    const screen = await render(<TabLayout />);
    await layoutTabs(screen);
    await act(() => signIn(202));
    await act(() => resolveOldRead(null));

    expect(queryMask(screen)).toBeNull();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith("guided-tour:explorer-navigation:v1:202");
  });

  it("ignores native measurements that finish after the tabs unmount", async () => {
    const finishMeasurements: (() => void)[] = [];
    jest.mocked(View.prototype.measureLayout).mockImplementation(
      (_host, measure) => {
        finishMeasurements.push(() => measure(0, 716, 100, 64));
      },
    );
    const screen = await render(<TabLayout />);
    await layoutTabs(screen);
    await waitFor(() => expect(finishMeasurements).toHaveLength(4));
    await screen.unmount();

    await act(() => {
      finishMeasurements.forEach((finish) => finish());
    });

    expect(AccessibilityInfo.sendAccessibilityEvent).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("moves directly to the next spotlight when reduced motion is enabled", async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    const screen = await render(<TabLayout />);
    await layoutTabs(screen);
    await expectStep(screen, "Discover Cebu's hidden gems!", 12);

    await fireEvent.press(screen.getByText("Next"));
    await expectStep(screen, "Explore the map", 108);
    expect(withTiming).not.toHaveBeenCalled();
  });

  it("waits for the navigation walkthrough, then highlights the real bookmark", async () => {
    mockShowBookmarkCard = true;
    const screen = await render(<TabLayout />);
    await layoutTabs(screen);
    await expectStep(screen, "Discover Cebu's hidden gems!", 12);
    expect(screen.queryByText("Save places for later!")).toBeNull();

    await fireEvent.press(screen.getByText("Skip"));
    expect(await screen.findByText("Save places for later!")).toBeTruthy();
    const mask = queryMask(screen);
    expect(mask?.props.accessibilityLabel).toContain("M 248 286 H");
    expect(screen.queryByText("Back")).toBeNull();
    expect(screen.queryByText("Skip")).toBeNull();
    expect(mockOpenPicker).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Got it!"));
    expect(mockDisk.get("guided-tour:explorer-navigation:v1:101")).toBe("true");
    expect(mockDisk.get("guided-tour:pockets-bookmark:v1:101")).toBe("true");
    expect(mockOpenPicker).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Save Card Cafe to Pockets" }));
    expect(mockOpenPicker).toHaveBeenCalledWith(42);
    expect(mockNavigateTab).not.toHaveBeenCalled();
  });

  it("keeps bookmark completion scoped to its account and independent of navigation", async () => {
    mockShowBookmarkCard = true;
    mockDisk.set("guided-tour:explorer-navigation:v1:101", "true");
    mockDisk.set("guided-tour:explorer-navigation:v1:202", "true");
    const first = await render(<TabLayout />);
    await layoutTabs(first);
    await fireEvent.press(await first.findByText("Got it!"));
    await first.unmount();

    const restored = await render(<TabLayout />);
    await layoutTabs(restored);
    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("guided-tour:pockets-bookmark:v1:101");
    });
    expect(queryMask(restored)).toBeNull();

    await act(() => signIn(202));
    expect(await restored.findByText("Save places for later!")).toBeTruthy();
    expect(mockDisk.has("guided-tour:pockets-bookmark:v1:202")).toBe(false);
    await act(signOut);
    expect(queryMask(restored)).toBeNull();
  });

  it("waits for a visible, unobstructed bookmark and dismisses when it disappears", async () => {
    mockDisk.set("guided-tour:explorer-navigation:v1:101", "true");
    const screen = await render(<TabLayout />);
    await layoutTabs(screen);
    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith("guided-tour:pockets-bookmark:v1:101");
    });
    expect(queryMask(screen)).toBeNull();

    mockShowBookmarkCard = true;
    mockBookmarkY = 720;
    await screen.rerender(<TabLayout />);
    await waitFor(() => {
      expect(View.prototype.measureInWindow).toHaveBeenCalled();
    });
    expect(queryMask(screen)).toBeNull();

    mockBookmarkY = 290;
    mockBookmarkBlocked = true;
    await screen.rerender(<TabLayout />);
    expect(queryMask(screen)).toBeNull();
    const viewport = screen.getByTestId("bookmark-viewport");
    await fireEvent(viewport, "touchStart");
    mockBookmarkBlocked = false;
    await screen.rerender(<TabLayout />);
    expect(queryMask(screen)).toBeNull();
    await fireEvent(viewport, "touchEnd");
    expect(await screen.findByText("Save places for later!")).toBeTruthy();

    mockShowBookmarkCard = false;
    await screen.rerender(<TabLayout />);
    await waitFor(() => expect(queryMask(screen)).toBeNull());
    mockShowBookmarkCard = true;
    await screen.rerender(<TabLayout />);
    expect(queryMask(screen)).toBeNull();
    expect(mockDisk.has("guided-tour:pockets-bookmark:v1:101")).toBe(false);
  });
});
