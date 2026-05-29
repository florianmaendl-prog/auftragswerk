# Auftragswerk – Backlog

> **Stand: 29.5.2026 abends (Tag 15 – Mobile + Rechtstexte + Gmail-OAuth durch)**
>
> Säule 1 production-live, production-reif, brand-konsistent, mobile-tauglich,
> Gmail-OAuth funktioniert (Outbound verifiziert). Drei strategische Wellen
> aus dem Premium-Pivot-Plan abgearbeitet:
>
> - **Welle A (Mobile-Optimierung)** durch – Dashboard auf 380px-Screens
>   spielbar. Sidebar als sticky-Header mit 44×44-Hamburger, Inbox-Tabs
>   mit Scroll-Fade, Anfrage-Detail responsive (Header stack, Grids,
>   Attachments), Container-Padding mobile-friendly, Touch-Targets +44px.
>   Größter Brocken: **Kalender-Wochengrid Mobile-Variante** – auf <md
>   vertikale Tag-Liste (jeder Tag eine Section mit Stunden-Cards),
>   auf md+ klassisches 7-Spalten-Grid. Gemeinsamer getSlotData()-Helper.
>
> - **Welle B (Rechtstexte)** durch – /datenschutz, /agb, /impressum als
>   Standard-Template mit prominentem "in juristischer Prüfung"-Disclaimer.
>   Footer-Komponente in Dashboard + Login eingehängt. Vorbereitet für
>   Gmail-OAuth-Consent-Screen (braucht beide URLs).
>
> - **Welle C (Gmail-OAuth)** durch – User hat eigene Gmail verbunden,
>   Smoke-Test zeigt: Mail wird aus echtem Gmail-Account versendet
>   (verifiziert über Empfänger-Mail-Header "Von: florian.maendl@gmail.com").
>   Migration ausgeführt, Token-Verschlüsselung läuft, Auto-Refresh greift.
>   **ABER:** zwei offene Premium-Probleme aus dem Live-Test → Welle E.
>
> - **Welle D (Wow-Onboarding-Page)** als Krönung nach Welle C.
>
> - **Welle E (NEU): Premium-Reply-To + Catch-All-Subdomain** vor Pilot.
>   Aus Live-Test: Reply-To-Hex-Adresse ist "scammy" für Endkunden, Inbound-
>   Forward-Setup braucht eine premiumere Lösung. Details unten.
>
> **Vor Tag 14:** Pre-Pilot-Härtung (Welle 1/1.5/2) – Idempotenz,
> Versand-Atomarität, KI-Failures sichtbar, Edge-Proxy gehärtet, Security
> (Test-Routes raus, Input-Limits, Security-Headers, KI-Kosten-Cap),
> Brand-Foundation (Saira Condensed, Wortmarke, KategorieBadge, Hugeicons,
> Empty-States, Toasts, Token-Hygiene). Details siehe Tag-14-Block.
>
> **Premise:** Quality over Velocity. Foundation premium-reif. Welle C ist
> der Pilot-Pivot, Welle D die Krönung – danach DSGVO-Compliance-Block
> (siehe unten), dann Max live.

---

## ✅ FERTIG

### Tag 15 (Abend): Welle C – Gmail-OAuth (29.5.2026)

#### Welle C – Gmail-OAuth-Pivot
Premium-Onboarding-Foundation. Klick → Gmail verknüpft → Mail kommt aus
echtem Account. Löst DKIM-Pain für alle Kunden + macht Max sofort live ohne
DNS-Stau bei WordPress.com.

- ✅ **Google Cloud Setup** durch User durchgeklickt: Projekt "Auftragswerk",
  OAuth Client ID (Web Application), Scope `gmail.send`, Redirect URI
  `https://www.auftragswerk.app/api/auth/google/callback`, Consent-Screen
  befüllt + "In production" published, Gmail API aktiviert.
- ✅ **Vercel-Env-Vars** gesetzt: `GOOGLE_OAUTH_CLIENT_ID`,
  `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`,
  `TOKEN_ENCRYPTION_KEY` (32 Bytes Base64).
- ✅ **Migration** `20260530_gmail_connections.sql` ausgeführt – Tabelle
  mit verschlüsselten Token-Spalten, RLS via `current_betrieb_id()`,
  UNIQUE(betrieb_id).
- ✅ **Code-Foundation komplett:**
  - `lib/crypto.ts` – AES-256-GCM Token-Verschlüsselung (Format
    `<iv>.<authTag>.<ciphertext>` base64, auth-Tag-Check)
  - `lib/gmail.ts` – `getValidAccessToken()` mit Auto-Refresh (60s-Puffer),
    `sendeViaGmail()` mit RFC822-MIME-Bau (text/plain oder multipart/mixed
    mit base64-Anhängen, References-Cap auf 10, eigene UUID-Message-ID
    für Threading-Konsistenz), 401-Retry mit Force-Refresh, 4xx →
    status='fehler' + shouldFallback=true für Aufrufer.
  - `/api/auth/google/start` – CSRF-State in HttpOnly-Cookie, OAuth-URL
    mit `access_type=offline + prompt=consent`.
  - `/api/auth/google/callback` – State-Check, Token-Tausch, id_token
    decoden für google_email, Tokens verschlüsseln, UPSERT in
    gmail_connections, Redirect zu `/dashboard/profil?gmail=connected`.
  - `/api/auth/google/disconnect` – Best-effort Token-Revoke bei Google +
    DB-Löschung.
- ✅ **Versand-Routes erweitert** (gestaffelte From-Wahl): Gmail aktiv →
  sendeViaGmail. Sonst Custom-Sender → Postmark. Sonst Postmark-Fallback.
  Bei Gmail-permanent-Fehler (shouldFallback=true) → automatischer
  Postmark-Fallback mit Custom-Sender oder Default-Adresse.
