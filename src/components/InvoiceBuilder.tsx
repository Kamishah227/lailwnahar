"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui";
import {
  computeTotals,
  dueDateFromTerms,
  EQUIPMENT_OPTIONS,
  FIXED_VAT_RATE,
  formatDate,
  money,
  PAYMENT_TERMS,
  normaliseRatePer,
  RATE_PER_OPTIONS,
  round2,
  termsLabel,
  todayISO,
  type RatePer,
} from "@/lib/domain";
import type { CustomerRow, InvoiceDetail, SettingsDto } from "@/lib/repo";

export const HOURS_PER_MONTH = 260;

type Row = {
  key: string;
  description: string;
  subDescription: string;
  periodStart: string;
  periodEnd: string;
  ratePer: RatePer;
  quantity: number;
  monthlyRate: string;
  unitPrice: string;
  unitPriceOverridden: boolean;
};

/** 
 * When rate-per-hour is selected and a monthly rate is provided, 
 * automatically compute unit price using 260 standard working hours per month.
 */
function effectiveUnitPrice(row: Row): number {
  if (row.ratePer === "Per Hour" && !row.unitPriceOverridden) {
    const monthly = Number(row.monthlyRate);
    if (row.monthlyRate !== "" && Number.isFinite(monthly) && monthly > 0) {
      return monthly / HOURS_PER_MONTH;
    }
  }
  return Number(row.unitPrice) || 0;
}

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const label = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

function newRow(): Row {
  return {
    key: crypto.randomUUID(),
    description: "",
    subDescription: "",
    periodStart: "",
    periodEnd: "",
    ratePer: "Per Trip",
    quantity: 1,
    monthlyRate: "",
    unitPrice: "",
    unitPriceOverridden: false,
  };
}

