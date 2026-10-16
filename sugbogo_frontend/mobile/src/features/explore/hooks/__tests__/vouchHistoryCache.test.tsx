import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import {
  businessDetail,
  historyBusiness,
  historyPage,
} from "@/features/profile/__tests__/vouchHistory.fixtures";
import { vouchHistoryQueryKey } from "@/features/profile/hooks/vouchHistoryQueryKeys";
import {
  removeBusinessSpecialtyVouch,
  vouchForBusinessSpecialty,
} from "../../api/exploreBusiness.service";
import useBusinessVouch from "../useBusinessVouch";

jest.mock("../../api/exploreBusiness.service", () => ({
  vouchForBusinessSpecialty: jest.fn(),
  removeBusinessSpecialtyVouch: jest.fn(),
}));
jest.mock("@/shared/api/storage.service", () => ({
  getInstallationId: jest.fn().mockResolvedValue("installation"),
}));

describe("vouch history and existing cache synchronization", () => {
  let client: QueryClient;
  const detailKey = ["explore-business-detail", 1];
  const flatKeys = [
    ["explore-new-businesses"],
    ["explore-discovery"],
    ["explore-recommendations"],
  ];
  const infiniteKeys = [
    ["explore-discovery-results", "criteria"],
    ["explore-collections", "hidden-gems"],
  ];
  const similarKey = ["similar-businesses", 2];

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: 0 },
      },
    });
    (vouchForBusinessSpecialty as jest.Mock).mockReset();
    (removeBusinessSpecialtyVouch as jest.Mock).mockReset();
    client.setQueryData(detailKey, businessDetail(historyBusiness(1, [1])));
    for (const key of flatKeys)
      client.setQueryData(key, {
        items: [businessDetail(historyBusiness(1, [1]))],
      });
    for (const key of infiniteKeys)
      client.setQueryData(key, {
        pages: [{ items: [businessDetail(historyBusiness(1, [1]))] }],
        pageParams: [1],
      });
    client.setQueryData(similarKey, [businessDetail(historyBusiness(1, [1]))]);
    for (const ordering of ["newest", "oldest"] as const)
      client.setQueryData(vouchHistoryQueryKey(1, ordering), {
        pages: [historyPage([historyBusiness(1, [1])])],
        pageParams: [1],
      });
    client.setQueryData(["business-review-preview", 1], {
      reviews: [{ vouched_specialties: [] }],
    });
    client.setQueryData(["business-reviews", 1, { ordering: "oldest" }], {
      pages: [],
    });
  });
  afterEach(() => client.clear());
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it("invalidates all history orderings and review variants without fabricating history records", async () => {
    const before = client.getQueryData(vouchHistoryQueryKey(1, "newest"));
    (vouchForBusinessSpecialty as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: 500, business_id: 1, tag_id: 2, is_vouched: true },
    });
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    await act(() => result.current.vouch({ tagId: 2, isVouched: false }));
    expect(vouchForBusinessSpecialty).toHaveBeenCalledWith(
      1,
      2,
      "installation",
    );
    for (const ordering of ["newest", "oldest"] as const)
      expect(
        client.getQueryState(vouchHistoryQueryKey(1, ordering))?.isInvalidated,
      ).toBe(true);
    expect(
      client.getQueryState(["business-review-preview", 1])?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(["business-reviews", 1, { ordering: "oldest" }])
        ?.isInvalidated,
    ).toBe(true);
    expect(client.getQueryData(vouchHistoryQueryKey(1, "newest"))).toEqual(
      before,
    );
  });

  it("uses the existing DELETE path for removal and invalidates business detail", async () => {
    (removeBusinessSpecialtyVouch as jest.Mock).mockResolvedValue({
      success: true,
      data: { business_id: 1, tag_id: 1, is_vouched: false },
    });
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    await act(() => result.current.vouch({ tagId: 1, isVouched: true }));
    expect(removeBusinessSpecialtyVouch).toHaveBeenCalledWith(1, 1);
    expect(vouchForBusinessSpecialty).not.toHaveBeenCalled();
    expect(client.getQueryData(detailKey)).toMatchObject({
      specialty_tags: expect.arrayContaining([
        expect.objectContaining({ id: 1, is_vouched: false, vouch_count: 0 }),
      ]),
    });
    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
  });

  it("preserves immediate optimistic detail updates and pending-tag state", async () => {
    let resolve!: (value: unknown) => void;
    (removeBusinessSpecialtyVouch as jest.Mock).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    let pending!: Promise<unknown>;
    await act(async () => {
      pending = result.current.vouch({ tagId: 1, isVouched: true });
    });
    await waitFor(() => expect(result.current.pendingTagId).toBe(1));
    expect(client.getQueryData(detailKey)).toMatchObject({
      specialty_tags: expect.arrayContaining([
        expect.objectContaining({ id: 1, is_vouched: false, vouch_count: 0 }),
      ]),
    });
    await act(async () => {
      resolve({ success: true, data: {} });
      await pending;
    });
    await waitFor(() => expect(result.current.pendingTagId).toBeNull());
  });

  it("restores all existing business caches on mutation failure", async () => {
    const keys = [detailKey, ...flatKeys, ...infiniteKeys, similarKey];
    const before = keys.map((key) => client.getQueryData(key));
    (vouchForBusinessSpecialty as jest.Mock).mockResolvedValue({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Rejected",
    });
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    await act(async () => {
      await expect(
        result.current.vouch({ tagId: 2, isVouched: false }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
    keys.forEach((key, index) =>
      expect(client.getQueryData(key)).toEqual(before[index]),
    );
  });
});
