import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { customers, invoiceItems, invoices, payments, settings } from "@/db/schema";
import {
  cashVatForPayment,
  dueDateFromTerms,
  computeTotals,
  deriveStatus,
  round2,
  todayISO,
  type ComputedLine,
  type LineInput,
  type PeriodRange,
} from "@/lib/domain";

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function rawRows<T>(query: SQL): Promise<T[]> {
  const result = (await db.execute(query)) as unknown as { rows?: T[] } | T[];
  if (Array.isArray(result)) return result as T[];
  return result.rows ?? [];
}

export function handleDbError(error: unknown, fallback: string): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/duplicate key|unique constraint/i.test(message)) {
    throw new AppError("That reference number already exists. Try again.", 409);
  }
  if (/foreign key/i.test(message)) {
    throw new AppError("This record is referenced by other transactions and cannot be removed.", 409);
  }
  console.error(`[db] ${fallback}`);
  throw new AppError(fallback, 500);
}

/* ------------------------------------------------------------------ *
 * Types returned to the UI
 * ------------------------------------------------------------------ */

export type SettingsDto = {
  businessName: string;
  businessAddress: string;
  vatNumber: string;
  defaultVatRate: number;
  currency: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  receiptPrefix: string;
  nextReceiptNumber: number;
  vatScheme: string;
};

export type CustomerRow = {
  id: number;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  invoiceCount: number;
  invoicedTotal: number;
  paidTotal: number;
  outstanding: number;
};

export type InvoiceRow = {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  customerTaxId: string | null;
  issueDate: string;
  dueDate: string | null;
  paymentTerms: string;
  currency: string;
  poNumber: string | null;
  notes: string | null;
  status: string;
  storedStatus: string;
  subtotal: number;
  vatTotal: number;
  total: number;
  paidTotal: number;
  outstanding: number;
  itemCount: number;
};

export type InvoiceDetail = InvoiceRow & {
  items: (ComputedLine & { id: number; position: number })[];
  payments: PaymentRow[];
};

export type PaymentRow = {
  id: number;
  receiptNumber: string;
  invoiceId: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  paymentDate: string;
  amount: number;
  vatAmount: number;
  method: string;
  reference: string | null;
  note: string | null;
};

export type LedgerRow = {
  date: string;
  type: "Invoice" | "Payment";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  /** Invoice id for Invoice rows, payment id for Payment rows. */
  entityId?: number;
};

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export async function getSettings(): Promise<SettingsDto> {
  try {
    const existing = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
    if (existing.length === 0) {
      await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
      const created = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
      return mapSettings(created[0]);
    }
    return mapSettings(existing[0]);
  } catch (error) {
    return handleDbError(error, "Unable to load settings");
  }
}

type SettingsRecord = typeof settings.$inferSelect;

function mapSettings(row: SettingsRecord | undefined): SettingsDto {
  if (!row) {
    return {
      businessName: "LedgerLite Ltd",
      businessAddress: "",
      vatNumber: "",
      defaultVatRate: 20,
      currency: "USD",
      invoicePrefix: "INV-",
      nextInvoiceNumber: 1,
      receiptPrefix: "RCP-",
      nextReceiptNumber: 1,
      vatScheme: "cash",
    };
  }
  return {
    businessName: row.businessName,
    businessAddress: row.businessAddress,
    vatNumber: row.vatNumber,
    defaultVatRate: Number(row.defaultVatRate),
    currency: row.currency,
    invoicePrefix: row.invoicePrefix,
    nextInvoiceNumber: row.nextInvoiceNumber,
    receiptPrefix: row.receiptPrefix,
    nextReceiptNumber: row.nextReceiptNumber,
    vatScheme: row.vatScheme,
  };
}

export async function updateSettings(patch: Partial<SettingsDto>): Promise<SettingsDto> {
  try {
    await getSettings();
    await db
      .update(settings)
      .set({
        businessName: patch.businessName,
        businessAddress: patch.businessAddress,
        vatNumber: patch.vatNumber,
        defaultVatRate:
          patch.defaultVatRate === undefined ? undefined : String(round2(patch.defaultVatRate)),
        currency: patch.currency,
        invoicePrefix: patch.invoicePrefix,
        receiptPrefix: patch.receiptPrefix,
        vatScheme: patch.vatScheme,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, 1));
    return getSettings();
  } catch (error) {
    return handleDbError(error, "Unable to save settings");
  }
}

/* ------------------------------------------------------------------ *
 * Customers
 * ------------------------------------------------------------------ */

