"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { money, todayISO, VAT_METHODS } from "@/lib/domain";

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const label = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export function PaymentForm({
  invoiceId,
  invoiceNumber,
  outstanding,
  currency,
}: {
  invoiceId: number;
  invoiceNumber: string;
  outstanding: number;
  currency: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(outstanding > 0 ? outstanding.toFixed(2) : ""));
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [method, setMethod] = useState<string>(VAT_METHODS[0]);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ receiptNumber: string; vatAmount: number; url: string } | null>(null);

  const settled = outstanding <= 0;

  async function submit() {
    setBusy(true);
    setError(null);
    setReceipt(null);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          paymentDate,
          amount: Number(amount),
          method,
          reference,
          note,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { payment: { receiptNumber: string; vatAmount: number }; receiptPath: string };
      };
      if (!payload.ok || !payload.data) throw new Error(payload.error ?? "Could not record payment");
      setReceipt({
        receiptNumber: payload.data.payment.receiptNumber,
        vatAmount: payload.data.payment.vatAmount,
        url: payload.data.receiptPath,
      });
      setReference("");
      setNote("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className={label}>Amount received *</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className={field}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={settled}
            required
          />
        </div>
        <div>
          <span className={label}>Date received *</span>
          <input
            type="date"
            className={field}
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
            disabled={settled}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className={label}>Method</span>
          <select className={field} value={method} onChange={(event) => setMethod(event.target.value)} disabled={settled}>
            {VAT_METHODS.map((option) => (
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
            value={reference}
            placeholder="Bank / cheque reference"
            onChange={(event) => setReference(event.target.value)}
            disabled={settled}
          />
        </div>
      </div>
      <div>
        <span className={label}>Note</span>
        <input
          className={field}
          value={note}
          placeholder="Optional note stored with the receipt"
          onChange={(event) => setNote(event.target.value)}
          disabled={settled}
        />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {[0.25, 0.5, 1].map((fraction) => (
          <button
            key={fraction}
            type="button"
            disabled={settled}
            onClick={() => setAmount((outstanding * fraction).toFixed(2))}
            className="rounded-full border border-slate-300 px-3 py-1 font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40"
          >
            {fraction === 1 ? "Full balance" : `${fraction * 100}% part payment`}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      {receipt && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          <p className="font-semibold">
            Receipt {receipt.receiptNumber} generated for {invoiceNumber}.
          </p>
          <p className="mt-0.5">
            VAT recognised on this receipt: {money(receipt.vatAmount, currency)} (cash basis).
          </p>
          <a
            href={receipt.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block font-semibold text-emerald-900 underline"
          >
            Open receipt PDF →
          </a>
        </div>
      )}

      <button
        type="submit"
        disabled={busy || settled}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {settled ? "Invoice fully settled" : busy ? "Posting…" : "Record payment & issue receipt"}
      </button>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Partial payments are supported — the receipt stores the VAT element for the cash received only.
      </p>
    </form>
  );
}

export function InvoiceActions({ invoiceId, status }: { invoiceId: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: string, body?: string) {
    setBusy(true);
    try {
      await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void call(`/api/invoices/${invoiceId}`, "PATCH", JSON.stringify({ status: status === "void" ? "open" : "void" }))
        }
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
      >
        {status === "void" ? "Restore invoice" : "Void invoice"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm("Delete this invoice, its line items and any payments? This cannot be undone.")) {
            void call(`/api/invoices/${invoiceId}`, "DELETE").then(() => router.push("/invoices"));
          }
        }}
        className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}
