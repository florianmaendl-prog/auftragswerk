# Auftragswerk – System-Inventur

> **Stand: 24.5.2026 (Tag 13 – Abend)**
> Aktueller Referenz-Snapshot. Jeder neue Claude/Entwickler liest das + BACKLOG.md.

---

## 🌍 Live-System

| Komponente | Wert |
|---|---|
| Domain | https://auftragswerk.app (apex 307→`www.auftragswerk.app` – Webhooks immer auf `www`) |
| DNS-Provider | united-domains |
| Hosting | Vercel (flo-maendl-s-projects/auftragswerk) |
| Datenbank | Supabase (Project-Ref `lfziiallrfnrzbgatrml`) |
| Storage-Bucket | `anhaenge` (privat, RLS via service-role) |
| Edge Function | Supabase: `inbound-proxy` (Deno) – Postmark-Webhook-Vorsatz |
| Mail-Service | Postmark (Server 19265866) |
| GitHub | florianmaendl-prog/auftragswerk |
| Anthropic Account | florian.maendl@gmx.de |

---

## 📊 Datenbank (Tabellen)

| Tabelle | Zweck |
|---|---|
| `anfragen` | Hauptobjekt: jede eingegangene Mail = 1 Anfrage |
| `betriebe` | Multi-Tenant: jeder Handwerker = 1 Betrieb (+ Sender-Signature + Stundensatz) |
| `entwuerfe` | KI-generierte Antwort-Entwürfe (1:1 zu Anfrage) |
| `nachrichten` | Mail-Thread: alle Mails einer Anfrage (eingehend + ausgehend) |
| `analysen` | KI-Klassifikations-Ergebnisse (inkl. `extrahierter_termin` JSONB) |
| `anhaenge` | Datei-Anhänge (Inbound + Outbound), verlinkt auf `storage_path` im Bucket |
| `termine` | Aufmaß-/Vor-Ort-Termine (status-getrieben, optional ohne Anfrage) |
| `verfuegbarkeit_regel` | Wiederkehrende Verfügbarkeit (Mo-So × Uhrzeit-Range) pro Betrieb |
| `verfuegbarkeit_sperre` | Einmalige Sperren (Urlaub, fester Termin) |
| `ai_runs` | Audit-Log aller KI-Aufrufe |
| `processing_errors` | Fehler-Log (Klassifikation, Entwurf, Storage-Upload) – sichtbar in `/dashboard/diagnose` |
| `feedback` | User-Feedback (ungenutzt) |
| `angebote` | LEER – Säule-2-Migration im Repo, nicht ausgeführt |
| `profiles` | User-Profile (Auth) – linkt auth.user.id ↔ betrieb_id ↔ rolle |

### Wichtige Spalten

**`anfragen`**: `id`, `betrieb_id`, `kanal`, `von_email`, `von_name`, `betreff`,
`body_text`, `body_text_clean`, `body_html`, `created_at`/`empfangen_am`, `status`,
`geloescht_am` (Soft-Delete), `raw_payload`

**`betriebe`** (~22 Spalten): Stammdaten (`name`, `inhaber`, `branche`, `region`,
`mindestauftragswert`, `was_wir_machen`, `was_wir_nicht_machen`, `ton_beispiele`,
`signatur`), Mail (`inbound_email`, `sender_email`, `sender_name`, `sender_domain`,
`sender_verified`, `postmark_signature_id`, `sender_dns_records`), Kalkulation
(`stundensatz`)

**`anhaenge`**: `id`, `nachricht_id`, `betrieb_id`, `dateiname`, `content_type`,
`groesse_bytes`, `storage_path`

**`termine`**: `id`, `anfrage_id` (NULLABLE für Standalone), `betrieb_id`, `datum`
(timestamptz UTC), `dauer_min`, `ort`, `notiz`, `status`

**`verfuegbarkeit_regel`**: `id`, `betrieb_id`, `wochentag` (1=Mo … 7=So),
`start_uhrzeit`, `ende_uhrzeit`, `aktiv`

**`verfuegbarkeit_sperre`**: `id`, `betrieb_id`, `datum_von`, `datum_bis`, `grund`

