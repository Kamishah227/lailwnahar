import { withHandler } from "@/lib/api";
import { getDashboard } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  return withHandler(() => getDashboard());
}
