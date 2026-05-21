# Auftragswerk – Backlog

> **Stand: 21.5.2026 (Tag 10)** – Säule 1 production-live auf https://auftragswerk.app
> – Custom-Domain aktiv, Postmark verifiziert, Threading läuft

---

## ✅ FERTIG (Säule 1: Mail-Workflow)

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

---

## 🚧 NÄCHSTER FOKUS: Säule 2 (Angebot & Kalkulation)

**Strategie (21.5.2026):**
> Wir bauen JETZT erstmal Säule 2 + 3 weiter, NICHT Self-Service-Anmeldung.
> Begründung: Erst Produkt validieren, dann skalierbar machen.
> Pilot mit Max läuft mit manuell angelegtem Account.
> Anmeldung kommt in Phase 2 nach Pilot-Feedback.

### Datenmodell
- [ ] Tabelle: `angebot_bausteine` (pro Betrieb: Positions-Templates)
  - id, betrieb_id, kategorie (geländer/treppe/tor/…), beschreibung, einheit (m/Stk/h),
    material_kosten, arbeitszeit_min, kalkulations_faktor
- [ ] Tabelle: `material_preise` (pro Betrieb)
  - bezeichnung, einheit, einkaufspreis, lieferant, datum
- [ ] Tabelle: `angebote` (generierte Angebote)
  - anfrage_id, betrieb_id, positionen[], summe_netto, summe_brutto, status

### Logik
- [ ] Angebots-Generator
  - Input: Anfrage + KI-Analyse + Bausteine + Material-Preise + Aufmaß-Notizen
  - Output: strukturiertes Angebot mit Positionen, Summen, Marge
- [ ] Marge-Konfiguration pro Baustein-Kategorie
- [ ] Mehrere Varianten generieren (Standard / Premium / Sparvariante)

### UI
- [ ] Auf Detail-Seite: "Angebot vorbereiten" Button
- [ ] Angebots-Editor: Positionen + Mengen + Preise bearbeiten
- [ ] Vorschau (PDF-mäßig)
- [ ] Export: Word/RTF/Plaintext zum Kopieren
- [ ] Pflege-UI für angebot_bausteine + material_preise im Profil

---

## 🚧 DANACH: Säule 3 (Material-Recherche)

### Logik
- [ ] Such-Endpoint: "Brauche X für Y" → Lieferanten + Preise + Specs
- [ ] Cache von Max' bevorzugten Lieferanten + bekannten Konditionen
- [ ] Web-Scraping / API-Integration zu Großhändlern (Würth, Hornbach Profi, etc.)
- [ ] Datenblatt-Suche (PDFs durchsuchen)

### UI
- [ ] Eigene Seite "/dashboard/material-suche"
- [ ] Chat-artige UI: "Was suchst du?" → "Trapezblechhalter 60mm für Aluprofil"
- [ ] Ergebnisse: Produkt + Preis + Lieferant + Datenblatt-Link
- [ ] Speichern als "Bevorzugt" für späteren Zugriff
- [ ] Optional: Direkt aus Angebot heraus aufrufen ("Material für Position 3 suchen")

---

## 📋 PHASE 2: Anmeldung & Onboarding (NACH Pilot mit Max)

> **NICHT JETZT bauen!** Erst wenn Säule 2 + 3 stehen + Max-Pilot 2-4 Wochen lief
> + Feedback positiv ist. Dann lohnt sich das.

### Self-Service-Anmeldung
- [ ] Email + Passwort Login (klassisch, Browser speichert)
- [ ] Email-Verifizierung (Doppel-Opt-In)
- [ ] Passwort-Reset-Flow
- [ ] Magic-Link bleibt als Backup-Login

### Onboarding-Wizard
Nach erster Anmeldung Schritt-für-Schritt:
- [ ] Schritt 1: Betriebsdaten (Name, Inhaber, Branche, Region)
- [ ] Schritt 2: Mail-Domain einrichten (Iron Rule: jeder bringt eigene Domain mit, wir vergeben KEINE Subdomains)
  - DNS-Records anzeigen (DKIM + Return-Path + ggf. BCC)
  - Verifikations-Button
  - Test-Mail an sich selber
- [ ] Schritt 3: Gewerke definieren (was wir machen / nicht machen)
- [ ] Schritt 4: Tonbeispiele (3-5 echte Antworten reinkopieren)
- [ ] Schritt 5: Signatur einrichten
- [ ] Schritt 6: Mindestauftragswert (optional)
- [ ] Schritt 7: Test-Anfrage durchspielen
- [ ] Erst nach Vollständigkeit Workflow scharfschalten

### Admin-Backoffice (für Flo)
- [ ] User-Übersicht
- [ ] Betrieb-Status sehen (verifiziert? aktiv? letzte Aktivität?)
- [ ] Kill-Switch pro Betrieb (Pause-Modus)
- [ ] Billing-Übersicht

---

## 🎁 POLISH & FEATURES (nach Pilot)

### Mail-Qualität
- [ ] Logo in Mail-Signatur (HTML-Mails, CID-Embedding, Multi-Client-Tests)
- [ ] Briefkopf-Daten in Plaintext-Footer (Adresse/Tel/StNr)
- [ ] Mail-Templates pro Gewerk (z.B. "Aufmaß-Termin", "Höfliche Absage")
- [ ] Anhänge in Replies (PDF-Angebot mitschicken)

### KI-Lernen
- [ ] Editier-Diff loggen (was hat Owner am Entwurf geändert)
- [ ] Wöchentliche Stilbeispiel-Vorschläge ("Diese 3 Mails als Stil-Beispiel?")
- [ ] Klassifikations-Korrekturen sammeln + Prompt-Regeln vorschlagen

### Dashboard
- [ ] Inbox-Suche (Volltext über Betreff + Absender)
- [ ] Filter "ungelesen / gelesen"
- [ ] Tastatur-Shortcuts (j/k navigieren, e=erledigt, …)
- [ ] Statistik-Dashboard (Anfragen/Woche, Conversion, Antwortzeit)
- [ ] Auto-Refresh bei neuer Anfrage (statt manuell Cmd+R)

### Integrationen
- [ ] Bounce-Webhook von Postmark
- [ ] Spam-Complaint Webhook
- [ ] PDF-Angebot generieren (mit Briefkopf + Logo)
- [ ] WhatsApp-Channel später (Vision)

### Multi-Tenant / Skalierung
- [ ] Pricing-Tiers (Größe Betrieb: 500€ / 1.000€ / 1.500€/Monat)
- [ ] Stripe-Integration
- [ ] Mail-Volumen-Limits pro Tier

---

## 🐛 KLEINE BUGS / VERBESSERUNGEN

- [ ] Einstellungen-Seite bauen (aktuell aus Sidebar raus weil 404)
- [ ] Versand-Status-Update statt nach 5s sofort triggern
- [ ] Confirm-Dialog beim Löschen (Soft-Delete) per-User abstellbar machen

---

## 📝 PILOT-SEQUENZ MIT MAX

1. ✅ Säule 1 deployen + Postmark + Custom-Domain
2. 🚧 Säule 2 bauen + erste Bausteine zusammen mit Max definieren
3. 🚧 Säule 3 bauen + Max' Standard-Lieferanten einpflegen
4. ⏸ ERST DANN: Pilot mit Max starten (manuell angelegter Account)
5. ⏸ Feedback 2-4 Wochen sammeln + Iterieren
6. ⏸ Wenn validiert: Self-Service-Onboarding bauen (Phase 2)
7. ⏸ 2. Pilot: Elektriker-Kumpel