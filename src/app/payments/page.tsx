import { PaymentsClient } from "@/components/PaymentsClient";
import { PageHeader } from "@/components/ui";
import { getSettings, listInvoices, listPayments } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const [payments, invoices, settings] = await Promise.all([
    listPayments({ from, to, limit: 300 }),
    listInvoices({}),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Payments & receipts"
        description="Create, amend or delete receipts. Each one stores the VAT element recognised at the moment the cash arrived."
      >
        <form className="flex flex-wrap items-end gap-2" action="/payments">
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
            Filter
          </button>
        </form>
      </PageHeader>
      <PaymentsClient
        payments={payments}
        invoices={invoices}
        currency={settings.currency}
        from={from ?? ""}
        to={to ?? ""}
      />
    </>
  );
}
