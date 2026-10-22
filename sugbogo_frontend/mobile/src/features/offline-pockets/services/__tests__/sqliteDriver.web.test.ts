import { openDatabaseAsync } from "../sqliteDriver.web";

jest.mock("expo-sqlite", () => {
  throw new Error("The web adapter must not load native SQLite.");
});

it("reports unsupported persistence without loading native SQLite", async () => {
  await expect(openDatabaseAsync("sugbogo_offline_pockets.db")).rejects.toThrow(
    "Android and iOS",
  );
});
