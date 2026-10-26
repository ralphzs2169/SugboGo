import apiClient from "@/shared/api/apiClient.service";
import { createReviewReply, updateReviewReply } from "../reviewReply.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { post: jest.fn(), patch: jest.fn() },
}));
jest.mock("@/shared/api/request.service", () => ({
  request: (value: unknown) => value,
}));

const photo = {
  uri: "file:///replacement.jpg",
  fileName: "replacement.jpg",
  mimeType: "image/jpeg",
};

describe("merchant reply photo multipart transport", () => {
  it("omits retention for creation and preserves the selected text and photos", async () => {
    await createReviewReply(7, "Thank you!", [photo]);
    const form = jest.mocked(apiClient.post).mock.calls[0][1] as FormData;
    expect(form.has("keep_photo_ids")).toBe(false);
    expect(form.get("text")).toBe("Thank you!");
    expect(form.getAll("photos")).toHaveLength(1);
  });

  it("sends an unambiguous empty marker to remove all photos", async () => {
    await updateReviewReply(9, "Updated reply.", [], []);
    const form = jest.mocked(apiClient.patch).mock.calls[0][1] as FormData;
    expect(form.getAll("keep_photo_ids")).toEqual(["[]"]);
    expect(form.getAll("photos")).toEqual([]);
  });

  it("retains selected existing IDs as repeated fields", async () => {
    await updateReviewReply(9, "Updated reply.", [], [11, 12]);
    const form = jest.mocked(apiClient.patch).mock.calls[0][1] as FormData;
    expect(form.getAll("keep_photo_ids")).toEqual(["11", "12"]);
  });

  it("sends replacements together with an explicit empty retained set", async () => {
    await updateReviewReply(9, "Updated reply.", [photo], []);
    const form = jest.mocked(apiClient.patch).mock.calls[0][1] as FormData;
    expect(form.getAll("keep_photo_ids")).toEqual(["[]"]);
    expect(form.getAll("photos")).toHaveLength(1);
  });

  it("keeps existing photos while adding a new photo when their IDs are retained", async () => {
    await updateReviewReply(9, "Updated reply.", [photo], [11]);
    const form = jest.mocked(apiClient.patch).mock.calls[0][1] as FormData;
    expect(form.getAll("keep_photo_ids")).toEqual(["11"]);
    expect(form.getAll("photos")).toHaveLength(1);
  });
});
