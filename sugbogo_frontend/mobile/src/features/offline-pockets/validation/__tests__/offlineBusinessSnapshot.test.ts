import {
  createOfflineBusinessSnapshot,
  parseOfflineBusinessSnapshot,
  serializeOfflineBusinessSnapshot,
} from "../offlineBusinessSnapshot";
import { businessFixture, snapshotFixture } from "./snapshotFixture";

describe("Offline business snapshot validation", () => {
  it("round trips only presentation fields from the real detail DTO", () => {
    const input = businessFixture();
    const snapshot = createOfflineBusinessSnapshot(
      input,
      "2026-10-22T01:00:00Z",
    );
    expect(snapshot.business).not.toHaveProperty("review_count");
    expect(snapshot.business).not.toHaveProperty("review_insights");
    expect(snapshot.business).not.toHaveProperty("is_pocketed");
    expect(snapshot.business.specialty_tags[0]).not.toHaveProperty(
      "vouch_count",
    );
    expect(snapshot.business.specialty_tags[0]).not.toHaveProperty(
      "is_vouched",
    );
    expect(snapshot.business.photos[0].photo_url).toBe(
      input.photos[0].photo_url,
    );
    const { json } = serializeOfflineBusinessSnapshot(snapshot);
    expect(parseOfflineBusinessSnapshot(json)).toEqual({
      status: "available",
      snapshot,
    });
  });

  it("supports real nullable/blank API fields and second/fractional times", () => {
    const business = businessFixture();
    business.description = null;
    business.email = "";
    business.website = null;
    business.cover_photo_url = null;
    business.operating_hours[0].open_time = "08:00:00.123456";
    business.operating_hours[0].close_time = null;
    expect(() =>
      createOfflineBusinessSnapshot(business, "2026-10-22T09:00:00+08:00"),
    ).not.toThrow();
  });

  it.each([
    { business_name: undefined },
    { business_name: " " },
    { id: 0 },
    { location: { ...businessFixture().location, latitude: 91 } },
    { location: { ...businessFixture().location, longitude: Number.NaN } },
    { cover_photo_url: "file:///local/photo.jpg" },
    { website: "javascript:alert(1)" },
    {
      specialty_tags: [
        { ...businessFixture().specialty_tags[0], color: "pink" },
      ],
    },
    {
      operating_hours: [
        { ...businessFixture().operating_hours[0], open_time: "25:00" },
      ],
    },
    {
      operating_hours: [
        businessFixture().operating_hours[0],
        businessFixture().operating_hours[0],
      ],
    },
  ])("rejects invalid business fields: %j", (changes) => {
    expect(() =>
      serializeOfflineBusinessSnapshot({
        ...snapshotFixture(),
        business: { ...businessFixture(), ...changes },
      }),
    ).toThrow();
  });

  it.each(["not a date", "1969-12-31T23:59:59Z", "2026-99-99T00:00:00Z"])(
    "rejects an invalid fetch timestamp %s",
    (fetchedAt) => {
      expect(() =>
        serializeOfflineBusinessSnapshot({ ...snapshotFixture(), fetchedAt }),
      ).toThrow();
    },
  );

  it.each([
    "{",
    "null",
    "[]",
    "{}",
    '{"formatVersion":1}',
    '{"formatVersion":"2"}',
  ])("reports corrupted payloads without throwing: %s", (json) => {
    expect(parseOfflineBusinessSnapshot(json)).toEqual({
      status: "corrupt",
      snapshot: null,
    });
  });

  it("reports unsupported formats separately from corruption", () => {
    expect(
      parseOfflineBusinessSnapshot(
        JSON.stringify({ ...snapshotFixture(), formatVersion: 2 }),
      ),
    ).toEqual({ status: "unsupported", snapshot: null });
    expect(() =>
      serializeOfflineBusinessSnapshot({
        ...snapshotFixture(),
        formatVersion: 2,
      }),
    ).toThrow();
  });

  it("bounds JSON size before persistence and parsing", () => {
    const snapshot = snapshotFixture();
    snapshot.business.description = '"'.repeat(500_000);
    expect(() => serializeOfflineBusinessSnapshot(snapshot)).toThrow(
      "too large",
    );
    expect(parseOfflineBusinessSnapshot(" ".repeat(1_000_001))).toEqual({
      status: "corrupt",
      snapshot: null,
    });
  });
});
