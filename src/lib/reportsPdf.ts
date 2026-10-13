import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { formatDate, money } from "@/lib/domain";
import type { FleetReport, VehiclePnl } from "@/lib/fleet";
import type { SettingsDto } from "@/lib/repo";
import type { FullVatReport } from "@/lib/vatReport";

const INK = rgb(0.09, 0.11, 0.16);
const MUTED = rgb(0.42, 0.46, 0.53);
const LINE = rgb(0.85, 0.87, 0.9);
const ACCENT = rgb(0.05, 0.36, 0.72);
const GOOD = rgb(0.02, 0.47, 0.34);
const SOFT = rgb(0.96, 0.97, 0.99);

type Ctx = {
  doc: PDFDocument;
  page: any;
  font: any;
  bold: any;
  y: number;
  width: number;
  height: number;
  margin: number;
};

async function ctxFor(title: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer("LedgerLite");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  const width = page.getWidth();
  const margin = 42;
  return { doc, page, font, bold, y: page.getHeight() - margin - 10, width, height: page.getHeight(), margin } as Ctx;
}

function draw(ctx: Ctx, value: string, x: number, y: number, options: { size?: number; bold?: boolean; color?: any; align?: "left" | "right" } = {}) {
  const size = options.size ?? 10;
  const font = options.bold ? ctx.bold : ctx.font;
  const clean = value.replace(/[^\x20-\x7E]/g, "");
  const w = font.widthOfTextAtSize(clean, size);
  ctx.page.drawText(clean, {
    x: options.align === "right" ? x - w : x,
    y,
    size,
    font,
    color: options.color ?? INK,
  });
}

function brand(ctx: Ctx, config: SettingsDto, heading: string, subtitle: string) {
  draw(ctx, config.businessName || "LedgerLite", ctx.margin, ctx.y, { size: 18, bold: true });
  draw(ctx, heading, ctx.width - ctx.margin, ctx.y, { size: 18, bold: true, color: ACCENT, align: "right" });
  ctx.y -= 15;
  (config.businessAddress || "").split("\n").forEach((line) => {
    draw(ctx, line, ctx.margin, ctx.y, { size: 8.5, color: MUTED });
    ctx.y -= 10.5;
  });
  draw(ctx, config.vatNumber ? `VAT / Tax ID: ${config.vatNumber}` : "VAT / Tax ID: not set", ctx.margin, ctx.y, {
    size: 8.5,
    color: MUTED,
  });
  draw(ctx, subtitle, ctx.width - ctx.margin, ctx.y, { size: 9, color: MUTED, align: "right" });
  ctx.y -= 8;
  ctx.page.drawRectangle({ x: ctx.margin, y: ctx.y, width: ctx.width - ctx.margin * 2, height: 1.1, color: LINE });
  ctx.y -= 20;
}

function table(ctx: Ctx, columns: { header: string; width: number; align?: "left" | "right" }[], rows: string[][], footer: string[][] = []) {
  const render = (row: string[], opts: { bold?: boolean; fill?: boolean } = {}) => {
    if (ctx.y < 90) {
      ctx.page = ctx.doc.addPage();
      ctx.y = ctx.height - ctx.margin;
    }
    if (opts.fill) ctx.page.drawRectangle({ x: ctx.margin, y: ctx.y - 4, width: ctx.width - ctx.margin * 2, height: 16, color: SOFT });
    let x = ctx.margin + 4;
    columns.forEach((column, index) => {
      draw(ctx, row[index] ?? "", column.align === "right" ? x + column.width - 8 : x, ctx.y, {
        size: 9,
        bold: opts.bold,
        align: column.align ?? "left",
        color: opts.bold ? INK : MUTED,
      });
      x += column.width;
    });
    ctx.y -= 16;
  };
  render(columns.map((column) => column.header), { bold: true, fill: true });
  rows.forEach((row) => render(row));
  if (footer.length) {
    ctx.page.drawRectangle({ x: ctx.margin, y: ctx.y + 12, width: ctx.width - ctx.margin * 2, height: 0.8, color: LINE });
    footer.forEach((row) => render(row, { bold: true }));
  }
  ctx.y -= 6;
}

function footer(ctx: Ctx, message: string) {
  ctx.page.drawRectangle({ x: ctx.margin, y: 58, width: ctx.width - ctx.margin * 2, height: 0.8, color: LINE });
  ctx.page.drawText(message.replace(/[^\x20-\x7E]/g, "").slice(0, 115), {
    x: ctx.margin,
    y: 46,
    size: 7.5,
    font: ctx.font,
    color: MUTED,
  });
}