**`analysen`**: alle KI-Output-Felder inkl. `extrahierter_termin JSONB`
(`{ datum_iso, ort, notiz }`) seit Modul 6

---

## 🚦 Status-Werte

### Anfrage-Status
| Status | Bedeutung |
|---|---|
| `neu` | Frisch eingegangen, noch nicht klassifiziert |
| `entwurf_bereit` | KI hat Entwurf gebaut, warten auf Freigabe |
| `manuell_pruefen` | KI unsicher / passt_nicht – Max entscheidet selbst |
| `info` | Rechnung/Bestellung/Innung – nur zur Kenntnis |
| `aussortiert` | Werbung/Spam |
| `versendet` | Mail wurde rausgeschickt |
| `reply_eingegangen` | Kunde hat geantwortet |
| `erledigt` | Abgeschlossen, archiviert |

Soft-Delete via `geloescht_am = NOW()` → Papierkorb.

### Termin-Status
`vorgeschlagen` → `bestaetigt` → `absolviert` / `abgesagt`

---

## 📁 Code-Struktur

### API-Endpoints (Backend)
```
app/api/
├── inbound/route.ts          Postmark-Webhook (über Edge-Proxy vorgereicht)
│                              – Threading, Klassifikation, Entwurf, Anhänge-Link
├── versand/route.ts          Entwurf freigeben + Postmark-Send
├── versand/manuell/route.ts  Manuelle Antwort (ohne Entwurf)
├── anfragen/[id]/route.ts    PATCH Status / DELETE Soft-Delete
├── betriebe/[id]/route.ts    Betriebsprofil-Update
├── termine/route.ts          POST (vorschlagen/festmachen) + PATCH (bestätigen/bearbeiten/absagen)
├── verfuegbarkeit/regel/...  POST + DELETE
├── verfuegbarkeit/sperre/... POST + DELETE
├── health/route.ts           System-Status
├── test-*/route.ts           Dev-Tools (Cleaner, Klassifikation, Entwurf)
└── auth/callback/route.ts    Supabase Auth Callback
```

### Supabase Edge Functions
```
supabase/functions/
└── inbound-proxy/index.ts    Postmark-Vorsatz, lädt Anhänge in Storage,
                              forwarded "lite" Payload an Vercel /api/inbound
```

### Frontend (Dashboard)
```
app/dashboard/
├── page.tsx                          Inbox: 3 Gruppen × Tabs + Mini-Stat-Bar
├── layout.tsx + dashboard-shell.tsx  Sidebar + Mobile-Menü
├── anfrage-quick-menu.tsx
├── anfragen/[id]/
│   ├── page.tsx                      Detail-View
│   ├── detail-actions.tsx
│   ├── entwurf-editor.tsx            KI-Entwurf bearbeiten + Datei-Upload
│   ├── reply-editor.tsx              Manuelle Antwort + Datei-Upload
│   └── termin-card.tsx               Termin-Vorschlag/Festmachen + KI-Auto-Extract
├── kunden/                           Mini-CRM
│   ├── page.tsx                      Liste (aggregiert per von_email)
│   └── [email]/page.tsx              Detail mit Anfragen-Historie
├── termine/page.tsx                  Übersicht Kommende + Vergangene
├── kalender/                         Wochen-Verfügbarkeits-Grid
│   ├── page.tsx
│   ├── wochengrid.tsx                Click-to-Edit auf jeder Zelle
│   ├── regel-editor.tsx              Multi-Day-Regel-Editor
│   └── sperre-editor.tsx
├── diagnose/page.tsx                 processing_errors-Liste (per Betrieb)
├── papierkorb/page.tsx + actions
├── profil/page.tsx + form
└── (login/passwort-*/page.tsx)
```

