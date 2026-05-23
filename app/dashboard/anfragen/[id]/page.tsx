import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EntwurfEditor from './entwurf-editor';
import { DetailActions } from './detail-actions';
import { ReplyEditor } from './reply-editor';
import { cn } from '@/lib/utils';
import { cleanMail } from '@/lib/mail-cleaner';

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

function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

type Nachricht = {
  id: string;
  typ: 'eingang' | 'ausgang';
  von_email: string;
  von_name: string | null;
  betreff: string | null;
  body_text: string | null;
  erstellt_am: string;
  versendet_am: string | null;
  status: string;
};

/**
 * Für die Anzeige: bei eingehenden Mails Quotes/Signatur/Disclaimer
 * rausstrippen (Gmail & Co. hängen den vorherigen Verlauf immer dran,
 * das ist in unserer chronologischen View redundant). Eigene Ausgangs-
 * Mails bleiben unverändert – die Signatur gehört da rein.
 */
function bodyForDisplay(n: Nachricht): string {
  if (n.typ === 'eingang' && n.body_text) {
    const sauber = cleanMail(n.body_text, null).cleaned_text.trim();
    return sauber || n.body_text;
  }
  return n.body_text || '';
}

export default async function AnfrageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: anfrage, error } = await supabase
    .from('anfragen')
    .select(
      `
      id,
      betreff,
      von_email,
      von_name,
      body_text,
      status,
      created_at,
      geloescht_am,
      analysen (
        id,
        kategorie,
        subkategorie,
        gewerk_match,
        wert_indikator,
        kunde_typ,
        dringlichkeit,
        confidence,
        zusammenfassung,
        extrahierter_name,
        extrahierte_firma,
        extrahierte_telefon,
        extrahierte_plz,
        fehlende_infos,
        empfohlene_aktion
      ),
      entwuerfe (
        id,
        betreff_vorschlag,
        body_text,
        body_text_ohne_signatur,
        interne_notiz,
        status,
        modell,
        erstellt_am
      )
    `
    )
    .eq('id', id)
    .single();

  if (error || !anfrage) {
    notFound();
  }

  // Konversations-Nachrichten holen
  const { data: nachrichtenData } = await supabase
    .from('nachrichten')
    .select('id, typ, von_email, von_name, betreff, body_text, erstellt_am, versendet_am, status')
    .eq('anfrage_id', id)
    .order('erstellt_am', { ascending: true });

  const nachrichten = (nachrichtenData as Nachricht[]) || [];

  const klass = Array.isArray(anfrage.analysen) ? anfrage.analysen[0] : null;
  const entwurf = Array.isArray(anfrage.entwuerfe)
    ? anfrage.entwuerfe.find((e) => e.status === 'wartet_auf_freigabe') ||
      anfrage.entwuerfe.find((e) => e.status === 'versendet') ||
      anfrage.entwuerfe[0]
    : null;

  // Iron Rule:
  //   - WENN noch kein Entwurf versendet wurde:
  //       → Nur EIN Feld rechts (Entwurf-Editor wenn da, sonst leerer ReplyEditor)
  //   - WENN Entwurf bereits versendet:
  //       → Entwurf bleibt oben (read-only, dokumentiert was rausging)
  //       → Darunter ReplyEditor mit "Weitere Nachricht senden"
  //   - WENN beendet (erledigt/aussortiert/papierkorb): kein Feld
  const istBeendet = anfrage.status === 'erledigt' || anfrage.status === 'aussortiert';
  const istAktiv = !istBeendet && !anfrage.geloescht_am;
  const entwurfIstVersendet = entwurf?.status === 'versendet';

  return (
    <div className="container mx-auto py-6 px-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
        >
          ← Zurück zur Inbox
        </Link>

        {anfrage.geloescht_am && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>🗑️</span>
            <span>
              Diese Anfrage liegt im Papierkorb (seit {formatDateTime(anfrage.geloescht_am)})
            </span>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight mb-1">{anfrage.betreff}</h1>
            <p className="text-sm text-muted-foreground">
              von <span className="text-foreground">{anfrage.von_name || anfrage.von_email}</span>
              {anfrage.von_name && <> &lt;{anfrage.von_email}&gt;</>}
              {' · '}eingegangen {timeAgo(anfrage.created_at)}
              {nachrichten.length > 1 && (
                <> · {nachrichten.length} Nachrichten im Thread</>
              )}
            </p>
            <div className="flex items-center gap-2 mt-3">
              {klass && gewerkBadge(klass.gewerk_match)}
              {klass && confidenceBadge(klass.confidence)}
            </div>
          </div>
          <div className="flex-shrink-0">
            <DetailActions anfrageId={anfrage.id} currentStatus={anfrage.status} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LINKS: Konversation + KI-Analyse */}
        <div className="space-y-4">
          {/* Konversations-Thread */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {nachrichten.length > 1 ? 'Konversation' : 'Original-Anfrage'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {nachrichten.length === 0 ? (
                <pre className="whitespace-pre-wrap text-sm font-sans text-foreground/90 leading-relaxed">
                  {anfrage.body_text}
                </pre>
              ) : (
                nachrichten.map((n, i) => (
                  <div
                    key={n.id}
                    className={cn(
                      'rounded-md border p-3',
                      n.typ === 'ausgang'
                        ? 'bg-primary/5 border-primary/20'
                        : 'bg-background'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {n.typ === 'eingang' ? '📥' : '📤'}
                        </span>
                        <span className="font-medium">
                          {n.typ === 'eingang'
                            ? n.von_name || n.von_email
                            : 'Du (Auftragswerk)'}
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {formatDateTime(n.versendet_am || n.erstellt_am)}
                      </span>
                    </div>
                    {n.betreff && i === 0 && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Betreff: {n.betreff}
                      </p>
                    )}
                    <pre className="whitespace-pre-wrap text-sm font-sans text-foreground/90 leading-relaxed">
                      {bodyForDisplay(n)}
                    </pre>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* KI-Analyse */}
          {klass && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">KI-Analyse</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {klass.zusammenfassung && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Zusammenfassung</p>
                    <p>{klass.zusammenfassung}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <p className="text-muted-foreground text-xs">Kategorie</p>
                    <p className="font-medium">{klass.kategorie}</p>
                  </div>
                  {klass.gewerk_match && (
                    <div>
                      <p className="text-muted-foreground text-xs">Gewerk</p>
                      <p className="font-medium">{klass.gewerk_match}</p>
                    </div>
                  )}
                  {klass.wert_indikator && (
                    <div>
                      <p className="text-muted-foreground text-xs">Wert</p>
                      <p className="font-medium">{klass.wert_indikator}</p>
                    </div>
                  )}
                  {klass.kunde_typ && (
                    <div>
                      <p className="text-muted-foreground text-xs">Kunde</p>
                      <p className="font-medium">{klass.kunde_typ}</p>
                    </div>
                  )}
                  {klass.dringlichkeit && (
                    <div>
                      <p className="text-muted-foreground text-xs">Dringlichkeit</p>
                      <p className="font-medium">{klass.dringlichkeit}</p>
                    </div>
                  )}
                  {klass.confidence !== null && (
                    <div>
                      <p className="text-muted-foreground text-xs">Confidence</p>
                      <p className="font-medium">
                        {Math.round((klass.confidence || 0) * 100)}%
                      </p>
                    </div>
                  )}
                </div>

                {(klass.extrahierter_name ||
                  klass.extrahierte_telefon ||
                  klass.extrahierte_plz) && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground text-xs mb-1">
                      Erkannte Kontaktdaten
                    </p>
                    <div className="space-y-0.5 text-sm">
                      {klass.extrahierter_name && <p>👤 {klass.extrahierter_name}</p>}
                      {klass.extrahierte_firma && <p>🏢 {klass.extrahierte_firma}</p>}
                      {klass.extrahierte_telefon && <p>📞 {klass.extrahierte_telefon}</p>}
                      {klass.extrahierte_plz && <p>📍 {klass.extrahierte_plz}</p>}
                    </div>
                  </div>
                )}

                {klass.fehlende_infos &&
                  Array.isArray(klass.fehlende_infos) &&
                  klass.fehlende_infos.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground text-xs mb-1">Fehlende Infos</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {(klass.fehlende_infos as string[]).map((info, i) => (
                          <li key={i}>{info}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {klass.empfohlene_aktion && (
                  <div className="pt-2 border-t">
                    <p className="text-muted-foreground text-xs mb-1">Empfohlene Aktion</p>
                    <p>{klass.empfohlene_aktion}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* RECHTS: Entwurf-Editor (immer oben wenn da) + ReplyEditor (wenn aktiv + bereits versendet) */}
        <div className="space-y-4">
          {entwurf && (
            <EntwurfEditor
              entwurf={{
                id: entwurf.id,
                betreff_vorschlag: entwurf.betreff_vorschlag,
                body_text: entwurf.body_text,
                interne_notiz: entwurf.interne_notiz,
                status: entwurf.status,
                modell: entwurf.modell,
              }}
              anfrageId={anfrage.id}
              empfaenger={anfrage.von_email}
            />
          )}

          {istAktiv && (!entwurf || entwurfIstVersendet) && (
            <ReplyEditor
              anfrageId={anfrage.id}
              empfaenger={anfrage.von_email}
              empfaengerName={anfrage.von_name}
              urspruenglicherBetreff={anfrage.betreff || ''}
              istFolgeNachricht={entwurfIstVersendet}
            />
          )}

          {!istAktiv && !entwurf && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Antwort</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {anfrage.geloescht_am
                    ? 'Diese Anfrage liegt im Papierkorb. Erst wiederherstellen, dann antworten.'
                    : anfrage.status === 'erledigt'
                    ? 'Diese Anfrage ist als erledigt markiert. Status zurücksetzen, um zu antworten.'
                    : 'Diese Anfrage wurde aussortiert. Status ändern, um zu antworten.'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}