# Auftragswerk – Backlog

> **Stand: 23.5.2026 (Tag 12)** – Säule 1 production-live, Max-Pilot-Setup im Gange.
>
> **Strategie-Update:** Max testet Säule 1 **sofort** (parallel zu allem anderen),
> nicht erst nach Säule 2 + 3. Validierung am realen Nutzer schlägt theoretische
> Komplettheit.

---

## ✅ FERTIG

### Säule 1 – Mail-Workflow
- Production-Deploy auf Vercel mit Custom-Domain auftragswerk.app
- Mail-Pipeline End-to-End: Inbound → KI-Klassifikation → KI-Entwurf → Versand
- Threading via References + In-Reply-To Header (Postmark Message-ID Transform fix)
- Reply-To gesetzt → Kunden-Antworten kommen zurück in den Thread
- KI baut Entwurf für ALLE Kundenanfragen (auch passt_nicht → höfliche Absage)
- Reply-Editor immer verfügbar für manuelle Antworten
- Folge-Nachrichten "Weitere Nachricht senden" im laufenden Gespräch
- Erledigt-Button + Status-Dropdown + Papierkorb
- Supabase SMTP via Postmark → Magic-Links landen nicht im Spam
- Domain auftragswerk.app verifiziert in Postmark (DKIM + Return-Path)
- Custom Sender pro Betrieb verdrahtet (sender_email + sender_verified Logik in versand-Routes)
- Login: Email + Passwort (Magic-Link bleibt als Backup)

### Tag 11–12: KI-Qualität, Sicherheit, Härtung
- ✅ **Reply-Status-Bug:** `reply_eingegangen` wird nicht mehr vom KI-Entwurf überschrieben (Commit `7b68145`)
- ✅ **M1 Webhook-Auth:** Inbound-Webhook mit HTTP Basic-Auth gegen Fremd-POSTs abgesichert (`6c0fd3a`)
- ✅ **KI-Reply-Kontext:** bei Replies bekommt `generiereEntwurf` den kompletten Thread chronologisch + neuer Prompt-Block ("Bestätigungen erkennen, nicht wiederholen, knapper Dialog-Stil") (`d0af363`)
- ✅ **Robustes JSON-Parsing** + Null-Safety + Diagnose-Logs in entwurf.ts (`1efc4e9`)
- ✅ **Mail-Cleaner** immer für Anzeige (Quotes/Signatur strippen bei eingehenden Nachrichten) + für KI-Thread-Input (`3bfc027`)
- ✅ **Threading-Härtung:** eigene UUID-Message-ID statt Postmark-fabriziert → On-Wire-ID matcht garantiert mit DB-Eintrag (`75ce48d`, verifiziert in Gmail-Headern)
- ✅ **DMARC-Eintrag** für auftragswerk.app (`p=none`, Monitor-Mode) bei united-domains

---

## 🚧 LAUFEND: Max-Pilot Go-Live (Bauelemente Rapp GmbH)

### ✅ Erledigt
- Supabase Auth-User für Max angelegt (`info@bauelemente-rapp.com`, Auto-Confirm)
- `betriebe`-Zeile: Bauelemente Rapp GmbH, Maximilian Rapp, Metallbau, `inbound_email=info@bauelemente-rapp.com`
- `profiles`-Zeile: User-UID ↔ Betrieb verknüpft (Rolle `inhaber`)
- RLS-Policies geprüft (`current_betrieb_id()`-Pattern, sauber)
- Login-Test: Max kann sich einloggen, sieht leere Inbox (RLS bestätigt end-to-end)
- Postmark Sender Signature angelegt für `info@bauelemente-rapp.com`

### ⏳ Wartet auf Max (Wochenende offen)
- [ ] Bestätigungsmail von Postmark im Gmail klicken (→ Sender-Adresse "Confirmed")
- [ ] DKIM-TXT + Return-Path-CNAME bei **WordPress.com DNS** eintragen
  - DKIM Host: `20260522151818pm._domainkey` (Typ TXT, Wert kommt aus Postmark "DNS Settings")
  - Return-Path Host: `pm-bounces` (Typ CNAME, Ziel `pm.mtasv.net`)
