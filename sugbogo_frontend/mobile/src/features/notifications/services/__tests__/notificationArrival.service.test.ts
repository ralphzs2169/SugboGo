import { NotificationArrivalService } from "../notificationArrival.service";

describe("notification arrival coordination", () => {
  let service: NotificationArrivalService;
  let animate: jest.Mock;
  let eligible: boolean;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new NotificationArrivalService();
    animate = jest.fn();
    eligible = true;
    service.setContext(true, false);
    service.subscribe({ userId: 7, isEligible: () => eligible, animate });
  });

  afterEach(() => jest.useRealTimers());

  it("drops cooldown arrivals without queuing and allows later unique arrivals", () => {
    service.created(7, 1);
    jest.advanceTimersByTime(2999);
    service.created(7, 2);
    expect(animate).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    service.created(7, 2);
    expect(animate).toHaveBeenCalledTimes(1);
    service.created(7, 3);
    expect(animate).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(3000);
    service.created(7, 1);
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it("does not replay arrivals suppressed in background or inside the inbox", () => {
    service.setContext(false, false);
    service.created(7, 1);
    service.setContext(true, true);
    service.created(7, 2);
    service.setContext(true, false);
    service.created(7, 1);
    service.created(7, 2);
    expect(animate).not.toHaveBeenCalled();
    service.created(7, 3);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("suppresses reduced-motion and unfocused subscribers without replay on remount", () => {
    eligible = false;
    service.created(7, 1);
    eligible = true;
    service.created(7, 1);
    expect(animate).not.toHaveBeenCalled();
    service.created(7, 2);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("shares cooldown with the session reminder and isolates accounts", () => {
    service.remind(7, 3);
    service.created(7, 1);
    service.remind(7, 3);
    service.created(8, 1);
    expect(animate).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(3000);
    service.created(7, 2);
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it("never replays events received without a mounted bell", () => {
    const isolated = new NotificationArrivalService();
    isolated.setContext(true, false);
    isolated.created(7, 1);
    isolated.subscribe({ userId: 7, isEligible: () => true, animate });
    isolated.remind(7, 4);
    isolated.created(7, 1);
    expect(animate).not.toHaveBeenCalled();
    isolated.created(7, 2);
    expect(animate).toHaveBeenCalledTimes(1);
  });
});
