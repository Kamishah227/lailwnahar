import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Card, EmptyState, PageHeader, StatCard, Td, Th } from "@/components/ui";
import { formatDate, money, todayISO } from "@/lib/domain";
import { buildStatement, getSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { customerId } = await params;
  const query = await searchParams;
  const id = Number(customerId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const from = query.from?.trim() || "";
  const to = query.to?.trim() || "";

  let statement;
  let settings;
  try {
    [statement, settings] = await Promise.all([
      buildStatement(id, from || undefined, to || undefined),
      getSettings(),
    ]);
  } catch {
    notFound();
  }

  const currency = settings.currency;
  const customer = statement.customer;

  return (
    <>
      <PageHeader
        title={`Statement — ${customer.name}`}
        description={`${customer.address ? `${customer.address.replace(/\n/g, ", ")} • ` : ""}${
          customer.taxId ? `Tax ID ${customer.taxId}` : "No tax ID on file"
        }`}
      >
        <Link
          href="/statements"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← All statements
        </Link>
        <a
          href={`/api/reports/statement/${customer.id}${from || to ? `?from=${from}&to=${to}` : ""}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          Statement PDF
        </a>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Opening balance" value={money(statement.openingBalance, currency)} tone="slate" />
        <StatCard label="Invoiced in period" value={money(statement.totalInvoiced, currency)} tone="indigo" />
        <StatCard label="Received in period" value={money(statement.totalPaid, currency)} tone="emerald" />
        <StatCard
          label="Balance due"
          value={money(statement.closingBalance, currency)}
          hint={statement.closingBalance > 0 ? "Open receivable" : "Settled in full"}
          tone={statement.closingBalance > 0 ? "rose" : "emerald"}
        />
      </div>

      <Card
        title="Account ledger"
        subtitle={`Invoices are debits, receipts are credits • ${
          from || to ? `${from || "start"} → ${to || formatDate(todayISO())}` : "all activity"
        }`}
        bodyClassName="p-0"
        action={
          <form className="flex flex-wrap items-end gap-2" action={`/statements/${customer.id}`}>
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
          </form>
        }
      >
        {statement.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No transactions in this period"
              description="Try widening the date range, or raise an invoice for this customer."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Reference</Th>
                  <Th>Details</Th>
                  <Th align="right">Debit</Th>
                  <Th align="right">Credit</Th>
                  <Th align="right">Balance</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50/60">
                  <Td>—</Td>
                  <Td className="font-semibold text-slate-500">Opening</Td>
                  <Td>Balance brought forward</Td>
                  <Td> </Td>
                  <Td align="right">—</Td>
                  <Td align="right">—</Td>
                  <Td align="right">{money(statement.openingBalance, currency)}</Td>
                </tr>
                {statement.rows.map((row, index) => (
                  <tr key={`${row.reference}-${index}`} className="hover:bg-slate-50">
                    <Td>{formatDate(row.date)}</Td>
                    <Td>
                      <Badge
                        className={
                          row.type === "Payment"
                            ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                            : "bg-indigo-100 text-indigo-700 ring-indigo-200"
                        }
                      >
                        {row.type}
                      </Badge>
                    </Td>
                    <Td>
                      {row.type === "Invoice" ? (
                        <Link
                          href={`/invoices/${row.entityId ?? ""}`}
                          className="font-semibold text-indigo-600 hover:text-indigo-500"
                        >
                          {row.reference}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs">{row.reference}</span>
                      )}
                    </Td>
                    <Td className="max-w-xs whitespace-normal text-slate-600">{row.description}</Td>
                    <Td align="right">{row.debit ? money(row.debit, currency) : "—"}</Td>
                    <Td align="right" className={row.credit ? "text-emerald-700" : ""}>
                      {row.credit ? money(row.credit, currency) : "—"}
                    </Td>
                    <Td align="right" className="font-semibold">
                      {money(row.balance, currency)}
                    </Td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <Td className="font-semibold text-slate-700">Closing</Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td align="right" className="font-semibold">
                    {money(statement.totalInvoiced, currency)}
                  </Td>
                  <Td align="right" className="font-semibold text-emerald-700">
                    {money(statement.totalPaid, currency)}
                  </Td>
                  <Td align="right" className="font-semibold text-rose-600">
                    {money(statement.closingBalance, currency)}
                  </Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card title="Customer record" subtitle="Billing identity used on the statement PDF">
        <dl className="grid gap-4 sm:grid-cols-3">
          {[
            ["Contact", customer.contactName || "—"],
            ["Email", customer.email || "—"],
            ["Phone", customer.phone || "—"],
            ["TRN / Tax ID", customer.taxId || "—"],
            ["Invoices on file", String(customer.invoiceCount)],
            ["Customer since", formatDate(customer.createdAt.slice(0, 10))],
          ].map(([term, value]) => (
            <div key={term} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{term}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
        {customer.notes && (
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            {customer.notes}
          </p>
        )}
      </Card>
    </>
  );
}
