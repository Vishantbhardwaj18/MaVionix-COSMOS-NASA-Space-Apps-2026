"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Each page rises into place when you arrive, and the header gains a shadow once the page has scrolled. */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  useEffect(() => {
    const flag = () => { document.documentElement.dataset.scrolled = window.scrollY > 4 ? "1" : "0"; };
    flag();
    window.addEventListener("scroll", flag, { passive: true });
    return () => window.removeEventListener("scroll", flag);
  }, []);
  return <div key={path} className="page-enter">{children}</div>;
}
