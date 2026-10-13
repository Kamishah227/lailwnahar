import Link from "next/link";
import { notFound } from "next/navigation";

import { VehicleDetailClient } from "@/components/VehicleDetailClient";
import { Badge, Card, PageHeader, StatCard, Td, Th } from "@/components/ui";
import { formatDate, money } from "@/lib/domain";
import { VEHICLE_STATUS_LABELS } from "@/lib/vehiclesUi";
import { buildVehiclePnl, listSalaries, listVehicleIncome } from "@/lib/fleet";
import { listExpenses } from "@/lib/expenses";
import { getSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;
  const vehicleId = Number(id);
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) notFound();

  let settings;
  let pnl;
  try {
    settings = await getSettings();
    pnl = await buildVehiclePnl(vehicleId, from, to, settings.currency);
  } catch {
    notFound();
  }

  const [income, salaries, expenses] = await Promise.all([
    listVehicleIncome(vehicleId, from, to),
    listSalaries(vehicleId, from, to),
    listExpenses({ vehicleId, from, to }),
  ]);
  const currency = settings.currency;
  const vehicle = pnl.vehicle;

  return (
    <>
      <PageHeader
        title={`${vehicle.code} — ${vehicle.make} ${vehicle.model ?? ""}`.trim()}
        description={`${vehicle.plateNumber} • ${VEHICLE_STATUS_LABELS[vehicle.status] ?? vehicle.status} • operator ${
          vehicle.assignedOperator ?? "unassigned"
        }`}
      >
        <Link
          href="/vehicles"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Fleet
        </Link>
        <a
          href={`/api/reports/vehicle/${vehicle.id}${from || to ? `?from=${from}&to=${to}` : ""}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          P&amp;L PDF
        </a>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross revenue" value={money(pnl.grossRevenue, currency)} hint={`${pnl.tripCount} revenue entries`} tone="indigo" />
        <StatCard label="Direct expenses" value={money(pnl.directExpenses, currency)} hint={`${expenses.length} entries`} tone="amber" />
        <StatCard label="Operator salary" value={money(pnl.operatorSalary, currency)} hint={`Contract ${money(vehicle.operatorMonthlySalary, currency)}/month`} tone="slate" />
        <StatCard
          label="Net profit"
          value={money(pnl.netProfit, currency)}
          hint={`Margin ${pnl.margin.toFixed(2)}%`}
          tone={pnl.netProfit >= 0 ? "emerald" : "rose"}
        />
      </div>

      <VehicleDetailClient
        vehicleId={vehicle.id}
        currency={currency}
        from={from ?? ""}
        to={to ?? ""}
        defaultOperator={vehicle.assignedOperator}
        defaultSalary={vehicle.operatorMonthlySalary}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Revenue ledger" subtitle="Income booked directly against this vehicle" bodyClassName="p-0">
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <Th>Date</Th>
                  <Th>Description</Th>
                  <Th>Customer</Th>
                  <Th align="right">Net</Th>
                  <Th align="right">VAT</Th>
                  <Th align="right">Gross</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {income.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <Td>{formatDate(row.incomeDate)}</Td>
                    <Td className="max-w-[12rem] whitespace-normal">
                      {row.description}
                      <p className="text-xs text-slate-500">
                        {row.quantity} × {money(row.netAmount / (row.quantity || 1), currency)} / {row.ratePer ?? "unit"}
                      </p>
                    </Td>
                    <Td>{row.customerName ?? "—"}</Td>
                    <Td align="right">{money(row.netAmount, currency)}</Td>
                    <Td align="right">{money(row.vatAmount, currency)}</Td>
                    <Td align="right" className="font-semibold">
                      {money(row.grossAmount, currency)}
                    </Td>
                  </tr>
                ))}
                {income.length === 0 && (
                  <tr>
                    <Td className="text-slate-500">No revenue recorded in this period.</Td>
                    <Td> </Td>
                    <Td> </Td>
                    <Td> </Td>
                    <Td> </Td>
                    <Td> </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Direct operating expenses" subtitle="Attributed to this vehicle from the expense register" bodyClassName="p-0">
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <Th>Date</Th>
                  <Th>Vendor</Th>
                  <Th>Description</Th>
                  <Th align="right">Net</Th>
                  <Th align="right">Input VAT</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <Td>{formatDate(row.expenseDate)}</Td>
                    <Td>{row.vendorName}</Td>
                    <Td className="max-w-[10rem] whitespace-normal">
                      {row.description}
                      <p className="text-xs text-slate-500">{row.categoryName ?? row.type}</p>
                    </Td>
                    <Td align="right">{money(row.netAmount, currency)}</Td>
                    <Td align="right" className="text-emerald-700">
                      {money(row.vatAmount, currency)}
                    </Td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <Td className="text-slate-500">No direct expenses in this period.</Td>
                    <Td> </Td>
                    <Td> </Td>
                    <Td> </Td>
                    <Td> </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Operator salary payments" bodyClassName="p-0">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <Th>Period</Th>
                <Th>Operator</Th>
                <Th>Paid</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salaries.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <Td>
                    <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{row.periodLabel}</Badge>
                  </Td>
                  <Td>{row.operatorName}</Td>
                  <Td>{formatDate(row.paymentDate)}</Td>
                  <Td align="right" className="font-semibold">
                    {money(row.amount, currency)}
                  </Td>
                </tr>
              ))}
              {salaries.length === 0 && (
                <tr>
                  <Td className="text-slate-500">No salary payments recorded.</Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card title="Profit & loss" subtitle="Period summary">
          <dl className="space-y-2 text-sm">
            {[
              ["Gross revenue (incl. VAT)", money(pnl.grossRevenue, currency), "text-slate-800"],
              ["Output VAT on revenue", `(${money(pnl.outputVat, currency)})`, "text-slate-500"],
              ["Net revenue", money(pnl.netRevenue, currency), "font-semibold text-slate-900"],
              ["Direct operating expenses", `(${money(pnl.directExpenses, currency)})`, "text-amber-700"],
              ["Operator salary", `(${money(pnl.operatorSalary, currency)})`, "text-amber-700"],
              ["Total costs", `(${money(pnl.totalCosts, currency)})`, "font-semibold text-amber-700"],
            ].map(([term, value, tone]) => (
              <div key={term} className="flex justify-between border-b border-slate-100 pb-2">
                <dt className="text-slate-500">{term}</dt>
                <dd className={`tabular-nums ${tone}`}>{value}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-1">
              <dt className="font-semibold text-slate-800">Net profit ({pnl.margin.toFixed(2)}% margin)</dt>
              <dd className={`font-semibold tabular-nums ${pnl.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                {money(pnl.netProfit, currency)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
            Indirect overheads (rent, utilities, insurance) are excluded from the per-vehicle P&amp;L and reported
            separately on the VAT return, so asset profitability is not distorted by shared costs.
          </p>
        </Card>
      </div>

      <Card title="Vehicle profile">
        <dl className="grid gap-4 sm:grid-cols-3">
          {[
            ["Vehicle ID", vehicle.code],
            ["Make & model", `${vehicle.make} ${vehicle.model ?? ""}`.trim()],
            ["Plate number", vehicle.plateNumber],
            ["Year", vehicle.year ? String(vehicle.year) : "—"],
            ["Status", VEHICLE_STATUS_LABELS[vehicle.status] ?? vehicle.status],
            ["Assigned operator", vehicle.assignedOperator ?? "—"],
            ["Contracted salary", `${money(vehicle.operatorMonthlySalary, currency)} / month`],
            ["In service since", vehicle.purchasedAt ? formatDate(vehicle.purchasedAt) : "—"],
            ["Revenue entries", String(pnl.tripCount)],
          ].map(([term, value]) => (
            <div key={term} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{term}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
        {vehicle.notes && (
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">{vehicle.notes}</p>
        )}
      </Card>
    </>
  );
}
