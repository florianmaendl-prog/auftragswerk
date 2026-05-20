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
  | 'eingang'
  | 'freigabe'
  | 'manuell'
  | 'info'
  | 'versendet'
  | 'gespraech'
  | 'erledigt'
  | 'aussortiert';

type TabConfig = {
  id: TabId;
  label: string;
  icon: string;
  statuses: string[];
  description: string;
};

const TABS: TabConfig[] = [
  {
    id: 'eingang',
    label: 'Eingang',
    icon: '📥',
    statuses: ['neu'],
    description: 'Neu eingegangen, Klassifikation läuft noch',
  },
  {
    id: 'freigabe',
    label: 'Freigabe',
    icon: '✏️',
    statuses: ['entwurf_bereit'],
    description: 'Entwurf bereit zum Senden',
  },
  {
    id: 'manuell',
    label: 'Manuell prüfen',
    icon: '⚠️',
    statuses: ['manuell_pruefen'],
    description: 'KI unsicher – du musst entscheiden',
  },
  {
    id: 'info',
    label: 'Info',
    icon: '📌',
    statuses: ['info'],
    description: 'Rechnungen, Innung, Behörden, Bestellungen',
  },
  {
    id: 'versendet',
    label: 'Versendet',
    icon: '📤',
    statuses: ['versendet'],
    description: 'Mail raus, warten auf Kunden-Antwort',
  },
  {
    id: 'gespraech',
    label: 'Im Gespräch',
    icon: '💬',
    statuses: ['reply_eingegangen'],
    description: 'Kunde hat geantwortet',
  },
  {
    id: 'erledigt',
    label: 'Erledigt',
    icon: '✅',
    statuses: ['erledigt'],
    description: 'Abgeschlossen, archiviert',
  },
  {
    id: 'aussortiert',
    label: 'Aussortiert',
    icon: '🗑️',
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
  // Warn-Badge für mittlere Confidence (60-80%)
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

  const supabase = await createClient();

  // Alle Anfragen holen – aber NICHT die im Papierkorb (geloescht_am IS NULL)
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

  const counts: Record<TabId, number> = TABS.reduce(
    (acc, tab) => {
      acc[tab.id] = items.filter((a) => tab.statuses.includes(a.status)).length;
      return acc;
    },
    {} as Record<TabId, number>
  );

  const filtered = items.filter((a) => activeTab.statuses.includes(a.status));

  return (
    <div className="container mx-auto py-8 px-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Inbox</h1>
        <p className="text-muted-foreground text-sm">
          {items.length} {items.length === 1 ? 'Anfrage' : 'Anfragen'} insgesamt
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 border-b border-border min-w-max">
          {TABS.map((tab) => {
            const count = counts[tab.id];
            const isActive = tab.id === activeTabId;
            return (
              <Link
                key={tab.id}
                href={`/dashboard?tab=${tab.id}`}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
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