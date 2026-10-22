import { useAuthStore } from "@/features/auth/store/auth.store";
import { businessFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import {
  createRecentBusinessDetails,
  projectRecentBusinessDetail,
  recentBusinessDetailSchema,
  RECENT_BUSINESS_LIMITS,
  RECENT_BUSINESS_STORAGE_KEY,
} from "../recentBusinessDetails.service";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let now: number;
let apiScope: string;
let json: string | null;
let storage: { getItem: jest.Mock; setItem: jest.Mock; removeItem: jest.Mock };
const runtimes: ReturnType<typeof createRecentBusinessDetails>[] = [];

function setup() {
  const runtime = createRecentBusinessDetails({
    storage,
    now: () => now,
    getApiScope: () => apiScope,
  });
  runtimes.push(runtime);
  return { runtime, session: runtime.capture() };
}

beforeEach(() => {
  now = Date.parse("2026-10-22T01:00:00Z");
  apiScope = "https://api.test/api";
  json = null;
  storage = {
    getItem: jest.fn(async () => json),
    setItem: jest.fn(async (_key: string, value: string) => {
      json = value;
    }),
    removeItem: jest.fn(async () => {
      json = null;
    }),
  };
  beginAuthSession("restore");
  useAuthStore.setState({
    user: { id: 7 } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(async () => {
  await Promise.all(runtimes.map((runtime) => runtime.flush()));
  runtimes.splice(0).forEach((runtime) => runtime.dispose());
  jest.restoreAllMocks();
});

it("projects only validated presentation fields and strips nested live/unknown state", () => {
  const raw = businessFixture();
  raw.specialty_tags = [
    {
      id: 1,
      name: "Coffee",
      color: "blue",
      icon: "coffee",
      vouch_count: 55,
      is_vouched: true,
    },
  ];
  const projected = projectRecentBusinessDetail(
    { ...raw, private_review: "secret" } as never,
    now,
  );
  expect(recentBusinessDetailSchema.parse(projected)).toEqual(projected);
  expect(projected.business.specialty_tags[0]).toEqual({
    id: 1,
    name: "Coffee",
    color: "blue",
    icon: "coffee",
  });
  expect(JSON.stringify(projected)).not.toMatch(
    /is_pocketed|is_own_business|has_own_review|is_vouched|vouch_count|review_count|overall_vibe|review_insights|private_review/,
  );
  expect(projected.business.operating_hours).toEqual(raw.operating_hours);
  expect(projected.business.photos).toEqual(raw.photos);
});

it("rejects invalid projections and skips payloads over 64 KiB without throwing", async () => {
  const { session } = setup();
  expect(() =>
    projectRecentBusinessDetail({ ...businessFixture(), id: 0 }, now),
  ).toThrow();
  expect(
    await session.save(
      {
        ...businessFixture(),
        description: "x".repeat(RECENT_BUSINESS_LIMITS.maxEntryBytes),
      },
      now,
    ),
  ).toBe(false);
  expect(
    await session.save({ ...businessFixture(), business_name: "" }, now),
  ).toBe(false);
  expect(json).toBeNull();
});

it("survives process recreation without renewing the original 48-hour fetch age", async () => {
  const first = setup();
  await first.session.save(businessFixture(), now);
  const fetchedAt = new Date(now).toISOString();
  first.runtime.dispose();
  now += 47 * 60 * 60 * 1000;
  const next = setup();
  expect((await next.session.get(21))?.fetchedAt).toBe(fetchedAt);
  expect(JSON.parse(json!).entries[0].fetchedAt).toBe(fetchedAt);
  now += 60 * 60 * 1000;
  expect(await next.session.get(21)).toBeNull();
  expect(json).toBeNull();
});

it("keeps at most twenty entries and uses access LRU independently of fetch age", async () => {
  const { session } = setup();
  const originalFetch = now;
  for (let id = 1; id <= 20; id += 1) {
    now += 1;
    await session.save(businessFixture(id), originalFetch);
  }
  now += 1;
  await session.get(1);
  now += 1;
  await session.save(businessFixture(21), now);
  expect(JSON.parse(json!).entries).toHaveLength(20);
  expect(await session.get(2)).toBeNull();
  expect((await session.get(1))?.fetchedAt).toBe(
    new Date(originalFetch).toISOString(),
  );
  expect(await session.get(21)).not.toBeNull();
});

it.each(["owner", "API"])(
  "never exposes another %s's entries",
  async (mismatch) => {
    const first = setup();
    await first.session.save(businessFixture(), now);
    if (mismatch === "owner")
      useAuthStore.setState({ user: { id: 8 } as never });
    else apiScope = "https://other.test/api";
    expect(await first.session.get(21)).toBeNull();
    expect(await first.runtime.capture().get(21)).toBeNull();
  },
);

it.each(["logout", "expiry", "failed-restore", "same-user-relogin"])(
  "revokes and removes temporary details on %s",
  async (boundary) => {
    const { session, runtime } = setup();
    await session.save(businessFixture(), now);
    if (boundary === "same-user-relogin") beginAuthSession();
    else invalidateAuthSession();
    await runtime.flush();
    expect(json).toBeNull();
    expect(await session.get(21)).toBeNull();
    expect(await session.save(businessFixture(), now)).toBe(false);
  },
);

it("removes a late old-session write before a replacement session writes", async () => {
  const pending = deferred<void>();
  const started = deferred<void>();
  storage.setItem.mockImplementationOnce(
    async (_key: string, value: string) => {
      started.resolve();
      await pending.promise;
      json = value;
    },
  );
  const { session, runtime } = setup();
  const writing = session.save(businessFixture(), now);
  await started.promise;
  beginAuthSession();
  useAuthStore.setState({ user: { id: 8 } as never });
  const replacement = runtime.capture();
  const newWriting = replacement.save(businessFixture(22), now);
  pending.resolve();
  expect(await writing).toBe(false);
  expect(await newWriting).toBe(true);
  expect(JSON.parse(json!).ownerId).toBe(8);
  expect(
    JSON.parse(json!).entries.map(
      (entry: { business: { id: number } }) => entry.business.id,
    ),
  ).toEqual([22]);
});

it("rejects a read completing after session replacement, even for the same user", async () => {
  const { session } = setup();
  await session.save(businessFixture(), now);
  const pending = deferred<string | null>();
  const started = deferred<void>();
  storage.getItem.mockImplementationOnce(() => {
    started.resolve();
    return pending.promise;
  });
  const reading = session.get(21);
  await started.promise;
  const old = json;
  beginAuthSession();
  pending.resolve(old);
  expect(await reading).toBeNull();
});

it.each(["corrupt JSON", "unsupported format", "invalid DTO"])(
  "recovers safely from %s",
  async (kind) => {
    const { session } = setup();
    await session.save(businessFixture(), now);
    const envelope = JSON.parse(json!);
    if (kind === "unsupported format") envelope.formatVersion = 99;
    if (kind === "invalid DTO")
      envelope.entries[0].business.location.latitude = 1000;
    json = kind === "corrupt JSON" ? "not json" : JSON.stringify(envelope);
    expect(await session.get(21)).toBeNull();
    expect(await session.save(businessFixture(), now)).toBe(true);
    expect(await session.get(21)).not.toBeNull();
  },
);

it("degrades safely when storage fails and touches only its dedicated key", async () => {
  const { session } = setup();
  storage.getItem.mockRejectedValueOnce(new Error("read failed"));
  expect(await session.get(21)).toBeNull();
  storage.setItem.mockRejectedValueOnce(new Error("quota"));
  expect(await session.save(businessFixture(), now)).toBe(false);
  await session.save(businessFixture(), now);
  await session.remove(21);
  for (const mock of [storage.getItem, storage.setItem, storage.removeItem]) {
    expect(
      mock.mock.calls.every((call) => call[0] === RECENT_BUSINESS_STORAGE_KEY),
    ).toBe(true);
  }
});

it("still returns readable information if optional LRU bookkeeping cannot be written", async () => {
  const { session } = setup();
  await session.save(businessFixture(), now);
  storage.setItem.mockRejectedValueOnce(new Error("quota"));
  expect((await session.get(21))?.business.id).toBe(21);
});

it("blocks the replacement session if old-session deletion fails", async () => {
  const { session, runtime } = setup();
  await session.save(businessFixture(), now);
  storage.removeItem.mockRejectedValueOnce(new Error("cleanup failed"));
  beginAuthSession();
  await runtime.flush();
  expect(await runtime.capture().get(21)).toBeNull();
  expect(await runtime.capture().save(businessFixture(), now)).toBe(false);
  beginAuthSession();
  await runtime.flush();
  expect(await runtime.capture().get(21)).toBeNull();
  expect(await runtime.capture().save(businessFixture(), now)).toBe(true);
});
