import { parseId, withHandler } from "@/lib/api";
import { deleteDocument } from "@/lib/documents";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withHandler(async () => {
    const { id } = await params;
    return deleteDocument(parseId(id, "document id"));
  });
}