### Helper-Library
```
lib/
├── claude.ts          Anthropic API Client (Sonnet 4.6 + Haiku)
├── klassifikation.ts  KI-Klassifikator (Haiku) – extrahiert auch Termin-Daten
├── entwurf.ts         KI-Entwurfsgenerator (Sonnet 4.6) – Thread-Kontext bei Replies
├── mail-cleaner.ts    Body-Bereinigung (Quotes/Signatur/Disclaimer)
├── postmark.ts        Postmark Outbound (Custom Sender + Attachments)
├── postmark-sender.ts Postmark Sender-Signature API (Onboarding-Vorbereitung)
├── anhaenge.ts        Storage-Upload (speichereAnhang) + Verlinken (verlinkeAnhang)
├── datetime.ts        Europe/Berlin Helpers (date-fns-tz) – Termin-TZ-Konsistenz
├── files.ts           Client-side File→base64 für Editor-Uploads
├── supabase-*.ts      Supabase Clients (Browser + Server)
└── utils.ts           cn() helper
```

---

## 🎨 UI-Features (live)

### Inbox (`/dashboard`)
- 3 Gruppen × 7 Tabs (Zu tun: Freigabe / Manuell / Kunde geantwortet; Verfolgen: Versendet / Info; Archiv: Erledigt / Aussortiert)
- **Mini-Stat-Bar oben**: "Heute: N neue · M Replies · K aussortiert · Diese Woche: …"
- Counter pro Tab + Gruppe

### Anfrage-Detail
- Konversations-Thread links (Mail-Cleaner-bereinigt)
- KI-Analyse-Block (zeigt latest Analyse, nicht random)
- **TerminCard rechts oben**: vier Zustände (bestätigt / KI-Hinweis-Banner / vorgeschlagene / leer + Direkt-Festmachen)
- Entwurf-Editor + Reply-Editor mit Datei-Upload (max 25 MB pro Anhang)
- Anhang-Anzeige pro Nachricht: Bild-Thumbnails + Download-Buttons via signed URLs
- Kunden-Hinweis "X weitere Anfragen von diesem Kunden →"

### Kunden (Mini-CRM)
- Liste: einzigartige Absender, aggregiert nur über `kategorie='kundenanfrage'`-Analysen
- Detail: alle Kundenanfragen chronologisch + extrahierte Stammdaten

### Kalender
- Wochengrid Mo-So × 7-19 Uhr in **Europe/Berlin**
- Klick auf jede Zelle öffnet Aktions-Dialog je nach Status:
  - Leer: Regel / Sperre / Termin anlegen
  - Grün (Regel): Termin / Sperre / Regel löschen
  - Rot (Sperre): Termin trotzdem / Sperre löschen
  - Blau (Termin): Bearbeiten / Absagen / Zur Anfrage
- Standalone-Termine möglich (ohne Anfrage)
- Regel-Editor mit Multi-Wochentag-Toggle

### Termine-Übersicht
- Liste Kommende + Vergangene, abgesagte ausgeblendet
- Klick → zur zugehörigen Anfrage (falls verknüpft)

### Diagnose
- `processing_errors` gefiltert auf Betrieb, neueste zuerst
- Schritt-Badges (farbcodiert), Details ausklappbar, Link zur Anfrage

### Profil
- Stammdaten, Tonbeispiele, Signatur, Was wir (nicht) machen, Stundensatz

### Allgemein
- Sidebar: Inbox / Kunden / Termine / Kalender / Profil + Utility: Diagnose / Papierkorb
- Mobile-Hamburger
- Doppelklick-Schutz an Send-Buttons
- **KEIN** Confirm-Popup beim Senden (Gmail-Stil)

---

## 📨 Mail-Pipeline (Tag 13)

### Inbound (Empfang)
```
Postmark Inbound (Hex-Adresse 22410d58…@inbound.postmarkapp.com)
   ↓ webhook POST mit Basic-Auth
Supabase Edge Function (inbound-proxy)
   – Body bis ~25 MB OK
   – Lädt Anhänge → Storage-Bucket 'anhaenge' (<betrieb_id>/inbound/<msgId>/...)
   – Ersetzt Content (base64) durch _storage_path
   ↓ forward POST mit gleichem Basic-Auth
Vercel /api/inbound (www.auftragswerk.app)
   – Body jetzt klein (< 4.5 MB)
   – Findet Betrieb via inbound_email, Threading via References+In-Reply-To
   – Klassifikation (Haiku) → Entwurf (Sonnet 4.6) → DB
   – Anhänge: verlinkt zu nachricht_id (kein Re-Upload)
```

