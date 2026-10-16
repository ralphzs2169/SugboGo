import {
  NOTIFICATION_SYNC_COALESCE_MS,
  NotificationWebSocketService,
  resolveNotificationWebSocketUrl,
} from "../notificationWebSocket.service";
import {
  beginAuthSession,
  getAuthSessionGeneration,
  StaleAuthSessionError,
} from "@/shared/api/authSessionGeneration.service";

class MockSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  sent: string[] = [];
  close = jest.fn();

  send(data: string) {
    this.sent.push(data);
  }

  open() {
    this.onopen?.();
  }

  message(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  serverClose(code: number) {
    this.onclose?.({ code });
  }
}

function flushPromises() {
  return Promise.resolve().then(() => Promise.resolve());
}

function createHarness() {
  const sockets: MockSocket[] = [];
  const getAccessToken = jest.fn<Promise<string | null>, []>();
  const refreshSession = jest.fn<Promise<string>, []>();
  getAccessToken.mockResolvedValue("access-one");
  refreshSession.mockResolvedValue("access-two");

  const service = new NotificationWebSocketService({
    createSocket: () => {
      const socket = new MockSocket();
      sockets.push(socket);
      return socket;
    },
    getAccessToken,
    refreshSession,
    getSocketUrl: () => "ws://localhost:8000/ws/notifications/",
    random: () => 0.5,
  });
  service.setOnline(true);
  const onSyncRequired = jest.fn();
  const onSessionExpired = jest.fn().mockResolvedValue(undefined);

  return {
    service,
    sockets,
    getAccessToken,
    refreshSession,
    onSyncRequired,
    onSessionExpired,
    start(userId = 7) {
      service.start({
        userId,
        authSessionGeneration: getAuthSessionGeneration(),
        onSyncRequired,
        onSessionExpired,
      });
    },
  };
}

describe("resolveNotificationWebSocketUrl", () => {
  it("uses an explicit secure socket URL when configured", () => {
    expect(
      resolveNotificationWebSocketUrl(
        "https://api.example.com/api",
        "wss://live.example.com/ws/notifications/",
      ),
    ).toBe("wss://live.example.com/ws/notifications/");
  });

  it("derives the socket scheme and non-API path from the REST origin", () => {
    expect(
      resolveNotificationWebSocketUrl(
        "https://api.example.com/api/?unused=true",
      ),
    ).toBe("wss://api.example.com/ws/notifications/");
    expect(resolveNotificationWebSocketUrl("http://10.0.2.2:8000/api")).toBe(
      "ws://10.0.2.2:8000/ws/notifications/",
    );
  });

  it("rejects invalid or unsupported endpoint schemes", () => {
    expect(resolveNotificationWebSocketUrl(undefined)).toBeNull();
    expect(
      resolveNotificationWebSocketUrl("https://example.com/api", "ftp://x"),
    ).toBeNull();
  });
});

