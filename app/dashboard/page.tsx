import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AnfrageQuickMenu } from './anfrage-quick-menu';

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
  }> | null;
};

type TabId =
  | 'freigabe'
  | 'manuell'
  | 'gespraech'
  | 'versendet'
  | 'info'
  | 'erledigt'
  | 'aussortiert';

type GroupId = 'zu_tun' | 'verfolgen' | 'archiv';

type TabConfig = {
  id: TabId;
  label: string;
  icon: string;
  statuses: string[];
  description: string;
  group: GroupId;
};

type GroupConfig = {
  id: GroupId;
  label: string;
  description: string;
};

const GROUPS: GroupConfig[] = [
  {
    id: 'zu_tun',
    label: 'Zu tun',
    description: 'Hier brauchst du Action',
  },
  {
    id: 'verfolgen',
    label: 'Verfolgen',
    description: 'Läuft – im Auge behalten',
  },
  {
    id: 'archiv',
    label: 'Archiv',
    description: 'Abgeschlossen',
  },
];

const TABS: TabConfig[] = [
  // ZU TUN-Bereich
  {
    id: 'freigabe',
    label: 'Freigabe',
    icon: '🔵',
    statuses: ['entwurf_bereit'],
    description: 'KI-Entwurf bereit – du gibst frei oder passt an',
    group: 'zu_tun',
  },
  {
    id: 'manuell',
    label: 'Manuell prüfen',
    icon: '🟡',
    statuses: ['manuell_pruefen', 'neu'],
    description: 'KI unsicher oder Klassifikation fehlgeschlagen – du musst selbst entscheiden',
    group: 'zu_tun',
  },
  {
    id: 'gespraech',
    label: 'Kunde geantwortet',
    icon: '🟢',
    statuses: ['reply_eingegangen'],
    description: 'Reaktion auf deine versendete Mail – hier liegt Geld',
    group: 'zu_tun',
  },
  // VERFOLGEN-Bereich
  {
    id: 'versendet',
    label: 'Versendet',
    icon: '📨',
    statuses: ['versendet'],
    description: 'Mail raus – warten auf Kunden-Antwort',
    group: 'verfolgen',
  },
  {
    id: 'info',
    label: 'Info',
    icon: 'ℹ️',
    statuses: ['info'],
    description: 'Rechnungen, Bestellungen, Innung, Behörden – nur zur Kenntnis',
    group: 'verfolgen',
  },
  // ARCHIV-Bereich
  {
    id: 'erledigt',
    label: 'Erledigt',
    icon: '✅',
    statuses: ['erledigt'],
    description: 'Abgeschlossen, archiviert',
    group: 'archiv',
  },
  {
    id: 'aussortiert',
    label: 'Aussortiert',
    icon: '🗑️',
    statuses: ['aussortiert'],
    description: 'Werbung, Spam',
    group: 'archiv',
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

type InboxStats = {
  heuteNeu: number;        // Anfragen reingekommen heute, nicht-reply, nicht-aussortiert
  heuteReplies: number;    // Kunden-Antworten heute
  heuteAussortiert: number;
  wocheAnfragen: number;   // alle Anfragen außer aussortiert
  wocheTermine: number;    // aus termine-Tabelle
};

function computeStats(items: AnfrageWithJoins[], wocheTermine: number): InboxStats {
  const tHeute = getStartOfToday().getTime();
  const tWoche = getStartOfWeek().getTime();

  let heuteNeu = 0;
  let heuteReplies = 0;
  let heuteAussortiert = 0;
  let wocheAnfragen = 0;

  for (const it of items) {
    const ts = it.created_at ? new Date(it.created_at).getTime() : 0;
    if (ts < tWoche) continue;

    if (it.status !== 'aussortiert') wocheAnfragen++;

    if (ts < tHeute) continue;
    if (it.status === 'reply_eingegangen') heuteReplies++;
    else if (it.status === 'aussortiert') heuteAussortiert++;
    else if (
      it.status === 'entwurf_bereit' ||
      it.status === 'manuell_pruefen' ||
      it.status === 'neu' ||
      it.status === 'versendet'
    )
      heuteNeu++;
  }

  return { heuteNeu, heuteReplies, heuteAussortiert, wocheAnfragen, wocheTermine };
}

function gewerkBadge(gewerk: string | null) {
  if (!gewerk) return null;
  const color =
    gewerk === 'passt'
      ? 'bg-green-100 text-green-800 border-green-200'
      : gewerk === 'passt_nicht'
      ? 'bg-red-100 text-red-800 border-red-200'
      : 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        color
      )}
    >
      {gewerk}
    </span>
  );
}

function confidenceBadge(confidence: number | null) {
  if (confidence === null || confidence >= 0.8) return null;
  const pct = Math.round(confidence * 100);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        'bg-amber-50 text-amber-700 border-amber-200'
      )}
      title="KI ist sich nicht sicher – Entwurf bitte besonders prüfen"
    >
      KI {pct}%
    </span>
  );
}

