import { parseId, withHandler } from "@/lib/api";
import { buildStatement } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  return withHandler(async () => {
    const { customerId } = await params;
    const query = new URL(request.url).searchParams;
    return buildStatement(parseId(customerId, "customer id"), query.get("from") ?? undefined, query.get("to") ?? undefined);
  });
}
