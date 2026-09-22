import React, { type PropsWithChildren } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";

import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import {
  saveApplicationDocuments,
  saveApplicationIdentity,
  saveApplicationLocation,
  saveApplicationOperatingHours,
  saveApplicationPhotos,
} from "../../../api/merchantApplication.service";
import type {
  ApplicationIdentityPayload,
  ApplicationLocationPayload,
  ApplicationOperatingHoursPayload,
} from "../../../types/registration/registrationApi.types";
import { merchantApplicationKeys } from "../../merchantApplicationQueryKeys";
import useSaveApplicationDocuments from "../useSaveApplicationDocuments";
import useSaveApplicationIdentity from "../useSaveIdentity";
import useSaveApplicationLocation from "../useSaveLocation";
import useSaveOperatingHours from "../useSaveOperatingHours";
import useSaveApplicationPhotos from "../useSaveApplicationPhotos";

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
  saveApplicationDocuments: jest.fn(),
  saveApplicationIdentity: jest.fn(),
  saveApplicationLocation: jest.fn(),
  saveApplicationOperatingHours: jest.fn(),
  saveApplicationPhotos: jest.fn(),
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

describe("merchant application section-save mutations", () => {
  it("saves every section and invalidates current application and status", async () => {
    const successfulResponses = {
      identity: {
        success: true as const,
        message: "Identity saved.",
        data: {},
      },
      location: {
        success: true as const,
        message: "Location saved.",
        data: {},
      },
      operatingHours: {
        success: true as const,
        message: "Operating hours saved.",
        data: [],
      },
      photos: {
        success: true as const,
        message: "Photos saved.",
        data: [],
      },
      documents: {
        success: true as const,
        message: "Documents saved.",
        data: [],
      },
    };

    (saveApplicationIdentity as jest.Mock).mockResolvedValue(
      successfulResponses.identity,
    );
    (saveApplicationLocation as jest.Mock).mockResolvedValue(
      successfulResponses.location,
    );
    (saveApplicationOperatingHours as jest.Mock).mockResolvedValue(
      successfulResponses.operatingHours,
    );
    (saveApplicationPhotos as jest.Mock).mockResolvedValue(
      successfulResponses.photos,
    );
    (saveApplicationDocuments as jest.Mock).mockResolvedValue(
      successfulResponses.documents,
    );

    const client = createQueryClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(
      () => ({
        identity: useSaveApplicationIdentity(),
        location: useSaveApplicationLocation(),
        operatingHours: useSaveOperatingHours(),
        photos: useSaveApplicationPhotos(),
        documents: useSaveApplicationDocuments(),
      }),
      {
        wrapper,
      },
    );

    await act(async () => {
      await expect(
        result.current.identity.saveIdentity(
          {} as ApplicationIdentityPayload,
        ),
      ).resolves.toEqual(successfulResponses.identity);
      await expect(
        result.current.location.saveLocation(
          {} as ApplicationLocationPayload,
        ),
      ).resolves.toEqual(successfulResponses.location);
      await expect(
        result.current.operatingHours.saveOperatingHours(
          {} as ApplicationOperatingHoursPayload,
        ),
      ).resolves.toEqual(successfulResponses.operatingHours);
      await expect(
        result.current.photos.savePhotos({} as FormData),
      ).resolves.toEqual(successfulResponses.photos);
      await expect(
        result.current.documents.saveDocuments({} as FormData),
      ).resolves.toEqual(successfulResponses.documents);
    });

    expect(invalidate).toHaveBeenCalledTimes(10);

    for (let callIndex = 0; callIndex < 10; callIndex += 2) {
      expect(invalidate).toHaveBeenNthCalledWith(callIndex + 1, {
        queryKey: merchantApplicationKeys.current(42),
      });
      expect(invalidate).toHaveBeenNthCalledWith(callIndex + 2, {
        queryKey: merchantApplicationKeys.status(42),
      });
    }

    expect(result.current.identity.isSaving).toBe(false);
    expect(result.current.location.isSaving).toBe(false);
    expect(result.current.operatingHours.isSaving).toBe(false);
    expect(result.current.photos.isSaving).toBe(false);
    expect(result.current.documents.isSaving).toBe(false);

    unmount();
    client.clear();
  });

  it("propagates mutation errors while preserving feature error feedback", async () => {
    const response: ApiError = {
      success: false,
      message: "The business name is unavailable.",
      code: "VALIDATION_ERROR",
    };

    (saveApplicationIdentity as jest.Mock).mockResolvedValue(response);
    (handleSystemError as jest.Mock).mockReturnValue(false);

    const client = createQueryClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(
      useSaveApplicationIdentity,
      {
        wrapper,
      },
    );

    let returnedResponse;

    await act(async () => {
      returnedResponse = await result.current.saveIdentity(
        {} as ApplicationIdentityPayload,
      );
    });

    expect(returnedResponse).toEqual(response);
    await waitFor(() => expect(result.current.error).toEqual(response));
    expect(handleSystemError).toHaveBeenCalledWith(response);
    expect(Toast.show).toHaveBeenCalledWith({
      type: "error",
      text1: "Unable to save",
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

    (saveApplicationLocation as jest.Mock).mockResolvedValue(response);
    (handleSystemError as jest.Mock).mockReturnValue(true);

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useSaveApplicationLocation, {
      wrapper,
    });

    await act(async () => {
      await expect(
        result.current.saveLocation({} as ApplicationLocationPayload),
      ).resolves.toEqual(response);
    });

    expect(handleSystemError).toHaveBeenCalledWith(response);
    expect(Toast.show).not.toHaveBeenCalled();

    unmount();
    client.clear();
  });

  it("preserves operating-hours error feedback after system handling", async () => {
    const response: ApiError = {
      success: false,
      message: "Unable to save operating hours.",
      code: "NETWORK_ERROR",
    };

    (saveApplicationOperatingHours as jest.Mock).mockResolvedValue(response);
    (handleSystemError as jest.Mock).mockReturnValue(true);

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useSaveOperatingHours, {
      wrapper,
    });

    await act(async () => {
      await expect(
        result.current.saveOperatingHours(
          {} as ApplicationOperatingHoursPayload,
        ),
      ).resolves.toEqual(response);
    });

    expect(handleSystemError).toHaveBeenCalledWith(response);
    expect(Toast.show).toHaveBeenCalledWith({
      type: "error",
      text1: "Unable to save",
      text2: response.message,
    });

    unmount();
    client.clear();
  });

  it("keeps the mutation pending until application cache refresh completes", async () => {
    const response = {
      success: true as const,
      message: "Identity saved.",
      data: {},
    };

    (saveApplicationIdentity as jest.Mock).mockResolvedValue(response);

    let resolveCurrentInvalidation: () => void = () => undefined;
    const currentInvalidation = new Promise<void>((resolve) => {
      resolveCurrentInvalidation = resolve;
    });

    const client = createQueryClient();

    jest.spyOn(client, "invalidateQueries").mockImplementation((filters) => {
      if (
        JSON.stringify(filters?.queryKey) ===
        JSON.stringify(merchantApplicationKeys.current(42))
      ) {
        return currentInvalidation;
      }

      return Promise.resolve();
    });

    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(
      useSaveApplicationIdentity,
      {
        wrapper,
      },
    );

    let savePromise: Promise<unknown> = Promise.resolve();

    await act(async () => {
      savePromise = result.current.saveIdentity(
        {} as ApplicationIdentityPayload,
      );
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.isSaving).toBe(true));

    let hasSettled = false;
    void savePromise.then(() => {
      hasSettled = true;
    });

    expect(hasSettled).toBe(false);

    resolveCurrentInvalidation();

    await act(async () => {
      await savePromise;
    });

    await waitFor(() => expect(result.current.isSaving).toBe(false));
    expect(hasSettled).toBe(true);

    unmount();
    client.clear();
  });
});
