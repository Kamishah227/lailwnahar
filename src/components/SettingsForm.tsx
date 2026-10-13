"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card } from "@/components/ui";
import type { SettingsDto } from "@/lib/repo";

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const label = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "CAD", "AUD", "ZAR", "NGN", "KES"];

export function SettingsForm({ settings }: { settings: SettingsDto }) {
  const router = useRouter();
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) throw new Error(payload.error ?? "Could not save settings");
      setMessage({ tone: "ok", text: "Settings saved." });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: "error",
        text: caught instanceof Error ? caught.message : "Could not save settings",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Business identity" subtitle="Printed on every invoice, receipt and statement">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div>
            <span className={label}>Business name</span>
            <input
              className={field}
              value={draft.businessName}
              onChange={(event) => setDraft({ ...draft, businessName: event.target.value })}
            />
          </div>
          <div>
            <span className={label}>Address</span>
            <textarea
              rows={3}
              className={field}
              value={draft.businessAddress}
              onChange={(event) => setDraft({ ...draft, businessAddress: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>VAT / tax number</span>
              <input
                className={field}
                value={draft.vatNumber}
                onChange={(event) => setDraft({ ...draft, vatNumber: event.target.value })}
              />
            </div>
            <div>
              <span className={label}>Currency</span>
              <select
                className={field}
                value={draft.currency}
                onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>Default VAT rate (%)</span>
              <input
                type="number"
                step="0.5"
                className={field}
                value={draft.defaultVatRate}
                onChange={(event) => setDraft({ ...draft, defaultVatRate: Number(event.target.value) })}
              />
            </div>
            <div>
              <span className={label}>VAT scheme</span>
              <select
                className={field}
                value={draft.vatScheme}
                onChange={(event) => setDraft({ ...draft, vatScheme: event.target.value })}
              >
                <option value="cash">Cash accounting (recommended)</option>
                <option value="standard">Standard / accrual (memo only)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>Invoice prefix</span>
              <input
                className={field}
                value={draft.invoicePrefix}
                onChange={(event) => setDraft({ ...draft, invoicePrefix: event.target.value })}
              />
            </div>
            <div>
              <span className={label}>Next invoice number</span>
              <input
                type="number"
                className={field}
                value={draft.nextInvoiceNumber}
                onChange={(event) => setDraft({ ...draft, nextInvoiceNumber: Number(event.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>Receipt prefix</span>
              <input
                className={field}
                value={draft.receiptPrefix}
                onChange={(event) => setDraft({ ...draft, receiptPrefix: event.target.value })}
              />
            </div>
            <div>
              <span className={label}>Next receipt number</span>
              <input
                type="number"
                className={field}
                value={draft.nextReceiptNumber}
                onChange={(event) => setDraft({ ...draft, nextReceiptNumber: Number(event.target.value) })}
              />
            </div>
          </div>
          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-xs ${
                message.tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save settings"}
          </button>
        </form>
      </Card>

      <Card title="Numbering & VAT policy" subtitle="How the engine behaves">
        <ul className="space-y-3 text-sm text-slate-600">
          <li className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold text-slate-800">Sequential documents</p>
            <p className="mt-1 text-xs">
              Invoices are numbered {draft.invoicePrefix}
              {String(draft.nextInvoiceNumber).padStart(4, "0")} onward and receipts{" "}
              {draft.receiptPrefix}
              {String(draft.nextReceiptNumber).padStart(4, "0")} onward. Both counters are allocated inside a
              transaction so numbers are never reused.
            </p>
          </li>
          <li className="rounded-xl bg-amber-50 p-3">
            <p className="font-semibold text-amber-900">Cash-accounting VAT</p>
            <p className="mt-1 text-xs text-amber-800">
              VAT is recognised only on receipts. Each receipt stores a VAT snapshot, so amending an invoice
              later never rewrites a filed return.
            </p>
          </li>
          <li className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold text-slate-800">Partial payments</p>
            <p className="mt-1 text-xs">
              Part payments are pro-rated across the invoice&apos;s blended VAT fraction, so a 40% payment
              recognises exactly 40% of the invoice&apos;s VAT.
            </p>
          </li>
          <li className="rounded-xl bg-slate-50 p-3">
            <p className="font-semibold text-slate-800">Audit safety</p>
            <p className="mt-1 text-xs">
              Customers with invoices cannot be deleted, and invoices with receipts cannot be edited — the
              ledger always reconciles to the receipts.
            </p>
          </li>
        </ul>
      </Card>
    </div>
  );
}
