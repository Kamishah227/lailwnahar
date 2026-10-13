import { ExpensesClient } from "@/components/ExpensesClient";
import { PageHeader } from "@/components/ui";
import { ensureCategories, listExpenses } from "@/lib/expenses";
import { listVehicles } from "@/lib/fleet";
import { getSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type = "all" } = await searchParams;
  const [expenses, categories, vehicles, settings] = await Promise.all([
    listExpenses({ type: type === "direct" || type === "indirect" ? type : undefined }),
    ensureCategories(),
    listVehicles(),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Expenses & input VAT"
        description="Record purchase invoices with vendor details, categorise them as direct or indirect, attach the receipt image and claim the input VAT."
      />
      <ExpensesClient
        expenses={expenses}
        categories={categories}
        vehicles={vehicles}
        currency={settings.currency}
        typeFilter={type}
      />
    </>
  );
}
