import {
  buildBusinessPhotosFormData,
  mapBusinessPhotosToDrafts,
  validateBusinessPhotoDrafts,
  visiblePhotos,
} from "../businessPhotos.utils";

describe("business photo draft helpers", () => {
  const saved = {
    id: 7,
    category: "storefront" as const,
    url: "https://example.com/storefront.jpg",
    file_name: "storefront.jpg",
  };

  it("initializes saved photos in their categories", () => {
    const drafts = mapBusinessPhotosToDrafts([saved]);

    expect(drafts.storefront).toEqual([
      {
        id: 7,
        uri: saved.url,
        fileName: "storefront.jpg",
      },
    ]);
    expect(drafts.interior).toEqual([]);
  });

  it("validates the final state after removals and additions", () => {
    const drafts = mapBusinessPhotosToDrafts([saved]);

    expect(validateBusinessPhotoDrafts(drafts, [saved.id]).storefront).toBe(
      "At least one storefront photo is required.",
    );

    drafts.storefront.push({
      uri: "file:///replacement.jpg",
      fileName: "replacement.jpg",
      mimeType: "image/jpeg",
    });

    expect(validateBusinessPhotoDrafts(drafts, [saved.id])).toEqual({});
    expect(visiblePhotos(drafts.storefront, [saved.id])).toHaveLength(1);
  });

  it("builds one multipart payload with new files and saved removal IDs", () => {
    const drafts = mapBusinessPhotosToDrafts([saved]);
    drafts.storefront.push({
      uri: "file:///replacement.png",
      fileName: "replacement.png",
      mimeType: "image/png",
    });

    const append = jest.spyOn(FormData.prototype, "append");

    buildBusinessPhotosFormData(drafts, [saved.id]);

    expect(append).toHaveBeenCalledWith(
      "storefront",
      expect.objectContaining({
        uri: "file:///replacement.png",
        name: "replacement.png",
        type: "image/png",
      }),
    );
    expect(append).toHaveBeenCalledWith("deleted_photo_ids", "7");
    append.mockRestore();
  });
});
