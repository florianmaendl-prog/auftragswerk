# Auftragswerk – Strategie

> **Stand: 2.6.2026 (nach Strategie-Diskussion Flo + Berater + Claude)**
>
> Diese Datei ist die Antwort auf „was JETZT, wo Säule 1 technisch fertig
> ist und Max die URL hat". Ergänzt — aber ersetzt nicht — den Säulen-Plan
> (Säule 1 Mail / Säule 2 Angebote / Säule 3 Material) aus VISION.md und
> den Stand aus BACKLOG.md / INVENTUR.md.
>
> Pflichtlektüre vor neuen Wellen. Ein neuer Chat sollte ausreichen: diese
> Datei + BACKLOG.md + INVENTUR.md.

---

## Leitprinzip

> *Scale isn't about doing more. It's about removing everything that isn't
> worth doing — then doing as much as you can of what's left.*

Drei Konsequenzen für jede Entscheidung:

1. **Produkt fürs Handwerk, nicht für Max.** Architektur, Datenmodell,
   Provider-Abdeckung, Onboarding müssen Multi-Tenant skalieren. Max ist
   der *erste Realitäts-Check* ob die Annahmen über den typischen
   Handwerksbetrieb stimmen — nicht die Zielgruppe von einem. (Gmail-only
   war genau hier der Fehler: nicht weil Max wechselt, sondern weil der
   *nächste* Betrieb Outlook hat.)

2. **Perfektes Premium-Tool ZUERST, dann skalieren.** Die Innung will eine
   Vorstellung sobald es fertig ist — Maßstab ist deshalb „vor 30
   Handwerksmeistern bestehen", nicht „läuft bei einem". Lieber lange dauern
   und gescheit, als schnell und mittelmäßig.

3. **Es geht NICHTS automatisch raus.** Jede Mail wird vom Owner per Klick
   freigegeben. Das ist Verkaufsversprechen *und* Sicherheitsarchitektur
   zugleich — alles was diese Tatsache absichern wollte (Schatten-Modus,
   Sende-Cap, Kill-Switch) löst ein Problem das die Architektur schon hat.

**Der Kern in einem Satz:** Anfrage rein → KI versteht sie → KI baut
Entwurf in deinem Ton → du liest, gibst frei → raus aus deinem eigenen
Postfach. Alles was diese Schleife *besser und verlässlicher* macht, ist
es wert. Alles andere wartet oder fliegt.

---

## Filter-Fragen für jedes Feature

1. **Macht es den Kern perfekter?** (Ton, Vision, Onboarding, Vertrauen)
2. **Skaliert es Multi-Tenant?** (1 Betrieb wie 100, kein Max-Spezialhack)

Wenn beide ja → bauen. Wenn nur eines → warten. Wenn keines → streichen.

---

## TEIL A — JETZT: Den Kern perfekt machen

### A1. Entwurfsqualität — die eine Achse die zählt

Wenn der Entwurf generisch, falsch oder nicht nach dem Handwerker klingt,
ist das Tool wertlos — egal wie schön die Inbox ist. Drei Hebel:

**Ton-Treffsicherheit — Dauer-Aufgabe, höchste Prio.**
Trifft das Profil-/Stilbeispiel-System (`betriebe.ton_beispiele`, `signatur`,
`was_wir_machen`/`-nicht`) den Handwerker wirklich? Hier wird besessen
gefeilt. Realer Test: Entwürfe gegen das halten, was der Owner selbst
geschrieben hätte. Stellschraube: `lib/entwurf.ts` System-Prompt.

**Lernen aus Edits — der Hebel hinter "Ton-Treffsicherheit".**
*„Die KI muss lernen je mehr er schreibt."* — direkt aus dem Pilot-Briefing.
- **Phase 1 (jetzt):** Beim Versand `entwurf.text_original` vs. final
  gesendeten Text diffen, in neue Spalte `entwuerfe.user_edit_diff` (jsonb)
  + Boolean `was_edited` ablegen. Diagnose-Sub-Screen für Flo: *„Max hat
  47 Entwürfe freigegeben, 31 ohne Änderung, 16 editiert. Top-Patterns: …"*
