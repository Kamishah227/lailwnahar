"use client";

import { useEffect, useState } from "react";

type FileSpec = { name: string; role: string };

const FILES: FileSpec[] = [
  { name: "main.py", role: "Entry point — bootstrap schema, seed demo data, launch UI" },
  { name: "app.py", role: "CustomTkinter shell — sidebar nav, 7 views, invoice & payment dialogs" },
  { name: "database.py", role: "SQLite schema + every query with transactions and error handling" },
  { name: "vat.py", role: "Decimal money maths and the cash-accounting VAT engine" },
  { name: "reports.py", role: "fpdf2 builders — invoice, receipt, statement, VAT return" },
  { name: "requirements.txt", role: "Two dependencies: customtkinter and fpdf2" },
  { name: "run_ledgerlite.bat", role: "One-click Windows launcher (creates the venv for you)" },
  { name: "README.md", role: "Install, module and schema documentation" },
];

export function DesktopAppBrowser() {
  const [active, setActive] = useState(FILES[1].name);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const missing = FILES.filter((file) => !(file.name in sources));
    if (missing.length === 0) return;
    let cancelled = false;
    setLoading(true);
    Promise.all(
      missing.map(async (file) => {
        const response = await fetch(`/desktop-app/${file.name}`);
        if (!response.ok) throw new Error(`${file.name}: ${response.status}`);
        return [file.name, await response.text()] as const;
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setSources((current) => ({ ...current, ...Object.fromEntries(entries) }));
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load source files");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const current = sources[active] ?? "";
  const lines = current ? current.split("\n") : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <div className="space-y-2">
        {FILES.map((file) => {
          const count = sources[file.name] ? sources[file.name].split("\n").length : null;
          const isActive = file.name === active;
          return (
            <button
              key={file.name}
              type="button"
              onClick={() => setActive(file.name)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                isActive
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold">{file.name}</span>
                {count && <span className="text-[10px] opacity-70">{count} lines</span>}
              </div>
              <p className={`mt-1 text-[11px] leading-snug ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                {file.role}
              </p>
            </button>
          );
        })}
        <a
          href="/LedgerLite-desktop.zip"
          download
          className="block rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          ⬇ Download all files (.zip)
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-2 font-mono text-xs text-slate-300">{active}</span>
          </div>
          <div className="flex items-center gap-3">
            {loading && <span className="text-[11px] text-slate-400">loading…</span>}
            <a
              href={`/desktop-app/${active}`}
              download={active}
              className="rounded-lg border border-slate-700 px-3 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Download this file
            </a>
          </div>
        </div>
        {error ? (
          <p className="px-5 py-8 text-sm text-rose-300">Could not load source: {error}</p>
        ) : lines.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400">Loading source…</p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full border-collapse font-mono text-[11.5px] leading-relaxed">
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className="align-top hover:bg-slate-900/60">
                    <td className="w-12 select-none border-r border-slate-800 px-2 py-0 text-right text-slate-600">
                      {index + 1}
                    </td>
                    <td className="whitespace-pre px-4 py-0 text-slate-200">
                      {line || " "}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
