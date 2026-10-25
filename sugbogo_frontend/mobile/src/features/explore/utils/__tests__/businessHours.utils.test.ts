import type { ExploreOperatingHours } from "../../types/exploreBusiness.types";
import {
  formatCompactTime,
  formatTime,
  getBusinessDay,
  getBusinessHoursSummary,
  getNextBusinessHoursUpdate,
  getQuickInfoStatus,
} from "../businessHours.utils";

function hours(
  day = "monday",
  overrides: Partial<ExploreOperatingHours> = {},
): ExploreOperatingHours {
  return {
    id: 1,
    day,
    is_open: true,
    is_24_hours: false,
    open_time: "08:00:00",
    close_time: "20:30:00",
    ...overrides,
  };
}

describe("Philippine business hours", () => {
  it.each([
    ["2026-10-11T23:59:59.999Z", "closed"],
    ["2026-10-12T00:00:00.000Z", "open"],
    ["2026-10-12T12:29:59.999Z", "open"],
    ["2026-10-12T12:30:00.000Z", "closed"],
  ])(
    "uses inclusive opening and exclusive closing at %s",
    (instant, status) => {
      expect(getBusinessHoursSummary([hours()], new Date(instant)).status).toBe(
        status,
      );
    },
  );

  it("shows a known opening later today with minutes", () => {
    const summary = getBusinessHoursSummary(
      [hours("monday", { open_time: "08:15" })],
      new Date("2026-10-11T23:00:00Z"),
    );
    expect(summary.status).toBe("closed");
    expect(summary.label).toContain("Opens today at 8:15 AM");
    expect(getQuickInfoStatus(summary).statusDetail).toBe("Opens 8:15 AM");
  });

  const overnight = hours("monday", {
    open_time: "22:00",
    close_time: "02:15",
  });
  const tuesdayClosed = hours("tuesday", { is_open: false });

  it.each([
    ["2026-10-12T13:59:59Z", false],
    ["2026-10-12T14:00:00Z", true],
    ["2026-10-12T16:00:00Z", true],
    ["2026-10-12T18:14:59.999Z", true],
    ["2026-10-12T18:15:00Z", false],
  ])(
    "handles overnight boundaries and a closed following day at %s",
    (instant, isOpen) => {
      const summary = getBusinessHoursSummary(
        [overnight, tuesdayClosed],
        new Date(instant),
      );
      expect(summary.isOpen).toBe(isOpen);
      expect(summary.status).toBe(isOpen ? "open" : "closed");
      if (isOpen) {
        expect(getQuickInfoStatus(summary).statusDetail).toBe("Closes 2:15 AM");
      }
    },
  );

  it("carries Sunday overnight hours into Monday even when Monday is missing", () => {
    const summary = getBusinessHoursSummary(
      [hours("sunday", { open_time: "22:00", close_time: "02:15" })],
      new Date("2026-10-11T17:00:00Z"),
    );
    expect(summary.status).toBe("open");
    expect(getBusinessDay(new Date("2026-10-11T17:00:00Z"))).toBe("monday");
  });

  it("does not use today's overnight hours before today's shift starts", () => {
    expect(
      getBusinessHoursSummary([overnight], new Date("2026-10-11T17:00:00Z"))
        .status,
    ).toBe("closed");
  });

  it("uses the later closing time for overlapping active shifts", () => {
    const summary = getBusinessHoursSummary(
      [hours("sunday", { open_time: "22:00", close_time: "10:00" }), hours()],
      new Date("2026-10-12T01:00:00Z"),
    );
    expect(summary.closingTime).toBe("20:30:00");
  });

  it("treats equal opening and closing times as an empty interval", () => {
    const summary = getBusinessHoursSummary(
      [hours("monday", { open_time: "08:00", close_time: "08:00" })],
      new Date("2026-10-12T00:00:00Z"),
    );
    expect(summary.status).toBe("closed");
    expect(summary.openingTime).toBeUndefined();
  });

  it("uses seconds at exact boundaries", () => {
    const schedule = [
      hours("monday", { open_time: "08:00:30", close_time: "08:01:15" }),
    ];
    expect(
      getBusinessHoursSummary(schedule, new Date("2026-10-12T00:00:29Z"))
        .isOpen,
    ).toBe(false);
    expect(
      getBusinessHoursSummary(schedule, new Date("2026-10-12T00:00:30Z"))
        .isOpen,
    ).toBe(true);
    expect(
      getBusinessHoursSummary(schedule, new Date("2026-10-12T00:01:15Z"))
        .isOpen,
    ).toBe(false);
  });

  it("opens for the full scheduled 24-hour day without ordinary times", () => {
    const schedule = [
      hours("monday", { is_24_hours: true, open_time: null, close_time: null }),
    ];
    for (const instant of ["2026-10-11T16:00:00Z", "2026-10-12T15:59:59Z"]) {
      const summary = getBusinessHoursSummary(schedule, new Date(instant));
      expect(getQuickInfoStatus(summary)).toMatchObject({
        isOpen: true,
        statusDetail: "24 hours",
      });
    }
    expect(
      getBusinessHoursSummary(schedule, new Date("2026-10-12T16:00:00Z"))
        .isOpen,
    ).toBe(false);
  });

  it("keeps a closed day closed even if the 24-hour flag is set", () => {
    expect(
      getBusinessHoursSummary(
        [hours("monday", { is_open: false, is_24_hours: true })],
        new Date("2026-10-12T01:00:00Z"),
      ).status,
    ).toBe("closed");
  });

  it.each(
    [
      [],
      [hours("tuesday")],
      [hours("monday", { open_time: null })],
      [hours("monday", { close_time: null })],
      [hours("monday", { close_time: "invalid" })],
    ].map((schedule) => ({ schedule })),
  )(
    "does not claim open or closed for missing/incomplete current hours (%#)",
    ({ schedule }) => {
      const summary = getBusinessHoursSummary(
        schedule,
        new Date("2026-10-12T01:00:00Z"),
      );
      expect(summary.status).toBe("unavailable");
      expect(getQuickInfoStatus(summary)).toEqual({
        statusLabel: "Hours unavailable",
        statusDetail: "",
        isOpen: null,
      });
    },
  );

  it("does not invent an opening from an incomplete future schedule", () => {
    const summary = getBusinessHoursSummary(
      [
        hours("monday", { is_open: false }),
        hours("tuesday", { close_time: null }),
      ],
      new Date("2026-10-12T01:00:00Z"),
    );
    expect(summary.label).toBe("Closed");
    expect(summary.openingTime).toBeUndefined();
  });

  it.each([
    ["2026-10-11T17:00:00Z", "2026-10-12T02:00:00+09:00"],
    ["2026-10-12T00:30:00Z", "2026-10-11T17:30:00-07:00"],
  ])(
    "uses Manila for the same instant regardless of input offset (%s)",
    (utc, elsewhere) => {
      expect(getBusinessHoursSummary([hours()], new Date(utc))).toEqual(
        getBusinessHoursSummary([hours()], new Date(elsewhere)),
      );
    },
  );

  it("schedules only the next boundary or Manila midnight", () => {
    expect(
      getNextBusinessHoursUpdate([hours()], new Date("2026-10-11T23:00:00Z")),
    ).toBe(Date.parse("2026-10-12T00:00:00Z"));
    expect(
      getNextBusinessHoursUpdate([hours()], new Date("2026-10-12T00:00:00Z")),
    ).toBe(Date.parse("2026-10-12T12:30:00Z"));
    expect(
      getNextBusinessHoursUpdate([overnight], new Date("2026-10-12T14:00:00Z")),
    ).toBe(Date.parse("2026-10-12T16:00:00Z"));
    expect(
      getNextBusinessHoursUpdate([overnight], new Date("2026-10-12T16:00:00Z")),
    ).toBe(Date.parse("2026-10-12T18:15:00Z"));
  });
});

describe("operating-time precision", () => {
  it.each([
    ["20:00", "8 PM"],
    ["20:30", "8:30 PM"],
    ["02:15", "2:15 AM"],
    ["00:00:00", "12 AM"],
    ["12:00:00", "12 PM"],
  ])("formats %s without discarding meaningful minutes", (input, expected) => {
    expect(formatCompactTime(input)).toBe(expected);
  });

  it("keeps full schedule formatting and precise quick-info closing times", () => {
    expect(formatTime("20:30:00")).toBe("8:30 PM");
    const summary = getBusinessHoursSummary(
      [hours()],
      new Date("2026-10-12T01:00:00Z"),
    );
    expect(getQuickInfoStatus(summary).statusDetail).toBe("Closes 8:30 PM");
  });
});
