"use client";
import { useEffect, useState } from "react";
import { api, type ArchiveStatus as Status } from "@/lib/api";

type View = { tone: "ok" | "warn" | "bad"; label: string; detail: string };

function describe(s: Status | null, failed: boolean): View | null {
  if (failed) return { tone: "bad", label: "Data server offline", detail: "This site cannot reach its data server, so searches will not work until it is back." };
  if (!s) return null;
  if (s.serving === "spherex") return { tone: "ok", label: "Archive online", detail: `${s.message}${s.jpl && !s.jpl.ok ? " JPL's small-body service is not answering, so known objects cannot be labelled right now." : ""}` };
  if (s.serving === "synthetic") return { tone: "warn", label: "Sample data", detail: s.message };
  return { tone: "bad", label: "Archive offline", detail: s.message };
}

/** Tells visitors, before they search, whether they will get SPHEREx data or the labelled sample. */
export default function ArchiveStatus() {
  const [s, setS] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () => api.status().then((v) => { if (alive) { setS(v); setFailed(false); } }).catch(() => { if (alive) setFailed(true); });
    check();
    const t = window.setInterval(check, 150_000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);
  const v = describe(s, failed);
  if (!v) return null;
  return (
    <span className={`status status-${v.tone}`} title={v.detail} role="status">
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">{v.label}</span>
      <span className="sr-only">. {v.detail}</span>
    </span>
  );
}
