import { readJson, withHandler } from "@/lib/api";
import { createExpense, ensureCategories, listExpenses, type ExpenseInput } from "@/lib/expenses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withHandler(async () => {
    const params = new URL(request.url).searchParams;
    const vehicleId = params.get("vehicleId");
    const categoryId = params.get("categoryId");
    const [rows, categories] = await Promise.all([
      listExpenses({
        type: params.get("type") ?? undefined,
        vehicleId: vehicleId ? Number(vehicleId) : undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
      }),
      ensureCategories(),
    ]);
    return { expenses: rows, categories };
  });
}

export async function POST(request: Request) {
  return withHandler(async () => {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("attachment");
      let attachment: ExpenseInput["attachment"] = null;
      if (file && typeof file !== "string" && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        attachment = {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          data: buffer.toString("base64"),
        };
      }
      const value = (key: string) => {
        const raw = form.get(key);
        return typeof raw === "string" ? raw : null;
      };
      return createExpense({
        expenseDate: value("expenseDate") ?? "",
        vendorName: value("vendorName") ?? "",
        vendorTaxId: value("vendorTaxId"),
        vendorInvoiceRef: value("vendorInvoiceRef"),
        description: value("description") ?? "",
        categoryId: value("categoryId") ? Number(value("categoryId")) : null,
        type: (value("type") as "direct" | "indirect") ?? "direct",
        vehicleId: value("vehicleId") ? Number(value("vehicleId")) : null,
        netAmount: Number(value("netAmount") ?? 0),
        vatRate: Number(value("vatRate") ?? 5),
        paymentMethod: value("paymentMethod"),
        notes: value("notes"),
        attachment,
      });
    }

    const body = await readJson<ExpenseInput>(request);
    return createExpense(body);
  });
}
