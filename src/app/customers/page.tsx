import { CustomersClient } from "@/components/CustomersClient";
import { PageHeader } from "@/components/ui";
import { getSettings, listCustomers } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customers, settings] = await Promise.all([listCustomers(), getSettings()]);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Maintain the billing identity for every client: contact details, address and tax identifiers."
      />
      <CustomersClient
        customers={customers}
        currency={settings.currency}
        defaultTaxLabel="Tax ID / VAT no."
      />
    </>
  );
}