- ✅ **Profil-UI** `gmail-connection-card.tsx` – drei Zustände
  (nicht verbunden / aktiv / fehler-widerrufen), Warnscreen-Hinweis,
  ?gmail=connected|error URL-Param-Toast, History-Cleanup.
- ✅ **Praktiker-Text** verbessert: kein DKIM-Tech-Sprech mehr,
  "Verbinde dein Gmail. Deine Antworten gehen dann aus deiner gewohnten
  Mail-Adresse raus – wie immer. Ein Klick, fertig."
- ✅ **Smoke-Test mit Flos eigenem Gmail durch:**
  - Connection verifiziert: `status='aktiv'`, `letzter_fehler=NULL`,
    `token_expiry` gesetzt
  - Outbound-Test: Mail aus Dashboard rausgeschickt → kommt im
    Empfänger-Postfach an, **From-Header zeigt
    `Metallbau Max Test <florian.maendl@gmail.com>`** (echte Gmail,
    NICHT info@auftragswerk.app) → Gmail-Pfad bestätigt ✓
  - Iron Rule "Auftragswerk nie sichtbar für Endkunde" erfüllt.

#### ⚠️ Welle C Live-Test brachte zwei Premium-Issues für Welle E
1. **Reply-To-Hex-Adresse ist scammy.** Aktuell nutzt der Code
   `betrieb.inbound_email` als Reply-To. Wenn die auf die Postmark-Hex
   (`22410d58b0879712e00751421bbe7f29@inbound.postmarkapp.com`) gesetzt
   ist, sehen Endkunden im Reply-To eine kryptische Hex-Adresse. Sieht
   für Endkunde wie Spam aus. **Muss vor Pilot gefixt.**
2. **Inbound-Forward-Setup pro Betrieb fühlt sich nicht premium an.**
   Aktuelle Lösung: Betrieb muss Gmail-Weiterleitung auf Postmark-Hex
   einrichten. Funktioniert, aber Anleitung "an die kryptische Adresse
   forwarden" wirkt unsicher. Bessere Lösung: eigene Subdomain
   `kunden.auftragswerk.app` als MX → Postmark, jeder Betrieb hat eine
   schöne eigene Adresse wie `max@kunden.auftragswerk.app`.

### Tag 15: Mobile-Optimierung + Rechtstexte (29.5.2026)

#### Welle A – Mobile-Optimierung
Mobile-Audit (Explore-Agent) lieferte 20 konkrete Bruchstellen, Critical+Important durchgezogen. Quick-Wins parallel zu größtem Brocken (Kalender-Mobile-Refactor).

- ✅ **Container-Padding mobile-friendly** – alle Dashboard-Pages auf
  `py-6 sm:py-8 px-4 sm:px-6` (statt fix px-6). 8px mehr Content-Breite
  auf 380px-Screens.
- ✅ **Sidebar / Mobile-Header** – Mobile-Header sticky (bleibt beim
  Scroll), Hamburger 44×44 (Apple-Touch-Standard) als Button statt
  sm-Button. Sidebar-Nav-Items min-h-11 auf Mobile.
- ✅ **Inbox** – Tab-Gruppen + Sub-Tabs mit `mask-image`-Fade-Edge als
  Scroll-Hint auf Mobile, md+ wieder hart abgeschnitten. Quick-Menu-
  Trigger w-11 h-11 auf Mobile (war w-8 h-8). Card-Padding `pr-16` auf
  Mobile (Platz für 44px-Trigger).
- ✅ **Anfrage-Detail** – Header `flex-col sm:flex-row`, Headline-Size
  xl→2xl, `break-words` damit lange Betreffe sauber umbrechen.
  Attachments `max-w-full sm:max-w-48 + w-full`. KI-Analyse-Grid
  `grid-cols-1 sm:grid-cols-2`. DetailActions `flex-wrap`, Button-Label
  „Als erledigt markieren" → „Erledigt" auf Mobile.
- ✅ **Termin-Card** – Festmachen-Grid (Datum/Ort) `grid-cols-1 sm:grid-cols-2`.
- ✅ **Kalender-Navigation** – Wochen-Nav `flex-col sm:flex-row`:
  Label oben, beide Pfeile unten nebeneinander. Pfeile min-h-11 mobile.
- ✅ **WOCHENGRID MOBILE-VARIANTE** (größte Arbeit) – auf md+
  klassisches 7-Spalten-Table (unverändert), auf <md vertikale
  Tag-Liste: jeder Tag eine Section mit Wochentag-Label (Montag,
  Dienstag, …) + Datum, darunter Stunden-Slots als Button-Cards mit
  Zeit links + Status rechts. Heute-Tag mit `primary/5`-Background.
  Gemeinsamer `getSlotData()`-Helper teilt Logik mit Desktop-Version.
  Touch-friendly: jeder Slot `min-h-11`.
- ✅ **Kunden-Detail** – Container `py-6 px-4 sm:px-6`.
- ✅ **Papierkorb-Cards** – `flex-col sm:flex-row`, Actions stacken
  unter Content auf Mobile.

#### Welle B – Rechtstexte (Standard-Template, in juristischer Prüfung)
- ✅ **`/datenschutz`** – DSGVO-konform: Verantwortlicher, Was wir
  verarbeiten, Rechtsgrundlage Art. 6, Subprocessors (Supabase
  EU/Frankfurt, Vercel, Anthropic, Postmark, Google bei OAuth),
  Gmail-OAuth-Block inkl. AES-256-GCM-Token-Storage, Speicherdauer,
  Betroffenenrechte, Datensicherheits-Maßnahmen. Amber-Disclaimer
  prominent oben.
- ✅ **`/agb`** – SaaS-Standard: Geltungsbereich (nur Unternehmer
  §14 BGB), Leistungsbeschreibung mit KI-Haftungs-Ausschluss bei
  ungeprüften Entwürfen, Pflichten (kein Spam, eigene DSGVO-Pflichten),
  Early-Access kostenfrei, 14-Tage-Kündigung. Gleicher Disclaimer.
