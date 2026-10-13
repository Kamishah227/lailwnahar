import { fail, parseId } from "@/lib/api";
import { invoicePdf } from "@/lib/pdf";
import { getInvoice, getSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const invoice = await getInvoice(parseId(id, "invoice id"));
    const config = await getSettings();
    const bytes = await invoicePdf(invoice, config);
    const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
