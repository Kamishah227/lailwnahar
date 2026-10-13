"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card } from "@/components/ui";
import { FIXED_VAT_RATE, todayISO } from "@/lib/domain";

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const label = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

type IncomeDraft = {
  incomeDate: string;
  description: string;
  customerName: string;
  invoiceNumber: string;
  ratePer: string;
  quantity: string;
  unitPrice: string;
};

type SalaryDraft = {
  operatorName: string;
  periodLabel: string;
  paymentDate: string;
  amount: string;
};

export function VehicleDetailClient({
  vehicleId,
  currency,
  from,
  to,
  defaultOperator,
  defaultSalary,
}: {
  vehicleId: number;
  currency: string;
  from: string;
  to: string;
  defaultOperator?: string | null;
  defaultSalary?: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"income" | "salary">("income");
  const [income, setIncome] = useState<IncomeDraft>({
    incomeDate: todayISO(),
    description: "",
    customerName: "",
    invoiceNumber: "",
    ratePer: "Trip",
    quantity: "1",
    unitPrice: "",
  });
  const [salary, setSalary] = useState<SalaryDraft>({
    operatorName: defaultOperator ?? "",
    periodLabel: todayISO().slice(0, 7),
    paymentDate: todayISO(),
    amount: defaultSalary ? String(defaultSalary) : "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const netAmount = (Number(income.quantity) || 0) * (Number(income.unitPrice) || 0);
  const vatAmount = netAmount * (FIXED_VAT_RATE / 100);

  async function post(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/fleet/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) throw new Error(payload.error ?? "Could not save the entry");
      setNotice(message);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the entry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Record against this vehicle"
      subtitle="Revenue booked directly to the asset, or an operator salary payment"
      action={
        <div className="flex gap-1.5">
          {(["income", "salary"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTab(option)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ring-inset transition ${
                tab === option
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {option === "income" ? "Monthly income" : "Operator salary"}
            </button>
          ))}
        </div>
      }
    >
      {tab === "income" ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void post(
              {
                kind: "income",
                vehicleId,
                incomeDate: income.incomeDate,
                description: income.description,
                customerName: income.customerName,
                invoiceNumber: income.invoiceNumber,
                ratePer: income.ratePer,
                quantity: Number(income.quantity) || 0,
                unitPrice: Number(income.unitPrice) || 0,
                vatRate: FIXED_VAT_RATE,
              },
              "Revenue recorded.",
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={label}>Description *</span>
              <input
                className={field}
                value={income.description}
                placeholder="e.g. Trunk route haulage"
                onChange={(event) => setIncome({ ...income, description: event.target.value })}
                required
              />
            </div>
            <div>
              <span className={label}>Date *</span>
              <input
                type="date"
                className={field}
                value={income.incomeDate}
                onChange={(event) => setIncome({ ...income, incomeDate: event.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <span className={label}>Customer</span>
              <input
                className={field}
                value={income.customerName}
                onChange={(event) => setIncome({ ...income, customerName: event.target.value })}
              />
            </div>
            <div>
              <span className={label}>Rate per</span>
              <select
                className={field}
                value={income.ratePer}
                onChange={(event) => setIncome({ ...income, ratePer: event.target.value })}
              >
                {["Trip", "Hour", "Day", "Month"].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={label}>Invoice ref</span>
              <input
                className={field}
                value={income.invoiceNumber}
                onChange={(event) => setIncome({ ...income, invoiceNumber: event.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <span className={label}>Quantity *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className={field}
                value={income.quantity}
                onChange={(event) => setIncome({ ...income, quantity: event.target.value })}
                required
              />
            </div>
            <div>
              <span className={label}>Rate *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className={field}
                value={income.unitPrice}
                onChange={(event) => setIncome({ ...income, unitPrice: event.target.value })}
                required
              />
            </div>
            <div>
              <span className={label}>Net / VAT @ {FIXED_VAT_RATE}%</span>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold tabular-nums text-slate-700">
                {netAmount.toFixed(2)} / {vatAmount.toFixed(2)} {currency}
              </p>
            </div>
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Record revenue"}
          </button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void post(
              {
                kind: "salary",
                vehicleId,
                operatorName: salary.operatorName,
                periodLabel: salary.periodLabel,
                paymentDate: salary.paymentDate,
                amount: Number(salary.amount) || 0,
              },
              "Operator salary recorded.",
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={label}>Operator *</span>
              <input
                className={field}
                value={salary.operatorName}
                onChange={(event) => setSalary({ ...salary, operatorName: event.target.value })}
                required
              />
            </div>
            <div>
              <span className={label}>Period (YYYY-MM)</span>
              <input
                className={field}
                value={salary.periodLabel}
                onChange={(event) => setSalary({ ...salary, periodLabel: event.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={label}>Payment date *</span>
              <input
                type="date"
                className={field}
                value={salary.paymentDate}
                onChange={(event) => setSalary({ ...salary, paymentDate: event.target.value })}
                required
              />
            </div>
            <div>
              <span className={label}>Amount *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className={field}
                value={salary.amount}
                onChange={(event) => setSalary({ ...salary, amount: event.target.value })}
                required
              />
            </div>
          </div>
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Record salary payment"}
          </button>
        </form>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        Date range currently applied to the ledgers below: {from || "all time"} → {to || "today"}.
      </p>
    </Card>
  );
}