export async function listCustomers(search?: string): Promise<CustomerRow[]> {
  const term = search?.trim();
  try {
    const rows = await rawRows<Record<string, unknown>>(sql`
      select c.id,
             c.name,
             c.contact_name,
             c.email,
             c.phone,
             c.address,
             c.tax_id,
             c.notes,
             c.is_active,
             c.created_at,
             coalesce(i.invoice_count, 0)::int as invoice_count,
             coalesce(i.invoiced_total, 0)::numeric as invoiced_total,
             coalesce(p.paid_total, 0)::numeric as paid_total,
             (coalesce(i.invoiced_total, 0) - coalesce(p.paid_total, 0))::numeric as outstanding
      from customers c
      left join (
        select i.customer_id,
               count(*)::int as invoice_count,
               sum(case when i.status = 'void' then 0 else i.total end) as invoiced_total
        from invoices i
        group by i.customer_id
      ) i on i.customer_id = c.id
      left join (
        select p.customer_id, sum(p.amount) as paid_total
        from payments p
        group by p.customer_id
      ) p on p.customer_id = c.id
      ${term ? sql`where c.name ilike ${`%${term}%`} or c.email ilike ${`%${term}%`} or coalesce(c.tax_id, '') ilike ${`%${term}%`}` : sql``}
      order by c.name asc
    `);
    return rows.map(mapCustomer);
  } catch (error) {
    return handleDbError(error, "Unable to load customers");
  }
}

/** Accepts both snake_case SQL rows and camelCase Drizzle rows. */
function mapCustomer(row: Record<string, unknown>): CustomerRow {
  const text = (value: unknown) =>
    value === null || value === undefined || value === "" ? null : String(value);
  const createdAt = row.created_at ?? row.createdAt;
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    contactName: text(row.contact_name ?? row.contactName),
    email: text(row.email),
    phone: text(row.phone),
    address: text(row.address),
    taxId: text(row.tax_id ?? row.taxId),
    notes: text(row.notes),
    isActive: Boolean(row.is_active ?? row.isActive ?? true),
    createdAt:
      createdAt instanceof Date
        ? createdAt.toISOString()
        : String(createdAt ?? new Date().toISOString()),
    invoiceCount: Number(row.invoice_count ?? row.invoiceCount ?? 0),
    invoicedTotal: round2(Number(row.invoiced_total ?? row.invoicedTotal ?? 0)),
    paidTotal: round2(Number(row.paid_total ?? row.paidTotal ?? 0)),
    outstanding: round2(Number(row.outstanding ?? 0)),
  };
}

export async function getCustomer(id: number): Promise<CustomerRow> {
  const rows = await listCustomers();
  const found = rows.find((row) => row.id === id);
  if (!found) throw new AppError("Customer not found", 404);
  return found;
}

