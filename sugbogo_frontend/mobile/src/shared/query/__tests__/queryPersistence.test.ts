import { dehydrate, QueryClient } from "@tanstack/react-query";
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client";
import { z } from "zod";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import { createQueryPersistence } from "../queryPersistence.service";
import {
  QUERY_PERSISTENCE_LIMITS,
  QUERY_PERSISTENCE_POLICIES,
  QUERY_PERSISTENCE_STORAGE_KEY,
  serializedBytes,
  trimPersistedPages,
  type QueryPersistencePolicy,
} from "../queryPersistencePolicies";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);

const key = ["persistence-fixture", 1] as const;
const policy: QueryPersistencePolicy = {
  id: "fixture",
  version: 1,
  kind: "query",
  matches: (queryKey) => queryKey[0] === "persistence-fixture",
  maxAgeMs: 60_000,
  maxBytes: 1024,
  parse: (data) => z.object({ value: z.string() }).parse(data),
};
const infinitePolicy: QueryPersistencePolicy = {
  ...policy,
  id: "infinite-fixture",
  kind: "infinite",
  maxPages: 2,
  parse: (data) =>
    z
      .object({
        pages: z.array(z.object({ items: z.array(z.string()) })),
        pageParams: z.array(z.number()),
      })
      .parse(data),
};

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: jest.fn(async (name: string) => values.get(name) ?? null),
    setItem: jest.fn(async (name: string, value: string) => {
      values.set(name, value);
    }),
    removeItem: jest.fn(async (name: string) => {
      values.delete(name);
    }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let clock: number;
let apiScope: string;
let storage: ReturnType<typeof memoryStorage>;
const cleanup: (() => void)[] = [];

function authenticate(ownerId = 7) {
  useAuthStore.setState({
    user: { id: ownerId } as never,
    isAuthenticated: true,
    isLoading: false,
  });
}

function setup({
  policies = [policy],
  limits = QUERY_PERSISTENCE_LIMITS,
}: {
  policies?: readonly QueryPersistencePolicy[];
  limits?: { maxBytes: number; maxEntryBytes: number; maxEntries: number };
} = {}) {
  const runtime = createQueryPersistence({
    storage,
    policies,
    limits,
    now: () => clock,
    getApiScope: () => apiScope,
    throttleTimeMs: 0,
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const session = runtime.openSession(client);
  const stop = session.track();
  cleanup.push(() => {
    stop();
    runtime.dispose();
    client.clear();
  });
  return {
    runtime,
    client,
    session,
    save: () =>
      persistQueryClientSave({
        queryClient: client,
        ...session.persistOptions,
      }),
    restore: () =>
      persistQueryClientRestore({
        queryClient: client,
        ...session.persistOptions,
      }),
    fetch: (value = "server", queryKey: readonly unknown[] = key) =>
      client.fetchQuery({
        queryKey,
        queryFn: async () => ({ value }),
      }),
  };
}

function stored() {
  const json = storage.values.get(QUERY_PERSISTENCE_STORAGE_KEY);
  return json ? JSON.parse(json) : undefined;
}

async function seed() {
  const original = setup();
  await original.fetch();
  await original.save();
  original.runtime.dispose();
  return storage.values.get(QUERY_PERSISTENCE_STORAGE_KEY)!;
}

beforeEach(() => {
  clock = 100_000;
  apiScope = "https://api.example.test/api";
  storage = memoryStorage();
  jest.spyOn(Date, "now").mockImplementation(() => clock);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  beginAuthSession("restore");
  authenticate();
});

afterEach(async () => {
  cleanup.splice(0).forEach((stop) => stop());
  useAuthStore.setState({ user: null, isAuthenticated: false });
  jest.restoreAllMocks();
});

it("excludes arbitrary query families by default", async () => {
  const context = setup({ policies: QUERY_PERSISTENCE_POLICIES });
  for (const prefix of [
    "explore-discovery-results",
    "notifications",
    "auth",
    "login-history",
    "merchant-plus-status",
    "business-review-preview",
  ]) {
    await context.fetch("private", [prefix]);
  }
  await context.save();
  expect(storage.setItem).not.toHaveBeenCalled();
});

it("restores a validated query for the matching owner and API", async () => {
  await seed();
  const restored = setup();
  await restored.restore();
  expect(restored.client.getQueryData(key)).toEqual({ value: "server" });
  expect(restored.client.getQueryState(key)?.dataUpdatedAt).toBe(100_000);
  expect(stored()).toMatchObject({
    formatVersion: 1,
    policyVersion: 1,
    ownerId: 7,
    apiScope,
  });
  expect(JSON.stringify(stored())).not.toMatch(
    /sessionGeneration|refresh_token|access_token/,
  );
});

it.each(["owner", "API", "format", "policy", "DTO"])(
  "discards a cache with the wrong %s",
  async (mismatch) => {
    const raw = JSON.parse(await seed());
    if (mismatch === "owner") raw.ownerId = 8;
    if (mismatch === "API") raw.apiScope = "https://other.example.test";
    if (mismatch === "format") raw.formatVersion = 2;
    if (mismatch === "policy") raw.policyVersion = 2;
    if (mismatch === "DTO") raw.entries[0].policyVersion = 2;
    storage.values.set(QUERY_PERSISTENCE_STORAGE_KEY, JSON.stringify(raw));
    const context = setup();
    await expect(context.restore()).resolves.toBeUndefined();
    expect(context.client.getQueryData(key)).toBeUndefined();
    expect(storage.values.has(QUERY_PERSISTENCE_STORAGE_KEY)).toBe(false);
  },
);

it.each(["{broken", "null", '{"entries":[]}'])(
  "discards corrupt data without blocking Query: %s",
  async (json) => {
    storage.values.set(QUERY_PERSISTENCE_STORAGE_KEY, json);
    const context = setup();
    await expect(context.restore()).resolves.toBeUndefined();
    await expect(context.fetch()).resolves.toEqual({ value: "server" });
    expect(storage.values.has(QUERY_PERSISTENCE_STORAGE_KEY)).toBe(false);
  },
);

it("does not renew retention through optimistic writes, restore, or unrelated saves", async () => {
  const context = setup();
  await context.fetch();
  clock += 10_000;
  context.client.setQueryData(key, { value: "optimistic" });
  await context.save();
  expect(stored().entries[0]).toMatchObject({
    fetchedAt: 100_000,
    data: { value: "server" },
  });
  context.runtime.dispose();
  const restored = setup();
  await restored.restore();
  clock += 10_000;
  await restored.fetch("another", ["persistence-fixture", 2]);
  await restored.save();
  expect(
    stored().entries.find(
      (entry: { queryKey: unknown[] }) => entry.queryKey[1] === 1,
    ).fetchedAt,
  ).toBe(100_000);
  clock = 160_000;
  restored.runtime.dispose();
  const expired = setup();
  await expired.restore();
  expect(expired.client.getQueryData(key)).toBeUndefined();
  expect(expired.client.getQueryData(["persistence-fixture", 2])).toEqual({
    value: "another",
  });
});

it("retains a confirmed snapshot when a later refetch fails", async () => {
  const context = setup();
  await context.fetch();
  await expect(
    context.client.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        throw new Error("Offline");
      },
    }),
  ).rejects.toThrow("Offline");
  await context.save();
  expect(stored().entries[0].data).toEqual({ value: "server" });
});