- ✅ **`/impressum`** – TMG §5: Anschrift mit Platzhaltern in
  `[Klammern]` (Florian ergänzt vor produktiv-Pilot), USt-IdNr optional,
  EU-Streitschlichtung-Hinweis, TMG-Haftungsklausel.
- ✅ **Footer-Komponente** (`components/brand/footer.tsx`) – dezent,
  Copyright links + drei Links rechts. Dashboard-Shell hat Mini-Footer
  (nur die 3 Links). Login-Page mit vollem Footer.

### Tag 14: Pre-Pilot-Härtungssprint + Brand-Foundation (29.5.2026)

#### Welle 1 – Production-Blocker (9 Fixes)
- ✅ **Idempotenz im Inbound** – UNIQUE-Index auf `nachrichten.message_id`
  (Migration `20260528_nachrichten_message_id_unique.sql`) + Pre-Check vor
  Klassifikation + Race-Detection beim Insert. Postmark-Retries führen
  nicht mehr zu doppelten Anfragen/Entwürfen/KI-Kosten.
- ✅ **Entwurf-Editor: Save-vor-Send hart** – `handleSave` returnt
  `Promise<boolean>`, `handleSend` bricht bei Save-Fail ab. Plus
  `setSending` im `finally` in beiden Editoren.
- ✅ **Versand-Atomarität** – neuer Status-Lock `'in_versand'`,
  unlock-fn an Fehlerpfaden, finale DB-Updates mit Error-Logging in
  `processing_errors`. Doppelmails bei DB-Fehler nach Postmark-Send sind weg.
  Manuell: 5s-zeitbasierter Doppelklick-Schutz auf `anfrage_id`.
- ✅ **KI-Failures sichtbar** – Klassifikations- und Entwurfsfails landen
  in `processing_errors` + Status `'manuell_pruefen'`. Auch der Race-Case
  "Analyse-Re-Read returnt null" wird sauber abgefangen.
- ✅ **Edge-Proxy gehärtet** – `att.Content` wird IMMER gelöscht (auch
  bei Upload-Fail), `_upload_failed`-Marker reicht den Fehler an Vercel
  weiter. Plus `AbortSignal.timeout(25000)` für den Forward.
- ✅ **`getFreieSlots` wirft** statt belegte Slots zu liefern. Aufrufer
  in inbound fängt das ab und fällt auf "kein Slot-Vorschlag" zurück.
- ✅ **References-Header capen** – max 10 IDs in `lib/postmark.ts`.
  **Termin-Datum-Validation** – Jahr 2020 bis +5 Jahre, sonst 400.
- ✅ **Storage-Orphan-Cleanup** – wenn `anhaenge.insert` failt, wird
  die schon hochgeladene Datei aus dem Bucket entfernt.

#### Welle 1.5 – Security (4 Fixes)
- ✅ **Test-Routes weg** – `/api/test-cleaner`, `/api/test-entwurf`,
  `/api/test-klassifikation` waren komplett public ohne Auth-Check.
  Wer den URL-Pfad findet, konnte über `supabaseAdmin` (Service-Role!)
  beliebige Anfragen aus der DB lesen und Anthropic-Kosten verursachen.
  Komplett gelöscht.
- ✅ **Input-Limits** – `maxLength` auf alle Profil-Textareas
  (Signatur 5000, Stilbeispiel 3000), max 10 Stilbeispiele, body_text-Cap
  50.000 Zeichen im Versand, File-Size-Cap (20 MB/Datei, 25 MB/Mail)
  + MIME-Whitelist (Bilder, PDF, Office, Text) in `lib/files.ts`.
- ✅ **Security-Headers** – HSTS, X-Frame-Options DENY, X-Content-Type-
  Options nosniff, Referrer-Policy, Permissions-Policy in `next.config.ts`.
- ✅ **KI-Kosten-Soft-Cap** – mehr als 50 Analysen/h pro Betrieb →
  Anfrage landet in `'manuell_pruefen'` ohne KI-Run + Eintrag in
  Diagnose. Schützt vor Loop-Bugs / Spam-Wellen.

#### Welle 2 erste Hälfte – Visual-Premium-Foundation
- ✅ **Display-Font Saira Condensed** über `next/font/google` geladen,
  `--font-heading`-Variable verdrahtet.
- ✅ **Wortmarke "AUFTRAGSWERK"** als Komponente (`components/brand/
  wortmarke.tsx`) in drei Größen, optional mit Tagline. In Sidebar +
  Mobile-Header gesetzt.
- ✅ **KategorieBadge** (`components/brand/kategorie-badge.tsx`) mappt
  `analysen.kategorie` + `gewerk_match` auf Handlungsanweisung-Pills:
  Anfrage (stahlblau) / Prüfen (gelb) / Info (grau) / Passt nicht
  (dezent rot) / Aussortiert (gedämpft). Keine HOCH/MITTEL/NIEDRIG-Skala.
- ✅ **Emojis komplett raus, hugeicons rein** – Sidebar (📥👥📅📆🛠🗑),
  Inbox-Tabs (🔵🟡🟢📨ℹ️✅🗑), Anfrage-Detail (📥📤📎📍👤🏢📞), TerminCard
  (📅✓📍💡), Detail-Actions (✏️⚠️📌📤💬✅🗑), Quick-Menu, Editoren (📎✕),
  Kalender-Wochengrid (🟢🔴📅✏️🗑📍), Diagnose, Papierkorb, Profil.
- ✅ **Termine vs. Kalender visuell trennbar** – Termine bekommt
  `TimeScheduleIcon` (Zeit-Fokus), Kalender bekommt `Calendar02Icon`
  (Monats-Grid). TerminCard nutzt gleiches Icon wie Sidebar-Termine,
  damit Nav und Screen visuell zusammenpassen.
