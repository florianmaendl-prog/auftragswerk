import Link from 'next/link';
import { Wortmarke } from '@/components/brand/wortmarke';
import { Footer } from '@/components/brand/footer';

export const metadata = {
  title: 'Impressum – Auftragswerk',
};

export default function ImpressumPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="Startseite">
            <Wortmarke size="sm" />
          </Link>
          <Link
            href="/dashboard"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            → Zum Dashboard
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold uppercase tracking-wide mb-8">
          Impressum
        </h1>

        <div className="space-y-8 text-sm text-foreground/90">
          <section>
            <h2 className="text-lg font-semibold mb-2 text-foreground">
              Angaben gemäß § 5 TMG
            </h2>
            <p>
              Florian Mändl
              <br />
              [Straße + Hausnummer]
              <br />
              [PLZ + Ort]
              <br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 text-foreground">
              Kontakt
            </h2>
            <p>
              E-Mail:{' '}
              <a
                href="mailto:florian.maendl@gmx.de"
                className="text-primary hover:underline"
              >
                florian.maendl@gmx.de
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 text-foreground">
              Umsatzsteuer-ID
            </h2>
            <p>
              [USt-IdNr. gemäß § 27a UStG wird ergänzt, falls vorhanden – sonst
              entfällt dieser Abschnitt]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 text-foreground">
              Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
            </h2>
            <p>
              Florian Mändl
              <br />
              [Anschrift wie oben]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 text-foreground">
              EU-Streitschlichtung
            </h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur
              Online-Streitbeilegung (OS) bereit:{' '}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
              .
              <br />
              Wir sind nicht bereit oder verpflichtet, an
              Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen. Die Anwendung richtet
              sich ausschließlich an gewerbliche Nutzer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 text-foreground">
              Haftung für Inhalte
            </h2>
            <p>
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene
              Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
              verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter
              jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
              Informationen zu überwachen oder nach Umständen zu forschen, die
              auf eine rechtswidrige Tätigkeit hinweisen.
            </p>
          </section>
        </div>

        <div className="mt-12 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <strong className="font-medium">Hinweis:</strong> Die mit [Klammern]
          markierten Felder werden vor dem produktiven Pilot-Einsatz mit den
          tatsächlichen Adressdaten ergänzt.
        </div>
      </main>

      <Footer />
    </div>
  );
}