it("does not persist manual initial data or optimistic-only state", async () => {
  const context = setup();
  context.client.setQueryData(key, { value: "optimistic only" });
  await context.save();
  expect(storage.setItem).not.toHaveBeenCalled();
});

it("never serializes or restores mutations, including paused ones", async () => {
  const context = setup();
  await context.fetch();
  context.client.getMutationCache().build(
    context.client,
    {},
    {
      context: { secret: "restricted mutation" },
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isPaused: true,
      status: "pending",
      variables: { secret: "restricted mutation" },
      submittedAt: clock,
    },
  );
  expect(
    dehydrate(context.client, context.session.persistOptions.dehydrateOptions)
      .mutations,
  ).toEqual([]);
  await context.save();
  expect(JSON.stringify(stored())).not.toContain("restricted mutation");
  context.runtime.dispose();
  const restored = setup();
  await restored.restore();
  expect(restored.client.getMutationCache().getAll()).toHaveLength(0);
});

it("skips oversized payloads and keeps the total UTF-8 budget bounded", async () => {
  const context = setup({
    limits: { maxBytes: 700, maxEntryBytes: 500, maxEntries: 2 },
  });
  await context.fetch("x".repeat(1000));
  await context.save();
  expect(storage.setItem).not.toHaveBeenCalled();
  await context.fetch("first", ["persistence-fixture", 1]);
  clock += 1;
  await context.fetch("second", ["persistence-fixture", 2]);
  clock += 1;
  await context.fetch("third", ["persistence-fixture", 3]);
  await context.save();
  expect(stored().entries).toHaveLength(2);
  expect(
    stored().entries.map(
      (entry: { data: { value: string } }) => entry.data.value,
    ),
  ).toEqual(["third", "second"]);
  expect(
    serializedBytes(storage.values.get(QUERY_PERSISTENCE_STORAGE_KEY)!),
  ).toBeLessThanOrEqual(700);
  expect(serializedBytes("é😀")).toBe(6);
});

