/**
 * Shared domain logic: money rounding, VAT (cash-accounting scheme) and
 * reporting-period resolution. Pure functions only — safe to use on both the
 * server and in React components.
 */

export type VatScheme = "cash" | "standard";

export function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Half-up rounding to 2 decimals — mirrors Python's Decimal ROUND_HALF_UP. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function money(value: unknown, currency = "USD"): string {
  const amount = round2(num(value));
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const iso = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ *
 * Line items & invoice totals
 * ------------------------------------------------------------------ */

export type RatePer = "Per Hour" | "Per Day" | "Monthly" | "Per Trip";

export const RATE_PER_OPTIONS: RatePer[] = ["Per Hour", "Per Day", "Monthly", "Per Trip"];

const LEGACY_RATE: Record<string, RatePer> = {
  Trip: "Per Trip",
  Hour: "Per Hour",
  Day: "Per Day",
  Month: "Monthly",
};

/** Normalise any stored rate basis (including legacy values) to a current one. */
export function normaliseRatePer(value: unknown): RatePer {
  const raw = String(value ?? "").trim();
  if ((RATE_PER_OPTIONS as string[]).includes(raw)) return raw as RatePer;
  return LEGACY_RATE[raw] ?? "Per Trip";
}

/** Pre-filled invoice line descriptions (plant and haulage catalogue). */
export const EQUIPMENT_OPTIONS = [
  "Hiring charges of JCB 3CX",
  "JCB BOOMLOADER",
  "SHOVEL",
  "MOBILE CRANE",
  "TRAILER",
  "SIX WHEEL",
] as const;

