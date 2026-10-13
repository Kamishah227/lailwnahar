import { readJson, withHandler } from "@/lib/api";
import {
  createDocument,
  DOCUMENT_CATEGORIES,
  listDocuments,
  type DocumentInput,
} from "@/lib/documents";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withHandler(async () => {
    const params = new URL(request.url).searchParams;
    const vehicleId = params.get("vehicleId");
    const rows = await listDocuments({
      category: params.get("category") ?? undefined,
      status: params.get("status") ?? undefined,
      vehicleId: vehicleId ? Number(vehicleId) : undefined,
    });
    return { documents: rows, categories: DOCUMENT_CATEGORIES };
  });
}

export async function POST(request: Request) {
  return withHandler(async () => {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("attachment");
      let attachment: DocumentInput["attachment"] = null;
      if (file && typeof file !== "string" && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        attachment = {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          data: buffer.toString("base64"),
        };
      }
      const value = (key: string) => {
        const raw = form.get(key);
        return typeof raw === "string" && raw !== "" ? raw : null;
      };
      return createDocument({
        title: value("title") ?? "",
        documentNumber: value("documentNumber"),
        category: value("category"),
        issuer: value("issuer"),
        holderName: value("holderName"),
        vehicleId: value("vehicleId") ? Number(value("vehicleId")) : null,
        issuedDate: value("issuedDate"),
        expiryDate: value("expiryDate"),
        renewalDate: value("renewalDate"),
        renewalLeadDays: value("renewalLeadDays") ? Number(value("renewalLeadDays")) : 30,
        notes: value("notes"),
        attachment,
      });
    }

    const body = await readJson<DocumentInput>(request);
    return createDocument(body);
  });
}
