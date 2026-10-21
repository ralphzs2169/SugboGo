import { ENV } from "@/config/env";
import {
  isAuthSessionCurrent,
  isStaleAuthSessionError,
} from "@/shared/api/authSessionGeneration.service";
import { refreshSession } from "@/shared/api/refresh.service";
import { getAccessToken } from "@/shared/api/storage.service";

const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
export const NOTIFICATION_SYNC_COALESCE_MS = 250;

type TimerHandle = ReturnType<typeof setTimeout>;

type NotificationSocketMessage = {
  type: "inbox.ready" | "inbox.changed" | "notification.created";
  notification_id?: number;
  sync_required: true;
};

type ManagedSocket = {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

type NotificationSocketSession = {
  userId: number;
  authSessionGeneration: number;
  onSyncRequired: () => void;
  onNotificationCreated?: (notificationId: number) => void;
  onSessionExpired: () => void | Promise<void>;
};

type NotificationSocketDependencies = {
  createSocket: (url: string) => ManagedSocket;
  getAccessToken: typeof getAccessToken;
  refreshSession: typeof refreshSession;
  getSocketUrl: () => string | null;
  random: () => number;
};

const defaultDependencies: NotificationSocketDependencies = {
  createSocket: (url) => new WebSocket(url) as unknown as ManagedSocket,
  getAccessToken,
  refreshSession,
  getSocketUrl: () =>
    resolveNotificationWebSocketUrl(
      ENV.API_URL,
      ENV.NOTIFICATION_WEBSOCKET_URL,
    ),
  random: Math.random,
};

/**
 * Resolves the notification socket endpoint from an explicit Expo variable or
 * from the configured REST origin when no override is provided.
 */
export function resolveNotificationWebSocketUrl(
  apiUrl: string | undefined,
  explicitUrl?: string,
): string | null {
  const candidate = explicitUrl?.trim();

  try {
    if (candidate) {
      const explicit = new URL(candidate);

      if (explicit.protocol !== "ws:" && explicit.protocol !== "wss:") {
        return null;
      }

      return explicit.toString();
    }

    if (!apiUrl) {
      return null;
    }

    const derived = new URL(apiUrl);

    if (derived.protocol !== "http:" && derived.protocol !== "https:") {
      return null;
    }

    derived.protocol = derived.protocol === "https:" ? "wss:" : "ws:";
    derived.pathname = "/ws/notifications/";
    derived.search = "";
    derived.hash = "";

    return derived.toString();
  } catch {
    return null;
  }
}

function isSyncMessage(value: unknown): value is NotificationSocketMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Record<string, unknown>;

  return (
    (message.type === "inbox.ready" ||
      message.type === "inbox.changed" ||
      (message.type === "notification.created" &&
        Number.isSafeInteger(message.notification_id) &&
        (message.notification_id as number) > 0)) &&
    message.sync_required === true
  );
}

/**
 * Owns the single authenticated notification socket for the current account.
 *
 * Transports reconciliation signals and explicit creation IDs. Notification
 * records remain authoritative in REST and refresh through the sync callback.
 */
export class NotificationWebSocketService {
  private readonly dependencies: NotificationSocketDependencies;
  private session: NotificationSocketSession | null = null;
  private socket: ManagedSocket | null = null;
  private reconnectTimer: TimerHandle | null = null;
  private syncTimer: TimerHandle | null = null;
  private sessionEpoch = 0;
  private socketEpoch = 0;
  private reconnectAttempt = 0;
  private authenticationRecoveryEpoch: number | null = null;
  private refreshAttempted = false;
  private terminal = false;
  private appActive = true;
  private online = false;
  private connecting = false;

  constructor(dependencies: Partial<NotificationSocketDependencies> = {}) {
    this.dependencies = { ...defaultDependencies, ...dependencies };
  }

