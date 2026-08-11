# Auftragswerk – Vollständiger Snapshot (Stand 2.7.2026)

> Alles was IST und alles was GEPLANT ist – für Prüfung + neuen Chat-Start.
> Kein Marketing, kein "Vision" – nur echte Fakten aus Code + DB + Doku.
>
> Referenz-Dateien: [BACKLOG.md](BACKLOG.md) · [INVENTUR.md](INVENTUR.md) ·
> [STRATEGIE.md](STRATEGIE.md) · [IDEEN-EISSCHRANK.md](IDEEN-EISSCHRANK.md) ·
> [VISION.md](VISION.md)

---

## 0. Wichtigste Wahrheit

Letzter Commit: **2026-06-15**. Seit ~2,5 Wochen keine Code-Änderung mehr.
Pilot Bauelemente Rapp lief am 4.6. produktiv an (Gmail + Forward), Max
hat seit dem 4.6. **5 Anfragen bekommen aber 0 Mails versendet** – er
prüft, drückt nicht Senden. Kein Pain-Signal, aber auch keine echte
Nutzung. Nächste Schritte hängen davon ab was du erst prüfen willst.

**Offen vor jedem Weiterbau:**

- Migration [supabase/migrations/20260616_angebote_empfaenger.sql](supabase/migrations/20260616_angebote_empfaenger.sql) laufen lassen
- Migration [supabase/migrations/20260616_angebote_schema_fix.sql](supabase/migrations/20260616_angebote_schema_fix.sql) laufen lassen (fixt „einleitung-column not found"-Bug)
- Migration [supabase/migrations/20260616_saeule2_rls.sql](supabase/migrations/20260616_saeule2_rls.sql) laufen lassen (RLS für angebot_bausteine, material_preise, angebote)
- Säule 2 (Angebote) in echter Nutzung testen bevor Säule 3 startet

---

## 1. Was JETZT im Produktiv-System läuft

### Live-System

| Komponente | Wert |
|---|---|
| Domain | https://auftragswerk.app |
| Hosting | Vercel (flo-maendl-s-projects/auftragswerk) |
| Datenbank | Supabase (Project-Ref `lfziiallrfnrzbgatrml`) |
| Storage-Buckets | `anhaenge`, `logos`, `kunden_dateien` |
| Edge Function | Supabase: `inbound-proxy` (Postmark-Vorsatz) |
| Mail-Service | Postmark (Server 19265866) |
| DNS-Provider | united-domains |
| GitHub | florianmaendl-prog/auftragswerk |
| Pilot #1 | Bauelemente Rapp, Slug `bauelemente-rapp-2@kunden.auftragswerk.app`, live seit 4.6.2026 |

### Cron-Jobs (Vercel, [vercel.json](vercel.json))

| Cron | Schedule | Zweck |
|---|---|---|
| `/api/cron/termine-reminder` | `0 7 * * *` | Tägl. 7 Uhr UTC – Mail an Owner mit heutigen Terminen |
| `/api/cron/wochen-report` | `0 8 * * 1` | Mo 8 Uhr UTC – Wochen-Zusammenfassung (Anfragen rein / Antworten raus / Termine) |
| `/api/cron/angebote-nachfass` | `0 10 * * 1` | Mo 10 Uhr UTC – 14-21 Tage alte versendete Angebote als Sammel-Mail an Owner |

CRON_SECRET ist in Vercel-Env gesetzt (Owner-bestätigt 13.6.).

### Provider-Hierarchie Outbound (4-stufig)

1. **Microsoft Graph** (Outlook / M365) – via [lib/microsoft.ts](lib/microsoft.ts)
2. **Gmail OAuth** (`gmail.send`) – via [lib/gmail.ts](lib/gmail.ts)
3. **Custom Postmark Sender** (verifizierte Firmen-Domain) – via [lib/postmark-sender.ts](lib/postmark-sender.ts)
4. **Postmark-Fallback** (`info@auftragswerk.app`) – via [lib/postmark.ts](lib/postmark.ts)

Alle Tokens AES-256-GCM-verschlüsselt via [lib/crypto.ts](lib/crypto.ts).
Key = `TOKEN_ENCRYPTION_KEY` env (32 Bytes base64). **Nie verlieren.**

---

## 2. Datenbank-Tabellen (aktuell)

### Kern-Objekte
| Tabelle | Zweck | Migration |
|---|---|---|
| `anfragen` | Eingehende Mail = 1 Anfrage (inkl. `notiz`, `tags`) | Grund + `20260607_anfragen_notiz.sql` + `20260616_custom_tags.sql` |
| `betriebe` | Multi-Tenant, ~25 Spalten (Stammdaten, `gebiete` jsonb, `stundensatz`, `signatur_html`, `logo_storage_path`, `vermeiden`, Mail-Config) | Grund + viele Erweiterungen |
| `entwuerfe` | KI-Antwort-Entwurf (inkl. `text_original`, `was_edited` für Edit-Diff Phase 1) | Grund + `20260602_entwurfs_edits.sql` |
| `nachrichten` | Thread pro Anfrage (in/out) | Grund + `20260528_nachrichten_message_id_unique.sql` |
| `analysen` | KI-Klassifikation (inkl. `extrahierter_termin` JSONB, `extrahierte_position`, `eskalation_erkannt`, `eskalation_grund`) | Grund + Erweiterungen |
| `anhaenge` | Datei-Anhänge (Inbound+Outbound) | `20260524_anhaenge.sql` |
| `profiles` | User ↔ Betrieb ↔ Rolle | Grund |
| `ai_runs` | Audit-Log KI-Aufrufe | Grund |
| `processing_errors` | Fehler-Log (sichtbar in Diagnose) | Grund |

### Termine + Kalender
| Tabelle | Zweck |
|---|---|
| `termine` | Aufmaß/Vor-Ort-Termin, optional standalone ohne Anfrage |
| `verfuegbarkeit_regel` | Wiederkehrend (Mo-So × Uhrzeit-Range) |
| `verfuegbarkeit_sperre` | Einmal (Urlaub, fixer Termin) |
| `kalender_busy_slots` | ⚠️ Migration da, Feature rückgebaut (P6 Google-Cal-Sync) |

### Provider-Connections
| Tabelle | Zweck |
|---|---|
| `gmail_connections` | Gmail OAuth Tokens (`gmail.send`) |
| `microsoft_connections` | Microsoft Graph Tokens (`Mail.Send`) |

### Säule 2 – Angebote
| Tabelle | Zweck |
|---|---|
| `angebot_bausteine` | Positions-Vorlagen pro Betrieb (Bezeichnung + Material + Arbeitszeit + Faktor) |
| `material_preise` | Lieferant-Preise pro Material |
| `angebote` | Angebote (JSONB positionen, status, mwst_satz, summe_netto/brutto, angebotsnummer, gueltig_bis, notiz_intern, empfaenger_*) |

**⚠️ Migration-Sync-Problem hier:** in Prod-DB fehlen möglicherweise
Spalten (letzter Bug 15.6.: `einleitung-column not found`).
`20260616_angebote_schema_fix.sql` zieht idempotent alles nach.

### Mini-CRM
| Tabelle | Zweck |
|---|---|
| `kunden` | UNIQUE per Betrieb auf email (name, firma, adresse, plz, kunde_typ, notizen) |
| `kunden_dateien` | Datei-Ablage am Kunden (aus Inbound-Anhängen + manuell Upload) |

### Weitere
| Tabelle | Zweck |
|---|---|
| `gesperrte_sender` | Block-Liste pro Betrieb |
| `custom_tags` (via `20260616_custom_tags.sql`) | Tag-Regeln + eigene Tag-Sets |
| `feedback` | User-Feedback (ungenutzt) |

### Alle Migrations (26 Stück)

<details><summary>Migrations-Liste</summary>

```
20260521_custom_sender_per_betrieb.sql
20260522_saeule2_angebote.sql
20260524_anhaenge.sql
20260524_extrahierter_termin.sql
20260524_termine.sql
20260524_termine_nullable_anfrage.sql
20260524_verfuegbarkeit.sql
20260528_nachrichten_message_id_unique.sql
20260530_gmail_connections.sql
20260601_inbound_email_subdomain.sql
20260601_signup_trigger.sql
20260602_betriebe_vermeiden.sql
20260602_entwurfs_edits.sql
20260604_betriebe_gebiete.sql
20260604_gesperrte_sender.sql
20260605_eskalation_erkannt.sql
20260607_anfragen_notiz.sql
20260615_extrahierte_position.sql
20260615_microsoft_connections.sql
20260616_angebote_empfaenger.sql          ← noch nicht ausgeführt?
20260616_angebote_schema_fix.sql          ← noch nicht ausgeführt
20260616_custom_tags.sql
20260616_kalender_busy_slots.sql          ← Feature rückgebaut, Migration bleibt
20260616_mini_crm.sql
20260616_saeule2_rls.sql                  ← ggf. noch nicht ausgeführt
20260616_signatur_html.sql
```
</details>

---

## 3. Code-Struktur (Ist-Zustand)

### API-Routes

<details><summary>Vollständige Liste</summary>

```
app/api/
├── inbound/route.ts                     Postmark-Webhook (via Edge-Proxy)
├── versand/route.ts                     Entwurf-Freigabe + Send (4-stufig)
├── versand/manuell/route.ts             Manuelle Antwort ohne Entwurf
├── anfragen/[id]/route.ts               PATCH Status / DELETE Soft-Delete + notiz
├── anfragen/[id]/nachfass/route.ts      Nachfass-Mail (7-Tage-Regel)
├── anfragen/[id]/passt-doch/route.ts    Auftrag-annehmen mit Owner-Override
├── anfragen/[id]/tags/route.ts          Tags setzen/entfernen
├── angebote/route.ts                    GET Liste / POST anlegen (auch leer)
├── angebote/[id]/route.ts               PATCH / DELETE
├── angebote/[id]/pdf/route.ts           Angebot-PDF-Export (Node runtime)
├── angebote/[id]/senden/route.ts        Angebot per Mail an Kunde
├── auth/google/(start|callback|disconnect)/route.ts   Gmail-OAuth
├── auth/microsoft/(start|callback|disconnect)/route.ts   MS-Graph-OAuth
├── betriebe/[id]/route.ts               Betriebsprofil-Update
├── cron/termine-reminder/route.ts       Vercel-Cron, CRON_SECRET-guarded
├── cron/wochen-report/route.ts          Vercel-Cron
├── cron/angebote-nachfass/route.ts      Vercel-Cron
├── cron/calendar-sync/route.ts          ⚠️ Route existiert, wird nicht mehr getriggert
├── health/route.ts                      System-Status
├── kunden/[id]/notiz/route.ts           Kunden-Notiz Auto-Save
├── kunden/[id]/dateien/route.ts         Datei-Upload + Liste
├── kunden/[id]/dateien/[dateiId]/route.ts   Datei-Download/Delete
├── profil/bausteine/route.ts + [id]     Angebots-Bausteine CRUD
├── profil/materialpreise/route.ts + [id]   Materialpreise CRUD
├── profil/logo/route.ts                 Logo-Upload
├── profil/signatur-preview/route.ts     Signatur+Logo-HTML-Preview
├── profil/tag-regeln/route.ts + [id]    Custom-Tag-Regeln
├── sender/sperren/route.ts              Sender-Block
├── termine/route.ts + [id]              Termin-CRUD
├── termine/[id]/ical/route.ts           iCal-Export pro Termin
├── verfuegbarkeit/regel/route.ts        Verfügbarkeits-Regeln
└── verfuegbarkeit/sperre/route.ts       Verfügbarkeits-Sperren
```
</details>

### Frontend (Dashboard)

```
app/dashboard/
├── page.tsx                          Inbox (7 Tabs flach, Suche, Sortierung, Stale-Indikator, Aktivitäts-Karte)
├── anfrage-quick-menu.tsx            Quick-Actions pro Anfrage-Karte
├── inbox-refresh-button.tsx          Manueller Refresh
├── inbox-sort.tsx                    Sortier-Header (Datum/Dringlichkeit/Wert/Kategorie)
├── inbox-suche.tsx                   Debounced Volltext ?q=
├── inbox-tab-title.tsx               Browser-Tab-Counter „Auftragswerk (N)"
├── dashboard-shell.tsx               Sidebar + Mobile-Menü
├── willkommen/page.tsx               Wow-Onboarding (Welle D)
├── anfragen/[id]/
│   ├── page.tsx                      Detail-View
│   ├── detail-actions.tsx            Status-Aktionen
│   ├── entwurf-editor.tsx            KI-Entwurf + Preview-Modal + Vision-Badge + Diktat
│   ├── reply-editor.tsx              Manuelle Antwort + Diktat
│   ├── antwort-bereich.tsx           Wrapper Toggle „KI-Entwurf ↔ Selbst schreiben"
│   ├── termin-card.tsx               Termin-Vorschlag/Festmachen
│   ├── notiz-editor.tsx              Interne Notiz Auto-Save
│   ├── angebot-erstellen-button.tsx  Aus Anfrage → Angebot mit KI-Generator
│   └── (weitere spezielle Sub-Cards)
├── angebote/
│   ├── page.tsx                      Liste + „Neues Angebot"-Button
│   ├── neues-angebot-button.tsx      Leeres Angebot ohne Anfrage
│   └── [id]/
│       ├── page.tsx                  Server-Component
│       ├── angebot-editor.tsx        Empfänger-Card + Positionen + Summen + Actions
│       └── senden-modal.tsx          Versand-Dialog mit Vorname-Anrede
├── kunden/
│   ├── page.tsx                      Liste + Suche + Sortierung
│   ├── kunden-suche-sort.tsx         Sort-Dropdown
│   └── [email]/page.tsx              Detail + Notiz + Datei-Liste + Lazy-Backfill
├── termine/page.tsx                  Übersicht + iCal-Export
├── kalender/
│   ├── page.tsx                      Wochen-Grid
│   ├── wochengrid.tsx                Zweispur md+/xs, click-to-edit
│   ├── regel-editor.tsx              Multi-Wochentag
│   └── sperre-editor.tsx
├── profil/
│   ├── page.tsx                      Server-Component
│   ├── profil-form.tsx               Alle Stammdaten + Stundensatz + Signatur-HTML
│   ├── email-konto-card.tsx          Provider-Card (Gmail ODER Microsoft ODER Custom)
│   ├── mail-empfang-card.tsx         Forward-Anleitungen (Welle F)
│   ├── bausteine-card.tsx            Angebots-Bausteine CRUD
│   ├── materialpreise-card.tsx       Materialpreise CRUD
│   └── (weitere Cards für Sperren/Tags/Logo)
├── diagnose/page.tsx                 processing_errors-Liste
└── papierkorb/page.tsx               Soft-Delete Recovery
```

### Lib-Module (26)

| Datei | Zweck |
|---|---|
| [lib/claude.ts](lib/claude.ts) | Anthropic Client (Sonnet 4.6 + Haiku, Multi-Block-Content mit image/document) |
| [lib/klassifikation.ts](lib/klassifikation.ts) | Haiku-Klassifikator + Termin-Extraktion + Eskalations-Erkennung |
| [lib/entwurf.ts](lib/entwurf.ts) | Sonnet-Entwurfsgenerator + Guardrails + Kundenhistorie + Bilder-Kontext |
| [lib/angebot.ts](lib/angebot.ts) | Sonnet-Angebotsgenerator + berechneSummen |
| [lib/angebot-pdf.tsx](lib/angebot-pdf.tsx) | @react-pdf/renderer Brief-Layout |
| [lib/bilder.ts](lib/bilder.ts) | Bilder + PDFs für KI (jpg/png/webp/gif + PDF), max 5, resize |
| [lib/mail-cleaner.ts](lib/mail-cleaner.ts) | Body-Bereinigung (Quotes/Signatur) |
| [lib/kunden-historie.ts](lib/kunden-historie.ts) | Letzte 5 Kundenanfragen für Entwurfs-Prompt |
| [lib/kunden-sync.ts](lib/kunden-sync.ts) | syncKundeFromAnalyse (Auto-Anlage + Lazy-Backfill) |
| [lib/postmark.ts](lib/postmark.ts) | Postmark Outbound (HTML + inline Attachments + Attachments) |
| [lib/postmark-sender.ts](lib/postmark-sender.ts) | Postmark Sender-Signature API |
| [lib/gmail.ts](lib/gmail.ts) | Gmail-OAuth Send mit multipart/alternative+related |
| [lib/microsoft.ts](lib/microsoft.ts) | MS Graph Send mit isInline + contentId |
| [lib/signatur.ts](lib/signatur.ts) | Signatur+Logo-HTML builder (CID-Embedding) |
| [lib/anhaenge.ts](lib/anhaenge.ts) | Storage-Upload/Verlinken mit Orphan-Cleanup + Storage-Key-Sanitize |
| [lib/verfuegbarkeit.ts](lib/verfuegbarkeit.ts) | getFreieSlots |
| [lib/google-calendar.ts](lib/google-calendar.ts) | ⚠️ existiert als Reserve, wird nicht mehr genutzt |
| [lib/ical.ts](lib/ical.ts) | RFC 5545 iCal-Export |
| [lib/tags.ts](lib/tags.ts) | Tag-Regel-Engine (Sender→Tag) |
| [lib/slug.ts](lib/slug.ts) | Subdomain-Slug-Generator |
| [lib/crypto.ts](lib/crypto.ts) | AES-256-GCM Token-Verschlüsselung |
| [lib/files.ts](lib/files.ts) | Client-side File→base64 + validateAttachments |
| [lib/datetime.ts](lib/datetime.ts) | Europe/Berlin Timezone-Helpers |
| [lib/supabase.ts](lib/supabase.ts), [supabase-browser.ts](lib/supabase-browser.ts), [supabase-server.ts](lib/supabase-server.ts) | Supabase-Clients |
| [lib/utils.ts](lib/utils.ts) | cn() helper |

### Standalone-Pages (kein Login)

```
app/
├── page.tsx                Marketing-Landing (Hero + Problem + Lösung + 3-Schritte + CTA)
├── icon.tsx + apple-icon.tsx   Brand-Favicon (weißes A auf Stahlblau)
├── registrieren/page.tsx   Self-Service-Signup
├── datenschutz/page.tsx    DSGVO-Standard (in jur. Prüfung)
├── agb/page.tsx            SaaS-Standard §14 BGB (in jur. Prüfung)
├── impressum/page.tsx      TMG §5 – ⚠️ Anschrift in [Klammern]-Platzhalter
├── login/page.tsx          Login + Link zu /registrieren
├── passwort-vergessen/     Reset-Flow
├── passwort-neu/           Reset-Landing
└── auth/callback/route.ts  Supabase Auth Callback
```

---

## 4. Was FERTIG ist (chronologisch, hohes Level)

### Bis Tag 20 (7.6.2026)

<details><summary>Säule 1 (Mail-Tool) + Foundation-Wellen</summary>

- **Foundation** – Tabellen, Auth, Multi-Tenant, Inbox mit 7 Tabs flach
- **Welle A** (Mobile) – 380px playable, Zweispur-Kalender
- **Welle B** (Rechtstexte) – /datenschutz, /agb, /impressum
- **Welle C** (Gmail-OAuth) – gmail.send + AES-256-GCM-Token
- **Welle D** (Wow-Onboarding) – /dashboard/willkommen mit 3 Step-Cards
- **Welle E** (Reply-To-Premium) – Subdomain `kunden.auftragswerk.app` mit MX zu Postmark
- **Welle F** (Mail-Empfang-Card) – Provider-Forward-Anleitungen
- **Welle G** (Self-Service-Signup + Marketing-Landing) – DB-Trigger `handle_new_user`
- **Tag 17** – LP-Sofortänderungen + Funktions-Tour Modal + Edit-Diff Phase 1
- **Tag 18** – Max-Pilot LIVE, OriginalRecipient-Bug-Fix, Sprint 1-3 (Refresh + Tab-Struktur + Textarea + Sender-Block + Region/PLZ-Tier + Sender-Sperren aus Inbox)
- **Tag 19 massiver Push** – Vision V1 (KI sieht jpg/png/webp/gif) + Inhalts-Guardrails + Eskalations-Erkennung + Branchen-Default-Fix + Sprint 5 (Suche + Kundenhistorie + „Auftrag annehmen"-Button mit Owner-Override) + Sprint 6 Polish (Brand-ConfirmDialog überall + Loading-Hint + Notiz-Feld + Stale-Indikator)
- **Tag 20** – Ehrliche Aktivitäts-Karte + Reply-Editor-Gleichstellung + Favicon + Multi-User-Branding-Audit
</details>

### 15.6.2026 (Premium-Foundation-Woche + Säule 2)

- **Welle P1** – Kammer/Verband-Tab, Browser-Tab-Counter, PDF-Vision
- **Welle P2** – HTML-Send mit Signatur + Logo via CID in allen 3 Routes, Logo-Upload, Email-Preview-Modal
- **Welle P3** – Custom-Tags mit Sender→Tag-Regeln, Inbox-Sortierung, Diktat (Web Speech API)
- **Welle P4** – Vercel-Cron-Setup, `termine-reminder`, `wochen-report`, `angebote-nachfass`, iCal-Export
- **Welle P5** – Mini-CRM V1 (kunden + kunden_dateien + Storage-Bucket, Lazy-Backfill für Bestandskunden)
- **Welle P6 RÜCKGEBAUT** – Google-Calendar-Sync gebaut ohne Trigger, wieder raus (Migration bleibt)
- **Brand-Audit** – alle Emojis raus aus UI + Logs
- **Säule 2 komplett** (S2.1 → S2.5):
  - S2.1 Foundation – Stundensatz + Bausteine + Materialpreise + Profil-Cards
  - S2.2 Generator + Editor + Sidebar-Nav
  - S2.3 PDF-Export (Premium Brief-Layout, KEIN Auftragswerk-Branding)
  - S2.4 Versand + Status + Mini-CRM-Archiv + Nachfass-Cron
  - S2.5 Leere Angebote ohne Anfrage + Empfänger frei editierbar
  - Bug-Fix Schema-Sync-Migration (idempotent, siehe [supabase/migrations/20260616_angebote_schema_fix.sql](supabase/migrations/20260616_angebote_schema_fix.sql))
- **Mini-CRM Bug-Fix** – Notiz + Dateien auch für Bestandskunden via Lazy-Backfill

---

## 5. Iron Rules (nicht verhandelbar)

Aus Code-Kommentaren + STRATEGIE.md + Feedback-Memories:

1. **Auftragswerk niemals sichtbar für Endkunde** – Mails aus Owners echtem Postfach, PDF-Footer ohne Auftragswerk-Branding
2. **NICHTS geht ohne Owner-Klick raus** – kein Auto-Send, keine Auto-Antwort. Jede Mail per Hand freigegeben
3. **KI baut Entwurf für ALLE** – auch bei Eskalation? Nein, bewusste Ausnahme: bei `eskalation_erkannt=true` → `manuell_pruefen` statt Entwurf
4. **KI nennt NIE Preise, NIE verbindliche Zusagen, NIE Norm-Werte, NIE Schadens-Einschätzung aus Foto, NIE medizinische/rechtliche Auskünfte** – 6 Guardrail-Regeln in [lib/entwurf.ts](lib/entwurf.ts)
5. **Empfänger am Angebot = Source of Truth** – nicht die Anfrage. PDF + Versand bevorzugen `angebote.empfaenger_*`
6. **KI-Angebotsgenerator gibt Schätzpreise, Owner setzt jeden Preis selbst** – Editor zeigt KI-Vorschlag als Hinweis
7. **Premium-Look = keine Emojis** – weder UI noch Logs noch System-Prompts. Statt 📅 → HugeiconsIcon
8. **Eine Säule nach der anderen** – nach Abschluss STOPPEN, auf Test-Feedback warten, nicht die nächste andiskutieren
9. **Eisschrank-Trigger müssen explizit fallen** – nicht antizipieren wie bei P6
10. **OAuth-Tokens MÜSSEN AES-256-GCM-verschlüsselt** – nie plain in DB/Logs
11. **TOKEN_ENCRYPTION_KEY nie verlieren** – ohne den Key sind alle Tokens tot
12. **Nie zum ERP werden** – Angebots-Entwurf ja, dann Export. Keine Rechnungen, keine Buchhaltung (GoBD-Sumpf)
13. **Nicht für Max bauen, aber auch nicht für imaginären Markt** – 2 Filter: Macht es den Kern perfekter? Skaliert es Multi-Tenant?
14. **Handwerker-Zielgruppe-Filter** – keine Superhuman/Linear-Features (Tastatur-Shortcuts, Command-Palette). Zielgruppe: 50-jähriger Praktiker ohne Tutorial
15. **Test-Routes bleiben tot** – die `test-*`-Routes wurden in Tag 14 entfernt (waren public ohne Auth-Check + hätten Anthropic-Kosten ausgelöst). NIE wieder einführen
16. **Owner-Override im Entwurfs-Prompt fett oben** – bei „Auftrag annehmen" muss KI Zusage schreiben, nicht selbst „passt nicht" ableiten

---

## 6. Was JETZT nicht funktioniert (bekannte Baustellen)

- **Angebote-Bug**: „Could not find the 'einleitung' column of 'angebote' in the schema cache" – Migration `20260616_angebote_schema_fix.sql` behebt, muss noch laufen
- **Impressum** hat noch `[Klammern]`-Platzhalter statt echter Anschrift → vor Innung/produktivem Pilot fixen
- **Rechtstexte** stehen unter „in juristischer Prüfung"-Disclaimer → e-recht24-Update ausstehend
- **Pilot #1 sendet nicht**: Max prüft, drückt nicht Senden. Kein Bug, aber auch keine echte Nutzungs-Validierung → Edit-Diff Phase 2 (Ton-Lernen) wartet bis 30+ echte Versände

---

## 7. Was JETZT geplant ist (STRATEGIE.md TEIL A + B)

### TEIL A – Kern perfekt machen (JETZT-Prio)

| Item | Status | Trigger/Wann |
|---|---|---|
| **A1 Ton-Treffsicherheit** – Dauer-Aufgabe | ⏳ läuft | Edit-Diff Phase 1 live (sammelt Daten). Phase 2 (Auto-Stilbeispiele) wartet auf 30+ Versände mit ≥20% Edit-Rate |
| **A1 Vision (Bilder)** | ✅ | Tag 19, verifiziert bei Max mit 7195 input-tokens |
| **A1 Vision (PDF)** | ✅ | Welle P1 mit Anthropic `document`-Block |
| **A1 Inhalts-Guardrails** | ✅ | Tag 19, 6 verbotene Aussage-Typen |
| **A2 Funktions-Tour Modal** | ✅ | Tag 17 |
| **A2 Reply-Editor gleichwertig** | ✅ | Tag 20 (`AntwortBereich`-Wrapper) |
| **A3 „Entwurf fertig"-Mail-Ping** | ⏸ geparkt | Trigger NICHT gefallen: Max prüft aktiv, vergisst Tool nicht |
| **A4 ROI/Aktivitäts-Karte** | ✅ | Tag 20 (ehrliche Zahlen aus DB, keine „X Stunden gespart"-Bullshit) |

### TEIL B – Marktreif für Innung

| Item | Status | Nächster Schritt |
|---|---|---|
| **B1 Microsoft/Outlook OAuth** | ✅ Foundation gebaut | Ausgeliefert am 15.6. – Pilot #2 (Elektriker) fehlt noch als Verifizierer |
| **B2 Compliance-Block** | ⏳ Owner-Aufgabe | ~3-4h: e-recht24 Premium + echte Impressum-Anschrift + DPAs (Anthropic/Supabase/Postmark/Vercel) + BVDW-AVV. Detail-Memory `compliance-pre-pilot-checkliste` |
| **B3 Referenz-Beweis** | ⏳ wartet auf Max-Nutzung | Zitat + Gesicht (Florian) auf Landing |
| **B4 Landing-Page-Feinschliff** | ✅ (Tag 17 + Tag 20 Favicon) | LP steht, keine weiteren Änderungen geplant |

---

## 8. Säulen-Roadmap (VISION.md)

| Säule | Zweck | Stand |
|---|---|---|
| **Säule 1: Mail-Tool** | Anfrage rein → KI-Entwurf → Owner freigibt → raus | ✅ production-live, Pilot #1 testet |
| **Säule 2: Angebote** | Aus Anfrage in 5 Min ein Angebot | ✅ fertig (S2.1-S2.5), noch nicht Owner-getestet |
| **Säule 3: Material-Recherche + Projekt-Assistent** | „Perplexity für Handwerker" + Montage-Checklisten | ⏸ wartet auf explizites „los" von Owner |
| **Säule 4: KI-Marketing-Studio** | Erklärvideos für Handwerker (Storyboard + Bild-Gen + Voice + Cut) | ❄️ Eisschrank – eigene Codebase, andere Brand, nicht in diesem Repo |

---

## 9. Eisschrank (IDEEN-EISSCHRANK.md – 25 Items mit Triggern)

### Aktive Trigger warten auf Pilot-Signale

| Idee | Trigger zum Bau |
|---|---|
| **Region = PLZ + Umkreis (V2 Geocoding)** | Pilot sagt „KI hat Termin in Stadt 50km weg vorgeschlagen für 500€-Job" |
| **Signatur Rich-Text + Logo** | ✅ als Welle P2 gebaut – Trigger gefallen |
| **Custom-Tags** | ✅ als Welle P3 gebaut – Trigger gefallen |
| **Kammer/Verband als Tab** | ✅ als Welle P1 gebaut – Trigger gefallen |
| **Diktat** | ✅ als Welle P3 gebaut – Trigger gefallen |
| **Mini-CRM mit Datei-Ablage** | ✅ als Welle P5 gebaut – Trigger gefallen |
| **iCal-Export** | ✅ als Welle P4 gebaut – Trigger gefallen |
| **Termin-Reminder-Cron** | ✅ als Welle P4 gebaut – Trigger gefallen |
| **Angebots-Editor (Säule 2)** | ✅ als Säule 2 gebaut – Trigger gefallen |
| **Outlook / Microsoft Graph OAuth** | ✅ am 15.6. gebaut – Foundation da |
| **Google-Calendar-OAuth-Sync** | ❌ als P6 gebaut, wieder rückgebaut (Trigger war NICHT gefallen) |
| **Baustein-Pricing-Modell** | Nach 3-5 Pilots wenn Pricing-Phase ansteht |
| **Kalender optional framen** | ≥3 von 5 Pilots sagen „pflege ich nicht" |
| **Auto-Refresh Inbox** | ≥2 Pilots sagen „nervt manuell" |
| **WhatsApp-Channel** | Pilot #2 (Elektriker) fragt explizit ODER mehrere sagen „Hauptkanal" |
| **OAuth-Lesen statt Forward** | ≥3 von 5 Pilots am Forward scheitern. CASA-Audit-Pflicht (~5-8k€/Jahr) |
| **„Entwurf fertig"-Ping** | Max sagt „vergesse ständig reinzuschauen" – bisher NICHT gefallen |
| **Lieferantenverzeichnis** | Niedrigste Prio – keine echte Lücke |

### Warten auf Substanz + Interviews

| Idee | Blocker |
|---|---|
| **Compliance-/Norm-Checkliste** | Anwalt-Review-Budget (~1-2k€) + ≥3 Pilots fragen explizit + STRATEGIE A1 Guardrails als Basis (✅ da) |
| **Preisrecherche-Tool** | Warte auf Säule 2 + ≥30 abgegebene Angebote in DB → dann aus eigener Historie lernen |
| **Marketing-Vision (YouTube/Reels/IG/FB)** | Max 4 Wochen produktive Nutzung + 1 konkrete Story + Pricing entschieden + min 1-2 Reserve-Pilots |
| **Säule-3 (Projekt-Assistent)** | Säule 1 bei ≥2 Pilots + ≥2 Pilots im Interview „ja, würde ich nutzen" |
| **Säule 4 (Marketing-Studio)** | Säule 1 bei ≥3 Pilots produktiv + Geld + eigene Brand entschieden |

---

## 10. GESTRICHEN (STRATEGIE.md TEIL D – kein Re-Visit)

- Schatten-/Beobachten-Modus (Architektur löst das Problem schon)
- Sende-Cap pro Stunde (Auto-Versand gibt es nicht)
- Kill-Switch (siehe oben)
- Reklamations-Counter (Mindestanspruch, kein USP)
- Test-Anfragen-Onboarding (zu nervig)
- Telefon-Feature (parallel zum Tool, kein Hebel)
- Bild-Logo (Wortmarke reicht)
- Push-Infrastruktur (Overkill, Mail-Ping reicht)
- Einzelfall-Hacks (nichts nur-für-Max bauen)
- Gmail-Style Folder-Drag&Drop (overkill)
- **Google-Calendar-Sync** (P6 rückgebaut – kein Trigger + CASA-Aufwand)

---

## 11. Strategische Entscheidungen (TEIL E – NACH Pilot-Feedback)

| Entscheidung | Trigger | Status |
|---|---|---|
| **Forward abschaffen via OAuth-Lesen** (gmail.readonly / Mail.Read) | ≥3 von 5 Pilots am Forward scheitern | ⏸ Trigger nicht gefallen. CASA-Kosten ~5-8k€/Jahr + Pub/Sub-Setup + IMAP-Polling für IONOS/GMX bleibt |
| **„Entwurf fertig"-Ping bauen** | Max sagt „vergesse Tool" | ⏸ Trigger NICHT gefallen – Max prüft aktiv |

---

## 12. Nächste vernünftige Schritte (mein Vorschlag – zur Diskussion, kein Auftrag)

### Sofort vor jedem Weiterbau
1. **3 Migrations in Supabase laufen lassen** (siehe Abschnitt 0)
2. **Säule 2 selbst testen**: leeres Angebot anlegen + Positionen + PDF + Versand-Modal
3. **Impressum-Anschrift** durch echte ersetzen (30 Sek)

### Wenn Säule 2 in Ordnung ist – 3 Optionen

**Option A: Weiter Säule 1 polieren**
- Ton-Lernen Phase 2 (wenn Max sendet)
- Compliance-Block (Owner-Aufgabe)
- Referenz-Beweis (Zitat + Foto)
- **Empfehlung**: nur wenn Max jetzt aktiv wird

**Option B: Säule 3 starten (Projekt-Assistent)**
- Materialrecherche + Montage-Checkliste via Claude+Web-Search
- **Blocker**: Pilot #2 fehlt. Bauen für 1 Kunden ist Symptomfix
- **Empfehlung**: nicht ohne Pilot-#2-Interview

**Option C: Pilot #2 akquirieren + parallel Compliance-Block**
- Elektriker mit Outlook wäre ideal (validiert MS Graph)
- Compliance läuft (~3-4h Owner-Zeit)
- **Empfehlung** aus STRATEGIE.md-Logik: **Option C**. Ohne Pilot #2 baust du weiter auf Verdacht

---

## 13. Live-Test-Reihenfolge (was du gerade tun kannst)

1. In Supabase SQL Editor: 3 Migrations ausführen (Angebote-Empfänger + Schema-Fix + Säule-2-RLS)
2. Dashboard öffnen: `/dashboard/angebote` → „Neues Angebot" klicken → Empfänger tippen → Position dazu → Speichern → PDF → Versand-Modal → Testmail an dich selbst
3. Falls Fehler: exakter Text an mich, ich fixe
4. Falls funktioniert: Säule 2 als „testreif" markieren, dann Prio-Diskussion (Option A/B/C oben)

---

## 14. Doku-Files – wo was steht

| Datei | Was drin steht |
|---|---|
| [BACKLOG.md](BACKLOG.md) (1214 Zeilen) | Chronologisch alle Wellen mit Details pro Tag + „Stand-Block" oben |
| [INVENTUR.md](INVENTUR.md) (966 Zeilen) | System-Snapshot: Tabellen, API-Endpoints, UI-Struktur, Iron Rules |
| [STRATEGIE.md](STRATEGIE.md) (457 Zeilen) | TEIL A (JETZT) + TEIL B (Marktreif) + TEIL C (Geparkt) + TEIL D (Gestrichen) + TEIL E (Entscheidungen) + TEIL F (Reihenfolge) |
| [IDEEN-EISSCHRANK.md](IDEEN-EISSCHRANK.md) (345 Zeilen) | 25 Items mit Triggern zum Aufwecken |
| [VISION.md](VISION.md) (203 Zeilen) | 3-Säulen-Plan + Komplett-Software-Brainstorming (20.5.) + Pricing-Idee + Vertriebskanäle |
| [AGENTS.md](AGENTS.md) (5 Zeilen) | Kurzer Verweis auf Next.js-Version + Docs-Ordner |
| [CLAUDE.md](CLAUDE.md) (1 Zeile) | `@AGENTS.md` |

Plus 30+ Memory-Dateien in `~/.claude/projects/-Users-flomandl-Code-auftragswerk/memory/`
mit gesammeltem Feedback + Iron Rules.
