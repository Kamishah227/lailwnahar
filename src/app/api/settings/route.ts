import { readJson, withHandler } from "@/lib/api";
import { getSettings, updateSettings, type SettingsDto } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  return withHandler(() => getSettings());
}

export async function PUT(request: Request) {
  return withHandler(async () => {
    const body = await readJson<Partial<SettingsDto>>(request);
    return updateSettings(body);
  });
}
