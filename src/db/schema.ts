import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * LedgerLite schema.
 *
 * Mirrors the SQLite schema used by the Windows desktop build
 * (see /public/desktop-app/database.py) so both applications share the
 * same domain model:
 *
 *   customers ─┬─< invoices ─┬─< invoice_items
 *              └─< payments ─┘
 */

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    taxId: text("tax_id"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("customers_name_idx").on(table.name)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").notNull(),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    paymentTerms: text("payment_terms").notNull().default("30"),
    currency: text("currency").notNull().default("USD"),
    poNumber: text("po_number"),
    notes: text("notes"),
    status: text("status").notNull().default("open"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    vatTotal: numeric("vat_total", { precision: 14, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("invoices_number_uidx").on(table.invoiceNumber),
    index("invoices_customer_idx").on(table.customerId),
    index("invoices_issue_date_idx").on(table.issueDate),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: serial("id").primaryKey(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    description: text("description").notNull(),
    subDescription: text("sub_description"),
    // --- NEW DATE FIELDS FOR LINE ITEMS ---
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    // --------------------------------------
    ratePer: text("rate_per").notNull().default("Trip"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull().default("1"),
    // scale 6 so an hourly rate derived from a monthly rate (monthly / 260)
    // survives storage and keeps rate-per-hour x qty equal to the monthly rate
    unitPrice: numeric("unit_price", { precision: 14, scale: 6 }).notNull().default("0"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    lineNet: numeric("line_net", { precision: 14, scale: 2 }).notNull().default("0"),
    lineVat: numeric("line_vat", { precision: 14, scale: 2 }).notNull().default("0"),
    lineGross: numeric("line_gross", { precision: 14, scale: 2 }).notNull().default("0"),
  },
  (table) => [index("invoice_items_invoice_idx").on(table.invoiceId)],
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    receiptNumber: text("receipt_number").notNull(),
    paymentDate: date("payment_date").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    /**
     * VAT recognised on this cash receipt (cash-accounting scheme).
     * Snapshot at posting time so historical returns never drift when
     * rates or invoice lines change later.
     */
    vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    method: text("method").notNull().default("Bank transfer"),
    reference: text("reference"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payments_receipt_uidx").on(table.receiptNumber),
    index("payments_payment_date_idx").on(table.paymentDate),
    index("payments_customer_idx").on(table.customerId),
  ],
);

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  businessName: text("business_name").notNull().default("LedgerLite Ltd"),
  businessAddress: text("business_address").notNull().default(""),
  vatNumber: text("vat_number").notNull().default(""),
  defaultVatRate: numeric("default_vat_rate", { precision: 5, scale: 2 }).notNull().default("5"),
  currency: text("currency").notNull().default("USD"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
  receiptPrefix: text("receipt_prefix").notNull().default("RCP-"),
  nextReceiptNumber: integer("next_receipt_number").notNull().default(1),
  vatScheme: text("vat_scheme").notNull().default("cash"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Settings = typeof settings.$inferSelect;

/* ------------------------------------------------------------------ *
 * Expenses (direct / indirect) with claimable input VAT
 * ------------------------------------------------------------------ */

export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    /** direct = vehicle / operating cost, indirect = admin & overhead */
    type: text("type").notNull().default("direct"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("expense_categories_name_uidx").on(table.name)],
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: serial("id").primaryKey(),
    /** Vehicle ID / fleet code, e.g. TRK-001 */
    code: text("code").notNull(),
    make: text("make").notNull(),
    model: text("model"),
    year: integer("year"),
    plateNumber: text("plate_number").notNull(),
    /** active | maintenance | idle | sold */
    status: text("status").notNull().default("active"),
    assignedOperator: text("assigned_operator"),
    operatorMonthlySalary: numeric("operator_monthly_salary", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    purchasedAt: date("purchased_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("vehicles_code_uidx").on(table.code)],
);

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    expenseNumber: text("expense_number").notNull(),
    expenseDate: date("expense_date").notNull(),
    vendorName: text("vendor_name").notNull(),
    vendorTaxId: text("vendor_tax_id"),
    vendorInvoiceRef: text("vendor_invoice_ref"),
    description: text("description").notNull(),
    categoryId: integer("category_id").references(() => expenseCategories.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull().default("direct"),
    vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("5"),
    /** Input VAT claimable on this purchase. */
    vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    grossAmount: numeric("gross_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    paymentMethod: text("payment_method"),
    notes: text("notes"),
    attachmentName: text("attachment_name"),
    attachmentType: text("attachment_type"),
    attachmentSize: integer("attachment_size"),
    /** base64 payload of the uploaded receipt / vendor invoice image */
    attachmentData: text("attachment_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("expenses_number_uidx").on(table.expenseNumber),
    index("expenses_date_idx").on(table.expenseDate),
    index("expenses_vehicle_idx").on(table.vehicleId),
  ],
);

/* ------------------------------------------------------------------ *
 * Per-vehicle financial ledger
 * ------------------------------------------------------------------ */

export const vehicleIncome = pgTable(
  "vehicle_income",
  {
    id: serial("id").primaryKey(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    incomeDate: date("income_date").notNull(),
    description: text("description").notNull(),
    customerName: text("customer_name"),
    invoiceNumber: text("invoice_number"),
    ratePer: text("rate_per"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull().default("1"),
    netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("5"),
    vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    grossAmount: numeric("gross_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("vehicle_income_vehicle_idx").on(table.vehicleId)],
);

export const operatorSalaries = pgTable(
  "operator_salaries",
  {
    id: serial("id").primaryKey(),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    operatorName: text("operator_name").notNull(),
    /** Salary period, e.g. 2026-08 */
    periodLabel: text("period_label").notNull(),
    paymentDate: date("payment_date").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("operator_salaries_vehicle_idx").on(table.vehicleId)],
);

/* ------------------------------------------------------------------ *
 * Legal documents register (registration, licences, permits, contracts)
 * ------------------------------------------------------------------ */

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    documentNumber: text("document_number"),
    /** Vehicle registration, Insurance policy, Driving licence, Business licence, Contract … */
    category: text("category").notNull().default("Other"),
    issuer: text("issuer"),
    holderName: text("holder_name"),
    vehicleId: integer("vehicle_id").references(() => vehicles.id, {
      onDelete: "set null",
    }),
    issuedDate: date("issued_date"),
    expiryDate: date("expiry_date"),
    renewalDate: date("renewal_date"),
    /** How many days before expiry a renewal reminder should appear. */
    renewalLeadDays: integer("renewal_lead_days").notNull().default(30),
    notes: text("notes"),
    attachmentName: text("attachment_name"),
    attachmentType: text("attachment_type"),
    attachmentSize: integer("attachment_size"),
    attachmentData: text("attachment_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("documents_expiry_idx").on(table.expiryDate),
    index("documents_vehicle_idx").on(table.vehicleId),
  ],
);


// import {
//   boolean,
//   date,
//   index,
//   integer,
//   numeric,
//   pgTable,
//   serial,
//   text,
//   timestamp,
//   uniqueIndex,
// } from "drizzle-orm/pg-core";

// /**
//  * LedgerLite schema.
//  *
//  * Mirrors the SQLite schema used by the Windows desktop build
//  * (see /public/desktop-app/database.py) so both applications share the
//  * same domain model:
//  *
//  *   customers ─┬─< invoices ─┬─< invoice_items
//  *              └─< payments ─┘
//  */

// export const customers = pgTable(
//   "customers",
//   {
//     id: serial("id").primaryKey(),
//     name: text("name").notNull(),
//     contactName: text("contact_name"),
//     email: text("email"),
//     phone: text("phone"),
//     address: text("address"),
//     taxId: text("tax_id"),
//     notes: text("notes"),
//     isActive: boolean("is_active").notNull().default(true),
//     createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
//   },
//   (table) => [index("customers_name_idx").on(table.name)],
// );

// export const invoices = pgTable(
//   "invoices",
//   {
//     id: serial("id").primaryKey(),
//     customerId: integer("customer_id")
//       .notNull()
//       .references(() => customers.id, { onDelete: "cascade" }),
//     invoiceNumber: text("invoice_number").notNull(),
//     issueDate: date("issue_date").notNull(),
//     dueDate: date("due_date"),
//     paymentTerms: text("payment_terms").notNull().default("30"),
//     currency: text("currency").notNull().default("USD"),
//     poNumber: text("po_number"),
//     notes: text("notes"),
//     status: text("status").notNull().default("open"),
//     subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
//     vatTotal: numeric("vat_total", { precision: 14, scale: 2 }).notNull().default("0"),
//     total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
//     createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
//   },
//   (table) => [
//     uniqueIndex("invoices_number_uidx").on(table.invoiceNumber),
//     index("invoices_customer_idx").on(table.customerId),
//     index("invoices_issue_date_idx").on(table.issueDate),
//   ],
// );

// export const invoiceItems = pgTable(
//   "invoice_items",
//   {
//     id: serial("id").primaryKey(),
//     invoiceId: integer("invoice_id")
//       .notNull()
//       .references(() => invoices.id, { onDelete: "cascade" }),
//     position: integer("position").notNull().default(0),
//     description: text("description").notNull(),
//     subDescription: text("sub_description"),
//     ratePer: text("rate_per").notNull().default("Trip"),
//     quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull().default("1"),
//     // scale 6 so an hourly rate derived from a monthly rate (monthly / 260)
//     // survives storage and keeps rate-per-hour x qty equal to the monthly rate
//     unitPrice: numeric("unit_price", { precision: 14, scale: 6 }).notNull().default("0"),
//     vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("0"),
//     lineNet: numeric("line_net", { precision: 14, scale: 2 }).notNull().default("0"),
//     lineVat: numeric("line_vat", { precision: 14, scale: 2 }).notNull().default("0"),
//     lineGross: numeric("line_gross", { precision: 14, scale: 2 }).notNull().default("0"),
//   },
//   (table) => [index("invoice_items_invoice_idx").on(table.invoiceId)],
// );

// export const payments = pgTable(
//   "payments",
//   {
//     id: serial("id").primaryKey(),
//     invoiceId: integer("invoice_id")
//       .notNull()
//       .references(() => invoices.id, { onDelete: "cascade" }),
//     customerId: integer("customer_id")
//       .notNull()
//       .references(() => customers.id, { onDelete: "cascade" }),
//     receiptNumber: text("receipt_number").notNull(),
//     paymentDate: date("payment_date").notNull(),
//     amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
//     /**
//      * VAT recognised on this cash receipt (cash-accounting scheme).
//      * Snapshot at posting time so historical returns never drift when
//      * rates or invoice lines change later.
//      */
//     vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
//     method: text("method").notNull().default("Bank transfer"),
//     reference: text("reference"),
//     note: text("note"),
//     createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
//   },
//   (table) => [
//     uniqueIndex("payments_receipt_uidx").on(table.receiptNumber),
//     index("payments_payment_date_idx").on(table.paymentDate),
//     index("payments_customer_idx").on(table.customerId),
//   ],
// );

// export const settings = pgTable("settings", {
//   id: integer("id").primaryKey().default(1),
//   businessName: text("business_name").notNull().default("LedgerLite Ltd"),
//   businessAddress: text("business_address").notNull().default(""),
//   vatNumber: text("vat_number").notNull().default(""),
//   defaultVatRate: numeric("default_vat_rate", { precision: 5, scale: 2 }).notNull().default("5"),
//   currency: text("currency").notNull().default("USD"),
//   invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
//   nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
//   receiptPrefix: text("receipt_prefix").notNull().default("RCP-"),
//   nextReceiptNumber: integer("next_receipt_number").notNull().default(1),
//   vatScheme: text("vat_scheme").notNull().default("cash"),
//   updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
// });

// export type Customer = typeof customers.$inferSelect;
// export type NewCustomer = typeof customers.$inferInsert;
// export type Invoice = typeof invoices.$inferSelect;
// export type InvoiceItem = typeof invoiceItems.$inferSelect;
// export type Payment = typeof payments.$inferSelect;
// export type Settings = typeof settings.$inferSelect;

// /* ------------------------------------------------------------------ *
//  * Expenses (direct / indirect) with claimable input VAT
//  * ------------------------------------------------------------------ */

// export const expenseCategories = pgTable(
//   "expense_categories",
//   {
//     id: serial("id").primaryKey(),
//     name: text("name").notNull(),
//     /** direct = vehicle / operating cost, indirect = admin & overhead */
//     type: text("type").notNull().default("direct"),
//     createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
//   },
//   (table) => [uniqueIndex("expense_categories_name_uidx").on(table.name)],
// );

// export const vehicles = pgTable(
//   "vehicles",
//   {
//     id: serial("id").primaryKey(),
//     /** Vehicle ID / fleet code, e.g. TRK-001 */
//     code: text("code").notNull(),
//     make: text("make").notNull(),
//     model: text("model"),
//     year: integer("year"),
//     plateNumber: text("plate_number").notNull(),
//     /** active | maintenance | idle | sold */
//     status: text("status").notNull().default("active"),
//     assignedOperator: text("assigned_operator"),
//     operatorMonthlySalary: numeric("operator_monthly_salary", { precision: 14, scale: 2 })
//       .notNull()
//       .default("0"),
//     purchasedAt: date("purchased_at"),
//     notes: text("notes"),
//     createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
//   },
//   (table) => [uniqueIndex("vehicles_code_uidx").on(table.code)],
// );

// export const expenses = pgTable(
//   "expenses",
//   {
//     id: serial("id").primaryKey(),
//     expenseNumber: text("expense_number").notNull(),
//     expenseDate: date("expense_date").notNull(),
//     vendorName: text("vendor_name").notNull(),
//     vendorTaxId: text("vendor_tax_id"),
//     vendorInvoiceRef: text("vendor_invoice_ref"),
//     description: text("description").notNull(),
//     categoryId: integer("category_id").references(() => expenseCategories.id, {
//       onDelete: "set null",
//     }),
//     type: text("type").notNull().default("direct"),
//     vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
//     netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull().default("0"),
//     vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("5"),
//     /** Input VAT claimable on this purchase. */
//     vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
//     grossAmount: numeric("gross_amount", { precision: 14, scale: 2 }).notNull().default("0"),
//     paymentMethod: text("payment_method"),
//     notes: text("notes"),
//     attachmentName: text("attachment_name"),
//     attachmentType: text("attachment_type"),
//     attachmentSize: integer("attachment_size"),
//     /** base64 payload of the uploaded receipt / vendor invoice image */
//     attachmentData: text("attachment_data"),
//     createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
//   },
//   (table) => [
//     uniqueIndex("expenses_number_uidx").on(table.expenseNumber),
//     index("expenses_date_idx").on(table.expenseDate),
//     index("expenses_vehicle_idx").on(table.vehicleId),
//   ],
// );

// /* ------------------------------------------------------------------ *
//  * Per-vehicle financial ledger
//  * ------------------------------------------------------------------ */

// export const vehicleIncome = pgTable(
//   "vehicle_income",
//   {
//     id: serial("id").primaryKey(),
//     vehicleId: integer("vehicle_id")
//       .notNull()
//       .references(() => vehicles.id, { onDelete: "cascade" }),
//     incomeDate: date("income_date").notNull(),
//     description: text("description").notNull(),
//     customerName: text("customer_name"),
//     invoiceNumber: text("invoice_number"),
//     ratePer: text("rate_per"),
//     quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull().default("1"),
//     netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull().default("0"),
//     vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("5"),
//     vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
//     grossAmount: numeric("gross_amount", { precision: 14, scale: 2 }).notNull().default("0"),
//     notes: text("notes"),
//     createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
//   },
//   (table) => [index("vehicle_income_vehicle_idx").on(table.vehicleId)],
// );

// export const operatorSalaries = pgTable(
//   "operator_salaries",
//   {
//     id: serial("id").primaryKey(),
//     vehicleId: integer("vehicle_id")
//       .notNull()
//       .references(() => vehicles.id, { onDelete: "cascade" }),
//     operatorName: text("operator_name").notNull(),
//     /** Salary period, e.g. 2026-08 */
//     periodLabel: text("period_label").notNull(),
//     paymentDate: date("payment_date").notNull(),
//     amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
//     notes: text("notes"),
//     createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
//   },
//   (table) => [index("operator_salaries_vehicle_idx").on(table.vehicleId)],
// );

// /* ------------------------------------------------------------------ *
//  * Legal documents register (registration, licences, permits, contracts)
//  * ------------------------------------------------------------------ */

// export const documents = pgTable(
//   "documents",
//   {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//     documentNumber: text("document_number"),
//     /** Vehicle registration, Insurance policy, Driving licence, Business licence, Contract … */
//     category: text("category").notNull().default("Other"),
//     issuer: text("issuer"),
//     holderName: text("holder_name"),
//     vehicleId: integer("vehicle_id").references(() => vehicles.id, {
//       onDelete: "set null",
//     }),
//     issuedDate: date("issued_date"),
//     expiryDate: date("expiry_date"),
//     renewalDate: date("renewal_date"),
//     /** How many days before expiry a renewal reminder should appear. */
//     renewalLeadDays: integer("renewal_lead_days").notNull().default(30),
//     notes: text("notes"),
//     attachmentName: text("attachment_name"),
//     attachmentType: text("attachment_type"),
//     attachmentSize: integer("attachment_size"),
//     attachmentData: text("attachment_data"),
//     createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
//   },
//   (table) => [
//     index("documents_expiry_idx").on(table.expiryDate),
//     index("documents_vehicle_idx").on(table.vehicleId),
//   ],
// );
