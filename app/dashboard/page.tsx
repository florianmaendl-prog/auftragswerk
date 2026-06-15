import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AnfrageQuickMenu } from './anfrage-quick-menu';
import { InboxRefreshButton } from './inbox-refresh-button';
import { InboxSuche } from './inbox-suche';
import { InboxTabTitle } from './inbox-tab-title';
import { KategorieBadge } from '@/components/brand/kategorie-badge';
import { EmptyState } from '@/components/brand/empty-state';
import { InboxIcon } from '@hugeicons/core-free-icons';

type AnfrageWithJoins = {
  id: string;
  betreff: string;
  von_name: string | null;
  von_email: string;
  status: string;
  created_at: string;
  analysen: Array<{
    kategorie: string;
    gewerk_match: string | null;
    confidence: number | null;
  }> | null;
  entwuerfe: Array<{
    id: string;
    status: string;
    versendet_am: string | null;
    was_edited: boolean | null;
  }> | null;
};

const STALE_TAGE_THRESHOLD = 7;

/**
 * Stale-Tage einer versendeten Anfrage berechnen. Heuristik: spätester
 * `versendet_am` aller Entwürfe der Anfrage, sonst created_at als Fallback.
 * Returnt null wenn nicht versendet oder noch frisch (<7 Tage).
 */
function staleTage(anfrage: AnfrageWithJoins): number | null {
  if (anfrage.status !== 'versendet') return null;
  let basisZeit: number | null = null;
  for (const e of anfrage.entwuerfe ?? []) {
    if (e.versendet_am) {
      const t = new Date(e.versendet_am).getTime();
      if (basisZeit === null || t > basisZeit) basisZeit = t;
    }
  }
  if (basisZeit === null) basisZeit = new Date(anfrage.created_at).getTime();
  const tage = Math.floor((Date.now() - basisZeit) / (1000 * 60 * 60 * 24));
  return tage >= STALE_TAGE_THRESHOLD ? tage : null;
}

type TabId =
  | 'freigabe'
  | 'manuell'
  | 'gespraech'
  | 'versendet'
  | 'kammer'
  | 'info'
  | 'erledigt'
  | 'aussortiert';

type TabConfig = {
  id: TabId;
  label: string;
  statuses: string[];
  description: string;
  /** Wenn gesetzt: Anfrage muss zusätzlich diese KI-Kategorie haben. */
  nurKategorien?: string[];
  /** Wenn gesetzt: Anfragen mit diesen KI-Kategorien werden ausgeschlossen. */
  ohneKategorien?: string[];
};

/**
 * Flache Tab-Struktur (seit User-Feedback Tag 18): Gruppen-Labels
 * ("Zu tun" / "Verfolgen" / "Archiv") sind raus – Owner versteht
 * "Verfolgen" nicht und "Info" gehört nicht intuitiv dort rein.
 * Alle Tabs gleichberechtigt nebeneinander, "Info" prominent als
 * Top-Level-Tab für Rechnungen/Bestellungen/Innung/Anwalt.
 */
const TABS: TabConfig[] = [
  {
    id: 'freigabe',
    label: 'Freigabe',
    statuses: ['entwurf_bereit'],
    description: 'KI-Entwurf bereit – du sendest oder passt an',
  },
  {
    id: 'manuell',
    label: 'Manuell prüfen',
    statuses: ['manuell_pruefen', 'neu'],
    description: 'KI unsicher oder Klassifikation fehlgeschlagen – du musst selbst entscheiden',
  },
  {
    id: 'gespraech',
    label: 'Kunde geantwortet',
    statuses: ['reply_eingegangen'],
    description: 'Reaktion auf deine versendete Mail – hier liegt Geld',
  },
  {
    id: 'versendet',
    label: 'Versendet',
    statuses: ['versendet'],
    description: 'Mail raus – warten auf Kunden-Antwort',
  },
  {
    id: 'kammer',
    label: 'Kammer / Verband',
    statuses: ['info'],
    nurKategorien: ['innung_behoerde'],
    description: 'Innung, Handwerkskammer, Behörden – getrennt vom Info-Rauschen',
  },
  {
    id: 'info',
    label: 'Info',
    statuses: ['info'],
    ohneKategorien: ['innung_behoerde'],
    description: 'Rechnungen, Bestellungen, Anwalt – nur zur Kenntnis',
  },
  {
    id: 'erledigt',
    label: 'Erledigt',
    statuses: ['erledigt'],
    description: 'Abgeschlossen, archiviert',
  },
  {
    id: 'aussortiert',
    label: 'Aussortiert',
    statuses: ['aussortiert'],
    description: 'Werbung, Spam',
  },
];

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'gerade eben';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
  return new Date(date).toLocaleDateString('de-DE');
}

function getStartOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfWeek(): Date {
  const d = new Date();
  const dayIso = (d.getDay() + 6) % 7; // 0=Mo .. 6=So
  d.setDate(d.getDate() - dayIso);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

type InboxStats = {
  // Heute – für die Top-Zeile (kompakt)
  heuteNeu: number;
  heuteReplies: number;
  heuteAussortiert: number;
  // Woche – primärer Block
  wocheAnfragen: number;
  wocheAntworten: number;
  wocheTermine: number;
  wocheUngeaendert: number;
  wocheAussortiert: number;
  // Monat – Innungs-Story-Block (größere Zahlen)
  monatAnfragen: number;
  monatAntworten: number;
  monatTermine: number;
  monatUngeaendert: number;
  monatAussortiert: number;
  monatAntwortzeitMedianMin: number | null;
};

/**
 * Ehrliche Aktivitäts-Statistiken (Tag 20).
 *
 * BEWUSST nur Fakten – KEIN "X Stunden gespart"-Bullshit. Owner-Pushback
 * Tag 20: "spart laut Hersteller 12h" durchschauen smarte Handwerker
 * sofort, Vertrauensbruch. Lösung: nur Counts/Quotienten/Zeiten aus
 * der DB. Der Owner baut seine eigene Story (z.B. Innungs-Vorstellung).
 */
function computeStats(
  items: AnfrageWithJoins[],
  wocheTermine: number,
  monatTermine: number
): InboxStats {
  const tHeute = getStartOfToday().getTime();
  const tWoche = getStartOfWeek().getTime();
  const tMonat = getStartOfMonth().getTime();

  let heuteNeu = 0;
  let heuteReplies = 0;
  let heuteAussortiert = 0;

  let wocheAnfragen = 0;
  let wocheAntworten = 0;
  let wocheUngeaendert = 0;
  let wocheAussortiert = 0;

  let monatAnfragen = 0;
  let monatAntworten = 0;
  let monatUngeaendert = 0;
  let monatAussortiert = 0;

  // Antwortzeit-Sammlung (in Minuten) – nur Anfragen mit versendetem Entwurf
  const antwortMinutenMonat: number[] = [];

  for (const it of items) {
    const tsAnfrage = it.created_at ? new Date(it.created_at).getTime() : 0;
    const istAussortiert = it.status === 'aussortiert';

    // versendet_am des letztens versendeten Entwurfs (falls vorhanden)
    let tsVersendet = 0;
    for (const e of it.entwuerfe ?? []) {
      if (e.versendet_am) {
        const t = new Date(e.versendet_am).getTime();
        if (t > tsVersendet) tsVersendet = t;
      }
    }
    // war ein Entwurf editiert beim Versand? Nur der letzte zählt
    const entwurfWasEdited = (it.entwuerfe ?? [])
      .filter((e) => e.versendet_am)
      .some((e) => e.was_edited === true);

    // MONAT-Bucket
    if (tsAnfrage >= tMonat) {
      if (istAussortiert) monatAussortiert++;
      else monatAnfragen++;
      if (tsVersendet >= tMonat) {
        monatAntworten++;
        if (!entwurfWasEdited) monatUngeaendert++;
        const min = Math.floor((tsVersendet - tsAnfrage) / (1000 * 60));
        if (min > 0 && min < 60 * 24 * 14) antwortMinutenMonat.push(min);
      }
    }

    // WOCHE-Bucket
    if (tsAnfrage >= tWoche) {
      if (istAussortiert) wocheAussortiert++;
      else wocheAnfragen++;
      if (tsVersendet >= tWoche) {
        wocheAntworten++;
        if (!entwurfWasEdited) wocheUngeaendert++;
      }
    }

    // HEUTE-Bucket
    if (tsAnfrage >= tHeute) {
      if (it.status === 'reply_eingegangen') heuteReplies++;
      else if (istAussortiert) heuteAussortiert++;
      else if (
        it.status === 'entwurf_bereit' ||
        it.status === 'manuell_pruefen' ||
        it.status === 'neu' ||
        it.status === 'versendet'
      )
        heuteNeu++;
    }
  }

  // Median der Antwortzeit – robuster gegen Ausreißer als Mittelwert
  const sortiert = [...antwortMinutenMonat].sort((a, b) => a - b);
  const median =
    sortiert.length === 0 ? null : sortiert[Math.floor(sortiert.length / 2)];

  return {
    heuteNeu,
    heuteReplies,
    heuteAussortiert,
    wocheAnfragen,
    wocheAntworten,
    wocheTermine,
    wocheUngeaendert,
    wocheAussortiert,
    monatAnfragen,
    monatAntworten,
    monatTermine,
    monatUngeaendert,
    monatAussortiert,
    monatAntwortzeitMedianMin: median,
  };
}

function confidenceBadge(confidence: number | null) {
  if (confidence === null || confidence >= 0.8) return null;
  const pct = Math.round(confidence * 100);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
      )}
      title="KI ist sich nicht sicher – Entwurf bitte besonders prüfen"
    >
      KI {pct}%
    </span>
  );
}