it("evicts older valid entries when bytes, rather than entry count, exhaust the budget", async () => {
  const limits = { ...QUERY_PERSISTENCE_LIMITS };
  const context = setup({ limits });
  await context.fetch("first");
  await context.save();
  limits.maxBytes =
    serializedBytes(storage.values.get(QUERY_PERSISTENCE_STORAGE_KEY)!) + 5;
  clock += 1;
  await context.fetch("second", ["persistence-fixture", 2]);
  await context.save();
  expect(stored().entries).toHaveLength(1);
  expect(stored().entries[0].data.value).toBe("second");
  expect(
    serializedBytes(storage.values.get(QUERY_PERSISTENCE_STORAGE_KEY)!),
  ).toBeLessThanOrEqual(limits.maxBytes);
});

it("does not delete unrelated storage when discarding temporary content", async () => {
  storage.values.set("hasCompletedOnboarding", "true");
  storage.values.set("pending-verification", "retained");
  storage.values.set(QUERY_PERSISTENCE_STORAGE_KEY, "invalid");
  const context = setup();
  await context.restore();
  expect(storage.values.get("hasCompletedOnboarding")).toBe("true");
  expect(storage.values.get("pending-verification")).toBe("retained");
});

it("fails closed for storage restoration after cleanup failure, without affecting live Query", async () => {
  const context = setup();
  await context.fetch();
  await context.save();
  storage.removeItem.mockRejectedValueOnce(new Error("Cleanup failed"));
  beginAuthSession();
  authenticate();
  await context.runtime.flush();
  const replacementClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  cleanup.push(() => replacementClient.clear());
  const replacement = context.runtime.openSession(replacementClient);
  expect(
    await replacement.persistOptions.persister.restoreClient(),
  ).toBeUndefined();
  await expect(
    replacementClient.fetchQuery({
      queryKey: key,
      queryFn: async () => ({ value: "live" }),
    }),
  ).resolves.toEqual({ value: "live" });
});

it("trims infinite pages and pageParams together without mutating live data", async () => {
  const context = setup({ policies: [infinitePolicy] });
  await context.client.fetchInfiniteQuery({
    queryKey: key,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => ({ items: [`page ${pageParam}`] }),
    getNextPageParam: (_last, pages) => pages.length + 1,
    pages: 4,
  });
  await context.save();
  expect(stored().entries[0].data).toEqual({
    pages: [{ items: ["page 1"] }, { items: ["page 2"] }],
    pageParams: [1, 2],
  });
  expect(
    context.client.getQueryData<{ pages: unknown[] }>(key)?.pages,
  ).toHaveLength(4);
  expect(() => trimPersistedPages({ pages: [1], pageParams: [] }, 1)).toThrow();
  expect(() =>
    trimPersistedPages({ pages: [1], pageParams: [1] }, undefined),
  ).toThrow();
});

it("rejects infinite persistence without an explicit page policy", async () => {
  const context = setup({
    policies: [{ ...infinitePolicy, maxPages: undefined }],
  });
  await context.client.fetchInfiniteQuery({
    queryKey: key,
    initialPageParam: 1,
    queryFn: async () => ({ items: [] }),
  });
  await context.save();
  expect(storage.setItem).not.toHaveBeenCalled();
});

