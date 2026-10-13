import { parseId, readJson, withHandler } from "@/lib/api";
import { deletePayment, updatePayment, type PaymentInput } from "@/lib/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Amend a receipt — the cash-basis VAT element is recalculated. */
export async function PUT(request: Request, { params }: Params) {
  return withHandler(async () => {
    const { id } = await params;
    const body = await readJson<PaymentInput>(request);
    return updatePayment(parseId(id, "payment id"), body);
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withHandler(async () => {
    const { id } = await params;
    return deletePayment(parseId(id, "payment id"));
  });
}