- [ ] DMARC bei `bauelemente-rapp.com` prüfen / `p=none`-Record bei WordPress.com setzen (analog zu auftragswerk.app)
- [ ] **Gmail-Weiterleitung** einrichten: `info@bauelemente-rapp.com` → Postmark-Hex-Inbound-Adresse
  - Bestätigungscode aus Postmark-Activity holen, in Gmail eingeben
  - "Kopie im Posteingang behalten" anhaken (damit Max alles weiter in Gmail hat)

### ⏳ Dann (Flo, nach Max' DNS)
- [ ] Wenn Postmark "fully verified" zeigt: `UPDATE betriebe SET sender_verified=true, sender_email=..., sender_name=..., sender_domain=..., postmark_signature_id=...`
- [ ] **Smoke-Test A** (Inbound): Testmail an `info@bauelemente-rapp.com` → muss im Dashboard auftauchen, Postmark-Activity zeigt geparstes `To` korrekt
- [ ] **Smoke-Test B** (Outbound + Threading): Reply senden → Header beim Empfänger prüfen: `From: Bauelemente Rapp GmbH <info@bauelemente-rapp.com>`, DKIM PASS, Message-ID `<uuid@bauelemente-rapp.com>`
- [ ] **Ein-Seiten-Spickzettel für Max** schreiben (Login-URL, 3 Tabs, Entwurf-Workflow, "neu laden für neue Mail")
- [ ] **Pilot scharfschalten** – Max gibt `info@bauelemente-rapp.com` weiter wie gewohnt

---

## 📋 Optional vor Pilot (mit Flo's Account testbar)

- [ ] Szenario `passt_nicht` testen (z.B. Maler-Anfrage an Metallbauer) → freundliche Absage, kein Kollegen-Tipp
- [ ] Szenario `unklar` / `manuell_pruefen` testen → Rückfrage-Entwurf statt Angebot

---

## 📋 PHASE 2: Self-Service-Onboarding (NACH Pilot)

> Bauen, wenn Max 2-4 Wochen produktiv genutzt + Feedback positiv ist.

### Self-Service-Anmeldung
- [ ] Email-Verifizierung (Doppel-Opt-In) — Passwort-Login + Reset sind schon da

### Onboarding-Wizard
- [ ] Betriebsdaten + Tonbeispiele + Signatur + Gewerke (Profil-Form als Basis)
- [ ] Sender-Signature anlegen (`lib/postmark-sender.ts` ist schon fertig dafür) + DNS-Anleitung anzeigen
- [ ] Verifikations-Button + Status-Polling
- [ ] Forwarding-Anleitung provider-spezifisch (Gmail/M365/IONOS/Strato)
- [ ] Test-Anfrage durchspielen → erst nach Vollständigkeit Workflow scharfschalten

### Admin-Backoffice (für Flo)
- [ ] User-Übersicht + Betrieb-Status (verifiziert? aktiv? letzte Aktivität?)
- [ ] Kill-Switch pro Betrieb (Pause-Modus)
- [ ] Billing-Übersicht

---

## ⏸ GEPARKT: Säule 2 (Angebot & Kalkulation)

War "nur eine Idee zur Erweiterung", nicht primärer Pilot-Bedarf. **Migration
liegt unausgeführt im Repo** (`supabase/migrations/20260522_saeule2_angebote.sql`)
und kann jederzeit reaktiviert werden, wenn Max-Feedback es priorisiert. Geplante
Tabellen: `angebot_bausteine`, `material_preise`, `angebote` + `betriebe.stundensatz`.

---

## ⏸ SPÄTER: Säule 3 (Material-Recherche)

