# LEDGERLITE — MASTER BUILD PROMPT (A → Z)

> Copy everything below this line as a single prompt to regenerate the entire project.

---

## 1. ROLE & OBJECTIVE

Act as a **Senior Full-Stack Software Engineer and Software Architect**.

Build **LedgerLite**, a complete billing, VAT-compliance and fleet-management system for a small plant-hire / heavy-equipment rental and haulage business. It must cover: customers, invoicing with a plant catalogue, payment receipts with automatic reconciliation, customer statements, cash-basis VAT returns with input-VAT recovery, expense tracking with receipt attachments, a vehicle fleet module with per-asset profit & loss, a legal-document register with expiry tracking, and branded PDF output for every document.

Deliver **two applications that share one domain model**:

1. a **web application** (the primary, always-working product), and
2. a **Windows desktop application** in Python that mirrors the same schema, business rules and PDF output.

Both must be complete, production-quality, modular, and fully validated.

---

## 2. TECH STACK

### Web application
| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), React, TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| PDF | `pdf-lib` (pure JS, no native deps) |

### Desktop application
| Layer | Technology |
|---|---|
| Language | Python 3.10+ |
| GUI | CustomTkinter |
| Database | SQLite (single `ledgerlite.db`, zero configuration) |
| PDF | fpdf2 |
| Extras | only `customtkinter` + `fpdf2` in `requirements.txt` |

---

## 3. ARCHITECTURE & FOLDER STRUCTURE

```
src/
  db/
    schema.ts            # all Drizzle table definitions
    index.ts             # pooled connection, reads DATABASE_URL
  lib/
    domain.ts            # PURE domain logic: money, VAT engine, periods, catalogues
    documentsShared.ts   # pure document status/sort helpers (client-safe)
    documents.ts         # document repo (server-only)
    expenses.ts          # expense repo + input-VAT totals
    fleet.ts             # vehicles, income, salaries, P&L, fleet report
    repo.ts              # customers, invoices, payments, statements, dashboard
    vatReport.ts         # full VAT return (output less input)
    pdf.ts               # invoice / receipt / statement PDFs
    reportsPdf.ts        # VAT return / vehicle P&L / fleet summary PDFs
    api.ts               # JSON helpers, error mapping, id parsing
  app/
    page.tsx                     # dashboard
    customers/  customers/[id]/
    invoices/   invoices/new/    invoices/[id]/   invoices/[id]/edit/
    payments/   statements/      statements/[customerId]/
    expenses/   vehicles/        vehicles/[id]/
    documents/  reports/         settings/        desktop/
    api/…                       # REST route handlers
  components/              # one client component per interactive screen
public/
  logo.png                 # company logo used in every PDF header
  desktop-app/             # the complete Python source + README + .bat
  LedgerLite-desktop.zip   # downloadable bundle
```

**Rules**
- Domain logic lives in pure modules with no DB or React imports.
- Client components must never import a module that touches the database — split pure helpers into a separate `*Shared.ts` file.
- Server components fetch data by calling repo functions directly (no internal HTTP calls).
- Every repo function wraps its queries in `try/catch` and routes failures through one error handler that maps DB errors to friendly HTTP responses.

---

## 4. DATABASE SCHEMA

### `customers`
`id, name*, contact_name, email, phone, address, tax_id (TRN), notes, is_active (default true), created_at`
Index on `name`.

### `invoices`
`id, customer_id* → customers (cascade), invoice_number* (unique), issue_date* (date), due_date (date), payment_terms* (default '30'), currency* (default 'USD'), po_number, notes, status* (default 'open'), subtotal*, vat_total*, total* (numeric 14,2), created_at`
Indexes: unique `invoice_number`, `customer_id`, `issue_date`.

