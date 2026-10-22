import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClientSave } from "@tanstack/react-query-persist-client";
import { z } from "zod";

import { establishSession } from "@/features/auth/utils/authSession";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useRestoreSession } from "@/features/auth/hooks/useRestoreSession";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getCurrentUser } from "@/features/auth/api/auth.service";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import { createApiError } from "@/shared/utils/apiErrors";
import { createQueryPersistence } from "../queryPersistence.service";
import { QUERY_PERSISTENCE_STORAGE_KEY } from "../queryPersistencePolicies";
import { queryClient } from "../queryClient";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);
jest.mock("@/shared/api/storage.service", () => ({
  getRefreshToken: jest.fn(async () => null),
  getAccessToken: jest.fn(async () => "stored token"),
  saveSessionTokens: jest.fn(async () => true),
  clearSessionTokens: jest.fn(async () => true),
}));
jest.mock("@/features/auth/api/auth.service", () => ({
  getCurrentUser: jest.fn(),
}));
jest.mock("@/features/auth/api/token.service", () => ({
  revokeRefreshToken: jest.fn(),
}));
jest.mock("@/features/offline-routes/services/offlineAccess.service", () => ({
  clearOfflineAccess: jest.fn(async () => undefined),
  rememberOfflineResources: jest.fn(async () => undefined),
  getRestorableOfflineOwner: jest.fn(async () => 7),
}));
jest.mock("@/features/offline-routes/services/savedJourneys.service", () => ({
  clearSavedJourneysForLogout: jest.fn(async () => undefined),
}));
jest.mock("@/features/merchant/stores/merchantRegistrationStore", () => ({
  useMerchantRegistrationStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

let values: Map<string, string>;
let runtime: ReturnType<typeof createQueryPersistence>;
let stop: () => void;
const key = ["auth-persistence-fixture"];

function createRuntime() {
  return createQueryPersistence({
    throttleTimeMs: 0,
    storage: {
      getItem: async (name) => values.get(name) ?? null,
      setItem: async (name, value) => {
        values.set(name, value);
      },
      removeItem: async (name) => {
        values.delete(name);
      },
    },
    policies: [
      {
        id: "auth-fixture",
        version: 1,
        kind: "query",
        matches: (queryKey) => queryKey[0] === key[0],
        maxAgeMs: 60_000,
        maxBytes: 1024,
        parse: (data) => z.object({ value: z.string() }).parse(data),
      },
    ],
  });
}

beforeEach(async () => {
  values = new Map();
  queryClient.clear();
  beginAuthSession("restore");
  useAuthStore.setState({
    user: { id: 7 } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  runtime = createRuntime();
  const session = runtime.openSession(queryClient);
  stop = session.track();
  await queryClient.fetchQuery({
    queryKey: key,
    queryFn: async () => ({ value: "old private content" }),
  });
  await persistQueryClientSave({ queryClient, ...session.persistOptions });
});

afterEach(() => {
  stop();
  runtime.dispose();
  queryClient.clear();
});

it("uses the existing session establishment boundary to clear old disk and memory state", async () => {
  expect(values.has(QUERY_PERSISTENCE_STORAGE_KEY)).toBe(true);
  await establishSession({
    access: "new access",
    refresh: "new refresh",
    user: { id: 8 } as never,
  });
  await runtime.flush();
  expect(queryClient.getQueryData(key)).toBeUndefined();
  expect(values.has(QUERY_PERSISTENCE_STORAGE_KEY)).toBe(false);
  expect(useAuthStore.getState().user?.id).toBe(8);
});

it("uses the existing logout boundary to revoke temporary disk and memory state", async () => {
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  const hook = await renderHook(useLogout, { wrapper: Wrapper });
  await act(async () => {
    expect(await hook.result.current.logout()).toBe(true);
  });
  await runtime.flush();
  expect(queryClient.getQueryData(key)).toBeUndefined();
  expect(values.has(QUERY_PERSISTENCE_STORAGE_KEY)).toBe(false);
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  await hook.unmount();
});

it("discards temporary content after a transport-failed cold-start restoration", async () => {
  // Model a new process: disk survives, but no authenticated query state does.
  stop();
  runtime.dispose();
  queryClient.clear();
  runtime = createRuntime();
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  jest
    .mocked(getCurrentUser)
    .mockRejectedValueOnce(createApiError("NETWORK_ERROR"));
  const hook = await renderHook(useRestoreSession);
  await waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
  await runtime.flush();
  expect(values.has(QUERY_PERSISTENCE_STORAGE_KEY)).toBe(false);
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(queryClient.getQueryData(key)).toBeUndefined();
  await hook.unmount();
});