export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const params = await searchParams;
  const activeTabId = (TABS.find((t) => t.id === params.tab)?.id ?? 'freigabe') as TabId;
  const activeTab = TABS.find((t) => t.id === activeTabId)!;
  const suchterm = (params.q ?? '').trim().toLowerCase();

  const supabase = await createClient();

  const { data: alle, error } = await supabase
    .from('anfragen')
    .select(
      `
      id,
      betreff,
      von_name,
      von_email,
      status,
      created_at,
      analysen (kategorie, gewerk_match, confidence),
      entwuerfe (id, status, versendet_am, was_edited)
    `
    )
    .is('geloescht_am', null)
    .order('created_at', { ascending: false })
    .limit(500);

  const items = (alle as AnfrageWithJoins[]) || [];

  // First-Run-Detection: brand-neuer User ohne irgendetwas → Wow-Onboarding.
  // Sobald irgendein Schritt erledigt (Anfrage da, Gmail verbunden oder Regel
  // angelegt), zeigen wir die Inbox normal (mit Empty-State falls leer).
  // Wenn explizit ?tab=... gesetzt ist, hat der User schon was geklickt – kein
  // Redirect mehr.
  if (items.length === 0 && !params.tab) {
    const [{ count: gmailCount }, { count: regelCount }] = await Promise.all([
      supabase
        .from('gmail_connections')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('verfuegbarkeit_regel')
        .select('id', { count: 'exact', head: true }),
    ]);
    if ((gmailCount ?? 0) === 0 && (regelCount ?? 0) === 0) {
      redirect('/dashboard/willkommen');
    }
  }

  // Termine Woche + Monat parallel (für die Aktivitäts-Karte – ehrliche Zahlen,
  // keine Zeit-Spar-Schätzungen)
  const startWoche = getStartOfWeek();
  const startNaechsteWoche = new Date(startWoche);
  startNaechsteWoche.setDate(startNaechsteWoche.getDate() + 7);
  const startMonat = getStartOfMonth();
  const startNaechsterMonat = new Date(startMonat);
  startNaechsterMonat.setMonth(startNaechsterMonat.getMonth() + 1);

  const [{ count: terminCountWoche }, { count: terminCountMonat }] =
    await Promise.all([
      supabase
        .from('termine')
        .select('id', { count: 'exact', head: true })
        .gte('datum', startWoche.toISOString())
        .lt('datum', startNaechsteWoche.toISOString())
        .neq('status', 'abgesagt'),
      supabase
        .from('termine')
        .select('id', { count: 'exact', head: true })
        .gte('datum', startMonat.toISOString())
        .lt('datum', startNaechsterMonat.toISOString())
        .neq('status', 'abgesagt'),
    ]);
  const stats = computeStats(items, terminCountWoche ?? 0, terminCountMonat ?? 0);

  // Tab-Match: status muss passen, plus optional Kategorie-Filter
  // (nurKategorien für Kammer-Tab, ohneKategorien für Info-Tab damit
  // Innung dort nicht doppelt erscheint).
  function matchesTab(
    a: { status: string; analysen?: Array<{ kategorie: string }> | null },
    tab: TabConfig
  ): boolean {
    if (!tab.statuses.includes(a.status)) return false;
    const kategorie = a.analysen?.[0]?.kategorie;
    if (tab.nurKategorien && (!kategorie || !tab.nurKategorien.includes(kategorie))) {
      return false;
    }
    if (tab.ohneKategorien && kategorie && tab.ohneKategorien.includes(kategorie)) {
      return false;
    }
    return true;
  }

  // Counts pro Tab
  const counts: Record<TabId, number> = TABS.reduce(
    (acc, tab) => {
      acc[tab.id] = items.filter((a) => matchesTab(a, tab)).length;
      return acc;
    },
    {} as Record<TabId, number>
  );

  const filtered = items
    .filter((a) => matchesTab(a, activeTab))
    .filter((a) => {
      // Volltext-Filter: Betreff / Von-Name / Von-Email matchen (case-insensitive).
      // Wenn kein Suchterm → alles durchlassen.
      if (!suchterm) return true;
      const hay = (
        (a.betreff ?? '') +
        ' ' +
        (a.von_name ?? '') +
        ' ' +
        (a.von_email ?? '')
      ).toLowerCase();
      return hay.includes(suchterm);
    });

  // Browser-Tab-Title-Counter: zählt nur Tabs die echte Owner-Arbeit sind
  // (Freigabe + Manuell prüfen + Kunde geantwortet). Versendet / Info /
  // Kammer / Erledigt / Aussortiert sind kein "to-do" – sollen nicht im
  // Counter erscheinen.
  const offenForTitle = counts.freigabe + counts.manuell + counts.gespraech;

  return (
    <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6 max-w-5xl">
      <InboxTabTitle offen={offenForTitle} />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-wide mb-1">
            Inbox
          </h1>
          <p className="text-muted-foreground text-sm">
            {suchterm
              ? `${filtered.length} ${filtered.length === 1 ? 'Treffer' : 'Treffer'} für „${suchterm}"`
              : `${items.length} ${items.length === 1 ? 'Anfrage' : 'Anfragen'} insgesamt`}
          </p>
        </div>
        <InboxRefreshButton />
      </div>

      {/* Suche – debounced, schreibt ?q= in die URL */}
      <div className="mb-5 max-w-md">
        <InboxSuche />
      </div>

      {/* AKTIVITÄTS-KARTE – nur Fakten, keine erfundenen Zeit-Schätzungen.
          Owner-Pushback Tag 20: "X Stunden gespart" wäre Bullshit-Kalkulation,
          smarte Handwerker durchschauen das sofort. Hier nur was wirklich
          messbar ist – Owner baut seine eigene Story (z.B. Innungs-Vorstellung). */}
      <div className="mb-5 rounded-md border border-input bg-muted/20 p-4 space-y-3 text-sm">
        {/* Heute-Zeile – kompakt */}
        {stats.heuteNeu === 0 &&
        stats.heuteReplies === 0 &&
        stats.heuteAussortiert === 0 ? (
          <p className="text-muted-foreground">Heute noch nichts los.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-muted-foreground font-medium">Heute:</span>
            {stats.heuteNeu > 0 && (
              <Link href="/dashboard?tab=freigabe" className="hover:underline">
                <span className="font-semibold">{stats.heuteNeu}</span>{' '}
                {stats.heuteNeu === 1 ? 'neue Anfrage' : 'neue Anfragen'}
              </Link>
            )}
            {stats.heuteReplies > 0 && (
              <Link href="/dashboard?tab=gespraech" className="hover:underline">
                <span className="font-semibold">{stats.heuteReplies}</span>{' '}
                {stats.heuteReplies === 1 ? 'Reply' : 'Replies'}
              </Link>
            )}
            {stats.heuteAussortiert > 0 && (
              <Link
                href="/dashboard?tab=aussortiert"
                className="hover:underline text-muted-foreground"
              >
                <span className="font-semibold">{stats.heuteAussortiert}</span> aussortiert
              </Link>
            )}
          </div>
        )}

        {/* Woche – primärer Block, 4 große Zahlen */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Diese Woche
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">
                {stats.wocheAnfragen}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.wocheAnfragen === 1 ? 'Anfrage' : 'Anfragen'} rein
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">
                {stats.wocheAntworten}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.wocheAntworten === 1 ? 'Antwort' : 'Antworten'} raus
              </p>
            </div>
            <Link href="/dashboard/termine" className="hover:opacity-80 transition-opacity">
              <p className="text-2xl font-bold text-foreground leading-none">
                {stats.wocheTermine}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.wocheTermine === 1 ? 'Termin' : 'Termine'}
              </p>
            </Link>
            <Link
              href="/dashboard?tab=aussortiert"
              className="hover:opacity-80 transition-opacity"
            >
              <p className="text-2xl font-bold text-muted-foreground leading-none">
                {stats.wocheAussortiert}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.wocheAussortiert === 1 ? 'Werbung' : 'Werbung'} weg
              </p>
            </Link>
          </div>
        </div>

        {/* Monat – kleinere Sub-Zeile mit den großen Zahlen + Qualitäts-Hinweise */}
        {(stats.monatAnfragen > 0 || stats.monatAntworten > 0) && (
          <div className="border-t border-border/50 pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium">Diesen Monat:</span>
            <span>
              <span className="font-semibold text-foreground">
                {stats.monatAnfragen}
              </span>{' '}
              Anfragen
            </span>
            <span>
              <span className="font-semibold text-foreground">
                {stats.monatAntworten}
              </span>{' '}
              Antworten
            </span>
            <span>
              <span className="font-semibold text-foreground">
                {stats.monatTermine}
              </span>{' '}
              Termine
            </span>
            {stats.monatAntworten > 0 && (
              <span
                title="Ungeändert versendet = KI-Entwurf hat den Ton getroffen, du hast nur freigegeben."
              >
                <span className="font-semibold text-foreground">
                  {stats.monatUngeaendert}/{stats.monatAntworten}
                </span>{' '}
                ungeändert versendet
              </span>
            )}
            {stats.monatAntwortzeitMedianMin !== null && (
              <span
                title="Median-Zeit von eingegangener Anfrage bis zur versendeten Antwort."
              >
                Ø Antwortzeit{' '}
                <span className="font-semibold text-foreground">
                  {stats.monatAntwortzeitMedianMin < 60
                    ? `${stats.monatAntwortzeitMedianMin} Min`
                    : `${Math.round(stats.monatAntwortzeitMedianMin / 60)} h`}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* FLACHE TAB-LEISTE – alle 7 Tabs gleichberechtigt, "Info" prominent
          als Top-Level (war vorher unter "Verfolgen" versteckt). Aktiver Tab
          mit border-bottom in primary, ansonsten dezent. Fade-Edge auf
          Mobile als Scroll-Hint. */}
      <div className="mb-4 -mx-2 px-2 overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-1rem),transparent)] sm:[mask-image:none]">
        <div className="flex gap-1 border-b border-border min-w-max">
          {TABS.map((tab) => {
            const count = counts[tab.id];
            const isActive = tab.id === activeTabId;
            return (
              <Link
                key={tab.id}
                href={`/dashboard?tab=${tab.id}`}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center rounded-full text-xs font-medium px-1.5 min-w-[1.25rem] h-5',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">{activeTab.description}</p>

      {error && (
        <Card className="p-4 mb-4 border-destructive">
          <p className="text-sm text-destructive">Fehler beim Laden: {error.message}</p>
        </Card>
      )}

      {filtered.length === 0 && !error && (
        <EmptyState
          icon={InboxIcon}
          title={`Keine Anfragen in „${activeTab.label}"`}
          description={activeTab.description}
        />
      )}

      <div className="space-y-2">
        {filtered.map((anfrage) => {
          const klass = anfrage.analysen?.[0];
          const hatEntwurf = anfrage.status === 'entwurf_bereit';
          const stale = staleTage(anfrage);

          return (
            <div key={anfrage.id} className="relative group">
              <Link
                href={`/dashboard/anfragen/${anfrage.id}`}
                className="block"
              >
                <Card
                  className={cn(
                    'p-4 pr-16 sm:pr-14 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer',
                    hatEntwurf && 'border-l-4 border-l-primary',
                    stale !== null && 'border-l-4 border-l-amber-400'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            hatEntwurf ? 'bg-primary' : 'bg-muted-foreground/30'
                          )}
                        />
                        <h3 className="font-medium truncate">{anfrage.betreff}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground ml-4 flex-wrap">
                        <span className="truncate">
                          von {anfrage.von_name || anfrage.von_email}
                        </span>
                        <span>·</span>
                        <span className="flex-shrink-0">{timeAgo(anfrage.created_at)}</span>
                        {stale !== null && (
                          <>
                            <span>·</span>
                            <span
                              className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200"
                              title="Diese Mail wurde vor mehr als einer Woche versendet und es kam noch keine Antwort. Vielleicht mal nachhaken?"
                            >
                              wartet seit {stale} Tagen
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <KategorieBadge
                        kategorie={klass?.kategorie as Parameters<typeof KategorieBadge>[0]['kategorie']}
                        gewerkMatch={klass?.gewerk_match as Parameters<typeof KategorieBadge>[0]['gewerkMatch']}
                      />
                      {klass && confidenceBadge(klass.confidence)}
                    </div>
                  </div>
                </Card>
              </Link>
              <div className="absolute top-3 right-3">
                <AnfrageQuickMenu
                  anfrageId={anfrage.id}
                  currentStatus={anfrage.status}
                  vonEmail={anfrage.von_email}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}