"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Dashboard", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/customers", label: "Customers", icon: "M16 20v-2a4 4 0 00-8 0v2M12 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7" },
  { href: "/invoices", label: "Invoices", icon: "M7 3h7l5 5v13H7V3zm7 0v5h5M9 13h8M9 17h5" },
  { href: "/payments", label: "Payments", icon: "M3 7h18v10H3zM3 11h18M7 15h4" },
  { href: "/statements", label: "Statements", icon: "M6 3h9l4 4v14H6zM9 12h7M9 16h5M9 8h4" },
  { href: "/expenses", label: "Expenses", icon: "M4 4h16v4H4zM6 8v12h12V8M9 12h6" },
  { href: "/vehicles", label: "Vehicles", icon: "M3 13l2-5h11l3 5v5h-3M6 13h9M7 18a2 2 0 104 0 2 2 0 10-4 0M15 18a2 2 0 104 0 2 2 0 10-4 0" },
  { href: "/documents", label: "Documents", icon: "M7 3h7l5 5v13H7V3zm7 0v5h5M9 14h7M9 18h5M9 10h3" },
  { href: "/reports", label: "VAT reports", icon: "M4 20V6m5 14V10m5 10V4m5 16v-8" },
  { href: "/settings", label: "Settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zm7.5-3l1.6-1.2-1.3-2.3-1.9.6-1.6-1L15.8 5h-2.6l-.5 2-1.6 1-1.9-.6L7.9 9.6 9.5 11l-.2 2 .2 2-1.6 1.4 1.3 2.3 1.9-.6 1.6 1 .5 2h2.6l.5-2 1.6-1 1.9.6 1.3-2.3-1.6-1.4z" },
  { href: "/desktop", label: "Windows app", icon: "M4 5h16v11H4zM2 19h20M9 19v2h6v-2" },
];

export function Sidebar({ businessName, vatScheme }: { businessName: string; vatScheme: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState("/logo.png");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-lg lg:hidden"
      >
        {open ? "Close" : "Menu"}
      </button>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-slate-900 px-4 py-6 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      > 
        <div className="px-2">
          <div className="flex items-center gap-2">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm border border-slate-800">
              <img
                src={imgSrc}
                alt="Logo"
                onError={() => {
                  if (imgSrc === "/logo.png") setImgSrc("/logo.jpg");
                }}
                className="h-full w-full object-contain p-1"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Lail W Nahar</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Billing suite</p>
            </div>
          </div>
        </div>

        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto pr-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                isActive(item.href)
                  ? "bg-indigo-500/15 font-semibold text-white ring-1 ring-inset ring-indigo-400/30"
                  : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[18px] w-[18px] shrink-0"
              >
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 rounded-xl bg-slate-800/0 p-3">
          <p className="truncate text-xs font-semibold text-slate-200">{businessName}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            VAT scheme: <span className="font-semibold text-indigo-300">{vatScheme}</span>
            <br />
            VAT is recognised on cash received.
          </p>
        </div>
      </aside>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
        />
      )}
    </>
  );
}