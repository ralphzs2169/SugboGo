import React, { type PropsWithChildren } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";

import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { submitApplication } from "../../../api/merchantApplication.service";
import { merchantApplicationKeys } from "../../merchantApplicationQueryKeys";
import useSubmitApplication from "../useSubmitApplication";

jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: { user: { id: number } }) => unknown) =>
    selector({
      user: {
        id: 42,
      },
    }),
}));

jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(),
}));

jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));

jest.mock("../../../api/merchantApplication.service", () => ({
  submitApplication: jest.fn(),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        gcTime: Infinity,
      },
    },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("merchant application submission mutation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns submission data and invalidates application caches without delaying success", async () => {
    const response = {
      success: true as const,
      message: "Application submitted.",
      data: {
        status: "submitted" as const,
        review_sla_min_business_days: 3,
        review_sla_max_business_days: 5,
      },
    };

    (submitApplication as jest.Mock).mockResolvedValue(response);

    const unresolvedInvalidation = new Promise<void>(() => undefined);
    const client = createQueryClient();
    const invalidate = jest
      .spyOn(client, "invalidateQueries")
      .mockReturnValue(unresolvedInvalidation);
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useSubmitApplication, {
      wrapper,
    });

    let submissionResult;

    await act(async () => {
      submissionResult = await result.current.submit();
    });

    expect(submissionResult).toEqual({
      success: true,
      data: response.data,
    });
    expect(invalidate).toHaveBeenNthCalledWith(1, {
      queryKey: merchantApplicationKeys.current(42),
    });
    expect(invalidate).toHaveBeenNthCalledWith(2, {
      queryKey: merchantApplicationKeys.status(42),
    });
    expect(result.current.isSubmitting).toBe(false);

    unmount();
    client.clear();
  });

  it("uses mutation pending state and prevents duplicate submissions", async () => {
    const response = {
      success: true as const,
      message: "Application submitted.",
      data: {
        status: "submitted" as const,
        review_sla_min_business_days: 3,
        review_sla_max_business_days: 5,
      },
    };

    let resolveSubmission: (value: typeof response) => void = () => undefined;
    const pendingSubmission = new Promise<typeof response>((resolve) => {
      resolveSubmission = resolve;
    });

    (submitApplication as jest.Mock).mockReturnValue(pendingSubmission);

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useSubmitApplication, {
      wrapper,
    });

    let firstSubmission: Promise<unknown> = Promise.resolve();

    await act(async () => {
      firstSubmission = result.current.submit();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(true));

    await expect(result.current.submit()).resolves.toEqual({
      success: false,
    });
    expect(submitApplication).toHaveBeenCalledTimes(1);

    resolveSubmission(response);

    await act(async () => {
      await firstSubmission;
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    unmount();
    client.clear();
  });

  it("propagates API errors while preserving submission feedback", async () => {
    const response: ApiError = {
      success: false,
      message: "Complete all required sections before submitting.",
      code: "VALIDATION_ERROR",
      errors: {
        documents: ["A permit is required."],
      },
    };

    (submitApplication as jest.Mock).mockResolvedValue(response);
    (handleSystemError as jest.Mock).mockReturnValue(false);

    const client = createQueryClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useSubmitApplication, {
      wrapper,
    });

    await act(async () => {
      await expect(result.current.submit()).resolves.toEqual({
        success: false,
      });
    });

    await waitFor(() => expect(result.current.error).toEqual(response));
    expect(handleSystemError).toHaveBeenCalledWith(response);
    expect(Toast.show).toHaveBeenCalledWith({
      type: "error",
      text1: "Unable to submit application",
      text2: response.message,
    });
    expect(invalidate).not.toHaveBeenCalled();

    unmount();
    client.clear();
  });

  it("suppresses duplicate toasts for handled system errors", async () => {
    const response: ApiError = {
      success: false,
      message: "Your session has expired.",
      code: "SESSION_EXPIRED",
    };

    (submitApplication as jest.Mock).mockResolvedValue(response);
    (handleSystemError as jest.Mock).mockReturnValue(true);

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useSubmitApplication, {
      wrapper,
    });

    await act(async () => {
      await expect(result.current.submit()).resolves.toEqual({
        success: false,
      });
    });

    expect(handleSystemError).toHaveBeenCalledWith(response);
    expect(Toast.show).not.toHaveBeenCalled();

    unmount();
    client.clear();
  });

  it("invalidates a rejected application when it is resubmitted", async () => {
    const response = {
      success: true as const,
      message: "Application resubmitted.",
      data: {
        status: "submitted" as const,
        review_sla_min_business_days: 4,
        review_sla_max_business_days: 6,
      },
    };

    (submitApplication as jest.Mock).mockResolvedValue(response);

    const client = createQueryClient();
    client.setQueryData(merchantApplicationKeys.current(42), {
      status: "rejected",
    });
    client.setQueryData(merchantApplicationKeys.status(42), {
      status: "rejected",
    });
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useSubmitApplication, {
      wrapper,
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(
      client.getQueryState(merchantApplicationKeys.current(42))?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(merchantApplicationKeys.status(42))?.isInvalidated,
    ).toBe(true);

    unmount();
    client.clear();
  });
});
