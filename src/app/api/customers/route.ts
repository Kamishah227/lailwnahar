import { readJson, withHandler } from "@/lib/api";
import { createCustomer, listCustomers, type CustomerInput } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withHandler(async () => {
    const search = new URL(request.url).searchParams.get("search") ?? undefined;
    return listCustomers(search);
  });
}

export async function POST(request: Request) {
  return withHandler(async () => {
    const body = await readJson<CustomerInput>(request);
    return createCustomer(body);
  });
}
