import { parseId, withHandler } from "@/lib/api";
import { deleteExpense } from "@/lib/expenses";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withHandler(async () => {
    const { id } = await params;
    return deleteExpense(parseId(id, "expense id"));
  });
}
