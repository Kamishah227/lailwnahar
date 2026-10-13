import { fail, parseId } from "@/lib/api";
import { invoicePdf as receiptPdf } from "@/lib/pdf";
import { getInvoice, getSettings, listPayments } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const paymentId = parseId(id, "payment id");
    const all = await listPayments({ limit: 1000 });
    const payment = all.find((row) => row.id === paymentId);
    if (!payment) throw new Error("Receipt not found");

    const [invoice, config] = await Promise.all([getInvoice(payment.invoiceId), getSettings()]);

    // Pass 2 arguments: 1st argument is data object ({ payment, invoice }), 2nd argument is config
    const bytes = await receiptPdf({ payment, invoice } as any, config);

    const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";

    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="Receipt-${payment.receiptNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}