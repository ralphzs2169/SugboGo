import { router } from "expo-router";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Text, TextInput } from "react-native";
import { useState } from "react";
import RegistrationRouteBoundary from "../RegistrationRouteBoundary";
import { useReviewLandmarksStore } from "../../../stores/reviewLandmarksStore";
let mockRoute = "merchant-registration";
let mockCurrent: any;
jest.mock("../../../hooks/registration/useCurrentApplication", () => ({
  __esModule: true,
  default: () => mockCurrent,
}));
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    router: { replace: jest.fn() },
    useSegments: () => [
      "(explorer)",
      "merchant-registration",
      ...(mockRoute === "merchant-registration" ? [] : [mockRoute]),
    ],
    Redirect: ({ href }: { href: string }) => (
      <Text>{`Redirect: ${href}`}</Text>
    ),
    useNavigation: () => ({ isFocused: () => true }),
  };
});
jest.mock("@/shared/components/LoadingScreen", () => {
  const { Text } = jest.requireActual("react-native");
  return { __esModule: true, default: () => <Text>Loading status</Text> };
});
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = "merchant-registration";
  mockCurrent = {
    application: { status: "draft" },
    refetch: jest.fn(),
    isLoading: false,
    error: false,
  };
  useReviewLandmarksStore.getState().clearPreview();
});
const content = <Text>Registration content</Text>;
test.each(["draft", "rejected"])(
  "keeps %s registration and nested editing available",
  async (status) => {
    mockCurrent.application.status = status;
    mockRoute = "landmarks-picker";
    const screen = await render(
      <RegistrationRouteBoundary>{content}</RegistrationRouteBoundary>,
    );
    expect(screen.getByText("Registration content")).toBeTruthy();
  },
);
test("submitted redirects editing to summary and permits its read-only landmark preview", async () => {
  mockCurrent.application.status = "submitted";
  const screen = await render(
    <RegistrationRouteBoundary>{content}</RegistrationRouteBoundary>,
  );
  expect(
    screen.getByText(
      "Redirect: /(explorer)/merchant-registration/submitted-application",
    ),
  ).toBeTruthy();
  expect(screen.queryByText("Registration content")).toBeNull();
  mockRoute = "submitted-application";
  await screen.rerender(
    <RegistrationRouteBoundary>{content}</RegistrationRouteBoundary>,
  );
  expect(screen.getByText("Registration content")).toBeTruthy();
  mockRoute = "review-landmarks";
  await act(() =>
    useReviewLandmarksStore.setState({ returnTo: "application-summary" }),
  );
  await screen.rerender(
    <RegistrationRouteBoundary>{content}</RegistrationRouteBoundary>,
  );
  expect(screen.getByText("Registration content")).toBeTruthy();
});
test.each([
  "merchant-registration",
  "location-picker",
  "landmarks-picker",
  "review-landmarks",
  "submitted-application",
  "submission-success",
])(
  "approved %s goes to the existing acknowledgement/entry portal",
  async (route) => {
    mockRoute = route;
    mockCurrent.application.status = "approved";
    const screen = await render(
      <RegistrationRouteBoundary>{content}</RegistrationRouteBoundary>,
    );
    expect(
      screen.getByText("Redirect: /(explorer)/profile/merchant-portal"),
    ).toBeTruthy();
    expect(screen.queryByText("Registration content")).toBeNull();
  },
);
test("preserves the submission success route and does not loop back into editing", async () => {
  mockRoute = "submission-success";
  mockCurrent.application.status = "submitted";
  const screen = await render(
    <RegistrationRouteBoundary>{content}</RegistrationRouteBoundary>,
  );
  expect(screen.getByText("Registration content")).toBeTruthy();
});
test("waits for status and provides initial Retry without mounting editing", async () => {
  mockCurrent = { application: null, isLoading: true, refetch: jest.fn() };
  const screen = await render(
    <RegistrationRouteBoundary>{content}</RegistrationRouteBoundary>,
  );
  expect(screen.getByText("Loading status")).toBeTruthy();
  mockCurrent = { application: null, error: true, refetch: jest.fn() };
  await screen.rerender(
    <RegistrationRouteBoundary>{content}</RegistrationRouteBoundary>,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
  expect(mockCurrent.refetch).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    screen.getByRole("button", { name: "Back to Explorer" }),
  );
  expect(router.replace).toHaveBeenCalledWith("/(explorer)/(tabs)/explore");
  expect(screen.queryByText("Registration content")).toBeNull();
});
test("cached status refresh failure does not unmount a dirty registration draft", async () => {
  function Draft() {
    const [text, setText] = useState("");
    return (
      <TextInput
        accessibilityLabel="Draft"
        value={text}
        onChangeText={setText}
      />
    );
  }
  const screen = await render(
    <RegistrationRouteBoundary>
      <Draft />
    </RegistrationRouteBoundary>,
  );
  await fireEvent.changeText(
    screen.getByLabelText("Draft"),
    "My registration draft",
  );
  mockCurrent.error = true;
  await screen.rerender(
    <RegistrationRouteBoundary>
      <Draft />
    </RegistrationRouteBoundary>,
  );
  expect(screen.getByDisplayValue("My registration draft")).toBeTruthy();
  expect(screen.getByText("Unable to refresh application status")).toBeTruthy();
});