- ✅ **Page-Headlines konsistent** – Inbox, Kunden, Termine, Kalender,
  Diagnose, Papierkorb, Betriebsprofil alle in `font-heading uppercase
  tracking-wide`. Detail-Page-Titles (Mail-Betreff, Kunden-Name) bleiben
  Standard-Sans, weil User-Content.
- ✅ **Empty-States im Brand-Stil** für Inbox (Inbox-Icon + Hellgrau)
  und Diagnose ("Alles läuft sauber" mit grünem Checkmark-Icon).
- ✅ **Build verifiziert** (Next 16.2.6 / Turbopack), TypeScript clean,
  alle Routes (außer test-*) da.

### Säule 1 – Mail-Workflow
- Production-Deploy auf Vercel mit Custom-Domain auftragswerk.app
- Mail-Pipeline End-to-End: Inbound → KI-Klassifikation → KI-Entwurf → Versand
- Threading via References + In-Reply-To + eigene UUID-Message-ID
- Reply-To gesetzt → Kunden-Antworten kommen zurück in den Thread
- KI baut Entwurf für ALLE Kundenanfragen (auch passt_nicht → höfliche Absage)
- Reply-Editor immer verfügbar für manuelle Antworten
- Folge-Nachrichten "Weitere Nachricht senden" im laufenden Gespräch
- Erledigt-Button + Status-Dropdown + Papierkorb
- Supabase SMTP via Postmark → Magic-Links landen nicht im Spam
- Custom Sender pro Betrieb verdrahtet (sender_email + sender_verified)
- Login: Email + Passwort (Magic-Link bleibt als Backup)

### Tag 11–12: KI-Qualität, Sicherheit, Härtung
- ✅ Reply-Status-Bug behoben (`7b68145`)
- ✅ M1 Webhook-Auth (Basic-Auth) gegen Fremd-POSTs (`6c0fd3a`)
- ✅ KI-Reply-Kontext: bei Replies kompletter Thread + neuer Prompt-Block
  ("Bestätigungen erkennen, nicht wiederholen") (`d0af363`)
- ✅ Robustes JSON-Parsing + Null-Safety + Diagnose-Logs (`1efc4e9`)
- ✅ Mail-Cleaner immer (Anzeige + KI-Input) (`3bfc027`)
- ✅ Threading-Härtung: eigene UUID-Message-ID (`75ce48d`)
- ✅ DMARC für `auftragswerk.app` (`p=none`) bei united-domains

### Sprint "Fehlende Mitte" (Tag 12 abends, vier Module)
- ✅ **Modul 1 – Attachments** (`2e4ab37`, `ffeea59`, `caa0afa`, `a5e5e8f`)
  - DB: `anhaenge`-Tabelle + Supabase Storage Bucket `anhaenge`
  - Shared `lib/anhaenge.ts` (`speichereAnhang` – einheitlicher Upload-Helper)
  - Inbound: Postmark-Attachments aus `payload.Attachments[]` → Storage → DB
  - Outbound: `lib/postmark.ts` + beide versand-Routes nehmen `attachments[]`
    entgegen, sichern danach in `anhaenge` verlinkt zur Ausgang-Nachricht
  - UI: File-Picker (multiple) in entwurf-editor + reply-editor
  - UI: Anfrage-Detail zeigt pro Nachricht Thumbnails (Bilder) + Download-
    Buttons (Rest) via signed URLs aus Supabase Storage
- ✅ **Modul 2 – Mini-CRM (Kunden-Sicht)** (`bae8002`)
  - `/dashboard/kunden`: aggregiert anfragen per `von_email`, Karten mit
    Name/Firma/Anzahl/Last-Contact (kein neues Schema, JS-Aggregation)
  - `/dashboard/kunden/[email]`: alle Anfragen eines Kunden chronologisch
  - Sidebar-Eintrag "Kunden" 👥
  - Anfrage-Detail: Link "X weitere Anfragen von diesem Kunden →"
- ✅ **Modul 3 – Termin-Modul v1** (`2e4ab37`, `ef6fc81`)
  - DB: `termine`-Tabelle mit Status-Lifecycle
    (vorgeschlagen → bestaetigt → absolviert / abgesagt)
  - `/api/termine` POST (vorschlagen) + PATCH (festmachen, andere → abgesagt)
  - `TerminCard` auf Anfrage-Detail: bis zu 3 Slots vorschlagen,
    "Festmachen"-Button pro Slot, Copy-Text für die Mail, grünes Banner
    bei Bestätigung
  - `/dashboard/termine` Übersicht (Kommende + Vergangene, abgesagte
    ausgeblendet)
  - Sidebar-Eintrag "Termine" 📅
  - v1 ohne Google-Calendar-OAuth – manuelle Slot-Picker reichen
- ✅ **Modul 4 – Failure-Visibility** (`b2d0802`)
  - `/dashboard/diagnose`: per-Betrieb `processing_errors` mit
    Schritt-Badges + ausklappbaren Details
  - Highlight "X Fehler in 24h" rot
  - Sidebar-Eintrag "Diagnose" 🛠️ im Utility-Bereich

### Tag 13: Foto-Anhänge entgrenzt + drei Tag-12-Bugs + Kalender klickbar
- ✅ **Modul 7 – Inbound-Proxy via Supabase Edge Function** (`7462d5f`)
  - Postmark sendet jetzt erst zur Supabase Edge Function (Deno,
    ~25 MB Body-Limit), die schreibt Anhänge in Storage und reicht eine
    "lite" Payload an Vercel weiter
  - Vercels 4.5 MB Hard-Limit ist damit kein Pilot-Killer mehr – Kunden
    können Fotos in normaler Handy-Größe schicken
  - lib/anhaenge.ts um `verlinkeAnhang` erweitert (proxy-vorgeladene
    Anhänge nur referenzieren, kein Re-Upload)
  - tsconfig schließt `supabase/functions/**` aus (Deno ≠ Next.js TS)
