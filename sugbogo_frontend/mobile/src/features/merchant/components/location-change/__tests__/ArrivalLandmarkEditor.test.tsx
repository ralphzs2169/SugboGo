import { fireEvent, render } from "@testing-library/react-native";

import ArrivalLandmarkEditor from "../ArrivalLandmarkEditor";

jest.mock("../../registration/RegistrationSection", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const landmarks = [
  {
    id: "1",
    name: "First reference",
    address: "",
    latitude: 10.3,
    longitude: 123.9,
    source: "custom" as const,
  },
  {
    id: "2",
    name: "Second reference",
    address: "",
    latitude: 10.31,
    longitude: 123.9,
    source: "custom" as const,
    is_arrival_point: true,
    access_directions: "Old directions.",
  },
];

it("selects exactly one arrival point without carrying directions from another landmark", async () => {
  const onChange = jest.fn();
  const screen = await render(
    <ArrivalLandmarkEditor
      landmarks={landmarks}
      onChange={onChange}
      disabled={false}
    />,
  );
  await fireEvent.press(
    screen.getByLabelText("Use First reference as arrival landmark"),
  );
  const result = onChange.mock.calls[0][0];
  expect(result[0]).toMatchObject({
    is_arrival_point: true,
    access_directions: "",
  });
  expect(result[1]).toMatchObject({
    is_arrival_point: false,
    access_directions: "",
  });
});
