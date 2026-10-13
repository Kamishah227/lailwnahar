import { fail, parseId } from "@/lib/api";
import { statementPdf } from "@/lib/pdf";
import { buildStatement, getSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  try {
    const { customerId } = await params;
    const query = new URL(request.url).searchParams;
    const [statement, config] = await Promise.all([
      buildStatement(
        parseId(customerId, "customer id"),
        query.get("from") ?? undefined,
        query.get("to") ?? undefined,
      ),
      getSettings(),
    ]);
    const bytes = await statementPdf(statement, config);
    const disposition = query.get("download") === "1" ? "attachment" : "inline";
    const safeName = statement.customer.name.replace(/[^a-z0-9]+/gi, "-");
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="Statement-${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
