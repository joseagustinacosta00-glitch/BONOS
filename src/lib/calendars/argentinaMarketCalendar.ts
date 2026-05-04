/**
 * Argentina market / banking business-day calendar.
 *
 * Generates non-business days for the Argentine financial system using rules
 * (no per-year hardcoding). All dates are handled as `YYYY-MM-DD` strings to
 * avoid UTC drift; the timezone of record is America/Argentina/Buenos_Aires.
 */

export const ARG_TIMEZONE = "America/Argentina/Buenos_Aires";

// ---------- Types ----------

/** Date in `YYYY-MM-DD` format. */
export type DateStr = string;

export type AdjustmentConvention =
  | "following"
  | "modified_following"
  | "preceding"
  | "modified_preceding"
  | "none";

export type ManualOverrideType =
  | "TOURISM_DAY"
  | "MARKET_HOLIDAY"
  | "BANK_HOLIDAY"
  | "MANUAL_OVERRIDE";

export type ManualOverrideAction = "ADD" | "REMOVE";

export interface ManualOverride {
  /** ISO `YYYY-MM-DD`. */
  date: DateStr;
  name: string;
  type: ManualOverrideType;
  action: ManualOverrideAction;
  /** If true, the date blocks business-day logic. Defaults to true. */
  isBusinessDayBlocking?: boolean;
  source?: string;
  notes?: string;
}

export interface CalendarOptions {
  /** Manual overrides applied on top of the automatic calendar. */
  overrides?: ManualOverride[];
}

export interface HolidayInfo {
  date: DateStr;
  name: string;
  category:
    | "FIXED"
    | "VARIABLE"
    | "TRANSFERABLE"
    | "MANUAL_ADD"
    | "MANUAL_REMOVE";
  isBusinessDayBlocking: boolean;
  source?: string;
  notes?: string;
}

