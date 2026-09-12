import apiClient from "@/shared/api/apiClient.service";

import {
  completeOnboardingInterests,
  getUserInterests,
  updateUserInterests,
} from "../interest.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
  },
}));

describe("interest transport", () => {
  beforeEach(() => {
    const response = { data: { success: true, data: {} } };
    (apiClient.get as jest.Mock).mockResolvedValue(response);
    (apiClient.patch as jest.Mock).mockResolvedValue(response);
    (apiClient.put as jest.Mock).mockResolvedValue(response);
  });

  it("loads current interests and authoritative options", async () => {
    await getUserInterests();

    expect(apiClient.get).toHaveBeenCalledWith("/users/me/interests/");
  });

  it("submits authoritative specialty IDs during onboarding", async () => {
    await completeOnboardingInterests([19, 42]);

    expect(apiClient.patch).toHaveBeenCalledWith("/users/me/interests/", {
      specialty_tag_ids: [19, 42],
    });
  });

  it("saves category and specialty drafts together", async () => {
    await updateUserInterests({
      category_ids: [8],
      specialty_tag_ids: [19, 42],
    });

    expect(apiClient.put).toHaveBeenCalledWith("/users/me/interests/", {
      category_ids: [8],
      specialty_tag_ids: [19, 42],
    });
  });
});
