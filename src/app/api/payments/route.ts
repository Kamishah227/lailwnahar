import { readJson, withHandler } from "@/lib/api";
import { createPayment, listPayments, type PaymentInput } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withHandler(async () => {
    const params = new URL(request.url).searchParams;
    const customerId = params.get("customerId");
    return listPayments({
      customerId: customerId ? Number(customerId) : undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    });
  });
}

export async function POST(request: Request) {
  return withHandler(async () => {
    const body = await readJson<PaymentInput>(request);
    return createPayment(body);
  });
}