### Outbound (Versand)
```
Vercel /api/versand oder /api/versand/manuell
   – Body: entwurf_id, anhaenge[] (vom Editor-Upload, base64)
   – Wählt From-Adresse:
       betrieb.sender_verified=true → betrieb.sender_email
       sonst → POSTMARK_FROM_EMAIL (info@auftragswerk.app)
   – Eigene UUID-Message-ID erzeugt, gegen Postmarks gemeingelegtes
     mtasv-rewriting → garantiertes Threading
   – Anhänge inline an Postmark übergeben + danach in 'anhaenge' verlinkt
```

### Auth-Magic-Links
Postmark SMTP (`smtp.postmarkapp.com:587`), From: `noreply@auftragswerk.app`

---

## 🛠 Iron Rules / Verhaltensweisen

Nicht verlieren beim Refactoring:

1. **Versand: KEIN Confirm-Dialog** — direkt senden, wie Gmail
2. **Doppelklick-Schutz** an allen Send-Buttons (isLoading-Guards)
3. **KI baut Entwurf für ALLE Kundenanfragen** — auch passt_nicht, unklar
4. **Bei Status `versendet`** → Reply-Editor heißt "Weitere Nachricht senden"
5. **Reply-To-Header** immer gesetzt = `betrieb.inbound_email`
6. **References-Header** beim Versenden setzen + beim Empfangen parsen
7. **Eigene UUID-Message-ID** beim Versand (lib/postmark.ts) – garantiertes Threading
8. **body_text_clean** bei der KI verwenden (Mail-Cleaner läuft **immer**)
9. **Eine Anfrage** kann N `nachrichten` haben (Conversation)
10. **Alle Termin-Zeiten in `Europe/Berlin`** — Eingabe (datetime-local), Anzeige, Cell-Math. Helpers in `lib/datetime.ts`. **NIEMALS** `new Date(localString)` direkt – das interpretiert in Runtime-TZ (UTC auf Server, Browser-TZ auf Client) und produziert verschobene Termine bei Reise-/Multi-TZ-Setups.
11. **Inbound geht nur über den Edge-Proxy** – NICHT direkt auf Vercel zeigen lassen, sonst 4.5 MB-Limit
12. **`sender_verified=false`** → Fallback auf `info@auftragswerk.app`. Vor Pilot-Live für jeden Betrieb DKIM einrichten, sonst Iron-Rule-Verstoß "Auftragswerk niemals sichtbar für Endkunde".
13. **KI Mitbringsel-Regel** — keine generischen "Musterprofile mitbringen"-Vorschläge mehr (siehe MITBRINGSEL-Block in `lib/entwurf.ts`-System-Prompt)
14. **Kunden-Aggregation** nur über `kategorie='kundenanfrage'`-Analysen — Werbung/Rechnung-Mails desselben Absenders fließen nicht in Stammdaten ein
15. **Magic-Link Mails** kommen von `noreply@auftragswerk.app`
16. **Reguläre Mails (Fallback)** kommen von `info@auftragswerk.app`

---

