/** Small presentation-only helpers shared by the fleet UI. */

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  maintenance: "In maintenance",
  idle: "Idle",
  sold: "Sold",
};

export const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  maintenance: "bg-amber-100 text-amber-700 ring-amber-200",
  idle: "bg-slate-200 text-slate-600 ring-slate-300",
  sold: "bg-rose-100 text-rose-700 ring-rose-200",
};