export type CustomerInput = {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

function requireName(input: CustomerInput): string {
  const name = (input.name ?? "").trim();
  if (name.length < 2) throw new AppError("Customer name must be at least 2 characters.", 422);
  return name;
}

export async function createCustomer(input: CustomerInput): Promise<CustomerRow> {
  try {
    const [row] = await db
      .insert(customers)
      .values({
        name: requireName(input),
        contactName: input.contactName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        taxId: input.taxId ?? null,
        notes: input.notes ?? null,
        isActive: input.isActive ?? true,
      })
      .returning();
    return mapCustomer(row);
  } catch (error) {
    return handleDbError(error, "Unable to create customer");
  }
}

export async function updateCustomer(id: number, input: CustomerInput): Promise<CustomerRow> {
  try {
    const [row] = await db
      .update(customers)
      .set({
        name: requireName(input),
        contactName: input.contactName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        taxId: input.taxId ?? null,
        notes: input.notes ?? null,
        isActive: input.isActive ?? true,
      })
      .where(eq(customers.id, id))
      .returning();
    if (!row) throw new AppError("Customer not found", 404);
    return mapCustomer(row);
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to update customer");
  }
}

export async function deleteCustomer(id: number): Promise<{ ok: true }> {
  try {
    const [{ count }] = await rawRows<{ count: number }>(
      sql`select count(*)::int as count from ${invoices} where ${invoices.customerId} = ${id}`,
    );
    if (Number(count) > 0) {
      throw new AppError(
        "This customer has invoices. Void or delete the invoices first, or keep the customer for audit history.",
        409,
      );
    }
    await db.delete(customers).where(eq(customers.id, id));
    return { ok: true };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to delete customer");
  }
}

/* ------------------------------------------------------------------ *
 * Invoices
 * ------------------------------------------------------------------ */

const INVOICE_SELECT = {
  id: invoices.id,
  invoiceNumber: invoices.invoiceNumber,
  customerId: invoices.customerId,
  customerName: customers.name,
  customerTaxId: customers.taxId,
  issueDate: invoices.issueDate,
  dueDate: invoices.dueDate,
  currency: invoices.currency,
  poNumber: invoices.poNumber,
  notes: invoices.notes,
  status: invoices.status,
  subtotal: invoices.subtotal,
  vatTotal: invoices.vatTotal,
  total: invoices.total,
  paidTotal: sql<string>`coalesce((select sum(p.amount) from payments p where p.invoice_id = ${invoices.id}), 0)`,
  itemCount: sql<number>`(select count(*)::int from invoice_items it where it.invoice_id = ${invoices.id})`,
};

type InvoiceRecord = {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  customerTaxId: string | null;
  issueDate: string;
  dueDate: string | null;
  paymentTerms: string;
  currency: string;
  poNumber: string | null;
  notes: string | null;
  status: string;
  subtotal: string;
  vatTotal: string;
  total: string;
  paidTotal: string;
  itemCount: number;
};

function mapInvoice(row: InvoiceRecord): InvoiceRow {
  const total = round2(Number(row.total));
  const paidTotal = round2(Number(row.paidTotal));
  return {
    id: Number(row.id),
    invoiceNumber: row.invoiceNumber,
    customerId: Number(row.customerId),
    customerName: row.customerName,
    customerTaxId: row.customerTaxId ?? null,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    paymentTerms: row.paymentTerms ?? "30",
    currency: row.currency,
    poNumber: row.poNumber,
    notes: row.notes,
    status: deriveStatus(total, paidTotal, row.dueDate, row.status),
    storedStatus: row.status,
    subtotal: round2(Number(row.subtotal)),
    vatTotal: round2(Number(row.vatTotal)),
    total,
    paidTotal,
    outstanding: round2(Math.max(total - paidTotal, 0)),
    itemCount: Number(row.itemCount ?? 0),
  };
}

export async function listInvoices(filter: {
  customerId?: number;
  status?: string;
  search?: string;
  limit?: number;
} = {}): Promise<InvoiceRow[]> {
  try {
    const conditions: SQL[] = [];
    if (filter.customerId) conditions.push(eq(invoices.customerId, filter.customerId));
    if (filter.search?.trim()) {
      const term = `%${filter.search.trim()}%`;
      const clause = or(ilike(invoices.invoiceNumber, term), ilike(customers.name, term));
      if (clause) conditions.push(clause);
    }

    const rows = await db
      .select(INVOICE_SELECT)
      .from(invoices)
      .innerJoin(customers, eq(customers.id, invoices.customerId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(invoices.issueDate), desc(invoices.id))
      .limit(filter.limit ?? 200);

    const mapped = rows.map((row) => mapInvoice(row as unknown as InvoiceRecord));
    if (!filter.status || filter.status === "all") return mapped;
    if (filter.status === "balance") return mapped.filter((row) => row.outstanding > 0);
    return mapped.filter((row) => row.status === filter.status);
  } catch (error) {
    return handleDbError(error, "Unable to load invoices");
  }
}

export async function getInvoice(id: number): Promise<InvoiceDetail> {
  try {
    const rows = await db
      .select(INVOICE_SELECT)
      .from(invoices)
      .innerJoin(customers, eq(customers.id, invoices.customerId))
      .where(eq(invoices.id, id))
      .limit(1);
    if (rows.length === 0) throw new AppError("Invoice not found", 404);

    const base = mapInvoice(rows[0] as unknown as InvoiceRecord);
    const [items, paymentRows] = await Promise.all([
      db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.position)),
      listPayments({ invoiceId: id }),
    ]);

    return {
      ...base,
      items: items.map((item) => ({
        id: item.id,
        position: item.position,
        description: item.description,
        subDescription: item.subDescription ?? null,
        periodStart: item.periodStart ?? null,
        periodEnd: item.periodEnd ?? null,
        ratePer: item.ratePer ?? "Trip",
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        vatRate: Number(item.vatRate),
        lineNet: Number(item.lineNet),
        lineVat: Number(item.lineVat),
        lineGross: Number(item.lineGross),
      })),
      payments: paymentRows,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to load invoice");
  }
}

export type InvoiceInput = {
  customerId: number;
  issueDate: string;
  dueDate?: string | null;
  paymentTerms?: string | null;
  currency?: string;
  poNumber?: string | null;
  notes?: string | null;
  items: LineInput[];
};

function validateInvoiceInput(input: InvoiceInput) {
  if (!input.customerId) throw new AppError("Select a customer for this invoice.", 422);
  const items = (input.items ?? []).filter(
    (item) => item.description?.trim() || round2(Number(item.unitPrice)) !== 0,
  );
  if (items.length === 0) {
    throw new AppError("Add at least one line item with a description or amount.", 422);
  }
  items.forEach((item, index) => {
    if (!item.description?.trim()) throw new AppError(`Line ${index + 1}: description is required.`, 422);
    if (Number(item.quantity) <= 0) throw new AppError(`Line ${index + 1}: quantity must be > 0.`, 422);
  });
  return items;
}

export async function createInvoice(input: InvoiceInput): Promise<InvoiceDetail> {
  const items = validateInvoiceInput(input);
  const config = await getSettings();
  const totals = computeTotals(items);

  try {
    const invoiceId = await db.transaction(async (tx) => {
      const [configRow] = await tx
        .select()
        .from(settings)
        .where(eq(settings.id, 1))
        .for("update")
        .limit(1);
      const prefix = configRow?.invoicePrefix ?? config.invoicePrefix;
      const next = configRow?.nextInvoiceNumber ?? 1;
      const invoiceNumber = `${prefix}${String(next).padStart(4, "0")}`;

      const [created] = await tx
        .insert(invoices)
        .values({
          customerId: input.customerId,
          invoiceNumber,
          issueDate: input.issueDate || todayISO(),
          dueDate:
            input.dueDate ||
            dueDateFromTerms(input.issueDate || todayISO(), input.paymentTerms || "30"),
          paymentTerms: input.paymentTerms || "30",
          currency: input.currency || config.currency,
          poNumber: input.poNumber || null,
          notes: input.notes || null,
          status: "open",
          subtotal: String(totals.subtotal),
          vatTotal: String(totals.vatTotal),
          total: String(totals.total),
        })
        .returning({ id: invoices.id });

      await tx.insert(invoiceItems).values(
        totals.lines.map((line, index) => ({
          invoiceId: created.id,
          position: index,
          description: line.description,
          subDescription: line.subDescription,
          periodStart: line.periodStart ?? null,
          periodEnd: line.periodEnd ?? null,
          ratePer: line.ratePer,
          quantity: String(line.quantity),
          unitPrice: String(line.unitPrice),
          vatRate: String(line.vatRate),
          lineNet: String(line.lineNet),
          lineVat: String(line.lineVat),
          lineGross: String(line.lineGross),
        })),
      );

      await tx
        .update(settings)
        .set({ nextInvoiceNumber: next + 1, updatedAt: new Date() })
        .where(eq(settings.id, 1));

      return created.id;
    });

    return getInvoice(invoiceId);
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to create invoice");
  }
}

export async function updateInvoice(id: number, input: InvoiceInput): Promise<InvoiceDetail> {
  const existing = await getInvoice(id);
  // Once receipts exist the line items are locked (they would change the VAT
  // already declared), but the header details can still be amended.
  const linesLocked = existing.payments.length > 0;
  const items = linesLocked ? [] : validateInvoiceInput(input);
  const totals = computeTotals(items);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(invoices)
        .set({
          customerId: input.customerId || existing.customerId,
          issueDate: input.issueDate || existing.issueDate,
          dueDate:
            input.dueDate ||
            dueDateFromTerms(input.issueDate || existing.issueDate, input.paymentTerms || existing.paymentTerms),
          paymentTerms: input.paymentTerms || existing.paymentTerms,
          currency: input.currency || existing.currency,
          poNumber: input.poNumber || null,
          notes: input.notes || null,
          ...(linesLocked
            ? {}
            : {
                subtotal: String(totals.subtotal),
                vatTotal: String(totals.vatTotal),
                total: String(totals.total),
              }),
        })
        .where(eq(invoices.id, id));

      if (!linesLocked) {
        await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
        await tx.insert(invoiceItems).values(
          totals.lines.map((line, index) => ({
            invoiceId: id,
            position: index,
            description: line.description,
            subDescription: line.subDescription,
            periodStart: line.periodStart ?? null,
            periodEnd: line.periodEnd ?? null,
            ratePer: line.ratePer,
            quantity: String(line.quantity),
            unitPrice: String(line.unitPrice),
            vatRate: String(line.vatRate),
            lineNet: String(line.lineNet),
            lineVat: String(line.lineVat),
            lineGross: String(line.lineGross),
          })),
        );
      }
    });
    return getInvoice(id);
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to update invoice");
  }
}

