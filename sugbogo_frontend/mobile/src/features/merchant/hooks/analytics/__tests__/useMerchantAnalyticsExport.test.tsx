import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import {
  analyticsMerchant,
} from "../../../__tests__/merchantAnalytics.fixtures";
import { getMerchantAnalyticsPdf } from "../../../api/merchantAnalyticsExport.service";
import { shareMerchantAnalyticsPdf } from "../../../utils/merchantAnalyticsExportFile";
import { denyMerchantPlusAccess } from "../useMerchantPlusAccess";
import useMerchantAnalyticsExport from "../useMerchantAnalyticsExport";

jest.mock("../../../api/merchantAnalyticsExport.service", () => ({
  getMerchantAnalyticsPdf: jest.fn(),
}));
jest.mock("../../../utils/merchantAnalyticsExportFile", () => ({
  shareMerchantAnalyticsPdf: jest.fn(),
}));
jest.mock("../useMerchantPlusAccess", () => ({
  denyMerchantPlusAccess: jest.fn(),
}));

describe("explicit private PDF export", () => {
  let client: QueryClient;
  const success = {
    success: true as const,
    message: "PDF",
    data: {
      bytes: new Uint8Array([37, 80, 68, 70, 45]),
      filename: "report.pdf",
    },
  };
  function deferredExport() {
    let resolve!: (value: typeof success) => void;
    const promise = new Promise<typeof success>((finish) => {
      resolve = finish;
    });
    return { promise, resolve };
  }
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  beforeEach(() => {
    client = new QueryClient();
    beginAuthSession();
    useAuthStore.setState({ user: analyticsMerchant() });
    jest.clearAllMocks();
    jest.mocked(getMerchantAnalyticsPdf).mockResolvedValue(success);
    jest.mocked(shareMerchantAnalyticsPdf).mockResolvedValue(undefined);
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });

  it("guards duplicate taps and does not retain PDF bytes in mutation results", async () => {
    const pending = deferredExport();
    jest.mocked(getMerchantAnalyticsPdf).mockReturnValueOnce(pending.promise);
    const hook = await renderHook(() => useMerchantAnalyticsExport(true), {
      wrapper: Wrapper,
    });
    await act(async () => {
      hook.result.current.exportPdf("7");
      hook.result.current.exportPdf("90");
    });
    expect(getMerchantAnalyticsPdf).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(success));
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(shareMerchantAnalyticsPdf).toHaveBeenCalledTimes(1);
    expect(hook.result.current.data).toBeUndefined();
  });

  it("does not share a late response after account changes", async () => {
    const pending = deferredExport();
    jest.mocked(getMerchantAnalyticsPdf).mockReturnValueOnce(pending.promise);
    const hook = await renderHook(() => useMerchantAnalyticsExport(true), {
      wrapper: Wrapper,
    });
    await act(async () => hook.result.current.exportPdf("30"));
    const signal = jest.mocked(getMerchantAnalyticsPdf).mock.calls[0][1];
    await act(async () => {
      useAuthStore.setState({ user: { ...analyticsMerchant(), id: 999 } });
    });
    expect(signal?.aborted).toBe(true);
    await act(async () => pending.resolve(success));
    await waitFor(() => expect(hook.result.current.isPending).toBe(false));
    expect(shareMerchantAnalyticsPdf).not.toHaveBeenCalled();
    expect(hook.result.current.error).toBeNull();
  });

  it("honors a server Plus denial without opening native sharing", async () => {
    jest
      .mocked(getMerchantAnalyticsPdf)
      .mockResolvedValueOnce({
        success: false,
        code: "PLUS_REQUIRED",
        message: "Plus required",
      });
    const hook = await renderHook(() => useMerchantAnalyticsExport(true), {
      wrapper: Wrapper,
    });
    await act(async () => hook.result.current.exportPdf("30"));
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(denyMerchantPlusAccess).toHaveBeenCalledWith(
      client,
      analyticsMerchant().id,
    );
    expect(shareMerchantAnalyticsPdf).not.toHaveBeenCalled();
  });

  it("does not start an export when the report is unavailable to the screen", async () => {
    const hook = await renderHook(() => useMerchantAnalyticsExport(false), {
      wrapper: Wrapper,
    });
    await act(async () => hook.result.current.exportPdf("7"));
    expect(getMerchantAnalyticsPdf).not.toHaveBeenCalled();
  });
});