- ✅ **Bug 3 – KI-Prompt 'Mitbringsel-Regel'** (`65cfb33`)
  - KI schlägt nicht mehr proaktiv "Musterprofile mitbringen" o.ä. vor
  - Nur noch wenn Kunde es erwähnt ODER materialbedarf_erkannt=true
- ✅ **Bug 1+2 – Timezone-Sweep** (`024c5c0`)
  - Alle Termin-Zeiten konsequent in Europe/Berlin (date-fns-tz)
  - Bali-Test-Bug behoben (User in fremder TZ sieht trotzdem Berliner
    Zeit), Bug 2 (Termin nicht im Kalender sichtbar) löst sich mit weil
    cellStart jetzt zur UTC-Termin-Zeit korrekt matcht
  - Neue lib/datetime.ts mit berlinLocalToUtcIso, formatBerlinDatetime etc.
- ✅ **Click-to-Edit + Standalone-Termine im Kalender** (`97b4a07`, `3512836`)
  - termine.anfrage_id NULLABLE (Migration `20260524_termine_nullable_anfrage.sql`)
  - /api/termine: POST mit optional anfrage_id, PATCH mit 'bearbeiten'-Action
  - WochenGrid: alle Zellen sind jetzt <button>, öffnen je nach Kind
    einen Aktions-Dialog
    · Leer → Regel/Sperre/Termin anlegen
    · Grün → Termin anlegen / Sperren / Regel löschen
    · Rot → Termin trotzdem anlegen / Sperre löschen
    · Blau → Bearbeiten / Absagen / Zur Anfrage
  - Damit aus jeder Zelle Termin direkt anlegbar – Max kann auch
    Werkstatt-Wartung etc. eintragen, nicht nur Kunden-Termine

### Tag 12 nachts: Modul 6 – Termin festmachen aus Reply + Modul 6.5 Inbox-Stats
- ✅ **Modul 6 – Termin direkt festmachen + KI-Auto-Extract**
  (`0bcb674`, `1f4f7eb`, `3877961`, `38a22d2`)
  - DB: neue JSONB-Spalte `analysen.extrahierter_termin` ({ datum_iso, ort, notiz })
  - Klassifikation extrahiert bei Termin-Bestätigungen ("Mo 10 Uhr passt")
    Datum/Uhrzeit/Ort; heutiges Datum als Kontext für relative Aussagen
  - `/api/termine` POST: neuer `direkt_bestaetigen`-Flag → Insert mit
    status='bestaetigt', vorgeschlagene werden automatisch abgesagt
  - TerminCard: vier saubere Zustände
    · bestätigt → grünes Banner
    · KI hat Termin extrahiert → gelbes Hinweis-Banner "Kunde scheint Termin
      zu bestätigen: <Datum>" mit "Direkt festmachen"-Button (Modal PRE-FILLED)
    · vorgeschlagene da → bestehende Liste mit Festmachen pro Slot
    · sonst → "Termin vorschlagen" + "Direkt festmachen" (Modal leer)
  - Festmach-Modal: datetime-local + Ort + Notiz, ein Klick legt Termin als
    `bestaetigt` an → erscheint sofort im Kalender + Termine-Übersicht
  - Bonus-Fix: `analysen` werden in der Anfrage-Detail nach analysiert_am
    DESC sortiert – KI-Analyse-Panel zeigt damit auch bei Replies immer die
    aktuellste Analyse (statt zufällig der ersten); latenter UI-Bug nebenbei mit weg
- ✅ **Modul 6.5 – Mini-Stat-Bar oben in der Inbox** (`1aa552e`)
  - Kompakte Zeile über den Tab-Gruppen
  - "Heute: N neue Anfragen · M Replies · K aussortiert" (Klick → passender Tab)
  - "Diese Woche: X Anfragen · Y Termine" (Termine verlinkt zur Termin-Übersicht)
  - Empty-State "Heute noch nichts los." statt Nullen-Wand
  - Implementation: 1× extra termine-Count-Query, sonst nur Aggregation
    der schon vorhandenen items-Liste – kein neuer API-Endpoint

### Tag 12 spät: Modul 5 – Verfügbarkeits-Kalender + Mini-CRM-Bugfix
- ✅ **Mini-CRM Bugfix** (`b56dbaa`)
  - Aggregation nur über `kategorie='kundenanfrage'`-Analysen
  - Werbe-/Rechnungs-/Innung-Mails fließen nicht mehr in Name/Firma/Count
  - Lieferanten/Spam-Absender tauchen nicht mehr als "Kunden" auf
- ✅ **Modul 5 – Verfügbarkeits-Kalender** (`d845a1b`, `e743f03`, `116026f`, `20c7897`)
  - DB: `verfuegbarkeit_regel` (wöchentlich) + `verfuegbarkeit_sperre` (einmalig)
  - `lib/verfuegbarkeit.ts` mit `getFreieSlots()` – berücksichtigt Regeln,
    Sperren und bestätigte Termine
  - `/api/verfuegbarkeit/regel` + `/api/verfuegbarkeit/sperre` (POST + DELETE)
  - `/dashboard/kalender`: Wochengrid mit Wochen-Navigation (URL-State),
    Cell-Farben (grün=frei, blau=Termin, rot=Sperre), Heute-Highlight
  - Inline Editoren für Regeln + Sperren (Add/Delete, kein Modal)
  - Sidebar-Eintrag "Kalender" 📆
  - **KI-Integration**: bei Erst-Anfragen ruft inbound `getFreieSlots(14 Tage,
    max 12 Slots)` und übergibt Liste an `generiereEntwurf`. KI-Prompt
    bekommt expliziten Block "DEINE NÄCHSTEN FREIEN TERMIN-SLOTS" mit
    Anweisung 2-3 konkrete Slots vorzuschlagen. Bei Replies bewusst aus –
    Termin-Faden läuft schon im Thread.
  - Fehler-tolerant: ohne Verfügbarkeit/bei Slot-Fehler fällt KI aufs alte
    Verhalten zurück, kein Regress.

