import { describe, it, expect, beforeEach } from "vitest";
import {
  ARG_TIMEZONE,
  addArgentinaBusinessDays,
  addCalendarDays,
  adjustArgentinaDate,
  adjustToNextArgentinaBusinessDay,
  adjustToPreviousArgentinaBusinessDay,
  dayOfWeek,
  easterSunday,
  getArgentinaMarketHolidays,
  isArgentinaMarketBusinessDay,
  isWeekend,
  subtractArgentinaBusinessDays,
  transferToObserved,
  _clearCalendarCache,
} from "./argentinaMarketCalendar";

beforeEach(() => {
  _clearCalendarCache();
});

describe("date helpers", () => {
  it("dayOfWeek returns correct DOW (UTC-stable)", () => {
    expect(dayOfWeek("2024-01-01")).toBe(1); // Mon
    expect(dayOfWeek("2024-12-25")).toBe(3); // Wed
    expect(dayOfWeek("2025-07-09")).toBe(3); // Wed
    expect(dayOfWeek("2025-07-12")).toBe(6); // Sat
    expect(dayOfWeek("2025-07-13")).toBe(0); // Sun
  });

  it("addCalendarDays handles month/year rollover", () => {
    expect(addCalendarDays("2024-12-31", 1)).toBe("2025-01-01");
    expect(addCalendarDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addCalendarDays("2025-03-01", -1)).toBe("2025-02-28");
  });

  it("isWeekend identifies Sat/Sun", () => {
    expect(isWeekend("2025-07-12")).toBe(true);
    expect(isWeekend("2025-07-13")).toBe(true);
    expect(isWeekend("2025-07-14")).toBe(false);
  });

  it("exposes the Buenos Aires timezone", () => {
    expect(ARG_TIMEZONE).toBe("America/Argentina/Buenos_Aires");
  });
});

describe("Easter computation", () => {
  it("returns known Easter Sundays", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });
});

describe("getArgentinaMarketHolidays - fixed holidays", () => {
  it("includes all 9 fixed holidays for 2025", () => {
    const holidays = getArgentinaMarketHolidays(2025).map((h) => h.date);
    expect(holidays).toContain("2025-01-01");
    expect(holidays).toContain("2025-03-24");
    expect(holidays).toContain("2025-04-02");
    expect(holidays).toContain("2025-05-01");
    expect(holidays).toContain("2025-05-25");
    expect(holidays).toContain("2025-06-20");
    expect(holidays).toContain("2025-07-09");
    expect(holidays).toContain("2025-12-08");
    expect(holidays).toContain("2025-12-25");
  });

  it("does NOT include religious / provincial / Holy Thursday by default", () => {
    const holidays = getArgentinaMarketHolidays(2025).map((h) => h.date);
    // Holy Thursday 2025 = 2025-04-17
    expect(holidays).not.toContain("2025-04-17");
  });
});

describe("getArgentinaMarketHolidays - Easter-based", () => {
  it("includes carnival monday/tuesday and Good Friday for 2025", () => {
    const holidays = getArgentinaMarketHolidays(2025).map((h) => h.date);
    // Easter 2025-04-20 -> Carnival Mon 2025-03-03, Tue 2025-03-04, Good Fri 2025-04-18
    expect(holidays).toContain("2025-03-03");
    expect(holidays).toContain("2025-03-04");
    expect(holidays).toContain("2025-04-18");
  });

  it("Easter-based dates align in 2024", () => {
    // Easter 2024-03-31 -> Carnival 2024-02-12 / 2024-02-13, Good Fri 2024-03-29
    const holidays = getArgentinaMarketHolidays(2024).map((h) => h.date);
    expect(holidays).toContain("2024-02-12");
    expect(holidays).toContain("2024-02-13");
    expect(holidays).toContain("2024-03-29");
  });
});

describe("transferToObserved - transferable rule", () => {
  it("Monday stays the same day", () => {
    // 2025-08-18 is a Monday
    expect(transferToObserved("2025-08-18")).toBe("2025-08-18");
  });

  it("Tuesday moves to previous Monday", () => {
    // 2025-06-17 is Tuesday -> 2025-06-16 (Mon)
    expect(transferToObserved("2025-06-17")).toBe("2025-06-16");
  });

  it("Wednesday moves to previous Monday", () => {
    // 2024-08-21 is Wed -> 2024-08-19 (Mon)
    expect(transferToObserved("2024-08-21")).toBe("2024-08-19");
  });

  it("Thursday moves to following Monday", () => {
    // 2024-10-17 is Thu -> 2024-10-21 (Mon)
    expect(transferToObserved("2024-10-17")).toBe("2024-10-21");
  });

  it("Friday moves to following Monday", () => {
    // 2025-10-17 is Fri -> 2025-10-20 (Mon) — wait, check: 2025-10-17 dow
    // 2025-10-17 is Friday -> +3 -> 2025-10-20 (Mon)
    expect(transferToObserved("2025-10-17")).toBe("2025-10-20");
  });

  it("Saturday/Sunday are not auto-moved", () => {
    expect(transferToObserved("2025-08-16")).toBeNull(); // Sat
    expect(transferToObserved("2025-08-17")).toBeNull(); // Sun
  });
});

