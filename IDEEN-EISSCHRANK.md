# Auftragswerk – Ideen-Eisschrank

> **Zweck:** Ideen die wir bewusst NICHT jetzt bauen — aber auch nicht
> verlieren wollen. Alles hier wartet auf Validierung durch echte Nutzer
> (Max-Pilot + Pilot #2) bevor es priorisiert wird.
>
> **Leitsatz aus STRATEGIE.md:** *Scale isn't about doing more. It's
> about removing everything that isn't worth doing — then doing as much
> as you can of what's left.*
>
> Reihenfolge gilt: erst Säule 1 (Mail) wirklich perfekt → dann nächste
> Säule. **Nichts aus dieser Datei** kommt vor abgeschlossenem
> Max-Pilot-Feedback (4-8 Wochen Realbetrieb).

---

## Säule 4 (NEU) — KI-Marketing-Studio für Handwerker

**Trigger der Idee:** Max-Feedback Tag 18. Handwerkskammer schickte ein
Erklärvideo, das laut Kammer **10.000 €** kosten würde. Realer Pain, real
großer Markt, KI-Video-Generation ist 2026 produktionsreif.

### Konzept

Owner-Workflow:
1. Owner lädt Story-Skelett hoch (text) oder beschreibt sein Gewerk
2. KI baut Storyboard (Szenen mit Text)
3. Bilder werden generiert (Sora/Veo/Midjourney) oder Owner lädt eigene
   Baustellen-Fotos hoch
4. Bilder → Video via Image-to-Video-Model
5. Voice via ElevenLabs (deutsche Stimme, Handwerker-Charakter)
6. Auto-Cut via ffmpeg
7. Owner kriegt fertiges 60-90s Erklärvideo

### Tech-Stack 2026

| Schritt | Tool | Kosten/Video |
|---|---|---|
| Story | Claude/GPT | <0.10 € |
| Bild-Gen | Sora 2 / Veo 3 / Midjourney | 0.50–2 € |
| Image→Video | Veo 3 / Kling 2.5 | 1–5 € |
| Voice | ElevenLabs | 0.30–1 € |
| Cut | ffmpeg (selbst) | 0 € |
| **Total Input** | | **~3–8 €** |
| **Verkaufspreis** | | **~500–2000 €** |

### Markt-These

- Handwerkskammer-Preise (10k€) sind absurd
- Agenturen wollen Handwerker eh nicht (zu kleine Budgets)
- Handwerker mögen keine Agenturen (Vertrauen, "fremde Menschen")
- Self-Service mit Premium-Output = Bedarfslücke

### Pushback (warum NICHT jetzt)

1. **Auftragswerk-Mail ist NICHT fertig.** Max nutzt es seit Tag 18 real.
   Erst Säule 1 validieren.
2. **Zweites Produkt parallel = beide werden mittelmäßig.** Klassischer
   Startup-Fehler.
3. **Branding-Verwässerung.** "Auftragswerk" = Auftragsbearbeitung,
   nicht Video. Wenn man sowas baut → eigene Brand (z.B.
   `handwerkstudio.ai`).
4. **Anderer Tech-Stack** als Mail-Tool. Wenig Synergie.
5. **Validierungs-Pflicht:** vor Bau mit 5+ Handwerkern reden ob sie
   für sowas Geld ausgeben würden + wieviel.

### Trigger zum Bau

- Säule 1 (Mail) läuft bei ≥3 Pilots produktiv und bringt Geld
- ≥5 Handwerker sagen in Interviews "ja, ich würde sowas kaufen"
- Max nutzt Mail-Tool 4+ Wochen ohne Abbruch
- Brand-Strategie entschieden (eigene Domain vs. Sub-Brand)

### Wenn-dann-Architektur

- Eigene Codebase (NICHT in Auftragswerk-Repo)
- Eigene Brand + Domain
- Aber: Cross-Selling möglich (Auftragswerk-User → Marketing-Studio-Upsell)
- Pricing-Modell vermutlich: pro Video (250–500€) ODER Monats-Pakete

---

## Säule 2 — Angebots-Editor (war geparkt, bleibt geparkt)

Schon dokumentiert in STRATEGIE.md TEIL D + VISION.md. Hier nur kurz zur
Vollständigkeit:

- Migration liegt im Repo: `supabase/migrations/20260522_saeule2_angebote.sql`
- Human-in-the-loop: KI schlägt Positionen, Owner setzt jeden Preis
- ⚠️ **Scope-Falle:** nicht zum ERP werden (GoBD, E-Rechnung-Pflicht)
- Trigger: Max-Pilot zeigt dass Angebote der größte Pain sind

## Säule 3 — Material-Recherche

Konzept in VISION.md ("Perplexity für Handwerker"). Erst nach Säule 1+2.

---

## Max-Pilot-Feedback (Tag 17–18) — was geparkt ist

Hier alle Items aus Max' Feedback die NICHT in die nächsten 1-2 Sprints
gehen (alles andere wurde gleich gebaut):

### Region = PLZ + Umkreis + gebiets-abhängiger Auftragswert
**Pain ist real**, eines der besten Max-Feedback-Items. Handwerker
fahren nicht 60km für 800 €.

- **V1 (1-2 Tage Bauzeit):** PLZ-Prefix-Tier-Liste im Profil.
  Beispiel: `80*-85*` = Hauptgebiet, ab 100€; `86*-87*` = nur ab 5000€;
  `90*+` = nicht. KI-Prompt nutzt die Tiers für „passt geografisch + wert".
- **V2 (separate Welle):** Echte Geocoding-API (Nominatim gratis,
  alternativ ca. 5€/Monat) — Anfrage-Adresse → Koordinaten → Distanz
  zum Owner-Standort. Tier basierend auf km statt PLZ-Prefix.
- **V3 (Premium, eventuell nie):** Karten-Editor mit Drag-Punkt +
  Radius-Slider, visuelle Tier-Definition.

**Trigger zum Bau:** mindestens 1 Pilot sagt „die KI hat mir einen
Termin in [Stadt 50km weg] vorgeschlagen für 500€-Job" → V1 sofort
bauen.

### Signatur — Rich-Text + Logo
- Heute: Plain-Text-Textarea
- Wunsch: Fett/Größe/Spalten/Logo-Upload mit CID-Embedding
- ~1-2 Tage Bauzeit (TipTap-Editor + HTML-Send-Pfad in lib/postmark/gmail
  + Storage-Upload für Logo + CID-Embed)
- HTML-Signaturen brechen oft (Mobile-Clients, Reply-Threads)
- **Trigger:** mindestens 2 Pilots sagen „muss professioneller aussehen"

### Custom-Ordner / Custom-Tags
- Owner-definierte Tags: „Kammer", „Lieferanten", „Persönlich-wichtig"
- Plus Sender-zu-Tag-Regeln: „Absender X → Tag Y"
- ~1 Tag Bauzeit für V1 (Tags-Tabelle + UI + Regel-Engine)
- **Trigger:** mindestens 2 Pilots sagen „Kategorien reichen nicht"
- **Naming für später:** „Aufheben" / „Merkliste" — kurz, klar, kein
  Marketing-Sprech
- **NICHT bauen:** Gmail-Style Folder-Drag&Drop (overkill)

### Kammer/Verband als eigener Tab
- Heute: landet in „Info"
- Quick-Win wenn echter Pain: KI-Klassifikation `innung_behoerde` als
  eigenen Tab „Kammer/Verband" rausziehen statt in Info bündeln (~30 Min)
- **Trigger:** wenn Max sagt „Info ist gemischt", konkretes Feedback

### Baustein-Pricing (Mail = Grund + Kalender/Angebote zubuchen)
- Strategisches Pricing-Modell statt Tiers
- Vorteil: günstiger Einstieg, Up-Sell pro Modul
- **Trigger:** nach 3-5 Pilots, wenn Pricing-Phase ansteht
- **Konkurrenz:** klassische SaaS-Tiers (49€/99€/199€) sind einfacher
  zu kommunizieren

### Kalender als „optional" framen (Max sagt: nutzt nicht jeder)
- **Florian-Entscheidung Tag 18:** Kalender bleibt Pflicht-Feature.
  Max ist 1 Datenpunkt, nicht der Markt. Feature ist geil.
- Re-Evaluieren wenn ≥3 von 5 Pilots sagen „pflege ich nicht"

### Auto-Refresh bei neuer Anfrage
- Heute: manueller Refresh-Button (Tag 18 gebaut)
- Auto-Refresh würde Polling-Last + Komplexität bringen
- **Trigger:** wenn ≥2 Pilots sagen „nervt manuell"
- Alternative: WebSockets / Supabase Realtime → eleganter aber Aufwand

---

## Max-Brainstorming Tag 18 (Flugzeug-Session, mit Bierchen 🍻)

Max + Florian sind nach Pilot-Tag-1 ins Träumen geraten. **Pattern-Erkennung:** Pilot fühlt sich richtig an → Big-Picture-Modus. Trigger fürs Eis-Schmelzen: erstmal Tag 19+ produktive Nutzung mit konkreter Story-Validierung. NICHTS davon vor Säule-1-Validierung.

### Marketing-Vision: Multi-Kanal-Content (YouTube/Reels/IG/FB)

**Florian-Domäne** (PPC-Manager, kennt organischen Content), aber:
- **YouTube-Video „wie es funktioniert"** + **„wie easy einrichten"** + Reels-Adaption für IG/FB/Shorts
- **Gratis Probemonat** als Pricing-Anker
- **Plattform** wo Mehrwert + Zeitersparnis erklärt wird (= eigene Landing-Page-Sektion / Microsite)

**Bedingungen vor Bau:**
1. **Substanz vor Marketing:** vor dem ersten Video braucht's eine echte Story („Max hat 5h/Woche gespart" mit Beleg). Vorher = leerer Pitch.
2. **Max als Testimonial > Florian als Promoter:** authentischer Handwerker vor Kamera schlägt jeden polierten Pitch. Florian macht Production, Max steht im Bild.

**Trigger:**
- Max 4 Wochen produktive Nutzung + 1 konkrete Story („Auftrag X, der sonst weg gewesen wäre")
- Pricing-Modell entschieden (für Probemonat-Logik)
- Min 1-2 Reserve-Pilots in Pipeline (sonst „Marketing für 1 Kunden")

### Säule-3-Erweiterung: Projekt-Assistent (Recherche + Montage-Checkliste)

Verschmelzung aus zwei Max-Ideen:
- **„Was brauche ich für die Montage von [X]?"** → KI generiert Material- + Werkzeug-Liste
- **„Was muss ich beachten für [Projekt-Typ]?"** → Recherche-Tool für unbekannte Bereiche („mache ich selten, was ist State of the Art?")

**Tech-Stack:**
- Claude/GPT mit Web-Search-Tool-Use
- Optional eigene Wissensbasis: pro Gewerk kuratierte Checklisten als Grundlage, KI passt an Projekt-Spezifika an
- Output: strukturierte Checkliste mit Quellenangaben

**Markt-Validierung erst:** ist das ein „nice-to-have" oder ein echter Workflow-Hebel? Frage in Pilot-Interview.

**Trigger:**
- Säule 1 läuft bei ≥2 Pilots
- Mindestens 2 Pilots in Interview: „ja, würde ich nutzen"
- (Optional) Säule 2 (Angebote) läuft schon – als Add-on im Angebots-Flow elegant integrierbar

### Compliance-/Norm-Checkliste ⚠️ HAFTUNGS-WARNUNG

Max-Idee: KI hilft bei Norm-Compliance (z.B. „Stababstand bei Geländer darf nie >120mm sein", „Dübel brauchen Zulassung").

**WARNUNG – darf nicht in der Form gebaut werden wie gedacht:**
Wenn KI verbindlich sagt „110mm ist ok" + Owner verbaut + Unfall (Kind klettert durch) → wer haftet? Genau die Sorte verbindliche Auskunft die wir bei Inhalts-Guardrails (STRATEGIE A1) explizit AUS dem Antwort-Tool raushalten wollen. **AGB-Anpassung + Haftungs-Klausel + Anwalt-Review zwingend.**

**Wenn überhaupt → strikt als Informations-Pointer:**
- *„Diese Themen solltest du prüfen: Stababstand (DIN 18065), Dübel-Zulassung (DIBt)"* – Hinweis auf Normen, KEINE Werte
- Owner bestätigt explizit „Norm-Prüfung ist meine Verantwortung" beim Onboarding
- Disclaimer überall sichtbar

**Trigger:**
- Anwalt-Review-Budget freigegeben (~1-2k€)
- Klare Inhalts-Guardrails als Grundlage (= STRATEGIE A1 gebaut)
- ≥3 Pilots fragen explizit danach (sonst Disziplin: nicht bauen)

### Preisrecherche-Tool

Max-Idee: „Wo liege ich preislich für [Projekt-Typ] in [Region]?"

**Verkaufsversprechen extrem stark, Datenbasis-Problem real:**
- **Online-Konfiguratoren crawlen** → Lizenz-Risiko, Endkundenpreise ≠ Handwerker-Ausgangspreise
- **Plattform-Daten aggregieren** → DSGVO! Geht nur mit explizitem Opt-In + Anonymisierung
- **Manuell pflegen** → skaliert nicht

**Smartere Variante (warten auf Säule 2):**
Wenn Säule 2 (Angebote) läuft, kann KI aus Owners EIGENEN Vergangenheits-Angeboten Empfehlungen generieren:
*„Du hast bei 3 ähnlichen Carport-Projekten zwischen 8k und 12k geboten. Diesmal Empfehlung: ~10k."*
- Keine fremden Daten, kein DSGVO-Issue
- Lernt automatisch mit jedem neuen Angebot
- Owner-Branchen-Markt-Wert in seiner eigenen Historie

**Trigger:**
- Säule 2 (Angebote) läuft mit ≥30 abgegebenen Angeboten in der DB
- Owner pflegt Preise konsequent → KI hat Datenbasis

---

## Sonstige Ideen (aus früheren Brainstormings)

### Diktat / Speech-to-Text → fertige Mail
- Mehrwert: „Sprache → fertige Mail" (gebrabbeltes → saubere Antwort
  im Ton via Whisper + Entwurf-Prompt)
- Aber: Handy-Tastatur-Diktat geht heute schon ohne uns
- **Trigger:** mindestens 2 Pilots sagen explizit „will diktieren"

### WhatsApp-Channel
- Real im Handwerk (Privatkunden schicken Fotos per WA)
- Aber: Business API = Meta-Approval + BSP + Template-Freigaben =
  Wochen, laufende Kosten
- **Sprengt Kern-Annahme** „Antwort aus Owners echtem Postfach" —
  bei WA ist Absender eine Nummer (wessen?)
- **Trigger:** Pilot #2 (Elektriker) fragt explizit oder mehrere Pilots
  sagen "WhatsApp ist mein Hauptkanal"

### Outlook / Microsoft Graph OAuth
- Schon in STRATEGIE.md TEIL B1 als Pflicht für Innung dokumentiert
- Architektur jetzt schon vorbereitet (`gmail_connections` mental als
  `email_connections` mit `provider`-Spalte)
- **Trigger:** Pilot #2 nutzt Outlook

### OAuth-Lesen statt Forward (= Forward-Schritt abschaffen)
- Schon in STRATEGIE.md TEIL E als „Strategische Entscheidung 1"
  dokumentiert
- Vorteil: dramatisch besseres Onboarding für Gmail/Outlook (kein
  DNS/MX/Forward)
- Nachteil: CASA-Audit-Pflicht (5–8 k€/Jahr) für `gmail.readonly`
- **Trigger:** wenn ≥3 von 5 Pilots am Forward scheitern

### „Entwurf fertig"-Mail-Ping an Owner
- Schon in STRATEGIE.md TEIL A3 dokumentiert
- Simpel: Postmark-Mail mit „Entwurf für Kunde X liegt bereit → [Link]"
- **Trigger:** Max sagt „vergesse ständig reinzuschauen"

### Lieferantenverzeichnis / Material-Bestellung
- Konzept in VISION.md (Säule 3)
- Owner speichert Lieferanten (Kontakt, Kundennummer, Lieferzeit) →
  KI vorentwirft Bestell-Mail bei Materialbedarf
- **Niedrigste Prio** — die meisten bestellen via Lieferanten-Portal/
  Telefon, keine echte Lücke

### Google-Calendar-OAuth-Sync (Modul 8)
- Auto-Availability statt manueller Regel-Pflege
- Auto-Event-Erstellung bei Termin-Bestätigung
- Bidirektionaler Sync
- **Trigger:** Max sagt „Verfügbarkeit pflegen ist nervig"

### Mini-CRM mit Datei-Ablage am Kunden
- Aus Max-Feedback Tag 21: viele Handwerker schreiben Rechnungen
  noch in Word, haben keinen sauberen Kundenstamm. Vision: Datei-Ablage
  (Angebote, Rechnungen, Schriftverkehr) am Kunden, automatische
  Verknüpfung von Mail-Anhängen mit dem richtigen Kunden, optional
  Projekt-Ordner.
- Heute: Kunden-„Profil" ist dynamische Aggregation aus `analysen`,
  keine eigene `kunden`-Tabelle. Datei-Ablage bräuchte: `kunden`-Tabelle
  + `kunden_dateien`-Tabelle + Storage-Bucket + UI für Upload/Liste
  + automatische Zuordnung aus Inbound-Anhängen pro Email-Match.
- **Scope-Falle:** wird leicht zum ERP-Versuch. Sauber halten = nur
  Datei-Ablage + Mail-Zuordnung, KEINE Rechnungs-Erstellung, KEINE
  Projekt-Hierarchie (zumindest V1).
- **DSGVO:** zusätzliche Dokument-Speicherung in AV-Vertrag/DPA
  mit Owner abdecken bevor live.
- **Trigger zum Bau:**
  - ≥2 Pilots fragen explizit nach „Datei am Kunden ablegen"-Funktion, ODER
  - Säule 2 (Angebots-Editor) startet → Mini-CRM wird Add-on damit
    Angebote/Rechnungen automatisch im Kundenprofil landen
- Verkaufsargument falls gebaut: „professioneller Kundenstamm, der
  sich größtenteils automatisch füllt".

---

## Was NICHT in den Eisschrank gehört

Diese Sachen sind GESTRICHEN (siehe STRATEGIE.md TEIL D), nicht
geparkt — kein Re-Visit:

- Schatten-/Beobachten-Modus
- Sende-Cap pro Stunde
- Kill-Switch
- Telefon-Feature
- Bild-Logo (Wortmarke reicht)
- Push-Infrastruktur (Web-Push/Service-Worker)
- Reklamations-Counter im ROI-Block
- Test-Anfragen-Onboarding
- Einzelfall-Hacks (BCC speziell an einen Owner, etc.)
- Gmail-Style Folder-Drag&Drop

---

## Wenn diese Datei wieder relevant wird

Vor jedem Sprint-Plan: kurzen Check ob ein „Trigger" hier oben jetzt
erfüllt ist. Wenn ja → das Item aus dem Eisschrank in STRATEGIE.md
TEIL A/B übernehmen und priorisieren.

Wenn alles still bleibt → nicht hochziehen. Disziplin.
