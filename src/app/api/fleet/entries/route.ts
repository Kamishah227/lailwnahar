import { readJson, withHandler } from "@/lib/api";
import {
  addSalary,
  addVehicleIncome,
  deleteSalary,
  deleteVehicleIncome,
  listSalaries,
  listVehicleIncome,
} from "@/lib/fleet";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withHandler(async () => {
    const params = new URL(request.url).searchParams;
    const vehicleId = params.get("vehicleId");
    const from = params.get("from") ?? undefined;
    const to = params.get("to") ?? undefined;
    const [income, salaries] = await Promise.all([
      listVehicleIncome(vehicleId ? Number(vehicleId) : undefined, from, to),
      listSalaries(vehicleId ? Number(vehicleId) : undefined, from, to),
    ]);
    return { income, salaries };
  });
}

export async function POST(request: Request) {
  return withHandler(async () => {
    const body = (await readJson<Record<string, unknown>>(request)) as Record<string, unknown>;
    if (body.kind === "salary") {
      return addSalary({
        vehicleId: Number(body.vehicleId),
        operatorName: String(body.operatorName ?? ""),
        periodLabel: String(body.periodLabel ?? ""),
        paymentDate: String(body.paymentDate ?? ""),
        amount: Number(body.amount ?? 0),
        notes: body.notes ? String(body.notes) : null,
      });
    }
    return addVehicleIncome({
      vehicleId: Number(body.vehicleId),
      incomeDate: String(body.incomeDate ?? ""),
      description: String(body.description ?? ""),
      customerName: body.customerName ? String(body.customerName) : null,
      invoiceNumber: body.invoiceNumber ? String(body.invoiceNumber) : null,
      ratePer: body.ratePer ? String(body.ratePer) : "Trip",
      quantity: Number(body.quantity ?? 1),
      unitPrice: Number(body.unitPrice ?? 0),
      vatRate: Number(body.vatRate ?? 5),
      notes: body.notes ? String(body.notes) : null,
    });
  });
}

export async function DELETE(request: Request) {
  return withHandler(async () => {
    const params = new URL(request.url).searchParams;
    const id = Number(params.get("id"));
    const kind = params.get("kind");
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid entry id");
    return kind === "salary" ? deleteSalary(id) : deleteVehicleIncome(id);
  });
}