  start(session: NotificationSocketSession) {
    const isSameSession =
      this.session?.userId === session.userId &&
      this.session.authSessionGeneration === session.authSessionGeneration;

    if (!isSameSession) {
      this.resetTransport();
      this.sessionEpoch += 1;
      this.reconnectAttempt = 0;
      this.refreshAttempted = false;
      this.terminal = false;
    }

    this.session = session;
    this.ensureConnected();
  }

  stop() {
    this.session = null;
    this.sessionEpoch += 1;
    this.reconnectAttempt = 0;
    this.refreshAttempted = false;
    this.terminal = false;
    this.authenticationRecoveryEpoch = null;
    this.resetTransport();
  }

  setAppActive(active: boolean) {
    if (this.appActive === active) {
      return;
    }

    this.appActive = active;

    if (!active) {
      this.pauseTransport();
      return;
    }

    this.reconnectAttempt = 0;
    this.ensureConnected();
  }

  setOnline(online: boolean) {
    if (this.online === online) {
      return;
    }

    this.online = online;

    if (!online) {
      this.pauseTransport();
      return;
    }

    this.reconnectAttempt = 0;
    this.ensureConnected();
  }

  private canConnect() {
    return Boolean(
      this.session &&
      isAuthSessionCurrent(this.session.authSessionGeneration) &&
      this.appActive &&
      this.online &&
      !this.terminal,
    );
  }

  private ensureConnected() {
    if (
      !this.canConnect() ||
      this.socket ||
      this.connecting ||
      this.reconnectTimer
    ) {
      return;
    }

    const socketUrl = this.dependencies.getSocketUrl();

    if (!socketUrl) {
      this.terminal = true;
      return;
    }

    const sessionEpoch = this.sessionEpoch;
    this.connecting = true;

    void this.dependencies
      .getAccessToken()
      .then((token) => {
        if (!this.isCurrentSession(sessionEpoch) || !this.canConnect()) {
          return;
        }

        if (!token) {
          void this.recoverAuthentication(null, sessionEpoch);
          return;
        }

        this.openSocket(socketUrl, token, sessionEpoch);
      })
      .catch(() => {
        if (this.isCurrentSession(sessionEpoch)) {
          void this.recoverAuthentication(null, sessionEpoch);
        }
      })
      .finally(() => {
        if (this.isCurrentSession(sessionEpoch)) {
          this.connecting = false;

          if (this.authenticationRecoveryEpoch === null) {
            this.ensureConnected();
          }
        }
      });
  }

