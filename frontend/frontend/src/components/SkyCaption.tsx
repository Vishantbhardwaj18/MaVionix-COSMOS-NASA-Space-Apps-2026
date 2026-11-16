"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { sceneFor, useSkyFocus } from "@/lib/skyScene";

/** Says which part of the real sky is behind the current page. */
export default function SkyCaption() {
  const path = usePathname();
  const sp = useSearchParams();
  const focus = useSkyFocus();
  const ra = sp.get("ra"), dec = sp.get("dec");
  const field = path === "/" ? (focus ?? (ra !== null && dec !== null && Number.isFinite(Number(ra)) && Number.isFinite(Number(dec)) ? { ra: Number(ra), dec: Number(dec) } : null)) : null;
  return <p className="measure">Behind this page: {sceneFor(path, field).name}. Stars are drawn at their catalogued positions, brightnesses and colours.</p>;
}
