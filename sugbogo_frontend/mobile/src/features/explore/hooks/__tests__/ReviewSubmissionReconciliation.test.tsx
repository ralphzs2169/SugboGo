import type { PropsWithChildren } from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
} from "@testing-library/react-native";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import { getMyReviews } from "@/features/profile/api/myReviews.service";
import { useMyReviews } from "@/features/profile/hooks/useMyReviews";
import { businessReviewFixture } from "../../__tests__/review.fixtures";
import { getExploreBusinessDetail } from "../../api/exploreBusiness.service";
import {
  createReview,
  getBusinessReviewPreview,
} from "../../api/reviewBusiness.service";
import AuthorReviewSubmissions from "../../components/business-profile/reviews/AuthorReviewSubmission";
import {
  isUncertainReviewSubmissionOutcome,
  matchesReviewSubmission,
  settleReviewSubmission,
  useReviewWorkflowStore,
} from "../../stores/reviewWorkflow.store";
import type {
  BusinessReview,
  ReviewCreateResult,
} from "../../types/review.types";
import { ReviewDerivedDataSyncProvider } from "../ReviewDerivedDataSyncProvider";
import { useCreateReview } from "../useBusinessReviews";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
} from "../reviewQueryKeys";

let mockFocused = true;
jest.mock("expo-router", () => ({
  useIsFocused: () => mockFocused,
  useNavigation: () => ({ isFocused: () => mockFocused }),
  router: { push: jest.fn() },
}));
jest.mock("../../api/reviewBusiness.service", () => ({
  createReview: jest.fn(),
  getBusinessReviewPreview: jest.fn(),
}));
jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(),
}));
jest.mock("@/features/profile/api/myReviews.service", () => ({
  getMyReviews: jest.fn(),
}));
jest.mock("../../components/business-profile/reviews/ReviewContent", () => {
  const { Text, View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: ({
      review,
      showEngagement,
    }: {
      review: BusinessReview;
      showEngagement: boolean;
    }) => (
      <View>
        <Text>{review.text}</Text>
        {review.photos.map((photo) => (
          <Text key={photo.id}>{photo.photo_url}</Text>
        ))}
        {showEngagement && <Text>Engagement</Text>}
      </View>
    ),
  };
});

const input = {
  text: "A lovely visit with welcoming staff and great coffee.",
  photos: [{ uri: "file:///local.jpg" }],
  businessName: "Sugbo Cafe",
};
const receipt: ReviewCreateResult = {
  id: 18,
  business_id: 20,
  user_id: 10,
  status: "under_review",
  moderation_progress: { state: "pending" },
};

