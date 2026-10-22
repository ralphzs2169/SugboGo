import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { businessFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import { getExploreBusinessDetail } from "../../api/exploreBusiness.service";
import { recentBusinessDetails } from "../../services/recentBusinessDetails.service";
import useExploreBusinessProfile from "../useExploreBusinessProfile";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);
jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(),
}));

let client: QueryClient;
beforeEach(async () => {
  beginAuthSession();
  useAuthStore.setState({
    user: { id: 7 } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  await recentBusinessDetails.flush();
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: Infinity },
    },
  });
  jest.mocked(getExploreBusinessDetail).mockReset();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  await recentBusinessDetails.flush();
  jest.restoreAllMocks();
});
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

it("saves an authoritative fetch without letting a storage failure break live rendering", async () => {
  jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("quota"));
  jest.mocked(getExploreBusinessDetail).mockResolvedValue({
    success: true,
    message: "Loaded",
    data: businessFixture(),
  });
  const hook = await renderHook(() => useExploreBusinessProfile(21), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(hook.result.current.business?.id).toBe(21));
  await recentBusinessDetails.flush();
  expect(hook.result.current.error).toBeNull();
});

it("removes denied details from both temporary storage and retained live Query data", async () => {
  jest.mocked(getExploreBusinessDetail).mockResolvedValueOnce({
    success: true,
    message: "Loaded",
    data: businessFixture(),
  });
  const hook = await renderHook(() => useExploreBusinessProfile(21), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(hook.result.current.business?.id).toBe(21));
  await recentBusinessDetails.flush();
  expect(await recentBusinessDetails.capture().get(21)).not.toBeNull();
  jest.mocked(getExploreBusinessDetail).mockResolvedValue({
    success: false,
    code: "NOT_FOUND",
    message: "The business could not be found.",
  });
  await act(async () => {
    await hook.result.current.refetch();
  });
  await waitFor(() => expect(hook.result.current.business).toBeNull());
  expect(hook.result.current.error).toMatchObject({ code: "NOT_FOUND" });
  await recentBusinessDetails.flush();
  expect(await recentBusinessDetails.capture().get(21)).toBeNull();
  // Even a later ambiguous error must not resurrect the denied in-memory DTO.
  jest.mocked(getExploreBusinessDetail).mockResolvedValue({
    success: false,
    code: "NETWORK_ERROR",
    message: "Offline",
  });
  await act(async () => {
    await hook.result.current.refetch();
  });
  expect(hook.result.current.business).toBeNull();
});
