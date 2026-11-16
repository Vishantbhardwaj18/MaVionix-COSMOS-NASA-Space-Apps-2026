import type { Metadata } from "next";

export const metadata: Metadata = { title: "Things that moved", description: "Sources that changed position between SPHEREx visits, each checked against JPL's catalogue of known bodies." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
