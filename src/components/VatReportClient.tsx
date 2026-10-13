"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge, Card, StatCard, Td, Th } from "@/components/ui";
import { formatDate, money, type PeriodKind } from "@/lib/domain";
import type { FullVatReport } from "@/lib/vatReport";

const YEARS = (() => {
  const current = new Date().getFullYear();
  return [current + 1, current, current - 1, current - 2, current - 3];
})();

const KINDS: { key: PeriodKind; label: string }[] = [
  { key: "month", label: "Monthly" },
  { key: "quarter", label: "Quarterly" },
  { key: "year", label: "Yearly" },
  { key: "custom", label: "Custom range" },
];

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export function VatReportClient({
  report,
  kind,
  year,
  quarter,
  month,
  from,
  to,
}: {
  report: FullVatReport;
  kind: PeriodKind;
  year: number;
  quarter: number;
  month: number;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({ kind, year, quarter, month, from, to });

  const query = new URLSearchParams();
  query.set("period", draft.kind);
  if (draft.kind === "quarter") {
    query.set("year", String(draft.year));
    query.set("quarter", String(draft.quarter));
  } else if (draft.kind === "year") {
    query.set("year", String(draft.year));
  } else if (draft.kind === "month") {
    query.set("year", String(draft.year));
    query.set("month", String(draft.month));
  } else {
    query.set("from", draft.from);
    query.set("to", draft.to);
  }

  const currency = report.currency;

  return (
    <div className="space-y-6">
      <Card
        title="Reporting period"
        subtitle="Output VAT is taken from payments received in the window; input VAT from purchase invoices dated in the window."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/reports/vat?${query.toString()}&download=1`}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Download return PDF
            </a>
            <a
              href={`/api/reports/vat?${query.toString()}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Preview PDF
            </a>
          </div>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setDraft({ ...draft, kind: option.key })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                  draft.kind === option.key
                    ? "bg-indigo-600 text-white ring-indigo-600"
                    : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {draft.kind !== "custom" && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Year</span>
              <select
                value={draft.year}
                onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              >
                {YEARS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          )}

          {draft.kind === "quarter" && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quarter</span>
              <select
                value={draft.quarter}
                onChange={(event) => setDraft({ ...draft, quarter: Number(event.target.value) })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              >
                {[1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    Q{value}
                  </option>
                ))}
              </select>
            </label>
          )}

          {draft.kind === "month" && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Month</span>
              <select
                value={draft.month}
                onChange={(event) => setDraft({ ...draft, month: Number(event.target.value) })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              >
                {MONTHS.map((value) => (
                  <option key={value} value={value}>
                    {new Date(Date.UTC(2024, value - 1, 1)).toLocaleDateString("en-US", {
                      month: "long",
                      timeZone: "UTC",
                    })}
                  </option>
                ))}
              </select>
            </label>
          )}

          {draft.kind === "custom" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">From</span>
                <input
                  type="date"
                  value={draft.from}
                  onChange={(event) => setDraft({ ...draft, from: event.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">To</span>
                <input
                  type="date"
                  value={draft.to}
                  onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </label>
            </>
          )}

          <button
            type="button"
            onClick={() => router.push(`/reports?${query.toString()}`)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            Run report
          </button>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Taxable sales (net)"
          value={money(report.output.taxableSales, currency)}
          hint={`${report.receipts.totals.paymentCount} customer receipts`}
          tone="indigo"
        />
        <StatCard
          label="Output VAT collected"
          value={money(report.output.outputVat, currency)}
          hint="VAT on payments received"
          tone="slate"
        />
        <StatCard
          label="Input VAT claimable"
          value={money(report.input.totalVat, currency)}
          hint={`Direct ${money(report.input.directVat, currency)} + indirect ${money(report.input.indirectVat, currency)}`}
          tone="emerald"
        />
        <StatCard
          label={report.net.direction === "refundable" ? "Net VAT refundable" : "Net VAT payable"}
          value={money(report.net.netVat, currency)}
          hint={`${report.period.label} • ${report.input.count} purchase invoices`}
          tone={report.net.direction === "refundable" ? "emerald" : "amber"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="VAT return" subtitle={report.period.description} bodyClassName="p-0">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <Th>Box</Th>
                <Th>Description</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ["1", "Taxable sales — cash received (net)", money(report.receipts.totals.netCollected, currency)],
                ["2", "Output VAT collected", money(report.output.outputVat, currency)],
                ["3", "Direct expenses — fuel, maintenance, operating (net)", money(report.input.directNet, currency)],
                ["4", "Indirect expenses — admin, overheads, utilities (net)", money(report.input.indirectNet, currency)],
                ["5", "Input VAT claimable", money(report.input.totalVat, currency)],
              ].map(([box, description, amount]) => (
                <tr key={box} className="hover:bg-slate-50">
                  <Td>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                      {box}
                    </span>
                  </Td>
                  <Td className="whitespace-normal">{description}</Td>
                  <Td align="right" className="font-semibold">
                    {amount}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <Td>
                  <Badge
                    className={
                      report.net.direction === "refundable"
                        ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                        : "bg-amber-100 text-amber-700 ring-amber-200"
                    }
                  >
                    {report.net.direction === "refundable" ? "CR" : "PAY"}
                  </Badge>
                </Td>
                <Td className="font-semibold text-slate-800">{report.net.label}</Td>
                <Td align="right" className="font-semibold text-slate-900">
                  {money(report.net.netVat, currency)}
                </Td>
              </tr>
            </tfoot>
          </table>
        </Card>

        <Card title="Input VAT analysis" subtitle="What you can claim back, by expense type">
          <div className="space-y-3">
            {[
              {
                title: "Direct expenses",
                hint: "Fuel, maintenance, tyres, tolls, driver allowances",
                net: report.input.directNet,
                vat: report.input.directVat,
                tone: "bg-sky-50 text-sky-700",
              },
              {
                title: "Indirect expenses",
                hint: "Rent, utilities, accounting, insurance, marketing",
                net: report.input.indirectNet,
                vat: report.input.indirectVat,
                tone: "bg-violet-50 text-violet-700",
              },
            ].map((block) => (
              <div key={block.title} className={`rounded-xl p-4 ${block.tone}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{block.title}</p>
                  <p className="text-sm font-bold tabular-nums">{money(block.vat, currency)}</p>
                </div>
                <p className="mt-1 text-[11px]">{block.hint}</p>
                <p className="mt-2 text-[11px] font-medium">Net spend {money(block.net, currency)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-300">
            <p className="font-semibold text-white">How the net figure is derived</p>
            <p className="mt-1">
              Output VAT {money(report.output.outputVat, currency)} (cash received) less input VAT{" "}
              {money(report.input.totalVat, currency)} (purchase invoices recorded) ={" "}
              <span className="font-semibold text-amber-300">{money(report.net.netVat, currency)}</span>{" "}
              {report.net.direction === "refundable" ? "refundable" : "payable"} for {report.period.label}.
            </p>
          </div>
          <Link
            href="/expenses"
            className="mt-4 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Manage expenses &rarr;
          </Link>
        </Card>
      </div>

      <Card
        title={`Output VAT schedule — ${report.period.label}`}
        subtitle="Every receipt behind the output VAT figure"
        bodyClassName="p-0"
        action={<Badge className="bg-emerald-100 text-emerald-700 ring-emerald-200">{report.scheme}</Badge>}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <Th>Date</Th>
                <Th>Receipt</Th>
                <Th>Invoice</Th>
                <Th>Customer</Th>
                <Th>Method</Th>
                <Th align="right">Gross received</Th>
                <Th align="right">Net</Th>
                <Th align="right">Output VAT</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.receipts.rows.map((row) => (
                <tr key={row.paymentId} className="hover:bg-slate-50">
                  <Td>{formatDate(row.paymentDate)}</Td>
                  <Td>
                    <span className="font-mono text-xs">{row.receiptNumber}</span>
                  </Td>
                  <Td>
                    <Link href={`/invoices/${row.paymentId}`} className="hover:text-indigo-600">
                      {row.invoiceNumber}
                    </Link>
                  </Td>
                  <Td>{row.customerName}</Td>
                  <Td>{row.method}</Td>
                  <Td align="right">{money(row.grossCollected, currency)}</Td>
                  <Td align="right">{money(row.netCollected, currency)}</Td>
                  <Td align="right" className="font-semibold text-amber-700">
                    {money(row.vatCollected, currency)}
                  </Td>
                </tr>
              ))}
              {report.receipts.rows.length === 0 && (
                <tr>
                  <Td className="text-slate-500" >
                    No customer payments were received in {report.period.label}.
                  </Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                </tr>
              )}
            </tbody>
            {report.receipts.rows.length > 0 && (
              <tfoot className="bg-slate-50">
                <tr>
                  <Td className="font-semibold text-slate-700">Totals</Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td align="right" className="font-semibold">
                    {money(report.receipts.totals.grossCollected, currency)}
                  </Td>
                  <Td align="right" className="font-semibold">
                    {money(report.receipts.totals.netCollected, currency)}
                  </Td>
                  <Td align="right" className="font-semibold text-amber-700">
                    {money(report.output.outputVat, currency)}
                  </Td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