// ---------- Date string helpers (avoid UTC drift) ----------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDateStr(value: DateStr): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(value);
  if (!match) {
    throw new Error(`Invalid date string (expected YYYY-MM-DD): ${value}`);
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  // Validate by round-trip
  const test = new Date(Date.UTC(y, m - 1, d));
  if (
    test.getUTCFullYear() !== y ||
    test.getUTCMonth() !== m - 1 ||
    test.getUTCDate() !== d
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return { y, m, d };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fmt(y: number, m: number, d: number): DateStr {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Day of week (0 = Sunday ... 6 = Saturday) for a YYYY-MM-DD string. */
export function dayOfWeek(value: DateStr): number {
  const { y, m, d } = parseDateStr(value);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Add `days` calendar days to `value`, returning a YYYY-MM-DD string. */
export function addCalendarDays(value: DateStr, days: number): DateStr {
  const { y, m, d } = parseDateStr(value);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function isWeekend(value: DateStr): boolean {
  const dow = dayOfWeek(value);
  return dow === 0 || dow === 6;
}

/** Same calendar month? */
function sameMonth(a: DateStr, b: DateStr): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

// ---------- Easter (Computus, Anonymous Gregorian algorithm) ----------

/** Returns Easter Sunday for a given Gregorian year as YYYY-MM-DD. */
export function easterSunday(year: number): DateStr {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return fmt(year, month, day);
}

// ---------- Transferable holiday transfer rule ----------

/**
 * Transfer rule:
 *  Mon -> same day
 *  Tue / Wed -> previous Monday
 *  Thu / Fri -> following Monday
 *  Sat / Sun -> not auto-moved (allow manual override)
 *
 * Returns null when the date should not be auto-observed (Sat/Sun).
 */
export function transferToObserved(value: DateStr): DateStr | null {
  const dow = dayOfWeek(value);
  switch (dow) {
    case 1: // Monday
      return value;
    case 2: // Tuesday
      return addCalendarDays(value, -1);
    case 3: // Wednesday
      return addCalendarDays(value, -2);
    case 4: // Thursday
      return addCalendarDays(value, 4);
    case 5: // Friday
      return addCalendarDays(value, 3);
    default: // Sat (6), Sun (0)
      return null;
  }
}

// ---------- Holiday rule definitions ----------

interface FixedRule {
  month: number;
  day: number;
  name: string;
}

interface TransferableRule {
  month: number;
  day: number;
  name: string;
}

const FIXED_HOLIDAYS: FixedRule[] = [
  { month: 1, day: 1, name: "Año Nuevo" },
  { month: 3, day: 24, name: "Día Nacional de la Memoria por la Verdad y la Justicia" },
  { month: 4, day: 2, name: "Día del Veterano y de los Caídos en la Guerra de Malvinas" },
  { month: 5, day: 1, name: "Día del Trabajador" },
  { month: 5, day: 25, name: "Día de la Revolución de Mayo" },
  { month: 6, day: 20, name: "Paso a la Inmortalidad del General Manuel Belgrano" },
  { month: 7, day: 9, name: "Día de la Independencia" },
  { month: 12, day: 8, name: "Inmaculada Concepción de María" },
  { month: 12, day: 25, name: "Navidad" },
];

const TRANSFERABLE_HOLIDAYS: TransferableRule[] = [
  { month: 6, day: 17, name: "Paso a la Inmortalidad del General Martín Miguel de Güemes" },
  { month: 8, day: 17, name: "Paso a la Inmortalidad del General José de San Martín" },
  { month: 10, day: 12, name: "Día del Respeto a la Diversidad Cultural" },
  { month: 11, day: 20, name: "Día de la Soberanía Nacional" },
];

// ---------- Holiday generation ----------

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function assertYearRange(year: number): void {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new Error(
      `Year out of supported range [${MIN_YEAR}, ${MAX_YEAR}]: ${year}`,
    );
  }
}

/**
 * Get all market-blocking holidays for a given year (without weekends).
 * Includes fixed, variable (Easter-based), transferable (with transfer rule),
 * and manual overrides scoped to that year.
 */
export function getArgentinaMarketHolidays(
  year: number,
  options: CalendarOptions = {},
): HolidayInfo[] {
  assertYearRange(year);

  const out: Map<DateStr, HolidayInfo> = new Map();

  // 1) Fixed holidays
  for (const h of FIXED_HOLIDAYS) {
    const d = fmt(year, h.month, h.day);
    out.set(d, {
      date: d,
      name: h.name,
      category: "FIXED",
      isBusinessDayBlocking: true,
    });
  }

  // 2) Variable / Easter-based
  const easter = easterSunday(year);
  const carnivalMon = addCalendarDays(easter, -48);
  const carnivalTue = addCalendarDays(easter, -47);
  const goodFriday = addCalendarDays(easter, -2);
  out.set(carnivalMon, {
    date: carnivalMon,
    name: "Carnaval (Lunes)",
    category: "VARIABLE",
    isBusinessDayBlocking: true,
  });
  out.set(carnivalTue, {
    date: carnivalTue,
    name: "Carnaval (Martes)",
    category: "VARIABLE",
    isBusinessDayBlocking: true,
  });
  out.set(goodFriday, {
    date: goodFriday,
    name: "Viernes Santo",
    category: "VARIABLE",
    isBusinessDayBlocking: true,
  });

  // 3) Transferable
  for (const h of TRANSFERABLE_HOLIDAYS) {
    const base = fmt(year, h.month, h.day);
    const observed = transferToObserved(base);
    if (observed === null) {
      // Sat/Sun base date — not auto-moved. Manual override may add it.
      continue;
    }
    // Only include if the observed day is within the same year.
    if (observed.startsWith(`${year}-`)) {
      out.set(observed, {
        date: observed,
        name: `${h.name} (observado)`,
        category: "TRANSFERABLE",
        isBusinessDayBlocking: true,
      });
    }
  }

  // 4) Manual overrides
  const overrides = options.overrides ?? [];
  for (const ov of overrides) {
    if (!ov.date.startsWith(`${year}-`)) continue;
    parseDateStr(ov.date); // validate
    if (ov.action === "REMOVE") {
      out.delete(ov.date);
      // Track removal for diagnostics (only if the entry doesn't exist).
      // Removed entries shouldn't appear in the holiday list.
      continue;
    }
    const blocking = ov.isBusinessDayBlocking ?? true;
    out.set(ov.date, {
      date: ov.date,
      name: ov.name,
      category: "MANUAL_ADD",
      isBusinessDayBlocking: blocking,
      source: ov.source,
      notes: ov.notes,
    });
  }

  return Array.from(out.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- Business-day predicates / arithmetic ----------

/**
 * Build a Set of date strings that block business-day logic for a year.
 * Includes only entries with `isBusinessDayBlocking !== false`.
 */
function buildBlockingSet(year: number, options: CalendarOptions): Set<DateStr> {
  const set = new Set<DateStr>();
  for (const h of getArgentinaMarketHolidays(year, options)) {
    if (h.isBusinessDayBlocking) set.add(h.date);
  }
  return set;
}

const _yearCache = new Map<string, Set<DateStr>>();

function cachedBlockingSet(year: number, options: CalendarOptions): Set<DateStr> {
  // Only cache when no overrides (to keep it simple and correct).
  if (!options.overrides || options.overrides.length === 0) {
    const key = String(year);
    let s = _yearCache.get(key);
    if (!s) {
      s = buildBlockingSet(year, options);
      _yearCache.set(key, s);
    }
    return s;
  }
  return buildBlockingSet(year, options);
}

/** Clears the internal year cache. Useful in tests. */
export function _clearCalendarCache(): void {
  _yearCache.clear();
}

export function isArgentinaMarketBusinessDay(
  value: DateStr,
  options: CalendarOptions = {},
): boolean {
  if (isWeekend(value)) return false;
  const { y } = parseDateStr(value);
  const blocking = cachedBlockingSet(y, options);
  return !blocking.has(value);
}

export function adjustToNextArgentinaBusinessDay(
  value: DateStr,
  options: CalendarOptions = {},
): DateStr {
  let cursor = value;
  // Bound the loop to prevent runaway in pathological cases.
  for (let i = 0; i < 366; i++) {
    if (isArgentinaMarketBusinessDay(cursor, options)) return cursor;
    cursor = addCalendarDays(cursor, 1);
  }
  throw new Error(`Could not find next business day from ${value}`);
}

export function adjustToPreviousArgentinaBusinessDay(
  value: DateStr,
  options: CalendarOptions = {},
): DateStr {
  let cursor = value;
  for (let i = 0; i < 366; i++) {
    if (isArgentinaMarketBusinessDay(cursor, options)) return cursor;
    cursor = addCalendarDays(cursor, -1);
  }
  throw new Error(`Could not find previous business day from ${value}`);
}

export function addArgentinaBusinessDays(
  value: DateStr,
  n: number,
  options: CalendarOptions = {},
): DateStr {
  if (!Number.isInteger(n)) {
    throw new Error(`addArgentinaBusinessDays expects integer n, got ${n}`);
  }
  if (n === 0) return adjustToNextArgentinaBusinessDay(value, options);
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  let cursor = value;
  while (remaining > 0) {
    cursor = addCalendarDays(cursor, step);
    if (isArgentinaMarketBusinessDay(cursor, options)) {
      remaining -= 1;
    }
  }
  return cursor;
}

export function subtractArgentinaBusinessDays(
  value: DateStr,
  n: number,
  options: CalendarOptions = {},
): DateStr {
  return addArgentinaBusinessDays(value, -n, options);
}

export function adjustArgentinaDate(
  value: DateStr,
  convention: AdjustmentConvention,
  options: CalendarOptions = {},
): DateStr {
  if (convention === "none") return value;
  if (isArgentinaMarketBusinessDay(value, options)) return value;

  if (convention === "following") {
    return adjustToNextArgentinaBusinessDay(value, options);
  }
  if (convention === "preceding") {
    return adjustToPreviousArgentinaBusinessDay(value, options);
  }
  if (convention === "modified_following") {
    const next = adjustToNextArgentinaBusinessDay(value, options);
    if (sameMonth(next, value)) return next;
    return adjustToPreviousArgentinaBusinessDay(value, options);
  }
  if (convention === "modified_preceding") {
    const prev = adjustToPreviousArgentinaBusinessDay(value, options);
    if (sameMonth(prev, value)) return prev;
    return adjustToNextArgentinaBusinessDay(value, options);
  }
  // Exhaustiveness guard
  const _exhaustive: never = convention;
  throw new Error(`Unknown convention: ${_exhaustive as string}`);
}
