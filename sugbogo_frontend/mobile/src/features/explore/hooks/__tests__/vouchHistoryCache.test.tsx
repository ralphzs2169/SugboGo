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
import type { ExploreBusinessDetail } from "../../types/exploreBusiness.types";

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

  it.each([1, 2, 3])(
    "keeps the other tags intact when concurrent tag %s fails out of order",
    async (failedTagId) => {
      const responses = new Map<number, (value: unknown) => void>();
      const deferred = (_businessId: number, tagId: number) =>
        new Promise((resolve) => {
          responses.set(tagId, resolve);
        });
      (vouchForBusinessSpecialty as jest.Mock).mockImplementation(deferred);
      (removeBusinessSpecialtyVouch as jest.Mock).mockImplementation(deferred);
      const invalidate = jest.spyOn(client, "invalidateQueries");
      const { result } = await renderHook(
        () => useBusinessVouch({ businessId: 1 }),
        { wrapper: Wrapper },
      );
      const requests = new Map<number, Promise<unknown>>();
      await act(async () => {
        for (const tagId of [1, 2, 3]) {
          requests.set(
            tagId,
            result.current
              .vouch({
                tagId,
                isVouched: tagId === 1,
              })
              .catch((error) => error),
          );
        }
      });
      await waitFor(() => expect(responses.size).toBe(3));
      await waitFor(() =>
        expect(result.current.pendingTagIds).toEqual([1, 2, 3]),
      );

      const firstSuccess = [1, 2, 3].find((id) => id !== failedTagId)!;
      const lastSuccess = [1, 2, 3].find(
        (id) => id !== failedTagId && id !== firstSuccess,
      )!;
      await act(async () => {
        responses.get(firstSuccess)!({ success: true, data: {} });
        await requests.get(firstSuccess);
      });
      expect(invalidate).not.toHaveBeenCalled();
      await act(async () => {
        responses.get(failedTagId)!({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Rejected",
        });
        await requests.get(failedTagId);
      });
      expect(invalidate).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(result.current.pendingTagIds).toEqual([lastSuccess]),
      );

      // Check detail, flat feeds, paginated feeds and similar-business caches.
      const businesses = [
        client.getQueryData<ExploreBusinessDetail>(detailKey),
        ...flatKeys.map(
          (key) =>
            (client.getQueryData(key) as { items: ExploreBusinessDetail[] })
              .items[0],
        ),
        ...infiniteKeys.map(
          (key) =>
            (
              client.getQueryData(key) as {
                pages: { items: ExploreBusinessDetail[] }[];
              }
            ).pages[0].items[0],
        ),
        (client.getQueryData(similarKey) as ExploreBusinessDetail[])[0],
      ];
      for (const business of businesses) {
        for (const tagId of [1, 2, 3]) {
          const selected = tagId === failedTagId ? tagId === 1 : tagId !== 1;
          expect(
            business?.specialty_tags.find((tag) => tag.id === tagId),
          ).toMatchObject({
            is_vouched: selected,
            vouch_count: selected ? 1 : 0,
          });
        }
      }
      await act(async () => {
        responses.get(lastSuccess)!({ success: true, data: {} });
        await requests.get(lastSuccess);
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: detailKey });
      await waitFor(() => expect(result.current.pendingTagIds).toEqual([]));
    },
  );

  it("reconciles once when all three responses settle simultaneously", async () => {
    let finish!: (value: unknown) => void;
    const response = new Promise((resolve) => {
      finish = resolve;
    });
    (vouchForBusinessSpecialty as jest.Mock).mockReturnValue(response);
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    const requests: Promise<unknown>[] = [];
    await act(async () => {
      for (const tagId of [2, 3, 4]) {
        requests.push(result.current.vouch({ tagId, isVouched: false }));
      }
    });
    await waitFor(() =>
      expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(3),
    );
    await act(async () => {
      finish({ success: true, data: {} });
      await Promise.all(requests);
    });
    expect(
      invalidate.mock.calls.filter(
        ([filters]) =>
          JSON.stringify(filters?.queryKey) === JSON.stringify(detailKey),
      ),
    ).toHaveLength(1);
  });

  it("pins concurrent requests and reconciliation to their original businesses", async () => {
    client.setQueryData(
      ["explore-business-detail", 2],
      businessDetail(historyBusiness(2, [])),
    );
    const responses = new Map<number, (value: unknown) => void>();
    (vouchForBusinessSpecialty as jest.Mock).mockImplementation(
      (id) =>
        new Promise((resolve) => {
          responses.set(id, resolve);
        }),
    );
    let activeBusinessId = 1;
    const { result, rerender } = await renderHook(
      () => useBusinessVouch({ businessId: activeBusinessId }),
      { wrapper: Wrapper },
    );
    const invalidate = jest.spyOn(client, "invalidateQueries");
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = result.current
        .vouch({ tagId: 2, isVouched: false })
        .catch((error) => error);
    });
    await waitFor(() => expect(responses.has(1)).toBe(true));
    activeBusinessId = 2;
    await rerender(undefined);
    await act(async () => {
      second = result.current.vouch({ tagId: 3, isVouched: false });
    });
    await waitFor(() => expect(responses.has(2)).toBe(true));
    await act(async () => {
      responses.get(1)!({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Rejected",
      });
      await first;
    });
    expect(invalidate).not.toHaveBeenCalled();
    expect(
      client
        .getQueryData<ExploreBusinessDetail>(["explore-business-detail", 2])
        ?.specialty_tags.find((tag) => tag.id === 3)?.is_vouched,
    ).toBe(true);
    await act(async () => {
      responses.get(2)!({ success: true, data: {} });
      await second;
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["explore-business-detail", 1],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["explore-business-detail", 2],
    });
  });

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