## 🔧 Vercel Env-Vars (Production)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
NEXT_PUBLIC_APP_URL                 = https://auftragswerk.app
POSTMARK_SERVER_TOKEN
POSTMARK_ACCOUNT_TOKEN              ← für Sender-Signature-API (postmark-sender.ts)
POSTMARK_FROM_EMAIL                 = info@auftragswerk.app
POSTMARK_FROM_NAME                  = Auftragswerk
POSTMARK_REPLY_TO                   = 22410d58…@inbound.postmarkapp.com
INBOUND_WEBHOOK_USER                = postmark
INBOUND_WEBHOOK_PASS                = c01e1fe5… (Basic-Auth-Secret)
```

## 🔧 Supabase Edge Function Env-Vars (`inbound-proxy`)
```
INBOUND_WEBHOOK_USER                (gleich wie Vercel)
INBOUND_WEBHOOK_PASS                (gleich wie Vercel)
VERCEL_INBOUND_URL                  = https://www.auftragswerk.app/api/inbound
SUPABASE_URL                        ← auto-injected
SUPABASE_SERVICE_ROLE_KEY           ← auto-injected
```

Setzen via CLI: `supabase secrets set --project-ref lfziiallrfnrzbgatrml ...`
oder Dashboard: Edge Functions → Secrets.

Deployment der Function:
```
supabase functions deploy inbound-proxy --no-verify-jwt --project-ref lfziiallrfnrzbgatrml
```
`--no-verify-jwt` = Function ist öffentlich, Auth machen wir selbst per Basic.

## 🌐 Postmark-Konfiguration
- Server: 19265866
- Outbound: Default Transactional Stream, Server-Token in Vercel-ENV
- Inbound: Default Inbound Stream, Webhook-URL:
  ```
  https://postmark:<PASS>@lfziiallrfnrzbgatrml.supabase.co/functions/v1/inbound-proxy
  ```
- Sender Signature für `info@bauelemente-rapp.com` angelegt – DKIM/Return-Path-Verifikation steht bei Max aus (DNS-Records bei WordPress.com)

## 🔌 DNS-Konfiguration (auftragswerk.app, united-domains)
- A `@` + `*` → 76.76.21.21 (Vercel)
- CNAME `www` → cname.vercel-dns.com
- CNAME `pm-bounces` → pm.mtasv.net (Postmark Return-Path)
- TXT `_dmarc` → `v=DMARC1; p=none; rua=mailto:florian.maendl@gmx.de`
- TXT `20260519132806pm._domainkey` → Postmark DKIM
- TXT `uddkim-202310._domainkey` → udag DKIM
- TXT root → `v=spf1 include:_smtp.udag.de ~all` (Postmark läuft per CNAME pm-bounces, SPF aktuell nur udag – nicht-blocker)

---

## 🚧 Pilot-Status (Bauelemente Rapp GmbH = "Max")

| Schritt | Status |
|---|---|
| Auth-User angelegt (info@bauelemente-rapp.com, Auto-Confirm) | ✅ UID `bee532ee-7927-43b4-b977-620d3b22d8a8` |
| `betriebe`-Zeile + `profiles`-Link | ✅ Inbound `info@bauelemente-rapp.com` |
| RLS-Policies validiert | ✅ |
| Login funktioniert | ✅ |
| Postmark Sender Signature angelegt | ✅ (Confirmed?, DKIM ❌, Return-Path ❌) |
| DKIM + Return-Path bei WordPress.com DNS | ⏳ Max |
| DMARC für bauelemente-rapp.com | ⏳ Max |
| Gmail-Weiterleitung info@bauelemente-rapp.com → Postmark | ⏳ Max |
| `UPDATE betriebe SET sender_verified=true` | ⏳ Flo (nach Max) |
| Smoke-Test A (Inbound) + B (Outbound + Threading) | ⏳ |
| Spickzettel für Max | ⏳ |

---

## 🚨 Rollback-Strategie
- Letzter Backup-Branch: `backup-vor-tag13-bugfixes` (vor Modul 7 + Bug-Fixes)
- Älterer: `backup-vor-tab-umbau` (vor Inbox-Restruktur, sehr alt)
- Rollback: `git checkout main && git reset --hard <branch> && git push --force`
- Vercel deployt auto von main → Rollback sofort wirksam
- DB-Backups: Supabase Auto täglich (Settings → Database → Backups)
- Migrationen liegen alle in `supabase/migrations/` (User führt manuell aus, nicht via CLI)

---

## 📋 Wo's weitergeht
Siehe **BACKLOG.md** für die aktuelle Roadmap (Tag-13-Stand):
- ⏳ Spickzettel für Max + Smoke-Tests, sobald er übers Wochenende meldet
- ⏸ Modul 8: Google-Calendar-OAuth-Sync (wenn manuelles Kalender-Pflegen Max nervt)
- ⏸ Säule 2 (Angebote), Phase 2 (Self-Service-Onboarding), Säule 3 (Material-Recherche)

VISION.md hat das große Bild für Komplett-Software-Endvision.
