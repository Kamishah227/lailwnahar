import { parsePeriodSearch, round2, type PeriodKind, type PeriodRange } from "@/lib/domain";
import { expenseVatTotals, type ExpenseVatTotals } from "@/lib/expenses";
import { buildVatReport, getSettings, type VatReport } from "@/lib/repo";

/**
 * Full VAT return.
 *
 * OUTPUT VAT (what you collected)
 *   - VAT on customer payments received inside the period (cash accounting).
 *     Vehicle revenue recorded directly against an asset is deliberately NOT
 *     included here: it is reported through the fleet module only.
 *
 * INPUT VAT (what you paid out and can claim)
 *   - VAT on recorded direct expenses (fuel, maintenance, operating costs)
 *   - VAT on recorded indirect expenses (admin, overheads, utilities)
 *
 * NET VAT PAYABLE / REFUNDABLE = output VAT - input VAT
 */

export type FullVatReport = {
  period: PeriodRange;
  scheme: string;
  currency: string;
  /** Cash-basis report built from customer receipts. */
  receipts: VatReport;
  output: {
    taxableSales: number;
    outputVat: number;
  };
  input: ExpenseVatTotals & { directVatShare: number; indirectVatShare: number };
  net: {
    netVat: number;
    direction: "payable" | "refundable" | "nil";
    label: string;
  };
};

export async function buildFullVatReport(period: PeriodRange): Promise<FullVatReport> {
  const [settings, receipts, expenseTotals] = await Promise.all([
    getSettings(),
    buildVatReport(period),
    expenseVatTotals(period.from, period.to),
  ]);

  const outputVat = round2(receipts.totals.vatDue);
  const taxableSales = round2(receipts.totals.netCollected);
  const inputVat = expenseTotals.totalVat;
  const netVat = round2(outputVat - inputVat);

  return {
    period,
    scheme: "Cash accounting — VAT recognised on cash received and invoices paid",
    currency: settings.currency,
    receipts,
    output: {
      taxableSales,
      outputVat,
    },
    input: {
      ...expenseTotals,
      directVatShare: expenseTotals.totalVat
        ? round2((expenseTotals.directVat / expenseTotals.totalVat) * 100)
        : 0,
      indirectVatShare: expenseTotals.totalVat
        ? round2((expenseTotals.indirectVat / expenseTotals.totalVat) * 100)
        : 0,
    },
    net: {
      netVat: Math.abs(netVat),
      direction: netVat > 0.005 ? "payable" : netVat < -0.005 ? "refundable" : "nil",
      label:
        netVat > 0.005
          ? "Net VAT payable to the authority"
          : netVat < -0.005
            ? "Net VAT refundable to you"
            : "No net VAT due for this period",
    },
  };
}

export { parsePeriodSearch };
export type { PeriodKind };
