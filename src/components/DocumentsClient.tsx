"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { Badge, Card, EmptyState, StatCard, Td, Th } from "@/components/ui";
import { formatDate } from "@/lib/domain";
import { statusTone, type DocumentRow } from "@/lib/documentsShared";

type Draft = {
  title: string;
  documentNumber: string;
  category: string;
  issuer: string;
  holderName: string;
  vehicleId: string;
  issuedDate: string;
  expiryDate: string;
  renewalDate: string;
  renewalLeadDays: string;
  notes: string;
};

const EMPTY: Draft = {
  title: "",
  documentNumber: "",
  category: "Vehicle registration",
  issuer: "",
  holderName: "",
  vehicleId: "",
  issuedDate: "",
  expiryDate: "",
  renewalDate: "",
  renewalLeadDays: "30",
  notes: "",
};

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const label = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

export function DocumentsClient({
  documents,
  categories,
  vehicles,
  statusFilter,
}: {
  documents: DocumentRow[];
  categories: readonly string[];
  vehicles: { id: number; code: string; make: string; model: string | null }[];
  statusFilter: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(
    () => ({
      expired: documents.filter((row) => row.status === "expired").length,
      expiring: documents.filter((row) => row.status === "expiring").length,
      valid: documents.filter((row) => row.status === "valid").length,
      noExpiry: documents.filter((row) => row.status === "no-expiry").length,
    }),
    [documents],
  );

  async function submit() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      Object.entries(draft).forEach(([key, value]) => body.set(key, value));
      const file = fileRef.current?.files?.[0];
      if (file) body.set("attachment", file);

      const response = await fetch("/api/documents", { method: "POST", body });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) throw new Error(payload.error ?? "Could not save the document");
      setDraft(null);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      setNotice("Document filed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the document");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: DocumentRow) {
    if (!window.confirm(`Delete "${row.title}"?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/documents/${row.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Expired" value={String(counts.expired)} hint="Needs renewal now" tone="rose" />
        <StatCard label="Expiring soon" value={String(counts.expiring)} hint="Within the reminder window" tone="amber" />
        <StatCard label="Valid" value={String(counts.valid)} hint="Nothing to do" tone="emerald" />
        <StatCard label="No expiry / other" value={String(counts.noExpiry)} hint={`${documents.length} documents on file`} tone="slate" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        <Card
          title={`${documents.length} document${documents.length === 1 ? "" : "s"}`}
          subtitle="Recently expired first, then the next documents due to expire"
          bodyClassName="p-0"
          action={
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "all", text: "All" },
                { key: "attention", text: "Needs attention" },
                { key: "expired", text: "Expired" },
                { key: "expiring", text: "Expiring" },
                { key: "valid", text: "Valid" },
              ].map((option) => (
                <Link
                  key={option.key}
                  href={option.key === "all" ? "/documents" : `/documents?status=${option.key}`}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ring-inset transition ${
                    statusFilter === option.key
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
          {documents.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No documents on file"
                description="Add registration papers, insurance policies, licences, permits and contracts to track their expiry and renewal dates."
                action={
                  <button
                    type="button"
                    onClick={() => setDraft({ ...EMPTY })}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    + Add document
                  </button>
                }
              />
            </div>
          ) : (
            <div className="max-h-[34rem] overflow-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <Th>Document</Th>
                    <Th>Category</Th>
                    <Th>Belongs to</Th>
                    <Th>Issued</Th>
                    <Th>Expiry</Th>
                    <Th>Renewal date</Th>
                    <Th>Status</Th>
                    <Th align="right">File</Th>
                    <Th align="right">—</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((row) => (
                    <tr key={row.id} className={row.status === "expired" ? "bg-rose-50/50" : "hover:bg-slate-50"}>
                      <Td>
                        <span className="font-semibold text-slate-800">{row.title}</span>
                        <p className="font-mono text-[10px] text-slate-500">
                          {row.documentNumber || row.issuer || "—"}
                        </p>
                      </Td>
                      <Td>
                        <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{row.category}</Badge>
                      </Td>
                      <Td>
                        {row.vehicleId ? (
                          <Link
                            href={`/vehicles/${row.vehicleId}`}
                            className="font-mono text-xs text-indigo-600 hover:text-indigo-500"
                          >
                            {row.vehicleCode}
                          </Link>
                        ) : (
                          <span className="text-slate-600">{row.holderName || "Company"}</span>
                        )}
                      </Td>
                      <Td>{row.issuedDate ? formatDate(row.issuedDate) : "—"}</Td>
                      <Td>{row.expiryDate ? formatDate(row.expiryDate) : "—"}</Td>
                      <Td>{row.renewalDate ? formatDate(row.renewalDate) : "—"}</Td>
                      <Td>
                        <Badge className={statusTone(row.status)}>{row.statusLabel}</Badge>
                      </Td>
                      <Td align="right">
                        {row.hasAttachment ? (
                          <a
                            href={`/api/documents/${row.id}/attachment`}
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
          title={draft ? "Document details" : "Add a document"}
          subtitle="Legal papers, licences, permits and contracts"
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
              <div>
                <span className={label}>Title *</span>
                <input
                  className={field}
                  value={draft.title}
                  placeholder="e.g. TRK-001 registration card"
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={label}>Category</span>
                  <select
                    className={field}
                    value={draft.category}
                    onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={label}>Document number</span>
                  <input
                    className={field}
                    value={draft.documentNumber}
                    onChange={(event) => setDraft({ ...draft, documentNumber: event.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={label}>Issued by</span>
                  <input
                    className={field}
                    value={draft.issuer}
                    onChange={(event) => setDraft({ ...draft, issuer: event.target.value })}
                  />
                </div>
                <div>
                  <span className={label}>Holder</span>
                  <input
                    className={field}
                    value={draft.holderName}
                    placeholder="Company or person"
                    onChange={(event) => setDraft({ ...draft, holderName: event.target.value })}
                  />
                </div>
              </div>
              <div>
                <span className={label}>Link to vehicle</span>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={label}>Issued date</span>
                  <input
                    type="date"
                    className={field}
                    value={draft.issuedDate}
                    onChange={(event) => setDraft({ ...draft, issuedDate: event.target.value })}
                  />
                </div>
                <div>
                  <span className={label}>Expiry date</span>
                  <input
                    type="date"
                    className={field}
                    value={draft.expiryDate}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        expiryDate: event.target.value,
                        renewalDate: draft.renewalDate || event.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={label}>Renewal date</span>
                  <input
                    type="date"
                    className={field}
                    value={draft.renewalDate}
                    onChange={(event) => setDraft({ ...draft, renewalDate: event.target.value })}
                  />
                </div>
                <div>
                  <span className={label}>Reminder (days)</span>
                  <input
                    type="number"
                    min="0"
                    className={field}
                    value={draft.renewalLeadDays}
                    onChange={(event) => setDraft({ ...draft, renewalLeadDays: event.target.value })}
                  />
                </div>
              </div>
              <div>
                <span className={label}>Document file</span>
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
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save document"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setDraft({ ...EMPTY })}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                + Add document
              </button>
              {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}
              <p className="text-xs leading-relaxed text-slate-500">
                The list is always ordered by urgency: the document that expired most recently sits at the
                top, followed by the next one due to expire, and so on. Attach a scan or photo of each
                document so the signed original is always one click away.
              </p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
