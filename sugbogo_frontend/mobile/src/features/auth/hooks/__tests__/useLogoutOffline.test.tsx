import { act, renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { useAuthStore } from "../../store/auth.store";
import { clearSessionTokens } from "@/shared/api/storage.service";
import { clearOfflineAccess } from "@/features/offline-routes/services/offlineAccess.service";
import { clearSavedJourneys } from "@/features/offline-routes/services/savedJourneys.service";
import { useLogout } from "../useLogout";

jest.mock("@/shared/api/storage.service", () => ({ clearSessionTokens: jest.fn() }));
jest.mock("@/features/offline-routes/services/offlineAccess.service", () => ({
  clearOfflineAccess: jest.fn(),
}));
jest.mock("@/features/offline-routes/services/savedJourneys.service", () => ({
  clearSavedJourneys: jest.fn(),
}));
jest.mock("@/features/merchant/stores/merchantRegistrationStore", () => ({
  useMerchantRegistrationStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

describe("logout device cleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 7 } as never, isAuthenticated: true });
    (clearSessionTokens as jest.Mock).mockImplementation(async () => {
      await clearOfflineAccess();
      return true;
    });
    (clearOfflineAccess as jest.Mock).mockResolvedValue(undefined);
    (clearSavedJourneys as jest.Mock).mockResolvedValue(undefined);
  });

  it.each([false, true])(
    "revokes access and signs out even when cleanup fails: %s",
    async (fails) => {
      if (fails)
        (clearSavedJourneys as jest.Mock).mockRejectedValue(
          new Error("device unavailable"),
        );
      const client = new QueryClient();
      client.setQueryData(["private"], { value: "private" });
      const wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const hook = await renderHook(() => useLogout(), { wrapper });
      await act(async () => {
        expect(await hook.result.current.logout()).toBe(!fails);
      });
      expect(clearOfflineAccess).toHaveBeenCalled();
      expect(clearSavedJourneys).toHaveBeenCalledWith(7);
      expect(clearSessionTokens).toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(client.getQueryData(["private"])).toBeUndefined();
      hook.unmount();
      client.clear();
    },
  );
});
