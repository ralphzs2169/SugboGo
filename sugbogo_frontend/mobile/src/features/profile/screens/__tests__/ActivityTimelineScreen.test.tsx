import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { getActivityTimeline } from "../../api/activityTimeline.service";
import type {
  ActivityTimelinePage,
  TimelineActivity,
} from "../../types/activityTimeline.types";
import ActivityTimelineScreen from "../ActivityTimelineScreen";

jest.mock("../../api/activityTimeline.service", () => ({
  getActivityTimeline: jest.fn(),
}));
let mockUserId: number | null = 1;
jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: mockUserId === null ? null : { id: mockUserId },
      isAuthenticated: mockUserId !== null,
      isLoading: false,
    }),
}));
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
  useFocusEffect: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("lottie-react-native", () => () => null);
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/shared/components/Skeleton", () => "Skeleton");
jest.mock("@/shared/components/DottedTimelineConnector", () => () => null);
jest.mock(
  "@/shared/components/AppText",
  () => jest.requireActual("react-native").Text,
);
jest.mock("react-native/Libraries/Lists/FlatList", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: React.forwardRef(function MockList(
      props: {
        data: TimelineActivity[];
        renderItem: (value: {
          item: TimelineActivity;
          index: number;
        }) => React.ReactNode;
        ListHeaderComponent: React.ReactNode;
        ListEmptyComponent: React.ReactNode;
        ListFooterComponent: React.ReactNode;
      },
      ref: React.Ref<unknown>,
    ) {
      React.useImperativeHandle(ref, () => ({ scrollToOffset: jest.fn() }));
      return (
        <View {...props}>
          {props.ListHeaderComponent}
          {props.data.length
            ? props.data.map((item, index) => (
                <View key={item.id}>{props.renderItem({ item, index })}</View>
              ))
            : props.ListEmptyComponent}
          {props.ListFooterComponent}
        </View>
      );
    }),
  };
});

const business = {
  id: 7,
  business_name: "Cebu Cafe",
  status: "active",
  display_cover_photo_url: "https://example.com/cover.jpg",
};
const timestamp = new Date(2026, 9, 20, 10).toISOString();
const save: TimelineActivity = {
  id: "save:1",
  source_id: 1,
  type: "save",
  occurred_at: timestamp,
  business,
  specialty: null,
  review: null,
};
const vouch: TimelineActivity = {
  id: "vouch:1",
  source_id: 1,
  type: "vouch",
  occurred_at: timestamp,
  business,
  specialty: { id: 2, name: "Coffee", color: "teal", icon: "coffee" },
  review: null,
};
const review: TimelineActivity = {
  id: "review:1",
  source_id: 1,
  type: "review",
  occurred_at: timestamp,
  business: { ...business, status: "suspended" },
  specialty: null,
  review: {
    id: 1,
    excerpt: "Friendly service.",
    status: "under_review",
    edited_at: null,
  },
};

function page(items: TimelineActivity[], pageNumber = 1, hasNext = false) {
  return {
    success: true as const,
    message: "Success.",
    data: {
      items,
      pagination: {
        page: pageNumber,
        page_size: 10,
        total_items: hasNext ? 20 : items.length,
        total_pages: hasNext ? 2 : pageNumber,
        has_next: hasNext,
        has_previous: pageNumber > 1,
      },
    } satisfies ActivityTimelinePage,
  };
}

const service = jest.mocked(getActivityTimeline);
let client: QueryClient;
function screenElement() {
  return (
    <QueryClientProvider client={client}>
      <ActivityTimelineScreen />
    </QueryClientProvider>
  );
}

