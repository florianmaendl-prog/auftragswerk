# Auftragswerk – Backlog

> **Stand: 24.5.2026 (Tag 13 – Abend, Edge-Proxy + Bugfix-Sprint + Kalender-Klickbar durch)**
>
> Säule 1 production-live. Max-Pilot-Setup wartet weiter auf Max' DNS.
> Heute: Postmark-Webhook über **Supabase Edge Function** (Foto-Anhänge
> bis 25 MB), drei Tag-12-Bugs gefixt (Mitbringsel-Floskeln raus, Timezone
> sauber als Europe/Berlin, Kalender zeigt bestätigte Termine), und der
> **Kalender ist endlich klickbar** – jede Zelle (leer/grün/rot/blau)
> öffnet einen Aktions-Dialog, Standalone-Termine ohne Anfrage gehen.
>
> **Premise:** Tool soll "Premium" werden, nicht zu schmal bleiben – statt
> auf Max zu warten, proaktiv die Anfrage-bis-Termin-Brücke geschlossen.

---

## ✅ FERTIG

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

## 🚧 LAUFEND: Max-Pilot Go-Live (Bauelemente Rapp GmbH)

### ✅ Erledigt
- Supabase Auth-User für Max (`info@bauelemente-rapp.com`, Auto-Confirm)
- `betriebe`-Zeile: Bauelemente Rapp GmbH, Maximilian Rapp, Metallbau
- `profiles`-Zeile verknüpft, Login funktioniert (RLS end-to-end bewiesen)
- Postmark Sender Signature für `info@bauelemente-rapp.com` angelegt

### ⏳ Wartet auf Max (Wochenende offen)
- [ ] Bestätigungsmail von Postmark im Gmail klicken
- [ ] DKIM-TXT + Return-Path-CNAME bei **WordPress.com DNS** eintragen
- [ ] DMARC für `bauelemente-rapp.com` setzen (analog zu auftragswerk.app)
- [ ] **Gmail-Weiterleitung** info@bauelemente-rapp.com → Postmark-Hex-Inbound

### ⏳ Dann (Flo, nach Max' DNS)
- [ ] `UPDATE betriebe SET sender_verified=true, sender_email=...` etc.
- [ ] **Smoke-Test A** (Inbound) + **Smoke-Test B** (Outbound + Threading)
- [ ] **Ein-Seiten-Spickzettel** für Max schreiben
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
8. 🚧 Max-Account angelegt, wartet auf Mail-Setup (Wochenende)
9. ⏸ Smoke-Tests + Spickzettel → Pilot scharfschalten
10. ⏸ Max 2-4 Wochen nutzen lassen + Feedback sammeln
11. ⏸ **Modul 8 – Google-Calendar-OAuth-Sync** (falls Max manuelles Pflegen nervt)
12. ⏸ Wenn validiert: Phase 2 (Self-Service-Onboarding + Admin-Backend)
13. ⏸ 2. Pilot: Elektriker-Kumpel
14. ⏸ Säule 2 (Angebote) je nach Max-Feedback reaktivieren