function kvTable(ctx: Ctx, rows: [string, string][], boldLast = true) {
  table(
    ctx,
    [
      { header: "DETAIL", width: 300 },
      { header: "AMOUNT", width: 211, align: "right" },
    ],
    rows.map(([label, value]) => [label, value]),
    boldLast ? [[rows[rows.length - 1][0], rows[rows.length - 1][1]]] : [],
  );
}

/* ------------------------------------------------------------------ *
 * VAT return PDF
 * ------------------------------------------------------------------ */

export async function fullVatReportPdf(report: FullVatReport, config: SettingsDto): Promise<Uint8Array> {
  const ctx = await ctxFor(`VAT return ${report.period.label}`);
  brand(ctx, config, "VAT RETURN (CASH BASIS)", `${report.period.label}: ${report.period.from} to ${report.period.to}`);

  draw(ctx, report.net.label.toUpperCase(), ctx.margin, ctx.y, { size: 9, color: MUTED });
  ctx.y -= 20;
  draw(ctx, money(report.net.netVat, report.currency), ctx.margin, ctx.y, {
    size: 28,
    bold: true,
    color: report.net.direction === "refundable" ? GOOD : ACCENT,
  });
  ctx.y -= 26;
  draw(
    ctx,
    `Output VAT ${money(report.output.outputVat, report.currency)} less input VAT ${money(report.input.totalVat, report.currency)}.`,
    ctx.margin,
    ctx.y,
    { size: 8.5, color: MUTED },
  );
  ctx.y -= 22;

  table(
    ctx,
    [
      { header: "BOX", width: 40 },
      { header: "DESCRIPTION", width: 260 },
      { header: "AMOUNT", width: 211, align: "right" },
    ],
    [
      ["1", "Taxable sales - cash received (net)", money(report.receipts.totals.netCollected, report.currency)],
      ["2", "OUTPUT VAT collected", money(report.output.outputVat, report.currency)],
      ["3", "Direct expenses - fuel, maintenance, operating (net)", money(report.input.directNet, report.currency)],
      ["4", "Indirect expenses - admin, overheads, utilities (net)", money(report.input.indirectNet, report.currency)],
      ["5", "INPUT VAT claimable", money(report.input.totalVat, report.currency)],
    ],
    [[report.net.direction === "refundable" ? "CR" : "PAY", report.net.label, money(report.net.netVat, report.currency)]],
  );

  if (report.receipts.rows.length) {
    ctx.y -= 6;
    draw(ctx, "SUPPORTING SCHEDULE - RECEIPTS", ctx.margin, ctx.y, { size: 10, bold: true });
    ctx.y -= 16;
    table(
      ctx,
      [
        { header: "DATE", width: 70 },
        { header: "RECEIPT", width: 66 },
        { header: "INVOICE", width: 66 },
        { header: "CUSTOMER", width: 140 },
        { header: "GROSS", width: 55, align: "right" },
        { header: "VAT", width: 54, align: "right" },
      ],
      report.receipts.rows.map((row) => [
        formatDate(row.paymentDate),
        row.receiptNumber,
        row.invoiceNumber,
        row.customerName.slice(0, 28),
        money(row.grossCollected, report.currency),
        money(row.vatCollected, report.currency),
      ]),
      [["", "", "", "TOTAL", money(report.receipts.totals.grossCollected, report.currency), money(report.output.outputVat, report.currency)]],
    );
  }

  footer(ctx, `${config.businessName} | Output VAT on cash received, input VAT on purchase invoices recorded`);
  return ctx.doc.save({ useObjectStreams: false });
}

/* ------------------------------------------------------------------ *
 * Per-vehicle P&L PDF
 * ------------------------------------------------------------------ */