"Perplexity für Handwerker". Konzept in VISION.md. Komplett offen, kommt frühestens
nach Säule 2 oder wenn Max das explizit braucht.

---

## 🎁 POLISH (nach Pilot, priorisieren wenn Max sagt was nervt)

### Mail-Qualität
- [ ] Logo in Mail-Signatur (HTML-Mails, CID-Embedding, Multi-Client-Tests)
- [ ] Briefkopf-Daten in Plaintext-Footer (Adresse/Tel/StNr)
- [ ] Mail-Templates pro Gewerk
- [ ] Anhänge in Replies (PDF-Angebot mitschicken)

### KI-Lernen
- [ ] Editier-Diff loggen (was hat Owner am Entwurf geändert)
- [ ] Wöchentliche Stilbeispiel-Vorschläge ("Diese 3 Mails als Stil-Beispiel?")
- [ ] Klassifikations-Korrekturen sammeln + Prompt-Regeln vorschlagen

### Dashboard
- [ ] Inbox-Suche (Volltext über Betreff + Absender)
- [ ] Filter "ungelesen / gelesen"
- [ ] Tastatur-Shortcuts (j/k navigieren, e=erledigt …)
- [ ] Statistik-Dashboard (Anfragen/Woche, Conversion, Antwortzeit)
- [ ] Auto-Refresh bei neuer Anfrage (statt manuell Cmd+R)
- [ ] **KI-Analyse-Panel** zeigt aktuell `analysen[0]` (zufällig), sollte aber **latest** sein (sort `analysiert_am DESC`) – verwirrend bei Replies sonst

### Integrationen
- [ ] Bounce-Webhook von Postmark
- [ ] Spam-Complaint Webhook
- [ ] PDF-Angebot generieren (mit Briefkopf + Logo)
- [ ] WhatsApp-Channel später (Vision)

### Multi-Tenant / Skalierung
- [ ] Pricing-Tiers (500 € / 1.000 € / 1.500 €/Monat)
- [ ] Stripe-Integration
- [ ] Mail-Volumen-Limits pro Tier
- [ ] `inbox@auftragswerk.app` per MX (saubere Inbound-Architektur statt Forwarding pro Kunde)
- [ ] SPF-Record für `auftragswerk.app` um Postmark erweitern (aktuell nur `_smtp.udag.de`; klappt nur, solange Return-Path immer `pm-bounces` ist)

---

## 🐛 Kleine offene Bugs / Verbesserungen

- [ ] Einstellungen-Seite bauen (aktuell aus Sidebar raus weil 404)
- [ ] Versand-Status-Update statt nach 5 s sofort triggern
- [ ] Confirm-Dialog beim Löschen (Soft-Delete) per-User abstellbar machen
- [ ] **Failure Mode N1:** Inbound-Webhook 404 (kein Betrieb für To-Adresse) sollte in `processing_errors` geloggt werden, nicht nur in der Server-Konsole — sonst silent fail
- [ ] DMARC-Reports von Gmail/Outlook nach 1-2 Wochen auswerten (kommen an `florian.maendl@gmx.de` via `rua=`)

---

## 📝 AKTUALISIERTE PILOT-SEQUENZ

1. ✅ Säule 1 deployt + verifiziert (Tag 1-10)
2. ✅ Reply-Bug + KI-Reply-Kontext + Threading-Härtung + Cleaner + Webhook-Auth + DMARC (Tag 11-12)
3. 🚧 **Max-Account angelegt, wartet auf Mail-Setup (DKIM, Forwarding) übers Wochenende**
4. ⏸ Smoke-Tests + Spickzettel → Pilot scharfschalten
5. ⏸ Max 2-4 Wochen nutzen lassen + Feedback sammeln
6. ⏸ Wenn validiert: Phase 2 (Self-Service-Onboarding + Admin-Backend)
7. ⏸ 2. Pilot: Elektriker-Kumpel
8. ⏸ Säule 2 (Angebote) je nach Max-Feedback reaktivieren
