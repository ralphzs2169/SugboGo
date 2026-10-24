import { act, fireEvent, render } from "@testing-library/react-native";
import { useLogin } from "../../hooks/useLogin";
import LoginScreen from "../LoginScreen";
import { useAuthStore } from "../../store/auth.store";

jest.mock("../../hooks/useLogin", () => ({ useLogin: jest.fn() }));
jest.mock("../../store/verification.store", () => ({
  useVerificationStore: (selector: (state: unknown) => unknown) =>
    selector({ setPendingEmail: jest.fn() }),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("../../hooks/useGoogleLogin", () => ({
  useGoogleLogin: () => ({ handleGoogleLogin: jest.fn() }),
}));
jest.mock("../../hooks/useFacebookLogin", () => ({
  useFacebookLogin: () => ({ handleFacebookLogin: jest.fn() }),
}));
jest.mock("../../components/AuthHeader", () => () => null);
jest.mock("@/shared/components/LoadingScreen", () => {
  const { Text } = jest.requireActual("react-native");
  return function Loading({ title }: { title: string }) {
    return <Text>{title}</Text>;
  };
});
jest.mock("../../components/Divider", () => () => null);
jest.mock("../../components/BottomAuthLink", () => () => null);
jest.mock(
  "../../components/AuthLayout",
  () =>
    ({ children }: { children: React.ReactNode }) =>
      children,
);
jest.mock("../../components/SocialLoginButtons", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return function SocialButtons({ disabled }: { disabled: boolean }) {
    return (
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Google sign-in"
      >
        <Text>Google sign-in</Text>
      </Pressable>
    );
  };
});
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/shared/components/form/FormInput", () => {
  const { TextInput } = jest.requireActual("react-native");
  return function Input(props: { label: string }) {
    return <TextInput {...props} accessibilityLabel={props.label} />;
  };
});
jest.mock("@/shared/components/form/PasswordInput", () => {
  const { TextInput, View } = jest.requireActual("react-native");
  return function Input(props: {
    label: string;
    rightElement?: React.ReactNode;
  }) {
    return (
      <View>
        <TextInput {...props} accessibilityLabel={props.label} />
        {props.rightElement}
      </View>
    );
  };
});
jest.mock("@/shared/components/Button", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return function Button({ title, ...props }: { title: string }) {
    return (
      <Pressable
        {...props}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <Text>{title}</Text>
      </Pressable>
    );
  };
});

const login = jest.fn();

describe("password lockout feedback", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useAuthStore.setState({
      sessionExpired: false,
      isSigningIn: false,
      isAuthenticated: false,
    });
    jest
      .mocked(useLogin)
      .mockReturnValue({ handleLogin: login, loading: false });
    login.mockResolvedValue({
      success: false,
      code: "ACCOUNT_LOCKED",
      message: "Temporarily restricted",
      errors: { retry_after: 900 },
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps the loading screen when session setup remounts the login route", async () => {
    const screen = await render(<LoginScreen />);
    await fireEvent.changeText(
      screen.getByLabelText("EMAIL ADDRESS"),
      "person@example.com",
    );
    await act(async () => {
      useAuthStore.setState({ isAuthenticated: true });
    });
    expect(screen.getByText("Signing you in...")).toBeTruthy();
    expect(screen.queryByLabelText("EMAIL ADDRESS")).toBeNull();
    await screen.unmount();

    const remounted = await render(<LoginScreen />);
    expect(remounted.getByText("Signing you in...")).toBeTruthy();
    expect(remounted.queryByLabelText("EMAIL ADDRESS")).toBeNull();
    await remounted.unmount();
  });

  it("keeps loading after successful login until navigation unmounts the route", async () => {
    login.mockResolvedValue({ success: true });
    const screen = await render(<LoginScreen />);
    await fireEvent.changeText(
      screen.getByLabelText("EMAIL ADDRESS"),
      "person@example.com",
    );
    await fireEvent.changeText(screen.getByLabelText("PASSWORD"), "password");
    await fireEvent.press(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByText("Signing you in...")).toBeTruthy();
    expect(screen.queryByLabelText("PASSWORD")).toBeNull();
    await screen.unmount();
  });

  it("blocks only the locked email's password action and preserves social/recovery actions", async () => {
    const screen = await render(<LoginScreen />);
    await fireEvent.changeText(
      screen.getByLabelText("EMAIL ADDRESS"),
      "locked@example.com",
    );
    await fireEvent.changeText(screen.getByLabelText("PASSWORD"), "password");
    await fireEvent.press(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Google sign-in" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Forgot password" }),
    ).toBeEnabled();
    await fireEvent.changeText(
      screen.getByLabelText("EMAIL ADDRESS"),
      "other@example.com",
    );
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    await fireEvent.changeText(
      screen.getByLabelText("EMAIL ADDRESS"),
      "LOCKED@example.com",
    );
    expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled();
    await act(async () => {
      jest.setSystemTime(Date.now() + 900_000);
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    await screen.unmount();
  });

  it("retains the existing global request throttle and releases it at the server deadline", async () => {
    login.mockResolvedValue({
      success: false,
      code: "RATE_LIMIT_EXCEEDED",
      errors: { retry_after: 3 },
    });
    const screen = await render(<LoginScreen />);
    await fireEvent.changeText(
      screen.getByLabelText("EMAIL ADDRESS"),
      "locked@example.com",
    );
    await fireEvent.changeText(screen.getByLabelText("PASSWORD"), "password");
    await fireEvent.press(screen.getByRole("button", { name: "Log in" }));
    await fireEvent.changeText(
      screen.getByLabelText("EMAIL ADDRESS"),
      "other@example.com",
    );
    expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Google sign-in" }),
    ).toBeDisabled();
    await act(async () => {
      jest.advanceTimersByTime(3_000);
    });
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
    await screen.unmount();
  });

  it("preserves session-expiration feedback before mounting and while the form is open", async () => {
    useAuthStore.setState({ sessionExpired: true });
    const screen = await render(<LoginScreen />);
    expect(screen.getByText(/Your session has expired/)).toBeTruthy();
    expect(useAuthStore.getState().sessionExpired).toBe(false);
    await fireEvent.changeText(
      screen.getByLabelText("EMAIL ADDRESS"),
      "other@example.com",
    );
    await fireEvent(screen.getByLabelText("EMAIL ADDRESS"), "focus");
    expect(screen.queryByText(/Your session has expired/)).toBeNull();
    await act(async () => {
      useAuthStore.getState().setSessionExpired(true);
    });
    expect(screen.getByText(/Your session has expired/)).toBeTruthy();
    expect(useAuthStore.getState().sessionExpired).toBe(false);
    await screen.unmount();
  });
});
