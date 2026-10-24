import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";
import { create } from "zustand";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import { getQueryPersistenceApiScope } from "@/shared/query/queryPersistencePolicies";

const STORAGE_KEY = "sugbogo_recent_searches";
const MAX_QUERIES = 8;
const MAX_QUERY_LENGTH = 200;
const MAX_STORED_LENGTH = 16 * 1024;

const historySchema = z.object({
  formatVersion: z.literal(1),
  ownerId: z.number().int().positive(),
  apiScope: z.string(),
  queries: z.array(z.string().max(MAX_QUERY_LENGTH)).max(MAX_QUERIES),
});

type RecentSearchesState = {
  scope: string | null;
  queries: string[];
  isHydrated: boolean;
  addQuery: (query: string) => Promise<void>;
  removeQuery: (query: string) => Promise<void>;
  clearQueries: () => Promise<void>;
};

/** Normalizes only saved/replayed text; live search keeps its existing semantics. */
function normalizeQuery(query: string) {
  return query
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
}

function getContext() {
  const auth = useAuthStore.getState();
  const generation = getAuthSessionGeneration();

  if (
    auth.isLoading ||
    !auth.isAuthenticated ||
    !auth.user ||
    !isAuthSessionCurrent(generation)
  ) {
    return null;
  }

  const ownerId = auth.user.id;
  const apiScope = getQueryPersistenceApiScope();

  return {
    ownerId,
    apiScope,
    generation,
    scope: JSON.stringify([ownerId, apiScope]),
  };
}

type HistoryContext = NonNullable<ReturnType<typeof getContext>>;

let epoch = 0;
let activeGeneration: number | null = null;
let storageBlocked = false;
let queue = Promise.resolve();

function warnStorageUnavailable() {
  if (__DEV__) {
    console.warn("[Recent searches] Device storage unavailable.");
  }
}

/** Serializes hydration, edits, and revocation so old writes cannot win later. */
function enqueue(action: () => Promise<void>) {
  queue = queue.then(action).catch(warnStorageUnavailable);
  return queue;
}

function isCurrent(
  context: HistoryContext,
  capturedEpoch: number,
) {
  const current = getContext();

  return (
    capturedEpoch === epoch &&
    current?.scope === context.scope &&
    current.generation === context.generation
  );
}

function updateQueries(update: (queries: string[]) => string[]) {
  synchronizeScope();
  const context = getContext();
  const capturedEpoch = epoch;

  if (!context) {
    return Promise.resolve();
  }

  // Scope hydration is queued first, so an early submission cannot overwrite it.
  return enqueue(async () => {
    if (!isCurrent(context, capturedEpoch)) {
      return;
    }

    const previousQueries = useRecentSearchesStore.getState().queries;
    const queries = update(previousQueries);

    if (
      queries.length === previousQueries.length &&
      queries.every((query, index) => query === previousQueries[index])
    ) {
      return;
    }

    useRecentSearchesStore.setState({ queries });

    try {
      if (queries.length === 0) {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            formatVersion: 1,
            ownerId: context.ownerId,
            apiScope: context.apiScope,
            queries,
          }),
        );
      }

      if (isCurrent(context, capturedEpoch)) {
        storageBlocked = false;
      }
    } catch {
      // Keep the in-memory edit; never restore a disk copy that failed to clear.
      storageBlocked = true;
      warnStorageUnavailable();
    }
  });
}

/** Shared account/environment-scoped text history for Explore and Map search. */
export const useRecentSearchesStore = create<RecentSearchesState>(() => ({
  scope: null,
  queries: [],
  isHydrated: false,
  addQuery: (query) => {
    const normalized = normalizeQuery(query);

    if (!normalized) {
      return Promise.resolve();
    }

    return updateQueries((queries) =>
      [
        normalized,
        ...queries.filter(
          (existing) => existing.toLowerCase() !== normalized.toLowerCase(),
        ),
      ].slice(0, MAX_QUERIES),
    );
  },
  removeQuery: (query) =>
    updateQueries((queries) =>
      queries.filter(
        (existing) =>
          existing.toLowerCase() !== normalizeQuery(query).toLowerCase(),
      ),
    ),
  clearQueries: () => updateQueries(() => []),
}));

function synchronizeScope() {
  const context = getContext();
  const scope = context?.scope ?? null;
  const generation = context?.generation ?? null;

  if (
    useRecentSearchesStore.getState().scope === scope &&
    activeGeneration === generation
  ) {
    return;
  }

  const capturedEpoch = ++epoch;
  activeGeneration = generation;
  useRecentSearchesStore.setState({
    scope,
    queries: [],
    isHydrated: false,
  });

  if (!context) {
    return;
  }

  void enqueue(async () => {
    if (!isCurrent(context, capturedEpoch)) {
      return;
    }

    let queries: string[] = [];

    try {
      const saved = storageBlocked
        ? null
        : await AsyncStorage.getItem(STORAGE_KEY);

      if (saved && saved.length <= MAX_STORED_LENGTH) {
        const parsed = historySchema.safeParse(JSON.parse(saved));

        if (
          parsed.success &&
          parsed.data.ownerId === context.ownerId &&
          parsed.data.apiScope === context.apiScope
        ) {
          const seen = new Set<string>();

          for (const query of parsed.data.queries) {
            const normalized = normalizeQuery(query);
            const identity = normalized.toLowerCase();

            if (normalized && !seen.has(identity)) {
              seen.add(identity);
              queries.push(normalized);
            }
          }
        }
      }
    } catch {
      warnStorageUnavailable();
    }

    if (isCurrent(context, capturedEpoch)) {
      useRecentSearchesStore.setState({ queries, isHydrated: true });
    }
  });
}

// Root imports this module before restoration, including sessions that never search.
subscribeAuthSessionChanges((change) => {
  epoch += 1;
  activeGeneration = null;
  useRecentSearchesStore.setState({
    scope: null,
    queries: [],
    isHydrated: false,
  });

  if (change === "replace" || change === "revoke") {
    storageBlocked = true;

    void enqueue(async () => {
      await AsyncStorage.removeItem(STORAGE_KEY);
      storageBlocked = false;
    });
  }
});

useAuthStore.subscribe(synchronizeScope);
synchronizeScope();
