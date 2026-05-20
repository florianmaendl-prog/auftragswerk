# Auftragswerk – Backlog

## Polish & Features (nach MVP)

### Mail-Qualität
- [ ] **Logo in Mail-Signatur** (HTML-Mails, CID-Embedding, Multi-Client-Tests)
- [ ] Briefkopf-Daten in Plaintext-Footer (Adresse/Tel/StNr)
- [ ] Mail-Templates pro Gewerk (z.B. "Aufmaß-Termin", "Höfliche Absage")
- [ ] Anhänge in Replies (PDF-Angebot mitschicken)

### Onboarding
- [ ] Self-Service-Onboarding-Flow für neue Betriebe
- [ ] Inbound-Mail automatisch via Postmark-API anlegen
- [ ] Erste Stilbeispiele aus Beispiel-Anfragen generieren lassen
- [ ] Setup-Wizard: Gewerke → Region → Mindestauftrag → Signatur

### KI-Lernen
- [ ] Editier-Diff loggen (was hat Owner am Entwurf geändert)
- [ ] Wöchentliche Stilbeispiel-Vorschläge ("Diese 3 Mails als Stil-Beispiel?")
- [ ] Klassifikations-Korrekturen sammeln + Prompt-Regeln vorschlagen

### Dashboard
- [ ] Inbox-Suche (Volltext über Betreff + Absender)
- [ ] Filter "ungelesen / gelesen"
- [ ] Tastatur-Shortcuts (j/k navigieren, e=erledigt, …)
- [ ] Statistik-Dashboard (Anfragen/Woche, Conversion, Antwortzeit)

### Integrationen
- [ ] Bounce-Webhook von Postmark
- [ ] Spam-Complaint Webhook
- [ ] PDF-Angebot generieren (mit Briefkopf + Logo)
- [ ] WhatsApp-Channel später (Vision)

### Multi-Tenant / Skalierung
- [ ] Pricing-Tiers (Größe Betrieb)
- [ ] Stripe-Integration
- [ ] Admin-Backend für Pilot-Onboarding
- [ ] Mail-Volumen-Limits pro Tier

---

## STRATEGISCHE NEUAUSRICHTUNG (20.5.2026 Abend)

**Insight:** Wir haben Säule 1 (Mail-Workflow) fertig, aber Auftragswerk verspricht 
3 Säulen. Pilot mit Max erst sinnvoll wenn alle 3 stehen.

### Säule 2: Angebot & Kalkulation (Juni)

#### Datenmodell
- [ ] Tabelle: `angebot_bausteine` (pro Betrieb: Positions-Templates)
  - id, betrieb_id, kategorie (geländer/treppe/tor/…), beschreibung, einheit (m/Stk/h), 
    material_kosten, arbeitszeit_min, kalkulations_faktor
- [ ] Tabelle: `material_preise` (pro Betrieb)
  - bezeichnung, einheit, einkaufspreis, lieferant, datum
- [ ] Tabelle: `angebote` (generierte Angebote)
  - anfrage_id, betrieb_id, positionen[], summe_netto, summe_brutto, status

#### Logik
- [ ] Angebots-Generator
  - Input: Anfrage + KI-Analyse + Bausteine + Material-Preise
  - Output: strukturiertes Angebot mit Positionen, Summen, Marge
- [ ] Marge-Konfiguration pro Baustein-Kategorie
- [ ] Mehrere Varianten generieren (Standard / Premium / Sparvariante)

#### UI
- [ ] Auf Detail-Seite: "Angebot vorbereiten" Button
- [ ] Angebots-Editor: Positionen + Mengen + Preise bearbeiten
- [ ] Vorschau (PDF-mäßig)
- [ ] Export: Word/RTF/Plaintext zum Kopieren
- [ ] Pflege-UI für angebot_bausteine + material_preise im Profil

### Säule 3: Material-Recherche (Juli)

#### Logik
- [ ] Such-Endpoint: "Brauche X für Y" → Lieferanten + Preise + Specs
- [ ] Cache von Max' bevorzugten Lieferanten + bekannten Konditionen
- [ ] Web-Scraping / API-Integration zu Großhändlern (Würth, Hornbach Profi, etc.)
- [ ] Datenblatt-Suche (PDFs durchsuchen)

#### UI
- [ ] Eigene Seite "/dashboard/material-suche"
- [ ] Chat-artige UI: "Was suchst du?" → "Trapezblechhalter 60mm für Aluprofil"
- [ ] Ergebnisse: Produkt + Preis + Lieferant + Datenblatt-Link
- [ ] Speichern als "Bevorzugt" für späteren Zugriff
- [ ] Optional: Direkt aus Angebot heraus aufrufen ("Material für Position 3 suchen")

### Sequenz für Pilot mit Max
1. Säule 1 deployen + Postmark + Custom-Domain
2. Säule 2 bauen + erste Bausteine zusammen mit Max definieren
3. Säule 3 bauen + Max' Standard-Lieferanten einpflegen
4. ERST DANN: Pilot mit Max starten
