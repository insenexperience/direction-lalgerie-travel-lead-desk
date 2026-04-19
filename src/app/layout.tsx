import type { Metadata } from "next";
import { Cormorant_Garamond, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "Direction l'Algerie - Travel Lead Desk",
  description: "Internal travel lead management workspace for Direction l'Algerie.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${poppins.variable} ${cormorant.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning : extensions (ex. cz-shortcut-listen sur body) modifient le DOM avant React. */}
      <body
        suppressHydrationWarning
        className="min-h-full bg-background font-sans text-foreground"
      >
        {children}
      </body>
    </html>
  );
}
