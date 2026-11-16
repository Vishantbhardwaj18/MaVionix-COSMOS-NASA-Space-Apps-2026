"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fieldParams, useFieldQuery } from "./FieldPicker";

const items: [string, string][] = [["/", "Viewer"], ["/detective", "Movers"], ["/spectrum", "Spectrum"], ["/planetx", "Planet Nine"], ["/about", "How it works"]];
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function NavLinks() {
  const path = usePathname();
  const q = useFieldQuery();
  const qs = fieldParams(q);
  const nav = useRef<HTMLElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);

  // one underline that slides to the current page
  useIsoLayoutEffect(() => {
    const place = () => {
      const el = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
      setBar(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    place();
    window.addEventListener("resize", place);
    document.fonts?.ready.then(place).catch(() => {});
    return () => window.removeEventListener("resize", place);
  }, [path]);

  return (
    <nav ref={nav} aria-label="Pages" className="relative flex gap-0.5 text-sm whitespace-nowrap pb-0.5">
      {items.map(([href, label]) => {
        const active = path === href;
        return (
          <Link key={href} aria-current={active ? "page" : undefined} href={qs && href !== "/about" ? `${href}?${qs}` : href}
            className={`nav-link px-2.5 py-1.5 rounded-sm ${active ? "text-[var(--ink)]" : "text-[var(--ink-2)] hover:text-[var(--ink)]"}`}>
            {label}
          </Link>
        );
      })}
      {bar && <span aria-hidden="true" className="nav-bar" style={{ transform: `translateX(${bar.left}px)`, width: bar.width }} />}
    </nav>
  );
}
