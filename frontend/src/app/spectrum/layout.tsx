import type { Metadata } from "next";

export const metadata: Metadata = { title: "Spectrum", description: "A 0.75 to 5 micron spectrum of one source, built from repeat SPHEREx visits." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