---

## 🚧 LAUFEND: Premium-Pivot-Plan (Plan-File: `~/.claude/plans/sooo-lies-backlog-md-delegated-moler.md`)

Vier-Wellen-Plan vom 29.5.2026. Zwei durch, zwei offen.

### ✅ Welle A – Mobile-Optimierung (Tag 15, oben dokumentiert)
### ✅ Welle B – Rechtstexte (Tag 15, oben dokumentiert)
### ✅ Welle C – Gmail-OAuth (Tag 15 Abend, oben dokumentiert)
  Outbound-Smoke-Test verifiziert. Zwei offene Premium-Issues → Welle E.

### ⏳ Welle D – Wow-Onboarding-Page (2-3 Tage, NÄCHSTE WELLE nach Pause)
Erste-Login-Detection: 0 Anfragen + 0 Regeln + 0 Termine → redirect zu
`/dashboard/willkommen`. Hero mit Wortmarke + "Hi {inhaber}, deine
Assistenz, die mitdenkt". Drei Schritte als Brand-Cards: 1) Gmail
verbinden (1 Klick, mit grünem Check wenn done!), 2) Verfügbarkeit
eintragen (Quick-Link Kalender), 3) Profil ausfüllen. Optional: 60s-Loom
+ Spickzettel-PDF im Brand-Briefkopf-Stil aus dem Mockup.

Backup-Branch vor Start: `backup-vor-wow-onboarding`

### ⏳ Welle E – Premium-Reply-To + Catch-All-Subdomain (vor Pilot!)
**Aus Welle-C-Live-Test entstanden.** Zwei Issues fixen damit Endkunden
nichts Scammy sehen:

**E.1 Reply-To-Logik intelligent machen** (Quick Fix, ~1h)
- Wenn Gmail-OAuth aktiv → Reply-To = Gmail-Adresse des Betriebs
  (`gmail_connections.google_email`). Kundenantwort landet direkt im
  Gmail-Postfach des Inhabers.
- Wenn kein Gmail, aber sender_verified → Reply-To = `sender_email`.
- Sonst → Postmark-Hex-Fallback (heute, akzeptabel).
- Anpassung in `app/api/versand/route.ts` + `versand/manuell/route.ts`
  Zeilen mit `replyToAddress = betrieb?.inbound_email || ...`.
- **Konsequenz:** Bei Gmail-OAuth-Setup muss der Owner einen Gmail-Filter
  einrichten: Subjects mit "AW:" (oder ähnliches Pattern) →
  auto-forward an Postmark-Hex. So landet die Antwort wieder in
  Auftragswerk. Anleitung in Profil-Card erweitern.

**E.2 Catch-All-Subdomain** `kunden.auftragswerk.app` (echte Premium-Lösung)
- DNS: `MX kunden.auftragswerk.app → mx.postmark...` (Postmark-Anweisung
  folgen, Domain in Postmark als Inbound-Domain registrieren)
- Postmark: Wildcard-Inbound-Route auf eine Hex-Adresse
- Jeder Betrieb bekommt bei Registrierung eine eigene saubere Adresse,
  z.B. `max@kunden.auftragswerk.app` oder
  `{slug}@kunden.auftragswerk.app` als `inbound_email`
- Reply-To = `betrieb.inbound_email` (die saubere Subdomain-Adresse)
- Endkunde sieht: schöne `kunden.auftragswerk.app`-Adresse,
  KEIN Hex mehr.
- Owner-Aufgaben:
  - DNS-MX-Record bei united-domains anlegen
  - Postmark Inbound-Domain konfigurieren
  - Migration: betriebe.inbound_email auf Subdomain-Pattern setzen
    (für bestehende Betriebe via UPDATE, für neue via Auto-Generierung)

**Reihenfolge:** E.1 vor Welle D bauen (kleine Änderung, sofort sichtbar
im Onboarding-Flow). E.2 nach Welle D + vor Max-Live als eigene kleine
Welle. Backup-Branch: `backup-vor-reply-to-fix` bzw.
`backup-vor-catchall-subdomain`.

---

## 🛑 VOR PRODUKTIVEM PILOT (Compliance-Block, Owner-Aufgabe)

**Aktueller Stand:** Standard-Template-Rechtstexte mit "in juristischer
Prüfung"-Disclaimer auf /datenschutz, /agb, /impressum. Reicht für
Early-Access mit Florian selbst, NICHT für Max-Live oder weitere Kunden.

**Sieben Schritte** (~3-4h Aufwand, ~50€/Jahr, NACH Welle C+D, vor Max-Live):
- [ ] **e-recht24.de Premium-Account** → Datenschutzerklärung + Impressum generieren (echte Versionen). ~50€/Jahr.
- [ ] **Generierte Texte auf auftragswerk.app einbinden** – ersetzt Standard-Template auf /datenschutz + /impressum. AGB optional ebenfalls über e-recht24. Footer-Links sind schon da.
- [ ] **BVDW AV-Vertrag-Template** → mit Max ausfüllen + unterschreiben (PDF). Pflicht weil Auftragswerk Max' Kundendaten verarbeitet.
- [ ] **Anthropic Console** → DPA aktivieren.
- [ ] **Supabase Settings** → DPA aktivieren.
- [ ] **Postmark Settings** → DPA aktivieren.
- [ ] **Vercel Settings** → DPA aktivieren (Enterprise haben sie automatisch, Pro/Hobby explizit aktivieren).

Memory-Pointer: `~/.claude/projects/-Users-flomandl-Code-auftragswerk/memory/compliance-pre-pilot-checkliste.md`

---

## 🚧 Max-Pilot Go-Live (Bauelemente Rapp GmbH)

**Strategischer Pivot durch Welle C:** Wenn Gmail-OAuth durch ist, BRAUCHT
Max keinen DNS-Setup mehr. Postmark Sender Signature + DKIM-CNAME bei
WordPress.com werden zur **Plan-B-Option** für Kunden ohne Gmail.

