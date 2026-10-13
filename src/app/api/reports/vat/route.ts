import { fail } from "@/lib/api";
import { parsePeriodSearch } from "@/lib/domain";
import { fullVatReportPdf } from "@/lib/reportsPdf";
import { buildFullVatReport } from "@/lib/vatReport";
import { getSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const [report, config] = await Promise.all([buildFullVatReport(parsePeriodSearch(params)), getSettings()]);
    const bytes = await fullVatReportPdf(report, config);
    const disposition = params.get("download") === "1" ? "attachment" : "inline";
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="VAT-return-${report.period.label.replace(/\s+/g, "")}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
