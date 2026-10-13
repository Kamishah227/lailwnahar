import { readJson, withHandler } from "@/lib/api";
import { createInvoice, listInvoices, type InvoiceInput } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withHandler(async () => {
    const params = new URL(request.url).searchParams;
    const customerId = params.get("customerId");
    return listInvoices({
      customerId: customerId ? Number(customerId) : undefined,
      status: params.get("status") ?? undefined,
      search: params.get("search") ?? undefined,
    });
  });
}

export async function POST(request: Request) {
  return withHandler(async () => {
    const body = await readJson<InvoiceInput>(request);
    return createInvoice(body);
  });
}
