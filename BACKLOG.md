# Auftragswerk – Backlog

> **Stand: 5.7.2026 (Sprint 1 auf Branch `sprint-1` – 6 Quick-Fixes vor Max-Besuch)**
>
> Grundlage: Review vom 2.7. (Prod-Daten + Code + UX + 16 Screenshots +
> 8 Max-Audios). Max-Besuch ~10.7. – bis dahin läuft alles.
>
> **Alle 6 Sprint-1-Items durch, TypeScript grün, Full-Build durch, 6 sauber
> getrennte Commits auf Branch `sprint-1`:**
>
> - **Item 0** (Owner) – 3 Migrations in Supabase durch: angebote_empfaenger,
>   schema_fix (idempotent), saeule2_rls (Sicherheit). Bug „einleitung column
>   not found" behoben, `angebote`/`angebot_bausteine`/`material_preise`
>   endlich mit RLS.
> - **Item 4 [63ee396]** – Jargon-Sweep (Iron Rule 14):
>   [lib/labels.ts](lib/labels.ts) neu (KATEGORIE/WERT/DRINGLICHKEIT/
>   GEWERK_MATCH/KUNDE_TYP Klartext-Maps + label-helper mit rohem Fallback).
>   Model-Badge (`claude-sonnet-4-6`) am Antwort-Entwurf raus. `confidenceBadge`-
>   function komplett gelöscht (beide Anzeigen: Amber-„KI 75%" auf Titel +
>   numerische %-Zeile in Analyse-Card). Alle 5 rohen Enums in
>   [app/dashboard/anfragen/[id]/page.tsx](app/dashboard/anfragen/[id]/page.tsx)
>   auf `label(MAP, wert)` umgestellt. `empfohlene_aktion`-Prompt in
>   [lib/klassifikation.ts:182](lib/klassifikation.ts#L182) von dritter Person
>   („Was sollte der Meister…") auf Du-Form mit konkreten Beispielen.
> - **Item 5 [98147f4]** – Anrede-Regeln im Angebots-Generator.
>   [lib/angebot.ts](lib/angebot.ts) System-Prompt um 3 neue Blöcke erweitert:
>   ANREDE (Sie-Default, niemals Vorname + Sie mischen), TITEL (nur
>   Leistung, nie Kundenname), EINLEITUNG (mit der Sache anfangen, keine
>   Namens-Anrede). Fixt den 15.6.-Bug „Vielen Dank für Ihre Anfrage, Flo!"
>   + „– Flo" im Titel.
> - **Item 3 [885070d]** – Diktat-Fix. [components/ui/diktat-button.tsx](components/ui/diktat-button.tsx)
>   komplett überarbeitet: Fehler-Mapping (`not-allowed`/`network`/
>   `audio-capture` → deutsche Handlungsanweisungen mit macOS-
>   Systemeinstellungs-Hinweis, 10s Toast). Permission-Pre-Check via
>   `navigator.permissions.query({name:'microphone'})` in try/catch. Bei
>   fehlendem Browser-Support: disabled Button mit Tooltip statt
>   `return null`. Rohe API-Codes nur noch in console.warn.
> - **Item 2 [c787928]** – Angebotsnummer + Gültig-bis automatisch.
>   [app/api/angebote/route.ts](app/api/angebote/route.ts) POST setzt
>   `angebotsnummer` (Format `YYYY-NNN`, Query nach höchster bestehender
>   Nummer des Jahres +1, gepaddet) + `gueltig_bis` (heute+30 Tage via
>   `berlinStartOfToday()` aus [lib/datetime.ts](lib/datetime.ts)).
>   Fixt Text-Daten-Widerspruch (KI-Schlusstext „30 Tage gültig", DB leer).
> - **Item 6 [c022af9]** – Dirty-Schutz im Angebots-Editor (minimal).
>   [app/dashboard/angebote/[id]/angebot-editor.tsx](app/dashboard/angebote/[id]/angebot-editor.tsx):
>   Baseline-State getrennt von State, `isDirty` via JSON-Vergleich in
>   useMemo. beforeunload-Handler bei dirty. Amber-Text
>   „Ungespeicherte Änderungen" neben Speichern-Status. Bewusst KEIN
>   Sidebar-Navigation-Intercept – Next 16 App Router hat keinen
>   Router-Event-Hook; eigener UX-Sprint. Tab-Close ist 90%-Fall.
> - **Item 1 [162c566]** – Eventualpositionen (der eigentliche Bug).
>   Kein Schema-Change nötig (positionen ist JSONB). Neues optionales
>   Feld `eventualposition?: boolean` in `AngebotPosition`. `berechneSummen`
>   filtert EP aus summe_netto/brutto raus, gibt zusätzlich
>   `summe_eventual_netto` zurück. KI-Generator-Prompt bekommt
>   EVENTUALPOSITIONEN-Block + zweigeteiltes JSON-Beispiel. Editor: EP-
>   Checkbox pro Position, dezente Amber-Tönung + „EP"-Badge, separate
>   Summen-Zeile für Eventualpositionen. PDF: „EP"-Marker im Pos-Feld,
>   Gesamt in Klammern + amber, Legende unter Tabelle, separate EP-Summen-
>   Zeile unter Brutto. Fixt den 656€-statt-287€-Bug.
>
> **Branch-Setup:** Sprint 1 läuft auf Branch `sprint-1`, NICHT auf main.
> Owner macht vor Merge:
> 1. `supabase db dump` als Backup (Prod-Rollback-Sicherheit, Supabase Free hat kein PITR)
> 2. Sichten der 6 Commits
> 3. Merge nach main → Vercel-Prod-Deploy
>
> **Nicht in Sprint 1 (kommt in Sprint 2 „QA-Pass" vor Max-Besuch):**
> Signup-Mail-5-Tage-Bug fixen (Postmark-Log + Supabase-Auth-SMTP + 3-Adressen-
> Test), E2E-Durchlauf mit Protokoll, 21 processing_errors + 29
> manuell_pruefen aufarbeiten, Fehler-Digest-Cron, `analysen.kurzfassung`
> (max 80 Zeichen) + Inbox-Subline, Collapse-Cards in Anfrage-Detail.
> Aus Max-Audios klar: „Zuverlässigkeit schlägt Features" – Sprint 2 baut
> Vertrauen zurück, keine neuen Features.
>
> **Aus Max-Audio 3.7. herausgekommen (Eisschrank, klärt sich beim Besuch):**
> Betriebe mit Betriebssoftware (Streit, TopKontor) wollen Angebotstext
> zum Kopieren, nicht PDF+Nummer. Potenzieller Säule-2-Pivot oder
> zweigleisig. **B1 – Angebotstext im Betriebs-Stil** wartet auf 2-3
> echte Vorlagen von Max beim Besuch.
>
> ---
>
> **Vorheriger Stand:** **15.6.2026 (Premium-Foundation P1–P6 durch + Säule 2 komplett + Empfänger-Felder am Angebot)**
>
> Eine Woche Vollgas-Push nach Tag-20-Stand. Vision war "vor 30
> Handwerksmeistern bestehen" – nicht "läuft bei einem". Daraus
> entstanden zwei Wellen.
>
> ## Premium-Foundation (Wellen P1–P5, P6 wieder raus)
>
> - **Welle P1 – Quick Wow-Wins** ([Commit `ab0a42f`](.))
>   - 8. Top-Level-Tab `Kammer/Verband` für KI-Kategorie `innung_behoerde`
>     in [app/dashboard/page.tsx](app/dashboard/page.tsx)
>   - Browser-Tab-Counter `Auftragswerk (N)` mit N = Freigabe-Inbox
>   - PDF-Vision: Anthropic-`document`-Block, Claude liest PDF-Anhänge
>     nativ (Baupläne, Aufmaß-Skizzen). [lib/bilder.ts](lib/bilder.ts),
>     [lib/claude.ts](lib/claude.ts), [lib/entwurf.ts](lib/entwurf.ts).
>
> - **Welle P2 – Signatur Premium (HTML + Logo + Preview)**
>   ([Commits `4bfd345`, `16171f6`, `26b672c`](.))
>   - Logo-Upload-Backend + Storage-Bucket `logos` + Profil-UI
>     ([app/dashboard/profil/profil-form.tsx](app/dashboard/profil/profil-form.tsx)).
>   - HTML-Send-Pfad in allen 3 Routes: [lib/postmark.ts](lib/postmark.ts),
>     [lib/gmail.ts](lib/gmail.ts), [lib/microsoft.ts](lib/microsoft.ts).
>     `multipart/related` mit Logo via CID-Embedding (inline, kein Attachment).
>   - Email-Preview-Modal im Entwurf-Editor – Owner sieht exakt was beim
>     Kunden ankommt inkl. Signatur + Logo
>     ([app/dashboard/anfragen/[id]/entwurf-editor.tsx](app/dashboard/anfragen/[id]/entwurf-editor.tsx)).
>
> - **Welle P3 – Custom-Tags + Inbox-Sortierung + Diktat**
>   ([Commits `7ff74f9`, `5707839`](.))
>   - `tags TEXT[]` + GIN-Index auf anfragen, eigene Tag-Sets pro Betrieb,
>     Sender→Tag-Regeln mit Auto-Apply im Inbound-Hook.
>   - Inbox-Sortierung (Datum/Dringlichkeit/Wert/Kategorie) mit URL-State.
>   - Diktat via Web Speech API (deutsch, gratis, kein STT-Server) im
>     Reply- + Entwurf-Editor. Fallback hidden wenn Browser nicht supportet.
>
> - **Welle P4 – Termin-Premium + Cron-Infrastruktur**
>   ([Commit `f1111f7`](.))
>   - Vercel-Cron-Setup mit `CRON_SECRET`-Auth ([vercel.json](vercel.json)).
>   - `app/api/cron/termine-reminder` – tägl. 7 Uhr Mail an Owner mit
>     heutigen Terminen.
>   - `app/api/cron/wochen-report` – Mo 8 Uhr Wochen-Zusammenfassung
>     (Anfragen rein / Antworten raus / Termine fest), bewusst ehrliche
>     Counts ohne erfundene "X Stunden gespart"-Schätzungen.
>   - iCal-Export pro Termin ([lib/ical.ts](lib/ical.ts)) + Reschedule-Modul.
>
> - **Welle P5 – Mini-CRM V1 (Datei-Ablage + Notizen am Kunden)**
>   ([Commit `0e316dc`](.))
>   - Tabellen `kunden` (UNIQUE per Betrieb auf email) + `kunden_dateien`
>     + Storage-Bucket `kunden_dateien` (privat, service-role).
>   - Inbound-Pfad lege bei `kategorie=kundenanfrage` automatisch
>     kunden-Zeile + Anhänge in kunden_dateien an.
>   - Kunden-Detail-Page mit Datei-Liste (Signed-URL 5min) + Notizen-Auto-Save.
>   - Aggregation in Kunden-Liste ersetzt durch direkten Read aus
>     kunden-Tabelle ([app/dashboard/kunden/page.tsx](app/dashboard/kunden/page.tsx)).
>
> - **Welle P6 – Google-Calendar-Sync RÜCKGEBAUT** ([Commit `91c2734`](.))
>   - Gebaut ohne dass der explizite Eisschrank-Trigger ("Max sagt
>     Verfügbarkeit pflegen ist nervig") gefallen war. Owner-Pushback
>     berechtigt, plus Google Cloud verlangt App-Verification für
>     `calendar.readonly` (Wochen-Prozess, sensible-scope-Review).
>   - Migration `kalender_busy_slots` bleibt drin (kostet nix), aber
>     OAuth-Scope, Cron und UI sind raus. iCal-Export aus Welle P4 deckt
>     den Praxis-Bedarf "Termin in Google importieren" ab.
>   - Lehre dokumentiert: bei größeren Brocken MUSS der Eisschrank-Trigger
>     explizit geprüft werden (siehe Memory `feedback-antizipation-statt-disziplin`).
>
> ## Brand-Audit (alle Emojis raus) – Commit `38271e6`
>
> Owner-Feedback "premium look keine Emojis !" nach Screenshot mit 📅 im
> Kalender-Button. Konsequenz: alle Emojis in UI + Logs raus, durch
> HugeiconsIcon-Komponenten ersetzt. Auch in Server-Logs, Toast-Strings
> und system-Prompts. Premium-Look konsistent.
>
> ## Säule 2 – Angebote (vollständig)
>
> Owner-Push: "is das aber finish säule eins ich will das tool perfekt
> haben vor innung heißt säule 2 3 4 fehlen doch komplett was mit dir".
> Plan war komplette Angebots-Säule mit KI-Generator aus Bausteinen +
> Materialpreise + PDF-Export + Versand + Nachfass-Cron.
>
> - **S2.1 – Foundation** ([Commit `797721a`](.))
>   - Migration `20260522_saeule2_foundation.sql` (3 Tabellen):
>     `betriebe.stundensatz`, `angebot_bausteine` (Bezeichnung +
>     Material-Kosten + Arbeitszeit + Kalkulations-Faktor),
>     `material_preise` (Lieferant-Preise pro Material), `angebote`
>     (status, positionen JSONB, mwst_satz, summe_netto/brutto,
>     angebotsnummer, gueltig_bis, notiz_intern).
>   - RLS nachträglich gesetzt:
>     [supabase/migrations/20260616_saeule2_rls.sql](supabase/migrations/20260616_saeule2_rls.sql).
>   - Profil-Cards für Bausteine + Materialpreise:
>     [app/dashboard/profil/bausteine-card.tsx](app/dashboard/profil/bausteine-card.tsx),
>     [app/dashboard/profil/materialpreise-card.tsx](app/dashboard/profil/materialpreise-card.tsx).
>
> - **S2.2 – Generator + Editor + Nav** ([Commit `b931618`](.))
>   - [lib/angebot.ts](lib/angebot.ts) – `generiereAngebotsVorschlag` mit
>     Sonnet, system-prompt EXPLIZIT "KEIN automatischer Versand", `jsonrepair`-
>     Fallback, `berechneSummen` für Netto + Brutto aus Positionen + MwSt.
>   - Editor:
>     [app/dashboard/angebote/[id]/angebot-editor.tsx](app/dashboard/angebote/[id]/angebot-editor.tsx) –
>     Card-Layout (Kopf-Daten + Positionen + Summen + Actions), Add/Edit/
>     Delete/Move-Up/Down auf Positionen, useMemo für Live-Summen, KI-Schätzpreis-
>     Hinweis sichtbar wenn Owner Preis ändert.
>   - "+ Angebot erstellen"-Button auf Anfrage-Detail
>     ([app/dashboard/anfragen/[id]/angebot-erstellen-button.tsx](app/dashboard/anfragen/[id]/angebot-erstellen-button.tsx)).
>   - Sidebar-Nav: "Angebote" mit File02-Icon
>     ([app/dashboard/dashboard-shell.tsx](app/dashboard/dashboard-shell.tsx)).
>
> - **S2.3 – PDF-Export (Premium Brief-Layout)** ([Commit `0b1bf47`](.))
>   - [lib/angebot-pdf.tsx](lib/angebot-pdf.tsx) – `@react-pdf/renderer` 4.5,
>     A4-Brief mit Stammdaten-Header links + Logo rechts, Empfänger-Block,
>     Meta-Row (Nummer + Datum + Gültigkeit), Titel + Einleitung, Positionen-
>     Tabelle (Pos / Bezeichnung / Menge / Einzel / Gesamt), Summen rechts,
>     Schlusstext, Signatur, Footer.
>   - **Iron Rule**: PDF zeigt KEIN Auftragswerk-Branding – Footer nur
>     Betrieb-Name + sender_email.
>   - [app/api/angebote/[id]/pdf/route.ts](app/api/angebote/[id]/pdf/route.ts) –
>     `runtime = 'nodejs'`, lädt Stamm + Kunden + Logo-Signed-URL (300s TTL),
>     rendert in Buffer, returnt `application/pdf` mit Download-Filename.
>
> - **S2.4 – Versand + Nachfass** ([Commit `8f45cd7`](.))
>   - [app/api/angebote/[id]/senden/route.ts](app/api/angebote/[id]/senden/route.ts) –
>     4-stufige Provider-Hierarchie (Microsoft → Gmail → Custom Sender →
>     Postmark) wie Säule 1, HTML-Body mit Signatur + Logo-CID, PDF im
>     Anhang, Status auf `versendet` + `versendet_am` gestempelt.
>   - Mini-CRM-Integration: gesendetes PDF wird in `kunden_dateien`
>     archiviert (Source-of-Truth bleibt Storage-Bucket).
>   - `app/api/cron/angebote-nachfass` – Mo 10 Uhr UTC, sucht 14–21
>     Tage alte `versendet`-Angebote, per-Betrieb gruppierte Sammel-Mail
>     an Owner mit Link zum Angebot.
>   - Senden-Modal mit Empfänger (read-only), Betreff, Body, Vorname-
>     Anrede-Default
>     ([app/dashboard/angebote/[id]/senden-modal.tsx](app/dashboard/angebote/[id]/senden-modal.tsx)).
>
> - **S2.5 – Leere Angebote + Empfänger frei editierbar (heute)**
>   - Owner-Feedback: "man muss natürlich auch einfach so angebote
>     erstellen können leer editierbar oder villleicht mit logo und
>     max adresse fix aber rest komplett einstellbar wenn man schnell
>     eins machen will". Kunde steht im Laden, Telefon-Anfrage,
>     Laufkundschaft – nicht jedes Angebot hat eine vorgelagerte Mail.
>   - Migration
>     [supabase/migrations/20260616_angebote_empfaenger.sql](supabase/migrations/20260616_angebote_empfaenger.sql)
>     – 5 Spalten am `angebote`: `empfaenger_name`, `empfaenger_firma`,
>     `empfaenger_email`, `empfaenger_adresse`, `empfaenger_plz`.
>   - [app/api/angebote/route.ts](app/api/angebote/route.ts) – POST
>     akzeptiert Body ohne `anfrage_id`, kein KI-Call wenn keine Anfrage.
>     Bei Anfrage: Empfänger automatisch aus `anfragen.von_email` +
>     `kunden`-Stammdaten vorbefüllt, danach komplett frei editierbar.
>   - [app/api/angebote/[id]/route.ts](app/api/angebote/[id]/route.ts) –
>     PATCH `ERLAUBT` um alle 5 `empfaenger_*`-Felder erweitert.
>   - [app/dashboard/angebote/[id]/angebot-editor.tsx](app/dashboard/angebote/[id]/angebot-editor.tsx) –
>     neue Card "Empfänger" ganz oben mit Name / Firma / E-Mail (Pflicht
>     für Versand) / Adresse / PLZ+Ort. SendenModal nutzt jetzt
>     `state.empfaenger_email`, nicht mehr Prop aus Anfrage.
>   - [app/api/angebote/[id]/pdf/route.ts](app/api/angebote/[id]/pdf/route.ts) +
>     [app/api/angebote/[id]/senden/route.ts](app/api/angebote/[id]/senden/route.ts)
>     – `angebot.empfaenger_*` hat Vorrang, Fallback nur wenn am Angebot
>     leer (Anfrage → kunden-Tabelle).
>   - "+ Neues Angebot"-Button auf Liste
>     ([app/dashboard/angebote/neues-angebot-button.tsx](app/dashboard/angebote/neues-angebot-button.tsx) +
>     [app/dashboard/angebote/page.tsx](app/dashboard/angebote/page.tsx)).
>     Owner klickt einmal → POST ohne Body → Editor mit leerer Empfänger-
>     Card und einer leeren Positions-Liste.
>
> ## Mini-CRM Lazy-Backfill für Bestandskunden ([Commit `17d43f4`](.))
>
> Bug: Bestandskunden (Anfragen vor Welle P5) hatten keine `kunden`-Zeile,
> also kein Notiz-Feld und keine Datei-Sektion. Fix:
> [app/dashboard/kunden/[email]/page.tsx](app/dashboard/kunden/[email]/page.tsx)
> nutzt `syncKundeFromAnalyse` lazy beim Detail-Seitenaufruf, wenn keine
> kunden-Zeile existiert. Backfill aus Analyse-Daten, Owner sieht alle
> Felder.
>
> ## Was als Nächstes (Owner-Test-Pause vor Säule 3)
>
> Owner-Direktive `feedback-eine-saeule-nach-der-anderen`: nach jedem
> Säulen-Abschluss STOPPEN und auf Test-Feedback warten. Säule 2 ist
> gepusht, Säule 3 (Material/Projekt-Assistent) wartet bis Owner
> explizit "los" sagt.
>
> **Sofort vor Test-Run nötig:**
>
> 1. Migration in Supabase SQL Editor laufen lassen
>    (`20260616_angebote_empfaenger.sql`).
> 2. (Optional, falls noch nicht passiert) RLS-Migration für Säule 2
>    laufen lassen (`20260616_saeule2_rls.sql`).
>
> ---
>
> **Vorheriger Stand:** **7.6.2026 spät abends (Tag 20 – ehrliche Aktivitäts-Karte, Reply-Editor-Gleichstellung, Branding-Audit)**
>
> Marathon-Tag nach kurzem Pause-Stand. Vier Brocken durch:
>
> - **Aktivitäts-Karte** auf Dashboard (Commit `f8a2bde`) — bewusst KEINE
>   "X Stunden gespart"-Bullshit-Zahl, sondern nur DB-Fakten: Heute / Woche /
>   Monat-Buckets mit Anfragen rein, Antworten raus, Termine fest, Werbung
>   weg, ungeändert versendet, Median-Antwortzeit. Owner-Pushback: erfundene
>   Zahl würde smarte Handwerker als SaaS-Bullshit durchschauen →
>   Vertrauensbruch. Lösung: eigene Story aus echten Counts.
>
> - **Reply-Editor als gleichwertige Wahl** (STRATEGIE A2) — neue
>   `AntwortBereich`-Wrapper-Komponente mit Toggle "KI-Entwurf nutzen ↔
>   Selbst schreiben" visuell gleichgewichtet über dem Editor. Default
>   bleibt KI-Entwurf, Owner ohne Vertrauen kann jederzeit selbst tippen
>   ohne den Entwurf wegzuwerfen. Senkt Skeptiker-Schwelle, Tool wirkt
>   nicht als Zwang.
>
> - **Favicon-Brand** (`app/icon.tsx` + `app/apple-icon.tsx`) — generierte
>   PNG-Icons (32x32 für Browser-Tab, 180x180 für iOS Home-Screen) mit
>   weißem "A" auf Stahlblau-Background `#3D556B`. Next-Default-Favicon
>   gelöscht. Brand zeigt sich endlich auch im Tab.
>
> - **Multi-User-Branding-Audit** — alle Code-Kommentare von "Max",
>   "Bauelemente Rapp" etc. auf generische Begriffe ("Owner", "Mustermann
>   Bau") neutralisiert. 17 Dateien betroffen (Routes, Komponenten,
>   Migrations). Verbleibende "Max"-Vorkommen sind alle entweder
>   MAXIMUM (`lib/files.ts`) oder "Max Mustermann" (deutsches generic
>   "John Doe"). Codebase ist multi-tenant-ready für Pilot #2.
>
> **Kritischer Real-Befund aus DB-Check (`scripts/check-edits.ts` +
> `scripts/check-versand.ts`):** Max hat seit Pilot-Live (4.6.) **5
> Anfragen reingekriegt aber 0 Antworten versendet**. Erklärung vom
> Owner per Telefon: Max ist im Beobachtungs-Modus — schaut sich
> Sortierung an, prüft Entwurfsqualität, drückt bewusst noch nicht
> Senden weil er erst sicher sein will. Das findet er gut.
>
> **Konsequenzen:**
> - **Ton Phase 2 (Auto-Stilbeispiele) wartet auf echte Versände**, nicht
>   auf "30+ Edits". Bei 0 Edits gibt's nichts zu lernen. Trigger
>   neu definiert.
> - **"Entwurf fertig"-Ping war Fehl-Diagnose** — Max vergisst nicht
>   aufs Tool zu schauen, er prüft aktiv. A3-Trigger NICHT gefallen.
> - **Aktivitäts-Karte zeigt jetzt die Wahrheit:** "1 KI-Entwurf bereit,
>   0 raus". Genau das, was ehrlich ist.
>
> Plus: zwei Debug-Scripts liegen jetzt unter `scripts/` (npx tsx
> `--env-file=.env.local`), nutzen Supabase Service-Role-Key.
>
> **Vorheriger Stand:** **7.6.2026 abends (Tag 19 – Vision + Guardrails + Sprint 5 + Sprint 6 durch)**
>
> Max-Pilot läuft seit Tag 18 produktiv. Tag 19 war ein massiver Push:
> 6 Sprints/Fixes hintereinander. Tool ist signifikant näher am
> „premium-perfekt".
>
> **Heute durch:**
> - **Vision V1**: KI sieht Foto-Anhänge (jpg/png/webp/gif), max 5 Bilder
>   à 5MB. Bei visuellen Gewerken (Metallbau, Sanitär, Dach, Maler) der
>   Premium-Wow-Moment.
> - **Inhalts-Guardrails + Eskalations-Erkennung**: KI nennt nie Preise,
>   nie verbindliche Zusagen, eskaliert Beschwerden/Anwalt automatisch.
> - **Branchen-Default-Fix**: Klassifikator versteht jetzt dass
>   `was_wir_machen` Schwerpunkte sind, nicht exklusive Liste. Default
>   bei Zweifel "unklar" statt "passt_nicht". Plus Vision-Transparenz-Badge.
> - **Sprint 5**: Inbox + Kundenliste Volltextsuche + Sortierung,
>   Kundenhistorie im KI-Entwurfs-Prompt (Premium-Wow für Stammkunden),
>   "Auftrag annehmen"-Banner mit Owner-Override-Prompt.
> - **Sprint 6 Polish-Welle**: Brand-Confirm-Dialog überall (13 Stellen),
>   Loading-Hint bei frischer Anfrage, interne Notiz pro Anfrage,
>   Stale-Indikator für versendete Anfragen ohne Reply (>7 Tage).
>
> **Vorheriger Stand:** **4.6.2026 (Tag 18 – Max-Pilot live, Sprint 1+2+3 durch)**
>
> Max hat sich angemeldet, Gmail verbunden, WordPress.com-Forward eingerichtet.
> Echte Kunden-Mails laufen seit Tag 18 mittags. Bug-Fix
> `OriginalRecipient`-Routing für Forward-Mails (Postmark → Edge Function →
> Vercel) hat den Pilot scharfgeschaltet.
>
> Drei Sprints heute durchgezogen:
> - **Sprint 1**: Tab-Struktur flach + Refresh-Button + Was-wir-machen
>   Textarea-UX + Kunden-Lösch-Button + Sender-Block-Foundation +
>   IDEEN-EISSCHRANK.md
> - **Sprint 2**: Region/PLZ-Tier-Editor + gebiets-abhängiger
>   Mindestauftragswert + KI-Prompt-Block
> - **Sprint 3**: Sender-Sperren direkt aus Inbox-Quick-Menu
>
> Plus: STRATEGIE.md ist die neue Source-of-Truth für „was JETZT".
> IDEEN-EISSCHRANK.md hält alle geparkten Ideen (Marketing-Säule 4,
> Custom-Tags, Signatur-Rich-Text, Diktat, WhatsApp etc.) mit Triggern.

> **Vorherige Stände:** **1.6.2026 (Tag 16 – Welle D + E + F + G durch, an Max raus)**
>
> Säule 1 production-live, production-reif, brand-konsistent, mobile-tauglich,
> Gmail-OAuth funktioniert (Outbound verifiziert), Inbound auf eigener
> Subdomain `kunden.auftragswerk.app`, Wow-Onboarding-Page, Self-Service-
> Signup mit DB-Trigger, Marketing-Landing auf `/`, Custom-SMTP via Postmark
> für transaktionale Mails. Max hat die URL an diesem Abend bekommen.
>
> **Sieben strategische Wellen aus dem Premium-Pivot-Plan durch:**
>
> - **Welle A (Mobile)** – Dashboard auf 380px-Screens spielbar. Kalender-
>   Wochengrid Zweispur (md+ Table, <md vertikale Tag-Liste). Touch ≥44px.
>
> - **Welle B (Rechtstexte)** – /datenschutz, /agb, /impressum als
>   Standard-Template mit "in juristischer Prüfung"-Disclaimer. Footer
>   überall verlinkt.
>
> - **Welle C (Gmail-OAuth)** – `gmail.send` Scope, AES-256-GCM-Token-
>   Verschlüsselung, Auto-Refresh. 3-stufige From-Wahl (Gmail → Custom
>   Sender → Postmark-Fallback). Smoke-Test verifiziert: Mail aus echtem
>   Gmail-Account.
>
> - **Welle D (Wow-Onboarding)** – `/dashboard/willkommen` mit dynamischer
>   "Hi {Vorname},"-Anrede, 3 Onboarding-Step-Cards (Gmail / Verfügbarkeit
>   / Profil) mit Status-Detection, "Du bist startklar"-Banner wenn alleDone.
>   First-Run-Detection in `/dashboard/page.tsx`.
>
> - **Welle E (Reply-To-Premium)** – E.1 Quick-Fix: Reply-To-Hierarchie
>   `inbound_email → sender_email → POSTMARK_REPLY_TO`. E.2 Catch-All-
>   Subdomain `kunden.auftragswerk.app` mit MX-Routing zu Postmark.
>   `lib/slug.ts` + Migration `20260601_inbound_email_subdomain.sql` (PL/pgSQL
>   `name_zu_slug()` + Migrations-DO-Block + UNIQUE-Index). Pro Betrieb
>   saubere Adresse `slug@kunden.auftragswerk.app`, kein scammy Hex mehr.
>
> - **Welle F (Mail-Empfang-Card)** – Profil-Page zeigt Provider-spezifische
>   Forward-Anleitungen (Google Workspace, IONOS, WordPress.com, Allgemein)
>   im Akkordeon, dismissable mit localStorage. Endkunden schreiben weiter
>   an reale Geschäftsadresse, Owner richtet einmalig Weiterleitung ein.
>
> - **Welle G (Self-Service-Signup + Marketing-Landing)** – `/registrieren`-
>   Form mit DB-Trigger `handle_new_user` (Migration `20260601_signup_trigger.sql`)
>   der automatisch betriebe (mit Subdomain-Slug) + profiles (Rolle 'inhaber')
>   anlegt. Marketing-Landing auf `/` mit Hero + Problem + Lösung + 3-Schritte
>   + Für-wen + CTA. Custom-SMTP via Postmark in Supabase Auth (Mails aus
>   `info@auftragswerk.app`), Email-Confirmation aktiv, gebranded HTML-Template.
>
> **Premise:** Quality over Velocity. Foundation premium-reif. Max kann
> jetzt selbst registrieren → Mail bestätigen → Wow-Onboarding → Gmail
> verbinden → Verfügbarkeit → Forward einrichten → live. Compliance-Block
> (Owner-Aufgabe ~3-4h) und echte Impressum-Anschrift sind die letzten
> offenen Punkte vor "produktivem Pilot mit Endkunden-Mails-im-Realbetrieb".

---

## ✅ FERTIG

### Tag 19 (7.6.2026): Vision + Guardrails + Sprint 5 + Sprint 6 (massiver Push)

#### Vision V1 — KI sieht Foto-Anhänge
- ✅ **`lib/bilder.ts`** (neu) – `ladeBilderFuerKI(nachrichtId)` lädt
  jpg/png/webp/gif aus Storage-Bucket, base64-encoded. Defensive Limits:
  max 5 Bilder pro Anfrage, max 5 MB pro Bild (Anthropic-Hard-Limit),
  Sortierung kleinste zuerst.
- ✅ **`lib/claude.ts`** – `ClaudeCallOptions.userContent` erweitert um
  Multi-Block-Content (text + image-source). image-Blocks ZUERST,
  text danach (Anthropic-Empfehlung).
- ✅ **`lib/entwurf.ts`** – `generiereEntwurf` akzeptiert optionalen
  `bilder`-Parameter. System-Prompt um Block „BILDER-AUSWERTUNG"
  erweitert: konkret werden bei eindeutigen Bildern, keine blinde
  Diagnose, kein Schadens-Preis aus Bild.
- ✅ **`app/api/inbound/route.ts`** – lädt Bilder der gerade
  eingespeicherten Nachricht und reicht sie an `generiereEntwurf`
  weiter. Catch-Block damit Bilder-Fail nie die Pipeline killt.
- ✅ **UI-Badge im EntwurfEditor**: `🖼 Die KI hat X Bilder vom Kunden
  gesehen` – Vision-Transparenz, Max weiß jederzeit ob die KI
  Bild-Kontext hatte.
- ✅ **Kosten**: ~1-3 Cent pro Bild nach internem Resize, weit innerhalb
  des KI-Kosten-Caps (50 Analysen/h).

#### Inhalts-Guardrails + Eskalations-Erkennung (Iron Rule 3 bewusst durchbrochen)
- ✅ **`lib/entwurf.ts` Prompt-Härtung**: Neuer fetter Block
  „INHALTS-GUARDRAILS" mit 6 verbotenen Aussage-Typen:
  1. KEINE PREISE (auch nicht „ca." / „ab" / Richtwert)
  2. KEINE VERBINDLICHEN ZUSAGEN bei Terminen
  3. KEINE TECHNISCHEN GARANTIEN („hält 30 Jahre")
  4. KEINE NORM-/COMPLIANCE-AUSSAGEN (DIN-Werte, Pflichten)
  5. KEINE SCHADENS-EINSCHÄTZUNG aus Foto
  6. KEINE MEDIZINISCHEN/RECHTLICHEN/VERSICHERUNGS-AUSKÜNFTE
- ✅ **Migration `20260605_eskalation_erkannt.sql`**:
  `analysen.eskalation_erkannt` + `analysen.eskalation_grund`.
- ✅ **`lib/klassifikation.ts`** – Haiku prüft auf Eskalations-Signale
  (Anwalt/Mängelrüge/Drohung/aggressiver Ton/Schadensersatz-Forderung).
  Default: "in Zweifel LIEBER eskalieren".
- ✅ **Inbound-Pipeline**: wenn `eskalation_erkannt` → Iron Rule 3
  (KI baut Entwurf für ALLE) bewusst umgangen → kein Auto-Entwurf,
  Status `manuell_pruefen`, Eintrag in `processing_errors` mit Grund.
  Frühes Return aus der Pipeline.

#### Branchen-Default-Fix + Vision-Transparenz (Hot-Fix nach Max-Live-Test)
- ✅ **`lib/klassifikation.ts`**: Klassifikator versteht jetzt explizit
  dass `was_wir_machen` Schwerpunkte sind, NICHT exklusive Liste.
  Branchen-Wissen aktiviert: „Metallbau = ALLES aus Metall inkl.
  Scharniere/Beschläge/Türen/Stahlbau", „Maler = alles Anstrich-bezogen"
  etc. Default bei Zweifel `unklar` statt `passt_nicht`.
  Lehre dokumentiert: vorschnelle Absage ist schlimmer als kurze
  Owner-Prüfung.
- ✅ **`lib/entwurf.ts` passt_nicht-Block** erweitert: bei Bildern MUSS
  Sonnet trotz Absage 1 Satz konkret darauf eingehen („Auf den Fotos
  sehe ich klassische Glastür-Scharniere – das macht ein Schlosser
  besser"). Vorher kollidierten „kurze Absage" und „auf Bilder eingehen".

#### Sprint 5 – Such-Foundation + Kundenhistorie + Passt-doch-Button
- ✅ **`app/dashboard/inbox-suche.tsx`** (neu) – debounced URL-Param-Search
  `?q=` über Betreff/Name/Email. Page filtert serverseitig.
- ✅ **`app/dashboard/kunden/kunden-suche-sort.tsx`** (neu) – gleiche
  Search-Pattern + Sort-Dropdown (Letzter Kontakt / Name A-Z / Anzahl).
- ✅ **Kundenhistorie im KI-Prompt**: `lib/kunden-historie.ts` (neu)
  lädt letzte 5 Kundenanfragen desselben Absenders mit Zusammenfassung +
  gewerk_match. Neuer Block „FRÜHERE ANFRAGEN DIESES KUNDEN" im
  Entwurfs-Prompt mit Anweisung „persönlicher formulieren – aber nur
  wenn es natürlich passt, nicht erzwungen". Premium-Wow für Stammkunden.
- ✅ **„Auftrag annehmen"-Button + API**: `/api/anfragen/[id]/passt-doch`
  (neu) – setzt gewerk_match=passt + löscht alten Entwurf + ruft
  generiereEntwurf neu auf mit `ownerBestaetigtPassend=true` Override-Flag.
- ✅ **Owner-Override-Prompt** in lib/entwurf.ts: wenn Flag gesetzt →
  fetter ⚠️-Block ganz oben im User-Prompt: „Owner hat bestätigt →
  ECHTE ZUSAGE, KEINE Absage, ignoriere deine eigene Branchen-Einschätzung."
  Bug-Fix: gewerk_match=passt im Klassifikations-Block reicht NICHT –
  Sonnet würde sonst aus dem Anfrage-Text selbst ableiten „eher Glaserei".
- ✅ **Banner-Style** (Polish-Pass nach Max-Feedback): Amber-Banner
  ÜBER dem Konversations-Grid statt inline neben den Badges. Klare
  2-Zeilen-Begründung („KI ist unsicher … Wenn du den Auftrag machen
  willst, schreibt die KI in 5 Sek einen neuen Entwurf als Zusage").
  Button-Text: „Auftrag annehmen".

#### Sprint 6 – Polish-Welle (Confirm + Loading + Notiz + Stale)
- ✅ **Brand-ConfirmDialog**: `components/ui/confirm-dialog.tsx` (neu) –
  ConfirmProvider + useConfirm-Hook, Promise-basierte API. radix-Dialog
  mit destructive-Variante für Lösch-Aktionen. 13 Stellen umgestellt:
  anfrage-quick-menu (softDelete + sperreSender), detail-actions
  (softDelete), passt-doch-button, gmail-connection-card, profil-form
  (stilbeispiel-remove), kalender/wochengrid (termin-absage + regel +
  sperre), regel-editor, sperre-editor, papierkorb-item-actions
  (hardDelete), kunde-sperren-button. Browser-natives `confirm()` komplett
  raus aus User-Pfaden.
- ✅ **Loading-Hint in Anfrage-Detail**: bei `status='neu'` UND `<5 Min alt`
  UND noch kein Entwurf → dezente Pulsing-Card „KI arbeitet noch dran".
- ✅ **Migration `20260607_anfragen_notiz.sql`**: `anfragen.notiz` TEXT.
- ✅ **NotizEditor** (`app/dashboard/anfragen/[id]/notiz-editor.tsx` neu):
  Auto-Save beim Blur, "speichern…/gespeichert"-Status-Indicator. Für
  Telefonat-Erinnerungen, Kunden-Eigenheiten – nicht in Mails sichtbar.
  API erweitert: PATCH `{notiz}`.
- ✅ **Stale-Indikator**: `staleTage()`-Helper in `app/dashboard/page.tsx`
  basiert auf `entwuerfe.versendet_am` (Fallback created_at), Threshold
  7 Tage. In Inbox-Karte: amber border-left + Pill „wartet seit X Tagen".
  Owner sieht direkt welche Mails Nachfass brauchen.

#### Strategie + Doku Updates
- ✅ **IDEEN-EISSCHRANK.md erweitert**: Max-Brainstorming Tag 18
  (Flugzeug-Session, mit Bierchen) dokumentiert. 4 Feature-Ideen
  (Marketing-Säule 4 mit 10k€-Kammer-Pain, Säule-3-erweitert
  „Projekt-Assistent", Compliance-Checkliste mit Haftungs-Warnung,
  Preisrecherche mit Säule-2-Add-on-Variante).

### Tag 18 (4.6.2026): Max-Pilot LIVE + 3 Sprints + Bug-Fix

#### Critical Bug-Fix: Forward-Mails routen mit OriginalRecipient
- ✅ **Postmark-Webhook returnte HTTP 404 für alle Forward-Mails** weil
  `app/api/inbound/route.ts` nur `ToFull[0].Email` und `To` gelesen hat.
  Bei Forward-Mails setzt Postmark `To` auf den ORIGINAL-Empfänger laut
  Mail-Header (`info@bauelemente-rapp.com`), die echte Forward-Adresse
  (`bauelemente-rapp-2@kunden.auftragswerk.app`) liegt in `OriginalRecipient`.
  Lookup auf `betriebe.inbound_email` fand nichts → 404 → Postmark-Retry-
  Loop, alle echten Mails seit Welle G verloren.
- ✅ Fix: `payload.OriginalRecipient ||  ToFull?.[0]?.Email || To` in
  Vercel + Edge Function. Funktioniert für ALLE künftigen Kunden mit
  Forward (egal ob Gmail/Outlook/IONOS).
- ✅ Edge Function via supabase CLI re-deployed (`brew install supabase/tap/supabase`)
- ✅ Smoke-Test: Postmark Activity zeigt „Processed" statt „Retry" –
  Newsletter (community@hero-software, info@metallbau-onlineshop,
  muenchen@news.handwerk-kompakt) sowie echte Anfragen kommen seitdem an.

#### Sprint 1 – Quick-Wins aus Max-Feedback (Refresh + Tab + Was-wir-machen + Kunden-Lösch + Sender-Block + Eisschrank)
- ✅ **Refresh-Button** im Inbox-Header (`app/dashboard/inbox-refresh-button.tsx`).
  Spin-Animation während router.refresh(), kurzes „Aktuell"-Feedback.
- ✅ **Tab-Struktur flach** – Gruppen-Labels („Zu tun" / „Verfolgen" /
  „Archiv") entfernt, alle 7 Tabs gleichberechtigt nebeneinander. „Info"
  prominent als Top-Level (war vorher unter „Verfolgen" versteckt, Max
  verstand das nicht: „bestellungen anwalt etc info reiter oben besser").
- ✅ **ListEditor Textarea-UX** – „Was wir machen" / „Was wir NICHT machen"
  / „Wichtige Kunden" jetzt schlichte Textarea mit Auto-Split bei
  Zeilenumbruch/Komma/Semikolon. Vorher: Liste-mit-Add-Button pro Item.
  Lehre aus Max-Pilot (er hat alle Gewerke in 1 Zeile geschrieben):
  Handwerker lesen kein UI, jeder Klick+Add ist Reibung. Textarea = friction-frei.
- ✅ **Migration `20260604_gesperrte_sender.sql`** – RLS-geschützte
  Block-Liste pro Betrieb (idempotent DROP+CREATE für Policies, damit
  Re-Run nicht knallt).
- ✅ **API `/api/sender/sperren`** – upsert in gesperrte_sender + UPDATE
  alle bestehenden Anfragen dieses Absenders auf 'aussortiert'.
- ✅ **Inbound-Route Pre-Check** vor KI-Klassifikation – gesperrte
  Sender werden direkt als 'aussortiert' angelegt, kein Anthropic-Call,
  keine Kosten. Auch Replies eines gesperrten Senders bleiben aussortiert.
- ✅ **Kunden-Liste**: ×-Button neben jeder Karte (`KundeSperrenButton`),
  blocked Sender werden raus-gefiltert. Auto-Anlage der Kunden bleibt
  (Max sagt „passt weil nicht so viele"), Korrektur möglich.
- ✅ **IDEEN-EISSCHRANK.md** – alles geparkte strukturiert dokumentiert
  mit Triggern. Marketing-Säule 4 (KI-Video für Handwerker, 10k€-Kammer-
  Pain) ausführlich mit Tech-Stack + Markt-These + Pushback-Argumenten.
  Plus: Region/PLZ, Signatur-Rich-Text, Custom-Tags, Diktat, WhatsApp,
  Lieferantenverzeichnis – alle mit Trigger-Bedingungen wann sie aus
  dem Eisschrank kommen.

#### Sprint 2 – Region/PLZ-Tier (Region + gebiets-abhängiger Mindestwert)
- ✅ **Migration `20260604_betriebe_gebiete.sql`** – `betriebe.gebiete` jsonb,
  Array von `{plz_muster, label, mindestauftragswert}`.
- ✅ **API-Whitelist + JSON-Validierung** (plz_muster Pflicht,
  mindestauftragswert numerisch oder null).
- ✅ **Profil-Form `GebieteEditor`** – tabellen-artiger Editor mit 3
  Spalten + ↑/×-Buttons pro Zeile. Reihenfolge zählt: spezifischste
  PLZ-Bereiche oben, „*" als Wildcard unten.
- ✅ **`lib/entwurf.ts` Prompt-Block** – wenn `gebiete` befüllt → eigener
  Block in System-Prompt mit Tabelle + klaren Anweisungen (PLZ aus Anfrage
  erkennen, freundlich bei Out-of-Area-Hinweis, niemals hart ablehnen).
- ✅ **Globaler `mindestauftragswert`** bleibt als Fallback wenn
  `gebiete` leer ist (Backward-Compat).
- ✅ **Copy-Sweep**: „Match" / „Fallback" / Code-Boxen raus, alles in
  Praktiker-Sprache. Spalten: PLZ / Region / „Ab € lohnt's".

#### Sprint 3 – Sender-Sperren aus Inbox direkt
- ✅ **`AnfrageQuickMenu` erweitert** um „Absender sperren" Option.
  Heute ging Block nur über Kunden-Liste (Umweg). Jetzt direkt im
  3-Punkte-Menü der Inbox-Karte.
- ✅ Identische Logik wie KundeSperrenButton (POST /api/sender/sperren).
- ✅ `vonEmail`-Prop optional für Backward-Kompat.

### Tag 17 (3.6.2026) — STRATEGIE-Sprint mit Florian: Filter etablieren

- ✅ **STRATEGIE.md** als konsolidierte Source-of-Truth nach Diskussion
  zwischen Florian + Berater + Claude. Leitprinzip „Scale isn't about
  doing more". Filter-Fragen für jedes Feature („Macht es den Kern
  perfekter?" + „Skaliert es Multi-Tenant?"). Gestrichen: Schatten-Modus,
  Sende-Cap, Kill-Switch, Reklamations-Counter, Test-Anfragen-Onboarding.
  Geparkt: Säule 2 (Angebote), WhatsApp, Diktat, Material.
- ✅ **LP-Sofortänderungen**: Trust-Block „Deine Kunden merken nichts
  davon" als eigene Section, Header-Button Outline (Hierarchie zum
  Haupt-CTA gewahrt), Meta-Description ehrlich (nicht „designt vom
  Handwerksmeister"), Senden-Sprache („klickst frei" → „klickst auf
  Senden" weil keiner so spricht).
- ✅ **Edit-Diff Phase 1** – Migration `20260602_entwurfs_edits.sql`:
  `entwuerfe.text_original` (initialer KI-Text) + `was_edited` Boolean.
  `lib/entwurf.ts` setzt text_original beim Insert, `app/api/versand/route.ts`
  setzt was_edited beim Send (Vergleich text_original vs. body_text).
  Tooltip im Editor: „Was du änderst, hilft beim nächsten Mal."
  Daraus baut Flo später ein Diagnose-View für Edit-Patterns + manuelles
  Prompt-Tuning. Phase 2/3 (Auto-Stilbeispiel-Vorschläge, voll-auto) erst
  wenn Phase 1 Pattern zeigt.
- ✅ **`betriebe.vermeiden` Freitext-Feld** (`20260602_betriebe_vermeiden.sql`)
  als negatives Pendant zu Stilbeispielen. „Keine Gedankenstriche", „Sag
  ‚gern' statt ‚gerne'". Fließt als eigener VERMEIDEN-Block in den
  System-Prompt (höher gewichtet als positive Stilbeispiele).
- ✅ **Funktions-Tour Modal** (`components/brand/funktions-tour.tsx`) –
  beim ersten Login auf `/dashboard/willkommen` automatisch, 5 Slides
  mit echten UI-Komponenten + kuratiertem Handwerker-Mock-Content
  (statt Screenshots). Slide 4 ist der Vertrauens-Slide („Bei jeder
  Mail entscheidest du") und ersetzt jeden separaten Angst-Satz auf
  der Page. localStorage-Flag verhindert Re-Show, plus permanenter
  „Tour nochmal"-Link unten.

### Tag 16 (1.6.2026): Welle D + E + F + G – Wow, Reply-To-Premium, Mail-Empfang, Self-Service

#### Welle D – Wow-Onboarding-Page
- ✅ **`/dashboard/willkommen`** (Server Component): Hero mit Wortmarke +
  "Hi {Vorname}," (aus `betriebe.inhaber`, Split nach erstem Wort),
  Subline „In drei kurzen Schritten ist alles bereit…", 0/3-Schritte-Pill.
- ✅ **Drei OnboardingStep-Cards** mit Status-Detection (gmailDone via
  `gmail_connections.status='aktiv'`, verfuegbarkeitDone via
  `verfuegbarkeit_regel`-Count, profilDone via Was-wir-machen + Signatur):
  01 Gmail verbinden / 02 Verfügbarkeit / 03 Profil ausfüllen. Status-Icon
  + CTA-Button pro Karte.
- ✅ **"Du bist startklar"-Banner** wenn alle drei done → "Zur Inbox"-CTA.
- ✅ **First-Run-Detection** in `app/dashboard/page.tsx`: wenn
  `anfragen=[]` UND `?tab` nicht gesetzt → Parallel-Query auf
  `gmail_connections` + `verfuegbarkeit_regel` Counts. Wenn beide 0 →
  `redirect('/dashboard/willkommen')`. Sonst Inbox.
- ✅ **`components/brand/onboarding-step.tsx`** als wiederverwendbare Card.

#### Welle E.1 – Reply-To Quick-Fix
- ✅ **`app/api/versand/route.ts` + `versand/manuell/route.ts`** Reply-To-
  Hierarchie:
  ```ts
  const replyToAddress = betrieb?.inbound_email
    || (useCustomSender ? betrieb!.sender_email! : undefined)
    || process.env.POSTMARK_REPLY_TO
    || undefined;
  ```
- ✅ Damit kommt für Endkunden im Reply-To die saubere Subdomain-Adresse
  (nach Welle E.2) statt der scammy Postmark-Hex.

#### Welle E.2 – Catch-All-Subdomain `kunden.auftragswerk.app`
- ✅ **DNS bei united-domains:** MX `kunden` → `inbound.postmarkapp.com`
  Prio 10. DKIM-CNAME `20260601102721pm._domainkey.kunden` →
  `pm.mtasvc.net`. Return-Path-CNAME für die Subdomain.
- ✅ **Postmark Inbound-Domain:** `kunden.auftragswerk.app` als Inbound-
  Domain registriert, Wildcard-Route auf Webhook-URL. DKIM verifiziert.
- ✅ **`lib/slug.ts`**: `nameZuSlug()` (Umlaute ä→ae, Sonderzeichen→Bindestrich,
  Stoppwörter gmbh/ag/kg/und/der raus, max 40 Zeichen),
  `generiereEindeutigenSlug()` mit Conflict-Resolution (-2, -3 … max 99),
  `slugZuInboundEmail()`, Const `KUNDEN_SUBDOMAIN`.
- ✅ **Migration `20260601_inbound_email_subdomain.sql`**:
  PL/pgSQL `name_zu_slug()` (mirror der TS-Logik), DO-Block iteriert alle
  betriebe, setzt `inbound_email = slug@kunden.auftragswerk.app` mit
  Conflict-Resolution. UNIQUE-Index `betriebe_inbound_email_uniq`.
- ✅ **Smoke-Test:** Externe Mail an `eminded@kunden.auftragswerk.app` →
  kommt im Edge-Proxy an → erscheint im Dashboard. DKIM-Header sauber,
  kein Scammy-Hex mehr für Endkunden sichtbar.

#### Welle F – Mail-Empfang-Card
- ✅ **`app/dashboard/profil/mail-empfang-card.tsx`** mit drei Blöcken:
  - Inbound-Adresse prominent zum Kopieren (Code-Box + Copy-Button)
  - Amber-Hinweis "Damit Mails an deine Geschäftsadresse hier ankommen"
    mit Schließen-X (dismissable via localStorage
    `auftragswerk:mail-empfang-anleitung-dismissed`)
  - Akkordeon mit 4 Provider-Anleitungen: Google Workspace, IONOS,
    WordPress.com, Allgemein. Jede Anleitung Klick-für-Klick mit
    realer Subdomain-Adresse als Forward-Ziel.
- ✅ **Gmail-Connection-Card aufgeräumt**: alte Filter-Anleitung raus
  (war E.1 Workaround, obsolet nach E.2). Nur noch verbunden/fehler/leer-
  States + dezenter Hinweis "für Empfang siehe Karte unten".

#### Welle G – Self-Service-Signup + Marketing-Landing + Custom-SMTP
- ✅ **Migration `20260601_signup_trigger.sql`**: `handle_new_user()`-
  Trigger auf `auth.users` AFTER INSERT. Liest `raw_user_meta_data`
  (`betriebsname` / `inhaber` / `branche`), generiert eindeutigen Slug
  (Conflict-Loop bis -99), legt `betriebe`-Zeile mit
  `inbound_email = slug@kunden.auftragswerk.app` an, dann `profiles`-Zeile
  mit Rolle `'inhaber'`. SECURITY DEFINER + search_path = public, auth.
  Skip wenn `betriebsname` leer (Admin-Insert-Schutz).
- ✅ **`/registrieren`** (Client-Page): Form mit Email/Passwort/
  Betriebsname/Inhaber/Branche. Ruft `supabase.auth.signUp({ email, password,
  options: { emailRedirectTo, data } })`. Bei Erfolg → "Fast geschafft"-
  Screen mit "Mail an X geschickt". AGB+Datenschutz-Hinweis als Text.
- ✅ **Login-Page** "Noch keinen Account? Jetzt anmelden"-Link.
- ✅ **Marketing-Landing auf `/`** (Server Component, eingeloggte User
  weiter zu `/dashboard`): Top-Bar mit Wortmarke + Anmelden-Link, Hero
  (XXL-Headline "Anfragen kommen. **Antworten gehen raus.** Du arbeitest
  weiter."), Problem-Section (3 ProblemCards), Lösung-Section (3
  LoesungCards 01-03), So-funktionierts (3 SchrittRows), Für-Wen-
  Section (Gewerk-Pills), CTA-Banner mit Rocket-Icon, Footer. Kein
  Pricing (Pilot-Phase). Brand-DNA: Saira Condensed Headlines, Stahlblau
  Akzente, Hugeicons.
- ✅ **Custom-SMTP via Postmark** in Supabase Auth Settings:
  Host `smtp.postmarkapp.com`:587, Username/Password = Postmark Server-
  Token, Sender `info@auftragswerk.app` "Auftragswerk", Min interval 60s.
  Default-Supabase-SMTP (2 Mails/h, schlechte Deliverability) abgelöst.
- ✅ **Email-Confirmation aktiv** in Supabase Authentication →
  Sign In / Providers → Email → "Confirm email" ON.
- ✅ **Confirm-signup-Email-Template** brand-konform: weiße Card mit
  Wortmarke-Header + Tagline, "Willkommen bei Auftragswerk"-Headline,
  Stahlblau-Button "Email bestätigen" mit `{{ .ConfirmationURL }}`,
  Plain-Fallback-Link, Spam-Hinweis, Footer mit Datenschutz/AGB/Impressum.
- ✅ **Redirect-URLs in Supabase Auth Config:** `https://auftragswerk.app/**`,
  `https://auftragswerk.app/auth/callback`, `https://auftragswerk.app/passwort-neu`,
  `https://auftragswerk.vercel.app/**`, `http://localhost:3000/**`.
- ✅ **Full E2E gestestet** (florian.maendl@gmail.com → existing,
  florian.maendl@gmx.de → neu via Self-Service + Confirmation-Mail
  in GMX-Posteingang in <30s + Klick → /dashboard/willkommen mit
  "Hi Florian," + alle Onboarding-Cards funktional). Welle G grün.
- ✅ **URL an Max raus** an diesem Abend (1.6.2026 ~20:30):
  `https://auftragswerk.app` → Landing → "Account erstellen".

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

## 🚧 LAUFEND: Max-Pilot-Test + Compliance-Block

**Stand 1.6.2026 abends:** Premium-Pivot-Plan komplett durch (Welle A-G).
Max hat URL bekommen — wir warten auf sein Feedback. Parallel offen:
Compliance-Owner-Aufgabe + ggf. Welle H (Custom Sender DKIM) als Premium-
Option für Kunden ohne Gmail.

### ⏳ Welle H – Custom-Sender pro Betrieb (FUTURE, falls Kunden ohne Gmail)
Aktuell läuft Versand 3-stufig: Gmail (OAuth) → Custom-Sender (Postmark
Sender Signature) → Default-Fallback `info@auftragswerk.app`. Custom-
Sender-Code (`lib/postmark-sender.ts`, `betriebe.sender_*`-Spalten) ist
fertig, aber nicht hochgehängt. Bei einem zweiten Kunden ohne Gmail
relevant: Sender Signature programmatisch anlegen + DKIM-DNS-Snippets
in UI ausliefern. Niedrige Prio solange Gmail-Kunden den 90%-Fall decken.

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

**Pivot durch Welle G:** Max muss nicht mehr manuell von Flo angelegt
werden. Max bekommt URL `https://auftragswerk.app` → registriert sich
selbst → Welle-D-Wow-Onboarding führt ihn durch Gmail + Verfügbarkeit +
Profil → Welle-F-Card erklärt Weiterleitung von `info@bauelemente-rapp.com`
auf seine Subdomain-Adresse. Postmark Sender Signature + DKIM bei
WordPress.com sind komplett überflüssig.

### ✅ Erledigt vor Tag 16
- Supabase Auth-User für Max (`info@bauelemente-rapp.com`, Auto-Confirm)
- `betriebe`-Zeile: Bauelemente Rapp GmbH, Maximilian Rapp, Metallbau
  → durch Welle E.2 hat dieser Betrieb jetzt
  `inbound_email = bauelemente-rapp@kunden.auftragswerk.app`
- `profiles`-Zeile verknüpft, Login funktioniert (RLS end-to-end bewiesen)
- Postmark Sender Signature für `info@bauelemente-rapp.com` angelegt
  (jetzt als Plan-B-Fallback geparkt, nicht benötigt für Plan A)
- ⚠️ Max-Pilot-Strategie umgestellt: er nutzt **Self-Service-Anmeldung**
  (Welle G), nicht den alten manuell-angelegten Account. Sein neuer
  Self-Service-Account wird beim ersten Login erkannt + setup-geführt.

### ⏳ Tag 16+ – Plan A: Self-Service über Welle G
- [x] **URL an Max raus** (1.6.2026): `https://auftragswerk.app`
- [ ] **Max registriert sich** über `/registrieren` (Email + Passwort +
  Betriebsname + Inhaber + Branche)
- [ ] **Confirmation-Mail** kommt aus `info@auftragswerk.app` (Custom-SMTP
  via Postmark, brand-konformes HTML-Template)
- [ ] **Wow-Onboarding** zeigt 3 Schritte: Gmail / Verfügbarkeit / Profil
- [ ] **Mail-Empfang-Card im Profil**: Max sieht seine Inbound-Adresse
  `<slug>@kunden.auftragswerk.app` + WordPress.com-Forward-Anleitung
- [ ] **Forward in WordPress.com einrichten** (Max-Aufgabe)
- [ ] **Smoke-Test A** (Externe Mail an info@bauelemente-rapp.com →
  Forward → Auftragswerk-Dashboard → KI-Entwurf)
- [ ] **Smoke-Test B** (Freigabe → Send aus Max' Gmail → Empfänger sieht
  Mail aus echtem Gmail-Account, NICHT info@auftragswerk.app)
- [ ] Pilot scharfschalten – Max nutzt es im Echtbetrieb

### ⏸ Plan B (geparkt) – Custom Sender mit DKIM
Nur relevant wenn Max sagt "Gmail will ich nicht verbinden". Aktuell
nicht zu erwarten, da Gmail der einfachste Weg ist.

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

## 📋 PHASE 2: Skalierung (NACH Max-Pilot-Feedback)

> Self-Service-Signup ist mit Welle G **schon live**. Was hier noch fehlt
> ist Admin-Tooling und das Sender-Onboarding für Kunden ohne Gmail.

- [x] **Email-Verifizierung (Doppel-Opt-In)** – Custom-SMTP via Postmark,
      Email-Confirmation aktiv, brand-konformes HTML-Template (Welle G)
- [x] **Self-Service-Signup** – `/registrieren` + DB-Trigger
      `handle_new_user` legt betriebe + profiles automatisch an (Welle G)
- [x] **Marketing-Landing** auf `/` – Hero + Problem + Lösung + 3 Schritte
      + CTA (Welle G)
- [x] **Provider-spezifische Forwarding-Anleitung** – im Profil als
      Mail-Empfang-Card mit Akkordeon (Welle F)
- [ ] **Onboarding-Wizard mit Sender-Signature-Aufsetzung** für Kunden
      ohne Gmail (lib/postmark-sender.ts ist fertig, UI fehlt = Welle H)
- [ ] **Admin-Backoffice** (User-Übersicht + Kill-Switch + Billing)
- [ ] **Echte Impressum-Anschrift** (`/impressum` hat noch [Klammern]-
      Platzhalter — vor erstem zahlenden Kunden anpassen)

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
10. ✅ **Welle C: Gmail-OAuth** – Outbound aus echtem Gmail verifiziert
11. ✅ **Welle D: Wow-Onboarding-Page** `/dashboard/willkommen` (Tag 16)
12. ✅ **Welle E.1+E.2: Reply-To-Hierarchie + Catch-All-Subdomain**
    `kunden.auftragswerk.app` (Tag 16)
13. ✅ **Welle F: Mail-Empfang-Card mit Provider-Anleitungen** (Tag 16)
14. ✅ **Welle G: Self-Service-Signup + Marketing-Landing + Custom-SMTP**
    via Postmark (Tag 16) – **URL an Max raus** ✓
15. ⏳ Max registriert sich + meldet sich → Smoke-Tests im Real-Betrieb
16. ⏸ **Compliance-Block** (Owner-Aufgabe, ~3-4h): e-recht24 + DPAs +
    BVDW-AVV + echte Impressum-Anschrift
17. ⏸ Max 2-4 Wochen nutzen lassen + Feedback sammeln
18. ⏸ **Modul 8 – Google-Calendar-OAuth-Sync** (falls Max manuelles Pflegen nervt)
19. ⏸ **Welle H – Custom-Sender-Wizard mit DKIM** (falls Kunde ohne Gmail)
20. ⏸ 2. Pilot: Elektriker-Kumpel
21. ⏸ Säule 2 (Angebote) je nach Max-Feedback reaktivieren
