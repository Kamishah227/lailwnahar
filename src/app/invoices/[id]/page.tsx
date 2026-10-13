import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceActions, PaymentForm } from "@/components/InvoiceDetailClient";
import { Badge, Card, PageHeader, StatCard, Td, Th } from "@/components/ui";
import { formatDate, money, statusTone, termsLabel } from "@/lib/domain";
import { getInvoice } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId)) notFound();

  let invoice;
  try {
    invoice = await getInvoice(invoiceId);
  } catch {
    notFound();
  }

  const currency = invoice.currency;

  return (
    <>
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        description={`${invoice.customerName} • issued ${formatDate(invoice.issueDate)}${
          invoice.dueDate ? ` • due ${formatDate(invoice.dueDate)}` : ""
        } • ${termsLabel(invoice.paymentTerms)}`}
      >
        <a
          href={`/api/reports/invoice/${invoice.id}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          Invoice PDF
        </a>
        <Link
          href={`/invoices/${invoice.id}/edit`}
          className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100"
        >
          Edit invoice
        </Link>
        <Link
          href={`/customers/${invoice.customerId}`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Customer statement
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invoice total" value={money(invoice.total, currency)} tone="indigo" />
        <StatCard label="VAT charged" value={money(invoice.vatTotal, currency)} tone="amber" hint="Awaiting cash" />
        <StatCard label="Received to date" value={money(invoice.paidTotal, currency)} tone="emerald" />
        <StatCard
          label="Balance outstanding"
          value={money(invoice.outstanding, currency)}
          tone={invoice.outstanding > 0 ? "rose" : "emerald"}
          hint={<Badge className={statusTone(invoice.status as never)}>{invoice.status}</Badge> as unknown as string}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title="Line items" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Description</Th>
                    <Th>Rate per</Th>
                    <Th align="right">Qty</Th>
                    <Th align="right">Unit price</Th>
                    <Th align="right">VAT %</Th>
                    <Th align="right">Net</Th>
                    <Th align="right">VAT</Th>
                    <Th align="right">Gross</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <Td className="max-w-xs whitespace-normal">
                        {item.description}
                        {item.subDescription && (
                          <span className="block text-xs font-normal text-slate-500">
                            {item.subDescription}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <Badge className="bg-slate-100 text-slate-600 ring-slate-200">
                          {item.ratePer}
                        </Badge>
                      </Td>
                      <Td align="right">{item.quantity.toFixed(2)}</Td>
                      <Td align="right">{money(item.unitPrice, currency)}</Td>
                      <Td align="right">{item.vatRate.toFixed(2)}%</Td>
                      <Td align="right">{money(item.lineNet, currency)}</Td>
                      <Td align="right">{money(item.lineVat, currency)}</Td>
                      <Td align="right" className="font-semibold">
                        {money(item.lineGross, currency)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <Td className="font-semibold text-slate-600">Totals</Td>
                    <Td> </Td>
                    <Td> </Td>
                    <Td> </Td>
                    <Td align="right" className="font-semibold">
                      {money(invoice.subtotal, currency)}
                    </Td>
                    <Td align="right" className="font-semibold">
                      {money(invoice.vatTotal, currency)}
                    </Td>
                    <Td align="right" className="font-semibold">
                      {money(invoice.total, currency)}
                    </Td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {invoice.notes && (
              <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{invoice.notes}</p>
            )}
          </Card>

          <Card
            title="Payment history"
            subtitle="Each receipt stores the VAT element recognised on the cash received"
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Receipt</Th>
                    <Th>Date</Th>
                    <Th>Method</Th>
                    <Th>Reference</Th>
                    <Th align="right">Received</Th>
                    <Th align="right">VAT element</Th>
                    <Th align="right">PDF</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <Td>
                        <span className="font-mono text-xs">{payment.receiptNumber}</span>
                      </Td>
                      <Td>{formatDate(payment.paymentDate)}</Td>
                      <Td>{payment.method}</Td>
                      <Td>{payment.reference || "—"}</Td>
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
                      <Td align="right">
                        <Link
                          href={`/payments?from=${payment.paymentDate}&to=${payment.paymentDate}#r${payment.id}`}
                          className="text-xs font-semibold text-slate-600 hover:text-indigo-600"
                        >
                          Edit
                        </Link>
                      </Td>
                    </tr>
                  ))}
                  {invoice.payments.length === 0 && (
                    <tr>
                      <Td className="text-slate-500">No payments recorded yet.</Td>
                      <Td> </Td>
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

        <div className="space-y-6">
          <Card title="Record a payment" subtitle={`Outstanding ${money(invoice.outstanding, currency)}`}>
            <PaymentForm
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoiceNumber}
              outstanding={invoice.outstanding}
              currency={currency}
            />
          </Card>

          <Card title="Invoice controls" subtitle="Voiding removes the invoice from VAT reports">
            <InvoiceActions invoiceId={invoice.id} status={invoice.storedStatus} />
          </Card>

          <Card title="Cash-basis VAT position">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">VAT charged on invoice</dt>
                <dd className="font-semibold tabular-nums">{money(invoice.vatTotal, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">VAT recognised (receipts)</dt>
                <dd className="font-semibold tabular-nums text-emerald-600">
                  {money(
                    invoice.payments.reduce((sum, payment) => sum + payment.vatAmount, 0),
                    currency,
                  )}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <dt className="text-slate-500">VAT deferred until paid</dt>
                <dd className="font-semibold tabular-nums text-amber-600">
                  {money(
                    invoice.vatTotal - invoice.payments.reduce((sum, payment) => sum + payment.vatAmount, 0),
                    currency,
                  )}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