export async function vehiclePnlPdf(pnl: VehiclePnl, config: SettingsDto, from: string, to: string): Promise<Uint8Array> {
  const currency = pnl.vehicle ? config.currency : config.currency;
  const ctx = await ctxFor(`Vehicle P&L ${pnl.vehicle.code}`);
  brand(ctx, config, "VEHICLE PROFIT & LOSS", `${pnl.vehicle.code} - ${pnl.vehicle.make} ${pnl.vehicle.model ?? ""}`.trim());

  draw(ctx, `Period ${formatDate(from)} to ${formatDate(to)}`, ctx.margin, ctx.y, { size: 9, color: MUTED });
  ctx.y -= 16;
  draw(ctx, money(pnl.netProfit, currency), ctx.margin, ctx.y, { size: 28, bold: true, color: pnl.netProfit >= 0 ? GOOD : ACCENT });
  ctx.y -= 24;
  draw(ctx, `Net margin ${pnl.margin.toFixed(2)}% on net revenue of ${money(pnl.netRevenue, currency)}`, ctx.margin, ctx.y, {
    size: 8.5,
    color: MUTED,
  });
  ctx.y -= 20;

  kvTable(ctx, [
    ["Gross monthly revenue (incl. VAT)", money(pnl.grossRevenue, currency)],
    ["Output VAT on vehicle revenue", money(pnl.outputVat, currency)],
    ["Net revenue", money(pnl.netRevenue, currency)],
    ["Direct operating expenses (excl. VAT)", money(pnl.directExpenses, currency)],
    [`Operator salary - ${pnl.vehicle.assignedOperator ?? "unassigned"}`, money(pnl.operatorSalary, currency)],
    ["Total costs", money(pnl.totalCosts, currency)],
    [`NET PROFIT (${pnl.margin.toFixed(2)}% margin)`, money(pnl.netProfit, currency)],
  ]);

  ctx.y -= 4;
  draw(ctx, "VEHICLE PROFILE", ctx.margin, ctx.y, { size: 10, bold: true });
  ctx.y -= 16;
  kvTable(ctx, [
    ["Vehicle ID / fleet code", pnl.vehicle.code],
    ["Make & model", `${pnl.vehicle.make} ${pnl.vehicle.model ?? ""}`.trim()],
    ["Plate number", pnl.vehicle.plateNumber],
    ["Status", pnl.vehicle.status],
    ["Assigned operator", pnl.vehicle.assignedOperator ?? "-"],
    ["Contracted monthly salary", money(pnl.vehicle.operatorMonthlySalary, currency)],
    ["Trips / revenue entries in period", String(pnl.tripCount)],
  ], false);

  footer(ctx, `${config.businessName} | Vehicle P&L excludes indirect overheads, which are reported on the VAT return`);
  return ctx.doc.save({ useObjectStreams: false });
}

/* ------------------------------------------------------------------ *
 * Fleet summary PDF
 * ------------------------------------------------------------------ */

export async function fleetReportPdf(report: FleetReport, config: SettingsDto): Promise<Uint8Array> {
  const ctx = await ctxFor("Fleet summary");
  brand(ctx, config, "FLEET SUMMARY", `${formatDate(report.from)} to ${formatDate(report.to)}`);

  draw(ctx, "FLEET NET PROFIT", ctx.margin, ctx.y, { size: 9, color: MUTED });
  ctx.y -= 20;
  draw(ctx, money(report.totals.netProfit, report.currency), ctx.margin, ctx.y, {
    size: 28,
    bold: true,
    color: report.totals.netProfit >= 0 ? GOOD : ACCENT,
  });
  ctx.y -= 26;
  draw(
    ctx,
    `${report.totals.vehicleCount} vehicles | margin ${report.totals.margin.toFixed(2)}% | best performer ${report.totals.bestPerformer ?? "-"} | highest cost ${report.totals.highestCost ?? "-"}`,
    ctx.margin,
    ctx.y,
    { size: 8.5, color: MUTED },
  );
  ctx.y -= 20;

  table(
    ctx,
    [
      { header: "VEHICLE", width: 56 },
      { header: "OPERATOR", width: 66 },
      { header: "STATUS", width: 44 },
      { header: "NET REV", width: 48, align: "right" },
      { header: "EXPENSES", width: 48, align: "right" },
      { header: "SALARY", width: 44, align: "right" },
      { header: "PROFIT", width: 48, align: "right" },
      { header: "MARGIN", width: 40, align: "right" },
    ],
    report.rows.map((row) => [
      row.vehicle.code,
      (row.vehicle.assignedOperator ?? "-").slice(0, 14),
      row.vehicle.status,
      money(row.netRevenue, report.currency),
      money(row.directExpenses, report.currency),
      money(row.operatorSalary, report.currency),
      money(row.netProfit, report.currency),
      `${row.margin.toFixed(1)}%`,
    ]),
    [[
      "TOTAL",
      "",
      "",
      money(report.totals.netRevenue, report.currency),
      money(report.totals.directExpenses, report.currency),
      money(report.totals.operatorSalary, report.currency),
      money(report.totals.netProfit, report.currency),
      `${report.totals.margin.toFixed(1)}%`,
    ]],
  );

  footer(ctx, `${config.businessName} | Fleet comparison over ${formatDate(report.from)} to ${formatDate(report.to)}`);
  return ctx.doc.save({ useObjectStreams: false });
}
