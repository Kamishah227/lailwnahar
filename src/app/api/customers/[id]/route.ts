import { parseId, readJson, withHandler } from "@/lib/api";
import { deleteCustomer, getCustomer, updateCustomer, type CustomerInput } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withHandler(async () => {
    const { id } = await params;
    return getCustomer(parseId(id, "customer id"));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withHandler(async () => {
    const { id } = await params;
    const body = await readJson<CustomerInput>(request);
    return updateCustomer(parseId(id, "customer id"), body);
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withHandler(async () => {
    const { id } = await params;
    return deleteCustomer(parseId(id, "customer id"));
  });
}
