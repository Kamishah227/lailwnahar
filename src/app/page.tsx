import Link from "next/link";

import { SeedButton } from "@/components/SeedButton";
import { Badge, Card, EmptyState, PageHeader, StatCard, Td, Th } from "@/components/ui";
import { formatDate, money, statusTone } from "@/lib/domain";
import { documentSummary } from "@/lib/documents";
import { statusTone as docTone } from "@/lib/documentsShared";
import { getDashboard } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, documents] = await Promise.all([getDashboard(), documentSummary(6)]);
  const currency = stats.currency;
  const empty = stats.customers === 0 && stats.openInvoices === 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A live view of receivables, cash collected and the VAT you owe under the cash-accounting scheme."
      >
        <Link
          href="/invoices/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          + New invoice
        </Link>
        <Link
          href="/reports"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          VAT report
        </Link>
      </PageHeader>

      {empty && (
        <Card>
          <EmptyState
            title="No data yet"
            description="Create your first customer and invoice, or load a demo dataset that spans several quarters so you can explore the cash-basis VAT reports."
            action={<SeedButton />}
          />
        </Card>
      )}

      <Card
        title="Documents due for attention"
        subtitle="Recently expired documents first, then the next ones to expire"
        action={
          <a
            href="/documents"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Open documents register &rarr;
          </a>
        }
      >
        {documents.total === 0 ? (
          <EmptyState
            title="No documents filed yet"
            description="Add registration papers, insurance policies, licences, permits and contracts to see their expiry and renewal dates here."
          />
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              {[
                { label: "Expired", value: documents.expired, tone: "text-rose-600", bg: "bg-rose-50" },
                { label: "Expiring soon", value: documents.expiring, tone: "text-amber-600", bg: "bg-amber-50" },
                { label: "Valid", value: documents.valid, tone: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "On file", value: documents.total, tone: "text-slate-700", bg: "bg-slate-100" },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl px-4 py-3 ${item.bg}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {item.label}
                  </p>
                  <p className={`text-xl font-bold tabular-nums ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <ul className="divide-y divide-slate-100">
              {documents.urgent.map((document) => (
                <li key={document.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <Badge className={docTone(document.status)}>{document.statusLabel}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{document.title}</p>
                    <p className="text-xs text-slate-500">
                      {document.category}
                      {document.vehicleCode ? ` · ${document.vehicleCode}` : ""}
                      {document.documentNumber ? ` · ${document.documentNumber}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-slate-500">
                      Expires {document.expiryDate ? formatDate(document.expiryDate) : "—"}
                    </p>
                    <p className="text-slate-400">
                      Renew by {document.renewalDate ? formatDate(document.renewalDate) : "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Outstanding receivables"
          value={money(stats.receivables, currency)}
          hint={`${stats.openInvoices} live invoices`}
          tone="indigo"
        />
        <StatCard
          label="Overdue"
          value={money(stats.overdue, currency)}
          hint={`${stats.customers} active customers`}
          tone="rose"
        />
        <StatCard
          label="Cash collected (this quarter)"
          value={money(stats.collectedThisQuarter, currency)}
          hint={`This year: ${money(stats.collectedThisYear, currency)}`}
          tone="emerald"
        />
        <StatCard
          label="VAT due (this quarter)"
          value={money(stats.vatDueThisQuarter, currency)}
          hint="Cash basis — receipts only"
          tone="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Recent invoices"
          subtitle="Newest first"
          bodyClassName="p-0"
          action={
            <Link href="/invoices" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
              View all →
            </Link>
          }
        >
          {stats.recentInvoices.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No invoices yet" description="Invoices you raise will appear here." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Customer</Th>
                    <Th>Issued</Th>
                    <Th>Status</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">Balance</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.recentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <Td>
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="font-semibold text-indigo-600 hover:text-indigo-500"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </Td>
                      <Td>{invoice.customerName}</Td>
                      <Td>{formatDate(invoice.issueDate)}</Td>
                      <Td>
                        <Badge className={statusTone(invoice.status as never)}>{invoice.status}</Badge>
                      </Td>
                      <Td align="right">{money(invoice.total, invoice.currency)}</Td>
                      <Td align="right">
                        <span className={invoice.outstanding > 0 ? "font-semibold text-rose-600" : "text-slate-500"}>
                          {money(invoice.outstanding, invoice.currency)}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Top debtors" subtitle="Highest outstanding balance" bodyClassName="p-0">
          {stats.topDebtors.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Nothing outstanding" description="Every invoice has been settled." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.topDebtors.map((debtor) => (
                <li key={debtor.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <Link
                      href={`/customers/${debtor.id}`}
                      className="truncate text-sm font-semibold text-slate-800 hover:text-indigo-600"
                    >
                      {debtor.name}
                    </Link>
                    <p className="text-xs text-slate-500">{debtor.invoiceCount} invoices</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-rose-600">
                    {money(debtor.outstanding, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Latest receipts"
          subtitle="Every payment automatically creates a numbered receipt and its VAT component"
          bodyClassName="p-0"
          action={
            <Link href="/payments" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
              View all →
            </Link>
          }
        >
          {stats.recentPayments.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No payments recorded"
                description="Record a payment against an invoice and a receipt is generated instantly."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Receipt</Th>
                    <Th>Date</Th>
                    <Th>Customer</Th>
                    <Th align="right">Received</Th>
                    <Th align="right">VAT element</Th>
                    <Th>PDF</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.recentPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <Td>
                        <span className="font-semibold text-slate-800">{payment.receiptNumber}</span>
                      </Td>
                      <Td>{formatDate(payment.paymentDate)}</Td>
                      <Td>{payment.customerName}</Td>
                      <Td align="right">{money(payment.amount, currency)}</Td>
                      <Td align="right">{money(payment.vatAmount, currency)}</Td>
                      <Td>
                        <a
                          href={`/api/reports/receipt/${payment.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                        >
                          Receipt
                        </a>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="How VAT is calculated" subtitle="Cash-accounting scheme">
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                1
              </span>
              An invoice is raised with VAT shown per line — no VAT is declared yet.
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                2
              </span>
              A payment lands. The receipt is pro-rated across the invoice&apos;s blended VAT fraction.
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                3
              </span>
              VAT for the return period = the sum of the VAT elements of receipts dated inside that period.
            </li>
          </ol>
          <div className="mt-5 rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-300">
            <p className="font-semibold text-white">This quarter so far</p>
            <p className="mt-1">
              {money(stats.collectedThisQuarter, currency)} received →{" "}
              <span className="font-semibold text-amber-300">{money(stats.vatDueThisQuarter, currency)}</span> VAT
              due. Year to date: {money(stats.vatDueThisYear, currency)}.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