### `invoice_items`
`id, invoice_id* → invoices (cascade), position, description* (text), sub_description (text), rate_per* (default 'Per Trip'), quantity* (numeric 14,3), unit_price* (numeric 14,2), vat_rate* (numeric 5,2 default 5), line_net*, line_vat*, line_gross* (numeric 14,2)`
Index: `invoice_id`.

### `payments`
`id, invoice_id* → invoices (cascade), customer_id* → customers (cascade), receipt_number* (unique), payment_date* (date), amount* (numeric 14,2), vat_amount* (numeric 14,2) — the cash-basis VAT snapshot, method*, reference, note, created_at`
Indexes: unique `receipt_number`, `payment_date`, `customer_id`.

### `settings` (single row, `id = 1`)
`business_name, business_address, vat_number (TRN), default_vat_rate (default 5), currency, invoice_prefix (default 'INV-'), next_invoice_number, receipt_prefix (default 'RCP-'), next_receipt_number, vat_scheme (default 'cash'), updated_at`

### `expense_categories`
`id, name* (unique), type* ('direct' | 'indirect')`
Seed: Fuel, Vehicle maintenance, Tyres, Tolls & parking, Driver allowance (direct); Office rent, Utilities, Accounting & legal, Insurance, Marketing (indirect).

### `expenses`
`id, expense_number* (unique, EXP-0001…), expense_date*, vendor_name*, vendor_tax_id, vendor_invoice_ref, description*, category_id → expense_categories (set null), type* ('direct'|'indirect'), vehicle_id → vehicles (set null), net_amount*, vat_rate* (default 5), vat_amount* (input VAT), gross_amount*, payment_method, notes, attachment_name, attachment_type, attachment_size, attachment_data (base64 text), created_at`
Indexes: `expense_date`, `vehicle_id`.

### `vehicles`
`id, code* (unique, e.g. TRK-001), make*, model, year, plate_number*, status* (active|maintenance|idle|sold, default active), assigned_operator, operator_monthly_salary* (default 0), purchased_at, notes, created_at`

### `vehicle_income`
`id, vehicle_id* → vehicles (cascade), income_date*, description*, customer_name, invoice_number, rate_per, quantity* (default 1), net_amount*, vat_rate*, vat_amount*, gross_amount*, notes, created_at`

### `operator_salaries`
`id, vehicle_id* → vehicles (cascade), operator_name*, period_label* (YYYY-MM), payment_date*, amount*, notes, created_at`

### `documents`
`id, title*, document_number, category* (default 'Other'), issuer, holder_name, vehicle_id → vehicles (set null), issued_date, expiry_date, renewal_date, renewal_lead_days (default 30), notes, attachment_name, attachment_type, attachment_size, attachment_data, created_at`
Indexes: `expiry_date`, `vehicle_id`.
Categories: Vehicle registration, Vehicle insurance, Vehicle inspection, Driving licence, Operator permit, Business licence, Contract, Lease, Tax certificate, Health & safety, Other.

**Postgres gotcha:** `0000-01-01` is not a valid date. Use `1000-01-01` as the "all time" lower bound.

---

## 5. BUSINESS RULES (CRITICAL — DO NOT DEVIATE)

### 5.1 Money
- All arithmetic uses 2-decimal half-up rounding.
- Never use floating point for stored values; round on write and on read.

### 5.2 VAT rate is FIXED at 5%
- A single constant `FIXED_VAT_RATE = 5`.
- The UI shows the VAT field as read-only, labelled "fixed".
- The server **overrides** any client-supplied rate before persisting. A hand-crafted request must not be able to store a different rate.

### 5.3 Cash-accounting scheme (the core rule)
> **VAT is recognised only when money is received. The invoice total and the invoice date are NEVER used to build a VAT return.**

For each receipt:
```
vat_on_receipt = payment_amount × (invoice_vat_total ÷ invoice_gross_total)
```
- Capped so VAT can never exceed the VAT originally chargeable.
- A part payment recognises exactly its pro-rata share of VAT (a 40% payment = 40% of the VAT).
- The result is **snapshotted onto the payment row**, so later edits to an invoice never rewrite a filed return.

