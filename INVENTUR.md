# Auftragswerk – System-Inventur

> **Stand: 7.6.2026 abends (Tag 19 – Vision + Guardrails + Sprint 5 + Sprint 6 durch)**
>
> Tag 19 war ein massiver Push. 6 Sprints/Fixes:
> - Vision V1 (KI sieht jpg/png/webp/gif-Anhänge)
> - Inhalts-Guardrails (KI nennt nie Preise / verbindliche Zusagen)
> - Eskalations-Erkennung (Anwalt/Mängelrüge → kein Auto-Entwurf)
> - Branchen-Default-Fix (was_wir_machen ≠ exklusive Liste, Default unklar)
> - Sprint 5 (Such-Foundation + Kundenhistorie + Passt-doch-Button mit Override)
> - Sprint 6 Polish (Brand-Confirm-Dialog überall + Loading-Hint + Notiz-Feld + Stale-Indikator)
>
> Plus Hot-Fix: Owner-Override-Prompt damit „Auftrag annehmen" wirklich Zusage schreibt
> (gewerk_match=passt im Klass-Block reicht nicht – Sonnet würde sonst aus Anfrage-Text
> selbst „passt nicht" ableiten).
>
> **Vorheriger Stand:** **4.6.2026 (Tag 18 – Max-Pilot LIVE, 3 Sprints durch)**
>
> Pilot Bauelemente Rapp läuft seit Tag 18 mittags produktiv. Max hat sich
> per Self-Service (Welle G) angemeldet, Gmail verbunden, WordPress.com-
> Forward eingerichtet. **Slug: `bauelemente-rapp-2@kunden.auftragswerk.app`**
> (`-2` weil alter manuell-angelegter Account vom 21.5. den Slug
> `bauelemente-rapp` noch belegt – kann später per DELETE + UPDATE umgestellt
> werden).
>
> **Kritischer Forward-Bug-Fix am Tag 18**: Postmark übergibt bei Forward-
> Mails `To = info@firma.de` (Mail-Header-Empfänger), die Forward-Adresse
> liegt in `OriginalRecipient`. Vercel + Edge Function lesen jetzt
> `OriginalRecipient` priorisiert – Forward-Mails von ALLEN Mail-Providern
> kommen damit an.
>
> **Aktuelle Tab-Struktur Inbox**: flach, 7 Tabs gleichberechtigt
> (`Freigabe · Manuell · Reply · Versendet · Info · Erledigt · Aussortiert`).
> Gruppen-Labels gestrichen weil Owner sie nicht intuitiv versteht.
>
> Plan-File: `~/.claude/plans/sooo-lies-backlog-md-delegated-moler.md`
> + STRATEGIE.md + IDEEN-EISSCHRANK.md.

> **Vorheriger Stand:** **1.6.2026 (Tag 16 – Welle D + E + F + G durch, URL an Max raus)**
> Aktueller Referenz-Snapshot. Jeder neue Claude/Entwickler liest das + BACKLOG.md.
>
> **Welle-Stand:** A (Mobile) + B (Rechtstexte) + C (Gmail-OAuth) + D
> (Wow-Onboarding) + E.1+E.2 (Reply-To-Premium + Catch-All-Subdomain) +
> F (Mail-Empfang-Card) + G (Self-Service-Signup + Marketing-Landing +
> Custom-SMTP) komplett durch und live.
>
> **Inbound-Pfad:** Endkunde mailt an reale Geschäftsadresse →
> Owner-Forward → `<slug>@kunden.auftragswerk.app` (MX zu Postmark) →
> Postmark Inbound-Webhook → Supabase Edge-Proxy → Vercel `/api/inbound`.
>
> **Outbound-Pfad:** 3-stufig — Gmail-OAuth (`gmail.send` API) → Custom
> Postmark-Sender (sender_verified=true) → Postmark-Default
> `info@auftragswerk.app`-Fallback.
>
> **Auth-Mails:** Custom-SMTP via Postmark (smtp.postmarkapp.com:587),
> Sender `info@auftragswerk.app`, brand-konformes HTML-Confirmation-Template.
>
> **Aktuell:** Max hat URL bekommen, wartet auf Anmeldung + Real-Smoke-Test.
> Plan-File: `~/.claude/plans/sooo-lies-backlog-md-delegated-moler.md`.

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
| `gmail_connections` | Gmail-OAuth-Tokens pro Betrieb (AES-256-GCM-verschlüsselt), Scope `gmail.send`, Status aktiv/fehler/widerrufen |
| `gesperrte_sender` | Block-Liste pro Betrieb (Tag 18). RLS-geschützt. Inbound-Route Pre-Check vor KI-Klassifikation – gesperrte Sender direkt als 'aussortiert' ohne Anthropic-Call. UNIQUE(betrieb_id, email). |
| `entwuerfe.text_original` / `was_edited` | Edit-Diff Phase 1 (Tag 17). `text_original` = initialer KI-Entwurf, beim Versand mit `body_text` verglichen → `was_edited` boolean. Daraus baut Flo später ein Diagnose-View für Edit-Patterns. |
| `anfragen.notiz` | Interne Owner-Notiz (Tag 19 Sprint 6). Text, nicht in Mails sichtbar. NotizEditor in Detail-Page mit Auto-Save. |
| `analysen.eskalation_erkannt` / `eskalation_grund` | Tag 19, Inhalts-Guardrails. Haiku flaggt Anwalt/Mängelrüge/Drohung. Inbound skipped Auto-Entwurf bei true. |
| `ai_runs` | Audit-Log aller KI-Aufrufe |
| `processing_errors` | Fehler-Log (Klassifikation, Entwurf, Storage-Upload) – sichtbar in `/dashboard/diagnose` |
| `feedback` | User-Feedback (ungenutzt) |
| `angebote` | LEER – Säule-2-Migration im Repo, nicht ausgeführt |
| `profiles` | User-Profile (Auth) – linkt auth.user.id ↔ betrieb_id ↔ rolle |

### Wichtige Spalten

**`anfragen`**: `id`, `betrieb_id`, `kanal`, `von_email`, `von_name`, `betreff`,
`body_text`, `body_text_clean`, `body_html`, `created_at`/`empfangen_am`, `status`,
`geloescht_am` (Soft-Delete), `raw_payload`

**`betriebe`** (~25 Spalten): Stammdaten (`name`, `inhaber`, `branche`, `region`,
`mindestauftragswert`, `was_wir_machen`, `was_wir_nicht_machen`, `wichtige_kunden`,
`ton_beispiele`, `signatur`, `vermeiden` *(Tag 17, freitext-block für negative
Stil-Constraints)*, `gebiete` jsonb *(Tag 18, Array<{plz_muster, label,
mindestauftragswert}> für gebiets-abhängige Mindestaufträge)*), Mail
(`inbound_email` = `<slug>@kunden.auftragswerk.app` **seit Welle E.2**,
`sender_email`, `sender_name`, `sender_domain`, `sender_verified`,
`postmark_signature_id`, `sender_dns_records`), Kalkulation (`stundensatz`).
UNIQUE-Index auf `inbound_email` seit Migration
`20260601_inbound_email_subdomain.sql`.

**`anfragen.notiz`** *(Tag 19, Sprint 6)* – freie Owner-Notiz pro Anfrage
(intern, nicht in Mails sichtbar). Für Telefonat-Erinnerungen, Kunden-Eigenheiten.
Auto-Save beim Blur via NotizEditor in Anfrage-Detail.

**`analysen.eskalation_erkannt` + `analysen.eskalation_grund`** *(Tag 19)* –
Haiku setzt true bei Anwalt/Mängelrüge/Drohung. Inbound-Pipeline skipped dann
Auto-Entwurf, Status manuell_pruefen, Eintrag in processing_errors.

**`profiles`**: `id` (= auth.users.id, PK), `betrieb_id`, `rolle` (`'inhaber'`
ist Default bei Self-Service-Signup; weitere Rollen für Multi-User später).
Wird seit Welle G automatisch durch DB-Trigger `handle_new_user()` beim Signup
angelegt, nicht mehr manuell.

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
│                              – Idempotenz (Pre-Check + UNIQUE), KI-Cap (50/h),
│                                Threading, Klassifikation, Entwurf, Anhänge-Link
├── versand/route.ts          Entwurf freigeben + Send
│                              – Status-Lock entwurf_bereit→in_versand→versendet
│                              – 3-stufige From-Wahl: Gmail (OAuth) → Custom
│                                Sender (Postmark) → Postmark-Default-Fallback
├── versand/manuell/route.ts  Manuelle Antwort (ohne Entwurf)
│                              – 5s-zeitbasierter Doppelklick-Schutz
│                              – gleiche 3-stufige From-Wahl
├── auth/google/start/        OAuth-Start: CSRF-State-Cookie,
│   route.ts                  redirect zu Google Consent (gmail.send scope,
│                              access_type=offline + prompt=consent für
│                              refresh_token)
├── auth/google/callback/     OAuth-Callback: state-check, code→token-tausch,
│   route.ts                  id_token→email, encrypt + UPSERT in gmail_
│                              connections, redirect zu /dashboard/profil
│                              ?gmail=connected|error&detail=...
├── auth/google/disconnect/   POST: best-effort google-revoke + DB-delete
│   route.ts
├── anfragen/[id]/route.ts    PATCH Status / DELETE Soft-Delete
├── betriebe/[id]/route.ts    Betriebsprofil-Update
├── termine/route.ts          POST (vorschlagen/festmachen) + PATCH (bestätigen/
│                              bearbeiten/absagen) – Datum-Validation (2020-+5y)
├── verfuegbarkeit/regel/...  POST + DELETE
├── verfuegbarkeit/sperre/... POST + DELETE
├── health/route.ts           System-Status
└── auth/callback/route.ts    Supabase Auth Callback
```
**WICHTIG:** Die `test-*`-Routes (test-cleaner / test-entwurf /
test-klassifikation) sind in Tag 14 komplett entfernt worden — sie waren
public ohne Auth-Check und hätten beliebige Anfragen lesen + Anthropic-
Kosten auslösen können. Nicht wieder einführen!

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
│                                     (Tab-Fade-Scroll-Hint auf Mobile)
├── layout.tsx + dashboard-shell.tsx  Sidebar + Mobile-Menü (sticky Header,
│                                     44×44 Hamburger, Mini-Footer mit
│                                     Rechtstexte-Links)
├── anfrage-quick-menu.tsx            Trigger 44×44 auf Mobile
├── anfragen/[id]/
│   ├── page.tsx                      Detail-View (responsive Grids, stack-
│                                     Header auf Mobile, attachments full-
│                                     width unter sm)
│   ├── detail-actions.tsx            flex-wrap, kurze Labels auf Mobile
│   ├── entwurf-editor.tsx            KI-Entwurf bearbeiten + Datei-Upload
│   ├── reply-editor.tsx              Manuelle Antwort + Datei-Upload
│   └── termin-card.tsx               Termin-Vorschlag/Festmachen + KI-Auto-Extract
├── kunden/                           Mini-CRM
│   ├── page.tsx                      Liste (aggregiert per von_email)
│   └── [email]/page.tsx              Detail mit Anfragen-Historie
├── termine/page.tsx                  Übersicht Kommende + Vergangene
├── kalender/                         Wochen-Verfügbarkeits-Grid
│   ├── page.tsx                      Nav stack-mobile, Empty-State wenn 0 Regeln
│   ├── wochengrid.tsx                **Zweispur:** md+ 7-Spalten-Table,
│   │                                 <md vertikale Tag-Liste mit Stunden-
│   │                                 Cards (gemeinsamer getSlotData-Helper).
│   │                                 Click-to-Edit auf jeder Zelle.
│   ├── regel-editor.tsx              Multi-Day-Regel-Editor
│   └── sperre-editor.tsx
├── diagnose/page.tsx                 processing_errors-Liste (per Betrieb)
├── papierkorb/page.tsx + actions     flex-col sm:flex-row Cards
├── profil/page.tsx + form
└── (login/passwort-*/page.tsx)
```

### Standalone-Pages (außerhalb Dashboard, ohne Login)
```
app/
├── page.tsx               **Marketing-Landing** (Welle G). Eingeloggte
│                          User → redirect /dashboard. Sonst: Hero +
│                          Problem (3 Cards) + Lösung (3 Cards) + 3
│                          Onboarding-Schritte + Für-Wen (Gewerk-Pills)
│                          + CTA + Footer. Brand-DNA: Saira Condensed,
│                          Stahlblau, hugeicons. KEIN Pricing (Pilot).
├── registrieren/page.tsx  **Self-Service-Signup** (Welle G). Form mit
│                          Email/Passwort/Betriebsname/Inhaber/Branche.
│                          Ruft supabase.auth.signUp mit emailRedirectTo
│                          + options.data → DB-Trigger handle_new_user
│                          legt betriebe + profiles automatisch an.
│                          Nach Submit: "Fast geschafft"-Screen.
├── datenschutz/page.tsx   DSGVO-Standard-Template (in jur. Prüfung).
│                          Verantwortlicher, Subprocessors, Speicherdauer,
│                          Betroffenenrechte, AES-256-GCM-Token-Block.
├── agb/page.tsx           SaaS-Standard nur für Unternehmer §14 BGB,
│                          KI-Haftungs-Ausschluss bei ungeprüften Entwürfen,
│                          14-Tage-Kündigung. (in jur. Prüfung)
├── impressum/page.tsx     TMG §5, Anschrift in [Klammern] als Platzhalter
│                          (vor produktiv-Pilot durch echte Adresse ersetzen).
├── login/page.tsx         Wortmarke + Karte, Footer mit Rechtstexte-Links.
│                          "Noch keinen Account? Jetzt anmelden"-Link auf
│                          /registrieren (Welle G).
├── passwort-vergessen/    Reset-Flow → Supabase resetPasswordForEmail
├── passwort-neu/          Reset-Landing nach Klick im Reset-Mail
└── auth/callback/route.ts Supabase Auth Callback – verifyOtp + Code-Exchange
```

### Helper-Library
```
lib/
├── claude.ts          Anthropic API Client (Sonnet 4.6 + Haiku)
├── klassifikation.ts  KI-Klassifikator (Haiku) – extrahiert auch Termin-Daten
├── entwurf.ts         KI-Entwurfsgenerator (Sonnet 4.6) – Thread-Kontext bei Replies
├── mail-cleaner.ts    Body-Bereinigung (Quotes/Signatur/Disclaimer)
├── postmark.ts        Postmark Outbound (Custom Sender + Attachments + References-Cap auf 10)
├── postmark-sender.ts Postmark Sender-Signature API (Onboarding-Vorbereitung)
├── anhaenge.ts        Storage-Upload (speichereAnhang) + Verlinken (verlinkeAnhang)
│                      – mit Orphan-Cleanup bei Insert-Fail
├── datetime.ts        Europe/Berlin Helpers (date-fns-tz) – Termin-TZ-Konsistenz
├── files.ts           Client-side File→base64 + validateAttachments (Size+MIME)
├── verfuegbarkeit.ts  getFreieSlots – wirft jetzt bei DB-Fehlern statt []
├── crypto.ts          **AES-256-GCM Token-Verschlüsselung** (Welle C) – Format
│                      `<iv>.<authTag>.<ciphertext>` base64. Key aus
│                      TOKEN_ENCRYPTION_KEY env (32 Bytes base64). DSGVO-kritisch.
├── gmail.ts           **Gmail-OAuth Outbound** (Welle C) – getValidAccessToken
│                      mit Auto-Refresh (60s-Puffer), sendeViaGmail mit
│                      RFC822-MIME-Bau (text/plain oder multipart/mixed
│                      mit Anhängen), 401→force-refresh-retry, 4xx→
│                      status='fehler'+shouldFallback=true.
├── slug.ts            **Slug-Generator für Subdomain-Adressen** (Welle E.2) –
│                      nameZuSlug() (Umlaute, Stoppwörter, max 40 Zeichen),
│                      generiereEindeutigenSlug() mit Conflict-Resolution,
│                      KUNDEN_SUBDOMAIN const. Spiegelt PL/pgSQL
│                      name_zu_slug() aus Migration.
├── supabase-*.ts      Supabase Clients (Browser + Server) + supabaseAdmin
│                      (Service-Role, nur Server-Side!)
└── utils.ts           cn() helper
```

### Brand-Komponenten
```
components/brand/
├── wortmarke.tsx        "AUFTRAGSWERK"-Display in Saira Condensed, 3 Größen
│                        (sm/md/lg), optional mit Tagline "Assistenz, die mitdenkt."
├── kategorie-badge.tsx  Visualisiert analysen.kategorie + gewerk_match als
│                        Handlungsanweisung-Pill (Anfrage/Prüfen/Info/Passt nicht/
│                        Aussortiert) – keine Hoch/Mittel/Niedrig-Skala
├── empty-state.tsx      Einheitlicher Empty-State (Icon im Hellgrau-Kreis +
│                        Title + Subtext + optionale CTA). tone="default"
│                        (stahlblau) oder tone="success" (grün, "leer ist gut")
├── footer.tsx           Dezenter Footer mit Datenschutz/AGB/Impressum-Links
│                        + Copyright. Auf Mobile flex-col, Desktop flex-row.
└── onboarding-step.tsx  **Welle D** – Status-Card pro Wow-Onboarding-Schritt
                         (Nummer 01-03 + Icon + Titel + Text + CTA-Button +
                         Done-Checkmark wenn erledigt).
```

### Dashboard – Welle D + F
```
app/dashboard/
├── willkommen/page.tsx           **Wow-Onboarding** (Welle D). Hero +
│                                 dynamische "Hi {Vorname},"-Anrede, 3
│                                 OnboardingStep-Cards mit Server-side
│                                 Status-Detection (gmail / verfügbarkeit /
│                                 profil), 0/3-Pill, alleDone-Banner.
└── profil/
    ├── page.tsx                  Server Component, fetcht betrieb + gmailConn
    │                             parallel, rendert GmailConnectionCard +
    │                             MailEmpfangCard + ProfilForm.
    ├── profil-form.tsx           Was-wir-machen/-nicht, Wichtige Kunden,
    │                             Stilbeispiele, Signatur, Stundensatz, …
    ├── gmail-connection-card.tsx **Welle C** – 3 Zustände (nicht verbunden /
    │                             aktiv / fehler-widerrufen), URL-Param-
    │                             Toast nach OAuth-Callback. Welle F hat
    │                             die alte Filter-Anleitung entfernt
    │                             (obsolet nach Subdomain).
    └── mail-empfang-card.tsx     **Welle F** – Inbound-Adresse + Copy-Button,
                                  dismissable Amber-Hinweis,
                                  Provider-Akkordeon (Workspace/IONOS/
                                  WordPress/Allgemein) mit Klick-für-Klick-
                                  Forward-Anleitung.
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
- Sidebar mit "AUFTRAGSWERK"-Wortmarke (Saira Condensed) + Tagline oben
- Nav: Inbox / Kunden / Termine (TimeScheduleIcon) / Kalender (Calendar02Icon)
  / Profil + Utility: Diagnose / Papierkorb. **Alle Icons via hugeicons**,
  keine UI-Emojis mehr.
- Mobile-Hamburger
- Doppelklick-Schutz an Send-Buttons (client + server: Status-Lock im
  Entwurf-Versand, 5s-zeitbasiert im Manuell-Versand)
- **KEIN** Confirm-Popup beim Senden (Gmail-Stil)
- Page-Headlines durchgängig in `font-heading uppercase tracking-wide`
  (außer User-Content wie Mail-Betreff / Kunden-Name)

---

## 📨 Mail-Pipeline (Tag 16 nach Welle E.2)

### Inbound (Empfang)
```
Endkunde mailt an reale Geschäftsadresse (info@dein-betrieb.de)
   ↓ Owner-Forward (einmalig in seinem Provider eingerichtet, siehe
     Mail-Empfang-Card-Anleitung)
<slug>@kunden.auftragswerk.app  (MX → Postmark)
   ↓ Postmark Inbound matcht auf die Subdomain-Adresse
Postmark Inbound (Wildcard-Route auf kunden.auftragswerk.app)
   ↓ webhook POST mit Basic-Auth
Supabase Edge Function (inbound-proxy)
   – Body bis ~25 MB OK
   – Lädt Anhänge → Storage-Bucket 'anhaenge' (<betrieb_id>/inbound/<msgId>/...)
   – Ersetzt Content (base64) durch _storage_path
   ↓ forward POST mit gleichem Basic-Auth
Vercel /api/inbound (www.auftragswerk.app)
   – Body jetzt klein (< 4.5 MB)
   – Findet Betrieb via betriebe.inbound_email (= slug@kunden.auftragswerk.app)
   – Threading via References + In-Reply-To
   – Klassifikation (Haiku) → Entwurf (Sonnet 4.6) → DB
   – Anhänge: verlinkt zu nachricht_id (kein Re-Upload)
```

### Outbound (Versand) – 3-stufig (Welle C + E.1)
```
Vercel /api/versand oder /api/versand/manuell
   – Body: entwurf_id, anhaenge[] (vom Editor-Upload, base64)
   – Wählt From-Adresse (Reihenfolge nicht ändern — Iron Rule 25):
       1. gmail_connections.status='aktiv' → sendeViaGmail() (lib/gmail.ts)
          → Mail kommt aus echter Gmail-Adresse des Inhabers
          → Iron Rule "Auftragswerk nie sichtbar" erfüllt
          → Bei 4xx (shouldFallback=true) → Step 2 oder 3
       2. betrieb.sender_verified=true → lib/postmark.ts mit Custom-Sender
       3. Default → POSTMARK_FROM_EMAIL (info@auftragswerk.app)
   – Reply-To-Hierarchie (Welle E.1):
       betrieb.inbound_email (= slug@kunden.auftragswerk.app)
         || betrieb.sender_email (wenn useCustomSender)
         || POSTMARK_REPLY_TO env-fallback
   – Eigene UUID-Message-ID erzeugt, garantiertes Threading
   – Anhänge inline + danach in 'anhaenge' verlinkt
```

### Auth-Mails – Custom-SMTP via Postmark (Welle G)
```
Supabase Auth (Signup, Password-Reset, Magic-Link, Email-Change)
   ↓ SMTP-Submit
smtp.postmarkapp.com:587 (auth via Server-Token als Username+Password)
   – Sender: info@auftragswerk.app, Name: "Auftragswerk"
   – Min interval 60s (Rate-Limit-Schutz)
   – Email-Confirmation aktiv (Doppel-Opt-In)
   – Template (Confirm-Signup): brand-konformes HTML mit Wortmarke,
     Stahlblau-Button, Footer mit Rechtstexte-Links
```

---

## 🛠 Iron Rules / Verhaltensweisen

Nicht verlieren beim Refactoring:

1. **Versand: KEIN Confirm-Dialog** — direkt senden, wie Gmail
2. **Doppelklick-Schutz** an allen Send-Buttons (client + server: Status-Lock
   `'in_versand'` für Entwurf-Versand, 5s-zeitbasierter Check für Manuell)
3. **KI baut Entwurf für ALLE Kundenanfragen** — auch passt_nicht, unklar
4. **Bei Status `versendet`** → Reply-Editor heißt "Weitere Nachricht senden"
5. **Reply-To-Header** immer gesetzt = `betrieb.inbound_email`
6. **References-Header** beim Versenden setzen + beim Empfangen parsen
   (Cap: max 10 IDs, sonst SMTP-Probleme bei tiefen Threads)
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
17. **Idempotenz im Inbound**: Pre-Check auf `nachrichten.message_id` VOR
    Klassifikation. UNIQUE-Index als DB-Garantie. Postmark retried bei
    Timeout, ohne diesen Schutz entstehen doppelte Entwürfe + KI-Kosten.
18. **KI-Failures landen IMMER in `processing_errors`** + Status auf
    `'manuell_pruefen'`. Nie ein 200 mit `{ klassifikation: 'fehlgeschlagen' }`
    zurückgeben ohne sichtbaren Eintrag in Diagnose.
19. **KEINE UI-Emojis** — alles via hugeicons. Konsole-Logs dürfen Emojis
    behalten (Server-side, nur in Dev-Logs sichtbar). UI = Premium-Look.
20. **Keine Hoch/Mittel/Niedrig-Prio-Skala** — Brand-Entscheidung:
    Handlungsanweisung statt Adjektiv (KategorieBadge in
    `components/brand/`).
21. **Test-Routes NIE wieder einführen ohne Auth-Check** — die alten
    `/api/test-*` waren ein direktes Sicherheits-Loch (Service-Role über
    `supabaseAdmin`, beliebige Anfragen lesbar, Anthropic-Kosten-Risiko).
22. **Mobile-First denken** — neue Pages mit `grid-cols-1 sm:grid-cols-*`,
    `flex-col sm:flex-row` Default. Container `py-6 sm:py-8 px-4 sm:px-6`.
    Touch-Targets ≥44px auf Mobile (`min-h-11`). Test in DevTools iPhone SE
    (380px) vor Push.
23. **Standard-Template-Rechtstexte sind Disclaimer-Pflicht** — solange
    der amber "in juristischer Prüfung"-Hinweis auf /datenschutz und /agb
    steht, sind das KEINE produktiv-pilot-tauglichen Texte. Vor Max-Live
    Compliance-Block durchgehen (siehe unten).
24. **OAuth-Tokens NIE plain speichern oder loggen** — `lib/crypto.ts`
    AES-256-GCM ist die einzig zulässige Speicher-Form. Niemals Tokens in
    `processing_errors.fehler_text` schreiben, in `console.log` ausgeben
    oder im response-Body zurückgeben. DSGVO-kritisch.
25. **3-stufige From-Wahl beim Versand** — `gmail_connections` aktiv →
    Gmail-API (echte Mail des Betriebs). Sonst `sender_verified` →
    Postmark Custom-Sender. Sonst → `info@auftragswerk.app`-Fallback.
    Reihenfolge in `app/api/versand/route.ts` + `versand/manuell/route.ts`
    nicht ändern – Iron-Rule "Auftragswerk nie sichtbar" hängt davon ab.
26. **Reply-To darf NIE die Postmark-Hex-Adresse für Endkunden sein** —
    sieht scammy aus. **Gelöst seit Welle E.2:** alle Betriebe haben
    `inbound_email = <slug>@kunden.auftragswerk.app`, UNIQUE-Index
    garantiert Eindeutigkeit. Reply-To-Hierarchie in versand-Routes
    nimmt diese Adresse als Primärquelle. Neue Betriebe kriegen via
    DB-Trigger `handle_new_user()` (Welle G) automatisch eine
    Subdomain-Adresse beim Signup.

27. **Self-Service-Signup-Trigger nicht entfernen** — Migration
    `20260601_signup_trigger.sql` legt `handle_new_user()` als
    AFTER-INSERT-Trigger auf `auth.users` an. Liest `raw_user_meta_data`,
    legt betriebe + profiles automatisch an. Ohne den Trigger landen
    Self-Service-User OHNE `betrieb_id` → Dashboard zeigt "Kein Betrieb
    verknüpft". Wenn DB-Reset/Restore: Trigger erneut ausführen!

28. **TOKEN_ENCRYPTION_KEY darf NIE verloren gehen** — 32 Bytes base64,
    in Vercel-Env. Verlust = alle gespeicherten gmail_connections-Tokens
    unentschlüsselbar = alle Gmail-OAuth-Verbindungen weg. Backup in
    1Password/Bitwarden Pflicht. Bei Rotation: Re-Encrypt-Migration
    nötig (gibt's noch nicht — auf später wenn relevant).

29. **Custom-SMTP via Postmark für Auth-Mails** — Supabase Auth Settings
    → Emails → SMTP. Username + Password = Postmark Server-Token (NICHT
    Account-Token). Sender `info@auftragswerk.app`. Default-Supabase-
    SMTP (2 Mails/h) ist unbrauchbar — nie zurückschalten.

30. **Vision-Limits nicht aufweichen ohne Kostenkontrolle** — `lib/bilder.ts`
    hat max 5 Bilder à 5 MB pro Anfrage. Anthropic skaliert intern auf
    1568×1568, kostet ~1.6k Tokens pro Megapixel. Wenn das Limit aufgemacht
    wird (z.B. „alle Bilder zur KI"), muss der KI-Kosten-Cap (50 Analysen/h)
    angepasst werden. Vision-Calls sind 3-5× teurer als text-only Entwürfe.

31. **Inhalts-Guardrails sind HART, nicht weich** — `lib/entwurf.ts`
    System-Prompt verbietet 6 Aussage-Typen (Preise, verbindliche Zusagen,
    technische Garantien, Norm-Werte, Schadens-Einschätzung aus Foto,
    medizinische/rechtliche/Versicherungs-Auskünfte). Diese Regeln sind
    Reputations- + Haftungs-Schutz. Bei jedem Prompt-Refactor nicht
    versehentlich weichspülen — alle 6 müssen erhalten bleiben.

32. **Eskalations-Erkennung bricht Iron Rule 3 bewusst** — Wenn
    `analysen.eskalation_erkannt=true` (Anwalt/Mängelrüge/Drohung/
    aggressiver Ton), wird KEIN Auto-Entwurf gebaut. Iron Rule 3 („KI baut
    Entwurf für ALLE Kundenanfragen") gilt damit eine bewusste Ausnahme.
    Status → manuell_pruefen, Eintrag in `processing_errors`. Owner muss
    selbst antworten.

33. **Klassifikator: Branchen-Default vor strikter Wort-Match-Liste** —
    `lib/klassifikation.ts` System-Prompt sagt explizit: `was_wir_machen`
    ist beispielhaft, NICHT abschließend. Haiku nutzt Branchen-Wissen
    (Metallbau = alles aus Metall inkl. Scharniere; Maler = alles
    Anstrich-bezogen etc.). Default bei Zweifel `unklar` statt
    `passt_nicht`. Wenn das je geändert wird (z.B. „strenger sein"),
    Side-Effect bedenken: vorschnelle Absagen vergraulen Pilots.

34. **Owner-Override beim Re-Generate** — Wenn Owner „Auftrag annehmen"
    klickt (`/api/anfragen/[id]/passt-doch`), wird `generiereEntwurf` mit
    `ownerBestaetigtPassend=true` aufgerufen. Das triggert einen fetten
    ⚠️-Override-Block im User-Prompt der Sonnet zwingt eine Zusage zu
    schreiben statt eigener Branchen-Einschätzung. Reine
    `gewerk_match=passt`-Marker in der Klassifikation reichen NICHT –
    Sonnet würde sonst trotzdem absagen wenn der Anfrage-Text wie
    „Sturmglastür" oder ähnliches enthält. Wichtig: Override nur in
    diesem expliziten Owner-Action-Pfad, nirgendwo sonst.

35. **Browser-native `confirm()` nie wieder einführen** — Seit Sprint 6
    (Tag 19) läuft alles über `useConfirm()` Hook + `<ConfirmProvider>`
    in `app/layout.tsx`. Brand-Look ist überall identisch, destructive
    Aktionen rot, Standard Stahlblau. Wenn neue Dialoge gebaut werden:
    immer den Hook nutzen, nie `window.confirm()` ins Repo zurück.

---

## 📜 Compliance-Status (DSGVO + Rechtstexte)

**Aktueller Stand (29.5.2026):**
- Standard-Template auf `/datenschutz`, `/agb`, `/impressum` live, mit
  prominentem amber-Disclaimer „in juristischer Prüfung".
- Impressum hat `[Klammern]`-Platzhalter für echte Adressdaten.
- Footer-Links überall verlinkt (Dashboard-Shell + Login).
- KEINE DPAs (Data Processing Addenda) aktiviert.
- KEIN BVDW-AVV mit Max geschlossen.

**Vor produktivem Pilot (Owner-Aufgabe, ~3-4h, ~50€/Jahr):**
1. e-recht24.de Premium → echte Datenschutz + Impressum generieren
2. Texte auf `/datenschutz` + `/impressum` ersetzen (AGB optional auch)
3. BVDW AV-Vertrag mit Max ausfüllen + unterschreiben (PDF)
4. Anthropic Console → DPA aktivieren
5. Supabase Settings → DPA aktivieren
6. Postmark Settings → DPA aktivieren
7. Vercel Settings → DPA aktivieren (Enterprise automatisch)

Detail-Memory:
`~/.claude/projects/-Users-flomandl-Code-auftragswerk/memory/compliance-pre-pilot-checkliste.md`

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
GOOGLE_OAUTH_CLIENT_ID              ← Welle C – Gmail-OAuth
GOOGLE_OAUTH_CLIENT_SECRET          ← Welle C – Gmail-OAuth
GOOGLE_OAUTH_REDIRECT_URI           = https://www.auftragswerk.app/api/auth/google/callback
TOKEN_ENCRYPTION_KEY                ← 32 Bytes base64, AES-256-GCM-Key. DARF NIE VERLOREN GEHEN
                                      sonst sind alle gespeicherten gmail_connections-Tokens
                                      unentschlüsselbar. Backup in 1Password/Bitwarden!
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

## 🆕 Tag 19 – wichtigste Code-Files

**Vision V1:**
- [lib/bilder.ts](lib/bilder.ts) – `ladeBilderFuerKI(nachrichtId)`:
  lädt jpg/png/webp/gif aus Storage-Bucket, base64-encoded. Max 5
  Bilder à 5MB. Sortierung kleinste zuerst.
- [lib/claude.ts](lib/claude.ts) – `ClaudeCallOptions.userContent` mit
  Block-Array (text + image-source) für Multi-Modal-Calls.

**Kunden-Historie (Premium-Wow Stammkunden):**
- [lib/kunden-historie.ts](lib/kunden-historie.ts) –
  `ladeKundenHistorie(betriebId, vonEmail, aktuelleAnfrageId)`:
  letzte 5 Kundenanfragen desselben Absenders mit Zusammenfassung.
  Fließt als „FRÜHERE ANFRAGEN DIESES KUNDEN"-Block in den
  Entwurfs-Prompt.

**Passt-doch / Owner-Override:**
- [app/api/anfragen/[id]/passt-doch/route.ts](app/api/anfragen/[id]/passt-doch/route.ts) –
  POST setzt gewerk_match=passt + löscht alten Entwurf + ruft
  `generiereEntwurf` neu mit `ownerBestaetigtPassend=true`.
- [app/dashboard/anfragen/[id]/passt-doch-button.tsx](app/dashboard/anfragen/[id]/passt-doch-button.tsx) –
  Amber-Banner über Konversations-Grid, „Auftrag annehmen"-Button.
- `lib/entwurf.ts` Override-Block: wenn `ownerBestaetigtPassend=true`,
  fetter ⚠️-Block ganz oben im User-Prompt der Sonnet zwingt eine
  Zusage zu schreiben statt eigener Branchen-Einschätzung.

**Sprint 6 Polish:**
- [components/ui/confirm-dialog.tsx](components/ui/confirm-dialog.tsx) –
  ConfirmProvider + useConfirm-Hook, Promise-basiert. Wrappt den App-
  Tree in `app/layout.tsx`.
- [app/dashboard/anfragen/[id]/notiz-editor.tsx](app/dashboard/anfragen/[id]/notiz-editor.tsx) –
  Owner-Notiz Auto-Save beim Blur.
- [app/dashboard/inbox-suche.tsx](app/dashboard/inbox-suche.tsx) +
  [app/dashboard/kunden/kunden-suche-sort.tsx](app/dashboard/kunden/kunden-suche-sort.tsx) –
  debounced URL-Param-Search.
- `app/dashboard/page.tsx` `staleTage()`-Helper – berechnet
  Wartetage seit versendet_am, threshold 7. Karten mit amber border-left.

## 🆕 Tag 18 – wichtigste Code-Files

- [app/api/sender/sperren/route.ts](app/api/sender/sperren/route.ts) –
  Block-Sender API. POST `{email, grund?}` → upsert in gesperrte_sender
  + UPDATE bestehende Anfragen auf 'aussortiert'.
- [app/dashboard/inbox-refresh-button.tsx](app/dashboard/inbox-refresh-button.tsx) –
  Client-Komponente, `router.refresh()` mit Spin + „Aktuell"-Feedback.
- [app/dashboard/kunden/kunde-sperren-button.tsx](app/dashboard/kunden/kunde-sperren-button.tsx) –
  ×-Button neben Kunden-Karte. stopPropagation damit Link nicht
  mitgreift. POST → router.refresh.
- [app/dashboard/profil/profil-form.tsx](app/dashboard/profil/profil-form.tsx)
  enthält `GebieteEditor` (Tag 18) – 3-Spalten-Tabellen-UI mit ↑/×
  Buttons + jeweils ein Input pro Eintrag. Plus `ListEditor` (Tag 18
  Textarea-Refactor) + `TonbeispieleEditor` (alt).
- [app/api/inbound/route.ts](app/api/inbound/route.ts) Pre-Check
  gesperrte_sender VOR Klassifikation (spart Anthropic-Cost). Plus
  `OriginalRecipient`-Routing für Forward-Mails (Tag 18 Bug-Fix).
- [lib/entwurf.ts](lib/entwurf.ts) System-Prompt mit zwei neuen
  Blöcken: VERMEIDEN (Tag 17) wenn `betrieb.vermeiden` befüllt,
  EINZUGSGEBIET (Tag 18) wenn `betrieb.gebiete.length > 0`.

## 🚧 Pilot-Status (Bauelemente Rapp GmbH = "Max")

**Pivot durch Welle G:** Max nutzt jetzt den Self-Service-Signup, nicht
mehr den alten manuell angelegten Account.

| Schritt | Status |
|---|---|
| Alter manuell-Account (UID `bee532ee-…`) | ✅ existiert, jetzt Plan-B-Backup |
| Catch-All-Subdomain `kunden.auftragswerk.app` (Welle E.2) | ✅ DNS+DKIM verifiziert |
| Bestehender Bauelemente-Rapp-Eintrag hat Subdomain-Adresse | ✅ `bauelemente-rapp@kunden.auftragswerk.app` (via Migration) |
| Self-Service-URL an Max raus | ✅ 1.6.2026 ~20:30 |
| Max registriert sich via `/registrieren` | ✅ Tag 18 |
| Max bestätigt Confirmation-Mail | ✅ Tag 18 |
| Max verbindet Gmail (Welle C OAuth-Flow) | ✅ Tag 18 |
| Max trägt Verfügbarkeit ein | ✅ Tag 18 |
| Max füllt Profil (Was wir machen / Signatur) | ✅ Tag 18 (mit UI-Hinweis: alles in 1 Zeile geschrieben → Sprint 1 ListEditor zur Textarea umgebaut) |
| Max richtet Forward in WordPress.com ein | ✅ Tag 18 (Gmail-Bestätigungs-Mail → Code + Confirm-Klick) |
| **Bug-Fix `OriginalRecipient`** | ✅ Tag 18 – Forward-Mails wurden vorher 404'd, Postmark Retry-Loop |
| Smoke-Test A (Inbound externe Mail → Dashboard) | ✅ Tag 18 (Postmark Activity zeigt 'Processed', mehrere Newsletter + echte Reply-Mails sind im Dashboard) |
| Smoke-Test B (Outbound aus Max' Gmail) | ⏳ Wartet auf erste echte freigegebene Antwort |
| Pilot scharfschalten – Max nutzt im Echtbetrieb | ✅ läuft seit Tag 18 mittags |
| Max-Feedback Tag 17 (Refresh / Was-wir-machen / Tab-Struktur / Region/PLZ / Signatur / Baustein-Pricing / Kalender-optional) | ⏳ teilweise umgesetzt: Refresh + Was-wir-machen + Tab-Struktur + Region/PLZ + Sender-Block durch (Sprint 1-3). Geparkt im Eisschrank: Signatur-RichText, Baustein-Pricing, Kalender-optional |
| Max-Feedback Tag 18 (Marketing-Säule 4 / 10k€-Kammer-Video / „Verfolgen" verstanden er nicht / Custom-Ordner für Kammer-Mails) | ⏳ Marketing als Säule 4 im Eisschrank dokumentiert. „Verfolgen" raus (Sprint 1). Custom-Ordner als Stufe 2 geparkt |
| Max-Feedback Tag 19 (Passt-doch-Button / Kunden-Suche / Browser-Popup hässlich) | ✅ alle 3 umgesetzt (Sprint 5 + Sprint 6 Brand-Confirm-Dialog) |
| **Vision V1** (KI sieht Foto-Anhänge) | ✅ Tag 19 live, Vision-Transparenz-Badge in EntwurfEditor |
| **Inhalts-Guardrails + Eskalations-Erkennung** | ✅ Tag 19, 6 verbotene Aussage-Typen + Eskalation flaggt automatisch |
| **Branchen-Default-Fix** in Klassifikation | ✅ Tag 19, Default unklar statt passt_nicht |
| **Sprint 5**: Inbox+Kunden-Suche + Kundenhistorie im KI-Prompt + Auftrag-annehmen-Override | ✅ Tag 19 |
| **Sprint 6 Polish**: Brand-ConfirmDialog (13 Stellen) + Loading-Hint + Notiz-Feld + Stale-Indikator | ✅ Tag 19 |
| Max-Real-Smoke-Test Sturmglastür-Anfrage mit 2 Fotos | ✅ Vision verifiziert (7195 input-tokens vs ~2500 text-only), Owner-Override-Pfad funktioniert (Banner → „Auftrag annehmen" → echte Zusage) |

---

## 🚨 Rollback-Strategie
- Vor Welle G: `backup-vor-self-service-signup`
- Vor Welle F: (kein eigener Backup, klein genug)
- Vor Welle E.2: `backup-vor-catchall-subdomain`
- Vor Welle E.1: `backup-vor-reply-to-fix`
- Vor Welle D: `backup-vor-wow-onboarding`
- Vor Welle C: `backup-vor-gmail-oauth`
- Vor Welle B (Rechtstexte): `backup-vor-rechtstexte`
- Vor Welle A (Mobile): `backup-vor-mobile`
- Vor Tag 14 (Welle 1/1.5/2): `backup-vor-tag14-push` + `backup-vor-haertungssprint`
- Vor Tag 13: `backup-vor-tag13-bugfixes`
- Sehr alt: `backup-vor-tab-umbau`
- Rollback: `git checkout main && git reset --hard <branch> && git push --force`
- Vercel deployt auto von main → Rollback sofort wirksam
- DB-Backups: Supabase Auto täglich (Settings → Database → Backups)
- Migrationen liegen alle in `supabase/migrations/` (User führt manuell im
  Supabase-Studio aus, nicht via CLI)

---

## 📋 Wo's weitergeht
Drei Quellen:
- **STRATEGIE.md** – konsolidierter Filter „was JETZT" (Leitprinzip,
  Reihenfolge, gestrichene Items)
- **IDEEN-EISSCHRANK.md** – alle geparkten Ideen mit Triggern (wann sie
  rauskommen)
- Plan-File: `~/.claude/plans/sooo-lies-backlog-md-delegated-moler.md`

**Premium-Pivot-Plan (Tag 15–16) — ALLE WELLEN DURCH:**
- ✅ Welle A: Mobile-Optimierung
- ✅ Welle B: Rechtstexte
- ✅ Welle C: Gmail-OAuth (Outbound aus echtem Gmail verifiziert)
- ✅ Welle D: Wow-Onboarding-Page (`/dashboard/willkommen`)
- ✅ Welle E.1+E.2: Reply-To-Hierarchie + Catch-All-Subdomain
  `kunden.auftragswerk.app`
- ✅ Welle F: Mail-Empfang-Card mit Provider-Anleitungen
- ✅ Welle G: Self-Service-Signup + Marketing-Landing + Custom-SMTP

**Aktueller Stand:** URL `https://auftragswerk.app` an Max raus.
Max-Smoke-Test im Real-Betrieb ausstehend.

**Offen vor produktivem Pilot mit Endkunden-Mails:**
- 🛑 Compliance-Block (Owner-Aufgabe, ~3-4h): e-recht24 + DPAs + BVDW-AVV
- 🛑 Echte Impressum-Anschrift (`/impressum` hat noch `[Klammern]`)

**Future (nach Max-Feedback):**
- ⏸ Welle H: Custom-Sender-Wizard mit DKIM (für Kunden ohne Gmail)
- ⏸ Modul 8: Google-Calendar-OAuth-Sync (wenn Max manuelles Pflegen nervt)
- ⏸ Säule 2 (Angebote), Säule 3 (Material-Recherche)
- ⏸ Admin-Backoffice + Pricing-Tiers + Stripe

VISION.md hat das große Bild für Komplett-Software-Endvision.