describe("Activity Timeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service.mockReset();
    mockUserId = 1;
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    service.mockResolvedValue(page([save, vouch, review]));
  });
  afterEach(() => client.clear());

  it("shows grouped activity and opens safe destinations", async () => {
    const screen = await render(screenElement());
    await waitFor(() =>
      expect(screen.getByLabelText(/^Saved Cebu Cafe/)).toBeTruthy(),
    );
    expect(service).toHaveBeenCalledWith("all", 1);
    expect(screen.getByText("Coffee")).toBeTruthy();
    expect(screen.getByText("Under review")).toBeTruthy();
    expect(screen.getByText("Business unavailable")).toBeTruthy();
    const headings = screen.getAllByRole("header");
    expect(headings).toHaveLength(1);
    await fireEvent.press(screen.getByLabelText(/^Saved Cebu Cafe/));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/(explorer)/business/[businessId]",
      params: { businessId: "7" },
    });
    await fireEvent.press(screen.getByLabelText(/^Reviewed Cebu Cafe/));
    expect(router.push).toHaveBeenLastCalledWith("/profile/reviews-submitted");
  });

  it("requests each server filter and shows a matching empty state", async () => {
    service.mockResolvedValue(page([]));
    const screen = await render(screenElement());
    await waitFor(() =>
      expect(screen.getByText("Your story starts here")).toBeTruthy(),
    );
    for (const [label, filter, empty] of [
      ["Show saves", "saves", "No saves yet"],
      ["Show vouches", "vouches", "No vouches yet"],
      ["Show reviews", "reviews", "No reviews yet"],
    ]) {
      await fireEvent.press(screen.getByLabelText(label));
      await waitFor(() => expect(screen.getByText(empty)).toBeTruthy());
      expect(service).toHaveBeenCalledWith(filter, 1);
      expect(
        screen.getByLabelText(label).props.accessibilityState.selected,
      ).toBe(true);
    }
  });

  it("keeps loading distinct from empty and retries initial failure", async () => {
    let fail!: (reason: Error) => void;
    service.mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          fail = reject;
        }),
    );
    const screen = await render(screenElement());
    expect(screen.getByLabelText("Loading activity")).toBeTruthy();
    expect(screen.queryByText("Your story starts here")).toBeNull();
    await act(async () => fail(new Error("Unavailable")));
    await waitFor(() =>
      expect(screen.getByText("Unable to load activity")).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^Saved Cebu Cafe/)).toBeTruthy(),
    );
  });

  it("guards pagination and deduplicates shifted page boundaries", async () => {
    service.mockResolvedValueOnce(page([save], 1, true));
    service.mockResolvedValueOnce(page([save, vouch], 2));
    const screen = await render(screenElement());
    await waitFor(() =>
      expect(screen.getByLabelText(/^Saved Cebu Cafe/)).toBeTruthy(),
    );
    const list = screen.getByTestId("activity-timeline-list");
    await fireEvent(list, "endReached");
    expect(service).toHaveBeenCalledTimes(1);
    await fireEvent(list, "scrollBeginDrag");
    await fireEvent(list, "endReached");
    await fireEvent(list, "endReached");
    await waitFor(() =>
      expect(screen.getByLabelText(/^Vouched for Cebu Cafe/)).toBeTruthy(),
    );
    expect(service).toHaveBeenCalledTimes(2);
    expect(service).toHaveBeenLastCalledWith("all", 2);
    expect(screen.getAllByLabelText(/^Saved Cebu Cafe/)).toHaveLength(1);
    expect(screen.getAllByRole("header")).toHaveLength(1);
  });

  it("retains loaded activity when the next page fails and retries that page", async () => {
    service.mockResolvedValueOnce(page([save], 1, true));
    service.mockRejectedValueOnce(new Error("Unavailable"));
    service.mockResolvedValueOnce(page([vouch], 2));
    const screen = await render(screenElement());
    await waitFor(() =>
      expect(screen.getByLabelText(/^Saved Cebu Cafe/)).toBeTruthy(),
    );
    const list = screen.getByTestId("activity-timeline-list");
    await fireEvent(list, "scrollBeginDrag");
    await fireEvent(list, "endReached");
    await waitFor(() =>
      expect(screen.getByText("Unable to load more activity")).toBeTruthy(),
    );
    expect(screen.getByLabelText(/^Saved Cebu Cafe/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Unable to load more activity. Tap to retry next page.",
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/^Vouched for Cebu Cafe/)).toBeTruthy(),
    );
    expect(service).toHaveBeenLastCalledWith("all", 2);
  });

  it("does not expose cached activity after signing out or switching accounts", async () => {
    const screen = await render(screenElement());
    await waitFor(() =>
      expect(screen.getByLabelText(/^Saved Cebu Cafe/)).toBeTruthy(),
    );
    mockUserId = null;
    await screen.rerender(screenElement());
    expect(screen.queryByLabelText(/^Saved Cebu Cafe/)).toBeNull();
    expect(screen.getByText("Sign in to view your activity")).toBeTruthy();
    expect(service).toHaveBeenCalledTimes(1);
    mockUserId = 2;
    service.mockResolvedValue(page([]));
    await screen.rerender(screenElement());
    await waitFor(() =>
      expect(screen.getByText("Your story starts here")).toBeTruthy(),
    );
    expect(screen.queryByLabelText(/^Saved Cebu Cafe/)).toBeNull();
  });

  it("preserves activity after a refresh failure and retries the current filter", async () => {
    service.mockResolvedValueOnce(page([save]));
    service.mockRejectedValueOnce(new Error("Unavailable"));
    service.mockResolvedValueOnce(page([vouch]));
    const screen = await render(screenElement());
    await waitFor(() =>
      expect(screen.getByLabelText(/^Saved Cebu Cafe/)).toBeTruthy(),
    );
    await act(async () => {
      screen
        .getByTestId("activity-timeline-list")
        .props.refreshControl.props.onRefresh();
    });
    await waitFor(() =>
      expect(screen.getByText("Unable to refresh activity")).toBeTruthy(),
    );
    expect(screen.getByLabelText(/^Saved Cebu Cafe/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Unable to refresh activity. Tap to retry.",
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/^Vouched for Cebu Cafe/)).toBeTruthy(),
    );
    expect(service).toHaveBeenLastCalledWith("all", 1);
  });
});