### 5.4 Invoice numbering
- `INV-0001`, `RCP-0001`, `EXP-0001` … allocated from counters.
- Allocation and insert happen in **one transaction** with a row lock, so numbers can never be reused or skipped.

### 5.5 Due date is derived
`due_date = issue_date + payment_terms`, where terms ∈ {Cash (0), 15, 30, 45, 60, 90} days. Shown read-only next to the dropdown so the two can never disagree.

### 5.6 Line locking
Once receipts are posted against an invoice, **line items are locked** (editing them would change VAT already declared). The header — customer, dates, payment terms, PO reference, notes — remains editable. Editing must return a clear notice, never fail silently, and must not alter the stored subtotal/VAT/total.

### 5.7 Audit protections
- A customer with invoices cannot be deleted.
- Payment amounts may not exceed the balance available (invoice total minus all *other* receipts on that invoice).
- Deleting a receipt restores the invoice balance immediately.

### 5.8 Invoice status derivation
`paid` (paid ≥ total) · `partial` (paid > 0) · `overdue` (past due date, nothing paid) · `open` · `void`

### 5.9 Vehicle revenue is NOT on the VAT return
Output VAT is built **only** from customer payment receipts. Revenue booked directly against a vehicle is reported through the fleet module and must not appear on the tax return.

### 5.10 Document ordering
The document register is always ordered by urgency:
1. the document that expired **most recently** first,
2. then the next document due to expire,
3. then the rest,
4. and finally documents with no expiry date.

Status: `expired` / `expiring` (within the reminder window) / `valid` / `no-expiry`, with human labels like "Expired 12 days ago" and "Expires in 15 days".

---

## 6. MODULES

### A. Dashboard (`/`)
Top of page — **"Documents due for attention"** panel: four count tiles (Expired / Expiring soon / Valid / On file) plus the six most urgent documents with status, expiry and renewal dates, and a link into the register.
Below it: KPI cards (outstanding receivables, overdue, collected this quarter, VAT due this quarter), recent invoices, latest receipts with their VAT element, top debtors, and a "How VAT is calculated" explainer.
`F5` refreshes on the desktop build.

### B. Customers (`/customers`, `/customers/[id]`)
- Full CRUD. Fields: Name*, Contact Person, Phone, Email, **TRN / Tax ID**, Address, Notes.
- Register shows invoiced / received / outstanding per customer, with search.
- Detail page: statement ledger (see E), invoices list, payments list, customer record panel.

### C. Invoices (`/invoices`, `/invoices/new`, `/invoices/[id]`, `/invoices/[id]/edit`)
Full CRUD.

**Line items** — each has:
| Field | Control |
|---|---|
| Description* | Combo box — dropdown **and** free text. Pre-filled with the plant catalogue |
| Sub-description | Free text, shown under the description on screen and in the PDF |
| Rate per* | Dropdown: `Per Hour`, `Per Day`, `Monthly`, `Per Trip` |
| Qty* | Number |
| Unit price* | Number |
| VAT % | Fixed 5%, read-only |

**Plant catalogue** (pre-filled description options):
`Hiring charges of JCB 3CX` · `JCB BOOMLOADER` · `SHOVEL` · `MOBILE CRANE` · `TRAILER` · `SIX WHEEL`
Plus one-click "Quick add" chips for each, and free text always allowed.

**Header:** customer*, issue date, payment terms dropdown (Cash / Net 15 / 30 / 45 / 60 / 90), auto-derived read-only due date, PO/reference, notes.

**Live totals:** net, VAT @ 5%, invoice total; on edit also the balance outstanding.

Detail page: line items, payment history with each receipt's VAT element, cash-basis VAT position (charged vs recognised vs deferred), record-payment form with 25% / 50% / full shortcuts, void/restore, delete, invoice PDF.

