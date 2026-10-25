import type { PropsWithChildren } from "react";
import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import {
  businessDetail,
  historyBusiness,
} from "@/features/profile/__tests__/vouchHistory.fixtures";
import {
  getExploreBusinessDetail,
  removeBusinessSpecialtyVouch,
  vouchForBusinessSpecialty,
} from "../../api/exploreBusiness.service";
import useBusinessVouch from "../useBusinessVouch";
import type { ExploreBusinessDetail } from "../../types/exploreBusiness.types";

jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(),
  removeBusinessSpecialtyVouch: jest.fn(),
  vouchForBusinessSpecialty: jest.fn(),
}));
jest.mock("@/shared/api/storage.service", () => ({
  getInstallationId: jest.fn().mockResolvedValue("installation"),
}));

function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const success = { success: true, data: {} };
const rejected = {
  success: false,
  code: "VALIDATION_ERROR",
  message: "Rejected",
};
const timeout = {
  success: false,
  code: "REQUEST_TIMEOUT",
  message: "Timed out",
};

describe("latest vouch intent", () => {
  beforeAll(() =>
    notifyManager.setScheduler((callback) => {
      queueMicrotask(callback);
    }),
  );
  afterAll(() =>
    notifyManager.setScheduler((callback) => {
      setTimeout(callback, 0);
    }),
  );
  let client: QueryClient;
  const key = ["explore-business-detail", 1];
  beforeEach(() => {
    jest.clearAllMocks();
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
    client.setQueryData(key, businessDetail(historyBusiness(1, [])));
  });
  afterEach(() => client.clear());
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  function tag(tagId = 1) {
    return client
      .getQueryData<ExploreBusinessDetail>(key)!
      .specialty_tags.find((item) => item.id === tagId)!;
  }

  it("coalesces opposite taps before dispatch and keeps every cached count aligned", async () => {
    const business = businessDetail(historyBusiness(1, []));
    const flatKeys = [
      ["explore-new-businesses"],
      ["explore-discovery"],
      ["explore-recommendations"],
    ];
    const pageKeys = [
      ["explore-discovery-results", "criteria"],
      ["explore-collections", "hidden-gems"],
    ];
    for (const queryKey of flatKeys)
      client.setQueryData(queryKey, { items: [business] });
    for (const queryKey of pageKeys)
      client.setQueryData(queryKey, {
        pages: [{ items: [business] }],
        pageParams: [1],
      });
    client.setQueryData(["similar-businesses", 2], [business]);
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    await act(async () => {
      const drain = result.current.vouch({ tagId: 1, isVouched: false });
      expect(tag()).toMatchObject({ is_vouched: true, vouch_count: 1 });
      await result.current.vouch({ tagId: 1, isVouched: false });
      await drain;
    });
    expect(vouchForBusinessSpecialty).not.toHaveBeenCalled();
    expect(removeBusinessSpecialtyVouch).not.toHaveBeenCalled();
    for (const queryKey of flatKeys)
      expect(client.getQueryData(queryKey)).toEqual({ items: [business] });
    for (const queryKey of pageKeys)
      expect(client.getQueryData(queryKey)).toEqual({
        pages: [{ items: [business] }],
        pageParams: [1],
      });
    expect(client.getQueryData(["similar-businesses", 2])).toEqual([business]);
  });

  it("updates add/remove immediately, sends writes in order, and never flashes an older response", async () => {
    const add = deferred();
    const remove = deferred();
    (vouchForBusinessSpecialty as jest.Mock).mockReturnValue(add.promise);
    (removeBusinessSpecialtyVouch as jest.Mock).mockReturnValue(remove.promise);
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    const celebrate = jest.fn();
    let drain!: Promise<void>;
    await act(async () => {
      drain = result.current.vouch({ tagId: 1, isVouched: false }, celebrate);
      expect(tag()).toMatchObject({ is_vouched: true, vouch_count: 1 });
      expect(celebrate).toHaveBeenCalledTimes(1);
    });
    await waitFor(() =>
      expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(1),
    );
    await act(async () => {
      // Deliberately stale props: the pending intent still toggles correctly.
      await result.current.vouch({ tagId: 1, isVouched: false }, celebrate);
      expect(tag()).toMatchObject({ is_vouched: false, vouch_count: 0 });
    });
    expect(removeBusinessSpecialtyVouch).not.toHaveBeenCalled();
    await act(async () => add.resolve(success));
    await waitFor(() =>
      expect(removeBusinessSpecialtyVouch).toHaveBeenCalledTimes(1),
    );
    expect(tag().is_vouched).toBe(false);
    await act(async () => {
      remove.resolve(success);
      await drain;
    });
    expect(tag()).toMatchObject({ is_vouched: false, vouch_count: 0 });
    expect(celebrate).toHaveBeenCalledTimes(1);
  });

  it("coalesces add/remove/add to one in-flight add and keeps counts bounded", async () => {
    const add = deferred();
    (vouchForBusinessSpecialty as jest.Mock).mockReturnValue(add.promise);
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    const celebrate = jest.fn();
    let drain!: Promise<void>;
    await act(async () => {
      drain = result.current.vouch({ tagId: 1, isVouched: false }, celebrate);
    });
    await waitFor(() =>
      expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(1),
    );
    await act(async () => {
      await result.current.vouch({ tagId: 1, isVouched: false }, celebrate);
      await result.current.vouch({ tagId: 1, isVouched: false }, celebrate);
    });
    expect(tag()).toMatchObject({ is_vouched: true, vouch_count: 1 });
    await act(async () => {
      add.resolve(success);
      await drain;
    });
    expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(1);
    expect(removeBusinessSpecialtyVouch).not.toHaveBeenCalled();
    expect(celebrate).toHaveBeenCalledTimes(2);
  });

  it("saves three specialties independently and rolls back only the rejected tag", async () => {
    const responses = [deferred(), deferred(), deferred()];
    (vouchForBusinessSpecialty as jest.Mock).mockImplementation(
      (_businessId, tagId) => responses[tagId - 1].promise,
    );
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    const drains: Promise<unknown>[] = [];
    await act(async () => {
      for (const tagId of [1, 2, 3])
        drains.push(
          result.current
            .vouch({ tagId, isVouched: false })
            .catch((error) => error),
        );
    });
    await waitFor(() =>
      expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(3),
    );
    expect([1, 2, 3].map((id) => tag(id).is_vouched)).toEqual([
      true,
      true,
      true,
    ]);
    await act(async () => {
      responses[1].resolve(rejected);
      await drains[1];
    });
    expect([1, 2, 3].map((id) => tag(id).is_vouched)).toEqual([
      true,
      false,
      true,
    ]);
    expect(invalidate).not.toHaveBeenCalled();
    await act(async () => {
      responses[0].resolve(success);
      responses[2].resolve(success);
      await Promise.all(drains);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
  });

  it("ignores an obsolete failure when the latest choice already matches the server", async () => {
    const add = deferred();
    (vouchForBusinessSpecialty as jest.Mock).mockReturnValue(add.promise);
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    let drain!: Promise<void>;
    await act(async () => {
      drain = result.current.vouch({ tagId: 1, isVouched: false });
    });
    await waitFor(() =>
      expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(1),
    );
    await act(async () => {
      await result.current.vouch({ tagId: 1, isVouched: true });
    });
    await act(async () => {
      add.resolve(rejected);
      await expect(drain).resolves.toBeUndefined();
    });
    expect(tag().is_vouched).toBe(false);
    expect(removeBusinessSpecialtyVouch).not.toHaveBeenCalled();
  });

  it("restores the last confirmed add when a subsequent removal is rejected", async () => {
    const add = deferred();
    (vouchForBusinessSpecialty as jest.Mock).mockReturnValue(add.promise);
    (removeBusinessSpecialtyVouch as jest.Mock).mockResolvedValue(rejected);
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    let drain!: Promise<unknown>;
    await act(async () => {
      drain = result.current
        .vouch({ tagId: 1, isVouched: false })
        .catch((error) => error);
    });
    await waitFor(() =>
      expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(1),
    );
    await act(async () => {
      await result.current.vouch({ tagId: 1, isVouched: true });
    });
    await act(async () => {
      add.resolve(success);
      await drain;
    });
    expect(await drain).toMatchObject(rejected);
    expect(tag()).toMatchObject({ is_vouched: true, vouch_count: 1 });
  });

  it("reads the server after a timeout before sending the latest corrective choice", async () => {
    const add = deferred();
    const read = deferred();
    (vouchForBusinessSpecialty as jest.Mock).mockReturnValue(add.promise);
    (getExploreBusinessDetail as jest.Mock).mockReturnValue(read.promise);
    (removeBusinessSpecialtyVouch as jest.Mock).mockResolvedValue(success);
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    let drain!: Promise<void>;
    await act(async () => {
      drain = result.current.vouch({ tagId: 1, isVouched: false });
    });
    await waitFor(() =>
      expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(1),
    );
    await act(async () => {
      await result.current.vouch({ tagId: 1, isVouched: true });
      add.resolve(timeout);
    });
    await waitFor(() =>
      expect(getExploreBusinessDetail).toHaveBeenCalledWith(1),
    );
    expect(removeBusinessSpecialtyVouch).not.toHaveBeenCalled();
    await act(async () => {
      read.resolve({
        success: true,
        data: businessDetail(historyBusiness(1, [1])),
      });
      await drain;
    });
    expect(removeBusinessSpecialtyVouch).toHaveBeenCalledTimes(1);
    expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(1);
    expect(tag().is_vouched).toBe(false);
  });

  it("does not retry an uncertain write if the verification read also fails", async () => {
    (vouchForBusinessSpecialty as jest.Mock).mockResolvedValue(timeout);
    (getExploreBusinessDetail as jest.Mock).mockResolvedValue(timeout);
    const { result } = await renderHook(
      () => useBusinessVouch({ businessId: 1 }),
      { wrapper: Wrapper },
    );
    await act(async () => {
      await expect(
        result.current.vouch({ tagId: 1, isVouched: false }),
      ).rejects.toMatchObject(timeout);
    });
    expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(1);
    expect(removeBusinessSpecialtyVouch).not.toHaveBeenCalled();
    expect(tag().is_vouched).toBe(false);
  });

  it("shares the pending intent across hook remounts instead of duplicating writes", async () => {
    const add = deferred();
    (vouchForBusinessSpecialty as jest.Mock).mockReturnValue(add.promise);
    (removeBusinessSpecialtyVouch as jest.Mock).mockResolvedValue(success);
    const first = await renderHook(() => useBusinessVouch({ businessId: 1 }), {
      wrapper: Wrapper,
    });
    let drain!: Promise<void>;
    await act(async () => {
      drain = first.result.current.vouch({ tagId: 1, isVouched: false });
    });
    await waitFor(() =>
      expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(1),
    );
    await first.unmount();
    const second = await renderHook(() => useBusinessVouch({ businessId: 1 }), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await second.result.current.vouch({ tagId: 1, isVouched: true });
    });
    await act(async () => {
      add.resolve(success);
      await drain;
    });
    expect(vouchForBusinessSpecialty).toHaveBeenCalledTimes(1);
    expect(removeBusinessSpecialtyVouch).toHaveBeenCalledTimes(1);
    expect(tag().is_vouched).toBe(false);
  });
});
