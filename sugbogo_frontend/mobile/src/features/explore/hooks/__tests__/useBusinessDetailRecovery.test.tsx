import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { businessFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import { getExploreBusinessDetail } from "../../api/exploreBusiness.service";
import { recentBusinessDetails } from "../../services/recentBusinessDetails.service";
import useBusinessDetailSource from "../useBusinessDetailSource";
import { exploreBusinessDetailKey } from "../reviewQueryKeys";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);
jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(),
}));
jest.mock(
  "@/features/offline-pockets/hooks/useOfflineBusinessSnapshots",
  () => ({
    __esModule: true,
    default: () => ({ ownerId: 7, isPending: false, isError: false }),
  }),
);

let client: QueryClient;
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(async () => {
  beginAuthSession();
  useAuthStore.setState({
    user: { id: 7 } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  await recentBusinessDetails.flush();
  onlineManager.setOnline(true);
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: Infinity },
    },
  });
  jest.mocked(getExploreBusinessDetail).mockReset().mockResolvedValue({
    success: true,
    message: "Loaded",
    data: businessFixture(),
  });
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  onlineManager.setOnline(true);
  await recentBusinessDetails.flush();
});

it("requires a successful API response after reconnect rather than retained or manually updated Query data", async () => {
  const hook = await renderHook(() => useBusinessDetailSource(21), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(hook.result.current.source).toBe("live"));
  await recentBusinessDetails.flush();
  await act(async () => onlineManager.setOnline(false));
  await waitFor(() => expect(hook.result.current.source).toBe("recent"));
  const response =
    deferred<Awaited<ReturnType<typeof getExploreBusinessDetail>>>();
  jest.mocked(getExploreBusinessDetail).mockReturnValue(response.promise);
  await act(async () => onlineManager.setOnline(true));
  await waitFor(() =>
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(2),
  );
  expect(hook.result.current.source).toBe("recent");
  await act(async () => {
    client.setQueryData(exploreBusinessDetailKey(21), {
      ...businessFixture(),
      business_name: "Manual update",
    });
  });
  expect(hook.result.current.source).toBe("recent");
  await act(async () =>
    response.resolve({
      success: true,
      message: "Loaded",
      data: { ...businessFixture(), business_name: "Fresh response" },
    }),
  );
  await waitFor(() => expect(hook.result.current.source).toBe("live"));
  expect(hook.result.current.business?.business_name).toBe("Fresh response");
  await hook.unmount();
});

it("retains fallback on recovery failure and revokes it on definitive denial", async () => {
  const hook = await renderHook(() => useBusinessDetailSource(21), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(hook.result.current.source).toBe("live"));
  await recentBusinessDetails.flush();
  await act(async () => onlineManager.setOnline(false));
  await waitFor(() => expect(hook.result.current.source).toBe("recent"));
  jest.mocked(getExploreBusinessDetail).mockResolvedValue({
    success: false,
    code: "NETWORK_ERROR",
    message: "Offline",
  });
  await act(async () => onlineManager.setOnline(true));
  await waitFor(() =>
    expect(hook.result.current.error).toMatchObject({ code: "NETWORK_ERROR" }),
  );
  expect(hook.result.current.source).toBe("recent");
  jest.mocked(getExploreBusinessDetail).mockResolvedValue({
    success: false,
    code: "PERMISSION_DENIED",
    message: "Unavailable",
  });
  await act(async () => {
    await hook.result.current.refetch();
  });
  await waitFor(() => expect(hook.result.current.source).toBe("unavailable"));
  expect(hook.result.current.snapshot).toBeNull();
  await hook.unmount();
});
