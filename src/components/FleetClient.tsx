"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge, Card, EmptyState, Td, Th } from "@/components/ui";
import { money } from "@/lib/domain";
import { VEHICLE_STATUS_LABELS } from "@/lib/vehiclesUi";
import type { FleetReport, VehicleRow } from "@/lib/fleet";

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const label = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

type Draft = {
  code: string;
  make: string;
  model: string;
  year: string;
  plateNumber: string;
  status: string;
  assignedOperator: string;
  operatorMonthlySalary: string;
  purchasedAt: string;
  notes: string;
};

const EMPTY: Draft = {
  code: "",
  make: "",
  model: "",
  year: "",
  plateNumber: "",
  status: "active",
  assignedOperator: "",
  operatorMonthlySalary: "",
  purchasedAt: "",
  notes: "",
};

export function FleetClient({
  vehicles,
  report,
  currency,
  from,
  to,
}: {
  vehicles: VehicleRow[];
  report: FleetReport;
  currency: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => report.rows, [report]);
  const ranked = useMemo(() => [...rows].sort((a, b) => b.netProfit - a.netProfit), [rows]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          year: draft.year ? Number(draft.year) : null,
          operatorMonthlySalary: Number(draft.operatorMonthlySalary || 0),
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) throw new Error(payload.error ?? "Could not save the vehicle");
      setDraft(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the vehicle");
    } finally {
      setBusy(false);
    }
  }

  async function remove(vehicle: VehicleRow) {
    if (!window.confirm(`Delete ${vehicle.code}? Its income, expenses links and salary history will be removed.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/vehicles/${vehicle.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card
          title="Fleet register"
          subtitle={`${vehicles.length} vehicles • sorted by profitability`}
          bodyClassName="p-0"
          action={
            <form className="flex flex-wrap items-end gap-2" action="/vehicles">
              <div>
                <span className="block text-[10px] font-semibold uppercase text-slate-500">From</span>
                <input type="date" name="from" defaultValue={from} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase text-slate-500">To</span>
                <input type="date" name="to" defaultValue={to} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
              </div>
              <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                Apply
              </button>
            </form>
          }
        >
          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No vehicles yet"
                description="Add your first vehicle to start tracking its revenue, running costs and operator salary."
                action={
                  <button
                    type="button"
                    onClick={() => setDraft({ ...EMPTY })}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    + New vehicle
                  </button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Vehicle</Th>
                    <Th>Operator</Th>
                    <Th>Status</Th>
                    <Th align="right">Net revenue</Th>
                    <Th align="right">Direct exp.</Th>
                    <Th align="right">Salary</Th>
                    <Th align="right">Net profit</Th>
                    <Th align="right">Margin</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ranked.map((row) => (
                    <tr key={row.vehicle.id} className="hover:bg-slate-50">
                      <Td>
                        <Link
                          href={`/vehicles/${row.vehicle.id}`}
                          className="font-semibold text-indigo-600 hover:text-indigo-500"
                        >
                          {row.vehicle.code}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {row.vehicle.make} {row.vehicle.model ?? ""} • {row.vehicle.plateNumber}
                        </p>
                      </Td>
                      <Td>{row.vehicle.assignedOperator ?? "—"}</Td>
                      <Td>
                        <Badge
                          className={
                            row.vehicle.status === "active"
                              ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                              : row.vehicle.status === "maintenance"
                                ? "bg-amber-100 text-amber-700 ring-amber-200"
                                : "bg-slate-200 text-slate-600 ring-slate-300"
                          }
                        >
                          {VEHICLE_STATUS_LABELS[row.vehicle.status] ?? row.vehicle.status}
                        </Badge>
                      </Td>
                      <Td align="right">{money(row.netRevenue, currency)}</Td>
                      <Td align="right">{money(row.directExpenses, currency)}</Td>
                      <Td align="right">{money(row.operatorSalary, currency)}</Td>
                      <Td align="right" className={row.netProfit >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-600"}>
                        {money(row.netProfit, currency)}
                      </Td>
                      <Td align="right">{row.margin.toFixed(1)}%</Td>
                      <Td align="right">
                        <div className="flex justify-end gap-3">
                          <Link href={`/vehicles/${row.vehicle.id}`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
                            Open
                          </Link>
                          <a
                            href={`/api/reports/vehicle/${row.vehicle.id}${from || to ? `?from=${from}&to=${to}` : ""}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                          >
                            P&amp;L
                          </a>
                          <button
                            type="button"
                            onClick={() => remove(row.vehicle)}
                            className="text-xs font-semibold text-slate-500 hover:text-rose-600"
                          >
                            Delete
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <Td className="font-semibold text-slate-700">Fleet total</Td>
                    <Td> </Td>
                    <Td> </Td>
                    <Td align="right" className="font-semibold">
                      {money(report.totals.netRevenue, currency)}
                    </Td>
                    <Td align="right" className="font-semibold">
                      {money(report.totals.directExpenses, currency)}
                    </Td>
                    <Td align="right" className="font-semibold">
                      {money(report.totals.operatorSalary, currency)}
                    </Td>
                    <Td align="right" className="font-semibold">
                      {money(report.totals.netProfit, currency)}
                    </Td>
                    <Td align="right" className="font-semibold">
                      {report.totals.margin.toFixed(1)}%
                    </Td>
                    <Td> </Td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>

        <Card title="Fleet analytics" subtitle="Top and bottom performers in the selected period">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: "Best performing", code: report.totals.bestPerformer, tone: "bg-emerald-50 text-emerald-700" },
              { title: "Lowest profit", code: report.totals.worstPerformer, tone: "bg-amber-50 text-amber-700" },
              { title: "Highest cost", code: report.totals.highestCost, tone: "bg-rose-50 text-rose-700" },
            ].map((card) => (
              <div key={card.title} className={`rounded-xl p-4 ${card.tone}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wide">{card.title}</p>
                <p className="mt-1 font-mono text-lg font-bold">{card.code ?? "—"}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2">
            {ranked.map((row) => {
              const max = Math.max(...ranked.map((entry) => Math.abs(entry.netProfit)), 1);
              const width = Math.max(4, (Math.abs(row.netProfit) / max) * 100);
              return (
                <div key={row.vehicle.id} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 font-mono text-xs text-slate-600">{row.vehicle.code}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${row.netProfit >= 0 ? "bg-emerald-500" : "bg-rose-500"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">
                    {money(row.netProfit, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card
        title={draft ? "Vehicle profile" : "New vehicle"}
        subtitle={draft ? "Master data for this asset" : "Add an asset to the fleet register"}
        action={
          draft && (
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          )
        }
      >
        {draft ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={label}>Vehicle ID *</span>
                <input
                  className={field}
                  value={draft.code}
                  placeholder="TRK-004"
                  onChange={(event) => setDraft({ ...draft, code: event.target.value })}
                  required
                />
              </div>
              <div>
                <span className={label}>Plate number *</span>
                <input
                  className={field}
                  value={draft.plateNumber}
                  onChange={(event) => setDraft({ ...draft, plateNumber: event.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={label}>Make *</span>
                <input
                  className={field}
                  value={draft.make}
                  onChange={(event) => setDraft({ ...draft, make: event.target.value })}
                  required
                />
              </div>
              <div>
                <span className={label}>Model</span>
                <input
                  className={field}
                  value={draft.model}
                  onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={label}>Year</span>
                <input
                  type="number"
                  className={field}
                  value={draft.year}
                  onChange={(event) => setDraft({ ...draft, year: event.target.value })}
                />
              </div>
              <div>
                <span className={label}>Status</span>
                <select
                  className={field}
                  value={draft.status}
                  onChange={(event) => setDraft({ ...draft, status: event.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="maintenance">In maintenance</option>
                  <option value="idle">Idle</option>
                  <option value="sold">Sold</option>
                </select>
              </div>
            </div>
            <div>
              <span className={label}>Assigned operator</span>
              <input
                className={field}
                value={draft.assignedOperator}
                onChange={(event) => setDraft({ ...draft, assignedOperator: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={label}>Monthly salary</span>
                <input
                  type="number"
                  step="0.01"
                  className={field}
                  value={draft.operatorMonthlySalary}
                  onChange={(event) => setDraft({ ...draft, operatorMonthlySalary: event.target.value })}
                />
              </div>
              <div>
                <span className={label}>In service since</span>
                <input
                  type="date"
                  className={field}
                  value={draft.purchasedAt}
                  onChange={(event) => setDraft({ ...draft, purchasedAt: event.target.value })}
                />
              </div>
            </div>
            <div>
              <span className={label}>Notes</span>
              <textarea
                rows={2}
                className={field}
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </div>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save vehicle"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setDraft({ ...EMPTY })}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              + New vehicle
            </button>
            <p className="text-xs leading-relaxed text-slate-500">
              Each vehicle keeps its own ledger: revenue booked directly against the asset, direct operating
              expenses attributed from the expense register, and operator salary payments. The per-vehicle
              P&amp;L nets these to a profit and margin figure.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
