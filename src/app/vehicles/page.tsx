import Link from "next/link";

import { FleetClient } from "@/components/FleetClient";
import { PageHeader, StatCard } from "@/components/ui";
import { money } from "@/lib/domain";
import { buildFleetReport, listVehicles } from "@/lib/fleet";
import { getSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const [settings, report] = await Promise.all([
    getSettings(),
    buildFleetReport(from, to, "USD"),
  ]);
  const vehicles = await listVehicles(from, to);
  const currency = settings.currency;
  const fleetReport = { ...report, currency };

  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Fleet master profile and per-vehicle financial ledger — revenue, direct operating costs and operator payroll."
      >
        <a
          href={`/api/reports/fleet${from || to ? `?from=${from ?? ""}&to=${to ?? ""}` : ""}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Fleet summary PDF
        </a>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vehicles in fleet" value={String(fleetReport.totals.vehicleCount)} tone="slate" />
        <StatCard label="Net revenue (period)" value={money(fleetReport.totals.netRevenue, currency)} tone="indigo" />
        <StatCard
          label="Fleet costs"
          value={money(fleetReport.totals.totalCosts, currency)}
          hint={`Direct ${money(fleetReport.totals.directExpenses, currency)} + salary ${money(fleetReport.totals.operatorSalary, currency)}`}
          tone="amber"
        />
        <StatCard
          label="Fleet net profit"
          value={money(fleetReport.totals.netProfit, currency)}
          hint={`Margin ${fleetReport.totals.margin.toFixed(2)}%`}
          tone={fleetReport.totals.netProfit >= 0 ? "emerald" : "rose"}
        />
      </div>

      <FleetClient
        vehicles={vehicles}
        report={fleetReport}
        currency={currency}
        from={from ?? ""}
        to={to ?? ""}
      />

      <p className="px-1 text-xs text-slate-500">
        Need a single asset? Open a vehicle for its full ledger and P&amp;L statement, or compare the whole fleet
        on the <Link href="/reports" className="font-semibold text-indigo-600 hover:text-indigo-500">VAT &amp; fleet report</Link>.
      </p>
    </>
  );
}
