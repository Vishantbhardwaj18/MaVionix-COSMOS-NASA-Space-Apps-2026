import type { Metadata } from "next";

export const metadata: Metadata = { title: "Planet Nine", description: "The orbits behind the Planet Nine hypothesis, and what SPHEREx could and could not detect." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
