import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import {
  hashKey,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import type {
  PersistedClient,
  Persister,
  PersistQueryClientOptions,
} from "@tanstack/react-query-persist-client";
import { z } from "zod";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";

import {
  getQueryPersistenceApiScope,
  QUERY_PERSISTENCE_BUSTER,
  QUERY_PERSISTENCE_FORMAT_VERSION,
  QUERY_PERSISTENCE_LIMITS,
  QUERY_PERSISTENCE_POLICIES,
  QUERY_PERSISTENCE_POLICY_VERSION,
  QUERY_PERSISTENCE_STORAGE_KEY,
  serializedBytes,
  trimPersistedPages,
  type QueryPersistencePolicy,
  type QueryPersistenceScope,
} from "./queryPersistencePolicies";

type Storage = Pick<typeof AsyncStorage, "getItem" | "setItem" | "removeItem">;
type Limits = { maxBytes: number; maxEntryBytes: number; maxEntries: number };

const entrySchema = z.object({
  policyId: z.string().min(1).max(128),
  policyVersion: z.number().int().positive(),
  queryKey: z.array(z.unknown()).min(1),
  fetchedAt: z.number().finite().positive(),
  data: z.unknown(),
});
const envelopeSchema = z.object({
  formatVersion: z.literal(QUERY_PERSISTENCE_FORMAT_VERSION),
  policyVersion: z.literal(QUERY_PERSISTENCE_POLICY_VERSION),
  ownerId: z.number().int().positive(),
  apiScope: z.string(),
  entries: z.array(entrySchema),
});

type Entry = z.infer<typeof entrySchema>;

function warn(operation: string) {
  if (__DEV__) {
    // Avoid logging cached content, credentials, keys, or account identity.
    console.warn(`[Query persistence] ${operation}; using network state.`);
  }
}

/** Detaches snapshots from live optimistic state and rejects non-JSON values. */
function jsonCopy(value: unknown): unknown {
  const json = JSON.stringify(value, (_, item) => {
    if (
      item === undefined ||
      typeof item === "function" ||
      typeof item === "symbol" ||
      (typeof item === "number" && !Number.isFinite(item))
    ) {
      throw new Error("Non-JSON cache data.");
    }
    return item;
  });
  return JSON.parse(json);
}

/** Creates one serialized storage coordinator; the app uses the singleton below. */
export function createQueryPersistence({
  storage = AsyncStorage,
  policies = QUERY_PERSISTENCE_POLICIES,
  limits = QUERY_PERSISTENCE_LIMITS,
  getApiScope = getQueryPersistenceApiScope,
  now = () => Date.now(),
  throttleTimeMs = 1000,
}: {
  storage?: Storage;
  policies?: readonly QueryPersistencePolicy[];
  limits?: Limits;
  getApiScope?: () => string;
  now?: () => number;
  throttleTimeMs?: number;
} = {}) {
  let pending: Promise<unknown> = Promise.resolve();
  let active: ReturnType<typeof createSession> | null = null;
  let blocked = false;
  let disposed = false;

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.catch(() => undefined);
    return result;
  }

  /** Revoke synchronously; removal follows older writes and precedes new work. */
  function revoke() {
    active?.revoke();
    active = null;
    return enqueue(async () => {
      try {
        await storage.removeItem(QUERY_PERSISTENCE_STORAGE_KEY);
        blocked = false;
      } catch {
        blocked = true;
        warn("Temporary cache cleanup failed");
      }
    });
  }

  const stopSessionChanges = subscribeAuthSessionChanges((change) => {
    // A cold-start restore may read the last validated owner's cache. Explicit
    // sign-in, replacement and revocation always start a new cache lifetime.
    if (change === "restore" || change === "offline") {
      active?.revoke();
      active = null;
    } else {
      void revoke();
    }
  });

  function createSession(
    client: QueryClient | null,
    local?: { scope: QueryPersistenceScope; current: () => boolean },
  ) {
    const auth = useAuthStore.getState();
    const ownerId =
      auth.isAuthenticated && !auth.isLoading ? auth.user?.id : null;
    const scope: QueryPersistenceScope | null =
      local?.scope ?? (ownerId ? { ownerId, apiScope: getApiScope() } : null);
    const generation = getAuthSessionGeneration();
    const entries = new Map<string, Entry>();
    let revoked = false;
    let failed = false;
    let hasStoredData = false;

    function authorized() {
      if (local) return !disposed && !blocked && local.current();
      const current = useAuthStore.getState();
      return (
        !disposed &&
        !revoked &&
        scope !== null &&
        isAuthSessionCurrent(generation) &&
        current.isAuthenticated &&
        !current.isLoading &&
        current.user?.id === scope.ownerId &&
        getApiScope() === scope.apiScope
      );
    }

    function policyFor(key: QueryKey) {
      if (!scope) {
        return undefined;
      }
      return policies.find((policy) => {
        return (
          policy.id.length > 0 &&
          Number.isSafeInteger(policy.version) &&
          policy.version > 0 &&
          Number.isFinite(policy.maxAgeMs) &&
          policy.maxAgeMs > 0 &&
          Number.isFinite(policy.maxBytes) &&
          policy.maxBytes > 0 &&
          policy.matches(key, scope)
        );
      });
    }

    function eligible(entry: Entry) {
      const policy = policyFor(entry.queryKey);
      return (
        policy !== undefined &&
        policy.id === entry.policyId &&
        policy.version === entry.policyVersion &&
        entry.fetchedAt <= now() &&
        now() - entry.fetchedAt < policy.maxAgeMs &&
        serializedBytes(JSON.stringify(entry)) <=
          Math.min(policy.maxBytes, limits.maxEntryBytes)
      );
    }

    function envelope() {
      // Expiry is per original fetch, never the client's most recent save time.
      const candidates = [...entries.values()]
        .filter(eligible)
        .sort((left, right) => right.fetchedAt - left.fetchedAt);
      const kept: Entry[] = [];
      const result = {
        formatVersion: QUERY_PERSISTENCE_FORMAT_VERSION,
        policyVersion: QUERY_PERSISTENCE_POLICY_VERSION,
        ownerId: scope?.ownerId ?? 0,
        apiScope: scope?.apiScope ?? "",
        entries: kept,
      };
      for (const entry of candidates) {
        if (kept.length >= limits.maxEntries) {
          break;
        }
        kept.push(entry);
        if (serializedBytes(JSON.stringify(result)) > limits.maxBytes) {
          kept.pop();
        }
      }
      entries.clear();
      kept.forEach((entry) => entries.set(hashKey(entry.queryKey), entry));
      return result;
    }

    async function removeStoredData() {
      await enqueue(async () => {
        if (!authorized()) {
          return;
        }
        await storage.removeItem(QUERY_PERSISTENCE_STORAGE_KEY);
        hasStoredData = false;
      });
    }

    function restore(json: string): PersistedClient {
      if (serializedBytes(json) > limits.maxBytes) {
        throw new Error("Temporary cache exceeds its budget.");
      }
      const saved = envelopeSchema.parse(JSON.parse(json));
      if (
        !scope ||
        saved.ownerId !== scope.ownerId ||
        saved.apiScope !== scope.apiScope ||
        saved.entries.length > limits.maxEntries
      ) {
        throw new Error("Temporary cache scope or entry count changed.");
      }
      entries.clear();
      for (const entry of saved.entries) {
        try {
          if (!eligible(entry)) {
            continue;
          }
          const policy = policyFor(entry.queryKey)!;
          let data = policy.parse(entry.data);
          if (policy.kind === "infinite") {
            data = trimPersistedPages(data, policy.maxPages);
          }
          const restored = { ...entry, data: jsonCopy(data) };
          if (eligible(restored)) {
            entries.set(hashKey(entry.queryKey), restored);
          }
        } catch {
          // One incompatible DTO must not hide other approved entries.
        }
      }
      const valid = envelope().entries;
      return {
        buster: QUERY_PERSISTENCE_BUSTER,
        timestamp: Math.max(1, ...valid.map((entry) => entry.fetchedAt)),
        clientState: {
          mutations: [],
          queries: valid.map((entry) => ({
            queryKey: entry.queryKey,
            queryHash: hashKey(entry.queryKey),
            ...(policyFor(entry.queryKey)?.kind === "infinite"
              ? { queryType: "infinite" as const }
              : {}),
            state: {
              data: entry.data,
              dataUpdatedAt: entry.fetchedAt,
              dataUpdateCount: 1,
              error: null,
              errorUpdatedAt: 0,
              errorUpdateCount: 0,
              fetchFailureCount: 0,
              fetchFailureReason: null,
              fetchMeta: null,
              isInvalidated: false,
              status: "success",
              fetchStatus: "idle",
            },
          })),
        },
      };
    }

    const official = createAsyncStoragePersister({
      key: QUERY_PERSISTENCE_STORAGE_KEY,
      throttleTime: throttleTimeMs,
      storage: {
        getItem: () =>
          enqueue(async () => {
            if (!authorized() || blocked || failed) {
              return null;
            }
            const json = await storage.getItem(QUERY_PERSISTENCE_STORAGE_KEY);
            if (!authorized()) {
              return null;
            }
            hasStoredData = json !== null;
            return json;
          }),
        setItem: (_, json) =>
          enqueue(async () => {
            if (!authorized() || blocked || failed) {
              return;
            }
            await storage.setItem(QUERY_PERSISTENCE_STORAGE_KEY, json);
            if (!authorized()) {
              // Compensate a write that completed after revocation. The global
              // queue prevents this removal from racing a new session's write.
              await storage.removeItem(QUERY_PERSISTENCE_STORAGE_KEY);
            } else {
              hasStoredData = true;
            }
          }),
        removeItem: removeStoredData,
      },
      serialize: () => JSON.stringify(envelope()),
      deserialize: restore,
      retry: () => {
        failed = true;
        warn("Temporary cache write failed");
        return undefined;
      },
    });

    const persister: Persister = {
      persistClient: async (persistedClient) => {
        if (!authorized() || blocked || failed) {
          return;
        }
        try {
          if (envelope().entries.length === 0) {
            if (hasStoredData) {
              await official.removeClient();
            }
            return;
          }
          await official.persistClient(persistedClient);
        } catch {
          failed = true;
          warn("Temporary cache save failed");
        }
      },
      restoreClient: async () => {
        if (!authorized() || blocked || failed) {
          return undefined;
        }
        try {
          const restored = await official.restoreClient();
          if (!authorized()) {
            return undefined;
          }
          if (hasStoredData) {
            // Rewrite only the validated, unexpired subset, retaining fetch times.
            if (entries.size > 0 && restored) {
              await official.persistClient(restored);
            } else {
              await official.removeClient();
            }
          }
          return failed || !authorized() ? undefined : restored;
        } catch {
          warn("Temporary cache restore failed");
          entries.clear();
          try {
            await official.removeClient();
          } catch {
            blocked = true;
            warn("Temporary cache discard failed");
          }
          return undefined;
        }
      },
      removeClient: async () => {
        try {
          await official.removeClient();
        } catch {
          blocked = true;
          warn("Temporary cache removal failed");
        }
      },
    };

    const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
      persister,
      buster: QUERY_PERSISTENCE_BUSTER,
      // Each entry has a strict policy TTL; a global timestamp cannot renew it.
      maxAge: Infinity,
      dehydrateOptions: {
        shouldDehydrateMutation: () => false,
        shouldDehydrateQuery: (query) => {
          if (!authorized() || blocked || failed || entries.size === 0) {
            return false;
          }
          try {
            return entries.has(hashKey(query.queryKey));
          } catch {
            return false;
          }
        },
      },
      hydrateOptions: {
        defaultOptions: {
          deserializeData: (data) => {
            // TanStack awaits restoreClient before hydrate. Recheck inside the
            // synchronous hydrate step too, closing that final microtask gap.
            if (!authorized() || blocked || failed) {
              throw new Error("Temporary cache session was revoked.");
            }
            return data;
          },
        },
      },
    };

    /** Capture only actual fetch successes, never setQueryData or hydration writes. */
    function track() {
      return client!.getQueryCache().subscribe((event) => {
        if (!authorized() || policies.length === 0) {
          return;
        }
        const key = event.query.queryKey;
        let hash: string;
        try {
          hash = hashKey(key);
        } catch {
          return;
        }
        if (event.type === "removed") {
          entries.delete(hash);
          return;
        }
        if (
          event.type !== "updated" ||
          event.action.type !== "success" ||
          event.action.manual ||
          client!.getQueryCache().get(event.query.queryHash) !== event.query
        ) {
          return;
        }
        try {
          const policy = policyFor(key);
          if (!policy) {
            return;
          }
          if (
            event.query.queryType === "infinite" &&
            policy.kind !== "infinite"
          ) {
            return;
          }
          let data = event.query.state.data;
          if (policy.kind === "infinite") {
            data = trimPersistedPages(data, policy.maxPages);
          }
          if (policy.project) {
            data = policy.project(data);
          }
          data = policy.parse(data);
          if (policy.kind === "infinite") {
            data = trimPersistedPages(data, policy.maxPages);
          }
          const entry = {
            policyId: policy.id,
            policyVersion: policy.version,
            queryKey: jsonCopy(key) as unknown[],
            fetchedAt: event.query.state.dataUpdatedAt,
            data: jsonCopy(data),
          };
          if (eligible(entry)) {
            entries.set(hash, entry);
            envelope();
          } else {
            entries.delete(hash);
          }
        } catch {
          entries.delete(hash);
          warn("Query did not satisfy its persistence policy");
        }
      });
    }

    return {
      client,
      scope,
      generation,
      persistOptions,
      track,
      parseLocal: restore,
      revoke: () => {
        revoked = true;
        entries.clear();
      },
    };
  }

  return {
    /** Validates stored policies for local presentation; never hydrates the shared QueryClient. */
    readLocal(scope: QueryPersistenceScope, current: () => boolean) {
      return enqueue(async () => {
        if (disposed || blocked || !current()) return [];
        try {
          const json = await storage.getItem(QUERY_PERSISTENCE_STORAGE_KEY);
          if (!json || !current()) return [];
          const parsed = createSession(null, { scope, current }).parseLocal(
            json,
          );
          if (!current()) return [];
          return parsed.clientState.queries.map((query) => ({
            queryKey: query.queryKey,
            data: query.state.data,
            fetchedAt: query.state.dataUpdatedAt,
          }));
        } catch {
          return [];
        }
      });
    },
    /** Resolves ownership only from the validated runtime authentication state. */
    openSession(client: QueryClient) {
      const auth = useAuthStore.getState();
      const ownerId =
        auth.isAuthenticated && !auth.isLoading ? auth.user?.id : null;
      if (
        active &&
        active.client === client &&
        active.generation === getAuthSessionGeneration() &&
        (active.scope?.ownerId ?? null) === (ownerId ?? null) &&
        (active.scope?.apiScope ?? getApiScope()) === getApiScope()
      ) {
        return active;
      }
      if (active) {
        if (active.scope) void revoke();
        else {
          active.revoke();
          active = null;
        }
      }
      active = createSession(client);
      return active;
    },
    revoke,
    flush: () => pending,
    dispose() {
      disposed = true;
      active?.revoke();
      stopSessionChanges();
    },
  };
}

export const queryPersistence = createQueryPersistence();
