import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { expenseCategories, expenses, vehicles } from "@/db/schema";
import { FIXED_VAT_RATE, round2 } from "@/lib/domain";
import { AppError, handleDbError } from "@/lib/repo";

export const DEFAULT_CATEGORIES: { name: string; type: "direct" | "indirect" }[] = [
  { name: "Fuel", type: "direct" },
  { name: "Vehicle maintenance", type: "direct" },
  { name: "Tyres", type: "direct" },
  { name: "Tolls & parking", type: "direct" },
  { name: "Driver allowance", type: "direct" },
  { name: "Office rent", type: "indirect" },
  { name: "Utilities", type: "indirect" },
  { name: "Accounting & legal", type: "indirect" },
  { name: "Insurance", type: "indirect" },
  { name: "Marketing", type: "indirect" },
];

export type ExpenseCategory = {
  id: number;
  name: string;
  type: "direct" | "indirect";
};

export type ExpenseRow = {
  id: number;
  expenseNumber: string;
  expenseDate: string;
  vendorName: string;
  vendorTaxId: string | null;
  vendorInvoiceRef: string | null;
  description: string;
  categoryId: number | null;
  categoryName: string | null;
  type: "direct" | "indirect";
  vehicleId: number | null;
  vehicleCode: string | null;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  grossAmount: number;
  paymentMethod: string | null;
  notes: string | null;
  hasAttachment: boolean;
  attachmentName: string | null;
};

export async function ensureCategories(): Promise<ExpenseCategory[]> {
  try {
    const existing = await db.select().from(expenseCategories).orderBy(asc(expenseCategories.type), asc(expenseCategories.name));
    if (existing.length > 0) {
      return existing.map((row) => ({ id: row.id, name: row.name, type: row.type as "direct" | "indirect" }));
    }
    await db.insert(expenseCategories).values(DEFAULT_CATEGORIES).onConflictDoNothing();
    const created = await db.select().from(expenseCategories).orderBy(asc(expenseCategories.type), asc(expenseCategories.name));
    return created.map((row) => ({ id: row.id, name: row.name, type: row.type as "direct" | "indirect" }));
  } catch (error) {
    return handleDbError(error, "Unable to load expense categories");
  }
}

const EXPENSE_SELECT = {
  id: expenses.id,
  expenseNumber: expenses.expenseNumber,
  expenseDate: expenses.expenseDate,
  vendorName: expenses.vendorName,
  vendorTaxId: expenses.vendorTaxId,
  vendorInvoiceRef: expenses.vendorInvoiceRef,
  description: expenses.description,
  categoryId: expenses.categoryId,
  categoryName: expenseCategories.name,
  type: expenses.type,
  vehicleId: expenses.vehicleId,
  vehicleCode: vehicles.code,
  netAmount: expenses.netAmount,
  vatRate: expenses.vatRate,
  vatAmount: expenses.vatAmount,
  grossAmount: expenses.grossAmount,
  paymentMethod: expenses.paymentMethod,
  notes: expenses.notes,
  attachmentName: expenses.attachmentName,
};

