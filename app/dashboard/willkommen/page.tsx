import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { Wortmarke } from '@/components/brand/wortmarke';
import { OnboardingStep } from '@/components/brand/onboarding-step';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  MailIcon,
  Calendar02Icon,
  Building03Icon,
  CheckmarkCircle02Icon,
  ArrowRight02Icon,
} from '@hugeicons/core-free-icons';

/**
 * Wow-Onboarding-Page (Welle D). Erste Login-Detection im Dashboard
 * leitet hierher um, wenn der User noch nichts angefangen hat.
 *
 * Drei Schritte als Brand-Cards:
 *   1. Gmail verbinden (1 Klick)
 *   2. Verfügbarkeit eintragen
 *   3. Profil ausfüllen
 *
 * Status-Detection pro Schritt via DB-Query. Wenn alle drei done →
 * großer "Du bist startklar"-Banner mit Link zur Inbox.
 */
export default async function WillkommenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('betrieb_id')
    .eq('id', user.id)
    .single();

  const betriebId = profile?.betrieb_id as string | null | undefined;
  if (!betriebId) {
    return (
      <div className="container mx-auto py-12 px-4 sm:px-6 max-w-3xl">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Kein Betrieb verknüpft. Bitte Admin kontaktieren.
          </p>
        </Card>
      </div>
    );
  }

  // Status der drei Onboarding-Schritte parallel holen
  const [
    { data: betrieb },
    { data: gmailConn },
    { count: regelCount },
  ] = await Promise.all([
    supabase
      .from('betriebe')
      .select('inhaber, name, was_wir_machen, signatur, ton_beispiele')
      .eq('id', betriebId)
      .single(),
    supabase
      .from('gmail_connections')
      .select('google_email, status')
      .eq('betrieb_id', betriebId)
      .eq('status', 'aktiv')
      .maybeSingle(),
    supabase
      .from('verfuegbarkeit_regel')
      .select('id', { count: 'exact', head: true })
      .eq('aktiv', true),
  ]);

  const gmailDone = Boolean(gmailConn);
  const verfuegbarkeitDone = (regelCount ?? 0) > 0;
  // Profil gilt als "fertig" wenn mindestens was_wir_machen UND signatur
  // gepflegt sind – die zwei Felder mit dem größten KI-Hebel.
  const profilDone = Boolean(
    betrieb?.was_wir_machen &&
      betrieb.was_wir_machen.length > 0 &&
      betrieb.signatur &&
      betrieb.signatur.trim().length > 0
  );

  const alleDone = gmailDone && verfuegbarkeitDone && profilDone;
  const anzahlDone = [gmailDone, verfuegbarkeitDone, profilDone].filter(
    Boolean
  ).length;

  const inhaberName = betrieb?.inhaber || '';

  return (
    <div className="container mx-auto py-8 sm:py-12 px-4 sm:px-6 max-w-4xl">
      {/* HERO */}
      <div className="mb-8 sm:mb-10 text-center">
        <Wortmarke size="lg" withTagline className="items-center mb-6 mx-auto" />
        <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-2">
          {inhaberName ? `Hi ${inhaberName.split(' ')[0]},` : 'Willkommen!'}
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
          In drei kurzen Schritten ist alles bereit. Deine Assistenz lernt
          dich beim Einrichten gleich kennen.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-foreground/70">
          <span className="font-semibold">{anzahlDone}/3</span>
          <span>Schritte erledigt</span>
        </div>
      </div>

      {/* DREI SCHRITTE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <OnboardingStep
          nummer={1}
          icon={MailIcon}
          title="Gmail verbinden"
          description="Deine Antworten gehen aus deinem echten Gmail raus – wie immer. Ein Klick, fertig."
          ctaLabel="Mit Gmail verbinden"
          ctaHref="/dashboard/profil"
          done={gmailDone}
          doneLabel={gmailConn?.google_email ? 'Verbunden' : 'Erledigt'}
        />
        <OnboardingStep
          nummer={2}
          icon={Calendar02Icon}
          title="Verfügbarkeit eintragen"
          description="Sag der KI wann du Aufmaßtermine machen kannst (z. B. Mo–Fr 8–12 Uhr). Sie schlägt Kunden dann konkrete Slots vor."
          ctaLabel="Zum Kalender"
          ctaHref="/dashboard/kalender"
          done={verfuegbarkeitDone}
        />
        <OnboardingStep
          nummer={3}
          icon={Building03Icon}
          title="Profil ausfüllen"
          description="Was machst du, was nicht, wie schreibst du. Je mehr hier steht, desto besser klingen die KI-Entwürfe nach dir."
          ctaLabel="Zum Profil"
          ctaHref="/dashboard/profil"
          done={profilDone}
        />
      </div>

      {/* STARTKLAR-BANNER */}
      {alleDone ? (
        <Card className="p-6 sm:p-8 bg-primary text-primary-foreground border-primary">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary-foreground/20 p-2.5 flex-shrink-0">
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  size={22}
                  strokeWidth={2}
                />
              </div>
              <div>
                <h2 className="font-heading text-xl font-bold uppercase tracking-wide mb-1">
                  Du bist startklar
                </h2>
                <p className="text-sm text-primary-foreground/85">
                  Alle drei Schritte erledigt. Lass die nächste Kundenanfrage
                  reinkommen – die KI macht den Rest.
                </p>
              </div>
            </div>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="gap-1.5 w-full sm:w-auto"
            >
              <Link href="/dashboard">
                Zur Inbox
                <HugeiconsIcon
                  icon={ArrowRight02Icon}
                  size={16}
                  strokeWidth={1.5}
                />
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="text-center">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            Onboarding später machen, jetzt zur Inbox
            <HugeiconsIcon
              icon={ArrowRight02Icon}
              size={14}
              strokeWidth={1.5}
            />
          </Link>
        </div>
      )}
    </div>
  );
}
