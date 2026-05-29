import Link from 'next/link';
import { Wortmarke } from '@/components/brand/wortmarke';
import { Footer } from '@/components/brand/footer';

export const metadata = {
  title: 'Datenschutzerklärung – Auftragswerk',
};

export default function DatenschutzPage() {
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
        <h1 className="font-heading text-3xl sm:text-4xl font-bold uppercase tracking-wide mb-2">
          Datenschutzerklärung
        </h1>
        <p className="text-sm text-muted-foreground mb-8">Stand: 29.05.2026</p>

        <div className="mb-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-medium">Hinweis:</strong> Diese Datenschutzerklärung
          ist ein Standard-Template und befindet sich in juristischer Prüfung. Vor
          breiterem Pilot-Einsatz wird sie durch einen Fachanwalt verifiziert. Für
          den aktuellen Early-Access-Pilot beschreibt sie das tatsächliche
          Verarbeitungsverhalten der Anwendung.
        </div>

        <div className="prose prose-sm sm:prose-base max-w-none space-y-8 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              1. Verantwortlicher
            </h2>
            <p>
              Florian Mändl
              <br />
              [Adresse wird ergänzt]
              <br />
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
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              2. Was wir verarbeiten
            </h2>
            <p>
              Auftragswerk ist eine SaaS-Anwendung, die Handwerksbetriebe bei der
              Bearbeitung eingehender Kundenanfragen unterstützt. Im Rahmen der
              Vertragserfüllung verarbeiten wir folgende Daten:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong>Konto-Daten:</strong> E-Mail-Adresse, Passwort-Hash,
                Betriebs-Stammdaten (Firmenname, Inhaber, Branche, Region)
              </li>
              <li>
                <strong>Kunden-Korrespondenz:</strong> Eingehende und ausgehende
                E-Mails, Anhänge (Bilder, PDFs, Office-Dokumente), Empfänger- und
                Absender-Adressen
              </li>
              <li>
                <strong>KI-Analyse-Ergebnisse:</strong> Klassifikation der Anfragen,
                extrahierte Stammdaten (Name, Firma, Telefon, Ort), Termin-Vorschläge
              </li>
              <li>
                <strong>Kalender-Daten:</strong> Verfügbarkeits-Regeln, Sperrzeiten,
                bestätigte Termine
              </li>
              <li>
                <strong>Gmail-OAuth-Tokens</strong> (verschlüsselt at-rest), wenn
                Sie Ihr Gmail-Konto über die App verbinden – siehe Abschnitt 5
              </li>
              <li>
                <strong>Technische Daten:</strong> Verarbeitungs-Logs zur
                Fehlerdiagnose, IP-Adresse bei API-Aufrufen (kurzzeitig)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              3. Rechtsgrundlage
            </h2>
            <p>
              Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b
              DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. f DSGVO
              (berechtigtes Interesse an Betrieb und Wartung der Anwendung).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              4. Eingesetzte Dienstleister (Auftragsverarbeiter)
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Supabase</strong> (Datenbank, Auth, Storage) – Hosting in
                der EU (Frankfurt). Auftragsverarbeitungs-Vertrag (AVV)
                abgeschlossen.
              </li>
              <li>
                <strong>Vercel</strong> (Application Hosting) – AVV abgeschlossen.
              </li>
              <li>
                <strong>Anthropic</strong> (KI-Klassifikation und -Entwurfs-Generierung
                via Claude API) – Datenverarbeitung gemäß Anthropic Privacy Policy
                und Data Processing Addendum.
              </li>
              <li>
                <strong>Postmark</strong> (E-Mail-Versand und -Empfang) – AVV
                abgeschlossen.
              </li>
              <li>
                <strong>Google</strong> (nur bei optionaler Gmail-Verbindung):
                OAuth-Authentifizierung und Versand über die Gmail API. Es werden
                ausschließlich Tokens gespeichert (verschlüsselt), keine
                Mail-Inhalte aus Ihrem Postfach gelesen.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              5. Gmail-OAuth-Verbindung (optional)
            </h2>
            <p>
              Wenn Sie Ihr Gmail-Konto verbinden, fordern wir ausschließlich die
              Berechtigung <code className="rounded bg-muted px-1 py-0.5 text-xs">
                gmail.send
              </code> an – also das Versenden von E-Mails aus Ihrem Namen. Wir
              lesen keine E-Mails in Ihrem Postfach. Die zur Authentifizierung
              notwendigen OAuth-Tokens werden AES-256-GCM-verschlüsselt at-rest
              in unserer Datenbank gespeichert. Die Verbindung kann jederzeit im
              Betriebsprofil sowie in Ihrem Google-Konto widerrufen werden.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              6. Speicherdauer
            </h2>
            <p>
              Wir speichern Ihre Daten so lange, wie es für die Vertragserfüllung
              erforderlich ist beziehungsweise gesetzliche Aufbewahrungspflichten
              dies vorschreiben. Gelöschte Anfragen verbleiben 30 Tage im
              Papierkorb und werden danach endgültig gelöscht. Bei Kündigung des
              Vertrags werden alle personenbezogenen Daten innerhalb von 30 Tagen
              gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten
              entgegenstehen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              7. Ihre Rechte
            </h2>
            <p>Sie haben das Recht auf:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Auskunft über die zu Ihrer Person verarbeiteten Daten (Art. 15 DSGVO)</li>
              <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
              <li>Löschung (Art. 17 DSGVO)</li>
              <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
              <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
              <li>Widerspruch (Art. 21 DSGVO)</li>
              <li>
                Beschwerde bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO)
              </li>
            </ul>
            <p className="mt-3">
              Bitte richten Sie entsprechende Anfragen an{' '}
              <a
                href="mailto:florian.maendl@gmx.de"
                className="text-primary hover:underline"
              >
                florian.maendl@gmx.de
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              8. Datensicherheit
            </h2>
            <p>
              Wir setzen technische und organisatorische Maßnahmen zum Schutz Ihrer
              Daten ein, insbesondere:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Verschlüsselte Datenübertragung (HTTPS/TLS)</li>
              <li>Row-Level-Security in der Datenbank (Mandantentrennung)</li>
              <li>OAuth-Tokens AES-256-GCM-verschlüsselt at-rest</li>
              <li>
                Strikte Zugriffsbeschränkung über rollenbasierte Authentifizierung
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              9. Änderungen dieser Erklärung
            </h2>
            <p>
              Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie
              an geänderte Rechtslagen oder bei Änderungen unseres Dienstes zu
              berücksichtigen. Den jeweils aktuellen Stand finden Sie auf dieser
              Seite.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
