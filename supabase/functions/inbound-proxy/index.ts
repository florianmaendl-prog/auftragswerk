/**
 * Inbound-Proxy für Postmark → Vercel
 *
 * Vercel-Functions haben ein 4.5 MB Body-Limit. Postmark-Inbound-Webhooks
 * mit Foto-Anhängen sprengen das easy (HTTP 413). Diese Supabase Edge
 * Function (Deno, ~25 MB Body-Limit) hängt sich davor:
 *
 *   1. Empfängt den vollen Postmark-Webhook (mit Basic-Auth-Check)
 *   2. Findet den Betrieb über inbound_email
 *   3. Für jeden Anhang: base64 dekodieren → in Storage-Bucket 'anhaenge'
 *      unter <betrieb_id>/inbound/<messageId>/<uuid>_<filename> hochladen
 *   4. Entfernt das fette base64 Content-Feld aus der Payload, ersetzt
 *      durch _storage_path
 *   5. Forwarded die "lite" Payload (jetzt klein) an die bestehende
 *      Vercel /api/inbound-URL mit gleichem Basic-Auth
 *
 * Vercel-Route checkt: wenn _storage_path da → skip re-upload, einfach
 * in `anhaenge` referenzieren. Bestehende Klassifikation/Entwurf-Logik
 * unverändert.
 *
 * Env-Vars (per `supabase secrets set` oder Dashboard):
 *   - INBOUND_WEBHOOK_USER       (gleich wie auf Vercel)
 *   - INBOUND_WEBHOOK_PASS       (gleich wie auf Vercel)
 *   - VERCEL_INBOUND_URL         (z.B. https://www.auftragswerk.app/api/inbound)
 * Auto-injected:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Deployment:
 *   supabase functions deploy inbound-proxy --no-verify-jwt --project-ref lfziiallrfnrzbgatrml
 *
 * --no-verify-jwt = Function ist öffentlich (Auth machen wir selber via Basic).
 */

// Deno-spezifische Datei – Next.js build überspringt sie via tsconfig-exclude.
// Im Supabase-Deno-Runtime sind `Deno`-Global + esm.sh-Imports nativ verfügbar.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INBOUND_WEBHOOK_USER = Deno.env.get('INBOUND_WEBHOOK_USER') || '';
const INBOUND_WEBHOOK_PASS = Deno.env.get('INBOUND_WEBHOOK_PASS') || '';
const VERCEL_INBOUND_URL = Deno.env.get('VERCEL_INBOUND_URL') || '';

function istAutorisiert(req: Request): boolean {
  if (!INBOUND_WEBHOOK_USER || !INBOUND_WEBHOOK_PASS) {
    console.error('Inbound-Proxy: WEBHOOK_USER/PASS env-vars fehlen');
    return false;
  }
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const sep = decoded.indexOf(':');
  if (sep === -1) return false;
  return (
    decoded.slice(0, sep) === INBOUND_WEBHOOK_USER &&
    decoded.slice(sep + 1) === INBOUND_WEBHOOK_PASS
  );
}

/**
 * Supabase-Storage-konformer Filename. Strenger als naives Slash-Strip:
 * Storage akzeptiert nur [A-Za-z0-9._-] sauber. Alles andere – inkl.
 * Leerzeichen, Umlaute, Kommata, Klammern, Apostrophe – führt zu
 * "Invalid key"-Errors beim Upload. Beispiel-Trigger (real beobachtet):
 * "Lebenslauf von Agbemor-Brayn, Mandy.pdf".
 */
function sanitizeFilename(name: string): string {
  const raw = name || 'datei';
  // Umlaute + ß transliterieren bevor wir den Rest hart filtern
  const transliteriert = raw
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss');
  // Datei-Endung am Stück lassen, Stammnamen sanitisieren
  const lastDot = transliteriert.lastIndexOf('.');
  const stamm = lastDot > 0 ? transliteriert.slice(0, lastDot) : transliteriert;
  const ext = lastDot > 0 ? transliteriert.slice(lastDot) : '';
  // Alles außer A-Z, a-z, 0-9, . und - durch _ ersetzen
  const cleanStamm = stamm.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_');
  const cleanExt = ext.replace(/[^A-Za-z0-9.]/g, '');
  const result = (cleanStamm + cleanExt).slice(0, 200);
  return result.length > 0 ? result : 'datei';
}

