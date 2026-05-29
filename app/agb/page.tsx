import Link from 'next/link';
import { Wortmarke } from '@/components/brand/wortmarke';
import { Footer } from '@/components/brand/footer';

export const metadata = {
  title: 'Allgemeine Geschäftsbedingungen – Auftragswerk',
};

export default function AgbPage() {
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
          Allgemeine Geschäftsbedingungen
        </h1>
        <p className="text-sm text-muted-foreground mb-8">Stand: 29.05.2026</p>

        <div className="mb-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-medium">Hinweis:</strong> Diese AGB sind ein
          Standard-Template und befinden sich in juristischer Prüfung. Vor
          breiterem Pilot-Einsatz werden sie durch einen Fachanwalt verifiziert.
          Für den aktuellen Early-Access-Pilot regeln sie die Vertragsbeziehung
          zwischen Anbieter und Nutzer.
        </div>

        <div className="prose prose-sm sm:prose-base max-w-none space-y-8 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              § 1 Geltungsbereich, Vertragspartner
            </h2>
            <p>
              (1) Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung
              der Software-as-a-Service-Anwendung Auftragswerk (nachfolgend „die
              Anwendung") durch gewerbliche Nutzer (nachfolgend „Nutzer").
            </p>
            <p>
              (2) Anbieter der Anwendung ist Florian Mändl, E-Mail:{' '}
              <a
                href="mailto:florian.maendl@gmx.de"
                className="text-primary hover:underline"
              >
                florian.maendl@gmx.de
              </a>{' '}
              (nachfolgend „Anbieter").
            </p>
            <p>
              (3) Die Anwendung richtet sich ausschließlich an Unternehmer im
              Sinne von § 14 BGB. Ein Vertragsschluss mit Verbrauchern (§ 13 BGB)
              ist ausgeschlossen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              § 2 Leistungsbeschreibung
            </h2>
            <p>
              (1) Der Anbieter stellt dem Nutzer eine cloudbasierte Anwendung zur
              Verfügung, die Handwerksbetriebe bei der Bearbeitung eingehender
              Kundenanfragen unterstützt. Die Funktionalitäten umfassen
              insbesondere:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Empfang und Versand von E-Mails über angebundene
                Mail-Infrastrukturen (Postmark, optional Gmail-OAuth)
              </li>
              <li>
                KI-gestützte Klassifikation eingehender Anfragen und Generierung
                von Antwort-Entwürfen
              </li>
              <li>
                Verwaltung von Verfügbarkeiten, Terminen und Kunden-Stammdaten
              </li>
              <li>Speicherung und Anzeige der Konversationshistorie</li>
            </ul>
            <p>
              (2) Die generierten KI-Entwürfe sind Vorschläge. Der Nutzer ist
              verpflichtet, diese vor dem Versand zu prüfen und gegebenenfalls
              anzupassen. Eine inhaltliche Haftung für Maschinen-generierte Texte
              wird nicht übernommen.
            </p>
            <p>
              (3) Der Anbieter ist berechtigt, die Anwendung weiterzuentwickeln,
              zu verändern und einzelne Funktionalitäten zu ergänzen, zu
              ersetzen oder zu entfernen, soweit dies nicht den wesentlichen
              Charakter der Leistung verändert.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              § 3 Vertragsschluss, Registrierung
            </h2>
            <p>
              (1) Die Nutzung der Anwendung setzt eine Registrierung voraus. Mit
              dem Abschluss der Registrierung kommt zwischen Anbieter und Nutzer
              ein Nutzungsvertrag zustande.
            </p>
            <p>
              (2) Während der Early-Access-Phase ist die Nutzung kostenlos. Der
              Anbieter behält sich vor, in Zukunft kostenpflichtige Tarife
              einzuführen; bestehende Nutzer werden mit angemessenem Vorlauf vor
              der Umstellung informiert und können den Vertrag widerspruchsfrei
              kündigen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              § 4 Pflichten des Nutzers
            </h2>
            <p>(1) Der Nutzer verpflichtet sich:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                die Anwendung ausschließlich für rechtmäßige Zwecke einzusetzen,
                insbesondere nicht für unerbetene Massen-Mails (Spam), für
                belästigende oder rechtswidrige Inhalte
              </li>
              <li>
                seine Zugangsdaten vertraulich zu behandeln und unberechtigten
                Dritten keinen Zugang zu gewähren
              </li>
              <li>
                korrekte und vollständige Angaben bei der Registrierung sowie
                der Pflege der Betriebs-Stammdaten zu machen
              </li>
              <li>
                die geltenden datenschutzrechtlichen Bestimmungen gegenüber
                seinen eigenen Kunden zu beachten und insbesondere die
                Einwilligung seiner Kunden zur Mail-Korrespondenz sicherzustellen
              </li>
            </ul>
            <p>
              (2) Bei Verstößen gegen die Pflichten aus Absatz 1 ist der Anbieter
              berechtigt, den Zugang zur Anwendung temporär zu sperren oder den
              Vertrag aus wichtigem Grund fristlos zu kündigen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              § 5 Verfügbarkeit, Wartung
            </h2>
            <p>
              (1) Der Anbieter strebt eine Verfügbarkeit der Anwendung von 99 %
              im Jahresmittel an. Geplante Wartungsfenster sowie Ausfälle
              außerhalb des Einflussbereichs des Anbieters (z. B. Ausfälle der
              eingesetzten Subdienstleister, höhere Gewalt) sind nicht
              eingeschlossen.
            </p>
            <p>
              (2) Während der Early-Access-Phase besteht kein vertraglicher
              Anspruch auf eine bestimmte Verfügbarkeit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              § 6 Haftung
            </h2>
            <p>
              (1) Der Anbieter haftet unbeschränkt für Vorsatz und grobe
              Fahrlässigkeit sowie für Schäden aus der Verletzung des Lebens,
              des Körpers oder der Gesundheit.
            </p>
            <p>
              (2) Bei leichter Fahrlässigkeit haftet der Anbieter nur bei
              Verletzung wesentlicher Vertragspflichten, deren Erfüllung die
              ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht
              und auf deren Einhaltung der Nutzer regelmäßig vertrauen darf. In
              diesem Fall ist die Haftung auf den vertragstypischen,
              vorhersehbaren Schaden begrenzt.
            </p>
            <p>
              (3) Eine Haftung für die Inhalte KI-generierter Entwürfe ist
              ausgeschlossen, soweit der Nutzer die Entwürfe vor Versand prüfen
              konnte. Der Anbieter haftet nicht für Schäden, die aus dem
              ungeprüften Versand von KI-Entwürfen entstehen.
            </p>
            <p>
              (4) Eine Haftung für Datenverlust ist auf den Aufwand begrenzt,
              der bei ordnungsgemäßer Datensicherung durch den Nutzer
              erforderlich gewesen wäre.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              § 7 Datenschutz
            </h2>
            <p>
              Die Verarbeitung personenbezogener Daten regelt die separate{' '}
              <Link
                href="/datenschutz"
                className="text-primary hover:underline"
              >
                Datenschutzerklärung
              </Link>
              , die ergänzend Vertragsbestandteil wird.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              § 8 Laufzeit, Kündigung
            </h2>
            <p>
              (1) Der Vertrag wird auf unbestimmte Zeit geschlossen und kann von
              beiden Seiten jederzeit mit einer Frist von 14 Tagen zum
              Monatsende ordentlich gekündigt werden.
            </p>
            <p>
              (2) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund
              bleibt unberührt.
            </p>
            <p>
              (3) Nach Vertragsbeendigung werden alle Nutzerdaten innerhalb von
              30 Tagen gelöscht, soweit keine gesetzlichen Aufbewahrungs-
              pflichten entgegenstehen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-foreground">
              § 9 Schlussbestimmungen
            </h2>
            <p>
              (1) Es gilt das Recht der Bundesrepublik Deutschland unter
              Ausschluss des UN-Kaufrechts.
            </p>
            <p>
              (2) Sollte eine Bestimmung dieser AGB unwirksam sein oder werden,
              berührt dies die Wirksamkeit der übrigen Bestimmungen nicht.
            </p>
            <p>
              (3) Änderungen dieser AGB werden dem Nutzer per E-Mail mitgeteilt.
              Sie gelten als genehmigt, wenn der Nutzer ihnen nicht binnen 30
              Tagen nach Bekanntgabe widerspricht.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
