import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import * as service from "../../../api/replyTemplate.service";
import { useReplyTemplates } from "../useReplyTemplates";
import ReplyTemplateCard from "../../../components/review-management/reply-template/ReplyTemplateCard";

jest.mock("../../../api/replyTemplate.service", () => ({
  getReplyTemplates: jest.fn(),
  deleteReplyTemplate: jest.fn(),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/shared/components/bottom-sheets/ActionBottomSheet", () => ({
  __esModule: true,
  default: ({ onSelect }: any) => {
    const { Pressable, Text } = jest.requireActual("react-native");
    return (
      <Pressable onPress={() => onSelect("delete")}>
        <Text>Delete action</Text>
      </Pressable>
    );
  },
}));
jest.mock("@/shared/components/modals/ConfirmModal", () => ({
  __esModule: true,
  default: ({ visible, onConfirm, isLoading }: any) => {
    const { Pressable, Text } = jest.requireActual("react-native");
    return visible ? (
      <Pressable disabled={isLoading} onPress={onConfirm}>
        <Text>Confirm delete</Text>
      </Pressable>
    ) : null;
  },
}));
const read = jest.mocked(service.getReplyTemplates);
const remove = jest.mocked(service.deleteReplyTemplate);
let client: QueryClient;
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  read.mockReset().mockResolvedValue({
    success: true,
    message: "Success",
    data: [{ id: 1, title: "Thanks", text: "Thank you" }],
  } as never);
  remove.mockReset().mockResolvedValue({
    success: true,
    message: "Deleted",
    data: {},
  } as never);
});
afterEach(async () => {
  await cleanup();
  client.clear();
});
const row = (id: number) => (
  <ReplyTemplateCard
    key={id}
    id={id}
    title={`Template ${id}`}
    text="Thank you"
    onEdit={jest.fn()}
  />
);

test("only the parent reads the collection; mounting rows adds neither observers nor reads", async () => {
  const parent = await renderHook(() => useReplyTemplates(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(parent.result.current.templates).toHaveLength(1));
  const screen = await render(<Wrapper>{row(1)}</Wrapper>);
  await screen.rerender(<Wrapper>{[row(1), row(2), row(3)]}</Wrapper>);
  expect(read).toHaveBeenCalledTimes(1);
  expect(
    client
      .getQueryCache()
      .find({ queryKey: ["reply-templates"] })
      ?.getObserversCount(),
  ).toBe(1);
  await fireEvent.press(screen.getAllByText("Delete action")[0]);
  await act(async () => {
    await fireEvent.press(screen.getByText("Confirm delete"));
  });
  expect(remove).toHaveBeenCalledWith(1);
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
});
test("failed delete preserves the collection and leaves confirmation recoverable", async () => {
  const parent = await renderHook(() => useReplyTemplates(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(parent.result.current.templates).toHaveLength(1));
  remove.mockResolvedValueOnce({
    success: false,
    code: "NETWORK_ERROR",
    message: "Offline",
  });
  const screen = await render(<Wrapper>{row(1)}</Wrapper>);
  await fireEvent.press(screen.getByText("Delete action"));
  await fireEvent.press(screen.getByText("Confirm delete"));
  await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
  expect(parent.result.current.templates).toHaveLength(1);
  expect(read).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Confirm delete")).toBeTruthy();
});
