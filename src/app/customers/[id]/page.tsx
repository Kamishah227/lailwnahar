import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Card, PageHeader, StatCard, Td, Th } from "@/components/ui";
import { formatDate, money, statusTone } from "@/lib/domain";
import { buildStatement, getSettings, listInvoices, listPayments } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) notFound();

  try {
    const [statement, settings, invoices, payments] = await Promise.all([
      buildStatement(customerId),
      getSettings(),
      listInvoices({ customerId }),
      listPayments({ customerId }),
    ]);
    const customer = statement.customer;
    const currency = settings.currency;

    return (
      <>
        <PageHeader title={customer.name} description={customer.address || "No billing address on file."}>
          <Link
            href={`/invoices/new?customerId=${customer.id}`}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            + New invoice
          </Link>
          <Link
            href={`/statements/${customer.id}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Open statement
          </Link>
          <a
            href={`/api/reports/statement/${customer.id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Statement PDF
          </a>
        </PageHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total invoiced" value={money(customer.invoicedTotal, currency)} tone="indigo" />
          <StatCard label="Total received" value={money(customer.paidTotal, currency)} tone="emerald" />
          <StatCard
            label="Balance due"
            value={money(statement.closingBalance, currency)}
            hint={statement.closingBalance > 0 ? "Open receivable" : "Settled in full"}
            tone={statement.closingBalance > 0 ? "rose" : "emerald"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Customer record" className="lg:col-span-1">
            <dl className="space-y-3 text-sm">
              {[
                ["Contact", customer.contactName || "—"],
                ["Email", customer.email || "—"],
                ["Phone", customer.phone || "—"],
                ["TRN / Tax ID", customer.taxId || "—"],
                ["Invoices", String(customer.invoiceCount)],
                ["Since", formatDate(customer.createdAt.slice(0, 10))],
              ].map(([term, value]) => (
                <div key={term} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{term}</dt>
                  <dd className="text-right text-sm text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
            {customer.notes && (
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                {customer.notes}
              </p>
            )}
          </Card>

          <Card
            className="lg:col-span-2"
            title="Account ledger"
            subtitle={`Invoices raised and payments received — running balance ${money(statement.closingBalance, currency)}`}
            bodyClassName="p-0"
          >
            <div className="max-h-[26rem] overflow-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Reference</Th>
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
                      <Td align="right">{row.debit ? money(row.debit, currency) : "—"}</Td>
                      <Td align="right">{row.credit ? money(row.credit, currency) : "—"}</Td>
                      <Td align="right">{money(row.balance, currency)}</Td>
                    </tr>
                  ))}
                  {statement.rows.length === 0 && (
                    <tr>
                      <Td className="text-slate-500">No transactions yet.</Td>
                      <Td> </Td>
                      <Td> </Td>
                      <Td> </Td>
                      <Td> </Td>
                      <Td> </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Invoices" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Issued</Th>
                    <Th>Status</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">Balance</Th>
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
                      </Td>
                      <Td>{formatDate(invoice.issueDate)}</Td>
                      <Td>
                        <Badge className={statusTone(invoice.status as never)}>{invoice.status}</Badge>
                      </Td>
                      <Td align="right">{money(invoice.total, invoice.currency)}</Td>
                      <Td align="right">{money(invoice.outstanding, invoice.currency)}</Td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr>
                      <Td className="text-slate-500">No invoices raised yet.</Td>
                      <Td> </Td>
                      <Td> </Td>
                      <Td> </Td>
                      <Td> </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Payments & receipts" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Receipt</Th>
                    <Th>Date</Th>
                    <Th align="right">Received</Th>
                    <Th align="right">VAT element</Th>
                    <Th align="right">PDF</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <Td>
                        <span className="font-mono text-xs">{payment.receiptNumber}</span>
                      </Td>
                      <Td>{formatDate(payment.paymentDate)}</Td>
                      <Td align="right">{money(payment.amount, currency)}</Td>
                      <Td align="right">{money(payment.vatAmount, currency)}</Td>
                      <Td align="right">
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
                  {payments.length === 0 && (
                    <tr>
                      <Td className="text-slate-500">No payments recorded yet.</Td>
                      <Td> </Td>
                      <Td> </Td>
                      <Td> </Td>
                      <Td> </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </>
    );
  } catch {
    notFound();
  }
}
