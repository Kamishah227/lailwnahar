import { formatDate, todayISO } from "@/lib/domain";

export const DOCUMENT_CATEGORIES = [
  "Vehicle registration",
  "Vehicle insurance",
  "Vehicle inspection",
  "Driving licence",
  "Operator permit",
  "Business licence",
  "Contract",
  "Lease",
  "Tax certificate",
  "Health & safety",
  "Other",
] as const;

export type DocumentStatus = "expired" | "expiring" | "valid" | "no-expiry";

export type DocumentRow = {
  id: number;
  title: string;
  documentNumber: string | null;
  category: string;
  issuer: string | null;
  holderName: string | null;
  vehicleId: number | null;
  vehicleCode: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  renewalDate: string | null;
  renewalLeadDays: number;
  notes: string | null;
  hasAttachment: boolean;
  attachmentName: string | null;
  status: DocumentStatus;
  daysLeft: number | null;
  statusLabel: string;
};

function diffDays(target: string | null, today: string): number | null {
  if (!target) return null;
  const a = new Date(`${target.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${today.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

export function documentStatus(
  expiryDate: string | null,
  renewalLeadDays = 30,
  today = todayISO(),
): { status: DocumentStatus; daysLeft: number | null; statusLabel: string } {
  const days = diffDays(expiryDate, today);
  if (days === null) {
    return { status: "no-expiry", daysLeft: null, statusLabel: "No expiry" };
  }
  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      status: "expired",
      daysLeft: days,
      statusLabel:
        overdue === 1 ? "Expired 1 day ago" : `Expired ${overdue} days ago`,
    };
  }
  if (days === 0) return { status: "expired", daysLeft: 0, statusLabel: "Expired today" };
  if (days <= renewalLeadDays) {
    return {
      status: "expiring",
      daysLeft: days,
      statusLabel: days === 1 ? "Expires tomorrow" : `Expires in ${days} days`,
    };
  }
  return { status: "valid", daysLeft: days, statusLabel: `Valid · ${days} days left` };
}

/**
 * Ordering required by the spec: recently expired documents first (the one that
 * expired most recently at the top), then the next documents to expire, then
 * everything else. Documents without an expiry date sit at the end.
 */
export function sortDocuments<T extends { expiryDate: string | null }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const leftExpired = left.expiryDate ? left.expiryDate < todayISO() : false;
    const rightExpired = right.expiryDate ? right.expiryDate < todayISO() : false;

    if (!left.expiryDate && !right.expiryDate) return 0;
    if (!left.expiryDate) return 1;
    if (!right.expiryDate) return -1;

    if (leftExpired && rightExpired) {
      // most recently expired first
      return left.expiryDate < right.expiryDate ? 1 : -1;
    }
    if (leftExpired) return -1;
    if (rightExpired) return 1;
    // soonest expiry first
    return left.expiryDate < right.expiryDate ? -1 : 1;
  });
}

export function statusTone(status: DocumentStatus): string {
  switch (status) {
    case "expired":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    case "expiring":
      return "bg-amber-100 text-amber-700 ring-amber-200";
    case "valid":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    default:
      return "bg-slate-200 text-slate-600 ring-slate-300";
  }
}

export function formatExpiry(row: Pick<DocumentRow, "expiryDate" | "renewalDate">): string {
  if (!row.expiryDate) return "No expiry";
  return `Expires ${formatDate(row.expiryDate)}${
    row.renewalDate ? ` · renew by ${formatDate(row.renewalDate)}` : ""
  }`;
}
