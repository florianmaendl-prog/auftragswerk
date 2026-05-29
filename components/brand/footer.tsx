import Link from 'next/link';

/**
 * Dezenter Footer mit den drei Rechtstexte-Links. Wird im Dashboard-Layout
 * und auf Auth-Seiten (Login, Passwort) eingehängt. Bewusst klein – Premium-
 * Look-Through, kein Marketing-Cluster.
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-background py-4 px-4 sm:px-6">
      <div className="container mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>© {year} Auftragswerk · Florian Mändl</span>
        <nav className="flex items-center gap-4">
          <Link
            href="/datenschutz"
            className="hover:text-foreground transition-colors"
          >
            Datenschutz
          </Link>
          <Link href="/agb" className="hover:text-foreground transition-colors">
            AGB
          </Link>
          <Link
            href="/impressum"
            className="hover:text-foreground transition-colors"
          >
            Impressum
          </Link>
        </nav>
      </div>
    </footer>
  );
}
