import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceBuilder } from "@/components/InvoiceBuilder";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate, termsLabel } from "@/lib/domain";
import { getInvoice, getSettings, listCustomers } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) notFound();

  let invoice;
  try {
    invoice = await getInvoice(invoiceId);
  } catch {
    notFound();
  }

  const [customers, settings] = await Promise.all([listCustomers(), getSettings()]);
  const linesLocked = invoice.payments.length > 0;

  return (
    <>
      <PageHeader
        title={`Edit ${invoice.invoiceNumber}`}
        description={`${invoice.customerName} • issued ${formatDate(invoice.issueDate)} • ${termsLabel(invoice.paymentTerms)}`}
      >
        <Link
          href={`/invoices/${invoice.id}`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Back to invoice
        </Link>
      </PageHeader>

      {invoice.storedStatus === "void" && (
        <Card>
          <EmptyState
            title="This invoice is void"
            description="Restore it from the invoice page before making changes."
          />
        </Card>
      )}

      {customers.length === 0 ? (
        <Card>
          <EmptyState
            title="No customers available"
            description="Create a customer before editing this invoice."
            action={
              <Link
                href="/customers"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Go to customers
              </Link>
            }
          />
        </Card>
      ) : (
        <InvoiceBuilder customers={customers} settings={settings} invoice={invoice} />
      )}

      {linesLocked && (
        <p className="px-1 text-xs text-slate-500">
          {invoice.payments.length} receipt(s) are posted against this invoice, so only the header
          details can be amended. Delete the receipts first if you need to change the line items.
        </p>
      )}
    </>
  );
}
