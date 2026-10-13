import { DesktopAppBrowser } from "@/components/DesktopAppBrowser";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "1. Install Python 3.10+",
    body: "Download from python.org and tick “Add python.exe to PATH” during setup.",
  },
  {
    title: "2. Create the environment",
    body: "python -m venv .venv  →  .venv\\Scripts\\activate  →  pip install -r requirements.txt",
  },
  {
    title: "3. Run it",
    body: "python main.py  (or double-click run_ledgerlite.bat, which does steps 2 and 3 for you).",
  },
];

const MODULES = [
  {
    title: "Customer management",
    body: "Add, edit and delete customers with contact, billing address and tax ID. Customers with invoices are protected from deletion to preserve the audit trail.",
  },
  {
    title: "Invoice management",
    body: "Auto-numbered invoices (INV-0001…) with line items that each carry their own VAT rate. Live net / VAT / gross recalculation as you type.",
  },
  {
    title: "Payments & receipts",
    body: "Partial payments, balance validation, auto-numbered receipts (RCP-0001…) and a receipt PDF generated the moment a payment is posted.",
  },
  {
    title: "Statements",
    body: "Chronological ledger per customer — invoices as debits, receipts as credits, opening balance brought forward and a running balance on every line.",
  },
  {
    title: "Cash-basis VAT",
    body: "VAT is recognised only on cash received: vat = payment × (invoice VAT ÷ invoice gross), capped and snapshotted onto the receipt. Quarterly, yearly, monthly and custom reporting windows.",
  },
];

export default function DesktopPage() {
  return (
    <>
      <PageHeader
        title="Windows desktop application"
        description="The complete Python source for the LedgerLite desktop build: CustomTkinter UI, SQLite storage and fpdf2 documents. Browse every file here, then download the folder and run it locally."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{step.title}</p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-600">{step.body}</p>
          </div>
        ))}
      </div>

      <Card title="What the desktop build contains" subtitle="Mirrors the modules you are using in this web app">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((module) => (
            <div key={module.title} className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">{module.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{module.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 overflow-x-auto rounded-xl bg-slate-900 p-4">
          <p className="font-mono text-[11px] leading-relaxed text-slate-300">
            <span className="text-emerald-300"># vat.py — the cash-accounting rule</span>
            <br />
            def cash_vat_for_payment(payment_amount, invoice_gross, invoice_vat):
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;amount = money(payment_amount)
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;gross = money(invoice_gross)
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;vat = money(invoice_vat)
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;if gross &lt;= 0 or amount &lt;= 0:
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;return Decimal(&quot;0.00&quot;)
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;capped = amount if amount &lt;= gross else gross
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;return money(capped * vat / gross)
          </p>
        </div>
      </Card>

      <DesktopAppBrowser />

      <Card title="Notes on the data layer" subtitle="Identical schema in SQLite and PostgreSQL">
        <ul className="grid gap-3 text-xs leading-relaxed text-slate-600 md:grid-cols-2">
          <li className="rounded-lg bg-slate-50 p-3">
            <strong className="text-slate-800">Tables:</strong> customers, invoices, invoice_items,
            payments, settings — with foreign keys, cascade deletes and indices on customer, issue
            date and payment date.
          </li>
          <li className="rounded-lg bg-slate-50 p-3">
            <strong className="text-slate-800">Transactions:</strong> document numbering and line
            items are written in one transaction, so an invoice and its counter can never drift
            apart.
          </li>
          <li className="rounded-lg bg-slate-50 p-3">
            <strong className="text-slate-800">Money:</strong> every amount passes through
            <code className="mx-1 rounded bg-white px-1">Decimal</code>with ROUND_HALF_UP — no float
            drift in your VAT return.
          </li>
          <li className="rounded-lg bg-slate-50 p-3">
            <strong className="text-slate-800">Errors:</strong> each call opens a connection, commits
            on success and rolls back on failure; failures raise a friendly DatabaseError message
            box rather than crashing.
          </li>
        </ul>
      </Card>
    </>
  );
}
