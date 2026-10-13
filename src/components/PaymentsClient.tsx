"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Card, EmptyState, StatCard, Td, Th } from "@/components/ui";
import { formatDate, money, todayISO, PAYMENT_METHODS } from "@/lib/domain";
import type { InvoiceRow, PaymentRow } from "@/lib/repo";

type Draft = {
  id: number | null;
  invoiceId: string;
  paymentDate: string;
  amount: string;
  method: string;
  reference: string;
  note: string;
};

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const label = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export function PaymentsClient({
  payments,
  invoices,
  currency,
  from,
  to,
}: {
  payments: PaymentRow[];
  invoices: InvoiceRow[];
  currency: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const openInvoices = useMemo(() => invoices.filter((inv) => inv.outstanding > 0), [invoices]);
  const customersWithBalance = useMemo(() => {
    const map = new Map<number, { id: number; name: string; balance: number }>();
    openInvoices.forEach((inv) => {
      const existing = map.get(inv.customerId);
      if (existing) existing.balance += inv.outstanding;
      else map.set(inv.customerId, { id: inv.customerId, name: inv.customerName, balance: inv.outstanding });
    });
    return [...map.values()].sort((a, b) => b.balance - a.balance);
  }, [openInvoices]);

  const [customerId, setCustomerId] = useState<string>("");
  const customerInvoices = useMemo(
    () => openInvoices.filter((inv) => String(inv.customerId) === customerId),
    [openInvoices, customerId],
  );
  const selectedCustomer = customersWithBalance.find((c) => String(c.id) === customerId) ?? null;

  const totals = useMemo(
    () =>
      payments.reduce(
        (acc, row) => ({ gross: acc.gross + row.amount, vat: acc.vat + row.vatAmount }),
        { gross: 0, vat: 0 },
      ),
    [payments],
  );

  function startCreate() {
    const first = customerId ? customerInvoices[0] : openInvoices[0];
    setDraft({
      id: null,
      invoiceId: first ? String(first.id) : "",
      paymentDate: todayISO(),
      amount: first ? first.outstanding.toFixed(2) : "",
      method: PAYMENT_METHODS[0],
      reference: "",
      note: "",
    });
    setError(null);
  }

  function startEdit(row: PaymentRow) {
    setDraft({
      id: row.id,
      invoiceId: String(row.invoiceId),
      paymentDate: row.paymentDate,
      amount: row.amount.toFixed(2),
      method: row.method,
      reference: row.reference ?? "",
      note: row.note ?? "",
    });
    setError(null);
  }

  function selectedInvoice() {
    const pool = draft?.id ? openInvoices : customerInvoices.length ? customerInvoices : openInvoices;
    return pool.find((inv) => String(inv.id) === draft?.invoiceId) ?? null;
  }

  // The cash-basis VAT element for the amount currently in the form.
  function draftVat() {
    if (!draft) return 0;
    const invoice = selectedInvoice();
    if (!invoice || invoice.total <= 0) return 0;
    const amount = Math.min(Number(draft.amount) || 0, invoice.total);
    return Math.round(((amount * invoice.vatTotal) / invoice.total) * 100) / 100;
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const body = JSON.stringify({
        invoiceId: Number(draft.invoiceId),
        paymentDate: draft.paymentDate,
        amount: Number(draft.amount),
        method: draft.method,
        reference: draft.reference,
        note: draft.note,
      });
      const response = await fetch(draft.id ? `/api/payments/${draft.id}` : "/api/payments", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) throw new Error(payload.error ?? "Could not save the receipt");
      setNotice(draft.id ? "Receipt updated and VAT recalculated." : "Receipt recorded.");
      setDraft(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the receipt");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: PaymentRow) {
    if (!window.confirm(`Delete receipt ${row.receiptNumber}? The invoice balance will be restored.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/payments/${row.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) throw new Error(payload.error ?? "Could not delete the receipt");
      setNotice(`Receipt ${row.receiptNumber} deleted.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the receipt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Receipts in view" value={String(payments.length)} tone="slate" />
        <StatCard label="Cash received" value={money(totals.gross, currency)} tone="emerald" />
        <StatCard label="VAT recognised" value={money(totals.vat, currency)} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <Card
          title={`${payments.length} receipt${payments.length === 1 ? "" : "s"}`}
          subtitle={from || to ? `Filtered ${from || "start"} → ${to || "today"}` : "Most recent 300 receipts"}
          bodyClassName="p-0"
          action={
            <button
              type="button"
              onClick={startCreate}
              disabled={openInvoices.length === 0}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              title={openInvoices.length === 0 ? "No invoices with an outstanding balance" : undefined}
            >
              + Record payment
            </button>
          }
        >
          {payments.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No payments in this view"
                description="Record a payment against an invoice with an outstanding balance to generate a receipt."
                action={
                  <Link
                    href="/invoices?status=balance"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    Invoices with a balance
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="max-h-[34rem] overflow-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <Th>Receipt</Th>
                    <Th>Date received</Th>
                    <Th>Customer</Th>
                    <Th>Invoice</Th>
                    <Th>Method</Th>
                    <Th>Reference</Th>
                    <Th align="right">Gross</Th>
                    <Th align="right">VAT (cash)</Th>
                    <Th align="right">PDF</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <Td>
                        <span className="font-mono text-xs font-semibold">{row.receiptNumber}</span>
                      </Td>
                      <Td>{formatDate(row.paymentDate)}</Td>
                      <Td>
                        <Link href={`/customers/${row.customerId}`} className="hover:text-indigo-600">
                          {row.customerName}
                        </Link>
                      </Td>
                      <Td>
                        <Link href={`/invoices/${row.invoiceId}`} className="hover:text-indigo-600">
                          {row.invoiceNumber}
                        </Link>
                      </Td>
                      <Td>{row.method}</Td>
                      <Td>{row.reference || "—"}</Td>
                      <Td align="right" className="font-semibold">
                        {money(row.amount, currency)}
                      </Td>
                      <Td align="right" className="text-amber-700">
                        {money(row.vatAmount, currency)}
                      </Td>
                      <Td align="right">
                        <a
                          href={`/api/reports/receipt/${row.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                        >
                          Receipt
                        </a>
                      </Td>
                      <Td align="right">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="text-xs font-semibold text-slate-600 hover:text-indigo-600"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(row)}
                            className="text-xs font-semibold text-slate-600 hover:text-rose-600"
                          >
                            Delete
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title={draft?.id ? `Edit receipt` : "Record a payment"}
          subtitle={
            draft?.id
              ? "Amending the amount recalculates the cash-basis VAT"
              : "Partial payments are supported"
          }
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
              <div>
                <span className={label}>Customer *</span>
                <select
                  className={field}
                  value={customerId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setCustomerId(next);
                    const first = openInvoices.find(
                      (inv) => String(inv.customerId) === next && String(inv.id) !== draft.invoiceId,
                    );
                    setDraft({
                      ...draft,
                      invoiceId: first ? String(first.id) : "",
                      amount: first ? first.outstanding.toFixed(2) : "",
                    });
                  }}
                  disabled={Boolean(draft.id)}
                  required
                >
                  <option value="">Select a customer…</option>
                  {customersWithBalance.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} — {money(customer.balance, currency)} pending
                    </option>
                  ))}
                </select>
                {selectedCustomer && !draft.id && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Pending balance:{" "}
                    <span className="font-semibold text-rose-600">
                      {money(selectedCustomer.balance, currency)}
                    </span>{" "}
                    across {customerInvoices.length} open invoice
                    {customerInvoices.length === 1 ? "" : "s"}
                  </p>
                )}
                {draft.id && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    The customer and invoice cannot be changed when editing a receipt.
                  </p>
                )}
              </div>
              <div>
                <span className={label}>Pending invoice *</span>
                <select
                  className={field}
                  value={draft.invoiceId}
                  onChange={(event) => {
                    const next = event.target.value;
                    const invoice = openInvoices.find((inv) => String(inv.id) === next);
                    setDraft({
                      ...draft,
                      invoiceId: next,
                      amount: invoice ? invoice.outstanding.toFixed(2) : draft.amount,
                    });
                  }}
                  disabled={Boolean(draft.id)}
                  required
                >
                  <option value="">
                    {customerId ? "Select an invoice…" : "Select a customer first"}
                  </option>
                  {(customerId ? customerInvoices : openInvoices).map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} — {money(invoice.outstanding, invoice.currency)} due (
                      {invoice.status})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={label}>Amount received *</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={field}
                    value={draft.amount}
                    onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <span className={label}>Date received *</span>
                  <input
                    type="date"
                    className={field}
                    value={draft.paymentDate}
                    onChange={(event) => setDraft({ ...draft, paymentDate: event.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <span className={label}>Payment method</span>
                <select
                  className={field}
                  value={draft.method}
                  onChange={(event) => setDraft({ ...draft, method: event.target.value })}
                >
                  {PAYMENT_METHODS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={label}>Reference</span>
                <input
                  className={field}
                  value={draft.reference}
                  placeholder="Bank / cheque reference"
                  onChange={(event) => setDraft({ ...draft, reference: event.target.value })}
                />
              </div>
              <div>
                <span className={label}>Note</span>
                <input
                  className={field}
                  value={draft.note}
                  onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">VAT recognised on this receipt</span>
                  <span className="font-semibold tabular-nums text-amber-700">
                    {money(draftVat(), currency)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                  <span>Net receipt</span>
                  <span className="tabular-nums">
                    {money((Number(draft.amount) || 0) - draftVat(), currency)}
                  </span>
                </div>
              </div>
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {busy ? "Saving…" : draft.id ? "Save changes" : "Record payment & issue receipt"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={startCreate}
                disabled={openInvoices.length === 0}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                + Record payment
              </button>
              {openInvoices.length === 0 && (
                <p className="text-[11px] text-slate-500">
                  There are no invoices with an outstanding balance to record a payment against.
                </p>
              )}
              {notice && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>
              )}
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
              <p className="text-xs leading-relaxed text-slate-500">
                Every receipt stores its own VAT snapshot, so editing or deleting one immediately
                corrects the cash-basis VAT on your return.
              </p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