- **Phase 2:** Auto-Vorschläge im Profil („Schreibst du oft ‚gern' statt
  ‚gerne'? Als Stilbeispiel speichern?").
- **Phase 3:** Vollautomatisch ohne Owner-Bestätigung.
- Plus heute schon im Entwurf-Editor ein Tooltip unter dem Senden-Button:
  *„Was du änderst, hilft beim nächsten Mal."* — Erwartungsmanagement,
  baut Vertrauen dass das Tool lernt.

**Vision / Foto-Verständnis — kleiner Aufwand, großer Qualitätssprung.**
Für visuelle Gewerke (Metallbau, Sanitär, Dach, Elektro, Maler) der
Unterschied zwischen Floskel und „der hat's verstanden". Kunde: „Tor
schließt nicht" + 2 Handyfotos → Claude *sieht* die Bilder → Entwurf wird
konkret: „unteres Scharnier scheint ausgerissen, ich schau Dienstag vorbei?".
- Technik: Bilder liegen schon im Bucket `anhaenge`. Im Entwurf-Call
  (`lib/entwurf.ts`, Sonnet) als `image`-Blocks mitgeben statt ignorieren.
- Nur jpg/png, vor dem Call **runterskalieren** (Token-Kosten + große
  Handyfotos). PDFs/Pläne erstmal außen vor.
- Zuerst in den **Entwurf** (dort der Wow), Klassifikation (Haiku) optional
  später. `processing_errors`-Logik respektieren.

**Inhalts-Guardrails — schützt Qualität UND Recht.**
Ein überversprechender Entwurf zerstört Vertrauen und macht angreifbar.
In `lib/entwurf.ts` / `lib/klassifikation.ts` System-Prompts:
- **KI nennt NIE Preise und sagt NIE verbindlich zu.** Kein „kostet ca.
  800 €", kein „komme Dienstag fix". Termin-*Slots* aus dem Kalender
  vorschlagen ist ok — Preis/Verbindlichkeit ist Owner-Hoheit
  (verbindliches Angebot = Haftung).
- **Eskalation flaggen:** Beschwerde, Anwaltston, Mängelrüge → kein
  lockerer Entwurf, sondern `manuell_pruefen` + Hinweis „das liest du
  selbst". **Bewusste Ausnahme zu Iron Rule 3** („KI baut Entwurf für
  ALLE") — sauber im Prompt definieren.
- **„⚠️ Bitte prüfen"-Inline-Hinweis** im Entwurf-Editor wenn die KI was
  Heikles sieht: *„Kunde fragt nach Festpreis — hab nichts zugesagt, bitte
  selbst beantworten."* Mini-Banner über dem Entwurf, nicht als Status.

### A2. Vertrauen aufbauen — Funktions-Tour als zentraler Mechanismus

Die Angst des Handwerkers ist nicht „etwas geht OHNE mich raus" (löst die
Architektur), sondern **„etwas geht MIT mir raus das nicht meiner Qualität
entspricht"**. Antwort darauf:

**Funktions-Tour als Modal beim ersten Login** auf `/dashboard/willkommen`,
Skip-Button immer sichtbar, plus „Tour nochmal"-Link in Sidebar (oder
unten auf Willkommen-Page).

5 Slides:
1. **„So sieht's aus, wenn eine Anfrage reinkommt"** — Inbox-Screenshot
   mit Anfrage + KategorieBadge
2. **„Der Entwurf liegt schon fertig — du liest, gibst frei"** —
   Entwurf-Editor-Screenshot mit echtem Beispieltext
3. **„Termine schlägt die KI gleich mit vor"** — TerminCard-Screenshot
   mit 3 Slots
4. **„Bei jeder Mail entscheidest du — nichts geht ohne deinen Klick raus."**
   — der Vertrauens-Slide (groß, ruhig, Stahlblau). Ersetzt jeden
   Schatten-Modus, Sicherheits-Banner etc.