describe("NotificationWebSocketService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    beginAuthSession();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("opens once and sends the required first authentication frame", async () => {
    const harness = createHarness();
    harness.start();
    harness.start();
    await flushPromises();

    expect(harness.sockets).toHaveLength(1);
    harness.sockets[0].open();
    expect(harness.sockets[0].sent).toEqual([
      JSON.stringify({ type: "authenticate", access: "access-one" }),
    ]);
  });

  it("coalesces ready and changed signals into one REST reconciliation", async () => {
    const harness = createHarness();
    harness.start();
    await flushPromises();
    const socket = harness.sockets[0];
    socket.open();

    socket.message({ type: "inbox.ready", sync_required: true });
    socket.message({ type: "inbox.changed", sync_required: true });
    socket.message({ type: "inbox.changed", sync_required: false });
    expect(harness.onSyncRequired).not.toHaveBeenCalled();

    jest.advanceTimersByTime(NOTIFICATION_SYNC_COALESCE_MS);
    expect(harness.onSyncRequired).toHaveBeenCalledTimes(1);
  });

  it("reconnects with bounded backoff after a temporary transport failure", async () => {
    const harness = createHarness();
    harness.start();
    await flushPromises();
    harness.sockets[0].serverClose(1006);

    jest.advanceTimersByTime(999);
    await flushPromises();
    expect(harness.sockets).toHaveLength(1);

    jest.advanceTimersByTime(1);
    await flushPromises();
    expect(harness.sockets).toHaveLength(2);
  });

  it("uses a token already refreshed elsewhere before requesting another refresh", async () => {
    const harness = createHarness();
    harness.getAccessToken
      .mockResolvedValueOnce("access-one")
      .mockResolvedValue("access-two");
    harness.start();
    await flushPromises();
    harness.sockets[0].serverClose(4401);
    await flushPromises();

    expect(harness.refreshSession).not.toHaveBeenCalled();
    expect(harness.sockets).toHaveLength(2);
  });

  it("refreshes an expired token once and reconnects with the replacement", async () => {
    const harness = createHarness();
    harness.getAccessToken
      .mockResolvedValueOnce("access-one")
      .mockResolvedValueOnce("access-one")
      .mockResolvedValue("access-two");
    harness.start();
    await flushPromises();
    harness.sockets[0].serverClose(4401);
    await flushPromises();

    expect(harness.refreshSession).toHaveBeenCalledTimes(1);
    expect(harness.sockets).toHaveLength(2);
    harness.sockets[1].open();
    expect(harness.sockets[1].sent[0]).toContain("access-two");
  });

  it("does not enter a refresh loop when the replacement token is rejected", async () => {
    const harness = createHarness();
    harness.getAccessToken
      .mockResolvedValueOnce("access-one")
      .mockResolvedValueOnce("access-one")
      .mockResolvedValue("access-two");
    harness.start();
    await flushPromises();
    harness.sockets[0].serverClose(4401);
    await flushPromises();

    harness.sockets[1].serverClose(4401);
    await flushPromises();

    expect(harness.refreshSession).toHaveBeenCalledTimes(1);
    expect(harness.onSessionExpired).toHaveBeenCalledTimes(1);
    expect(harness.sockets).toHaveLength(2);
  });

  it("expires the session when token refresh fails", async () => {
    const harness = createHarness();
    harness.refreshSession.mockRejectedValue(new Error("refresh rejected"));
    harness.start();
    await flushPromises();
    harness.sockets[0].serverClose(4401);
    await flushPromises();

    expect(harness.onSessionExpired).toHaveBeenCalledTimes(1);
    jest.runOnlyPendingTimers();
    expect(harness.sockets).toHaveLength(1);
  });

  it("does not expire a newer session after obsolete recovery settles", async () => {
    const harness = createHarness();
    harness.refreshSession.mockRejectedValue(new StaleAuthSessionError());
    harness.start();
    await flushPromises();
    harness.sockets[0].serverClose(4401);
    await flushPromises();

    expect(harness.refreshSession).toHaveBeenCalledTimes(1);
    expect(harness.onSessionExpired).not.toHaveBeenCalled();
  });

  it.each([4400, 4403])(
    "treats close code %s as terminal for the current session",
    async (code) => {
      const harness = createHarness();
      harness.start();
      await flushPromises();
      harness.sockets[0].serverClose(code);
      jest.runOnlyPendingTimers();
      await flushPromises();

      expect(harness.sockets).toHaveLength(1);
      expect(harness.refreshSession).not.toHaveBeenCalled();
    },
  );

  it("pauses offline and in the background, then reconnects immediately", async () => {
    const harness = createHarness();
    harness.start();
    await flushPromises();
    const first = harness.sockets[0];

    harness.service.setOnline(false);
    expect(first.close).toHaveBeenCalledWith(
      1000,
      "Notification lifecycle paused",
    );
    harness.service.setOnline(true);
    await flushPromises();
    expect(harness.sockets).toHaveLength(2);

    harness.service.setAppActive(false);
    harness.service.setAppActive(true);
    await flushPromises();
    expect(harness.sockets).toHaveLength(3);
  });

  it("cleans up on logout and ignores callbacks from an obsolete account", async () => {
    const harness = createHarness();
    harness.start(7);
    await flushPromises();
    const staleSocket = harness.sockets[0];
    const staleMessage = staleSocket.onmessage;

    harness.start(8);
    await flushPromises();
    expect(staleSocket.close).toHaveBeenCalled();
    expect(harness.sockets).toHaveLength(2);

    staleMessage?.({
      data: JSON.stringify({ type: "inbox.changed", sync_required: true }),
    });
    jest.advanceTimersByTime(NOTIFICATION_SYNC_COALESCE_MS);
    expect(harness.onSyncRequired).not.toHaveBeenCalled();

    harness.service.stop();
    expect(harness.sockets[1].close).toHaveBeenCalled();
    jest.runOnlyPendingTimers();
    expect(harness.sockets).toHaveLength(2);
  });
});