  private openSocket(
    socketUrl: string,
    accessToken: string,
    sessionEpoch: number,
  ) {
    if (!this.isCurrentSession(sessionEpoch) || !this.canConnect()) {
      return;
    }

    let socket: ManagedSocket;

    try {
      socket = this.dependencies.createSocket(socketUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }

    const socketEpoch = ++this.socketEpoch;
    this.socket = socket;

    socket.onopen = () => {
      if (!this.isCurrentSocket(socket, socketEpoch, sessionEpoch)) {
        return;
      }

      try {
        socket.send(
          JSON.stringify({ type: "authenticate", access: accessToken }),
        );
      } catch {
        this.closeCurrentSocket();
        this.scheduleReconnect();
      }
    };

    socket.onmessage = (event) => {
      if (!this.isCurrentSocket(socket, socketEpoch, sessionEpoch)) {
        return;
      }

      let message: unknown;

      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (!isSyncMessage(message)) {
        return;
      }

      if (message.type === "inbox.ready") {
        this.reconnectAttempt = 0;
        this.refreshAttempted = false;
      }

      if (message.type === "notification.created" && this.appActive) {
        this.session?.onNotificationCreated?.(message.notification_id!);
      }

      this.scheduleSync(sessionEpoch);
    };

    socket.onerror = () => {
      // The close event owns recovery so one transport failure schedules once.
    };

    socket.onclose = (event) => {
      if (!this.isCurrentSocket(socket, socketEpoch, sessionEpoch)) {
        return;
      }

      this.socket = null;

      if (!this.canConnect()) {
        return;
      }

      if (event.code === 4400 || event.code === 4403) {
        this.terminal = true;
        return;
      }

      if (event.code === 4401) {
        void this.recoverAuthentication(accessToken, sessionEpoch);
        return;
      }

      this.scheduleReconnect();
    };
  }

  private async recoverAuthentication(
    rejectedToken: string | null,
    sessionEpoch: number,
  ) {
    if (
      this.authenticationRecoveryEpoch !== null ||
      !this.isCurrentSession(sessionEpoch) ||
      !this.canConnect()
    ) {
      return;
    }

    this.authenticationRecoveryEpoch = sessionEpoch;

    try {
      const currentToken = await this.dependencies.getAccessToken();

      if (!this.isCurrentSession(sessionEpoch) || !this.canConnect()) {
        return;
      }

      if (currentToken && rejectedToken && currentToken !== rejectedToken) {
        this.ensureConnected();
        return;
      }

      if (this.refreshAttempted) {
        await this.expireSession(sessionEpoch);
        return;
      }

      this.refreshAttempted = true;
      const authSessionGeneration = this.session?.authSessionGeneration;

      if (authSessionGeneration === undefined) {
        return;
      }

      await this.dependencies.refreshSession(authSessionGeneration);

      if (this.isCurrentSession(sessionEpoch) && this.canConnect()) {
        this.ensureConnected();
      }
    } catch (error) {
      if (isStaleAuthSessionError(error)) {
        return;
      }

      await this.expireSession(sessionEpoch);
    } finally {
      if (this.authenticationRecoveryEpoch === sessionEpoch) {
        this.authenticationRecoveryEpoch = null;
      }
    }
  }

  private async expireSession(sessionEpoch: number) {
    if (!this.isCurrentSession(sessionEpoch)) {
      return;
    }

    this.terminal = true;
    const callback = this.session?.onSessionExpired;

    if (callback) {
      await callback();
    }
  }

  private scheduleReconnect() {
    if (!this.canConnect() || this.reconnectTimer) {
      return;
    }

    const exponentialDelay = Math.min(
      MAX_RECONNECT_DELAY_MS,
      INITIAL_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempt,
    );
    const jitterMultiplier = 0.8 + this.dependencies.random() * 0.4;
    const delay = Math.min(
      MAX_RECONNECT_DELAY_MS,
      Math.round(exponentialDelay * jitterMultiplier),
    );
    this.reconnectAttempt += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnected();
    }, delay);
  }

  private scheduleSync(sessionEpoch: number) {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;

      if (this.isCurrentSession(sessionEpoch) && this.appActive) {
        this.session?.onSyncRequired();
      }
    }, NOTIFICATION_SYNC_COALESCE_MS);
  }

  private isCurrentSession(sessionEpoch: number) {
    return Boolean(
      this.session &&
      this.sessionEpoch === sessionEpoch &&
      isAuthSessionCurrent(this.session.authSessionGeneration),
    );
  }

  private isCurrentSocket(
    socket: ManagedSocket,
    socketEpoch: number,
    sessionEpoch: number,
  ) {
    return (
      this.socket === socket &&
      this.socketEpoch === socketEpoch &&
      this.isCurrentSession(sessionEpoch)
    );
  }

  private pauseTransport() {
    this.clearReconnectTimer();
    this.clearSyncTimer();
    this.closeCurrentSocket();
  }

  private resetTransport() {
    this.pauseTransport();
    this.connecting = false;
  }

  private closeCurrentSocket() {
    const socket = this.socket;
    this.socket = null;
    this.socketEpoch += 1;

    if (!socket) {
      return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    socket.close(1000, "Notification lifecycle paused");
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearSyncTimer() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }
}

export const notificationWebSocketService = new NotificationWebSocketService();
