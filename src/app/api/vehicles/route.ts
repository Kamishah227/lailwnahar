import { readJson, withHandler } from "@/lib/api";
import { listVehicles, saveVehicle, type VehicleInput } from "@/lib/fleet";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withHandler(async () => {
    const params = new URL(request.url).searchParams;
    return listVehicles(params.get("from") ?? undefined, params.get("to") ?? undefined);
  });
}

export async function POST(request: Request) {
  return withHandler(async () => {
    const body = await readJson<VehicleInput>(request);
    return saveVehicle(body);
  });
}
