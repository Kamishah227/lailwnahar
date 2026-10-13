import { fail } from "@/lib/api";
import { buildFleetReport } from "@/lib/fleet";
import { fleetReportPdf } from "@/lib/reportsPdf";
import { getSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const [settings, report] = await Promise.all([
      getSettings(),
      buildFleetReport(
        query.get("from") ?? undefined,
        query.get("to") ?? undefined,
      ).then((value) => ({ ...value, currency: "" })),
    ]);
    const withCurrency = { ...report, currency: settings.currency };
    const bytes = await fleetReportPdf(withCurrency, settings);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Fleet-summary-${report.from}-to-${report.to}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