### ✅ Erledigt
- Supabase Auth-User für Max (`info@bauelemente-rapp.com`, Auto-Confirm)
- `betriebe`-Zeile: Bauelemente Rapp GmbH, Maximilian Rapp, Metallbau
- `profiles`-Zeile verknüpft, Login funktioniert (RLS end-to-end bewiesen)
- Postmark Sender Signature für `info@bauelemente-rapp.com` angelegt

### ⏳ Plan A: nach Welle C live (Gmail-OAuth)
- [ ] Max klickt "Mit Gmail verbinden" in Profil → Mail geht aus seinem
  echten Gmail raus. **Kein DNS, kein DKIM, kein DMARC nötig.**
- [ ] Inbound bleibt Postmark-Forward: Gmail-Weiterleitung info@... →
  Postmark-Hex-Inbound. Das ist die einzige verbliebene Max-Aufgabe.

### ⏸ Plan B: nach Postmark-Sender-Setup (falls Max Gmail nicht will)
- [ ] Bestätigungsmail von Postmark im Gmail klicken
- [ ] DKIM-TXT + Return-Path-CNAME bei WordPress.com DNS eintragen
- [ ] DMARC für `bauelemente-rapp.com` setzen
- [ ] Gmail-Weiterleitung info@... → Postmark-Hex-Inbound
- [ ] `UPDATE betriebe SET sender_verified=true, sender_email=...`

### ⏳ Dann (Flo, nach Plan A oder B)
- [ ] **Smoke-Test A** (Inbound) + **Smoke-Test B** (Outbound + Threading)
- [ ] **Spickzettel/Onboarding** über Welle-D-Page abgedeckt
- [ ] Pilot scharfschalten – Max gibt `info@bauelemente-rapp.com` weiter

---

## 🧪 Optional vor Pilot (mit Flo's Account testbar)

- [ ] Sprint "Fehlende Mitte" end-to-end testen:
  - Testmail mit Foto-Anhang an Inbound → Foto sichtbar im Detail?
  - Reply mit PDF an Empfänger → kommt PDF an?
  - Kunden-Liste zeigt eigene Test-Anfragen sauber gruppiert?
  - Termin vorschlagen → Festmachen-Flow durchspielen
  - Diagnose-Seite anschauen (sollte leer sein wenn nichts kaputt)
- [ ] KI-Szenario `passt_nicht` testen (Maler-Anfrage)
- [ ] KI-Szenario `unklar` testen (vage Anfrage)

---

## 📋 PHASE 2: Self-Service-Onboarding (NACH Pilot)

> Bauen, wenn Max 2-4 Wochen produktiv genutzt + Feedback positiv ist.

- [ ] Email-Verifizierung (Doppel-Opt-In) – Passwort-Login + Reset stehen schon
- [ ] Onboarding-Wizard mit Sender-Signature-Aufsetzung
      (lib/postmark-sender.ts ist fertig dafür)
- [ ] Provider-spezifische Forwarding-Anleitung (Gmail/M365/IONOS/Strato)
- [ ] Admin-Backoffice (User-Übersicht + Kill-Switch + Billing)

---

## ⏸ GEPARKT: Säule 2 (Angebot & Kalkulation)

**Reaktivieren als Nächstes nach Max-Pilot-Feedback** – sitzt jetzt auf
solider Basis (Attachments + Termine + Kunden-Historie). Migration liegt
unausgeführt im Repo (`supabase/migrations/20260522_saeule2_angebote.sql`).
Geplante Tabellen: `angebot_bausteine`, `material_preise`, `angebote` +
`betriebe.stundensatz`.

---

## ⏸ SPÄTER: Säule 3 (Material-Recherche)

"Perplexity für Handwerker". Konzept in VISION.md. Erst nach Säule 2.

---

## 🎁 POLISH (nach Pilot / kontextsensitiv)

### Sprint "Fehlende Mitte" + Modul 5/6/6.5 – offene Polish-Items
- [ ] **Notiz pro Anfrage** (intern, nicht in Mail) – "zahlt schlecht",
      "kennt Müller". Modul 7-Kandidat, hoch im Wert/Aufwand-Verhältnis.
