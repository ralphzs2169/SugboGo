import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import {
  businessReviewPreviewKey,
  businessReviewsKey,
  exploreBusinessDetailKey,
} from "@/features/explore/hooks/reviewQueryKeys";

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
  beforeEach(() => jest.clearAllMocks());

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
      const { result, unmount } = await renderHook(() => hook(20), {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync(variables as never);
      });

      expect(service).toHaveBeenCalledTimes(1);
      for (const queryKey of [
        COMMUNITY_REVIEWS_QUERY_KEY,
        businessReviewPreviewKey(20),
        businessReviewsKey(20),
        exploreBusinessDetailKey(20),
      ]) {
        expect(invalidate).toHaveBeenCalledWith({ queryKey });
      }
      unmount();
      client.clear();
    },
  );
});
