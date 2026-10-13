import { fail, parseId } from "@/lib/api";
import { resolvePeriod } from "@/lib/domain";
import { buildVehiclePnl } from "@/lib/fleet";
import { vehiclePnlPdf, fleetReportPdf } from "@/lib/reportsPdf";
import { getSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const query = new URL(request.url).searchParams;
    const from = query.get("from") ?? undefined;
    const to = query.get("to") ?? undefined;
    const settings = await getSettings();
    const pnl = await buildVehiclePnl(parseId(id, "vehicle id"), from, to, settings.currency);
    const period = resolvePeriod("custom", {
      from: from ?? `${new Date().getUTCFullYear()}-01-01`,
      to: to ?? new Date().toISOString().slice(0, 10),
    });
    const bytes = await vehiclePnlPdf(pnl, settings, period.from, period.to);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Vehicle-PnL-${pnl.vehicle.code}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
