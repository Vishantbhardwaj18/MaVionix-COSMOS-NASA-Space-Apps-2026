import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import ArchiveStatus from "@/components/ArchiveStatus";
import FieldSearch from "@/components/FieldPicker";
import NavLinks from "@/components/NavLinks";
import SkyCaption from "@/components/SkyCaption";
import SpaceBackground from "@/components/SpaceBackground";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const DESCRIPTION = "See how NASA SPHEREx's infrared sky changes between visits: blink two dates, find what moved, read its spectrum, and see what the data can and cannot say about Planet Nine.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "COSMOS: SPHEREx sky, over time", template: "%s | COSMOS" },
  description: DESCRIPTION,
  applicationName: "COSMOS",
  openGraph: { title: "COSMOS: SPHEREx sky, over time", description: DESCRIPTION, type: "website", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Two SPHEREx visits of the same patch of sky, side by side" }] },
  twitter: { card: "summary_large_image", title: "COSMOS: SPHEREx sky, over time", description: DESCRIPTION, images: ["/og.png"] },
};
export const viewport: Viewport = { themeColor: "#101a30", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <a href="#main" className="skip-link">Skip to the content</a>
        <Suspense fallback={null}><SpaceBackground /></Suspense>
        <header className="border-b border-[var(--rule-soft)] bg-[var(--panel)]">
          <div className="site-header mx-auto max-w-[1500px] px-4 py-2.5">
            <div className="site-brand flex items-center gap-3">
              <Link href="/" className="flex items-baseline gap-2 shrink-0">
                <span style={{ fontFamily: "var(--serif)" }} className="text-xl">COSMOS</span>
                <span className="note hidden xl:inline">SPHEREx sky, over time</span>
              </Link>
              <ArchiveStatus />
            </div>
            <div className="site-search"><Suspense fallback={<div />}><FieldSearch /></Suspense></div>
            <div className="site-nav"><Suspense fallback={null}><NavLinks /></Suspense></div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1500px] px-4 py-5 flex-1">
          <Suspense fallback={<p className="note">Loading…</p>}>{children}</Suspense>
        </main>
        <footer className="border-t border-[var(--rule-soft)] bg-[var(--field)]">
          <div className="mx-auto max-w-[1500px] px-4 py-5 note flex flex-col md:flex-row gap-2 md:gap-8">
            <div className="flex flex-col gap-2">
            <Suspense fallback={null}><SkyCaption /></Suspense>
            <p className="measure">SPHEREx data: NASA/JPL-Caltech/IPAC, from the NASA/IPAC Infrared Science Archive. Small-body positions: JPL Solar System Dynamics. Background sky: Hipparcos and Tycho stars and Milky Way outlines from d3-celestial. This is a student project, not a NASA product, and nothing on it is a claim to have found Planet X.</p>
            </div>
            <p className="md:ml-auto md:text-right">MaVionix, 2026 NASA Space Apps Challenge<br /><Link className="link" href="/about">How it works and its limits</Link></p>
          </div>
        </footer>
      </body>
    </html>
  );
}
