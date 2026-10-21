import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import { Platform } from "react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "../../stores/offlineAccess.store";
import { snapshot } from "../../utils/__tests__/savedJourney.fixture";
import {
  clearSavedJourneys,
  clearSavedJourneysForLogout,
  deleteSavedJourney,
  listSavedJourneys,
  saveJourney,
} from "../savedJourneys.service";
import { rememberOfflineOwner } from "../offlineAccess.service";

const mockDb = {
  execAsync: jest.fn(),
  closeAsync: jest.fn(),
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  withExclusiveTransactionAsync: jest.fn(),
};
jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}));
jest.mock("../offlineAccess.service", () => ({
  rememberOfflineOwner: jest.fn(),
}));

describe("saved journey device repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 7 } as never, isAuthenticated: true });
    useOfflineAccessStore.setState({ ownerId: null, isRevoking: false });
    mockDb.withExclusiveTransactionAsync.mockImplementation(
      async (action: (db: typeof mockDb) => Promise<void>) => action(mockDb),
    );
    mockDb.getFirstAsync.mockImplementation(async (sql: string) =>
      sql.includes("COUNT") ? { total: 0 } : null,
    );
    mockDb.getAllAsync.mockResolvedValue([]);
    mockDb.runAsync.mockResolvedValue({ changes: 1 });
  });

  it("persists a validated snapshot with bound account/environment parameters", async () => {
    await expect(saveJourney(snapshot)).resolves.toBe("21:8:2:4");
    const args = mockDb.runAsync.mock.calls[0];
    expect(args[0]).toContain("ON CONFLICT");
    expect(args[2]).toBe(7);
    expect(args[3]).toBe("21:8:2:4");
    expect(JSON.parse(args[4])).toEqual(snapshot);
    expect(args[5]).toBe(snapshot.savedAt);
    expect(rememberOfflineOwner).toHaveBeenCalledWith(
      7,
      getAuthSessionGeneration(),
    );
  });

  it("returns persisted data from SQLite independently of React Query or network state", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { journey_key: "21:8:2:4", snapshot: JSON.stringify(snapshot) },
    ]);
    useAuthStore.setState({ user: null, isAuthenticated: false });
    useOfflineAccessStore.setState({ ownerId: 7 });
    expect(await listSavedJourneys(7)).toEqual([{ key: "21:8:2:4", snapshot }]);
    expect(mockDb.getAllAsync.mock.calls[0].slice(2)).toEqual([7]);
    await expect(saveJourney(snapshot)).rejects.toThrow("Sign in");
  });

  it("rejects another owner and operations after local access is revoked", async () => {
    await expect(listSavedJourneys(8)).rejects.toThrow("unavailable");
    await expect(deleteSavedJourney(8, "21:8:2:4")).rejects.toThrow(
      "unavailable",
    );
    expect(mockDb.runAsync).not.toHaveBeenCalled();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    await expect(listSavedJourneys(7)).rejects.toThrow("unavailable");
  });

  it("retains unreadable rows for deletion and rejects mismatched snapshot keys", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { journey_key: "bad", snapshot: "not json" },
      { journey_key: "wrong-key", snapshot: JSON.stringify(snapshot) },
    ]);
    expect(await listSavedJourneys(7)).toEqual([
      { key: "bad", snapshot: null },
      { key: "wrong-key", snapshot: null },
    ]);
    await deleteSavedJourney(7, "bad");
    expect(mockDb.runAsync.mock.calls[0].slice(2)).toEqual([7, "bad"]);
  });

  it("allows replacement at the cap but rejects another new journey", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ total: 50 });
    await expect(saveJourney(snapshot)).rejects.toThrow("limit 50");
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ journey_key: "21:8:2:4" })
      .mockResolvedValueOnce({ total: 50 });
    await expect(saveJourney(snapshot)).resolves.toBe("21:8:2:4");
  });

  it("rejects an account switch during a save transaction before inserting", async () => {
    mockDb.getFirstAsync.mockImplementationOnce(async () => {
      useAuthStore.setState({ user: { id: 8 } as never });
      return null;
    });
    await expect(saveJourney(snapshot)).rejects.toThrow("unavailable");
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("blocks saves during logout and deletes only that account's snapshots", async () => {
    useOfflineAccessStore.setState({ isRevoking: true });
    await expect(saveJourney(snapshot)).rejects.toThrow("Sign in");
    await clearSavedJourneys(7);
    expect(mockDb.runAsync.mock.calls[0][0]).toContain("owner_id = ?");
    expect(mockDb.runAsync.mock.calls[0].slice(2)).toEqual([7]);
  });

  it("propagates storage failure instead of presenting it as an empty list", async () => {
    mockDb.getAllAsync.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(listSavedJourneys(7)).rejects.toThrow("storage unavailable");
  });

  it("keeps ordinary bulk deletion unauthorized after access is revoked", async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    await expect(clearSavedJourneys(7)).rejects.toThrow("unavailable");
    await expect(clearSavedJourneysForLogout()).resolves.toBeUndefined();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("does not attempt native SQLite cleanup on web", async () => {
    const platform = jest.replaceProperty(Platform, "OS", "web");
    try {
      await expect(clearSavedJourneysForLogout()).resolves.toBeUndefined();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    } finally {
      platform.restore();
    }
  });
});
