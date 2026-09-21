import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";

describe("merchantApplicationKeys", () => {
  it("returns stable keys for merchant application resources", () => {
    expect(merchantApplicationKeys.current(12)).toEqual([
      "merchant-application",
      "current",
      12,
    ]);
    expect(merchantApplicationKeys.current(12)).toEqual(
      merchantApplicationKeys.current(12),
    );
    expect(merchantApplicationKeys.clusters()).toEqual([
      "merchant-application",
      "options",
      "clusters",
    ]);
    expect(merchantApplicationKeys.categories()).toEqual([
      "merchant-application",
      "options",
      "categories",
    ]);
    expect(merchantApplicationKeys.specialtyTags()).toEqual([
      "merchant-application",
      "options",
      "specialty-tags",
    ]);
  });

  it("preserves the existing application status key", () => {
    expect(merchantApplicationKeys.status(12)).toEqual([
      "merchant-application-status",
      12,
    ]);
  });
});
