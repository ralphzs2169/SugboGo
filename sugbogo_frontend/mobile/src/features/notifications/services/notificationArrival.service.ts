type Listener = {
  userId: number;
  isEligible: () => boolean;
  animate: () => void;
};

/** Coordinates transient reminders without deriving arrivals from server counts. */
export class NotificationArrivalService {
  private listeners = new Set<Listener>();
  private seen = new Map<number, Set<number>>();
  private reminded = new Set<number>();
  private lastAnimation = new Map<number, number>();
  private active = false;
  private inboxVisible = false;

  setContext(active: boolean, inboxVisible: boolean) {
    this.active = active;
    this.inboxVisible = inboxVisible;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  created(userId: number, notificationId: number) {
    const seen = this.seen.get(userId) ?? new Set<number>();
    if (seen.has(notificationId)) {
      return;
    }
    seen.add(notificationId);
    this.seen.set(userId, seen);
    // Never replay suppressed events or follow a live event with a reminder.
    this.reminded.add(userId);
    this.play(userId);
  }

  remind(userId: number, unreadCount: number) {
    if (this.reminded.has(userId)) {
      return;
    }
    this.reminded.add(userId);
    if (unreadCount > 0) {
      this.play(userId);
    }
  }

  private play(userId: number) {
    const now = Date.now();
    if (
      !this.active ||
      this.inboxVisible ||
      now - (this.lastAnimation.get(userId) ?? -Infinity) < 3000
    ) {
      return;
    }
    const eligible = [...this.listeners].filter(
      (listener) => listener.userId === userId && listener.isEligible(),
    );
    if (eligible.length === 0) {
      return;
    }
    this.lastAnimation.set(userId, now);
    eligible.forEach((listener) => listener.animate());
  }
}

export const notificationArrivalService = new NotificationArrivalService();
