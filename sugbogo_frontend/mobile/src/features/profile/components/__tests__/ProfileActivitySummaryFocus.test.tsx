import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";
import { getMyReviews } from "../../api/myReviews.service";
import { myReviewsKey } from "../../hooks/myReviewQueryKeys";
import type { MyReviewPage, MyReview } from "../../types/myReview.types";
import ProfileActivitySummary from "../ProfileActivitySummary";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("../../api/myReviews.service", () => ({ getMyReviews: jest.fn() }));
jest.mock("@/features/pockets/hooks/usePocketCollections", () => ({
  __esModule: true,
  default: () => ({
    hasData: true,
    totalCount: 2,
    isLoading: false,
    error: null,
  }),
}));
jest.mock("../../hooks/useVouchHistory", () => ({
  __esModule: true,
  default: () => ({
    summary: { total_specialty_vouches: 4 },
    isLoading: false,
    error: null,
  }),
}));

const heldPage: MyReviewPage = {
  items: [{ id: 18, status: "under_review", business: { id: 20 } } as MyReview],
  pagination: {
    page: 1,
    page_size: 20,
    total_items: 3,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  },
};

describe("Profile summary review focus lifecycle", () => {
  let client: QueryClient;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockFocused = true;
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    useAuthStore.setState({
      user: { id: 10 } as User,
      isAuthenticated: true,
      isLoading: false,
    });
    jest.mocked(getMyReviews).mockResolvedValue({
      success: true,
      message: "Reviews loaded",
      data: heldPage,
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });
  afterEach(() => {
    client.clear();
    focusManager.setFocused(undefined);
    jest.useRealTimers();
  });

  function Summary() {
    return (
      <QueryClientProvider client={client}>
        <ProfileActivitySummary />
      </QueryClientProvider>
    );
  }

  it("polls held reviews while focused, pauses polling/recovery on blur, and resumes on return", async () => {
    const screen = await render(<Summary />);
    await waitFor(() =>
      expect(screen.getByLabelText("Reviews: 3")).toBeTruthy(),
    );
    const initialCalls = jest.mocked(getMyReviews).mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_100);
    });
    expect(jest.mocked(getMyReviews).mock.calls.length).toBeGreaterThan(
      initialCalls,
    );

    mockFocused = false;
    await screen.rerender(<Summary />);
    const blurredCalls = jest.mocked(getMyReviews).mock.calls.length;
    await act(async () => {
      focusManager.setFocused(false);
      onlineManager.setOnline(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(true);
      await jest.advanceTimersByTimeAsync(60_100);
    });
    expect(getMyReviews).toHaveBeenCalledTimes(blurredCalls);
    expect(screen.getByLabelText("Reviews: 3")).toBeTruthy();
    expect(client.getQueryData(myReviewsKey(10))).toBeDefined();

    mockFocused = true;
    await screen.rerender(<Summary />);
    await waitFor(() =>
      expect(jest.mocked(getMyReviews).mock.calls.length).toBeGreaterThan(
        blurredCalls,
      ),
    );
    const resumedCalls = jest.mocked(getMyReviews).mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_100);
    });
    expect(jest.mocked(getMyReviews).mock.calls.length).toBeGreaterThan(
      resumedCalls,
    );
    expect(screen.getByLabelText("Reviews: 3")).toBeTruthy();
    await screen.unmount();
  });
});