describe("getArgentinaMarketHolidays - transferable observed", () => {
  it("San Martín 2024 (08-17 = Sat) is NOT auto-moved", () => {
    const holidays = getArgentinaMarketHolidays(2024).map((h) => h.date);
    // No automatic observation when base falls on weekend
    expect(holidays).not.toContain("2024-08-17");
    // The classical observed Mon (2024-08-19) shouldn't be auto-included either
    // unless it coincides with the rule. Since rule says Sat = not auto-moved, exclude it.
    expect(holidays).not.toContain("2024-08-19");
  });

  it("San Martín 2025 (08-17 = Sun) is NOT auto-moved", () => {
    const holidays = getArgentinaMarketHolidays(2025).map((h) => h.date);
    expect(holidays).not.toContain("2025-08-17");
    expect(holidays).not.toContain("2025-08-18");
  });

  it("Diversidad Cultural 2025 (10-12 = Sun) is NOT auto-moved", () => {
    const holidays = getArgentinaMarketHolidays(2025).map((h) => h.date);
    expect(holidays).not.toContain("2025-10-12");
    expect(holidays).not.toContain("2025-10-13");
  });

  it("Soberanía 2024 (11-20 = Wed) moves to previous Monday 2024-11-18", () => {
    const holidays = getArgentinaMarketHolidays(2024).map((h) => h.date);
    expect(holidays).toContain("2024-11-18");
  });

  it("Güemes 2024 (06-17 = Mon) stays on its date", () => {
    const holidays = getArgentinaMarketHolidays(2024).map((h) => h.date);
    expect(holidays).toContain("2024-06-17");
  });
});

describe("isArgentinaMarketBusinessDay", () => {
  it("Saturdays and Sundays are non-business", () => {
    expect(isArgentinaMarketBusinessDay("2025-07-12")).toBe(false);
    expect(isArgentinaMarketBusinessDay("2025-07-13")).toBe(false);
  });

  it("Independence Day 2025-07-09 (Wed) is non-business", () => {
    expect(isArgentinaMarketBusinessDay("2025-07-09")).toBe(false);
  });

  it("regular Tuesday is business", () => {
    expect(isArgentinaMarketBusinessDay("2025-07-08")).toBe(true);
  });
});

describe("manual overrides", () => {
  it("ADD: tourism bridge day blocks business calendar", () => {
    // 2024-12-26 is a Thursday and not a holiday by default
    expect(isArgentinaMarketBusinessDay("2024-12-26")).toBe(true);
    const overrides = [
      {
        date: "2024-12-26",
        name: "Asueto puente turistico",
        type: "TOURISM_DAY" as const,
        action: "ADD" as const,
      },
    ];
    expect(isArgentinaMarketBusinessDay("2024-12-26", { overrides })).toBe(false);
  });

  it("REMOVE: cancels an automatic holiday", () => {
    // 2025-07-09 is Independence Day; remove it via override
    const overrides = [
      {
        date: "2025-07-09",
        name: "BCRA mantiene operativo",
        type: "MARKET_HOLIDAY" as const,
        action: "REMOVE" as const,
      },
    ];
    expect(isArgentinaMarketBusinessDay("2025-07-09", { overrides })).toBe(true);
    const holidays = getArgentinaMarketHolidays(2025, { overrides }).map((h) => h.date);
    expect(holidays).not.toContain("2025-07-09");
  });

  it("ADD with isBusinessDayBlocking=false does NOT block business logic", () => {
    const overrides = [
      {
        date: "2025-12-24",
        name: "Asueto bancario parcial (informativo)",
        type: "BANK_HOLIDAY" as const,
        action: "ADD" as const,
        isBusinessDayBlocking: false,
      },
    ];
    expect(isArgentinaMarketBusinessDay("2025-12-24", { overrides })).toBe(true);
    // But it should still be reported as a holiday entry
    const holidays = getArgentinaMarketHolidays(2025, { overrides });
    const entry = holidays.find((h) => h.date === "2025-12-24");
    expect(entry).toBeDefined();
    expect(entry?.isBusinessDayBlocking).toBe(false);
  });

  it("manual override on Sat/Sun San Martín correctly observes that year", () => {
    // 2024-08-17 falls Saturday; the official 2024 calendar observed it on Mon 2024-08-19
    const overrides = [
      {
        date: "2024-08-19",
        name: "San Martín (observado oficial)",
        type: "MARKET_HOLIDAY" as const,
        action: "ADD" as const,
      },
    ];
    expect(isArgentinaMarketBusinessDay("2024-08-19", { overrides })).toBe(false);
  });
});

