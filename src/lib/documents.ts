import { desc, eq, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { documents, vehicles } from "@/db/schema";
import { formatDate, todayISO } from "@/lib/domain";
import { AppError, handleDbError } from "@/lib/repo";
import {
  documentStatus,
  sortDocuments,
  type DocumentRow,
  type DocumentStatus,
} from "@/lib/documentsShared";

export * from "@/lib/documentsShared";

const DOCUMENT_SELECT = {
  id: documents.id,
  title: documents.title,
  documentNumber: documents.documentNumber,
  category: documents.category,
  issuer: documents.issuer,
  holderName: documents.holderName,
  vehicleId: documents.vehicleId,
  vehicleCode: vehicles.code,
  issuedDate: documents.issuedDate,
  expiryDate: documents.expiryDate,
  renewalDate: documents.renewalDate,
  renewalLeadDays: documents.renewalLeadDays,
  notes: documents.notes,
  attachmentName: documents.attachmentName,
};

export async function listDocuments(filter: {
  category?: string;
  vehicleId?: number;
  status?: string;
} = {}): Promise<DocumentRow[]> {
  try {
    const conditions: SQL[] = [];
    if (filter.category) conditions.push(eq(documents.category, filter.category));
    if (filter.vehicleId) conditions.push(eq(documents.vehicleId, filter.vehicleId));

    const rows = await db
      .select(DOCUMENT_SELECT)
      .from(documents)
      .leftJoin(vehicles, eq(vehicles.id, documents.vehicleId))
      .where(conditions.length ? conditions[0] : undefined)
      .orderBy(desc(documents.id));

    const mapped: DocumentRow[] = rows.map((row) => {
      const state = documentStatus(row.expiryDate, row.renewalLeadDays ?? 30);
      return {
        ...row,
        renewalLeadDays: row.renewalLeadDays ?? 30,
        hasAttachment: Boolean(row.attachmentName),
        ...state,
      };
    });

    const ordered = sortDocuments(mapped);
    if (!filter.status || filter.status === "all") return ordered;
    if (filter.status === "attention") {
      return ordered.filter((row) => row.status === "expired" || row.status === "expiring");
    }
    return ordered.filter((row) => row.status === filter.status);
  } catch (error) {
    return handleDbError(error, "Unable to load documents");
  }
}

export type DocumentInput = {
  title: string;
  documentNumber?: string | null;
  category?: string | null;
  issuer?: string | null;
  holderName?: string | null;
  vehicleId?: number | null;
  issuedDate?: string | null;
  expiryDate?: string | null;
  renewalDate?: string | null;
  renewalLeadDays?: number;
  notes?: string | null;
  attachment?: { name: string; type: string; size: number; data: string } | null;
};

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export async function createDocument(input: DocumentInput): Promise<DocumentRow> {
  try {
    const title = (input.title ?? "").trim();
    if (title.length < 2) throw new AppError("Give the document a title.", 422);

    let attachment: Record<string, unknown> = {};
    if (input.attachment) {
      if (input.attachment.size > MAX_ATTACHMENT_BYTES) {
        throw new AppError("Documents must be smaller than 5 MB.", 422);
      }
      attachment = {
        attachmentName: input.attachment.name.slice(0, 180),
        attachmentType: input.attachment.type || "application/octet-stream",
        attachmentSize: input.attachment.size,
        attachmentData: input.attachment.data,
      };
    }

    const [row] = await db
      .insert(documents)
      .values({
        title,
        documentNumber: input.documentNumber || null,
        category: input.category || "Other",
        issuer: input.issuer || null,
        holderName: input.holderName || null,
        vehicleId: input.vehicleId || null,
        issuedDate: input.issuedDate || null,
        expiryDate: input.expiryDate || null,
        renewalDate: input.renewalDate || null,
        renewalLeadDays: input.renewalLeadDays ?? 30,
        notes: input.notes || null,
        ...attachment,
      })
      .returning({ id: documents.id });

    const all = await listDocuments();
    const found = all.find((item) => item.id === row.id);
    if (!found) throw new AppError("The document could not be read back.", 500);
    return found;
  } catch (error) {
    if (error instanceof AppError) throw error;
    return handleDbError(error, "Unable to save the document");
  }
}

export async function deleteDocument(id: number): Promise<{ ok: true }> {
  try {
    await db.delete(documents).where(eq(documents.id, id));
    return { ok: true };
  } catch (error) {
    return handleDbError(error, "Unable to delete the document");
  }
}

export async function getDocumentAttachment(
  id: number,
): Promise<{ data: string; type: string; name: string } | null> {
  try {
    const [row] = await db
      .select({
        attachmentData: documents.attachmentData,
        attachmentType: documents.attachmentType,
        attachmentName: documents.attachmentName,
      })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (!row?.attachmentData) return null;
    return {
      data: row.attachmentData,
      type: row.attachmentType ?? "application/octet-stream",
      name: row.attachmentName ?? `document-${id}`,
    };
  } catch (error) {
    return handleDbError(error, "Unable to load the document file");
  }
}

/* ------------------------------------------------------------------ *
 * Summary used by the dashboard panel
 * ------------------------------------------------------------------ */

export type DocumentSummary = {
  total: number;
  expired: number;
  expiring: number;
  valid: number;
  noExpiry: number;
  urgent: DocumentRow[];
};

export async function documentSummary(limit = 6): Promise<DocumentSummary> {
  const rows = await listDocuments();
  return {
    total: rows.length,
    expired: rows.filter((row) => row.status === "expired").length,
    expiring: rows.filter((row) => row.status === "expiring").length,
    valid: rows.filter((row) => row.status === "valid").length,
    noExpiry: rows.filter((row) => row.status === "no-expiry").length,
    // already ordered: recently expired first, then next to expire
    urgent: rows.slice(0, limit),
  };
}




