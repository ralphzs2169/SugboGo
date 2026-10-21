import { fireEvent, render } from "@testing-library/react-native";
import AnalyticsExport from "../AnalyticsExport";

const mockExport = jest.fn();
const mockReset = jest.fn();
let mockPending = false;
jest.mock("../../../hooks/analytics/useMerchantAnalyticsExport", () => ({
  __esModule: true,
  default: () => ({
    exportPdf: mockExport,
    reset: mockReset,
    isPending: mockPending,
    error: null,
  }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@/shared/components/bottom-sheets/SelectionBottomSheet", () => ({
  __esModule: true,
  default: function MockSelection({
    sheetRef,
    options,
    onSelect,
  }: {
    sheetRef: unknown;
    options: { label: string; value: string }[];
    onSelect: (value: string) => void;
  }) {
    const { useState, useImperativeHandle } = jest.requireActual("react");
    const { Pressable, Text } = jest.requireActual("react-native");
    const [visible, setVisible] = useState(false);
    useImperativeHandle(sheetRef, () => ({ present: () => setVisible(true) }));
    return visible
      ? options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            onPress={() => onSelect(option.value)}
          >
            <Text>{option.label}</Text>
          </Pressable>
        ))
      : null;
  },
}));

describe("PDF export period selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPending = false;
  });

  it("waits for an explicit period rather than exporting the dashboard selection", async () => {
    const screen = await render(<AnalyticsExport enabled />);
    expect(mockExport).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Export PDF" }));
    expect(mockExport).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    expect(mockExport).toHaveBeenCalledWith("7");
  });

  it("disables export while the current request is pending", async () => {
    mockPending = true;
    const screen = await render(<AnalyticsExport enabled />);
    expect(
      screen.getByRole("button", { name: "Preparing PDF…" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(mockExport).not.toHaveBeenCalled();
  });
});
