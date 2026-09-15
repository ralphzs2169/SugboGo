import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import useUserLocation from "@/shared/hooks/useUserLocation";

import useDirectJourneys from "../../hooks/useDirectJourneys";
import useExploreBusinessProfile from "../../hooks/useExploreBusinessProfile";
import GettingThereScreen from "../GettingThereScreen";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
}));
jest.mock("@/shared/hooks/useUserLocation");
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock("../../hooks/useDirectJourneys");
jest.mock("../../hooks/useExploreBusinessProfile");

const refetch = jest.fn();

describe("GettingThereScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useExploreBusinessProfile as jest.Mock).mockReturnValue({
      business: {
        business_name: "Sugbo Cafe",
      },
      isLoading: false,
      error: null,
      refetch,
    });
  });

  it("renders all transportation choices without starting location or journey work", async () => {
    const screen = await render(<GettingThereScreen businessId={21} />);

    expect(screen.getByText("View Road Route")).toBeTruthy();
    expect(screen.getByText("Jeepney Guide")).toBeTruthy();
    expect(screen.getAllByText("Book with Grab").length).toBeGreaterThan(0);
    expect(useUserLocation).not.toHaveBeenCalled();
    expect(useDirectJourneys).not.toHaveBeenCalled();
  });

  it("opens the independent road-route screen", async () => {
    const screen = await render(<GettingThereScreen businessId={21} />);

    fireEvent.press(screen.getByText("View Route"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]/road-route",
      params: {
        businessId: "21",
      },
    });
  });

  it("opens the dedicated Jeepney Guide screen", async () => {
    const screen = await render(<GettingThereScreen businessId={21} />);

    fireEvent.press(screen.getByText("View Jeepney Guide"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]/jeepney-guide",
      params: {
        businessId: "21",
      },
    });
  });
});