### D. Payments & receipts (`/payments`)
Full CRUD with a **cascading form**:
1. **Customer selector** — lists only customers with a pending balance, showing that balance.
2. **Pending invoices dropdown** — only that customer's unpaid/partially-paid invoices, each showing the amount due and its status.
3. **Payment method** — `Cash`, `PDC`, `Bank Transfer`, `Other`.
4. Amount received*, payment date*, reference/cheque number, notes.
5. Live preview of the VAT element and the net receipt.

Creating a payment: validates the balance, computes the cash-basis VAT, allocates the next receipt number transactionally, and returns the receipt PDF path. Editing recalculates the VAT from the new amount. Deleting restores the invoice balance.

Register columns: receipt, date, customer, invoice, method, reference, gross, VAT (cash), PDF link, Edit, Delete. Date-range filter.

### E. Customer statements (`/statements`, `/statements/[customerId]`)
- `/statements`: one row per customer from a **single SQL query** (CTEs — no N+1): docs count, opening balance, invoiced in period, received in period, closing balance, live "owed now", Open + PDF actions. Presets: All time / This year / Last 90 days, plus free from–to.
- Detail page: chronological ledger — invoices are debits, receipts are credits, opening balance brought forward, running balance on every row, closing totals. Invoice numbers link to the invoice. Statement PDF.

### F. VAT reporting (`/reports`)
Monthly / quarterly / yearly / custom range. The **full VAT return**:

| Box | Content |
|---|---|
| 1 | Taxable sales — net cash received from customers |
| 2 | **Output VAT collected** |
| 3 | Direct expenses (net) |
| 4 | Indirect expenses (net) |
| 5 | **Input VAT claimable** |
| PAY / CR | **Net VAT payable / refundable** |

Plus: a supporting schedule of every receipt behind the output VAT, an input-VAT analysis split by direct vs indirect, a derivation explainer, and the same-window **fleet comparison** table. Downloadable return PDF.

### G. Expenses (`/expenses`)
Full CRUD. Direct (fuel, maintenance, tyres, tolls, driver allowance — attributable to a vehicle) vs Indirect (rent, utilities, accounting, insurance, marketing). Vendor name, vendor TRN, vendor invoice number, description, category, date, net amount, payment method, notes, and a **receipt/invoice image or PDF attachment** (≤ 5 MB web / copied to `attachments/` on desktop) served back on demand. Input VAT captured automatically at 5%.

### H. Vehicles (`/vehicles`, `/vehicles/[id]`)
- Master profile: fleet code, make, model, year, plate number, status, assigned operator, contracted monthly salary, in-service date, notes.
- Per-vehicle ledger: revenue booked to the asset (qty × rate on a Per Hour/Day/Month/Trip basis), direct operating expenses attributed from the expense register, operator salary payments by period.
- **Per-vehicle P&L:** gross revenue → net revenue → direct expenses → operator salary → total costs → **net profit and margin**, with PDF export.
- **Fleet comparison:** all vehicles ranked by profit over any date range, with bars, best performer, weakest asset, highest-cost vehicle, and a fleet summary PDF.
- Indirect overheads are deliberately excluded from the per-vehicle P&L (they belong to the VAT return) so asset profitability isn't distorted.

### I. Documents (`/documents`)
Full CRUD for every legal document. Register ordered by the urgency rule (5.10). Filters: All / Needs attention / Expired / Expiring / Valid. Fields: title, document number, category, issuer, holder, link to vehicle, issued date, expiry date, renewal date, reminder window, notes, attachment. The renewal date auto-suggests two weeks before the expiry date.

### J. Settings (`/settings`)
Business name, address, TRN/VAT number, currency, default VAT rate, VAT scheme, invoice & receipt prefixes and next numbers. Save re-renders the shell.

### K. Windows app page (`/desktop`)
Browses every Python source file with line numbers, per-file download, and a `LedgerLite-desktop.zip` bundle. Shows install steps and the module map.

