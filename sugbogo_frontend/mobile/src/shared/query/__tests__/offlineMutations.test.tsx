import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react-native";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import useBusinessPocket from "@/features/explore/hooks/useBusinessPocket";
import useBusinessVouch from "@/features/explore/hooks/useBusinessVouch";
import { useReviewLike } from "@/features/explore/hooks/useReviewLike";
import {
  useCreateReview,
  useReportReview,
} from "@/features/explore/hooks/useBusinessReviews";
import { useNotificationMutations } from "@/features/notifications/hooks/useNotificationMutations";
import useReplacePocketMemberships from "@/features/pockets/hooks/useReplacePocketMemberships";
import {
  pocketBusiness,
  vouchForBusinessSpecialty,
} from "@/features/explore/api/exploreBusiness.service";
import {
  createReview,
  likeReview,
  reportReview,
} from "@/features/explore/api/reviewBusiness.service";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/api/notification.service";
import { replacePocketMembershipsWithOffline } from "@/features/pockets/services/pocketOfflineMemberships.service";
import { queryClient } from "../queryClient";

jest.mock("@/features/explore/api/exploreBusiness.service", () => ({
  pocketBusiness: jest.fn(),
  vouchForBusinessSpecialty: jest.fn(),
}));
jest.mock("@/features/explore/api/reviewBusiness.service", () => ({
  createReview: jest.fn(),
  likeReview: jest.fn(),
  reportReview: jest.fn(),
}));
jest.mock("@/features/notifications/api/notification.service", () => ({
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));
jest.mock("@/shared/api/storage.service", () => ({
  getInstallationId: jest.fn(async () => "installation"),
}));
jest.mock(
  "@/features/pockets/services/pocketOfflineMemberships.service",
  () => ({
    preparePocketOfflineChange: jest.fn(() => ({})),
    replacePocketMembershipsWithOffline: jest.fn(),
  }),
);

function useActions() {
  return {
    pocket: useBusinessPocket({ businessId: 20 }),
    memberships: useReplacePocketMemberships(20),
    vouch: useBusinessVouch({ businessId: 20 }),
    helpful: useReviewLike(20, 7),
    review: useCreateReview(20),
    report: useReportReview(20),
    notifications: useNotificationMutations(),
  };
}

type Actions = ReturnType<typeof useActions>;
const offline = { success: false, code: "NETWORK_ERROR", message: "Offline" };
const cases = [
  {
    name: "Pocket save",
    api: pocketBusiness,
    run: (a: Actions) => a.pocket.pocket({ isPocketed: false }),
  },
  {
    name: "Pocket memberships",
    api: replacePocketMembershipsWithOffline,
    run: (a: Actions) => a.memberships.replaceMemberships([1]),
  },
  {
    name: "vouch",
    api: vouchForBusinessSpecialty,
    run: (a: Actions) => a.vouch.vouch({ tagId: 4, isVouched: false }),
  },
  {
    name: "helpful",
    api: likeReview,
    run: (a: Actions) => a.helpful.mutateAsync({ reviewId: 7, isLiked: false }),
  },
  {
    name: "review submission",
    api: createReview,
    run: (a: Actions) => a.review.mutateAsync({ text: "Review", photos: [] }),
  },
  {
    name: "review report",
    api: reportReview,
    run: (a: Actions) =>
      a.report.mutateAsync({ reviewId: 7, reportType: "spam" }),
  },
  {
    name: "notification read",
    api: markNotificationRead,
    run: (a: Actions) => a.notifications.markRead(1),
  },
  {
    name: "notification read all",
    api: markAllNotificationsRead,
    run: (a: Actions) => a.notifications.markAllRead(),
  },
];

afterEach(() => {
  onlineManager.setOnline(true);
  useAuthStore.setState({ user: null, isAuthenticated: false });
});

it.each(cases)(
  "rejects an offline $name without pausing or replaying on reconnect",
  async (test) => {
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 7 } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    onlineManager.setOnline(false);
    jest.mocked(test.api).mockResolvedValue(offline as never);
    const client = new QueryClient({
      defaultOptions: {
        ...queryClient.getDefaultOptions(),
        queries: { retry: false, gcTime: 0 },
        mutations: {
          ...queryClient.getDefaultOptions().mutations,
          gcTime: Infinity,
        },
      },
    });
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }
    const hook = await renderHook(useActions, { wrapper: Wrapper });
    try {
      await act(async () => {
        await expect(test.run(hook.result.current)).rejects.toMatchObject({
          code: "NETWORK_ERROR",
        });
      });
      expect(test.api).toHaveBeenCalledTimes(1);
      expect(
        client
          .getMutationCache()
          .getAll()
          .some((mutation) => mutation.state.isPaused),
      ).toBe(false);
      expect(
        client
          .getMutationCache()
          .getAll()
          .some((mutation) => mutation.state.status === "pending"),
      ).toBe(false);
      await act(async () => onlineManager.setOnline(true));
      expect(test.api).toHaveBeenCalledTimes(1);
    } finally {
      await hook.unmount();
      client.clear();
    }
  },
);
