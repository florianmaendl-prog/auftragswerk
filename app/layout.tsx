import type { Metadata } from "next";
import { Inter, Saira_Condensed } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Display-Font für die Wortmarke "AUFTRAGSWERK" und Section-Headlines.
// Industrieller, condensed Stil – passt zum Brandboard (Stahlblau/Hellgrau/Schwarz,
// "Assistenz, die mitdenkt"). Bewusst Condensed statt Stencil: weniger plakativ,
// besser lesbar in mehr Größen.
const sairaCondensed = Saira_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Auftragswerk – Assistenz, die mitdenkt.",
  description: "Die AI-Handwerker-Sekretärin – designt vom Handwerksmeister für den Handwerksmeister.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={cn(inter.variable, sairaCondensed.variable, "antialiased")}
    >
      <body className="min-h-screen bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}