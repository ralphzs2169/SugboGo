import {
  createBusinessImpressionTracker,
  isBusinessCardVisible,
} from "../businessImpressions";

describe("meaningful card visibility", () => {
  const card = { x: 0, y: 0, width: 100, height: 100 };

  it("requires at least half of the card area within both viewports", () => {
    expect(isBusinessCardVisible(card, [
      { x: 50, y: 0, width: 100, height: 100 },
    ])).toBe(true);
    expect(isBusinessCardVisible(card, [
      { x: 51, y: 0, width: 100, height: 100 },
    ])).toBe(false);
    expect(isBusinessCardVisible(card, [
      { x: 0, y: 100, width: 400, height: 500 },
      { x: 0, y: 0, width: 400, height: 100 },
    ])).toBe(false);
    expect(isBusinessCardVisible(card, [
      { x: 0, y: 40, width: 100, height: 100 },
      { x: 40, y: 0, width: 100, height: 100 },
    ])).toBe(false);
    expect(isBusinessCardVisible({ ...card, width: 0 }, [card])).toBe(false);
  });
});

describe("impression dwell and batching", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("does not submit data without a visibility observation", () => {
    const submit = jest.fn().mockResolvedValue(undefined);
    const tracker = createBusinessImpressionTracker(submit);
    jest.advanceTimersByTime(5000);
    expect(submit).not.toHaveBeenCalled();
    tracker.dispose();
  });

  it("rejects brief appearances and restarts the full dwell after reentry", () => {
    const submit = jest.fn().mockResolvedValue(undefined);
    const tracker = createBusinessImpressionTracker(submit);
    tracker.updateVisible([1]);
    jest.advanceTimersByTime(499);
    tracker.updateVisible([]);
    jest.advanceTimersByTime(5000);
    expect(submit).not.toHaveBeenCalled();
    tracker.updateVisible([1]);
    jest.advanceTimersByTime(499);
    tracker.dispose();
    expect(submit).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("batches multiple visible IDs and suppresses pending and submitted duplicates", async () => {
    const submit = jest.fn().mockResolvedValue(undefined);
    const tracker = createBusinessImpressionTracker(submit);
    tracker.updateVisible([1, 2, 2, -1, NaN]);
    jest.advanceTimersByTime(500);
    tracker.updateVisible([]);
    tracker.updateVisible([1, 2]);
    jest.advanceTimersByTime(750);
    expect(submit).toHaveBeenCalledWith([1, 2]);
    await Promise.resolve();
    tracker.updateVisible([]);
    tracker.updateVisible([1, 2]);
    jest.advanceTimersByTime(2000);
    expect(submit).toHaveBeenCalledTimes(1);
    tracker.dispose();
  });

  it("reserves in-flight IDs and releases failures for a later visible encounter", async () => {
    let rejectBatch!: (error: Error) => void;
    const submit = jest.fn()
      .mockImplementationOnce(() => new Promise((_, reject) => {
        rejectBatch = reject;
      }))
      .mockResolvedValue(undefined);
    const tracker = createBusinessImpressionTracker(submit);
    tracker.updateVisible([1]);
    jest.advanceTimersByTime(1250);
    tracker.updateVisible([]);
    tracker.updateVisible([1]);
    jest.advanceTimersByTime(1250);
    expect(submit).toHaveBeenCalledTimes(1);
    rejectBatch(new Error("offline"));
    await Promise.resolve();
    tracker.updateVisible([]);
    tracker.updateVisible([1]);
    jest.advanceTimersByTime(1250);
    expect(submit).toHaveBeenCalledTimes(2);
    tracker.dispose();
  });

  it("flushes qualified pending IDs on teardown and cancels incomplete dwell timers", async () => {
    const submit = jest.fn().mockRejectedValue(new Error("offline"));
    const tracker = createBusinessImpressionTracker(submit);
    tracker.updateVisible([1]);
    jest.advanceTimersByTime(500);
    tracker.updateVisible([1, 2]);
    tracker.dispose();
    expect(submit).toHaveBeenCalledWith([1]);
    expect(jest.getTimerCount()).toBe(0);
    await Promise.resolve();
  });
});
