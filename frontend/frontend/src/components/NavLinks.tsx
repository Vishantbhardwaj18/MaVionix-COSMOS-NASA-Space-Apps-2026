"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fieldParams, useFieldQuery } from "./FieldPicker";

const items: [string, string][] = [["/", "Viewer"], ["/detective", "Movers"], ["/spectrum", "Spectrum"], ["/planetx", "Planet Nine"], ["/about", "How it works"]];

export default function NavLinks() {
  const path = usePathname();
  const q = useFieldQuery();
  const qs = fieldParams(q);
  return (
<<<<<<< HEAD
    <nav aria-label="Pages" className="flex gap-0.5 text-sm whitespace-nowrap">
      {items.map(([href, label]) => {
        const active = path === href;
        return (
          <Link key={href} aria-current={active ? "page" : undefined} href={qs && href !== "/about" ? `${href}?${qs}` : href}
=======
    <nav className="ml-auto flex gap-0.5 text-sm shrink-0">
      {items.map(([href, label]) => {
        const active = path === href;
        return (
          <Link key={href} href={qs && href !== "/about" ? `${href}?${qs}` : href}
>>>>>>> 6be1513821cf7d4d47b8ac5f3b8e90208e5639a4
            className={`px-2.5 py-1.5 rounded-sm border-b-2 ${active ? "border-[var(--accent)] text-[var(--ink)]" : "border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
