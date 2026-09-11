import { fireEvent, render } from "@testing-library/react-native";
import { Pressable as MockPressable } from "react-native";

import DiscoveryShortcutsSection from "../DiscoveryShortcutsSection";
import useDiscoveryShortcuts from "../../../hooks/useDiscoveryShortcuts";

jest.mock("../../../hooks/useDiscoveryShortcuts");
jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(() => true),
}));
jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));
jest.mock("@/shared/components/SafePressable", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    return <MockPressable {...props} />;
  },
}));

const mockedUseDiscoveryShortcuts = useDiscoveryShortcuts as jest.Mock;
const refetch = jest.fn();

function mockQuery(overrides = {}) {
  mockedUseDiscoveryShortcuts.mockReturnValue({
    shortcuts: [],
    isLoading: false,
    error: null,
    refetch,
    ...overrides,
  });
}

describe("DiscoveryShortcutsSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("preserves backend order and passes the linked cluster ID", async () => {
    mockQuery({
      shortcuts: [
        {
          id: 7,
          title: "First shortcut",
          subtitle: "First subtitle",
          business_count: 20,
          cluster: { id: 42, name: "Food", icon: "utensils" },
        },
        {
          id: 8,
          title: "Second shortcut",
          subtitle: "Second subtitle",
          business_count: 12,
          cluster: { id: 43, name: "Crafts", icon: "palette" },
        },
      ],
    });
    const onShortcutPress = jest.fn();
    const screen = await render(
      <DiscoveryShortcutsSection onShortcutPress={onShortcutPress} />,
    );

    expect(screen.getAllByText(/shortcut$/).map((node) => node.props.children)).toEqual([
      "First shortcut",
      "Second shortcut",
    ]);
    fireEvent.press(screen.getByLabelText("First shortcut"));
    expect(onShortcutPress).toHaveBeenCalledWith(42);
  });

  it("hides the section for an empty response", async () => {
    mockQuery();
    const screen = await render(<DiscoveryShortcutsSection />);

    expect(screen.queryByText("Not sure what to explore?")).toBeNull();
  });

  it("keeps an error state visible and retries", async () => {
    mockQuery({ error: { success: false, message: "Unavailable" } });
    const screen = await render(<DiscoveryShortcutsSection />);

    fireEvent.press(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