---

## 7. API SURFACE

```
GET  /api/health
GET  /api/dashboard

GET  /api/customers            POST /api/customers
GET  /api/customers/[id]       PATCH /api/customers/[id]    DELETE /api/customers/[id]

GET  /api/invoices             POST /api/invoices
GET  /api/invoices/[id]        PATCH /api/invoices/[id]    DELETE /api/invoices/[id]

GET  /api/payments             POST /api/payments
                                 PUT  /api/payments/[id]    DELETE /api/payments/[id]

GET  /api/statements/[customerId]
GET  /api/vat/report?period=month|quarter|year|custom&year&quarter&month&from&to

GET  /api/expenses             POST /api/expenses          (JSON or multipart with attachment)
                                 DELETE /api/expenses/[id]
GET  /api/expenses/[id]/attachment

GET  /api/vehicles             POST /api/vehicles
GET  /api/vehicles/[id]        PATCH /api/vehicles/[id]    DELETE /api/vehicles/[id]

GET  /api/fleet/entries        POST /api/fleet/entries     (kind: income | salary)
                                 DELETE /api/fleet/entries?id&kind
GET  /api/fleet/report?from&to[&vehicleId]

GET  /api/documents            POST /api/documents         (JSON or multipart)
                                 DELETE /api/documents/[id]
GET  /api/documents/[id]/attachment

GET  /api/settings             PUT  /api/settings
POST /api/seed

GET  /api/reports/invoice/[id]
GET  /api/reports/receipt/[id]
GET  /api/reports/statement/[customerId]
GET  /api/reports/vat
GET  /api/reports/fleet
GET  /api/reports/vehicle/[id]
```

Every response is `{ ok: true, data }` or `{ ok: false, error }` with a correct status code. Multipart endpoints accept the file in an `attachment` field.

---

## 8. PDF TEMPLATES (A4, 595.28 × 841.89 pt)

Common to all documents:
- **Company logo** top-left in the header (embedded PNG).
- Business name beside the logo; address lines and `TRN / VAT: <number>` beneath.
- Document title right-aligned in the accent colour, subtitle under it.
- An accent rule closes the header band.
- **Explicit margins**: `TOP_MARGIN 56`, `BOTTOM_MARGIN 64`, `SIDE_MARGIN 44`. Every table row checks for remaining space and paginates before drawing, so nothing is ever clipped.
- Latin-1-safe text only (core fonts) — strip non-encodable characters.
- Save with `useObjectStreams: false` for wide viewer compatibility.

**Invoice** — bill-to block, invoice date / payment terms / due date / status, line-item table (Description + sub-description, Rate per, Qty, Unit price, VAT %, Net, Gross), subtotal / VAT / total rows, then a bordered **summary box** with `Total`, `Paid Amount`, `Balance Due` (Balance Due emphasised), the **balance in words**, a status strip ("STATUS: PAID IN FULL" or "STATUS: PARTIAL … outstanding"), and the payment history.

**Receipt** — received-from / against-invoice / receipt number / date / method, large amount-received figure, a **reconciliation box** with `Invoice total`, `Paid to date`, `This receipt`, `Balance remaining`, the cash-basis VAT breakdown, a settlement status line, the cash-accounting note, and a signature line.

**Statement** — customer header, opening balance, ledger with debit/credit/balance, closing totals.

**VAT return** — six boxes, net VAT payable/refundable headline, supporting receipt schedule, input-VAT memo.

**Vehicle P&L** — net profit headline, revenue → costs → profit table, vehicle profile block.

**Fleet summary** — fleet net profit headline, per-vehicle comparison table with totals row.

---

## 9. UI / UX REQUIREMENTS

