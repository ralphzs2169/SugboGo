import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { offlineBusinessSnapshotSchema } from "@/features/offline-pockets/validation/offlineBusinessSnapshot";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import {
  getQueryPersistenceApiScope,
  serializedBytes,
} from "@/shared/query/queryPersistencePolicies";
import type { ExploreBusinessDetail } from "../types/exploreBusiness.types";

export const RECENT_BUSINESS_STORAGE_KEY = "sugbogo_recent_business_details";
export const RECENT_BUSINESS_LIMITS = Object.freeze({
  maxEntries: 20,
  maxAgeMs: 48 * 60 * 60 * 1000,
  maxEntryBytes: 64 * 1024,
});

export const recentBusinessDetailSchema = z.object({
  projectionVersion: z.literal(1),
  fetchedAt: offlineBusinessSnapshotSchema.shape.fetchedAt,
  business: offlineBusinessSnapshotSchema.shape.business,
});
export type RecentBusinessDetail = z.infer<typeof recentBusinessDetailSchema>;
const entrySchema = recentBusinessDetailSchema.extend({
  accessedAt: z.number().finite().nonnegative(),
});
type Entry = z.infer<typeof entrySchema>;
const envelopeSchema = z.object({
  formatVersion: z.literal(1),
  ownerId: z.number().int().positive(),
  apiScope: z.string(),
  entries: z.array(z.unknown()).max(RECENT_BUSINESS_LIMITS.maxEntries),
});

/** Reuses the durable snapshot's presentation whitelist, without durable storage or state. */
export function projectRecentBusinessDetail(
  business: ExploreBusinessDetail,
  fetchedAt: number,
): RecentBusinessDetail {
  return recentBusinessDetailSchema.parse({
    projectionVersion: 1,
    fetchedAt: new Date(fetchedAt).toISOString(),
    business,
  });
}

function warn() {
  if (__DEV__)
    console.warn("[Recent business details] Device cache unavailable.");
}

