import { VatReportClient } from "@/components/VatReportClient";
import { Card, PageHeader, Th } from "@/components/ui";
import { money, resolvePeriod, todayISO, type PeriodKind } from "@/lib/domain";
import { buildFleetReport } from "@/lib/fleet";
import { getSettings } from "@/lib/repo";
import { buildFullVatReport } from "@/lib/vatReport";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; year?: string; quarter?: string; month?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const kind = (["quarter", "year", "month", "custom"] as const).includes(
    (params.period ?? "quarter") as PeriodKind,
  )
    ? ((params.period ?? "quarter") as PeriodKind)
    : "quarter";

  const now = new Date();
  const period = resolvePeriod(kind, {
    year: params.year ? Number(params.year) : now.getUTCFullYear(),
    quarter: params.quarter
      ? (Math.min(Math.max(Number(params.quarter), 1), 4) as 1 | 2 | 3 | 4)
      : ((Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4),
    month: params.month ? Number(params.month) : now.getUTCMonth() + 1,
    from: params.from ?? `${now.getUTCFullYear()}-01-01`,
    to: params.to ?? todayISO(),
  });

  const [report, settings] = await Promise.all([buildFullVatReport(period), getSettings()]);

  // Fleet comparison over the same window, for the combined reporting view.
  const fleet = await buildFleetReport(period.from, period.to, settings.currency);
  const ranked = [...fleet.rows].sort((a, b) => b.netProfit - a.netProfit);

  return (
    <>
      <PageHeader
        title="VAT & fleet reporting"
        description="Output VAT on cash received, input VAT on purchase invoices, the net VAT position and fleet profitability — all for the same period."
      />
      <VatReportClient
        report={report}
        kind={kind}
        year={Number(params.year ?? now.getUTCFullYear())}
        quarter={Number(params.quarter ?? Math.floor(now.getUTCMonth() / 3) + 1)}
        month={Number(params.month ?? now.getUTCMonth() + 1)}
        from={params.from ?? `${now.getUTCFullYear()}-01-01`}
        to={params.to ?? todayISO()}
      />

      <Card
        title={`Fleet comparison — ${period.label}`}
        subtitle="Net revenue, direct costs, operator salary and profit per vehicle over the same period"
        bodyClassName="p-0"
        action={
          <a
            href={`/api/reports/fleet?from=${period.from}&to=${period.to}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Fleet PDF
          </a>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <Th>Vehicle</Th>
                <Th>Operator</Th>
                <Th align="right">Net revenue</Th>
                <Th align="right">Direct expenses</Th>
                <Th align="right">Operator salary</Th>
                <Th align="right">Total costs</Th>
                <Th align="right">Net profit</Th>
                <Th align="right">Margin</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ranked.map((row) => (
                <tr key={row.vehicle.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-indigo-600">
                    <a href={`/vehicles/${row.vehicle.id}`}>{row.vehicle.code}</a>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                    {row.vehicle.assignedOperator ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                    {money(row.netRevenue, settings.currency)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                    {money(row.directExpenses, settings.currency)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                    {money(row.operatorSalary, settings.currency)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                    {money(row.totalCosts, settings.currency)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums ${
                      row.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {money(row.netProfit, settings.currency)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                    {row.margin.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {ranked.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                    No vehicles in the fleet yet — add one from the Vehicles section.
                  </td>
                </tr>
              )}
            </tbody>
            {ranked.length > 0 && (
              <tfoot className="bg-slate-50">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-700">Fleet total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                    {money(fleet.totals.netRevenue, settings.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                    {money(fleet.totals.directExpenses, settings.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                    {money(fleet.totals.operatorSalary, settings.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                    {money(fleet.totals.totalCosts, settings.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                    {money(fleet.totals.netProfit, settings.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                    {fleet.totals.margin.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </>
  );
}