export function InvoiceBuilder({
  customers,
  settings,
  presetCustomerId,
  invoice,
}: {
  customers: CustomerRow[];
  settings: SettingsDto;
  presetCustomerId?: number;
  invoice?: InvoiceDetail;
}) {
  const router = useRouter();
  const isEdit = Boolean(invoice);
  const linesLocked = Boolean(invoice && invoice.payments.length > 0);

  const [customerId, setCustomerId] = useState<string>(
    invoice ? String(invoice.customerId) : presetCustomerId ? String(presetCustomerId) : customers[0] ? String(customers[0].id) : "",
  );
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? todayISO());
  const [paymentTerms, setTerms] = useState<string>(invoice?.paymentTerms ?? "30");
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? "");
  const [poNumber, setPoNumber] = useState(invoice?.poNumber ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  
  const [rows, setRows] = useState<Row[]>(
    invoice && invoice.items.length > 0
      ? invoice.items.map((item) => ({
          key: crypto.randomUUID(),
          description: item.description,
          subDescription: item.subDescription ?? "",
          periodStart: item.periodStart ?? "",
          periodEnd: item.periodEnd ?? "",
          ratePer: normaliseRatePer(item.ratePer),
          quantity: Number(item.quantity) || 0,
          monthlyRate: "",
          unitPrice: (Number(item.unitPrice) || 0).toFixed(4),
          unitPriceOverridden: true,
        }))
      : [newRow()],
  );
  
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dueDateAuto = dueDate || dueDateFromTerms(issueDate, paymentTerms);

  const totals = useMemo(
    () =>
      linesLocked
        ? {
            lines: [],
            subtotal: invoice!.subtotal,
            vatTotal: invoice!.vatTotal,
            total: invoice!.total,
            effectiveVatRate: FIXED_VAT_RATE,
          }
        : computeTotals(
            rows.map((row) => ({
              description: row.description,
              subDescription: row.subDescription,
              periodStart: row.periodStart,
              periodEnd: row.periodEnd,
              ratePer: row.ratePer,
              quantity: Number(row.quantity) || 0,
              unitPrice: effectiveUnitPrice(row),
              vatRate: FIXED_VAT_RATE,
            })),
          ),
    [rows, linesLocked, invoice],
  );

  function patch(key: string, changes: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  function onMonthlyRate(key: string, raw: string) {
    if (raw.trim() === "") {
      patch(key, { monthlyRate: "" });
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      patch(key, { monthlyRate: raw });
      return;
    }
    // Automatically sets quantity to 260 and divides monthly rate by 260 for unit price
    patch(key, {
      monthlyRate: raw,
      unitPrice: (value / HOURS_PER_MONTH).toFixed(4),
      quantity: HOURS_PER_MONTH,
      unitPriceOverridden: false,
    });
  }

  function monthlyCheck(row: Row) {
    const monthly = Number(row.monthlyRate) || 0;
    const unit = effectiveUnitPrice(row);
    const qty = Number(row.quantity) || 0;
    const product = round2(unit * qty);
    const difference = round2(product - monthly);
    return {
      monthly,
      unit,
      qty,
      product,
      difference,
      matches: Math.abs(difference) < 0.005,
    };
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const items = linesLocked
        ? invoice!.items.map((item) => ({
            description: item.description,
            subDescription: item.subDescription,
            periodStart: item.periodStart || null,
            periodEnd: item.periodEnd || null,
            ratePer: item.ratePer,
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            vatRate: FIXED_VAT_RATE,
          }))
        : rows.map((row) => ({
            description: row.description,
            subDescription: row.subDescription,
            periodStart: row.periodStart || null,
            periodEnd: row.periodEnd || null,
            ratePer: row.ratePer,
            quantity: Number(row.quantity) || 0,
            unitPrice: effectiveUnitPrice(row),
            vatRate: FIXED_VAT_RATE,
          }));

      const response = await fetch(isEdit ? `/api/invoices/${invoice!.id}` : "/api/invoices", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(customerId),
          issueDate,
          dueDate: dueDate || null,
          paymentTerms,
          poNumber,
          notes,
          currency: invoice?.currency ?? settings.currency,
          items,
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; data?: { id: number } };
      if (!payload.ok || !payload.data) throw new Error(payload.error ?? "Could not save invoice");
      router.push(`/invoices/${payload.data.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save invoice");
      setBusy(false);
    }
  }

  async function remove() {
    if (!invoice) return;
    if (!window.confirm(`Delete invoice ${invoice.invoiceNumber} with its items and payments?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) throw new Error(payload.error ?? "Could not delete the invoice");
      router.push("/invoices");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the invoice");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
      <Card
        title={linesLocked ? "Line items (locked)" : "Line items"}
        subtitle={
          linesLocked
            ? `${invoice!.payments.length} receipt(s) posted — delete the receipts first to edit the lines`
            : "Rate per hour / day / month / trip — a monthly rate auto-fills the unit price (÷ 260) and VAT is fixed at 5%"
        }
      >
        {linesLocked ? (
          <div className="overflow-x-auto rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-900">
              Line items are locked because payments have been recorded
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
              Editing the lines would change the VAT already declared on those receipts. You can still
              amend the customer, dates, payment terms, PO reference and notes on the right.
            </p>
            <table className="mt-3 w-full text-xs">
              <tbody className="divide-y divide-amber-200">
                {invoice!.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-1.5 pr-2">
                      <span className="font-medium text-slate-800">{item.description}</span>
                      {item.subDescription && (
                        <span className="block text-[10px] text-slate-500">{item.subDescription}</span>
                      )}
                      {(item.periodStart || item.periodEnd) && (
                        <span className="block text-[10px] font-medium text-indigo-500">
                          Period: {item.periodStart || "-"} to {item.periodEnd || "-"}
                        </span>
                      )}
                    </td>
                    <td className="w-16 py-1.5 text-right text-slate-600">{item.ratePer}</td>
                    <td className="w-16 py-1.5 text-right text-slate-600">{item.quantity.toFixed(2)}</td>
                    <td className="w-24 py-1.5 text-right font-semibold text-slate-800">
                      {money(item.lineGross, invoice!.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row, index) => {
              const line = totals.lines[index];
              return (
                <div key={row.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="grid flex-1 gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-7">
                        <span className={label}>Description * (pick or type your own)</span>
                        <input
                          className={field}
                          value={row.description}
                          list="equipment-catalogue"
                          placeholder="e.g. Hiring charges of JCB 3CX"
                          onChange={(event) => patch(row.key, { description: event.target.value })}
                        />
                        <datalist id="equipment-catalogue">
                          {EQUIPMENT_OPTIONS.map((option) => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                      </div>
                      <div className="sm:col-span-5">
                        <span className={label}>Sub-description</span>
                        <input
                          className={field}
                          value={row.subDescription}
                          placeholder="e.g. Site B — night shift"
                          onChange={(event) => patch(row.key, { subDescription: event.target.value })}
                        />
                      </div>
                      
                      <div className="sm:col-span-2">
                        <span className={label}>From</span>
                        <input
                          type="date"
                          className={field}
                          value={row.periodStart}
                          onChange={(event) => patch(row.key, { periodStart: event.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <span className={label}>To</span>
                        <input
                          type="date"
                          className={field}
                          value={row.periodEnd}
                          onChange={(event) => patch(row.key, { periodEnd: event.target.value })}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <span className={label}>Rate per *</span>
                        <select
                          className={field}
                          value={row.ratePer}
                          onChange={(event) => patch(row.key, { ratePer: event.target.value as RatePer })}
                        >
                          {RATE_PER_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <span className={label}>Qty</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className={field}
                          value={row.quantity}
                          onChange={(event) => {
                            const newQty = Number(event.target.value);
                            patch(row.key, { quantity: newQty, unitPriceOverridden: true });
                          }}
                        />
                      </div>
                      
                      {row.ratePer === "Per Hour" && (
                        <div className="sm:col-span-2">
                          <span className={label}>Monthly rate</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className={field}
                            value={row.monthlyRate}
                            placeholder="e.g. 7500"
                            onChange={(event) => onMonthlyRate(row.key, event.target.value)}
                          />
                        </div>
                      )}
                      
                      <div className={row.ratePer === "Per Hour" ? "sm:col-span-2" : "sm:col-span-4"}>
                        <span className={label}>Unit price</span>
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          className={field}
                          value={row.unitPrice}
                          onChange={(event) =>
                            patch(row.key, { unitPrice: event.target.value, unitPriceOverridden: true })
                          }
                        />
                        {row.ratePer === "Per Hour" && row.monthlyRate !== "" && Number(row.monthlyRate) > 0 && (
                            <p className="mt-1 truncate text-[10px] font-medium text-indigo-500">
                              {Number(row.monthlyRate).toLocaleString()} ÷ {HOURS_PER_MONTH} · qty {HOURS_PER_MONTH}
                            </p>
                        )}
                      </div>

                      <div className="sm:col-span-3 grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <span className={label}>VAT</span>
                          <div className="flex h-[38px] items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-sm font-semibold tabular-nums text-slate-500">
                            {FIXED_VAT_RATE}%
                          </div>
                        </div>
                        <div className="col-span-2">
                          <span className={label}>Net</span>
                          <p className="truncate rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold tabular-nums text-slate-900">
                            {money(line?.lineNet ?? 0, invoice?.currency ?? settings.currency)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-end sm:col-span-1">
                        <button
                          type="button"
                          onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                          disabled={rows.length === 1}
                          title="Remove line"
                          className="flex h-[38px] w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-40"
                        >
                          ✕
                        </button>
                      </div>
                      
                      {row.ratePer === "Per Hour" &&
                        row.monthlyRate !== "" &&
                        Number(row.monthlyRate) > 0 &&
                        (() => {
                          const check = monthlyCheck(row);
                          return (
                            <p className={`sm:col-span-12 mt-2 rounded-lg px-3 py-1.5 text-[11px] font-medium ${check.matches ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                              {check.qty.toLocaleString()} h at {check.unit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                              /h · line total {check.product.toLocaleString(undefined, { minimumFractionDigits: 2 })} · monthly rate {check.monthly.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              {check.matches ? " — matches" : ` (difference ${check.difference.toFixed(2)})`}
                            </p>
                          );
                        })()}
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setRows((current) => [...current, newRow()])}
              className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600"
            >
              + Add line item
            </button>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quick add</span>
              {EQUIPMENT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRows((current) => [...current, { ...newRow(), description: option }])}
                  className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-6">
        <Card title="Invoice details" subtitle={`VAT is fixed at ${FIXED_VAT_RATE}% on every line`}>
          <div className="space-y-3">
            <div>
              <span className={label}>Customer *</span>
              <select className={field} value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">Select a customer…</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>
            <div>
              <span className={label}>Issue date</span>
              <input type="date" className={field} value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
            </div>
            <div>
              <span className={label}>Payment terms *</span>
              <select
                className={field}
                value={paymentTerms}
                onChange={(event) => {
                  setTerms(event.target.value);
                  setDueDate(dueDateFromTerms(issueDate, event.target.value));
                }}
              >
                {PAYMENT_TERMS.map((option) => (
                  <option key={option} value={option}>
                    {option === "Cash" ? "Cash — due on receipt" : `Net ${option} days`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Due date ({termsLabel(paymentTerms)})
                </p>
                <p className="text-xs text-slate-500">Derived from issue date + terms</p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{formatDate(dueDateAuto)}</p>
            </div>
            <div>
              <span className={label}>PO / reference</span>
              <input className={field} value={poNumber} onChange={(event) => setPoNumber(event.target.value)} />
            </div>
            <div>
              <span className={label}>Notes</span>
              <textarea rows={3} className={field} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
        </Card>

        <Card title="Summary" subtitle={isEdit ? `Editing ${invoice!.invoiceNumber}` : `Next number: ${settings.invoicePrefix}${String(settings.nextInvoiceNumber).padStart(4, "0")}`}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Net total</dt>
              <dd className="font-semibold tabular-nums">{money(totals.subtotal, invoice?.currency ?? settings.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">VAT @ {FIXED_VAT_RATE}%</dt>
              <dd className="font-semibold tabular-nums">{money(totals.vatTotal, invoice?.currency ?? settings.currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
              <dt className="font-semibold text-slate-700">Invoice total</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{money(totals.total, invoice?.currency ?? settings.currency)}</dd>
            </div>
            {isEdit && (
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <dt className="text-slate-500">Balance outstanding</dt>
                <dd className="font-semibold tabular-nums text-rose-600">{money(invoice!.outstanding, invoice!.currency)}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
            A fixed {FIXED_VAT_RATE}% VAT rate is applied to every line. Under the cash-accounting scheme none
            of this VAT is declared until a payment is received against this invoice.
          </p>
          {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          {notice && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={busy || !customerId}
            className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Saving…" : isEdit ? "Save changes" : "Save invoice"}
          </button>
          {isEdit && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => router.push(`/invoices/${invoice!.id}`)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="flex-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-50"
              >
                Delete invoice
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}