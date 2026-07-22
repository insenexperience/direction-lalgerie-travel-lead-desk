import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Cormorant_Garamond, Poppins } from "next/font/google";

// Identité premium client-facing, distincte de l'outil interne (Inter/JetBrains).
// Chargée uniquement sous /q.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--tf-display",
  display: "swap",
});

const ui = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--tf-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Votre projet de voyage — Direction l'Algérie",
  robots: { index: false, follow: false },
};

export default function TravelerLayout({ children }: { children: ReactNode }) {
  return <div className={`${display.variable} ${ui.variable}`}>{children}</div>;
}