function kategorieBadge(kategorie: string | null | undefined) {
  if (!kategorie) return null;
  const mapping: Record<string, { label: string; color: string }> = {
    rechnung: {
      label: '💶 Rechnung',
      color: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    bestellung_versand: {
      label: '📦 Bestellung',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    innung_behoerde: {
      label: '📋 Innung/Behörde',
      color: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    werbung: {
      label: '📢 Werbung',
      color: 'bg-gray-100 text-gray-700 border-gray-200',
    },
    sonstiges: {
      label: '❓ Sonstiges',
      color: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  };
  const conf = mapping[kategorie];
  if (!conf) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        conf.color
      )}
    >
      {conf.label}
    </span>
  );
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTabId = (TABS.find((t) => t.id === params.tab)?.id ?? 'freigabe') as TabId;
  const activeTab = TABS.find((t) => t.id === activeTabId)!;
  const activeGroupId = activeTab.group;

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
      entwuerfe (id, status)
    `
    )
    .is('geloescht_am', null)
    .order('created_at', { ascending: false })
    .limit(500);

  const items = (alle as AnfrageWithJoins[]) || [];

  // Mini-Stats für die Top-Bar: Termine dieser Woche separat zählen
  const startWoche = getStartOfWeek();
  const startNaechsteWoche = new Date(startWoche);
  startNaechsteWoche.setDate(startNaechsteWoche.getDate() + 7);
  const { count: terminCount } = await supabase
    .from('termine')
    .select('id', { count: 'exact', head: true })
    .gte('datum', startWoche.toISOString())
    .lt('datum', startNaechsteWoche.toISOString())
    .neq('status', 'abgesagt');
  const stats = computeStats(items, terminCount ?? 0);

  // Counts pro Tab
  const counts: Record<TabId, number> = TABS.reduce(
    (acc, tab) => {
      acc[tab.id] = items.filter((a) => tab.statuses.includes(a.status)).length;
      return acc;
    },
    {} as Record<TabId, number>
  );

  // Counts pro Gruppe
  const groupCounts: Record<GroupId, number> = GROUPS.reduce(
    (acc, group) => {
      acc[group.id] = TABS.filter((t) => t.group === group.id).reduce(
        (sum, t) => sum + counts[t.id],
        0
      );
      return acc;
    },
    {} as Record<GroupId, number>
  );

  const filtered = items.filter((a) => activeTab.statuses.includes(a.status));
  const subTabs = TABS.filter((t) => t.group === activeGroupId);

  return (
    <div className="container mx-auto py-8 px-6 max-w-5xl">
      <div className="mb-4">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Inbox</h1>
        <p className="text-muted-foreground text-sm">
          {items.length} {items.length === 1 ? 'Anfrage' : 'Anfragen'} insgesamt
        </p>
      </div>

      {/* MINI-STATS-BAR */}
      <div className="mb-5 rounded-md border border-input bg-muted/20 p-3 text-sm space-y-1">
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
          <span className="font-medium">Diese Woche:</span>
          <span>
            <span className="font-semibold text-foreground">{stats.wocheAnfragen}</span>{' '}
            {stats.wocheAnfragen === 1 ? 'Anfrage' : 'Anfragen'}
          </span>
          <Link href="/dashboard/termine" className="hover:underline">
            <span className="font-semibold text-foreground">{stats.wocheTermine}</span>{' '}
            {stats.wocheTermine === 1 ? 'Termin' : 'Termine'}
          </Link>
        </div>
      </div>

      {/* HAUPTREIHE: Gruppen */}
      <div className="mb-3 overflow-x-auto">
        <div className="flex gap-1 border-b border-border min-w-max">
          {GROUPS.map((group) => {
            const isActive = group.id === activeGroupId;
            const groupCount = groupCounts[group.id];
            const firstTabOfGroup = TABS.find((t) => t.group === group.id)!;
            return (
              <Link
                key={group.id}
                href={`/dashboard?tab=${firstTabOfGroup.id}`}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                )}
              >
                <span>{group.label}</span>
                {groupCount > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center rounded-full text-xs font-medium px-1.5 min-w-[1.25rem] h-5',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {groupCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* SUB-TABS */}
      <div className="mb-4 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {subTabs.map((tab) => {
            const count = counts[tab.id];
            const isActive = tab.id === activeTabId;
            return (
              <Link
                key={tab.id}
                href={`/dashboard?tab=${tab.id}`}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center rounded-full text-xs font-medium px-1.5 min-w-[1.25rem] h-5',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted-foreground/10 text-muted-foreground'
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
        <Card className="p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Keine Anfragen in „{activeTab.label}".
          </p>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((anfrage) => {
          const klass = anfrage.analysen?.[0];
          const hatEntwurf = anfrage.status === 'entwurf_bereit';
          const istInfo = anfrage.status === 'info';

          return (
            <div key={anfrage.id} className="relative group">
              <Link
                href={`/dashboard/anfragen/${anfrage.id}`}
                className="block"
              >
                <Card
                  className={cn(
                    'p-4 pr-14 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer',
                    hatEntwurf && 'border-l-4 border-l-primary'
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
                      <div className="flex items-center gap-2 text-sm text-muted-foreground ml-4">
                        <span className="truncate">
                          von {anfrage.von_name || anfrage.von_email}
                        </span>
                        <span>·</span>
                        <span className="flex-shrink-0">{timeAgo(anfrage.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {istInfo && kategorieBadge(klass?.kategorie)}
                      {!istInfo && klass && gewerkBadge(klass.gewerk_match)}
                      {!istInfo && klass && confidenceBadge(klass.confidence)}
                    </div>
                  </div>
                </Card>
              </Link>
              <div className="absolute top-3 right-3">
                <AnfrageQuickMenu
                  anfrageId={anfrage.id}
                  currentStatus={anfrage.status}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}