function safeMessageId(raw: unknown): string {
  return String(raw || 'unknown').replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 100);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!istAutorisiert(req)) {
    console.warn('⛔ Inbound-Proxy: nicht autorisierter Request');
    return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try {
    payload = await req.json();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unbekannt';
    return new Response(JSON.stringify({ error: `Invalid JSON: ${msg}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!VERCEL_INBOUND_URL) {
    console.error('Inbound-Proxy: VERCEL_INBOUND_URL fehlt');
    return new Response(JSON.stringify({ error: 'Proxy nicht konfiguriert' }), {
      status: 500,
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // CRITICAL: bei Forward-Mails (Owner forwarded info@firma.de →
  // <slug>@kunden.auftragswerk.app) setzt Postmark `To` auf den ORIGINAL-
  // Empfänger der Mail (info@firma.de). Forward-Adresse liegt in
  // `OriginalRecipient`. Muss priorisiert werden, sonst greift der
  // Betriebs-Lookup für inbound_email nicht (siehe gleicher Fix in
  // app/api/inbound/route.ts).
  const toEmail: string =
    payload.OriginalRecipient ||
    payload.ToFull?.[0]?.Email ||
    payload.To ||
    '';
  let betriebId: string | null = null;
  if (toEmail) {
    const { data: betrieb } = await supabase
      .from('betriebe')
      .select('id')
      .eq('inbound_email', toEmail)
      .maybeSingle();
    betriebId = (betrieb?.id as string) || null;
  }

  const attachments = Array.isArray(payload.Attachments) ? payload.Attachments : [];
  const messageIdSafe = safeMessageId(payload.MessageID);
  let uploaded = 0;
  let failed = 0;

  // Nur uploaden wenn wir den Betrieb kennen (sonst kann Vercel-Route die
  // Mail eh nicht zuordnen → wir leiten die Payload weiter, sie wird dort
  // mit 404 abgewiesen). Anhänge dürfen drinbleiben oder rausfliegen – wir
  // lassen sie inline, damit Vercel den Fall sauber loggen kann (Payload
  // ist meist klein weil eh kein matchender Betrieb existiert).
  if (betriebId && attachments.length > 0) {
    for (const att of attachments) {
      // CRITICAL: bei JEDEM Pfad muss att.Content am Ende weg – sonst leakt die
      // base64-Payload weiter zu Vercel, sprengt das 4.5 MB-Limit, 413,
      // Postmark-Retry-Loop, Anfrage kommt nie an.
      try {
        if (!att.Content) continue;
        const safeName = sanitizeFilename(att.Name);
        const path = `${betriebId}/inbound/${messageIdSafe}/${crypto.randomUUID()}_${safeName}`;

        // base64 → Bytes (Deno-konform, ohne Node Buffer)
        const binary = atob(att.Content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const { error: uploadError } = await supabase.storage
          .from('anhaenge')
          .upload(path, bytes, {
            contentType: att.ContentType || 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) {
          console.error(`Proxy-Upload fehlgeschlagen (${att.Name}):`, uploadError.message);
          // Content trotzdem entfernen + Failure-Marker setzen, damit Vercel
          // den Fehler loggen kann ohne dass die Payload explodiert.
          att._upload_failed = true;
          att._upload_error = uploadError.message;
          delete att.Content;
          failed++;
          continue;
        }

        // base64 raus, Storage-Pfad rein – Payload schrumpft drastisch
        att._storage_path = path;
        delete att.Content;
        uploaded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unbekannt';
        console.error(`Proxy-Anhang-Fehler (${att?.Name}):`, msg);
        // Wenn der catch-Pfad erreicht wird, ist Content evtl. noch da → raus damit.
        if (att) {
          att._upload_failed = true;
          att._upload_error = msg;
          delete att.Content;
        }
        failed++;
      }
    }
  }

  console.log(
    `📩 Proxy: betrieb=${betriebId ?? 'unknown'}, anhänge=${attachments.length}, uploaded=${uploaded}, failed=${failed}`
  );

  // "Lite" Payload an Vercel weiterleiten – mit gleichem Basic-Auth.
  // Timeout 25s damit der Deno-Edge nicht unkontrolliert hängt wenn Vercel down
  // ist (Postmark würde sonst auf Postmark-Side timeouten und retrien → Loop).
  const credentials = btoa(`${INBOUND_WEBHOOK_USER}:${INBOUND_WEBHOOK_PASS}`);
  let vercelRes: Response;
  try {
    vercelRes = await fetch(VERCEL_INBOUND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unbekannt';
    const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
    console.error(
      `Proxy-Forward an Vercel ${isTimeout ? 'TIMEOUT' : 'fehlgeschlagen'}:`,
      msg
    );
    return new Response(
      JSON.stringify({ error: `Forward ${isTimeout ? 'timeout' : 'fehlgeschlagen'}: ${msg}` }),
      { status: 502 }
    );
  }

  const responseBody = await vercelRes.text();
  return new Response(responseBody, {
    status: vercelRes.status,
    headers: {
      'Content-Type': vercelRes.headers.get('content-type') ?? 'application/json',
    },
  });
});