export async function setInvoiceStatus(id: number, status: "open" | "void"): Promise<InvoiceDetail> {
  try {
    await db.update(invoices).set({ status }).where(eq(invoices.id, id));
    return getInvoice(id);
  } catch (error) {
    return handleDbError(error, "Unable to change invoice status");
  }
}

export async function deleteInvoice(id: number): Promise<{ ok: true }> {
  try {
    await db.delete(invoices).where(eq(invoices.id, id));
    return { ok: true };
  } catch (error) {
    return handleDbError(error, "Unable to delete invoice");
  }
}

/* ------------------------------------------------------------------ *
 * Payments & receipts
 * ------------------------------------------------------------------ */

export async function listPayments(filter: {
  customerId?: number;
  invoiceId?: number;
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<PaymentRow[]> {
  try {
    const conditions: SQL[] = [];
    if (filter.customerId) conditions.push(eq(payments.customerId, filter.customerId));
    if (filter.invoiceId) conditions.push(eq(payments.invoiceId, filter.invoiceId));
    if (filter.from) conditions.push(gte(payments.paymentDate, filter.from));
    if (filter.to) conditions.push(lte(payments.paymentDate, filter.to));

    const rows = await db
      .select({
        id: payments.id,
        receiptNumber: payments.receiptNumber,
        invoiceId: payments.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        customerId: payments.customerId,
        customerName: customers.name,
        paymentDate: payments.paymentDate,
        amount: payments.amount,
        vatAmount: payments.vatAmount,
        method: payments.method,
        reference: payments.reference,
        note: payments.note,
      })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .innerJoin(customers, eq(customers.id, payments.customerId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(payments.paymentDate), desc(payments.id))
      .limit(filter.limit ?? 200);

    return rows.map((row) => ({
      ...row,
      amount: round2(Number(row.amount)),
      vatAmount: round2(Number(row.vatAmount)),
    }));
  } catch (error) {
    return handleDbError(error, "Unable to load payments");
  }
}

export type PaymentInput = {
  invoiceId: number;
  paymentDate: string;
  amount: number;
  method?: string;
  reference?: string | null;
  note?: string | null;
};

export async function createPayment(
  input: PaymentInput,
): Promise<{ payment: PaymentRow; invoice: InvoiceDetail; receiptPath: string }> {
  try {
    const invoice = await getInvoice(input.invoiceId);
    if (invoice.storedStatus === "void") {
      throw new AppError("You cannot post a payment against a void invoice.", 409);
    }
    const amount = round2(Number(input.amount));
    if (!(amount > 0)) throw new AppError("Payment amount must be greater than zero.", 422);
    if (amount - invoice.outstanding > 0.005) {
      throw new AppError(
        `Payment of ${amount.toFixed(2)} exceeds the outstanding balance of ${invoice.outstanding.toFixed(2)} on ${invoice.invoiceNumber}.`,
        422,
      );
    }

    // CASH ACCOUNTING: VAT is derived from the cash received, never from the
    // invoiced total or the invoice date.
    const vatAmount = cashVatForPayment(amount, invoice.total, invoice.vatTotal);

    const result = await db.transaction(async (tx) => {
      const [configRow] = await tx
        .select()
        .from(settings)
        .where(eq(settings.id, 1))
        .for("update")
        .limit(1);
      const prefix = configRow?.receiptPrefix ?? "RCP-";
      const next = configRow?.nextReceiptNumber ?? 1;
      const receiptNumber = `${prefix}${String(next).padStart(4, "0")}`;

      const [row] = await tx
        .insert(payments)
        .values({
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          receiptNumber,
          paymentDate: input.paymentDate || todayISO(),
          amount: String(amount),
          vatAmount: String(vatAmount),
          method: input.method || "Cash",
          reference: input.reference || null,
          note: input.note || null,
        })
        .returning();

      await tx
        .update(settings)
        .set({ nextReceiptNumber: next + 1, updatedAt: new Date() })
        .where(eq(settings.id, 1));

      return row;
    });

    const [updatedInvoice, allPayments] = await Promise.all([
      getInvoice(invoice.id),
      listPayments({ invoiceId: invoice.id }),
    ]);
    const payment = allPayments.find((p) => p.id === result.id) ?? {
      ...allPayments[0],
    };

    return {
      payment,
      invoice: updatedInvoice,
      receiptPath: `/api/reports/receipt/${result.id}`,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to record payment");
  }
}

export async function updatePayment(
  id: number,
  input: PaymentInput,
): Promise<{ payment: PaymentRow; invoice: InvoiceDetail }> {
  try {
    const all = await listPayments({ limit: 1000 });
    const current = all.find((row) => row.id === id);
    if (!current) throw new AppError("Receipt not found", 404);

    const invoice = await getInvoice(current.invoiceId);
    if (invoice.storedStatus === "void") {
      throw new AppError("You cannot amend a payment against a void invoice.", 409);
    }

    const amount = round2(Number(input.amount));
    if (!(amount > 0)) throw new AppError("Payment amount must be greater than zero.", 422);

    // Balance available to this receipt once every other receipt is counted.
    const othersTotal = round2(invoice.paidTotal - current.amount);
    const available = round2(invoice.total - othersTotal);
    if (amount - available > 0.005) {
      throw new AppError(
        `Payment of ${amount.toFixed(2)} exceeds the balance available of ${available.toFixed(2)} on ${invoice.invoiceNumber}.`,
        422,
      );
    }

    // CASH ACCOUNTING — recompute the VAT element from the new cash amount.
    const vatAmount = cashVatForPayment(amount, invoice.total, invoice.vatTotal);

    await db
      .update(payments)
      .set({
        paymentDate: input.paymentDate || current.paymentDate,
        amount: String(amount),
        vatAmount: String(vatAmount),
        method: input.method || current.method,
        reference: input.reference ?? current.reference ?? null,
        note: input.note ?? current.note ?? null,
      })
      .where(eq(payments.id, id));

    const [updatedInvoice, invoicePayments] = await Promise.all([
      getInvoice(invoice.id),
      listPayments({ invoiceId: invoice.id }),
    ]);
    const payment = invoicePayments.find((row) => row.id === id);
    if (!payment) throw new AppError("The receipt could not be read back.", 500);
    return { payment, invoice: updatedInvoice };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to update the payment");
  }
}

export async function deletePayment(id: number): Promise<{ ok: true }> {
  try {
    await db.delete(payments).where(eq(payments.id, id));
    return { ok: true };
  } catch (error) {
    return handleDbError(error, "Unable to delete payment");
  }
}

/* ------------------------------------------------------------------ *
 * Customer statement
 * ------------------------------------------------------------------ */

export type Statement = {
  customer: CustomerRow;
  generatedAt: string;
  openingBalance: number;
  closingBalance: number;
  totalInvoiced: number;
  totalPaid: number;
  rows: LedgerRow[];
};

export async function buildStatement(customerId: number, from?: string, to?: string): Promise<Statement> {
  try {
    const customer = await getCustomer(customerId);

    const [invoiceRows, paymentRows] = await Promise.all([
      db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          issueDate: invoices.issueDate,
          total: invoices.total,
          status: invoices.status,
          notes: invoices.notes,
        })
        .from(invoices)
        .where(eq(invoices.customerId, customerId))
        .orderBy(asc(invoices.issueDate), asc(invoices.id)),
      listPayments({ customerId, limit: 1000 }),
    ]);

    const invoiceIds = new Map<string, number>();
    type Entry = { date: string; type: "Invoice" | "Payment"; reference: string; description: string; debit: number; credit: number; entityId?: number };
    const entries: Entry[] = [];

    for (const row of invoiceRows) {
      if (row.status === "void") continue;
      entries.push({
        date: row.issueDate,
        type: "Invoice",
        reference: row.invoiceNumber,
        description: "Invoice raised" + (row.notes ? ` — ${row.notes}` : ""),
        debit: round2(Number(row.total)),
        credit: 0,
        entityId: row.id,
      });
    }

    const invoiceIdRows = await db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.customerId, customerId));
    invoiceIdRows.forEach((row) => invoiceIds.set(row.invoiceNumber, row.id));

    for (const row of paymentRows) {
      entries.push({
        date: row.paymentDate,
        type: "Payment",
        reference: row.receiptNumber,
        description: `Payment received against ${row.invoiceNumber} (${row.method})`,
        debit: 0,
        credit: round2(row.amount),
        entityId: row.id,
      });
    }

    entries.sort((a, b) => (a.date === b.date ? (a.type === b.type ? 0 : a.type === "Invoice" ? -1 : 1) : a.date < b.date ? -1 : 1));

    const before = from ?? "0000-01-01";
    const after = to ?? "9999-12-31";

    const openingBalance = round2(
      entries
        .filter((entry) => entry.date < before)
        .reduce((sum, entry) => sum + entry.debit - entry.credit, 0),
    );

    let running = openingBalance;
    const rows: LedgerRow[] = [];
    for (const entry of entries) {
      if (entry.date < before || entry.date > after) continue;
      running = round2(running + entry.debit - entry.credit);
      rows.push({ ...entry, balance: running });
    }

    return {
      customer,
      generatedAt: new Date().toISOString(),
      openingBalance,
      closingBalance: running,
      totalInvoiced: round2(
        entries
          .filter((entry) => entry.type === "Invoice" && entry.date >= before && entry.date <= after)
          .reduce((sum, entry) => sum + entry.debit, 0),
      ),
      totalPaid: round2(
        entries
          .filter((entry) => entry.type === "Payment" && entry.date >= before && entry.date <= after)
          .reduce((sum, entry) => sum + entry.credit, 0),
      ),
      rows,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to build statement");
  }
}

/* ------------------------------------------------------------------ *
 * VAT reporting (cash basis)
 * ------------------------------------------------------------------ */

export type VatReportRow = {
  paymentId: number;
  receiptNumber: string;
  paymentDate: string;
  invoiceNumber: string;
  customerName: string;
  method: string;
  grossCollected: number;
  netCollected: number;
  vatCollected: number;
  effectiveVatRate: number;
};

export type VatReport = {
  period: { label: string; from: string; to: string; kind: string; description: string };
  scheme: string;
  currency: string;
  rows: VatReportRow[];
  totals: {
    grossCollected: number;
    netCollected: number;
    vatDue: number;
    paymentCount: number;
    /** Informational only — VAT that would be due under invoice (accrual) accounting. */
    invoicedVatInPeriod: number;
    invoicedTotalInPeriod: number;
    difference: number;
  };
};

export async function buildVatReport(period: PeriodRange): Promise<VatReport> {
  try {
    const config = await getSettings();

    const rows = await rawRows<Record<string, unknown>>(sql`
      select p.id,
             p.receipt_number,
             p.payment_date,
             p.amount,
             p.vat_amount,
             p.method,
             i.invoice_number,
             c.name as customer_name,
             case when i.subtotal > 0 then round((i.vat_total / i.subtotal) * 100, 2) else 0 end as effective_rate
      from payments p
      join invoices i on i.id = p.invoice_id
      join customers c on c.id = p.customer_id
      where p.payment_date between ${period.from} and ${period.to}
        and i.status <> 'void'
      order by p.payment_date asc, p.id asc
    `);

    const mapped: VatReportRow[] = rows.map((row) => {
      const gross = round2(Number(row.amount));
      const vat = round2(Number(row.vat_amount));
      return {
        paymentId: Number(row.id),
        receiptNumber: String(row.receipt_number),
        paymentDate: String(row.payment_date).slice(0, 10),
        invoiceNumber: String(row.invoice_number),
        customerName: String(row.customer_name),
        method: String(row.method ?? ""),
        grossCollected: gross,
        netCollected: round2(gross - vat),
        vatCollected: vat,
        effectiveVatRate: round2(Number(row.effective_rate ?? 0)),
      };
    });

    const invoiced = await rawRows<{ vat_total: unknown; total: unknown; count: number }>(sql`
      select coalesce(sum(i.vat_total), 0) as vat_total,
             coalesce(sum(i.total), 0) as total,
             count(*)::int as count
      from invoices i
      where i.issue_date between ${period.from} and ${period.to}
        and i.status <> 'void'
    `);

    const grossCollected = round2(mapped.reduce((sum, row) => sum + row.grossCollected, 0));
    const vatDue = round2(mapped.reduce((sum, row) => sum + row.vatCollected, 0));
    const invoicedVatInPeriod = round2(Number(invoiced[0]?.vat_total ?? 0));

    return {
      period: {
        label: period.label,
        from: period.from,
        to: period.to,
        kind: period.kind,
        description: period.description,
      },
      scheme: "Cash accounting — VAT recognised on receipts only",
      currency: config.currency,
      rows: mapped,
      totals: {
        grossCollected,
        netCollected: round2(grossCollected - vatDue),
        vatDue,
        paymentCount: mapped.length,
        invoicedVatInPeriod,
        invoicedTotalInPeriod: round2(Number(invoiced[0]?.total ?? 0)),
        difference: round2(vatDue - invoicedVatInPeriod),
      },
    };
  } catch (error) {
    return handleDbError(error, "Unable to build VAT report");
  }
}

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

export type DashboardStats = {
  currency: string;
  customers: number;
  openInvoices: number;
  receivables: number;
  overdue: number;
  collectedThisMonth: number;
  collectedThisQuarter: number;
  collectedThisYear: number;
  vatDueThisQuarter: number;
  vatDueThisYear: number;
  recentInvoices: InvoiceRow[];
  recentPayments: PaymentRow[];
  topDebtors: { id: number; name: string; outstanding: number; invoiceCount: number }[];
};

export async function getDashboard(): Promise<DashboardStats> {
  try {
    const config = await getSettings();
    const today = todayISO();
    const now = new Date();
    const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
    const quarterStart = `${now.getUTCFullYear()}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}-01`;
    const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const yearStart = `${now.getUTCFullYear()}-01-01`;

    const [customerCount] = await rawRows<{ count: number }>(
      sql`select count(*)::int as count from customers where is_active = true`,
    );

    const collected = await rawRows<{ period: string; total: unknown; vat: unknown }>(sql`
      select 'month' as period, coalesce(sum(p.amount), 0) as total, coalesce(sum(p.vat_amount), 0) as vat
        from payments p where p.payment_date between ${monthStart} and ${today}
      union all
      select 'quarter', coalesce(sum(p.amount), 0), coalesce(sum(p.vat_amount), 0)
        from payments p where p.payment_date between ${quarterStart} and ${today}
      union all
      select 'year', coalesce(sum(p.amount), 0), coalesce(sum(p.vat_amount), 0)
        from payments p where p.payment_date between ${yearStart} and ${today}
    `);

    const pick = (key: string) => collected.find((row) => row.period === key);

    const [invoiceAgg] = await rawRows<{ open_count: number; receivables: unknown; overdue: unknown }>(sql`
      select
        count(*) filter (where i.status <> 'void')::int as open_count,
        coalesce(sum(greatest(i.total - coalesce((select sum(p.amount) from payments p where p.invoice_id = i.id), 0), 0)) filter (where i.status <> 'void'), 0) as receivables,
        coalesce(sum(greatest(i.total - coalesce((select sum(p.amount) from payments p where p.invoice_id = i.id), 0), 0)) filter (where i.status <> 'void' and i.due_date < ${today}), 0) as overdue
      from invoices i
    `);

    const [invoiceList, paymentList, debtors] = await Promise.all([
      listInvoices({ limit: 6 }),
      listPayments({ limit: 6 }),
      rawRows<{ id: number; name: string; outstanding: unknown; invoice_count: number }>(sql`
        select c.id, c.name,
               (coalesce(sum(i.total), 0) - coalesce((select sum(p.amount) from payments p where p.customer_id = c.id), 0)) as outstanding,
               count(i.id)::int as invoice_count
        from customers c
        join invoices i on i.customer_id = c.id and i.status <> 'void'
        group by c.id, c.name
        having (coalesce(sum(i.total), 0) - coalesce((select sum(p.amount) from payments p where p.customer_id = c.id), 0)) > 0
        order by outstanding desc
        limit 5
      `),
    ]);

    return {
      currency: config.currency,
      customers: Number(customerCount?.count ?? 0),
      openInvoices: Number(invoiceAgg?.open_count ?? 0),
      receivables: round2(Number(invoiceAgg?.receivables ?? 0)),
      overdue: round2(Number(invoiceAgg?.overdue ?? 0)),
      collectedThisMonth: round2(Number(pick("month")?.total ?? 0)),
      collectedThisQuarter: round2(Number(pick("quarter")?.total ?? 0)),
      collectedThisYear: round2(Number(pick("year")?.total ?? 0)),
      vatDueThisQuarter: round2(Number(pick("quarter")?.vat ?? 0)),
      vatDueThisYear: round2(Number(pick("year")?.vat ?? 0)),
      recentInvoices: invoiceList,
      recentPayments: paymentList,
      topDebtors: debtors.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        outstanding: round2(Number(row.outstanding ?? 0)),
        invoiceCount: Number(row.invoice_count ?? 0),
      })),
    };
  } catch (error) {
    return handleDbError(error, "Unable to load dashboard");
  }
}