/** Payment methods accepted for customer receipts. */
export const PAYMENT_METHODS = ["Cash", "PDC", "Bank Transfer", "Other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Fixed VAT rate applied to every invoice line. */
export const FIXED_VAT_RATE = 5;

/** Payment terms offered on invoices; the due date is derived from these. */
export const PAYMENT_TERMS = ["Cash", "15", "30", "45", "60", "90"] as const;
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export function dueDateFromTerms(issueDate: string, terms: string): string {
  const base = new Date(`${(issueDate || todayISO()).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return issueDate;
  const days = Number(terms) || 0;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function termsLabel(terms: string | null | undefined): string {
  if (!terms) return "30 days";
  if (terms.toLowerCase() === "cash") return "Cash on delivery";
  return `Net ${terms} days`;
}

export type LineInput = {
  description: string;
  subDescription?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  ratePer?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

export type ComputedLine = {
  description: string;
  subDescription: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  ratePer: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineNet: number;
  lineVat: number;
  lineGross: number;
};

export type Totals = {
  lines: ComputedLine[];
  subtotal: number;
  vatTotal: number;
  total: number;
  /** Effective blended VAT rate of the invoice (used for cash VAT pro-rating). */
  effectiveVatRate: number;
};

export function computeTotals(inputs: LineInput[]): Totals {
  const lines: ComputedLine[] = inputs.map((input) => {
    const quantity = round2(num(input.quantity));
    // The unit price is deliberately NOT rounded before multiplying: a monthly
    // rate divided by 260 hours is a repeating decimal, and rounding it first
    // would make "rate per hour x qty" drift away from the monthly figure.
    // Only the resulting line net is rounded.
    const unitPrice = num(input.unitPrice);
    const vatRate = num(input.vatRate);
    const lineNet = round2(quantity * unitPrice);
    const lineVat = round2((lineNet * vatRate) / 100);
    return {
      description: input.description,
      subDescription: input.subDescription?.trim() ? input.subDescription.trim() : null,
      periodStart: input.periodStart?.trim() ? input.periodStart.trim() : null,
      periodEnd: input.periodEnd?.trim() ? input.periodEnd.trim() : null,
      ratePer: normaliseRatePer(input.ratePer),
      quantity,
      unitPrice,
      vatRate,
      lineNet,
      lineVat,
      lineGross: round2(lineNet + lineVat),
    };
  });

  const subtotal = round2(lines.reduce((sum, line) => sum + line.lineNet, 0));
  const vatTotal = round2(lines.reduce((sum, line) => sum + line.lineVat, 0));

  return {
    lines,
    subtotal,
    vatTotal,
    total: round2(subtotal + vatTotal),
    effectiveVatRate: subtotal > 0 ? round2((vatTotal / subtotal) * 100) : 0,
  };
}

/* ------------------------------------------------------------------ *
 * CASH-ACCOUNTING VAT ENGINE
 *
 * VAT is recognised ONLY when money is actually received. The invoiced
 * amount and the invoice date are deliberately ignored. A receipt is
 * pro-rated across the invoice's blended VAT fraction, so mixed-rate
 * invoices are handled proportionally.
 * ------------------------------------------------------------------ */

export function cashVatForPayment(
  paymentAmount: number,
  invoiceGrossTotal: number,
  invoiceVatTotal: number,
): number {
  const amount = round2(num(paymentAmount));
  const gross = round2(num(invoiceGrossTotal));
  const vat = round2(num(invoiceVatTotal));
  if (gross <= 0 || amount <= 0) return 0;
  // Guard against over-receipts (payment > gross) so VAT never exceeds the
  // total VAT that was ever chargeable on the invoice.
  const capped = Math.min(amount, gross);
  return round2((capped * vat) / gross);
}

export type InvoiceStatus = "draft" | "open" | "partial" | "paid" | "overdue" | "void";

export function deriveStatus(
  grossTotal: number,
  paidTotal: number,
  dueDate: string | null | undefined,
  storedStatus: string = "open",
  today = todayISO(),
): InvoiceStatus {
  if (storedStatus === "void") return "void";
  const total = round2(num(grossTotal));
  const paid = round2(num(paidTotal));
  if (total > 0 && paid >= total - 0.005) return "paid";
  if (paid > 0) return "partial";
  if (dueDate && dueDate < today) return "overdue";
  return "open";
}

export function statusTone(status: InvoiceStatus): string {
  switch (status) {
    case "paid":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "partial":
      return "bg-amber-100 text-amber-700 ring-amber-200";
    case "overdue":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    case "void":
      return "bg-slate-200 text-slate-600 ring-slate-300";
    default:
      return "bg-sky-100 text-sky-700 ring-sky-200";
  }
}

/* ------------------------------------------------------------------ *
 * Reporting periods (quarterly / yearly / custom)
 * ------------------------------------------------------------------ */

export type PeriodKind = "quarter" | "year" | "month" | "custom";

export type PeriodRange = {
  kind: PeriodKind;
  label: string;
  from: string;
  to: string;
  description: string;
};

export function quarterBounds(year: number, quarter: 1 | 2 | 3 | 4) {
  const startMonth = (quarter - 1) * 3;
  const from = new Date(Date.UTC(year, startMonth, 1));
  const to = new Date(Date.UTC(year, startMonth + 3, 0)); // last day of quarter
  return { from, to };
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolvePeriod(
  kind: PeriodKind,
  options: { year?: number; quarter?: 1 | 2 | 3 | 4; month?: number; from?: string; to?: string } = {},
): PeriodRange {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentQuarter = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;

  if (kind === "quarter") {
    const year = options.year ?? currentYear;
    const quarter = (options.quarter ?? currentQuarter) as 1 | 2 | 3 | 4;
    const { from, to } = quarterBounds(year, quarter);
    return {
      kind,
      label: `Q${quarter} ${year}`,
      from: isoDate(from),
      to: isoDate(to),
      description: `Payments received between ${isoDate(from)} and ${isoDate(to)}`,
    };
  }

  if (kind === "year") {
    const year = options.year ?? currentYear;
    return {
      kind,
      label: `FY ${year}`,
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      description: `Payments received between ${year}-01-01 and ${year}-12-31`,
    };
  }

  if (kind === "month") {
    const year = options.year ?? currentYear;
    const month = options.month ?? now.getUTCMonth() + 1;
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0));
    return {
      kind,
      label: from.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      from: isoDate(from),
      to: isoDate(to),
      description: `Payments received between ${isoDate(from)} and ${isoDate(to)}`,
    };
  }

  const from = options.from ?? `${currentYear}-01-01`;
  const to = options.to ?? isoDate(now);
  return {
    kind,
    label: `${from} → ${to}`,
    from,
    to,
    description: `Payments received between ${from} and ${to}`,
  };
}

export function parsePeriodSearch(params: URLSearchParams): PeriodRange {
  const rawKind = (params.get("period") ?? "quarter").toLowerCase();
  const kind: PeriodKind = (["quarter", "year", "month", "custom"] as const).includes(
    rawKind as PeriodKind,
  )
    ? (rawKind as PeriodKind)
    : "quarter";
  const year = params.get("year") ? Number(params.get("year")) : undefined;
  const quarter = params.get("quarter") ? (Number(params.get("quarter")) as 1 | 2 | 3 | 4) : undefined;
  const month = params.get("month") ? Number(params.get("month")) : undefined;
  return resolvePeriod(kind, {
    year: Number.isFinite(year) ? year : undefined,
    quarter: quarter && quarter >= 1 && quarter <= 4 ? quarter : undefined,
    month,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });
}

/** @deprecated use PAYMENT_METHODS */
export const VAT_METHODS = PAYMENT_METHODS;