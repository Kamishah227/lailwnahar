import Link from "next/link";

import { Badge, Card, EmptyState, PageHeader, StatCard, Td, Th } from "@/components/ui";
import { formatDate, money, statusTone } from "@/lib/domain";
import { getSettings, listInvoices } from "@/lib/repo";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "balance", label: "With balance" },
  { key: "open", label: "Open" },
  { key: "partial", label: "Part paid" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "all" } = await searchParams;
  const [invoices, settings] = await Promise.all([listInvoices({ status }), getSettings()]);
  const currency = settings.currency;

  const totals = invoices.reduce(
    (acc, invoice) => ({
      gross: acc.gross + invoice.total,
      vat: acc.vat + invoice.vatTotal,
      balance: acc.balance + invoice.outstanding,
    }),
    { gross: 0, vat: 0, balance: 0 },
  );

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Every invoice is stored with its line items, VAT rates and payment history."
      >
        <Link
          href="/invoices/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          + New invoice
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Gross value (filtered)" value={money(totals.gross, currency)} tone="indigo" />
        <StatCard label="VAT charged (filtered)" value={money(totals.vat, currency)} tone="amber" hint="Not yet declared" />
        <StatCard label="Still outstanding" value={money(totals.balance, currency)} tone="rose" />
      </div>

      <Card
        title={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`}
        subtitle="VAT shown on an invoice is only declared when the cash is received"
        bodyClassName="p-0"
        action={
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((filter) => (
              <Link
                key={filter.key}
                href={filter.key === "all" ? "/invoices" : `/invoices?status=${filter.key}`}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ring-inset transition ${
                  status === filter.key
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        }
      >
        {invoices.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No invoices match this view"
              description="Raise an invoice to get started — line items, VAT rates and payment tracking are all included."
              action={
                <Link
                  href="/invoices/new"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  + New invoice
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Invoice</Th>
                  <Th>Customer</Th>
                  <Th>Issued</Th>
                  <Th>Due</Th>
                  <Th align="right">Net</Th>
                  <Th align="right">VAT</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Paid</Th>
                  <Th align="right">Balance</Th>
                  <Th>Status</Th>
                  <Th align="right">PDF</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <Td>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                      <p className="text-xs text-slate-500">{invoice.itemCount} lines</p>
                    </Td>
                    <Td>
                      <Link href={`/customers/${invoice.customerId}`} className="hover:text-indigo-600">
                        {invoice.customerName}
                      </Link>
                    </Td>
                    <Td>{formatDate(invoice.issueDate)}</Td>
                    <Td>{formatDate(invoice.dueDate)}</Td>
                    <Td align="right">{money(invoice.subtotal, invoice.currency)}</Td>
                    <Td align="right">{money(invoice.vatTotal, invoice.currency)}</Td>
                    <Td align="right" className="font-semibold text-slate-900">
                      {money(invoice.total, invoice.currency)}
                    </Td>
                    <Td align="right">{money(invoice.paidTotal, invoice.currency)}</Td>
                    <Td align="right">
                      <span className={invoice.outstanding > 0 ? "font-semibold text-rose-600" : "text-slate-400"}>
                        {money(invoice.outstanding, invoice.currency)}
                      </span>
                    </Td>
                    <Td>
                      <Badge className={statusTone(invoice.status as never)}>{invoice.status}</Badge>
                    </Td>
                    <Td align="right">
                      <a
                        href={`/api/reports/invoice/${invoice.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        View
                      </a>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-3">
                        <Link
                          href={`/invoices/${invoice.id}/edit`}
                          className="text-xs font-semibold text-slate-600 hover:text-indigo-600"
                        >
                          Edit
                        </Link>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
