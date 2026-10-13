import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { expenses, operatorSalaries, vehicleIncome, vehicles } from "@/db/schema";
import { FIXED_VAT_RATE, round2 } from "@/lib/domain";
import { AppError, handleDbError } from "@/lib/repo";

export const VEHICLE_STATUSES = ["active", "maintenance", "idle", "sold"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export type VehicleRow = {
  id: number;
  code: string;
  make: string;
  model: string | null;
  year: number | null;
  plateNumber: string;
  status: VehicleStatus;
  assignedOperator: string | null;
  operatorMonthlySalary: number;
  purchasedAt: string | null;
  notes: string | null;
  incomeNet: number;
  expenseNet: number;
  salaryPaid: number;
  netProfit: number;
};

const VEHICLE_SELECT = {
  id: vehicles.id,
  code: vehicles.code,
  make: vehicles.make,
  model: vehicles.model,
  year: vehicles.year,
  plateNumber: vehicles.plateNumber,
  status: vehicles.status,
  assignedOperator: vehicles.assignedOperator,
  operatorMonthlySalary: vehicles.operatorMonthlySalary,
  purchasedAt: vehicles.purchasedAt,
  notes: vehicles.notes,
};

type VehicleRecord = {
  id: number;
  code: string;
  make: string;
  model: string | null;
  year: number | null;
  plateNumber: string;
  status: string;
  assignedOperator: string | null;
  operatorMonthlySalary: string;
  purchasedAt: string | null;
  notes: string | null;
};

function mapVehicle(row: VehicleRecord, income: number, expense: number, salary: number): VehicleRow {
  return {
    id: Number(row.id),
    code: row.code,
    make: row.make,
    model: row.model,
    year: row.year === null ? null : Number(row.year),
    plateNumber: row.plateNumber,
    status: (VEHICLE_STATUSES.includes(row.status as VehicleStatus)
      ? row.status
      : "active") as VehicleStatus,
    assignedOperator: row.assignedOperator,
    operatorMonthlySalary: round2(Number(row.operatorMonthlySalary)),
    purchasedAt: row.purchasedAt,
    notes: row.notes,
    incomeNet: round2(income),
    expenseNet: round2(expense),
    salaryPaid: round2(salary),
    netProfit: round2(income - expense - salary),
  };
}

async function vehicleAggregates(from?: string, to?: string) {
  const incomeConditions: SQL[] = [];
  const expenseConditions: SQL[] = [sql`${expenses.vehicleId} is not null`, eq(expenses.type, "direct")];
  const salaryConditions: SQL[] = [];
  if (from) {
    incomeConditions.push(gte(vehicleIncome.incomeDate, from));
    expenseConditions.push(gte(expenses.expenseDate, from));
    salaryConditions.push(gte(operatorSalaries.paymentDate, from));
  }
  if (to) {
    incomeConditions.push(lte(vehicleIncome.incomeDate, to));
    expenseConditions.push(lte(expenses.expenseDate, to));
    salaryConditions.push(lte(operatorSalaries.paymentDate, to));
  }

  const [incomeRows, expenseRows, salaryRows] = await Promise.all([
    db
      .select({
        vehicleId: vehicleIncome.vehicleId,
        net: sql<string>`coalesce(sum(${vehicleIncome.netAmount}), 0)`,
      })
      .from(vehicleIncome)
      .where(incomeConditions.length ? and(...incomeConditions) : undefined)
      .groupBy(vehicleIncome.vehicleId),
    db
      .select({
        vehicleId: expenses.vehicleId,
        net: sql<string>`coalesce(sum(${expenses.netAmount}), 0)`,
      })
      .from(expenses)
      .where(and(...expenseConditions))
      .groupBy(expenses.vehicleId),
    db
      .select({
        vehicleId: operatorSalaries.vehicleId,
        net: sql<string>`coalesce(sum(${operatorSalaries.amount}), 0)`,
      })
      .from(operatorSalaries)
      .where(salaryConditions.length ? and(...salaryConditions) : undefined)
      .groupBy(operatorSalaries.vehicleId),
  ]);

  const incomeMap = new Map(incomeRows.map((row) => [Number(row.vehicleId), Number(row.net)]));
  const expenseMap = new Map(expenseRows.map((row) => [Number(row.vehicleId), Number(row.net)]));
  const salaryMap = new Map(salaryRows.map((row) => [Number(row.vehicleId), Number(row.net)]));

  return (vehicleId: number) => ({
    income: incomeMap.get(vehicleId) ?? 0,
    expense: expenseMap.get(vehicleId) ?? 0,
    salary: salaryMap.get(vehicleId) ?? 0,
  });
}

export async function listVehicles(from?: string, to?: string): Promise<VehicleRow[]> {
  try {
    const rows = await db.select(VEHICLE_SELECT).from(vehicles).orderBy(asc(vehicles.code));
    const lookup = await vehicleAggregates(from, to);
    return rows.map((row) => {
      const totals = lookup(Number(row.id));
      return mapVehicle(row as unknown as VehicleRecord, totals.income, totals.expense, totals.salary);
    });
  } catch (error) {
    return handleDbError(error, "Unable to load the fleet");
  }
}

export async function getVehicle(id: number): Promise<VehicleRow> {
  const rows = await listVehicles();
  const found = rows.find((row) => row.id === id);
  if (!found) throw new AppError("Vehicle not found", 404);
  return found;
}

export type VehicleInput = {
  code: string;
  make: string;
  model?: string | null;
  year?: number | null;
  plateNumber: string;
  status?: VehicleStatus;
  assignedOperator?: string | null;
  operatorMonthlySalary?: number;
  purchasedAt?: string | null;
  notes?: string | null;
};

export async function saveVehicle(input: VehicleInput, id?: number): Promise<VehicleRow> {
  try {
    const code = (input.code ?? "").trim();
    const make = (input.make ?? "").trim();
    const plate = (input.plateNumber ?? "").trim();
    if (!code) throw new AppError("Enter a vehicle ID / fleet code.", 422);
    if (!make) throw new AppError("Enter the make.", 422);
    if (!plate) throw new AppError("Enter the plate number.", 422);

    const values = {
      code,
      make,
      model: input.model || null,
      year: input.year ? Number(input.year) : null,
      plateNumber: plate,
      status: input.status ?? "active",
      assignedOperator: input.assignedOperator || null,
      operatorMonthlySalary: String(round2(Number(input.operatorMonthlySalary ?? 0))),
      purchasedAt: input.purchasedAt || null,
      notes: input.notes || null,
    };

    if (id) {
      await db.update(vehicles).set(values).where(eq(vehicles.id, id));
    } else {
      await db.insert(vehicles).values(values);
    }
    const all = await listVehicles();
    const found = all.find((row) => row.code === code);
    if (!found) throw new AppError("The vehicle could not be read back.", 500);
    return found;
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to save the vehicle");
  }
}

export async function deleteVehicle(id: number): Promise<{ ok: true }> {
  try {
    await db.delete(vehicles).where(eq(vehicles.id, id));
    return { ok: true };
  } catch (error) {
    return handleDbError(error, "Unable to delete the vehicle");
  }
}

/* ------------------------------------------------------------------ *
 * Income entries
 * ------------------------------------------------------------------ */

export type VehicleIncomeRow = {
  id: number;
  vehicleId: number;
  incomeDate: string;
  description: string;
  customerName: string | null;
  invoiceNumber: string | null;
  ratePer: string | null;
  quantity: number;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  grossAmount: number;
  notes: string | null;
};

export async function listVehicleIncome(vehicleId?: number, from?: string, to?: string): Promise<VehicleIncomeRow[]> {
  try {
    const conditions: SQL[] = [];
    if (vehicleId) conditions.push(eq(vehicleIncome.vehicleId, vehicleId));
    if (from) conditions.push(gte(vehicleIncome.incomeDate, from));
    if (to) conditions.push(lte(vehicleIncome.incomeDate, to));
    const rows = await db
      .select()
      .from(vehicleIncome)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(vehicleIncome.incomeDate), desc(vehicleIncome.id));
    return rows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      incomeDate: row.incomeDate,
      description: row.description,
      customerName: row.customerName,
      invoiceNumber: row.invoiceNumber,
      ratePer: row.ratePer,
      quantity: Number(row.quantity),
      netAmount: round2(Number(row.netAmount)),
      vatRate: round2(Number(row.vatRate)),
      vatAmount: round2(Number(row.vatAmount)),
      grossAmount: round2(Number(row.grossAmount)),
      notes: row.notes,
    }));
  } catch (error) {
    return handleDbError(error, "Unable to load vehicle income");
  }
}

