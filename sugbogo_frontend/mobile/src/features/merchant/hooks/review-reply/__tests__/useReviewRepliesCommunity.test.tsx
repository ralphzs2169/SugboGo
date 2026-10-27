import { useAuthStore } from "@/features/auth/store/auth.store";
import { merchantPlusReportFamily } from "../../analytics/merchantPlusAnalyticsQueryKeys";
import type { PropsWithChildren } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
  exploreBusinessDetailKey,
} from "@/features/explore/hooks/reviewQueryKeys";
import {
  merchantStandardAnalyticsScope,
  merchantUnansweredReviewsKey,
} from "../../analytics/merchantAnalyticsQueryKeys";
import { merchantReviewFeedKey } from "../../review-management/merchantReviewQueryKeys";

import * as replyService from "../../../api/reviewReply.service";
import {
  useCreateReviewReply,
  useDeleteReplyPhoto,
  useDeleteReviewReply,
  useUpdateReviewReply,
} from "../useReviewReplies";

jest.mock("../../../api/reviewReply.service", () => ({
  createReviewReply: jest.fn(),
  updateReviewReply: jest.fn(),
  deleteReviewReply: jest.fn(),
  deleteReplyPhoto: jest.fn(),
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  const invalidate = jest.spyOn(client, "invalidateQueries");

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  return { client, invalidate, Wrapper };
}

describe("merchant reply Community synchronization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 42 } as any });
  });
  afterEach(() => useAuthStore.setState({ user: null }));

  const cases = [
    {
      name: "creation",
      hook: useCreateReviewReply,
      service: replyService.createReviewReply,
      variables: { reviewId: 7, text: "Thanks!", photos: [] },
    },
    {
      name: "update",
      hook: useUpdateReviewReply,
      service: replyService.updateReviewReply,
      variables: {
        replyId: 9,
        text: "Updated thanks!",
        photos: [],
        keepPhotoIds: [],
      },
    },
    {
      name: "deletion",
      hook: useDeleteReviewReply,
      service: replyService.deleteReviewReply,
      variables: { replyId: 9 },
    },
    {
      name: "photo deletion",
      hook: useDeleteReplyPhoto,
      service: replyService.deleteReplyPhoto,
      variables: { photoId: 44 },
    },
  ] as const;

  it.each(cases)(
    "invalidates Community and existing merchant review surfaces after $name",
    async ({ hook, service, variables }) => {
      (service as jest.Mock).mockResolvedValue({
        success: true,
        data: null,
      });
      const { client, invalidate, Wrapper } = setup();
      const summaryKey = merchantUnansweredReviewsKey(42);
      const feedKey = merchantReviewFeedKey(42, 20, "needs-reply", "oldest");
      client.setQueryDefaults(summaryKey, { gcTime: Infinity });
      client.setQueryDefaults(feedKey, { gcTime: Infinity });
      client.setQueryData(summaryKey, { total_unanswered: 8 });
      client.setQueryData(feedKey, { pages: [], pageParams: [] });
      const { result, unmount } = await renderHook(() => hook(20), {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync(variables as never);
      });

      expect(service).toHaveBeenCalledTimes(1);
      expect(client.getQueryState(summaryKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(feedKey)?.isInvalidated).toBe(true);
      for (const queryKey of [
        COMMUNITY_REVIEWS_QUERY_KEY,
        businessReviewPreviewKey(20),
        businessReviewsKey(20),
        exploreBusinessDetailKey(20),
        merchantPlusReportFamily(42, "reviews"),
        merchantPlusReportFamily(42, "recommendations"),
      ]) {
        expect(invalidate).toHaveBeenCalledWith({ queryKey });
      }
      expect(invalidate).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: merchantStandardAnalyticsScope(42),
        }),
      );
      unmount();
      client.clear();
    },
  );

  it("keeps old photos until success and then refreshes the persisted empty collection", async () => {
    const { client, Wrapper } = setup();
    const key = businessReviewsKey(20);
    const previous = { reply: { id: 9, photos: [{ id: 44 }] } };
    let persisted = previous;
    client.setQueryData(key, previous);
    let complete: (value: unknown) => void = () => {};
    jest.mocked(replyService.updateReviewReply).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }) as never,
    );
    const { result, unmount } = await renderHook(
      () => ({
        query: useQuery({
          queryKey: key,
          queryFn: async () => persisted,
          staleTime: Infinity,
        }),
        mutation: useUpdateReviewReply(20),
      }),
      { wrapper: Wrapper },
    );
    let pending: Promise<unknown>;
    await act(async () => {
      pending = result.current.mutation.mutateAsync({
        replyId: 9,
        text: "Updated reply.",
        photos: [],
        keepPhotoIds: [],
      });
    });
    expect(result.current.query.data).toEqual(previous);
    await act(async () => {
      persisted = { reply: { id: 9, photos: [] } };
      complete({ success: true, data: persisted.reply });
      await pending!;
    });
    await waitFor(() =>
      expect(result.current.query.data?.reply.photos).toEqual([]),
    );
    expect(replyService.updateReviewReply).toHaveBeenCalledWith(
      9,
      "Updated reply.",
      [],
      [],
    );
    unmount();
    client.clear();
  });

  it("preserves cached reply photos and skips invalidation on a failed removal", async () => {
    const { client, invalidate, Wrapper } = setup();
    const key = businessReviewsKey(20);
    const previous = { reply: { id: 9, photos: [{ id: 44 }] } };
    client.setQueryDefaults(key, { gcTime: Infinity });
    client.setQueryData(key, previous);
    const failure = {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Unable to update.",
    };
    jest
      .mocked(replyService.updateReviewReply)
      .mockResolvedValueOnce(failure as never);
    const { result, unmount } = await renderHook(
      () => useUpdateReviewReply(20),
      { wrapper: Wrapper },
    );
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          replyId: 9,
          text: "Updated reply.",
          photos: [],
          keepPhotoIds: [],
        }),
      ).rejects.toEqual(failure);
    });
    expect(client.getQueryData(key)).toEqual(previous);
    expect(invalidate).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });
});
