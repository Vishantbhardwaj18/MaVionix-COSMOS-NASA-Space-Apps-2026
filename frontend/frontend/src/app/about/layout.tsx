import type { Metadata } from "next";

export const metadata: Metadata = { title: "How it works", description: "Data sources, methods, limits and privacy for the COSMOS SPHEREx viewer." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
