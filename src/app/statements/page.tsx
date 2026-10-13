import Link from "next/link";

import { Badge, Card, EmptyState, PageHeader, StatCard, Td, Th } from "@/components/ui";
import { formatDate, money, todayISO } from "@/lib/domain";
import { getSettings, listStatementSummaries } from "@/lib/repo";

export const dynamic = "force-dynamic";

const PRESETS = [
  { label: "All time", from: "", to: "" },
  { label: "This year", from: `${new Date().getUTCFullYear()}-01-01`, to: "" },
  {
    label: "Last 90 days",
    from: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
    to: "",
  },
];

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from?.trim() || "";
  const to = params.to?.trim() || "";

  const [summaries, settings] = await Promise.all([
    listStatementSummaries(from || undefined, to || undefined),
    getSettings(),
  ]);
  const currency = settings.currency;

  const periodTotals = summaries.reduce(
    (acc, row) => ({
      invoiced: acc.invoiced + row.periodInvoiced,
      received: acc.received + row.periodReceived,
      outstanding: acc.outstanding + row.currentOutstanding,
    }),
    { invoiced: 0, received: 0, outstanding: 0 },
  );

  return (
    <>
      <PageHeader
        title="Customer statements"
        description="A statement for every customer: opening balance, invoices raised, payments received and the balance they still owe."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Customers" value={String(summaries.length)} tone="slate" />
        <StatCard label="Invoiced in period" value={money(periodTotals.invoiced, currency)} tone="indigo" />
        <StatCard label="Received in period" value={money(periodTotals.received, currency)} tone="emerald" />
        <StatCard label="Owed to you now" value={money(periodTotals.outstanding, currency)} tone="rose" />
      </div>

      <Card
        title="Statement summary"
        subtitle={
          from || to
            ? `Period ${from || "start"} → ${to || formatDate(todayISO())}`
            : "All activity to date"
        }
        bodyClassName="p-0"
        action={
          <form className="flex flex-wrap items-end gap-2" action="/statements">
            <div>
              <span className="block text-[10px] font-semibold uppercase text-slate-500">From</span>
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase text-slate-500">To</span>
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
            <button type="submit" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
              Apply
            </button>
            <div className="flex gap-1">
              {PRESETS.map((preset) => (
                <Link
                  key={preset.label}
                  href={preset.from ? `/statements?from=${preset.from}` : "/statements"}
                  className="rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {preset.label}
                </Link>
              ))}
            </div>
          </form>
        }
      >
        {summaries.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No customers yet"
              description="Add a customer and raise an invoice — their statement will appear here automatically."
              action={
                <Link
                  href="/customers"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  Go to customers
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Customer</Th>
                  <Th>Tax ID</Th>
                  <Th align="right">Docs</Th>
                  <Th align="right">Opening balance</Th>
                  <Th align="right">Invoiced</Th>
                  <Th align="right">Received</Th>
                  <Th align="right">Closing balance</Th>
                  <Th align="right">Owed now</Th>
                  <Th align="right">Statement</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.map((row) => (
                  <tr key={row.customerId} className="hover:bg-slate-50">
                    <Td>
                      <Link
                        href={`/statements/${row.customerId}`}
                        className="font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        {row.name}
                      </Link>
                      <p className="text-xs text-slate-500">{row.email || "—"}</p>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs">{row.taxId || "—"}</span>
                    </Td>
                    <Td align="right">
                      <span className="text-xs text-slate-500">
                        {row.invoiceCount} inv / {row.receiptCount} rcp
                      </span>
                    </Td>
                    <Td align="right">{money(row.openingBalance, currency)}</Td>
                    <Td align="right">{money(row.periodInvoiced, currency)}</Td>
                    <Td align="right" className="text-emerald-700">
                      {money(row.periodReceived, currency)}
                    </Td>
                    <Td align="right">{money(row.closingBalance, currency)}</Td>
                    <Td align="right">
                      <Badge
                        className={
                          row.currentOutstanding > 0
                            ? "bg-rose-100 text-rose-700 ring-rose-200"
                            : "bg-emerald-100 text-emerald-700 ring-emerald-200"
                        }
                      >
                        {money(row.currentOutstanding, currency)}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-3">
                        <Link
                          href={`/statements/${row.customerId}`}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                        >
                          Open
                        </Link>
                        <a
                          href={`/api/reports/statement/${row.customerId}${
                            from || to ? `?from=${from}&to=${to}` : ""
                          }`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                        >
                          PDF
                        </a>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <Td className="font-semibold text-slate-700">Totals</Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td align="right" className="font-semibold">
                    {money(periodTotals.invoiced, currency)}
                  </Td>
                  <Td align="right" className="font-semibold text-emerald-700">
                    {money(periodTotals.received, currency)}
                  </Td>
                  <Td> </Td>
                  <Td align="right" className="font-semibold text-rose-600">
                    {money(periodTotals.outstanding, currency)}
                  </Td>
                  <Td> </Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