export async function addVehicleIncome(payload: {
  vehicleId: number;
  incomeDate: string;
  description: string;
  customerName?: string | null;
  invoiceNumber?: string | null;
  ratePer?: string | null;
  quantity?: number;
  unitPrice: number;
  vatRate?: number;
  notes?: string | null;
}): Promise<VehicleIncomeRow> {
  try {
    if (!payload.vehicleId) throw new AppError("Select a vehicle.", 422);
    const description = (payload.description ?? "").trim();
    if (description.length < 2) throw new AppError("Describe the income entry.", 422);
    const quantity = round2(Number(payload.quantity ?? 1));
    const unitPrice = round2(Number(payload.unitPrice));
    if (!(quantity > 0)) throw new AppError("Quantity must be greater than zero.", 422);
    if (!(unitPrice > 0)) throw new AppError("Enter the rate charged.", 422);
    const vatRate = round2(Number(payload.vatRate ?? FIXED_VAT_RATE));
    const net = round2(quantity * unitPrice);
    const vat = round2((net * vatRate) / 100);

    const [row] = await db
      .insert(vehicleIncome)
      .values({
        vehicleId: payload.vehicleId,
        incomeDate: payload.incomeDate,
        description,
        customerName: payload.customerName || null,
        invoiceNumber: payload.invoiceNumber || null,
        ratePer: payload.ratePer || "Trip",
        quantity: String(quantity),
        netAmount: String(net),
        vatRate: String(vatRate),
        vatAmount: String(vat),
        grossAmount: String(round2(net + vat)),
        notes: payload.notes || null,
      })
      .returning({ id: vehicleIncome.id });

    const all = await listVehicleIncome(payload.vehicleId);
    const found = all.find((entry) => entry.id === row.id);
    if (!found) throw new AppError("The income entry could not be read back.", 500);
    return found;
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to record vehicle income");
  }
}

