import { fail, parseId } from "@/lib/api";
import { getExpenseAttachment } from "@/lib/expenses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const attachment = await getExpenseAttachment(parseId(id, "expense id"));
    if (!attachment) {
      return Response.json({ ok: false, error: "No receipt attached" }, { status: 404 });
    }
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(Buffer.from(attachment.data, "base64"), {
      headers: {
        "Content-Type": attachment.type,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${attachment.name.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