describe("business-day arithmetic", () => {
  it("addArgentinaBusinessDays skips weekends", () => {
    // Friday 2025-07-11 + 1 BD = Monday 2025-07-14
    expect(addArgentinaBusinessDays("2025-07-11", 1)).toBe("2025-07-14");
    // Friday 2025-07-11 + 5 BD = Friday 2025-07-18
    expect(addArgentinaBusinessDays("2025-07-11", 5)).toBe("2025-07-18");
  });

  it("addArgentinaBusinessDays skips holidays", () => {
    // Tue 2025-07-08 + 1 BD: next day is Wed 2025-07-09 (Independence) -> skip -> Thu 2025-07-10
    expect(addArgentinaBusinessDays("2025-07-08", 1)).toBe("2025-07-10");
  });

  it("subtractArgentinaBusinessDays mirrors add", () => {
    expect(subtractArgentinaBusinessDays("2025-07-14", 1)).toBe("2025-07-11");
    expect(subtractArgentinaBusinessDays("2025-07-10", 1)).toBe("2025-07-08");
  });

  it("addArgentinaBusinessDays(date, 0) returns the date itself when business, else next BD", () => {
    expect(addArgentinaBusinessDays("2025-07-08", 0)).toBe("2025-07-08");
    // Sunday 2025-07-13 -> next BD is Mon 2025-07-14
    expect(addArgentinaBusinessDays("2025-07-13", 0)).toBe("2025-07-14");
  });
});

describe("adjustment conventions", () => {
  it("'none' returns date as-is even on holidays", () => {
    expect(adjustArgentinaDate("2025-07-09", "none")).toBe("2025-07-09");
  });

  it("'following' moves forward over weekend", () => {
    // Sun 2025-07-13 -> Mon 2025-07-14
    expect(adjustArgentinaDate("2025-07-13", "following")).toBe("2025-07-14");
  });

  it("'preceding' moves backward over weekend", () => {
    // Sun 2025-07-13 -> Fri 2025-07-11
    expect(adjustArgentinaDate("2025-07-13", "preceding")).toBe("2025-07-11");
  });

  it("'modified_following' falls back to preceding when next BD is in next month", () => {
    // 2025-05-31 = Saturday. Following Mon = 2025-06-02 (different month) -> roll back to 2025-05-30 (Fri).
    expect(adjustArgentinaDate("2025-05-31", "modified_following")).toBe("2025-05-30");
  });

  it("'modified_following' equals 'following' when next BD stays in month", () => {
    // 2025-07-13 (Sun) -> 2025-07-14 (Mon), same month
    expect(adjustArgentinaDate("2025-07-13", "modified_following")).toBe("2025-07-14");
  });

  it("'modified_preceding' falls back to following when previous BD is in previous month", () => {
    // 2025-08-01 is Friday (business day). For the test pick 2025-08-02 (Sat) and 2025-08-03 (Sun).
    // Both prev = Fri 2025-08-01 same month -> equal preceding.
    expect(adjustArgentinaDate("2025-08-03", "modified_preceding")).toBe("2025-08-01");
    // Force month-boundary case: 2025-09-01 happens to be Monday -> already business; pick 2025-09-06 (Sat) then 2025-09-07 (Sun)
    // Different scenario: 2025-02-01 is Saturday; preceding = Fri 2025-01-31 (different month) -> roll forward to Mon 2025-02-03
    expect(adjustArgentinaDate("2025-02-01", "modified_preceding")).toBe("2025-02-03");
  });

  it("adjustToNext / adjustToPrevious handle holidays and weekends together", () => {
    // 2025-07-09 (Wed, Independence) -> next BD 2025-07-10 (Thu)
    expect(adjustToNextArgentinaBusinessDay("2025-07-09")).toBe("2025-07-10");
    // 2025-07-09 -> previous BD 2025-07-08 (Tue)
    expect(adjustToPreviousArgentinaBusinessDay("2025-07-09")).toBe("2025-07-08");
  });
});

describe("range and validation", () => {
  it("rejects out-of-range years", () => {
    expect(() => getArgentinaMarketHolidays(1800)).toThrow();
    expect(() => getArgentinaMarketHolidays(2200)).toThrow();
  });

  it("rejects malformed date strings", () => {
    expect(() => isArgentinaMarketBusinessDay("2025/07/09")).toThrow();
    expect(() => isArgentinaMarketBusinessDay("2025-13-01")).toThrow();
    expect(() => isArgentinaMarketBusinessDay("not-a-date")).toThrow();
  });
});
