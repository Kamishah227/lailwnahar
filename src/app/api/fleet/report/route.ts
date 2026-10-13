import { withHandler } from "@/lib/api";
import { buildFleetReport, buildVehiclePnl } from "@/lib/fleet";
import { getSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withHandler(async () => {
    const params = new URL(request.url).searchParams;
    const from = params.get("from") ?? undefined;
    const to = params.get("to") ?? undefined;
    const vehicleId = params.get("vehicleId");
    const settings = await getSettings();

    if (vehicleId) {
      const pnl = await buildVehiclePnl(Number(vehicleId), from, to, settings.currency);
      return { mode: "vehicle" as const, report: pnl };
    }
    const report = await buildFleetReport(from, to, settings.currency);
    return { mode: "fleet" as const, report };
  });
}
