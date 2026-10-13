"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { Badge, Card, EmptyState, StatCard, Td, Th } from "@/components/ui";
import { FIXED_VAT_RATE, formatDate, money, todayISO } from "@/lib/domain";
import type { ExpenseCategory, ExpenseRow } from "@/lib/expenses";
import type { VehicleRow } from "@/lib/fleet";

type Draft = {
  expenseDate: string;
  vendorName: string;
  vendorTaxId: string;
  vendorInvoiceRef: string;
  description: string;
  categoryId: string;
  type: "direct" | "indirect";
  vehicleId: string;
  netAmount: string;
  paymentMethod: string;
  notes: string;
};

const EMPTY: Draft = {
  expenseDate: todayISO(),
  vendorName: "",
  vendorTaxId: "",
  vendorInvoiceRef: "",
  description: "",
  categoryId: "",
  type: "direct",
  vehicleId: "",
  netAmount: "",
  paymentMethod: "Bank transfer",
  notes: "",
};

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const label = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export function ExpensesClient({
  expenses,
  categories,
  vehicles,
  currency,
  typeFilter,
}: {
  expenses: ExpenseRow[];
  categories: ExpenseCategory[];
  vehicles: VehicleRow[];
  currency: string;
  typeFilter: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => (typeFilter === "all" ? expenses : expenses.filter((row) => row.type === typeFilter)),
    [expenses, typeFilter],
  );

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, row) => ({
          net: acc.net + row.netAmount,
          vat: acc.vat + row.vatAmount,
          gross: acc.gross + row.grossAmount,
        }),
        { net: 0, vat: 0, gross: 0 },
      ),
    [filtered],
  );

  async function submit() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("expenseDate", draft.expenseDate);
      body.set("vendorName", draft.vendorName);
      body.set("vendorTaxId", draft.vendorTaxId);
      body.set("vendorInvoiceRef", draft.vendorInvoiceRef);
      body.set("description", draft.description);
      body.set("categoryId", draft.categoryId);
      body.set("type", draft.type);
      body.set("vehicleId", draft.vehicleId);
      body.set("netAmount", draft.netAmount);
      body.set("vatRate", String(FIXED_VAT_RATE));
      body.set("paymentMethod", draft.paymentMethod);
      body.set("notes", draft.notes);
      const file = fileRef.current?.files?.[0];
      if (file) body.set("attachment", file);

      const response = await fetch("/api/expenses", { method: "POST", body });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) throw new Error(payload.error ?? "Could not save the expense");
      setDraft(null);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      setNotice("Expense recorded and input VAT captured.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the expense");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: ExpenseRow) {
    if (!window.confirm(`Delete expense ${row.expenseNumber}?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/expenses/${row.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) throw new Error(payload.error ?? "Could not delete the expense");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the expense");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Net expenses (view)" value={money(totals.net, currency)} tone="indigo" />
        <StatCard label="Input VAT claimable" value={money(totals.vat, currency)} tone="emerald" hint={`Fixed ${FIXED_VAT_RATE}%`} />
        <StatCard label="Gross paid" value={money(totals.gross, currency)} tone="slate" hint={`${filtered.length} entries`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card
          title={`${filtered.length} expense${filtered.length === 1 ? "" : "s"}`}
          subtitle="Direct = vehicle & operating costs, Indirect = admin & overheads"
          bodyClassName="p-0"
          action={
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "all", text: "All" },
                { key: "direct", text: "Direct" },
                { key: "indirect", text: "Indirect" },
              ].map((option) => (
                <Link
                  key={option.key}
                  href={option.key === "all" ? "/expenses" : `/expenses?type=${option.key}`}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ring-inset transition ${
                    typeFilter === option.key
                      ? "bg-slate-900 text-white ring-slate-900"
                      : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {option.text}
                </Link>
              ))}
            </div>
          }
        >
          {filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No expenses recorded"
                description="Log a purchase invoice to claim back its input VAT on your next return."
                action={
                  <button
                    type="button"
                    onClick={() => setDraft({ ...EMPTY })}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    + New expense
                  </button>
                }
              />
            </div>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <Th>Ref</Th>
                    <Th>Date</Th>
                    <Th>Vendor</Th>
                    <Th>Description</Th>
                    <Th>Category</Th>
                    <Th>Vehicle</Th>
                    <Th align="right">Net</Th>
                    <Th align="right">Input VAT</Th>
                    <Th align="right">Gross</Th>
                    <Th align="right">Receipt</Th>
                    <Th align="right">—</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <Td>
                        <span className="font-mono text-xs">{row.expenseNumber}</span>
                      </Td>
                      <Td>{formatDate(row.expenseDate)}</Td>
                      <Td>
                        <span className="font-medium text-slate-800">{row.vendorName}</span>
                        <p className="font-mono text-[10px] text-slate-500">{row.vendorTaxId || row.vendorInvoiceRef || "—"}</p>
                      </Td>
                      <Td className="max-w-[12rem] whitespace-normal">{row.description}</Td>
                      <Td>
                        <Badge
                          className={
                            row.type === "direct"
                              ? "bg-sky-100 text-sky-700 ring-sky-200"
                              : "bg-violet-100 text-violet-700 ring-violet-200"
                          }
                        >
                          {row.categoryName ?? row.type}
                        </Badge>
                      </Td>
                      <Td>
                        {row.vehicleId ? (
                          <Link href={`/vehicles/${row.vehicleId}`} className="font-mono text-xs text-indigo-600 hover:text-indigo-500">
                            {row.vehicleCode}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </Td>
                      <Td align="right">{money(row.netAmount, currency)}</Td>
                      <Td align="right" className="text-emerald-700">
                        {money(row.vatAmount, currency)}
                      </Td>
                      <Td align="right" className="font-semibold">
                        {money(row.grossAmount, currency)}
                      </Td>
                      <Td align="right">
                        {row.hasAttachment ? (
                          <a
                            href={`/api/expenses/${row.id}/attachment`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </Td>
                      <Td align="right">
                        <button
                          type="button"
                          onClick={() => remove(row)}
                          className="text-xs font-semibold text-slate-500 hover:text-rose-600"
                        >
                          Delete
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title={draft ? "Record an expense" : "New expense"}
          subtitle="Vendor invoice details, category and receipt image"
          action={
            draft && (
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setFileName(null);
                }}
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
                void submit();
              }}
            >
              <div className="flex gap-2">
                {(["direct", "indirect"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDraft({ ...draft, type: option, vehicleId: option === "indirect" ? "" : draft.vehicleId })}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ring-1 ring-inset transition ${
                      draft.type === option
                        ? "bg-slate-900 text-white ring-slate-900"
                        : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {option === "direct" ? "Direct expense" : "Indirect expense"}
                  </button>
                ))}
              </div>
              <div>
                <span className={label}>Vendor / supplier *</span>
                <input
                  className={field}
                  value={draft.vendorName}
                  onChange={(event) => setDraft({ ...draft, vendorName: event.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={label}>Vendor tax ID</span>
                  <input
                    className={field}
                    value={draft.vendorTaxId}
                    onChange={(event) => setDraft({ ...draft, vendorTaxId: event.target.value })}
                  />
                </div>
                <div>
                  <span className={label}>Vendor invoice #</span>
                  <input
                    className={field}
                    value={draft.vendorInvoiceRef}
                    onChange={(event) => setDraft({ ...draft, vendorInvoiceRef: event.target.value })}
                  />
                </div>
              </div>
              <div>
                <span className={label}>Description *</span>
                <input
                  className={field}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={label}>Category</span>
                  <select
                    className={field}
                    value={draft.categoryId}
                    onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
                  >
                    <option value="">Uncategorised</option>
                    {categories
                      .filter((category) => category.type === draft.type)
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <span className={label}>Expense date</span>
                  <input
                    type="date"
                    className={field}
                    value={draft.expenseDate}
                    onChange={(event) => setDraft({ ...draft, expenseDate: event.target.value })}
                    required
                  />
                </div>
              </div>
              {draft.type === "direct" && (
                <div>
                  <span className={label}>Attribute to vehicle</span>
                  <select
                    className={field}
                    value={draft.vehicleId}
                    onChange={(event) => setDraft({ ...draft, vehicleId: event.target.value })}
                  >
                    <option value="">Not vehicle specific</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.code} — {vehicle.make} {vehicle.model ?? ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={label}>Net amount *</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={field}
                    value={draft.netAmount}
                    onChange={(event) => setDraft({ ...draft, netAmount: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <span className={label}>Input VAT ({FIXED_VAT_RATE}%)</span>
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold tabular-nums text-emerald-700">
                    {money((Number(draft.netAmount) || 0) * (FIXED_VAT_RATE / 100), currency)}
                  </p>
                </div>
              </div>
              <div>
                <span className={label}>Payment method</span>
                <select
                  className={field}
                  value={draft.paymentMethod}
                  onChange={(event) => setDraft({ ...draft, paymentMethod: event.target.value })}
                >
                  {["Bank transfer", "Cash", "Credit card", "Cheque", "Fuel card"].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={label}>Receipt / invoice image</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
                  className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                />
                {fileName && <p className="mt-1 text-[11px] text-slate-500">Attached: {fileName}</p>}
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
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save expense"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setDraft({ ...EMPTY })}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                + New expense
              </button>
              {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}
              <p className="text-xs leading-relaxed text-slate-500">
                Every expense captures its input VAT at the fixed {FIXED_VAT_RATE}% rate, which is then deducted
                from your output VAT on the VAT return. Direct expenses can be attributed to a vehicle so they
                flow into that vehicle&apos;s P&amp;L.
              </p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