- [ ] **Voller Activity-Feed** – Verlauf der letzten Aktionen ("vor 20 Min
      Werbung aussortiert: Stahlwelt-Aktion"). Mini-Stat-Bar reicht v1.
- [ ] **Vorgeschlagene Slots strukturiert speichern** – wenn die KI im
      Erst-Entwurf konkrete Slots aus dem Kalender vorschlägt, könnten
      sie als `termine` mit `status='vorgeschlagen'` gespeichert werden.
      Kunde antwortet "Slot 2 passt" → Auto-Match möglich. Braucht
      KI-Output-Refactoring (strukturiertes JSON-Output zusätzlich zu Body).
- [ ] **Sidebar-Badge für Diagnose**: rote Zahl wenn Errors in 24h
      (braucht Server-Prop durch dashboard/layout statt purer Client-Shell)
- [ ] **N1 Inbound-404-Logging**: aktuell nur `console.warn`. Braucht NULL-
      `betrieb_id` in `processing_errors` oder eine separate
      `system_errors`-Tabelle (kann nicht per-Betrieb angezeigt werden)
- [ ] **Kalender v2: Google-Calendar-OAuth** – Auto-Availability statt
      manuelle Regel-Pflege, Auto-Event-Erstellung beim Bestätigen, bidirektionaler
      Sync. Erst sinnvoll wenn Max sagt "Pflege ist nervig".
- [ ] **Kalender: iCal-Export** – damit Max bestätigte Termine in
      Outlook/Apple Calendar abonnieren kann (Read-only)
- [ ] **Kalender: Reschedule-Workflow** – bestätigten Termin verschieben
- [ ] **Termin-Reminder**: 24h vorher Mail an Max
- [ ] **Termin-Modul v2**: bestätigter Termin schaut auch in
      Verfügbarkeit ("Slot ist eh frei")
- [ ] **Kalender: Verfügbarkeit-Templates** ("typische Aufmaß-Woche
      Mo-Fr 8-12") als One-Click-Preset
- [ ] **Kalender: Slot-Vorschlag-Komponente** auch bei Replies, nicht
      nur Erst-Entwurf
- [ ] **Kalender: Mobile-Layout** der Wochengrid (aktuell desktop-first)
- [ ] **Kalender: Click-to-Create im Grid** – Klick auf leere Zelle öffnet
      Modal mit Typ-Picker (Regel / Sperre / Termin) und vorausgefüllten
      Datum/Uhrzeit (User-Wunsch Tag 12 spät)
- [ ] **Kalender: Multi-Day-Regel** – im Regel-Editor Wochentag-Multiselect
      (Mo–Mi 8–12 in einem Schritt anlegen statt drei einzelne Regeln)
      (User-Wunsch Tag 12 spät)
- [ ] **Kunden v2**: echte `kunden`-Tabelle mit Notizen, Vermerk,
      Zahlungsverhalten, manuellen Tags

### Mail-Qualität
- [ ] Logo in Mail-Signatur (HTML-Mails, CID-Embedding)
- [ ] Briefkopf-Daten in Plaintext-Footer (Adresse/Tel/StNr)
- [ ] Mail-Templates pro Gewerk

### KI-Lernen
- [ ] Editier-Diff loggen (was hat Owner am Entwurf geändert)
- [ ] Wöchentliche Stilbeispiel-Vorschläge
- [ ] Klassifikations-Korrekturen sammeln + Prompt-Regeln vorschlagen

### Dashboard
- [ ] Inbox-Suche (Volltext über Betreff + Absender)
- [ ] Filter "ungelesen / gelesen"
- [ ] Tastatur-Shortcuts (j/k navigieren, e=erledigt …)
- [ ] Statistik-Dashboard (Anfragen/Woche, Conversion, Antwortzeit)
- [ ] Auto-Refresh bei neuer Anfrage (statt manuell Cmd+R)
- [ ] **KI-Analyse-Panel** zeigt aktuell `analysen[0]` (zufällig),
      sollte `latest` sein – sort by `analysiert_am DESC` bei Replies

### Integrationen
- [ ] Bounce-Webhook von Postmark
- [ ] Spam-Complaint Webhook
- [ ] PDF-Angebot generieren
- [ ] WhatsApp-Channel später (Vision)

### Multi-Tenant / Skalierung
- [ ] Pricing-Tiers (500 € / 1.000 € / 1.500 €/Monat)
- [ ] Stripe-Integration
- [ ] Mail-Volumen-Limits pro Tier
- [ ] `inbox@auftragswerk.app` per MX (saubere Inbound-Architektur)
- [ ] SPF-Record für `auftragswerk.app` um Postmark erweitern
- [ ] **lib/anhaenge.ts** weiter ausbauen (DELETE-API für Anhänge im UI etc.)

---

## 🐛 Kleine offene Bugs / Verbesserungen

- [ ] Einstellungen-Seite bauen (aus Sidebar raus weil 404)
- [ ] Versand-Status-Update statt nach 5 s sofort triggern
- [ ] Confirm-Dialog beim Löschen (Soft-Delete) per-User abstellbar machen
- [ ] DMARC-Reports von Gmail/Outlook nach 1-2 Wochen auswerten
      (kommen an `florian.maendl@gmx.de` via `rua=`)

---

## 📝 AKTUALISIERTE PILOT-SEQUENZ

1. ✅ Säule 1 deployt + verifiziert (Tag 1-10)
2. ✅ Härtung Reply/Threading/Cleaner/Auth/DMARC (Tag 11-12)
3. ✅ **Sprint "Fehlende Mitte" – Attachments, Mini-CRM, Termine, Diagnose** (Tag 12)
4. ✅ **Modul 5 – Verfügbarkeits-Kalender + KI-Slot-Vorschläge + Mini-CRM-Bugfix** (Tag 12 spät)
5. ✅ **Modul 6 – Termin direkt aus Reply festmachen + KI-Auto-Extract** (Tag 12 nachts)
6. ✅ **Modul 6.5 – Mini-Stat-Bar in Inbox** (Tag 12 nachts)
7. ✅ **Modul 7 – Edge-Proxy für Foto-Anhänge + Bugfixes + Kalender klickbar** (Tag 13)
8. ✅ **Pre-Pilot-Härtungssprint Welle 1 + 1.5 + Brand-Foundation Welle 2 komplett** (Tag 14)
9. ✅ **Mobile-Optimierung Welle A + Rechtstexte Welle B** (Tag 15)
10. ✅ **Welle C: Gmail-OAuth** (Outbound verifiziert, Reply-To-Issue offen)
11. ⏳ **Welle E.1: Reply-To-Quick-Fix** (~1h, vor Welle D)
12. ⏸ **Welle D: Wow-Onboarding-Page** (`/dashboard/willkommen`, 2-3 Tage)
13. ⏸ **Welle E.2: Catch-All-Subdomain** `kunden.auftragswerk.app` vor Max-Live
14. ⏸ **Compliance-Block** (Owner-Aufgabe, ~3-4h): e-recht24 + DPAs + BVDW-AVV
15. ⏸ Smoke-Tests → Max-Pilot scharfschalten (Plan A via Gmail-OAuth)
16. ⏸ Max 2-4 Wochen nutzen lassen + Feedback sammeln
17. ⏸ **Modul 8 – Google-Calendar-OAuth-Sync** (falls Max manuelles Pflegen nervt)
18. ⏸ Wenn validiert: Phase 2 (Self-Service-Onboarding + Admin-Backend)
19. ⏸ 2. Pilot: Elektriker-Kumpel
20. ⏸ Säule 2 (Angebote) je nach Max-Feedback reaktivieren