export async function listExpenses(filter: {
  type?: string;
  vehicleId?: number;
  categoryId?: number;
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<ExpenseRow[]> {
  try {
    const conditions: SQL[] = [];
    if (filter.type === "direct" || filter.type === "indirect") conditions.push(eq(expenses.type, filter.type));
    if (filter.vehicleId) conditions.push(eq(expenses.vehicleId, filter.vehicleId));
    if (filter.categoryId) conditions.push(eq(expenses.categoryId, filter.categoryId));
    if (filter.from) conditions.push(gte(expenses.expenseDate, filter.from));
    if (filter.to) conditions.push(lte(expenses.expenseDate, filter.to));

    const rows = await db
      .select(EXPENSE_SELECT)
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
      .leftJoin(vehicles, eq(vehicles.id, expenses.vehicleId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(expenses.expenseDate), desc(expenses.id))
      .limit(filter.limit ?? 300);

    return rows.map((row) => ({
      ...row,
      type: row.type as "direct" | "indirect",
      netAmount: round2(Number(row.netAmount)),
      vatRate: round2(Number(row.vatRate)),
      vatAmount: round2(Number(row.vatAmount)),
      grossAmount: round2(Number(row.grossAmount)),
      hasAttachment: Boolean(row.attachmentName),
    }));
  } catch (error) {
    return handleDbError(error, "Unable to load expenses");
  }
}

export type ExpenseInput = {
  expenseDate: string;
  vendorName: string;
  vendorTaxId?: string | null;
  vendorInvoiceRef?: string | null;
  description: string;
  categoryId?: number | null;
  type?: "direct" | "indirect";
  vehicleId?: number | null;
  netAmount: number;
  vatRate?: number;
  paymentMethod?: string | null;
  notes?: string | null;
  attachment?: { name: string; type: string; size: number; data: string } | null;
};

const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

export async function createExpense(input: ExpenseInput): Promise<ExpenseRow> {
  try {
    const vendorName = (input.vendorName ?? "").trim();
    const description = (input.description ?? "").trim();
    if (vendorName.length < 2) throw new AppError("Enter the vendor / supplier name.", 422);
    if (description.length < 2) throw new AppError("Describe the expense.", 422);

    const netAmount = round2(Number(input.netAmount));
    if (!(netAmount > 0)) throw new AppError("The expense amount must be greater than zero.", 422);

    const vatRate = round2(Number(input.vatRate ?? FIXED_VAT_RATE));
    const vatAmount = round2((netAmount * vatRate) / 100);
    const grossAmount = round2(netAmount + vatAmount);

    let attachment: Record<string, unknown> = {};
    if (input.attachment) {
      if (input.attachment.size > MAX_ATTACHMENT_BYTES) {
        throw new AppError("Receipt images must be smaller than 3 MB.", 422);
      }
      if (!/^image\//.test(input.attachment.type) && input.attachment.type !== "application/pdf") {
        throw new AppError("Attach an image or PDF receipt.", 422);
      }
      attachment = {
        attachmentName: input.attachment.name.slice(0, 180),
        attachmentType: input.attachment.type,
        attachmentSize: input.attachment.size,
        attachmentData: input.attachment.data,
      };
    }

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(expenses);
      const nextNumber = Number(row?.count ?? 0) + 1;
      const expenseNumber = `EXP-${String(nextNumber).padStart(4, "0")}`;

      const [inserted] = await tx
        .insert(expenses)
        .values({
          expenseNumber,
          expenseDate: input.expenseDate,
          vendorName,
          vendorTaxId: input.vendorTaxId || null,
          vendorInvoiceRef: input.vendorInvoiceRef || null,
          description,
          categoryId: input.categoryId || null,
          type: input.type === "indirect" ? "indirect" : "direct",
          vehicleId: input.vehicleId || null,
          netAmount: String(netAmount),
          vatRate: String(vatRate),
          vatAmount: String(vatAmount),
          grossAmount: String(grossAmount),
          paymentMethod: input.paymentMethod || null,
          notes: input.notes || null,
          ...attachment,
        })
        .returning({ id: expenses.id });
      return inserted.id;
    });

    const all = await listExpenses({ limit: 1000 });
    const found = all.find((row) => row.id === created);
    if (!found) throw new AppError("The expense could not be read back.", 500);
    return found;
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to save the expense");
  }
}

export async function deleteExpense(id: number): Promise<{ ok: true }> {
  try {
    await db.delete(expenses).where(eq(expenses.id, id));
    return { ok: true };
  } catch (error) {
    return handleDbError(error, "Unable to delete the expense");
  }
}

export async function getExpenseAttachment(
  id: number,
): Promise<{ data: string; type: string; name: string } | null> {
  try {
    const [row] = await db
      .select({
        attachmentData: expenses.attachmentData,
        attachmentType: expenses.attachmentType,
        attachmentName: expenses.attachmentName,
      })
      .from(expenses)
      .where(eq(expenses.id, id))
      .limit(1);
    if (!row?.attachmentData) return null;
    return {
      data: row.attachmentData,
      type: row.attachmentType ?? "application/octet-stream",
      name: row.attachmentName ?? `receipt-${id}`,
    };
  } catch (error) {
    return handleDbError(error, "Unable to load the receipt image");
  }
}

export type ExpenseVatTotals = {
  directNet: number;
  directVat: number;
  indirectNet: number;
  indirectVat: number;
  totalNet: number;
  totalVat: number;
  count: number;
};

/** Input VAT claimable on recorded purchase invoices inside a date range. */
export async function expenseVatTotals(from: string, to: string): Promise<ExpenseVatTotals> {
  try {
    const [row] = await db
      .select({
        directNet: sql<string>`coalesce(sum(case when ${expenses.type} = 'direct' then ${expenses.netAmount} else 0 end), 0)`,
        directVat: sql<string>`coalesce(sum(case when ${expenses.type} = 'direct' then ${expenses.vatAmount} else 0 end), 0)`,
        indirectNet: sql<string>`coalesce(sum(case when ${expenses.type} = 'indirect' then ${expenses.netAmount} else 0 end), 0)`,
        indirectVat: sql<string>`coalesce(sum(case when ${expenses.type} = 'indirect' then ${expenses.vatAmount} else 0 end), 0)`,
        totalNet: sql<string>`coalesce(sum(${expenses.netAmount}), 0)`,
        totalVat: sql<string>`coalesce(sum(${expenses.vatAmount}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(expenses)
      .where(and(gte(expenses.expenseDate, from), lte(expenses.expenseDate, to)));

    const directNet = round2(Number(row?.directNet ?? 0));
    const directVat = round2(Number(row?.directVat ?? 0));
    const indirectNet = round2(Number(row?.indirectNet ?? 0));
    const indirectVat = round2(Number(row?.indirectVat ?? 0));
    return {
      directNet,
      directVat,
      indirectNet,
      indirectVat,
      totalNet: round2(directNet + indirectNet),
      totalVat: round2(directVat + indirectVat),
      count: Number(row?.count ?? 0),
    };
  } catch (error) {
    return handleDbError(error, "Unable to total expenses");
  }
}
