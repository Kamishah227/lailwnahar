import { parseId, readJson, withHandler } from "@/lib/api";
import {
  deleteInvoice,
  getInvoice,
  setInvoiceStatus,
  updateInvoice,
  type InvoiceInput,
} from "@/lib/repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withHandler(async () => {
    const { id } = await params;
    return getInvoice(parseId(id, "invoice id"));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return withHandler(async () => {
    const { id } = await params;
    const invoiceId = parseId(id, "invoice id");
    const body = await readJson<InvoiceInput & { status?: "open" | "void" }>(request);
    
    if (body.status && !body.items) {
      return setInvoiceStatus(invoiceId, body.status === "void" ? "void" : "open");
    }
    
    return updateInvoice(invoiceId, body);
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return withHandler(async () => {
    const { id } = await params;
    return deleteInvoice(parseId(id, "invoice id"));
  });
}