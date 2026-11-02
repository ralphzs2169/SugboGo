import AsyncStorage from "@react-native-async-storage/async-storage";
import { onlineManager } from "@tanstack/react-query";
import { z } from "zod";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";
import { getQueryPersistenceApiScope } from "@/shared/query/queryPersistencePolicies";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getBusinessAvailability } from "../api/businessAvailability.service";

const recordSchema = z.object({
  businessId: z.number().int().positive(),
  state: z.enum(["available", "unavailable"]),
  checkedAt: z.string().datetime({ offset: true }),
});
export type BusinessAvailability = z.infer<typeof recordSchema>;
const envelopeSchema = z.object({
  version: z.literal(1),
  ownerId: z.number(),
  apiScope: z.string(),
  records: z.array(recordSchema).max(5000),
});

/** Resolve only an authenticated owner or an existing explicitly granted local owner. */
export function availabilityOwner() {
  const auth = useAuthStore.getState();
  const local = useOfflineAccessStore.getState();
  if (auth.isLoading || local.isRevoking) return null;
  if (auth.isAuthenticated) return auth.user?.id ?? null;
  const recent = local.recentExplore;
  const recentOwner = recent?.generation === getAuthSessionGeneration() && recent.apiScope === getQueryPersistenceApiScope() ? recent.ownerId : null;
  if (local.ownerId !== null && recentOwner !== null && local.ownerId !== recentOwner) return null;
  return local.ownerId ?? recentOwner;
}

/** Serialized owner-scoped metadata; snapshot contents and memberships are never modified here. */
export function createBusinessAvailability({
  storage = AsyncStorage,
  fetchAvailability = getBusinessAvailability,
}: {
  storage?: Pick<typeof AsyncStorage, "getItem" | "setItem">;
  fetchAvailability?: typeof getBusinessAvailability;
} = {}) {
  let identity = "";
  let loaded = false;
  let records = new Map<number, BusinessAvailability>();
  let observations = new Map<number, number>();
  let sequence = 0;
  let revision = 0;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  let pending = new Set<number>();
  let inFlight = new Set<number>();
  let draining: Promise<void> | null = null;
  let drainContext: ReturnType<typeof capture> | null = null;
  let controller: AbortController | null = null;

  function publish() {
    revision += 1;
    listeners.forEach((listener) => listener());
  }
  function capture() {
    const ownerId = availabilityOwner();
    const apiScope = getQueryPersistenceApiScope();
    const generation = getAuthSessionGeneration();
    const key = JSON.stringify([apiScope, ownerId, generation]);
    if (identity !== key) {
      controller?.abort();
      identity = key;
      records = new Map();
      observations = new Map();
      pending = new Set();
      inFlight = new Set();
      loaded = false;
    }
    return {
      ownerId,
      apiScope,
      generation,
      storageKey: `sugbogo_business_availability_v1:${encodeURIComponent(apiScope)}:${ownerId}`,
      current: () =>
        identity === key &&
        availabilityOwner() === ownerId &&
        ownerId !== null &&
        getAuthSessionGeneration() === generation &&
        getQueryPersistenceApiScope() === apiScope,
    };
  }
  function serialize<T>(action: () => Promise<T>) {
    const result = queue.then(action);
    queue = result.catch(() => undefined);
    return result;
  }
  async function load() {
    const context = capture();
    if (!context.current()) return;
    await serialize(async () => {
      if (!context.current() || loaded) return;
      const json = await storage.getItem(context.storageKey);
      if (!context.current()) return;
      if (json && json.length <= 1024 * 1024) {
        try {
          const parsed = envelopeSchema.safeParse(JSON.parse(json));
          if (
            parsed.success &&
            parsed.data.ownerId === context.ownerId &&
            parsed.data.apiScope === context.apiScope
          ) {
            parsed.data.records.forEach((record) => {
              if (!records.has(record.businessId))
                records.set(record.businessId, record);
            });
          }
        } catch {
          /* Old or corrupt metadata defaults to unknown, without touching saved content. */
        }
      }
      loaded = true;
      publish();
    });
  }
  function begin() {
    const context = capture();
    const order = ++sequence;
    return { context, order };
  }
  async function confirm(
    observation: ReturnType<typeof begin>,
    items: { businessId: number; state: "available" | "unavailable" }[],
    checkedAt: string,
  ) {
    const { context, order } = observation;
    if (!context.current()) return;
    await load();
    if (!context.current()) return;
    await serialize(async () => {
      if (!context.current()) return;
      for (const item of items) {
        if ((observations.get(item.businessId) ?? 0) > order) continue;
        const parsed = recordSchema.parse({ ...item, checkedAt });
        observations.set(item.businessId, order);
        records.set(item.businessId, parsed);
      }
      // Keep metadata bounded; losing an old receipt means unknown, never deletion of a saved record.
      const retained = [...records.values()].slice(-5000);
      records = new Map(retained.map((record) => [record.businessId, record]));
      publish();
      await storage.setItem(
        context.storageKey,
        JSON.stringify({
          version: 1,
          ownerId: context.ownerId,
          apiScope: context.apiScope,
          records: retained,
        }),
      );
    });
  }
  async function reconcile(ids: number[]): Promise<void> {
    const context = capture();
    const auth = useAuthStore.getState();
    if (
      !context.current() ||
      !auth.isAuthenticated ||
      !isAuthSessionCurrent(context.generation) ||
      !onlineManager.isOnline()
    )
      return;
    ids
      .filter((id) => Number.isSafeInteger(id) && id > 0)
      .forEach((id) => {
        if (!inFlight.has(id)) pending.add(id);
      });
    if (draining) {
      const previous = drainContext;
      try {
        await draining;
      } catch (error) {
        if (previous?.current()) throw error;
      }
      if (context.current() && pending.size) return reconcile([]);
      return;
    }
    drainContext = context;
    draining = Promise.resolve()
      .then(async () => {
        while (pending.size && context.current() && onlineManager.isOnline()) {
          const ids = [...pending].slice(0, 100);
          ids.forEach((id) => pending.delete(id));
          inFlight = new Set(ids);
          controller = new AbortController();
          const observation = begin();
          const response = throwOnApiError(
            await fetchAvailability(ids, controller.signal),
          );
          if (!context.current() || controller.signal.aborted) return;
          const received = new Set(
            response.items.map((item) => item.business_id),
          );
          if (
            ids.some((id) => !received.has(id)) ||
            response.items.some((item) => !ids.includes(item.business_id))
          )
            throw new Error("Incomplete business availability response.");
          await confirm(
            observation,
            response.items.map((item) => ({
              businessId: item.business_id,
              state: item.availability,
            })),
            response.checked_at,
          );
          inFlight.clear();
        }
      })
      .finally(() => {
        draining = null;
        drainContext = null;
        inFlight.clear();
        controller = null;
      });
    return draining;
  }
  const stopSession = subscribeAuthSessionChanges(() => {
    controller?.abort();
    identity = "";
    records = new Map();
    observations = new Map();
    pending.clear();
    loaded = false;
    publish();
  });
  return {
    load,
    begin,
    confirm,
    reconcile,
    get(businessId: number) {
      capture();
      return records.get(businessId);
    },
    ids() {
      capture();
      return [...records.keys()];
    },
    revision: () => revision,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    interrupt() {
      controller?.abort();
      pending.clear();
    },
    dispose() {
      stopSession();
      controller?.abort();
      listeners.clear();
    },
  };
}
export const businessAvailability = createBusinessAvailability();
