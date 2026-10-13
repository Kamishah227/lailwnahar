import Link from "next/link";

import { InvoiceBuilder } from "@/components/InvoiceBuilder";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { getSettings, listCustomers } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;
  const [customers, settings] = await Promise.all([listCustomers(), getSettings()]);

  return (
    <>
      <PageHeader
        title="New invoice"
        description="Build the invoice line by line. VAT is calculated per line at the rate you choose."
      />

      {customers.length === 0 ? (
        <Card>
          <EmptyState
            title="You need a customer first"
            description="Invoices must be linked to a customer so payments and statements stay accurate."
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
        <InvoiceBuilder
          customers={customers}
          settings={settings}
          presetCustomerId={customerId ? Number(customerId) : undefined}
        />
      )}
    </>
  );
}