5. **„Je mehr du nutzt, desto besser trifft die KI deinen Ton"** —
   Profil-Screenshot mit Stilbeispielen (überleitet zu „jetzt einrichten")

**Plus „Selbst antworten"-Button gleichwertig zu „Entwurf freigeben"**
visuell in der UI — heute ist der Reply-Editor als Fallback markiert,
sollte als gleichberechtigte Wahl daneben stehen: *„KI-Entwurf nimmt dir
Tippen ab, aber du kannst genauso gut selbst schreiben."* Senkt die
Schwelle für Skeptiker, lässt das Tool nicht als Zwang wirken.

### A3. „Entwurf ist fertig"-Pull schaffen

Das echte Notification-Problem ist nicht „neue Mail da" — das sieht der
Owner ohnehin im Original-Postfach (Forward-Setup). Risiko: er antwortet
aus Reflex dort und öffnet Auftragswerk nie. **Tool konkurriert mit eigener
Gewohnheit.**

Die Botschaft ist nicht „du hast Post", sondern **„dein Entwurf ist schon
fertig — ein Klick"**. *Das* ist der Grund Auftragswerk zu öffnen.

**Mechanismus:** Simple Mail an den Owner über Postmark (haben wir), nicht
Push-Apparat. Betreff: „Entwurf für [Kunde X] liegt bereit". Body: kurzer
Vorschau-Text + Link ins Dashboard. Läuft im Owner-Postfach, null neue
Gewohnheit.

**ENTSCHEIDEN nach Max-Feedback:** Erst wenn Max sagt „vergesse ständig
reinzuschauen" → bauen. Vorher nicht — vielleicht reicht der Forward-Trigger.

### A4. ROI sichtbar machen — gegen Churn

Sieht der Betrieb den Wert nicht, kündigt er. Eine ehrliche Zahl im
Dashboard: *„Diese Woche: 12 Anfragen beantwortet, ~3 h gespart."* Klein
zu bauen (Aggregation vorhandener Daten), großer Effekt auf Bindung +
auf die Innungs-Story.

**Reklamations-Counter NICHT** — ist Mindestanspruch nicht USP, würde eher
Sorge schüren als beruhigen.

---

## TEIL B — Marktreif für Innung + Skalierung

Erzwungen durch das Ziel „vor einer Handwerkskammer bestehen". Kommt
*nach* Teil A (ein Tool auf Outlook mit schlechten Entwürfen ist trotzdem
schlecht), aber ist Pflicht für „fertig", nicht „danach".

### B1. Provider-Abdeckung — Outlook/Microsoft wird Pflicht

Man kann nicht vor einer Innung stehen wenn die Hälfte auf Outlook ist
und es nicht nutzen kann.

Drei Anbieter-Klassen:
1. **Gmail / Google Workspace** → OAuth `gmail.send` (gebaut,
   `lib/gmail.ts`). ✅
2. **Microsoft 365 / Outlook.com** → **Microsoft Graph API**, Permission
   `Mail.Send` + `offline_access`, OAuth via Azure/Entra App-Registration.
   Peer zu Gmail: gleiche Token-Logik (AES-256-GCM, Auto-Refresh), eigener
   Send-Call. Caveat: manche Org-Tenants verlangen Admin-Consent;
   Consumer-Outlook.com vs. Org-Tenant im Endpoint sauber unterscheiden.
3. **IONOS / GMX / web.de / Telekom & Co.** → kein OAuth-Send-API. Pfad =
   **Custom Sender mit DKIM** (geparkte Welle H, `lib/postmark-sender.ts`).
   Betrieb verifiziert Domain einmalig, Versand über Postmark mit seiner
   Signatur. Iron Rule „Auftragswerk nie sichtbar" bleibt gewahrt.

**Architektur jetzt (ohne MS gleich zu bauen):**
- Tabelle `gmail_connections` gedanklich als **`email_connections`** mit
  `provider`-Spalte (`google`|`microsoft`|`smtp`) denken — damit „gmail"
  nicht überall im Code klebt.
- 3-stufige From-Wahl (Iron Rule 25) als **Provider-Strategie**
  verallgemeinern.
- Trigger für tatsächlichen Bau: **Pilot #2 (Elektriker) fragen was er
  nutzt.** Wenn M365 → hochziehen.

### B2. Compliance — nicht mehr optional

Mit Platzhalter-Impressum + „in juristischer Prüfung"-Disclaimer vor eine
Kammer zu treten ist peinlich. Gehört zu „fertig":
- e-recht24.de Premium → echte Datenschutz + Impressum
- echte Anschrift statt `[Klammern]` in `/impressum`
- DPAs aktivieren: Anthropic / Supabase / Postmark / Vercel
- BVDW-AVV mit Max ausfüllen + unterschreiben

~3–4 h, ~50 €/Jahr, Owner-Aufgabe. Detail-Memory:
`~/.claude/projects/-Users-flomandl-Code-auftragswerk/memory/compliance-pre-pilot-checkliste.md`

### B3. Ein echter Beweis

Innung kauft Vertrauen, kein Feature-Blatt. Sobald Max läuft:
- ein ehrliches Zitat („spart mir jeden Abend eine Stunde" – Max R.,
  Metallbau)
- ein Gesicht + Name (Florian) bei „Schreib uns" → nimmt die „anonymes
  Startup, morgen weg"-Angst (= reales Churn-Risiko)

Schlägt zehn Feature-Bullets.

### B4. Landing-Page-Feinschliff (`app/page.tsx`)

Design ist gut (ruhig, premium) — nur feilen, **nicht** bunter/animierter
machen.

**Sofort-Änderungen (~20 Min, nur Text + 1 Button-Spec):**

1. **Meta-Description ehrlich.** Aktuell „designt vom Handwerksmeister" —
   Flo ist PPC-Manager, kein Meister → angreifbare Behauptung. Ersatz:
   > „Auftragswerk liest deine Kundenanfragen, schreibt Antwortentwürfe in
   > deinem Ton und schlägt freie Termine vor. Du gibst nur noch frei –
   > versendet wird aus deinem eigenen Postfach."
   > *(Falls echt MIT Max entwickelt: „… gemeinsam mit einem Metallbau\​meister entwickelt." — nur wenn wahr.)*

2. **Trust-Satz als eigener Block hochziehen** (stärkstes Argument, aktuell
   als Halbsatz im Hero versteckt):
   > **„Deine Kunden merken nichts davon.**
   > Die Antwort geht aus deinem echten Postfach raus – dein Name, deine
   > Adresse, dein Ton. Auftragswerk bleibt unsichtbar. Du wirkst einfach
   > schneller."
   Den Halbsatz im Hero-Absatz dann streichen (keine Doppelung).

3. **Header-Button „Anmelden" als Outline**, NICHT voll-blau — würde dem
   Haupt-CTA „Account erstellen" die Hierarchie nehmen.
   Spec: `border: 1.5px solid #3D556B; color: #3D556B; background: transparent;
   border-radius: 8px; padding: 8px 18px; font-weight: 600`. Hover: füllt
   Stahlblau, Text weiß. Touch ≥44px (Iron Rule 22).

4. **DKIM/DNS-Fachsprache raus** (Zielgruppe kennt sie nicht). Onboarding-
   Intro: *„Drei Schritte, kein Technik-Kram."* Forward-Schritt:
   *„Einmal eine Weiterleitung bei deinem Mail-Anbieter einrichten – wir
   zeigen Klick für Klick wie."*

5. **„15 Min startklar"-Versprechen weicher** (Forward kann scheitern):
   *„In einer Mittagspause eingerichtet."*

**Mittelfristig (nach Max-Launch):**
- **Favicon** (das „A" in Saira) — taucht im Tab/Bookmark auf
- **Echter Dashboard-Screenshot** (Inbox mit Entwurf) im Hero/Lösungs-
  Block — zeigen schlägt sagen. **Kein Stockfoto.**
- Gewerke als Pills, nicht Komma-Wortwand
- Pricing weiterhin bewusst weglassen (Pilot-Phase)

---

## TEIL C — Geparkt (nicht gestrichen, nur nicht jetzt)

Echte Ideen mit Wert — aber sie machen den **Kern** nicht perfekter, also
warten sie.

**Diktat** — stark (Handwerker tippen ungern, sind unterwegs), aber:
Handy-Tastatur-Diktat geht heute schon ohne uns. Erst an echten Nutzern
prüfen ob das reicht, bevor STT gebaut wird. Mehrwert wäre nicht
„Sprache → Text" sondern „Sprache → fertige Mail" (gebrabbeltes → saubere
Antwort im Ton via Whisper + Entwurf-Prompt). Prio nach Vision.

**Angebots-Editor (Säule 2)** — einer der größten Handwerker-Pains. Eigene
Säule, groß. Erst wenn Teil A komplett ist.
Design: **human-in-the-loop** (KI schlägt Positionen, Owner setzt jeden
Preis, PDF mit seinem Briefkopf). Goldmine ist der Status-Loop Angebot →
versendet → angenommen → **Nachfass-Erinnerung**.
⚠️ **Scope-Falle:** NICHT zum ERP werden. Volle Rechnung = Kampf gegen
lexoffice/sevDesk + GoBD + E-Rechnungs-Pflicht (B2B 2025+) = Compliance-
Sumpf. Smarter: Anfrage→Angebots-Entwurf brillant, dann Export.
Migration liegt schon: `20260522_saeule2_angebote.sql`.

**WhatsApp** — real im Handwerk (Privatkunden, null Hürde), aber NICHT
vor Pilot-#2-Signal. Drei Gründe:
1. Business API = Meta-Approval + BSP + Template-Freigaben + 24h-Fenster
   = Wochen, laufende Kosten, externe Abhängigkeit
2. **Sprengt die Kern-Annahme „Antwort aus Owners echtem Postfach,
   Auftragswerk unsichtbar"** — bei WA ist der Absender eine Nummer:
   wessen? Eigene WA-Nummer bricht die Iron Rule; private Nummer an API
   wollen die wenigsten. **Grundsatzfrage VOR jeder Zeile Code.**
3. „Andere nutzen es" = Roadmap mit Gewicht, nicht „jetzt"

**Jetzt nur:** Versand-Pfad kanal-agnostisch halten (`anfragen.kanal`
existiert), nicht implizit Mail annehmen. Signal: Elektriker fragen „Mail
oder WhatsApp?".

**Lieferantenverzeichnis / Material (Säule 3)** — niedrigste Prio,
nice-to-have. Bestell-Workflow läuft oft eh über Lieferanten-Portale /
Telefon. Wenn gebaut: Owner speichert Lieferanten → KI vorentwirft
Bestell-Mail. Säule 3 („Perplexity für Handwerker") ist die ambitioniertere
Version, Konzept in VISION.md. Erst nach allem anderen.

**Weitere Backlog-Polish-Items** (Inbox-Suche, Tastatur-Shortcuts,
iCal-Export, Reschedule, Termin-Reminder, Google-Calendar-Sync,
Admin-Backoffice, Stripe/Pricing-Tiers …) bleiben im BACKLOG. Keins davon
macht den Kern perfekt → keins ist jetzt dran. Bei echtem Bedarf einzeln
hochziehen.

---

## TEIL D — Gestrichen (das Bauen NICHT wert)

Alles hier war eine Antwort auf ein Risiko das die Architektur schon
gelöst hat — oder löst ein Problem das es nicht gibt.

- **Schatten-/Beobachten-Modus** (gesperrter Senden-Button als eigener
  Modus). Überflüssig: wer nicht senden will drückt nicht auf Senden.
  Widerspricht außerdem dem Verkaufsargument „du gibst frei". **Ersatz:**
  Slide 4 der Funktions-Tour (Teil A2).
- **Sende-Cap pro Stunde.** Schützt vor Auto-Versand-Loops — den gibt es
  nicht. Jeder Send = Owner-Klick.
- **Kill-Switch / „Alles pausieren".** Gleicher Grund. Falls später
  Admin-Backoffice → dort als Verwaltungs-Funktion. Heute irrelevant.
- **Reklamations-Counter** im ROI-Block. Ist Mindestanspruch, kein USP —
  würde Sorge schüren statt Vertrauen bauen.
- **Test-Anfragen-Onboarding** (Owner schickt fake Mail von privater
  Adresse). Zu nervig, zwischen 2 Postfächern hin und her. Ersatz:
  Funktions-Tour (Teil A2).
- **Telefon-Feature.** Owner wird aufs Handy angerufen + ruft zurück —
  läuft parallel zum Tool, kein Hebel.
- **Bild-Logo.** Wortmarke „AUFTRAGSWERK" (Saira Condensed) *ist* das
  Logo. Einziges sinnvolles Asset: Favicon.
- **Push-Infrastruktur (Web-Push / Service-Worker).** Overkill. Falls
  Notification nötig → simpler Mail-Ping (Teil A3).
- **Einzelfall-Hacks** (BCC speziell an einen Owner, „erst eine alte Mail
  testen"). Nichts bauen das nicht als Produkt-Feature für *jeden* Betrieb
  funktioniert.

---

## TEIL E — Strategische Entscheidungen (NACH Max-Feedback)

Zwei große Weichen die JETZT nicht fallen müssen — erst wenn Max-Realbetrieb
Signal gibt.

### Entscheidung 1: Forward abschaffen via OAuth-Lesen?

**Idee:** Gmail/Outlook-OAuth aufs *Lesen* erweitern (`gmail.readonly` /
`Mail.Read`). Auftragswerk holt eingehende Mails direkt aus dem Postfach,
kein Forward / kein MX / kein DNS mehr nötig. Onboarding wird „Postfach
verbinden, fertig".

**Nicht jetzt — die Gründe:**
- `gmail.readonly` ist **CASA-Audit-Pflicht** (~5–8 k €/Jahr oder
  Unverified-Warnscreen für jeden Kunden). Bei Welle C bewusst ausgespart,
  weil `gmail.send` nicht CASA-pflichtig ist. Lesen schon.
- Pub/Sub-Push (Google Cloud Setup + Pricing) oder Polling alle 1–5 Min
  (lag, viele API-Calls). Microsoft Graph hat Webhooks die nach 3 Tagen
  ablaufen + renewed werden müssen (Cron).
- IONOS/GMX/Telekom: bleibt IMAP-Polling oder Forward → zwei Inbound-Wege
  parallel, nur komplexer.

**Trigger zum Bau:** Wenn ≥ 3 von 5 Pilots am Forward scheitern. Vorher
nicht — vielleicht ist die Mail-Empfang-Card (Welle F) gut genug.

### Entscheidung 2: „Entwurf fertig"-Ping bauen?

Siehe Teil A3. Erst wenn Max sagt „vergesse das Tool" → bauen. Mail an
Owner über Postmark, simpel.

---

## TEIL F — Reihenfolge

1. ✅ **Max-Feedback abwarten** (~3–7 Tage Realbetrieb) — Pilot läuft
   seit Tag 18 produktiv
2. ✅ **LP-Sofortänderungen** (Teil B4) — Tag 17 durch
3. ✅ **Funktions-Tour Modal** (Teil A2) — Tag 17 durch
4. ✅ **Edit-Diff Phase 1** (Teil A1) — Tag 17 durch
5. ✅ **Vision / Foto-Verständnis** (Teil A1) — Tag 19 durch
   (verifiziert mit Max-Real-Test, 7195 input-tokens beweist Bilder
   im KI-Kontext)
6. ✅ **Inhalts-Guardrails** (Teil A1) — Tag 19 durch (6 verbotene
   Aussage-Typen + Eskalations-Erkennung)
7. ⏳ **Ton-Treffsicherheit** (Teil A1) — **DAUER-AUFGABE**. Edit-Diff
   Phase 1 sammelt jetzt Daten. Phase 2 (Auto-Stilbeispiel-Vorschläge)
   wenn 30+ Real-Edits in der DB.
8. ⏳ **ROI-Zahl** im Dashboard (Teil A4) — geparkt, aktuell nicht
   dringend. Hochziehen wenn Max sagt „ich seh nicht was es bringt".
9. ⏳ **STRATEGISCHE ENTSCHEIDUNG 2** (Ping „Entwurf fertig") — falls
   Max sagt „vergesse das Tool im Alltag"
10. ⏳ **Compliance-Block** (Teil B2) — Pflicht für „fertig" / Innung
    (e-recht24, DPAs, BVDW-AVV, echte Impressum-Anschrift)
11. ⏳ **Microsoft/Outlook-OAuth** (Teil B1) — sobald Pilot #2 dranhängt
12. ⏳ **Referenz-Beweis** (Teil B3) — Zitat + Gesicht, sobald Max läuft
13. ⏸ **Erst dann** Teil C (Diktat → Angebots-Editor → WhatsApp → Material)

**Bonus-Items zwischendurch gebaut (über Reihenfolge hinaus):**
- Tag 18: Forward-Bug-Fix (OriginalRecipient-Routing), Sprint 1-3
  (Tab-Struktur + Refresh + Was-wir-machen + Region/PLZ + Sender-Block)
- Tag 19: Branchen-Default-Fix in Klassifikation (vorschnelle Absagen
  vermieden), Sprint 5 (Suche + Kundenhistorie + Auftrag-annehmen mit
  Owner-Override-Prompt), Sprint 6 Polish-Welle (Brand-Confirm-Dialog +
  Loading-Hint + Notiz-Feld + Stale-Indikator)

---

## Was bewusst NICHT in den nächsten Wochen passiert

- Nichts aus Teil D bauen (kein Schatten-Modus, kein Sende-Cap, kein
  Kill-Switch, kein Telefon, kein Bild-Logo, kein Push-Apparat, kein
  Reklamations-Counter)
- **Nicht zum ERP/Rechnungssystem werden** (Angebots-Entwurf ja, dann
  Export)
- **WhatsApp nicht vor geklärter Absender-Identität**
- **LP nicht bunter/größer/animierter** — Ruhe ist eine Stärke
- **Nicht auf Verdacht bauen** — Diktat, Ping, Schalter etc. erst wenn
  echter Nutzer den Bedarf zeigt
- **Strategische Entscheidung 1 (OAuth-Lesen)** nicht ohne Pilot-Signal —
  großer CASA-Aufwand, vorher Mail-Empfang-Card prüfen
- **Nicht für einen Mann (Max) bauen, aber auch nicht für einen
  imaginären Markt.** Zwei Filter bei allem: *Macht es den Kern perfekt?*
  + *Skaliert es für den typischen Handwerksbetrieb?* Wenn beides nein →
  weg oder warten.