export async function deleteVehicleIncome(id: number): Promise<{ ok: true }> {
  try {
    await db.delete(vehicleIncome).where(eq(vehicleIncome.id, id));
    return { ok: true };
  } catch (error) {
    return handleDbError(error, "Unable to delete the income entry");
  }
}

/* ------------------------------------------------------------------ *
 * Operator salaries
 * ------------------------------------------------------------------ */

export type OperatorSalaryRow = {
  id: number;
  vehicleId: number;
  operatorName: string;
  periodLabel: string;
  paymentDate: string;
  amount: number;
  notes: string | null;
};

export async function listSalaries(vehicleId?: number, from?: string, to?: string): Promise<OperatorSalaryRow[]> {
  try {
    const conditions: SQL[] = [];
    if (vehicleId) conditions.push(eq(operatorSalaries.vehicleId, vehicleId));
    if (from) conditions.push(gte(operatorSalaries.paymentDate, from));
    if (to) conditions.push(lte(operatorSalaries.paymentDate, to));
    const rows = await db
      .select()
      .from(operatorSalaries)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(operatorSalaries.paymentDate), desc(operatorSalaries.id));
    return rows.map((row) => ({
      id: row.id,
      vehicleId: row.vehicleId,
      operatorName: row.operatorName,
      periodLabel: row.periodLabel,
      paymentDate: row.paymentDate,
      amount: round2(Number(row.amount)),
      notes: row.notes,
    }));
  } catch (error) {
    return handleDbError(error, "Unable to load operator salaries");
  }
}

export async function addSalary(payload: {
  vehicleId: number;
  operatorName: string;
  periodLabel: string;
  paymentDate: string;
  amount: number;
  notes?: string | null;
}): Promise<OperatorSalaryRow> {
  try {
    if (!payload.vehicleId) throw new AppError("Select a vehicle.", 422);
    const operator = (payload.operatorName ?? "").trim();
    if (operator.length < 2) throw new AppError("Enter the operator name.", 422);
    const amount = round2(Number(payload.amount));
    if (!(amount > 0)) throw new AppError("The salary amount must be greater than zero.", 422);
    const periodLabel = (payload.periodLabel || payload.paymentDate.slice(0, 7) || "").trim();

    const [row] = await db
      .insert(operatorSalaries)
      .values({
        vehicleId: payload.vehicleId,
        operatorName: operator,
        periodLabel,
        paymentDate: payload.paymentDate,
        amount: String(amount),
        notes: payload.notes || null,
      })
      .returning({ id: operatorSalaries.id });

    const all = await listSalaries(payload.vehicleId);
    const found = all.find((entry) => entry.id === row.id);
    if (!found) throw new AppError("The salary entry could not be read back.", 500);
    return found;
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to record the operator salary");
  }
}

export async function deleteSalary(id: number): Promise<{ ok: true }> {
  try {
    await db.delete(operatorSalaries).where(eq(operatorSalaries.id, id));
    return { ok: true };
  } catch (error) {
    return handleDbError(error, "Unable to delete the salary entry");
  }
}

/* ------------------------------------------------------------------ *
 * Per-vehicle P&L and fleet summary
 * ------------------------------------------------------------------ */

export type VehiclePnl = {
  vehicle: VehicleRow;
  grossRevenue: number;
  netRevenue: number;
  outputVat: number;
  directExpenses: number;
  directExpenseVat: number;
  operatorSalary: number;
  totalCosts: number;
  netProfit: number;
  margin: number;
  tripCount: number;
};

export type FleetReport = {
  from: string;
  to: string;
  currency: string;
  rows: VehiclePnl[];
  totals: {
    grossRevenue: number;
    netRevenue: number;
    outputVat: number;
    directExpenses: number;
    operatorSalary: number;
    totalCosts: number;
    netProfit: number;
    margin: number;
    vehicleCount: number;
    bestPerformer: string | null;
    worstPerformer: string | null;
    highestCost: string | null;
  };
};