it.each(["read", "write", "budget"])(
  "keeps normal Query working after a persistence %s failure",
  async (failure) => {
    const context = setup({
      limits:
        failure === "budget"
          ? { ...QUERY_PERSISTENCE_LIMITS, maxBytes: 10 }
          : QUERY_PERSISTENCE_LIMITS,
    });
    if (failure === "read")
      storage.getItem.mockRejectedValueOnce(new Error("Read failed"));
    if (failure === "write")
      storage.setItem.mockRejectedValueOnce(new Error("Write failed"));
    await expect(context.restore()).resolves.toBeUndefined();
    await expect(context.fetch()).resolves.toEqual({ value: "server" });
    await expect(context.save()).resolves.toBeUndefined();
    expect(context.client.getQueryData(key)).toEqual({ value: "server" });
    expect(storage.values.has("hasCompletedOnboarding")).toBe(false);
    expect(
      storage.removeItem.mock.calls.every(
        ([name]) => name === QUERY_PERSISTENCE_STORAGE_KEY,
      ),
    ).toBe(true);
  },
);

it.each(["logout", "same-user login", "session expiry", "failed restore"])(
  "revokes old content at %s",
  async (event) => {
    const context = setup();
    await context.fetch();
    await context.save();
    if (event === "same-user login") {
      beginAuthSession();
      authenticate();
    } else {
      invalidateAuthSession();
      useAuthStore.getState().clearUser();
    }
    await context.runtime.flush();
    await context.save();
    expect(storage.values.has(QUERY_PERSISTENCE_STORAGE_KEY)).toBe(false);
    if (event === "logout") {
      beginAuthSession();
      authenticate(8);
    }
    const replacement = context.runtime.openSession(new QueryClient());
    expect(
      await replacement.persistOptions.persister.restoreClient(),
    ).toBeUndefined();
  },
);

it("removes a late old-session write before the replacement session writes", async () => {
  const context = setup();
  await context.fetch("old");
  const started = deferred<void>();
  const release = deferred<void>();
  storage.setItem.mockImplementationOnce(async (name, value) => {
    started.resolve();
    await release.promise;
    storage.values.set(name, value);
  });
  const save = context.save();
  await started.promise;
  beginAuthSession();
  authenticate(8);
  const nextClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  cleanup.push(() => nextClient.clear());
  const next = context.runtime.openSession(nextClient);
  cleanup.push(next.track());
  await nextClient.fetchQuery({
    queryKey: key,
    queryFn: async () => ({ value: "new" }),
  });
  const newSave = persistQueryClientSave({
    queryClient: nextClient,
    ...next.persistOptions,
  });
  release.resolve();
  await Promise.all([save, newSave]);
  await context.runtime.flush();
  expect(stored()).toMatchObject({
    ownerId: 8,
    entries: [{ data: { value: "new" } }],
  });
});

it("does not apply a late hydration after account replacement", async () => {
  const json = await seed();
  const pendingRead = deferred<string | null>();
  storage.getItem.mockImplementationOnce(() => pendingRead.promise);
  const context = setup();
  const restoring = context.restore();
  await Promise.resolve();
  beginAuthSession();
  authenticate(8);
  pendingRead.resolve(json);
  await restoring;
  await context.runtime.flush();
  expect(context.client.getQueryData(key)).toBeUndefined();
  expect(storage.values.has(QUERY_PERSISTENCE_STORAGE_KEY)).toBe(false);
});

it("rechecks authorization inside TanStack's final synchronous hydration step", async () => {
  await seed();
  const context = setup();
  const restored =
    await context.session.persistOptions.persister.restoreClient();
  beginAuthSession();
  authenticate();
  await expect(
    persistQueryClientRestore({
      queryClient: context.client,
      ...context.session.persistOptions,
      persister: {
        ...context.session.persistOptions.persister,
        restoreClient: async () => restored,
      },
    }),
  ).rejects.toThrow("revoked");
  expect(context.client.getQueryData(key)).toBeUndefined();
});

it("rejects in-flight work when the API scope changes", async () => {
  const context = setup();
  await context.fetch();
  apiScope = "https://new.example.test/api";
  await context.save();
  expect(storage.setItem).not.toHaveBeenCalled();
});

it("projects and validates data before persistence", async () => {
  const context = setup({
    policies: [{ ...policy, project: () => ({ value: "public" }) }],
  });
  await context.fetch("restricted input");
  await context.save();
  expect(stored().entries[0].data).toEqual({ value: "public" });
  expect(JSON.stringify(stored())).not.toContain("restricted input");
});
