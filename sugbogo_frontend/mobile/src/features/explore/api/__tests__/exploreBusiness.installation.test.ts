import apiClient from "@/shared/api/apiClient.service";

import { vouchForBusinessSpecialty } from "../exploreBusiness.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));
jest.mock("@/shared/api/request.service", () => ({
  request: (value: unknown) => value,
}));

describe("vouchForBusinessSpecialty installation ID", () => {
  it("sends the canonical installation_id key", async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ success: true });

    await vouchForBusinessSpecialty(20, 4, "stored-installation");

    expect(apiClient.post).toHaveBeenCalledWith(
      "/explorer/explore/businesses/20/vouch/",
      { tag_id: 4, installation_id: "stored-installation" },
    );
  });
});
