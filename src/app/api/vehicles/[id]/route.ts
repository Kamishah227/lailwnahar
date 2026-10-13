import { parseId, readJson, withHandler } from "@/lib/api";
import { deleteVehicle, getVehicle, saveVehicle, type VehicleInput } from "@/lib/fleet";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withHandler(async () => {
    const { id } = await params;
    return getVehicle(parseId(id, "vehicle id"));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withHandler(async () => {
    const { id } = await params;
    const body = await readJson<VehicleInput>(request);
    return saveVehicle(body, parseId(id, "vehicle id"));
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withHandler(async () => {
    const { id } = await params;
    return deleteVehicle(parseId(id, "vehicle id"));
  });
}