describe("uncertain review submission reconciliation", () => {
  let client: QueryClient;
  let server: BusinessReview | null;
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["queueMicrotask"] });
    jest.setSystemTime(new Date("2026-10-23T01:00:00Z"));
    jest.resetAllMocks();
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 10 } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    mockFocused = true;
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    server = null;
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        // Creation must override a caller's retry preference.
        mutations: { retry: 3, gcTime: Infinity },
      },
    });
    jest.mocked(getBusinessReviewPreview).mockImplementation(async () => ({
      success: true,
      message: "Loaded",
      data: { reviews: [], total_count: 0, user_review: server },
    }));
    jest.mocked(getExploreBusinessDetail).mockResolvedValue({
      success: true,
      message: "Loaded",
      data: { id: 20, review_insights: null } as never,
    });
    jest.mocked(createReview).mockRejectedValue({ code: "REQUEST_TIMEOUT" });
  });

  afterEach(async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    await cleanup?.();
    cleanup = undefined;
    await client.cancelQueries();
    client.clear();
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    jest.useRealTimers();
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>
        <ReviewDerivedDataSyncProvider businessId={20}>
          {children}
        </ReviewDerivedDataSyncProvider>
      </QueryClientProvider>
    );
  }

  async function advance(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += 1_000) {
      await act(async () => {
        jest.advanceTimersByTime(Math.min(1_000, ms - elapsed));
        await Promise.resolve();
      });
    }
  }

  function stored(overrides: Partial<BusinessReview> = {}) {
    return businessReviewFixture({
      id: 18,
      text: input.text,
      photos: [{ id: 9, photo_url: "https://example.com/stored.jpg" }],
      created_at: new Date().toISOString(),
      status: "under_review",
      moderation_progress: { state: "pending" },
      author: {
        id: 10,
        first_name: "Ana",
        last_name: "Cruz",
        avatar_url: null,
      },
      ...overrides,
    });
  }

  async function mount(submit = true) {
    const hook = await renderHook(() => useCreateReview(20), {
      wrapper: Wrapper,
    });
    cleanup = hook.unmount;
    if (submit) {
      await act(async () => {
        await hook.result.current.mutateAsync(input).catch(() => undefined);
      });
    }
    await advance(1);
    return hook;
  }

  it("keeps empty early reads uncertain and adopts a later committed review without another POST", async () => {
    await mount();
    expect(useReviewWorkflowStore.getState().submissions[0].state).toBe(
      "confirming",
    );
    await advance(10_001);
    expect(
      useReviewWorkflowStore.getState().submissions[0].result,
    ).toBeUndefined();
    expect(
      jest.mocked(getBusinessReviewPreview).mock.calls.length,
    ).toBeGreaterThan(1);
    server = stored();
    await advance(5_001);
    expect(useReviewWorkflowStore.getState().submissions[0]).toMatchObject({
      state: "acknowledged",
      result: receipt,
    });
    expect(createReview).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(businessReviewsKey(20))).toBeUndefined();
  });

  it("keeps normal success authoritative across duplicate responses", async () => {
    jest
      .mocked(createReview)
      .mockResolvedValue({ success: true, message: "Saved", data: receipt });
    await mount();
    const token = useReviewWorkflowStore.getState().submissions[0].token;
    await act(async () => {
      settleReviewSubmission(token, { ...receipt, id: 99 });
      settleReviewSubmission(token, undefined, true);
    });
    expect(useReviewWorkflowStore.getState().submissions[0]).toMatchObject({
      state: "acknowledged",
      result: receipt,
    });
    expect(createReview).toHaveBeenCalledTimes(1);
  });

  it("blocks simultaneous duplicate taps and preserves confirmation before a late request error", async () => {
    let reject!: (reason: unknown) => void;
    jest.mocked(createReview).mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const hook = await mount(false);
    let pending!: Promise<unknown>;
    await act(async () => {
      pending = hook.result.current.mutateAsync(input).catch(() => undefined);
      await Promise.resolve();
      await expect(
        hook.result.current.mutateAsync(input),
      ).rejects.toMatchObject({ code: "SUBMISSION_IN_PROGRESS" });
    });
    server = stored();
    await act(async () => {
      await client.refetchQueries({ queryKey: businessReviewPreviewKey(20) });
    });
    await advance(1);
    expect(useReviewWorkflowStore.getState().submissions[0].result?.id).toBe(
      18,
    );
    await act(async () => {
      reject({ code: "REQUEST_TIMEOUT" });
      await pending;
    });
    expect(useReviewWorkflowStore.getState().submissions[0].state).toBe(
      "acknowledged",
    );
    expect(createReview).toHaveBeenCalledTimes(1);
  });

  it("ends automatic checks with a private actionable unknown state and preserves photos", async () => {
    const hook = await mount();
    const screen = await render(<AuthorReviewSubmissions businessId={20} />, {
      wrapper: Wrapper,
    });
    await advance(60_001);
    expect(screen.getByText("Unable to confirm submission")).toBeTruthy();
    expect(screen.getByText(input.text)).toBeTruthy();
    expect(screen.getByText("file:///local.jpg")).toBeTruthy();
    expect(screen.queryByText("Engagement")).toBeNull();
    const checks = jest.mocked(getBusinessReviewPreview).mock.calls.length;
    await advance(20_001);
    expect(getBusinessReviewPreview).toHaveBeenCalledTimes(checks);
    await act(async () => {
      await expect(
        hook.result.current.mutateAsync(input),
      ).rejects.toMatchObject({ code: "SUBMISSION_IN_PROGRESS" });
      fireEvent.press(screen.getByText("Check again"));
    });
    await advance(1);
    expect(useReviewWorkflowStore.getState().submissions[0].state).toBe(
      "confirming",
    );
    server = stored();
    await advance(5_001);
    expect(useReviewWorkflowStore.getState().submissions[0].result?.id).toBe(
      18,
    );
    expect(createReview).toHaveBeenCalledTimes(1);
    await screen.rerender(
      <AuthorReviewSubmissions businessId={20} representedIds={[18]} />,
    );
    expect(screen.queryByTestId("author-review-submission")).toBeNull();
    await screen.unmount();
  });

  it.each(["foreground", "reconnect", "navigation"])(
    "recovers after %s without re-uploading",
    async (event) => {
      const hook = await mount();
      await act(async () => {
        if (event === "foreground") focusManager.setFocused(false);
        else if (event === "reconnect") onlineManager.setOnline(false);
        else {
          mockFocused = false;
          await hook.rerender({});
        }
      });
      const calls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
      await advance(65_001);
      expect(getBusinessReviewPreview).toHaveBeenCalledTimes(calls);
      server = stored();
      await act(async () => {
        if (event === "foreground") focusManager.setFocused(true);
        else if (event === "reconnect") onlineManager.setOnline(true);
        else {
          mockFocused = true;
          await hook.rerender({});
        }
      });
      await advance(1);
      expect(useReviewWorkflowStore.getState().submissions[0].result?.id).toBe(
        18,
      );
      expect(createReview).toHaveBeenCalledTimes(1);
    },
  );

  it("does not queue an offline creation for a later automatic upload", async () => {
    onlineManager.setOnline(false);
    jest.mocked(createReview).mockRejectedValue({ code: "NETWORK_ERROR" });
    await mount();
    expect(createReview).toHaveBeenCalledTimes(1);
    await act(async () => {
      onlineManager.setOnline(true);
    });
    await advance(10_001);
    expect(createReview).toHaveBeenCalledTimes(1);
  });

  it("adopts a matching private My Reviews result when business preview remains empty", async () => {
    await mount();
    const review = {
      ...stored(),
      edited_at: null,
      show_in_community: true,
      business: {
        id: 20,
        business_name: "Sugbo Cafe",
        display_cover_photo_url: null,
        category: { id: 1, name: "Cafe" },
        status: "active",
      },
    };
    jest.mocked(getMyReviews).mockResolvedValue({
      success: true,
      message: "Loaded",
      data: {
        items: [review],
        pagination: {
          page: 1,
          page_size: 20,
          total_items: 1,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
      },
    });
    const history = await renderHook(() => useMyReviews(), {
      wrapper: Wrapper,
    });
    await advance(1);
    expect(getMyReviews).toHaveBeenCalled();
    expect(useReviewWorkflowStore.getState().submissions[0].result?.id).toBe(
      18,
    );
    expect(client.getQueryData(businessReviewsKey(20))).toBeUndefined();
    await history.unmount();
  });

  it("does not associate an old, conflicting, or previously known review with the upload", async () => {
    await mount();
    const draft = useReviewWorkflowStore.getState().submissions[0];
    expect(matchesReviewSubmission(draft, stored({
      created_at: new Date(Date.now() + 3_600_000).toISOString(),
    }), 20)).toBe(false);
    expect(matchesReviewSubmission(draft, stored({ photos: [] }), 20)).toBe(false);
    expect(
      matchesReviewSubmission(draft, stored({ text: "Other text" }), 20),
    ).toBe(false);
    expect(
      matchesReviewSubmission(
        draft,
        stored({ created_at: "2026-10-22T00:00:00Z" }),
        20,
      ),
    ).toBe(false);
    expect(
      matchesReviewSubmission(
        { ...draft, previousReviewIds: [18] },
        stored(),
        20,
      ),
    ).toBe(false);
    expect(matchesReviewSubmission(draft, stored(), 21)).toBe(false);
  });

  it.each(["account", "session"])(
    "cancels private reconciliation on %s replacement",
    async (event) => {
      await mount();
      await act(async () => {
        if (event === "account")
          useAuthStore.setState({ user: { id: 99 } as never });
        else beginAuthSession();
      });
      const calls = jest.mocked(getBusinessReviewPreview).mock.calls.length;
      server = stored();
      await advance(65_001);
      expect(useReviewWorkflowStore.getState().submissions).toEqual([]);
      expect(getBusinessReviewPreview).toHaveBeenCalledTimes(calls);
    },
  );

  it("hands confirmed publication to the existing synchronization flow", async () => {
    await mount();
    server = stored({
      status: "published",
      moderation_progress: { state: "published" },
    });
    await advance(5_001);
    expect(
      useReviewWorkflowStore.getState().submissions[0].result?.status,
    ).toBe("published");
    expect(
      client.getQueryData<{ user_review: BusinessReview }>(
        businessReviewPreviewKey(20),
      )?.user_review.id,
    ).toBe(18);
    expect(createReview).toHaveBeenCalledTimes(1);
  });

  it.each([
    "REQUEST_TIMEOUT",
    "NETWORK_ERROR",
    "UNKNOWN_ERROR",
    "SERVER_ERROR",
    "SERVICE_UNAVAILABLE",
    undefined,
  ])("keeps %s uncertain", (code) => {
    expect(isUncertainReviewSubmissionOutcome({ code })).toBe(true);
  });

  it.each(["VALIDATION_ERROR", "PERMISSION_DENIED", "RATE_LIMIT_EXCEEDED"])(
    "treats %s as definitive rejection",
    (code) => {
      expect(isUncertainReviewSubmissionOutcome({ code })).toBe(false);
    },
  );
});
