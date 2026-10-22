import { act, render, waitFor } from "@testing-library/react-native";
import {
  onlineManager,
  QueryClient,
  useIsRestoring,
  useQuery,
} from "@tanstack/react-query";
import { persistQueryClientSave } from "@tanstack/react-query-persist-client";
import { Text } from "react-native";
import { z } from "zod";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import QueryPersistenceProvider from "../QueryPersistenceProvider";
import { createQueryPersistence } from "../queryPersistence.service";
import type { QueryPersistencePolicy } from "../queryPersistencePolicies";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);

const fixtureKey = ["provider-fixture"];
const fixturePolicy: QueryPersistencePolicy = {
  id: "provider-fixture",
  version: 1,
  kind: "query",
  matches: (key) => key[0] === "provider-fixture",
  maxAgeMs: 60_000,
  maxBytes: 1024,
  parse: (data) => z.object({ value: z.string() }).parse(data),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const liveFetch = jest.fn(async () => ({ value: "live" }));
const seen: string[] = [];
let client: QueryClient;
let runtime: ReturnType<typeof createQueryPersistence>;
let stored: string | null;
let storage: {
  getItem: jest.Mock<Promise<string | null>, []>;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

function Probe({
  staleTime = Infinity,
  local = false,
}: {
  staleTime?: number;
  local?: boolean;
}) {
  const restoring = useIsRestoring();
  const query = useQuery({
    queryKey: fixtureKey,
    queryFn: liveFetch,
    staleTime,
    networkMode: local ? "always" : "online",
  });
  const value = query.data?.value ?? "empty";
  seen.push(value);
  return <Text>{`${restoring ? "restoring" : "ready"}:${value}`}</Text>;
}

beforeEach(() => {
  stored = null;
  seen.length = 0;
  liveFetch.mockClear();
  onlineManager.setOnline(true);
  beginAuthSession("restore");
  useAuthStore.setState({
    user: { id: 7 } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  storage = {
    getItem: jest.fn(async () => stored),
    setItem: jest.fn(async (_name: string, value: string) => {
      stored = value;
    }),
    removeItem: jest.fn(async () => {
      stored = null;
    }),
  };
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  runtime = createQueryPersistence({
    storage,
    policies: [fixturePolicy],
    throttleTimeMs: 0,
  });
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  runtime.dispose();
  client.clear();
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
});

async function seed() {
  const seedClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  const seedSession = runtime.openSession(seedClient);
  const stop = seedSession.track();
  await seedClient.fetchQuery({
    queryKey: fixtureKey,
    queryFn: async () => ({ value: "previous" }),
  });
  await persistQueryClientSave({
    queryClient: seedClient,
    ...seedSession.persistOptions,
  });
  stop();
  runtime.dispose();
  seedClient.clear();
  runtime = createQueryPersistence({
    storage,
    policies: [fixturePolicy],
    throttleTimeMs: 0,
  });
}

it("blocks initial fetching until matching restoration is complete", async () => {
  await seed();
  const read = deferred<string | null>();
  const saved = stored;
  storage.getItem.mockImplementationOnce(() => read.promise);
  const screen = await render(
    <QueryPersistenceProvider client={client} persistence={runtime}>
      <Probe />
    </QueryPersistenceProvider>,
  );
  expect(screen.getByText("restoring:empty")).toBeTruthy();
  expect(liveFetch).not.toHaveBeenCalled();
  await act(async () => read.resolve(saved));
  await waitFor(() => expect(screen.getByText("ready:previous")).toBeTruthy());
  expect(liveFetch).not.toHaveBeenCalled();
  await screen.unmount();
});

it("revalidates stale restored content after the restoration gate opens", async () => {
  await seed();
  const screen = await render(
    <QueryPersistenceProvider client={client} persistence={runtime}>
      <Probe staleTime={0} />
    </QueryPersistenceProvider>,
  );
  await waitFor(() => expect(screen.getByText("ready:live")).toBeTruthy());
  expect(liveFetch).toHaveBeenCalledTimes(1);
  expect(seen).toContain("previous");
  await screen.unmount();
});

it("rejects an old provider's pending hydration after identity replacement", async () => {
  await seed();
  const saved = stored;
  const read = deferred<string | null>();
  storage.getItem.mockImplementationOnce(() => read.promise);
  const screen = await render(
    <QueryPersistenceProvider client={client} persistence={runtime}>
      <Probe />
    </QueryPersistenceProvider>,
  );
  await act(async () => {
    beginAuthSession();
    client.clear();
    useAuthStore.setState({ user: { id: 8 } as never });
  });
  seen.length = 0;
  await act(async () => read.resolve(saved));
  await waitFor(() => expect(screen.getByText("ready:live")).toBeTruthy());
  expect(seen).not.toContain("previous");
  expect(client.getQueryData(fixtureKey)).toEqual({ value: "live" });
  await screen.unmount();
});

it("opens the network gate after a storage failure", async () => {
  storage.getItem.mockRejectedValueOnce(new Error("Storage unavailable"));
  const screen = await render(
    <QueryPersistenceProvider client={client} persistence={runtime}>
      <Probe />
    </QueryPersistenceProvider>,
  );
  await waitFor(() => expect(screen.getByText("ready:live")).toBeTruthy());
  expect(liveFetch).toHaveBeenCalledTimes(1);
  await screen.unmount();
});

it("allows networkMode always local reads while the network manager is offline", async () => {
  onlineManager.setOnline(false);
  const screen = await render(
    <QueryPersistenceProvider client={client} persistence={runtime}>
      <Probe local />
    </QueryPersistenceProvider>,
  );
  await waitFor(() => expect(screen.getByText("ready:live")).toBeTruthy());
  expect(liveFetch).toHaveBeenCalledTimes(1);
  await screen.unmount();
});
