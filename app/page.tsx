import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/brand/footer';
import { Wortmarke } from '@/components/brand/wortmarke';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  InboxIcon,
  MailIcon,
  Calendar03Icon,
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  AlertCircleIcon,
  RocketIcon,
} from '@hugeicons/core-free-icons';

/**
 * Marketing-Landing auf "/". Eingeloggte User werden direkt zum
 * Dashboard weitergeleitet, sonst sehen sie die Pitch-Seite mit
 * Hero, Problem, Lösung, So-funktionierts und CTA.
 *
 * Bewusst kein Pricing (Pilot-Phase – Konditionen persönlich).
 * Brand-DNA: Wortmarke + Saira Condensed Headlines + Stahlblau-Akzente.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top-Bar: nur Wortmarke + Anmelden-Link */}
      <header className="border-b">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <Wortmarke size="sm" />
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Anmelden
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="border-b bg-gradient-to-b from-secondary/30 to-background">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-24 text-center">
          <p className="text-xs sm:text-sm uppercase tracking-[0.25em] text-muted-foreground font-medium mb-6">
            Büroassistenz fürs Handwerk
          </p>
          <h1 className="font-heading text-4xl sm:text-6xl lg:text-7xl font-bold uppercase tracking-wide leading-[1.05] mb-6">
            Anfragen kommen.
            <br />
            <span className="text-primary">Antworten gehen raus.</span>
            <br />
            Du arbeitest weiter.
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            Du musst nicht mehr abends am Laptop sitzen, um Mails zu
            beantworten. Auftragswerk liest jede Kundenanfrage, schreibt
            dir einen Antwortentwurf in deinem Ton und schlägt gleich
            freie Termine vor. Du liest kurz drüber, klickst frei – fertig.
            Versendet wird aus deinem normalen Mail-Postfach, deine Kunden
            merken keinen Unterschied.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button asChild size="lg" className="w-full sm:w-auto gap-2">
              <Link href="/registrieren">
                Account erstellen
                <HugeiconsIcon
                  icon={ArrowRight02Icon}
                  size={16}
                  strokeWidth={2}
                />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/login">Schon registriert? Anmelden</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Derzeit Pilot-Phase – Konditionen persönlich. Schreib uns.
          </p>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-b">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-medium mb-3">
              Das Problem
            </p>
            <h2 className="font-heading text-2xl sm:text-4xl font-bold uppercase tracking-wide mb-4">
              Kundenmails fressen deine Zeit
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Du bist auf der Baustelle, im Auto, beim Kunden. Mails landen
              im Postfach und liegen dort. Antworten dauert. Und du verlierst
              Aufträge weil du nicht schnell genug warst.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <ProblemCard
              icon={InboxIcon}
              titel="20+ Anfragen pro Woche"
              text="Anfragen über Mail, Webformulare, Weiterleitungen – alles landet ungesortet im selben Postfach."
            />
            <ProblemCard
              icon={Clock01Icon}
              titel="Abends Tippen statt Feierabend"
              text="Statt zu Hause zu sein, sitzt du am Laptop und antwortest, was tagsüber liegen geblieben ist."
            />
            <ProblemCard
              icon={AlertCircleIcon}
              titel="Verlorene Aufträge"
              text="Wer 48 h auf Antwort wartet, hat den nächsten Handwerker schon angeschrieben. Du merkst es nicht mal."
            />
          </div>
        </div>
      </section>

      {/* LÖSUNG */}
      <section className="border-b bg-secondary/30">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-medium mb-3">
              Die Lösung
            </p>
            <h2 className="font-heading text-2xl sm:text-4xl font-bold uppercase tracking-wide mb-4">
              Auftragswerk übernimmt das Tippen
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Du gibst der KI deinen Stil und deine Verfügbarkeit. Ab dann
              läuft sie mit – und du gibst nur noch frei oder änderst kurz.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <LoesungCard
              icon={MailIcon}
              schritt="01"
              titel="KI liest jede Mail"
              text="Erkennt, ob's eine Anfrage, eine Rückfrage oder Spam ist. Sortiert sauber in deine Inbox."
            />
            <LoesungCard
              icon={InboxIcon}
              schritt="02"
              titel="Entwurf ist fertig"
              text="In deinem Ton, mit deinen Standard-Formulierungen. Du gibst frei – oder änderst zwei Sätze."
            />
            <LoesungCard
              icon={Calendar03Icon}
              schritt="03"
              titel="Termin gleich mit dabei"
              text="Die KI schaut in deinen Kalender, schlägt 2–3 freie Slots vor und schreibt sie direkt in die Antwort."
            />
          </div>
        </div>
      </section>

      {/* SO FUNKTIONIERTS */}
      <section className="border-b">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-medium mb-3">
              Onboarding
            </p>
            <h2 className="font-heading text-2xl sm:text-4xl font-bold uppercase tracking-wide mb-4">
              In 15 Minuten startklar
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Drei Schritte, kein DKIM-Gefrickel, kein DNS-Pain. Du musst nur
              einmal klicken und kurz pflegen, was die KI wissen soll.
            </p>
          </div>

          <ol className="space-y-3 max-w-3xl mx-auto">
            <SchrittRow
              nummer="1"
              titel="Account erstellen"
              text="Email + Passwort + Betriebsname. 30 Sekunden."
            />
            <SchrittRow
              nummer="2"
              titel="Gmail verbinden + Verfügbarkeit eintragen"
              text="Ein Klick fürs Gmail (Mails gehen aus deinem echten Konto raus). Wann hast du Zeit für Aufmaßtermine? Mo–Fr 8–12 reicht."
            />
            <SchrittRow
              nummer="3"
              titel="Weiterleitung einrichten"
              text="In deinem normalen Mail-Provider (IONOS, Google Workspace, …) eine Weiterleitung einrichten. Anleitung gibt's im Tool."
            />
          </ol>
        </div>
      </section>

      {/* FÜR WEN */}
      <section className="border-b bg-secondary/30">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-8">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-medium mb-3">
              Für wen
            </p>
            <h2 className="font-heading text-2xl sm:text-4xl font-bold uppercase tracking-wide mb-4">
              Handwerksbetriebe, die Mailantworten kosten
            </h2>
          </div>

          <div className="flex flex-wrap gap-2 justify-center max-w-3xl mx-auto">
            {[
              'Schreinereien',
              'Metallbau',
              'Elektrobetriebe',
              'Maler',
              'Sanitär & Heizung',
              'Bodenleger',
              'Garten- & Landschaftsbau',
              'Tischler',
              'Fliesenleger',
              'Zimmereien',
              'Dachdecker',
              'Bauelemente',
            ].map((gewerk) => (
              <span
                key={gewerk}
                className="px-3 py-1.5 text-sm bg-background border border-border rounded-md text-foreground/80"
              >
                {gewerk}
              </span>
            ))}
          </div>

          <p className="text-sm text-muted-foreground text-center mt-8 max-w-2xl mx-auto">
            Wenn du regelmäßig schriftliche Anfragen bekommst und die nicht
            schnell genug beantwortest – passt's. Egal ob 1-Mann-Betrieb oder
            kleines Team.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-b">
        <div className="container mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24 text-center">
          <HugeiconsIcon
            icon={RocketIcon}
            size={32}
            strokeWidth={1.5}
            className="mx-auto mb-4 text-primary"
          />
          <h2 className="font-heading text-3xl sm:text-5xl font-bold uppercase tracking-wide mb-4">
            Schluss mit Mailstau
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Leg los, probier's aus. Wenn's nichts für dich ist, war der
            Aufwand 15 Minuten.
          </p>
          <Button asChild size="lg" className="w-full sm:w-auto gap-2">
            <Link href="/registrieren">
              Jetzt Account erstellen
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                size={16}
                strokeWidth={2}
              />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground mt-6">
            Schon dabei?{' '}
            <Link
              href="/login"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Hier anmelden
            </Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function ProblemCard({
  icon,
  titel,
  text,
}: {
  icon: typeof InboxIcon;
  titel: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-5 space-y-2">
      <HugeiconsIcon
        icon={icon}
        size={22}
        strokeWidth={1.5}
        className="text-muted-foreground"
      />
      <h3 className="font-semibold text-foreground">{titel}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function LoesungCard({
  icon,
  schritt,
  titel,
  text,
}: {
  icon: typeof InboxIcon;
  schritt: string;
  titel: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-5 space-y-2 relative">
      <div className="flex items-center justify-between">
        <HugeiconsIcon
          icon={icon}
          size={22}
          strokeWidth={1.5}
          className="text-primary"
        />
        <span className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
          {schritt}
        </span>
      </div>
      <h3 className="font-semibold text-foreground pt-1">{titel}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function SchrittRow({
  nummer,
  titel,
  text,
}: {
  nummer: string;
  titel: string;
  text: string;
}) {
  return (
    <li className="flex gap-4 items-start rounded-lg border border-border bg-background p-4 sm:p-5">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground font-heading font-bold flex items-center justify-center text-lg">
        {nummer}
      </div>
      <div className="flex-1 pt-1">
        <h3 className="font-semibold text-foreground mb-1">{titel}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
      </div>
      <HugeiconsIcon
        icon={CheckmarkCircle02Icon}
        size={18}
        strokeWidth={1.5}
        className="text-muted-foreground/40 flex-shrink-0 mt-1.5 hidden sm:block"
      />
    </li>
  );
}
