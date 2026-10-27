import type { PropsWithChildren } from "react";
import {
  act,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import { myReviewsKey } from "@/features/profile/hooks/myReviewQueryKeys";
import { businessReviewFixture } from "../../__tests__/review.fixtures";
import {
  createReview,
  updateReview,
  getBusinessReviewPreview,
} from "../../api/reviewBusiness.service";
import AuthorReviewSubmissions from "../../components/business-profile/reviews/AuthorReviewSubmission";
import { useReviewWorkflowStore } from "../../stores/reviewWorkflow.store";
import type {
  BusinessReview,
  ReviewCreateResult,
} from "../../types/review.types";
import { useAuthorReviewSource } from "../useAuthorReviewSource";
import {
  useBusinessReviewPreview,
  useCreateReview,
  useUpdateReview,
} from "../useBusinessReviews";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
} from "../reviewQueryKeys";

jest.mock("../../api/reviewBusiness.service", () => ({
  createReview: jest.fn(),
  updateReview: jest.fn(),
  getBusinessReviewPreview: jest.fn(),
}));
jest.mock("../ReviewDerivedDataSyncProvider", () => ({
  useReviewDerivedDataSyncActions: () => ({
    observeReviewSubmission: jest.fn(),
    startSentimentSync: jest.fn(),
    startGeneratedInsightsSync: jest.fn(),
  }),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const input = {
  text: "A lovely visit with welcoming staff and great coffee.",
  photos: [{ uri: "file:///local.jpg" }],
  businessName: "Sugbo Cafe",
};
const acknowledged: ReviewCreateResult = {
  id: 18,
  business_id: 20,
  user_id: 10,
  status: "under_review",
  moderation_progress: { state: "pending" },
};

describe("private review submission workflow", () => {
  let client: QueryClient;
  beforeEach(() => {
    jest.resetAllMocks();
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 10, first_name: "Ana", last_name: "Cruz" } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
    jest.mocked(getBusinessReviewPreview).mockResolvedValue({
      success: true,
      message: "Loaded",
      data: { reviews: [], total_count: 0, user_review: null },
    });
  });
  afterEach(() => {
    client.clear();
    useAuthStore.setState({ user: null });
  });

  /** Supplies the same server caches to each route and mutation. */
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  async function startSubmission() {
    const request = deferred<Awaited<ReturnType<typeof createReview>>>();
    jest.mocked(createReview).mockReturnValueOnce(request.promise);
    const hook = await renderHook(() => useCreateReview(20), {
      wrapper: Wrapper,
    });
    let pending!: ReturnType<typeof hook.result.current.mutateAsync>;
    await act(async () => {
      pending = hook.result.current.mutateAsync(input);
      await Promise.resolve();
    });
    return { request, hook, pending };
  }

  function serverReview(overrides: Partial<BusinessReview> = {}) {
    return businessReviewFixture({
      ...acknowledged,
      text: input.text,
      created_at: new Date().toISOString(),
      photos: [{ id: 9, photo_url: "https://example.com/stored.jpg" }],
      is_own_review: true,
      author: {
        id: 10,
        first_name: "Ana",
        last_name: "Cruz",
        avatar_url: null,
      },
      ...overrides,
    });
  }

  function cacheReview(review: BusinessReview) {
    client.setQueryData(businessReviewPreviewKey(20), {
      reviews: review.status === "published" ? [review] : [],
      total_count: review.status === "published" ? 1 : 0,
      user_review: review,
    });
  }

  it("shows text and local photos immediately, without changing public caches or engagement", async () => {
    client.setQueryData(businessReviewsKey(20), {
      pages: [{ items: [], pagination: { total_items: 0 } }],
    });
    const original = client.getQueryData(businessReviewsKey(20));
    const { request, pending } = await startSubmission();
    const screen = await render(<AuthorReviewSubmissions businessId={20} />, {
      wrapper: Wrapper,
    });
    expect(screen.getByText("Submitting")).toBeTruthy();
    expect(screen.getByText(input.text)).toBeTruthy();
    expect(screen.getByText("file:///local.jpg")).toBeTruthy();
    expect(screen.queryByText("Engagement")).toBeNull();
    expect(client.getQueryData(businessReviewsKey(20))).toBe(original);
    await act(async () => {
      request.resolve({ success: true, message: "Saved", data: acknowledged });
      await pending;
    });
    expect(screen.getByText("Checking")).toBeTruthy();
    expect(useReviewWorkflowStore.getState().submissions[0].result?.id).toBe(
      18,
    );
    expect(client.getQueryData(businessReviewsKey(20))).toBe(original);
  });

  it("preserves one shared submission when the composer route unmounts", async () => {
    const { request, pending, hook } = await startSubmission();
    const first = await render(<AuthorReviewSubmissions businessId={20} />, {
      wrapper: Wrapper,
    });
    await first.unmount();
    await hook.unmount();
    const history = await render(<AuthorReviewSubmissions showBusiness />, {
      wrapper: Wrapper,
    });
    expect(history.getByText("Sugbo Cafe")).toBeTruthy();
    expect(history.getByText("Submitting")).toBeTruthy();
    await act(async () => {
      request.resolve({ success: true, message: "Saved", data: acknowledged });
      await pending;
    });
    await waitFor(() => expect(history.getByText("Checking")).toBeTruthy());
    expect(history.getAllByText(input.text)).toHaveLength(1);
  });

  it("replaces the snapshot with stored content and avoids duplicate confirmed cards", async () => {
    const { request, pending } = await startSubmission();
    await act(async () => {
      request.resolve({ success: true, message: "Saved", data: acknowledged });
      await pending;
    });
    const screen = await render(<AuthorReviewSubmissions businessId={20} />, {
      wrapper: Wrapper,
    });
    await act(async () =>
      cacheReview(
        serverReview({
          text: "The server is now authoritative.",
          photos: [{ id: 9, photo_url: "https://stored/photo.jpg" }],
        }),
      ),
    );
    expect(screen.getByText("The server is now authoritative.")).toBeTruthy();
    expect(screen.queryByText("file:///local.jpg")).toBeNull();
    await screen.rerender(
      <AuthorReviewSubmissions businessId={20} representedIds={[18]} />,
    );
    expect(screen.queryByTestId("author-review-submission")).toBeNull();
  });

  it.each([
    ["awaiting_retry", "Delayed"],
    ["awaiting_admin_review", "Under review"],
    ["retries_exhausted", "Needs review"],
    ["processing", "Checking"],
  ] as const)(
    "shares %s progress across business and history presentations",
    async (state, label) => {
      const { request, pending } = await startSubmission();
      await act(async () => {
        request.resolve({
          success: true,
          message: "Saved",
          data: acknowledged,
        });
        await pending;
        cacheReview(serverReview({ moderation_progress: { state } }));
      });
      const profile = await render(
        <AuthorReviewSubmissions businessId={20} />,
        { wrapper: Wrapper },
      );
      const history = await render(<AuthorReviewSubmissions showBusiness />, {
        wrapper: Wrapper,
      });
      expect(profile.getByText(label)).toBeTruthy();
      expect(history.getByText(label)).toBeTruthy();
    },
  );

  it("removes pending indicators after publication and shows rejection privately", async () => {
    const { request, pending } = await startSubmission();
    await act(async () => {
      request.resolve({ success: true, message: "Saved", data: acknowledged });
      await pending;
    });
    const screen = await render(<AuthorReviewSubmissions />, {
      wrapper: Wrapper,
    });
    await act(async () => cacheReview(serverReview({ status: "published" })));
    expect(screen.queryByText("Checking")).toBeNull();
    expect(screen.queryByText("Published")).toBeNull();
    await act(async () => cacheReview(serverReview({ status: "rejected" })));
    expect(screen.getByText("Not public")).toBeTruthy();
    expect(screen.queryByText("Engagement")).toBeNull();
  });

  it.each(["REQUEST_TIMEOUT", "NETWORK_ERROR", "UNKNOWN_ERROR"])(
    "retains an uncertain %s outcome and blocks duplicate submission",
    async (code) => {
      const { request, pending, hook } = await startSubmission();
      const failure = pending.catch(() => undefined);
      await act(async () => {
        request.reject({ code });
        await failure;
      });
      const screen = await render(<AuthorReviewSubmissions />, {
        wrapper: Wrapper,
      });
      expect(screen.getByText("Still confirming")).toBeTruthy();
      await act(async () => {
        await expect(
          hook.result.current.mutateAsync(input),
        ).rejects.toMatchObject({ code: "SUBMISSION_IN_PROGRESS" });
      });
      expect(createReview).toHaveBeenCalledTimes(1);
      await act(async () => cacheReview(serverReview()));
      expect(screen.getByText("Checking")).toBeTruthy();
    },
  );

  it("keeps a rejected submission draft and permits an explicit corrected attempt", async () => {
    const { request, pending, hook } = await startSubmission();
    const failure = pending.catch(() => undefined);
    await act(async () => {
      request.reject({ code: "VALIDATION_ERROR" });
      await failure;
    });
    const screen = await render(<AuthorReviewSubmissions />, {
      wrapper: Wrapper,
    });
    expect(screen.getByText("Not submitted")).toBeTruthy();
    expect(screen.getByText(input.text)).toBeTruthy();
    jest.mocked(createReview).mockResolvedValueOnce({
      success: true,
      message: "Saved",
      data: acknowledged,
    });
    await act(async () => {
      await hook.result.current.mutateAsync({
        ...input,
        text: "A corrected review with more detail about our visit.",
      });
    });
    expect(useReviewWorkflowStore.getState().submissions).toHaveLength(1);
    expect(screen.getByText("Checking")).toBeTruthy();
  });

  it.each(["account", "session"])(
    "clears private content and ignores late success on %s changes",
    async (boundary) => {
      const { request, pending } = await startSubmission();
      const screen = await render(<AuthorReviewSubmissions />, {
        wrapper: Wrapper,
      });
      await act(async () => {
        if (boundary === "account")
          useAuthStore.setState({ user: { id: 99 } as never });
        else beginAuthSession();
      });
      expect(screen.queryByText(input.text)).toBeNull();
      await act(async () => {
        request.resolve({
          success: true,
          message: "Saved",
          data: acknowledged,
        });
        await pending;
      });
      expect(useReviewWorkflowStore.getState().submissions).toEqual([]);
      expect(client.getQueryData(businessReviewPreviewKey(20))).toBeUndefined();
    },
  );

  it("reserves ownership immediately without incrementing a public count", async () => {
    const { request, pending } = await startSubmission();
    const preview = await renderHook(() => useBusinessReviewPreview(20), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(preview.result.current.hasOwnReview).toBe(true));
    expect(preview.result.current.userReview).toBeNull();
    expect(preview.result.current.totalCount).toBe(0);
    await act(async () => {
      request.resolve({ success: true, message: "Saved", data: acknowledged });
      await pending;
    });
  });

  it("does not regress a newer private source on an older paginated card", async () => {
    const old = serverReview({ updated_at: "2026-10-01T00:00:00Z" });
    cacheReview(
      serverReview({ status: "published", updated_at: "2026-10-02T00:00:00Z" }),
    );
    const hook = await renderHook(() => useAuthorReviewSource(20, old), {
      wrapper: Wrapper,
    });
    expect(hook.result.current.status).toBe("published");
    await act(async () =>
      cacheReview(
        serverReview({
          status: "rejected",
          updated_at: "2026-10-03T00:00:00Z",
        }),
      ),
    );
    expect(hook.result.current.status).toBe("rejected");
    expect(getBusinessReviewPreview).not.toHaveBeenCalled();
  });

  it("does not invent checking progress for a legacy acknowledgement", async () => {
    const { request, pending } = await startSubmission();
    await act(async () => {
      request.resolve({
        success: true,
        message: "Saved",
        data: { ...acknowledged, moderation_progress: undefined },
      });
      await pending;
    });
    const screen = await render(<AuthorReviewSubmissions />, {
      wrapper: Wrapper,
    });
    expect(screen.getByText("Under review")).toBeTruthy();
    expect(screen.queryByText("Checking")).toBeNull();
  });

  it("does not revive a local snapshot after an observed server record is deleted", async () => {
    const { request, pending } = await startSubmission();
    await act(async () => {
      request.resolve({ success: true, message: "Saved", data: acknowledged });
      await pending;
      cacheReview(serverReview());
    });
    const screen = await render(<AuthorReviewSubmissions />, {
      wrapper: Wrapper,
    });
    expect(screen.getByText("Checking")).toBeTruthy();
    await act(async () => {
      client.setQueryData(businessReviewPreviewKey(20), {
        reviews: [],
        total_count: 0,
        user_review: null,
      });
    });
    expect(screen.queryByText(input.text)).toBeNull();
    expect(useReviewWorkflowStore.getState().submissions).toEqual([]);
  });

  it("never substitutes an author's private source into another author's card", async () => {
    cacheReview(serverReview());
    const other = serverReview({
      text: "Another author's public review",
      author: {
        id: 99,
        first_name: "Other",
        last_name: "Author",
        avatar_url: null,
      },
    });
    const hook = await renderHook(() => useAuthorReviewSource(20, other), {
      wrapper: Wrapper,
    });
    expect(hook.result.current.text).toBe(other.text);
  });

  it("keeps confirmed content during edits and rejects stale mutation responses", async () => {
    const original = serverReview({
      status: "published",
      updated_at: "2026-10-01T00:00:00Z",
    });
    cacheReview(original);
    client.setQueryData(myReviewsKey(10), { pages: [{ items: [original] }] });
    const first = deferred<Awaited<ReturnType<typeof updateReview>>>();
    const second = deferred<Awaited<ReturnType<typeof updateReview>>>();
    jest
      .mocked(updateReview)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const hook = await renderHook(() => useUpdateReview(20), {
      wrapper: Wrapper,
    });
    const edits = { reviewId: 18, photos: [], textChanged: true };
    let firstPending!: Promise<unknown>;
    let secondPending!: Promise<unknown>;
    await act(async () => {
      firstPending = hook.result.current.mutateAsync({
        ...edits,
        text: "First proposed version",
      });
      await Promise.resolve();
    });
    expect(client.getQueryData(businessReviewPreviewKey(20))).toMatchObject({
      user_review: { text: input.text },
    });
    expect(useReviewWorkflowStore.getState().edits[18]).toBeDefined();
    await act(async () => {
      secondPending = hook.result.current.mutateAsync({
        ...edits,
        text: "Newest confirmed version",
      });
      await Promise.resolve();
    });
    await act(async () => {
      second.resolve({
        success: true,
        message: "Saved",
        data: {
          ...original,
          text: "Newest confirmed version",
          updated_at: "2026-10-03T00:00:00Z",
        },
      });
      await secondPending;
    });
    await act(async () => {
      first.resolve({
        success: true,
        message: "Saved",
        data: {
          ...original,
          text: "First proposed version",
          updated_at: "2026-10-02T00:00:00Z",
        },
      });
      await firstPending;
    });
    expect(client.getQueryData(businessReviewPreviewKey(20))).toMatchObject({
      user_review: { text: "Newest confirmed version" },
    });
    expect(useReviewWorkflowStore.getState().edits[18]).toBeUndefined();
  });
});