- Dark fixed sidebar navigation + light content area; responsive down to mobile with a hamburger menu.
- Nav order: Dashboard, Customers, Invoices, Payments, Statements, Expenses, Vehicles, Documents, VAT reports, Settings, Windows app.
- Cards with 1px borders and soft shadows; stat cards with a coloured top bar.
- Tabular numerals for all money; `Intl.NumberFormat` currency formatting.
- Status badges colour-coded: paid=emerald, partial=amber, overdue/partial=rose, open=sky, void=slate.
- Every mutation surfaces success/error inline; destructive actions confirm first.
- Tables scroll independently with sticky headers.
- Empty states always offer the next action.

---

## 10. SEED / DEMO DATA (`POST /api/seed`)

Loads only when the database is empty:
- Settings: a plant-hire business with name, address, TRN.
- 4 customers (one with no invoices yet).
- 5 invoices using the plant catalogue and all four rate types, across a spread of payment terms (Cash/15/30/45/60/90).
- 7 receipts spread over several quarters — some invoices fully settled, some partial, some unpaid — so the cash-basis VAT report differs visibly from the invoice-basis memo.
- 3 vehicles with operators and contracted salaries.
- Per-vehicle revenue, operator salary payments.
- 10 expenses (direct attributed to vehicles + indirect overheads) so input VAT is claimable.
- 11 legal documents with a deliberate spread: some expired by a few days, one expired long ago, some expiring soon, some valid far out, and two with no expiry — to demonstrate the urgency ordering.

---

## 11. PYTHON DESKTOP MIRROR

Files: `main.py` (entry + seed), `app.py` (CustomTkinter shell, views, dialogs), `database.py` (SQLite schema + CRUD), `vat.py` (money, VAT engine, periods), `fleet.py` (expenses, vehicles, P&L, VAT return), `documents.py` (document register), `reports.py` (fpdf2 documents), `requirements.txt`, `run_ledgerlite.bat`, `README.md`.

Requirements:
- `python main.py` or double-click `run_ledgerlite.bat` (creates the venv and installs dependencies on first run).
- Schema created on launch; demo data seeded on first run.
- Attachments copied into an `attachments/` folder; PDFs written to `Documents/LedgerLite` (or a local `output/` fallback) and opened automatically.
- Same catalogues, same fixed 5% VAT, same cash-accounting rule, same urgency ordering, same business rules (5.1–5.10).
- Every DB call opens its own connection with `PRAGMA foreign_keys = ON`, commits on success, rolls back on failure, and raises a friendly `DatabaseError`.
- Money uses `Decimal` with `ROUND_HALF_UP`.

---

## 12. VALIDATION (MUST ALL PASS BEFORE FINISHING)

1. `npx next typegen`
2. `npm exec tsc -- --noEmit --pretty false`
3. `npm run build`
4. Start the production server and verify `/api/health`.
5. Apply schema changes with `npx drizzle-kit push`.
6. Functional smoke tests:
   - seed loads
   - every page returns 200
   - customer create / update / delete
   - invoice create / update / delete
   - payment create / **edit** / delete with VAT recalculated and the statement balance reconciling
   - over-payment rejected
   - line items locked after a payment, but the header still editable and totals unchanged
   - every PDF endpoint returns `application/pdf` with the expected text present
   - document register ordered most-recently-expired first
7. Python: every module passes `ast.parse`; run the engine headless and confirm the figures match the web app exactly.

---

## 13. ACCEPTANCE CRITERIA

- All four core feature sets (customers, invoices, PDFs, payments + reconciliation) work end to end with full CRUD.
- Output VAT is derived only from receipts; input VAT only from recorded purchase invoices; the net position is stated as payable or refundable.
- Every PDF is A4, branded with the logo, shows the TRN, and contains a Total / Paid / Balance summary box with no clipped text.
- Payment entry cascades customer → pending invoices, offers Cash / PDC / Bank Transfer / Other, and reconciles the invoice status and the customer statement balance in real time.
- The fleet module reports per-vehicle and fleet-wide profitability.
- The document register surfaces what has expired, in urgency order, on the dashboard and in its own section.
