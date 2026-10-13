"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge, Card, EmptyState, Td, Th } from "@/components/ui";
import { money } from "@/lib/domain";
import type { CustomerRow } from "@/lib/repo";

type Draft = {
  id: number | null;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  taxId: string;
  address: string;
  notes: string;
};

const EMPTY: Draft = {
  id: null,
  name: "",
  contactName: "",
  email: "",
  phone: "",
  taxId: "",
  address: "",
  notes: "",
};

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const label = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export function CustomersClient({
  customers,
  currency,
  defaultTaxLabel,
}: {
  customers: CustomerRow[];
  currency: string;
  defaultTaxLabel: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.email, customer.taxId, customer.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [customers, search]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(draft.id ? `/api/customers/${draft.id}` : "/api/customers", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) throw new Error(payload.error ?? "Could not save customer");
      setDraft(null);
      setNotice(draft.id ? "Customer updated." : `${draft.name} added.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save customer");
    } finally {
      setBusy(false);
    }
  }

  async function remove(customer: CustomerRow) {
    if (!window.confirm(`Delete ${customer.name}? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) throw new Error(payload.error ?? "Could not delete customer");
      setNotice(`${customer.name} deleted.`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete customer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card
        title={`${filtered.length} customer${filtered.length === 1 ? "" : "s"}`}
        subtitle="Contact, billing address and tax identifiers"
        bodyClassName="p-0"
        action={
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, tax ID…"
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        }
      >
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No customers found"
              description="Add your first customer using the form on the right."
              action={
                <button
                  type="button"
                  onClick={() => setDraft({ ...EMPTY })}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  + New customer
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Customer</Th>
                  <Th>Contact</Th>
                  <Th>{defaultTaxLabel}</Th>
                  <Th align="right">Invoiced</Th>
                  <Th align="right">Balance</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50">
                    <Td>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        {customer.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {customer.invoiceCount} invoice{customer.invoiceCount === 1 ? "" : "s"}
                      </p>
                    </Td>
                    <Td>
                      <p className="text-sm text-slate-700">{customer.email || "—"}</p>
                      <p className="text-xs text-slate-500">{customer.phone || customer.contactName || "—"}</p>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs">{customer.taxId || "—"}</span>
                    </Td>
                    <Td align="right">{money(customer.invoicedTotal, currency)}</Td>
                    <Td align="right">
                      <Badge
                        className={
                          customer.outstanding > 0
                            ? "bg-rose-100 text-rose-700 ring-rose-200"
                            : "bg-emerald-100 text-emerald-700 ring-emerald-200"
                        }
                      >
                        {money(customer.outstanding, currency)}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDraft({
                              id: customer.id,
                              name: customer.name,
                              contactName: customer.contactName ?? "",
                              email: customer.email ?? "",
                              phone: customer.phone ?? "",
                              taxId: customer.taxId ?? "",
                              address: customer.address ?? "",
                              notes: customer.notes ?? "",
                            })
                          }
                          className="text-xs font-semibold text-slate-600 hover:text-indigo-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(customer)}
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
        title={draft?.id ? "Edit customer" : "New customer"}
        subtitle={draft?.id ? `Customer #${draft.id}` : "Stored in your local ledger"}
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
              <span className={label}>Name *</span>
              <input
                className={field}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={label}>Contact</span>
                <input
                  className={field}
                  value={draft.contactName}
                  onChange={(event) => setDraft({ ...draft, contactName: event.target.value })}
                />
              </div>
              <div>
                <span className={label}>{defaultTaxLabel}</span>
                <input
                  className={field}
                  value={draft.taxId}
                  onChange={(event) => setDraft({ ...draft, taxId: event.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className={label}>Email</span>
                <input
                  type="email"
                  className={field}
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                />
              </div>
              <div>
                <span className={label}>Phone</span>
                <input
                  className={field}
                  value={draft.phone}
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                />
              </div>
            </div>
            <div>
              <span className={label}>Billing address</span>
              <textarea
                rows={3}
                className={field}
                value={draft.address}
                onChange={(event) => setDraft({ ...draft, address: event.target.value })}
              />
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
              {busy ? "Saving…" : draft.id ? "Save changes" : "Create customer"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setDraft({ ...EMPTY })}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              + New customer
            </button>
            {notice && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>
            )}
            <p className="text-xs leading-relaxed text-slate-500">
              Customers hold the billing identity used on invoices, receipts and statements. A customer with
              invoices cannot be deleted — that keeps your VAT audit trail intact.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