/* ------------------------------------------------------------------ *
 * Statement summaries — one row per customer
 * ------------------------------------------------------------------ */

export type StatementSummaryRow = {
  customerId: number;
  name: string;
  email: string | null;
  taxId: string | null;
  invoiceCount: number;
  receiptCount: number;
  openingBalance: number;
  periodInvoiced: number;
  periodReceived: number;
  closingBalance: number;
  currentOutstanding: number;
};

/**
 * Statement summary for every customer in a single query: opening balance,
 * movements inside the period, the closing balance at the end of the period
 * and the live outstanding balance irrespective of the selected range.
 */
export async function listStatementSummaries(
  from?: string,
  to?: string,
): Promise<StatementSummaryRow[]> {
  // PostgreSQL dates start at 0001-01-01, so use a safe "all time" lower bound.
  const start = from && from.trim() ? from.trim() : "1000-01-01";
  const end = to && to.trim() ? to.trim() : todayISO();
  try {
    const rows = await rawRows<Record<string, unknown>>(sql`
      with inv_before as (
        select i.customer_id, coalesce(sum(i.total), 0) as total
          from invoices i
         where i.status <> 'void' and i.issue_date < ${start}
         group by i.customer_id
      ),
      pay_before as (
        select p.customer_id, coalesce(sum(p.amount), 0) as total
          from payments p
         where p.payment_date < ${start}
         group by p.customer_id
      ),
      inv_period as (
        select i.customer_id, coalesce(sum(i.total), 0) as total, count(*)::int as cnt
          from invoices i
         where i.status <> 'void' and i.issue_date between ${start} and ${end}
         group by i.customer_id
      ),
      pay_period as (
        select p.customer_id, coalesce(sum(p.amount), 0) as total, count(*)::int as cnt
          from payments p
         where p.payment_date between ${start} and ${end}
         group by p.customer_id
      ),
      inv_all as (
        select i.customer_id, coalesce(sum(i.total), 0) as total
          from invoices i where i.status <> 'void' group by i.customer_id
      ),
      pay_all as (
        select p.customer_id, coalesce(sum(p.amount), 0) as total
          from payments p group by p.customer_id
      )
      select c.id,
             c.name,
             c.email,
             c.tax_id,
             coalesce(ib.total, 0) - coalesce(pb.total, 0) as opening_balance,
             coalesce(ip.total, 0) as period_invoiced,
             coalesce(pp.total, 0) as period_received,
             coalesce(ip.cnt, 0) as invoice_count,
             coalesce(pp.cnt, 0) as receipt_count,
             coalesce(ia.total, 0) - coalesce(pa.total, 0) as current_outstanding
        from customers c
        left join inv_before ib on ib.customer_id = c.id
        left join pay_before pb on pb.customer_id = c.id
        left join inv_period ip on ip.customer_id = c.id
        left join pay_period pp on pp.customer_id = c.id
        left join inv_all ia on ia.customer_id = c.id
        left join pay_all pa on pa.customer_id = c.id
       order by current_outstanding desc, c.name asc
    `);

    return rows.map((row) => {
      const opening = round2(Number(row.opening_balance ?? 0));
      const periodInvoiced = round2(Number(row.period_invoiced ?? 0));
      const periodReceived = round2(Number(row.period_received ?? 0));
      return {
        customerId: Number(row.id),
        name: String(row.name ?? ""),
        email: row.email ? String(row.email) : null,
        taxId: row.tax_id ? String(row.tax_id) : null,
        invoiceCount: Number(row.invoice_count ?? 0),
        receiptCount: Number(row.receipt_count ?? 0),
        openingBalance: opening,
        periodInvoiced,
        periodReceived,
        closingBalance: round2(opening + periodInvoiced - periodReceived),
        currentOutstanding: round2(Number(row.current_outstanding ?? 0)),
      };
    });
  } catch (error) {
    return handleDbError(error, "Unable to load customer statements");
  }
}
