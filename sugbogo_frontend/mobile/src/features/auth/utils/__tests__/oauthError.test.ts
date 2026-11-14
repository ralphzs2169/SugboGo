import { Alert } from "react-native";
import Toast from "react-native-toast-message";

import { showOAuthError } from "../oauthError";

jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

describe("OAuth recovery guidance", () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(["Google", "Facebook"] as const)(
    "keeps %s recovery instructions visible and opens the existing recovery flow",
    (provider) => {
      const recover = jest.fn();
      const message =
        "Use Forgot password. After resetting, request a fresh verification link if setup is required.";

      showOAuthError(
        provider,
        { success: false, code: "OAUTH_LINK_REQUIRED", message },
        recover,
      );

      expect(alert).toHaveBeenCalledWith(
        `Continue without ${provider}`,
        message,
        expect.any(Array),
      );
      const action = alert.mock.calls[0][2]?.find(
        (button) => button.text === "Forgot password",
      );
      action?.onPress?.();
      expect(recover).toHaveBeenCalledTimes(1);
      expect(Toast.show).not.toHaveBeenCalled();
    },
  );

  it("shows a controlled account-state error without routing to a dead-end recovery", () => {
    showOAuthError("Google", {
      success: false,
      code: "ACCOUNT_INACTIVE",
      message: "Contact SugboGo support for help.",
    });

    expect(alert).toHaveBeenCalledWith(
      "Couldn't sign in with Google",
      "Contact SugboGo support for help.",
    );
  });
});