/** One serialized coordinator owns only its dedicated, owner/API-scoped key. */
export function createRecentBusinessDetails({
  storage = AsyncStorage,
  now = () => Date.now(),
  getApiScope = getQueryPersistenceApiScope,
}: {
  storage?: Pick<typeof AsyncStorage, "getItem" | "setItem" | "removeItem">;
  now?: () => number;
  getApiScope?: () => string;
} = {}) {
  let queue: Promise<unknown> = Promise.resolve();
  let epoch = 0;
  let disposed = false;
  let blocked = false;

  function enqueue<T>(action: () => Promise<T>) {
    const result = queue.then(action);
    queue = result.catch(() => undefined);
    return result;
  }

  function revoke() {
    epoch += 1;
    return enqueue(async () => {
      try {
        await storage.removeItem(RECENT_BUSINESS_STORAGE_KEY);
        blocked = false;
      } catch {
        blocked = true;
        warn();
      }
    });
  }

  const unsubscribe = subscribeAuthSessionChanges((change) => {
    // Cold restoration may read an owner's last validated copy. All explicit
    // replacements, failures and revocations start a new temporary lifetime.
    if (change === "restore" || change === "offline") epoch += 1;
    else void revoke();
  });

  function capture(local?: {
    ownerId: number;
    apiScope: string;
    generation: number;
    current: () => boolean;
  }) {
    const auth = useAuthStore.getState();
    const ownerId =
      local?.ownerId ??
      (auth.isAuthenticated && !auth.isLoading ? auth.user?.id : null);
    const apiScope = local?.apiScope ?? getApiScope();
    const generation = local?.generation ?? getAuthSessionGeneration();
    const capturedEpoch = epoch;

    function isAuthorized() {
      if (local)
        return (
          !disposed &&
          capturedEpoch === epoch &&
          local.current() &&
          getApiScope() === apiScope
        );
      const current = useAuthStore.getState();
      return (
        !disposed &&
        ownerId != null &&
        capturedEpoch === epoch &&
        isAuthSessionCurrent(generation) &&
        current.isAuthenticated &&
        !current.isLoading &&
        current.user?.id === ownerId &&
        getApiScope() === apiScope
      );
    }

    function isCurrent() {
      return !blocked && isAuthorized();
    }

    function valid(entry: Entry) {
      const fetchedAt = Date.parse(entry.fetchedAt);
      return (
        fetchedAt <= now() &&
        now() - fetchedAt < RECENT_BUSINESS_LIMITS.maxAgeMs &&
        serializedBytes(JSON.stringify(entry)) <=
          RECENT_BUSINESS_LIMITS.maxEntryBytes
      );
    }

    async function readEntries(): Promise<Entry[]> {
      const json = await storage.getItem(RECENT_BUSINESS_STORAGE_KEY);
      if (!isCurrent() || !json) return [];
      // Reject oversized input before deserialization; all actual entry bytes
      // are checked independently after schema validation as well.
      const maxBytes =
        RECENT_BUSINESS_LIMITS.maxEntries *
          RECENT_BUSINESS_LIMITS.maxEntryBytes +
        4096;
      if (serializedBytes(json) > maxBytes) return [];
      let input: unknown;
      try {
        input = JSON.parse(json);
      } catch {
        return [];
      }
      const saved = envelopeSchema.safeParse(input);
      if (
        !saved.success ||
        saved.data.ownerId !== ownerId ||
        saved.data.apiScope !== apiScope
      )
        return [];
      const entries = new Map<number, Entry>();
      for (const input of saved.data.entries) {
        const parsed = entrySchema.safeParse(input);
        if (parsed.success && valid(parsed.data)) {
          entries.set(parsed.data.business.id, parsed.data);
        }
      }
      return [...entries.values()];
    }

    async function writeEntries(entries: Entry[]) {
      if (!isCurrent()) return;
      if (!entries.length) {
        await storage.removeItem(RECENT_BUSINESS_STORAGE_KEY);
        return;
      }
      const json = JSON.stringify({
        formatVersion: 1,
        ownerId,
        apiScope,
        entries,
      });
      await storage.setItem(RECENT_BUSINESS_STORAGE_KEY, json);
      if (!isCurrent()) {
        // Revocation cannot be followed by a valid old-session late write.
        // This compensating deletion precedes every new session's queued work.
        await storage.removeItem(RECENT_BUSINESS_STORAGE_KEY);
      }
    }

    async function safely<T>(
      action: () => Promise<T>,
      fallback: T,
    ): Promise<T> {
      return enqueue(async () => {
        if (!isCurrent()) return fallback;
        try {
          const result = await action();
          return isCurrent() ? result : fallback;
        } catch {
          warn();
          return fallback;
        }
      });
    }

    return {
      ownerId,
      apiScope,
      generation,
      isAuthorized,
      isCurrent,
      get(businessId: number) {
        return safely(
          async () => {
            const entries = await readEntries();
            const entry = entries.find(
              (item) => item.business.id === businessId,
            );
            if (entry) entry.accessedAt = now();
            // Reads prune expiry/corruption but never renew original fetch age.
            try {
              await writeEntries(entries);
            } catch {
              // Optional LRU bookkeeping must not hide an otherwise readable copy.
              warn();
            }
            return entry ? recentBusinessDetailSchema.parse(entry) : null;
          },
          null as RecentBusinessDetail | null,
        );
      },
      save(business: ExploreBusinessDetail, fetchedAt: number) {
        // Detach and validate immediately, before any optimistic live changes.
        let entry: Entry;
        try {
          entry = {
            ...projectRecentBusinessDetail(business, fetchedAt),
            accessedAt: now(),
          };
          if (!valid(entry)) return Promise.resolve(false);
        } catch {
          return Promise.resolve(false);
        }
        return safely(async () => {
          const entries = (await readEntries()).filter(
            (item) => item.business.id !== entry.business.id,
          );
          entries.unshift(entry);
          entries.sort((left, right) => right.accessedAt - left.accessedAt);
          await writeEntries(
            entries.slice(0, RECENT_BUSINESS_LIMITS.maxEntries),
          );
          return true;
        }, false);
      },
      remove(businessId: number) {
        return safely(async () => {
          const entries = await readEntries();
          await writeEntries(
            entries.filter((item) => item.business.id !== businessId),
          );
        }, undefined);
      },
    };
  }

  return {
    capture: () => capture(),
    readLocal(
      businessId: number,
      local: {
        ownerId: number;
        apiScope: string;
        generation: number;
        current: () => boolean;
      },
    ) {
      return capture(local).get(businessId);
    },
    revoke,
    flush: () => queue,
    dispose() {
      disposed = true;
      epoch += 1;
      unsubscribe();
    },
  };
}

export const recentBusinessDetails = createRecentBusinessDetails();
