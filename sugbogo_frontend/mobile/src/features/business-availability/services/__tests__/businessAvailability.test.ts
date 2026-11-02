import AsyncStorage from "@react-native-async-storage/async-storage";
import { onlineManager } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import { createBusinessAvailability } from "../businessAvailability.service";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);
jest.mock("../../api/businessAvailability.service", () => ({
  getBusinessAvailability: jest.fn(),
}));
const now = "2026-11-02T02:00:00.000Z";
const later = "2026-11-02T03:00:00.000Z";
let data: Map<string, string>;
let storage: { getItem: jest.Mock; setItem: jest.Mock };
let fetchAvailability: jest.Mock;
let store: ReturnType<typeof createBusinessAvailability>;
const success = (
  ids: number[],
  state: "available" | "unavailable" = "available",
) => ({
  success: true as const,
  message: "Checked",
  data: {
    checked_at: now,
    items: ids.map((business_id) => ({ business_id, availability: state })),
  },
});

function signIn(id = 7) {
  beginAuthSession();
  useAuthStore.setState({
    isAuthenticated: true,
    isLoading: false,
    user: { id, role: "explorer" } as never,
  });
}
beforeEach(async () => {
  await AsyncStorage.clear();
  useOfflineAccessStore.setState({
    ownerId: null,
    recentExplore: null,
    isRevoking: false,
  });
  signIn();
  onlineManager.setOnline(true);
  data = new Map();
  storage = {
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
  };
  fetchAvailability = jest.fn(async (ids: number[]) => success(ids));
  store = createBusinessAvailability({ storage, fetchAvailability });
});
afterEach(() => {
  store.dispose();
  onlineManager.setOnline(true);
});

it("defaults existing records without metadata to unknown and preserves snapshots independently", async () => {
  data.set("existing-snapshot", "saved profile and directions");
  await store.load();
  expect(store.get(21)).toBeUndefined();
  await store.confirm(
    store.begin(),
    [{ businessId: 21, state: "unavailable" }],
    now,
  );
  expect(data.get("existing-snapshot")).toBe("saved profile and directions");
  expect(
    [...data.keys()].filter((key) => key !== "existing-snapshot"),
  ).toHaveLength(1);
});
it("persists confirmed unavailability and restores the same saved identity after reactivation", async () => {
  await store.confirm(
    store.begin(),
    [{ businessId: 21, state: "unavailable" }],
    now,
  );
  store.dispose();
  store = createBusinessAvailability({ storage, fetchAvailability });
  await store.load();
  expect(store.get(21)).toMatchObject({ state: "unavailable", checkedAt: now });
  await store.reconcile([21]);
  expect(store.get(21)?.state).toBe("available");
  expect(store.ids()).toEqual([21]);
});
it("transport failures never convert confirmed state or verification timestamps", async () => {
  await store.confirm(
    store.begin(),
    [{ businessId: 21, state: "unavailable" }],
    now,
  );
  fetchAvailability.mockResolvedValue({
    success: false,
    code: "REQUEST_TIMEOUT",
    message: "Timeout",
  });
  await expect(store.reconcile([21])).rejects.toMatchObject({
    code: "REQUEST_TIMEOUT",
  });
  expect(store.get(21)).toMatchObject({ state: "unavailable", checkedAt: now });
  expect(store.get(99)).toBeUndefined();
});
it("coalesces overlapping requests into bounded unique batches", async () => {
  const first = Array.from({ length: 125 }, (_, index) => index + 1);
  const second = Array.from({ length: 100 }, (_, index) => index + 51);
  await Promise.all([store.reconcile(first), store.reconcile(second)]);
  expect(fetchAvailability).toHaveBeenCalledTimes(2);
  const ids = fetchAvailability.mock.calls.flatMap(([ids]) => ids);
  expect(ids).toHaveLength(150);
  expect(new Set(ids).size).toBe(150);
  expect(fetchAvailability.mock.calls.every(([ids]) => ids.length <= 100)).toBe(
    true,
  );
});
it("older in-flight detail receipts cannot overwrite a newer unavailable confirmation", async () => {
  const old = store.begin();
  const current = store.begin();
  await store.confirm(
    current,
    [{ businessId: 21, state: "unavailable" }],
    later,
  );
  await store.confirm(old, [{ businessId: 21, state: "available" }], now);
  expect(store.get(21)).toMatchObject({
    state: "unavailable",
    checkedAt: later,
  });
});
it.each(["resolves", "rejects"])(
  "rechecks an interrupted batch when focus returns before the old request %s",
  async (settlement) => {
    let finish = () => {};
    let signal: AbortSignal | undefined;
    fetchAvailability.mockImplementationOnce(
      (_ids: number[], requestSignal: AbortSignal) =>
        new Promise((resolve, reject) => {
          signal = requestSignal;
          finish = () => {
            if (settlement === "rejects") {
              reject(new Error("Request cancelled"));
            } else {
              resolve(success([21], "unavailable"));
            }
          };
        }),
    );
    const interrupted = store.reconcile([21]).catch(() => undefined);
    await Promise.resolve();
    expect(fetchAvailability).toHaveBeenCalledTimes(1);
    store.interrupt();
    expect(signal?.aborted).toBe(true);
    const resumed = store.reconcile([21]);
    finish();
    await Promise.all([interrupted, resumed]);
    expect(fetchAvailability).toHaveBeenCalledTimes(2);
    expect(store.get(21)?.state).toBe("available");
  },
);
it("session switching rejects stale callbacks and does not expose a previous owner's records", async () => {
  const old = store.begin();
  await store.confirm(old, [{ businessId: 21, state: "unavailable" }], now);
  signIn(8);
  expect(store.get(21)).toBeUndefined();
  await store.confirm(old, [{ businessId: 21, state: "available" }], later);
  await store.load();
  expect(store.get(21)).toBeUndefined();
  await store.reconcile([22]);
  expect(store.get(22)?.state).toBe("available");
  expect(store.get(21)).toBeUndefined();
});
it("an old network job cannot overwrite a replacement session or prevent its reconciliation", async () => {
  let finish: (value: ReturnType<typeof success>) => void = () => {};
  fetchAvailability.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const old = store.reconcile([21]);
  await Promise.resolve();
  signIn(8);
  const replacement = store.reconcile([22]);
  finish(success([21], "unavailable"));
  await Promise.all([old, replacement]);
  expect(store.get(21)).toBeUndefined();
  expect(store.get(22)?.state).toBe("available");
});
it("logout removes in-memory authority while explicit same-owner offline grants retain historical receipts", async () => {
  await store.confirm(
    store.begin(),
    [{ businessId: 21, state: "unavailable" }],
    now,
  );
  invalidateAuthSession();
  useAuthStore.setState({
    isAuthenticated: false,
    isLoading: false,
    user: null,
  });
  expect(store.get(21)).toBeUndefined();
  useOfflineAccessStore.setState({ ownerId: 7 });
  onlineManager.setOnline(false);
  await store.load();
  expect(store.get(21)?.state).toBe("unavailable");
  await store.reconcile([21]);
  expect(fetchAvailability).not.toHaveBeenCalled();
});
it("rejects incomplete authoritative batches without fabricating missing-business states", async () => {
  fetchAvailability.mockResolvedValue(success([21]));
  await expect(store.reconcile([21, 22])).rejects.toThrow("Incomplete");
  expect(store.get(22)).toBeUndefined();
});
