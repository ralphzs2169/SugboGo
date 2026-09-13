import React, { type PropsWithChildren } from "react";
import {
  type InfiniteData,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import useBusinessPocket from "../useBusinessPocket";
import useBusinessVouch from "../useBusinessVouch";
import type {
  ExploreBusiness,
  ExploreBusinessListResponse,
} from "../../types/exploreBusiness.types";
import {
  pocketBusiness,
  vouchForBusinessSpecialty,
} from "../../api/exploreBusiness.service";

jest.mock("../../api/exploreBusiness.service", () => ({
  pocketBusiness: jest.fn(),
  removeBusinessFromPocket: jest.fn(),
  vouchForBusinessSpecialty: jest.fn(),
  removeBusinessSpecialtyVouch: jest.fn(),
}));
jest.mock("@/shared/api/storage.service", () => ({
  getInstallationId: jest.fn().mockResolvedValue("test-installation"),
}));

function createBusiness(): ExploreBusiness {
  return {
    id: 42,
    business_name: "Cached Similar Business",
    cover_photo_url: null,
    is_pocketed: false,
    cluster: {
      id: 1,
      name: "Culinary",
      icon: "utensils",
    },
    category: {
      id: 8,
      name: "Cafe",
    },
    specialty_tags: [
      {
        id: 5,
        name: "Coffee",
        color: "blue",
        vouch_count: 2,
        is_vouched: false,
      },
    ],
    location: {
      address: "Cebu",
      city: "Cebu City",
      province: "Cebu",
      latitude: 10.31,
      longitude: 123.89,
    },
  };
}

function createCollectionData(): InfiniteData<ExploreBusinessListResponse> {
  return {
    pageParams: [1],
    pages: [
      {
        items: [createBusiness()],
        pagination: {
          page: 1,
          page_size: 10,
          total_items: 1,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
      },
    ],
  };
}

describe("Similar Places interaction cache", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
        },
      },
    });
    client.setQueryData(["similar-businesses", 7], [createBusiness()]);
    client.setQueryData(["similar-businesses", 9], [createBusiness()]);
    client.setQueryData(
      ["explore-collections", "hidden-gems", null, [], null],
      createCollectionData(),
    );
  });

  afterEach(() => {
    client.clear();
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it("updates Pocket state across every Similar Places query", async () => {
    (pocketBusiness as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        business_id: 42,
        is_pocketed: true,
      },
    });
    const { result } = await renderHook(
      () => useBusinessPocket({ businessId: 42 }),
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.pocket({ isPocketed: false });
    });

    for (const sourceBusinessId of [7, 9]) {
      const cached = client.getQueryData<ExploreBusiness[]>([
        "similar-businesses",
        sourceBusinessId,
      ]);

      expect(cached?.[0].is_pocketed).toBe(true);
    }
  });

  it("updates vouch state across every Similar Places query", async () => {
    (vouchForBusinessSpecialty as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        business_id: 42,
        tag_id: 5,
        is_vouched: true,
      },
    });
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 42 }),
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.vouch({
        tagId: 5,
        isVouched: false,
      });
    });

    for (const sourceBusinessId of [7, 9]) {
      const cached = client.getQueryData<ExploreBusiness[]>([
        "similar-businesses",
        sourceBusinessId,
      ]);

      expect(cached?.[0].specialty_tags[0]).toEqual(
        expect.objectContaining({
          is_vouched: true,
          vouch_count: 3,
        }),
      );
    }
  });

  it("updates collection Pocket state without reordering cached pages", async () => {
    (pocketBusiness as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        business_id: 42,
        is_pocketed: true,
      },
    });
    const { result } = await renderHook(
      () => useBusinessPocket({ businessId: 42 }),
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.pocket({ isPocketed: false });
    });

    const cached = client.getQueryData<
      InfiniteData<ExploreBusinessListResponse>
    >(["explore-collections", "hidden-gems", null, [], null]);

    expect(cached?.pages[0].items.map((item) => item.id)).toEqual([42]);
    expect(cached?.pages[0].items[0].is_pocketed).toBe(true);
  });

  it("updates collection vouch state without reordering cached pages", async () => {
    (vouchForBusinessSpecialty as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        business_id: 42,
        tag_id: 5,
        is_vouched: true,
      },
    });
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 42 }),
      {
        wrapper: Wrapper,
      },
    );

    await act(async () => {
      await result.current.vouch({
        tagId: 5,
        isVouched: false,
      });
    });

    const cached = client.getQueryData<
      InfiniteData<ExploreBusinessListResponse>
    >(["explore-collections", "hidden-gems", null, [], null]);

    expect(cached?.pages[0].items.map((item) => item.id)).toEqual([42]);
    expect(cached?.pages[0].items[0].specialty_tags[0]).toEqual(
      expect.objectContaining({
        is_vouched: true,
        vouch_count: 3,
      }),
    );
  });
});
