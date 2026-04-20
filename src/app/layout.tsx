import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
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
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
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
