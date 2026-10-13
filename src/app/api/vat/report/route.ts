import { withHandler } from "@/lib/api";
import { parsePeriodSearch } from "@/lib/domain";
import { buildFullVatReport } from "@/lib/vatReport";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withHandler(async () => {
    const params = new URL(request.url).searchParams;
    return buildFullVatReport(parsePeriodSearch(params));
  });
}