export async function buildVehiclePnl(
  vehicleId: number,
  from?: string,
  to?: string,
  currency = "USD",
): Promise<VehiclePnl> {
  const report = await buildFleetReport(from, to, currency);
  const row = report.rows.find((entry) => entry.vehicle.id === vehicleId);
  if (!row) throw new AppError("Vehicle not found", 404);
  return row;
}

export async function buildFleetReport(from?: string, to?: string, currency = "USD"): Promise<FleetReport> {
  try {
    const start = from ?? "1000-01-01";
    const end = to ?? new Date().toISOString().slice(0, 10);

    const fleet = await listVehicles(start, end);
    const [income, salaryRows] = await Promise.all([
      listVehicleIncome(undefined, start, end),
      listSalaries(undefined, start, end),
    ]);
    const expenseRows = (
      await db
        .select({
          vehicleId: expenses.vehicleId,
          net: expenses.netAmount,
          vat: expenses.vatAmount,
        })
        .from(expenses)
        .where(
          and(
            sql`${expenses.vehicleId} is not null`,
            eq(expenses.type, "direct"),
            gte(expenses.expenseDate, start),
            lte(expenses.expenseDate, end),
          ),
        )
    ).map((row) => ({
      vehicleId: Number(row.vehicleId),
      net: round2(Number(row.net)),
      vat: round2(Number(row.vat)),
    }));

    const rows: VehiclePnl[] = fleet.map((vehicle) => {
      const vehicleIncomeRows = income.filter((entry) => entry.vehicleId === vehicle.id);
      const vehicleExpenseRows = expenseRows.filter((entry) => entry.vehicleId === vehicle.id);
      const vehicleSalaryRows = salaryRows.filter((entry) => entry.vehicleId === vehicle.id);

      const grossRevenue = round2(
        vehicleIncomeRows.reduce((sum, entry) => sum + entry.grossAmount, 0),
      );
      const netRevenue = round2(vehicleIncomeRows.reduce((sum, entry) => sum + entry.netAmount, 0));
      const outputVat = round2(vehicleIncomeRows.reduce((sum, entry) => sum + entry.vatAmount, 0));
      const directExpenses = round2(vehicleExpenseRows.reduce((sum, entry) => sum + entry.net, 0));
      const directExpenseVat = round2(vehicleExpenseRows.reduce((sum, entry) => sum + entry.vat, 0));
      const operatorSalary = round2(vehicleSalaryRows.reduce((sum, entry) => sum + entry.amount, 0));
      const totalCosts = round2(directExpenses + operatorSalary);
      const netProfit = round2(netRevenue - totalCosts);

      return {
        vehicle,
        grossRevenue,
        netRevenue,
        outputVat,
        directExpenses,
        directExpenseVat,
        operatorSalary,
        totalCosts,
        netProfit,
        margin: netRevenue > 0 ? round2((netProfit / netRevenue) * 100) : 0,
        tripCount: vehicleIncomeRows.length,
      };
    });

    const totalsNetRevenue = round2(rows.reduce((sum, row) => sum + row.netRevenue, 0));
    const totalsNetProfit = round2(rows.reduce((sum, row) => sum + row.netProfit, 0));
    const totalsCosts = round2(rows.reduce((sum, row) => sum + row.totalCosts, 0));

    const byProfit = [...rows].sort((a, b) => b.netProfit - a.netProfit);
    const byCost = [...rows].sort((a, b) => b.totalCosts - a.totalCosts);

    return {
      from: start,
      to: end,
      currency,
      rows,
      totals: {
        grossRevenue: round2(rows.reduce((sum, row) => sum + row.grossRevenue, 0)),
        netRevenue: totalsNetRevenue,
        outputVat: round2(rows.reduce((sum, row) => sum + row.outputVat, 0)),
        directExpenses: round2(rows.reduce((sum, row) => sum + row.directExpenses, 0)),
        operatorSalary: round2(rows.reduce((sum, row) => sum + row.operatorSalary, 0)),
        totalCosts: totalsCosts,
        netProfit: totalsNetProfit,
        margin: totalsNetRevenue > 0 ? round2((totalsNetProfit / totalsNetRevenue) * 100) : 0,
        vehicleCount: rows.length,
        bestPerformer: byProfit[0]?.vehicle.code ?? null,
        worstPerformer: byProfit.length ? byProfit[byProfit.length - 1].vehicle.code : null,
        highestCost: byCost[0]?.vehicle.code ?? null,
      },
    };
  } catch (error) {
    return handleDbError(error, "Unable to build the fleet report");
  }
}
