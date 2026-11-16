"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, FieldQuery } from "@/lib/api";

export function useFieldQuery(): FieldQuery {
  const sp = useSearchParams();
  const ra = sp.get("ra"), dec = sp.get("dec"), target = sp.get("target");
  return { ra: ra ? Number(ra) : undefined, dec: dec ? Number(dec) : undefined, target: target ?? undefined, synthetic: sp.get("synthetic") === "1" };
}
export function hasField(q: FieldQuery) { return !!q.target || (q.ra !== undefined && q.dec !== undefined); }
export function fieldParams(q: FieldQuery, extra: Record<string, string> = {}) {
  const p = new URLSearchParams(extra);
  if (q.target) p.set("target", q.target);
  if (q.ra !== undefined && q.dec !== undefined) { p.set("ra", String(q.ra)); p.set("dec", String(q.dec)); }
  if (q.synthetic) p.set("synthetic", "1");
  return p.toString();
}

/** Header search: coordinates or a name. Keeps the field in the URL so every page and link shares it. */
export default function FieldSearch() {
  const router = useRouter();
  const path = usePathname();
  const q = useFieldQuery();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [showcase, setShowcase] = useState<{ name: string; ra: number; dec: number; why: string }[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setText(q.target ?? (q.ra !== undefined ? `${q.ra}, ${q.dec}` : "")); }, [q.target, q.ra, q.dec]);
  useEffect(() => { api.showcase().then((r) => setShowcase(r.fields)).catch(() => {}); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, []);

  const go = (t: string, synthetic = q.synthetic) => {
    const m = t.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*[, ]\s*([+-]?\d+(?:\.\d+)?)$/);
    if (m && (Number(m[1]) < 0 || Number(m[1]) >= 360 || Math.abs(Number(m[2])) > 90)) {
      setProblem("RA must be between 0 and 360 degrees and Dec between -90 and +90."); return;
    }
    setProblem(null);
    const next: FieldQuery = m ? { ra: Number(m[1]), dec: Number(m[2]), synthetic } : { target: t.trim(), synthetic };
    if (!hasField(next)) return;
    try { localStorage.setItem("cosmos:last-field", JSON.stringify(next)); } catch { /* ignore */ }
    const dest = path === "/about" ? "/" : path;
    router.push(`${dest}?${fieldParams(next)}`);
    setOpen(false);
  };

  return (
    <div ref={box} className="relative w-full max-w-xl">
      <form role="search" className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(text); }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setOpen(true)}
          placeholder="RA, Dec in degrees (270, 66.56) or a name (M31)" aria-label="Sky position or object name" />
        <button className="btn btn-primary whitespace-nowrap" type="submit">Look up</button>
      </form>
      {problem && <p className="absolute left-0 top-full mt-1 small warn-text panel px-2 py-1 z-40" role="alert">{problem}</p>}
      {open && !problem && (
        <div className="panel appear absolute left-0 right-0 top-full mt-1 p-2 z-30 text-sm" style={{ boxShadow: "0 14px 30px -12px rgba(3,7,16,0.9)" }}>
          <p className="note px-2 pb-1">Fields with many SPHEREx visits</p>
          {showcase.map((f) => (
            <button key={f.name} className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--panel-2)]" onClick={() => go(`${f.ra}, ${f.dec}`)}>
              <span>{f.name}</span><span className="block note">{f.why}</span>
            </button>
          ))}
          <label className="flex items-center gap-2 px-2 pt-2 mt-1 rule note">
            <input type="checkbox" checked={!!q.synthetic} onChange={(e) => { if (text.trim()) go(text, e.target.checked); }} />
            Use the offline sample instead of the archive (clearly labelled synthetic)
          </label>
        </div>
      )}
    </div>
  );
}

export function Provenance({ source, warnings, compact = false }: { source?: string; warnings?: string[]; compact?: boolean }) {
  if (!source) return null;
  const notices = (warnings ?? []).filter((w) => !w.startsWith("SYNTHETIC"));
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {source === "synthetic"
        ? <span className="mark mark-synthetic">Synthetic sample, not SPHEREx data</span>
        : <span className="mark mark-real">SPHEREx data from IRSA</span>}
      {!compact && notices.map((w, i) => <span key={i} className="small warn-text">{w}</span>)}
    </div>
  );
}
