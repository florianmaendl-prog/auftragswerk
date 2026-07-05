# QA-PROTOKOLL Sprint 2 (5.–9.7.2026)

> **Ziel:** Bevor Max am ~10.7. da ist, sind die 10 Kernflows nachweislich
> durchgetestet und dokumentiert. „Immer irgendwas hat nicht funktioniert"
> darf beim Schulter-Blick keine Chance mehr haben.
>
> **Wie ausfüllen:** Pro Flow Status setzen (OK / WARN / FEHLER), bei
> Fehler die Repro-Schritte + Screenshot-Pfad + wer's fixt. Nichts
> überspringen. Wenn ein Flow „geht schon", trotzdem 1× durchklicken
> und Zeitstempel setzen — sonst ist es keine Verifikation.

---

## Test-Umgebung

- **URL:** https://auftragswerk.app (nach Sprint-2-Merge)
- **Test-Accounts:** florian.maendl@gmx.de (Owner) + Max' Bauelemente-Rapp-Tenant
- **Browser:** Chrome (Diktat-Happy-Path), Safari (Fallback), evtl. Firefox (disabled-Zustand)
- **Test-Adressen für Signup:** 3 Provider (GMX, Gmail, Outlook) mit Zeitstempeln
- **Zeitraum:** 7.7.–9.7. (2 Tage), damit bei Bug noch Fix + Redeploy passt

---

## Kernflows

### 1. Signup (5-Tage-Bug reproduzieren + verifizieren)

| Adresse | Signup-Zeit | Bestätigungs-Mail kam an | Delta | Status |
|---|---|---|---|---|
| test-gmx-1@gmx.de | | | | |
| test-gmail-1@gmail.com | | | | |
| test-outlook-1@outlook.com | | | | |

**Erwartung:** Delta unter 60 Sekunden pro Adresse. Wenn >2 Minuten →
Item 1 nicht gefixt, Config-Bug bleibt offen.

**Zusätzlich:** Screenshot von Supabase-Dashboard → Authentication →
Emails → SMTP-Settings + Postmark → Server → Activity → letzter Test-
Send. Beides in `docs/screenshots/signup-bug/` ablegen.

---

### 2. Inbound-Pipeline (Mail → Anfrage → Kurzfassung)

- [ ] Test-Mail an `bauelemente-rapp-2@kunden.auftragswerk.app` mit
      Foto-Anhang
- [ ] Anfrage erscheint in Inbox innerhalb 60 Sek
- [ ] **Kurzfassung sichtbar** unter dem Betreff (max 1 Zeile, aus
      Sprint 2.5)
- [ ] Foto ist im Detail sichtbar
- [ ] Vision-Badge „Die KI hat X Bilder vom Kunden gesehen"

**Status:** ▢ OK ▢ WARN ▢ FEHLER
**Notiz:**

---

### 3. Klassifikation (Klartext-Labels aus Sprint 1)

- [ ] KI-Analyse-Card zeigt „Kundenanfrage" / „Groß" / „Hoch" (nicht
      `kundenanfrage`, `gross`, `hoch`)
- [ ] Kein `claude-sonnet-4-6`-Badge sichtbar
- [ ] Keine „KI 75%"-Warnbanner (weder in Inbox-Übersicht noch im Detail)
- [ ] Empfohlene Aktion in Du-Form („Prüf kurz…" statt „Der Meister sollte…")

**Status:** ▢ OK ▢ WARN ▢ FEHLER
**Notiz:**

---

### 4. Entwurf-Editor + Vorschau

- [ ] Entwurf-Card oben rechts, kein Model-Badge
- [ ] „Vorschau wie's beim Kunden ankommt" öffnet Modal mit finalem HTML
      + Signatur + Logo (falls gepflegt)
- [ ] Bearbeiten → Text ändert sich in der Vorschau nach Speichern

**Status:** ▢ OK ▢ WARN ▢ FEHLER
**Notiz:**

---

### 5. Versand (Gmail-Pfad, 4-stufige Hierarchie)

- [ ] Owner drückt „Senden"
- [ ] Bestätigungs-Toast erscheint
- [ ] Mail kommt beim Empfänger an aus `florian.maendl@gmail.com`
      (NICHT `info@auftragswerk.app`)
- [ ] Header-Check: `From:` zeigt Betrieb-Name, `Reply-To:` zeigt
      Subdomain (`slug@kunden.auftragswerk.app`)
- [ ] `entwurf.was_edited` in DB korrekt gesetzt (per SQL-Check)

**Status:** ▢ OK ▢ WARN ▢ FEHLER
**Notiz:**

---

### 6. Nachfass + Stale-Indikator

- [ ] Anfrage mit `versendet_am` >7 Tage in der Vergangenheit finden
      (oder künstlich mit SQL setzen)
- [ ] Stale-Indikator sichtbar (amber „wartet seit X Tagen")
- [ ] „Nachfass-Mail schreiben"-Button generiert höflichen KI-Entwurf

**Status:** ▢ OK ▢ WARN ▢ FEHLER
**Notiz:**

---

### 7. Angebot komplett (Sprint-1-Verifikation)

- [ ] `/dashboard/angebote` → „Neues Angebot" → Nummer `2026-XXX` +
      Gültig-bis `heute+30` sofort gesetzt
- [ ] Empfänger-Card mit 5 Feldern editierbar
- [ ] Position hinzufügen → EP-Checkbox („Nur bei Bedarf")
- [ ] EP-Position wird amber getönt + „EP"-Badge, nicht in Netto/Brutto
- [ ] Änderung tippen → „Ungespeicherte Änderungen" amber erscheint
- [ ] Tab schließen → Browser warnt
- [ ] Speichern → Warnung verschwindet
- [ ] PDF öffnen → EP-Marker in Pos-Spalte, Legende unter Tabelle,
      EP-Summe separat unter Brutto
- [ ] Kein Auftragswerk-Branding im PDF-Footer (Iron Rule)
- [ ] „An Kunde senden" → Modal → Testmail an eigene Adresse → PDF im
      Anhang
- [ ] Nach Versand: Status `versendet`, PDF in `kunden_dateien` archiviert

**Status:** ▢ OK ▢ WARN ▢ FEHLER
**Notiz:**

---

### 8. Termine + iCal-Export

- [ ] Termin aus Anfrage bestätigen
- [ ] Erscheint in `/dashboard/termine`
- [ ] iCal-Download öffnet in Apple Calendar / macOS
- [ ] Termin-Reminder-Cron generiert Mail (manuell mit CRON_SECRET
      triggern)

**Status:** ▢ OK ▢ WARN ▢ FEHLER
**Notiz:**

---

### 9. Kalender + Verfügbarkeit

- [ ] Woche navigierbar (Vor/Zurück-Buttons)
- [ ] Verfügbarkeits-Regel anlegen (Mo-Fr 8-17 Uhr)
- [ ] Sperre anlegen (z.B. Urlaub)
- [ ] Klick auf Zelle → Aktions-Dialog je nach Status
- [ ] Standalone-Termin (ohne Anfrage) anlegbar
- [ ] Mobile-View (<md): vertikale Tag-Liste sauber

**Status:** ▢ OK ▢ WARN ▢ FEHLER
**Notiz:**

---

### 10. Kunden-Ablage (Mini-CRM)

- [ ] Neue Kundenanfrage rein → automatisch `kunden`-Zeile
- [ ] Anhänge landen in `kunden_dateien` (Quelle „inbound_anhang")
- [ ] `/dashboard/kunden/<email>` zeigt: Notiz-Editor, Datei-Liste,
      Anfragen-Historie
- [ ] Notiz tippen + Tab wechseln → Auto-Save
- [ ] Manuell Datei hochladen → erscheint in Liste
- [ ] Download via Signed-URL (5 Min TTL) funktioniert

**Status:** ▢ OK ▢ WARN ▢ FEHLER
**Notiz:**

---

## Sprint-2-spezifische Verifikationen

### Item 3 – Diagnose-Skript

- [ ] `npx tsx --env-file=.env.local scripts/check-sprint2-diagnose.ts`
      liefert Klartext-Report
- [ ] Section A: `processing_errors` gruppiert nach Schritt sichtbar
- [ ] Section B: `manuell_pruefen`-Aufschlüsselung nach Grund + Beispiele
- [ ] Section C: Zusammenfassung + offene Fragen

**Report gespeichert in:** `SPRINT-2-DIAGNOSE.md`

---

### Item 4 – Fehler-Digest-Cron

- [ ] Vercel-Env `CRON_SECRET` gesetzt (in Vercel-Dashboard prüfen)
- [ ] Manueller Trigger vom Terminal:
      ```bash
      curl -H "Authorization: Bearer $CRON_SECRET" \
        https://auftragswerk.app/api/cron/fehler-digest
      ```
- [ ] Antwort: JSON mit `sent`, `failed`, `skipped`, `total_fehler_24h`
- [ ] Wenn Fehler in DB der letzten 24h vorhanden → Mail an Owner-Postfach
- [ ] Mail-Text: Schritt-Gruppierung + Link zu `/dashboard/diagnose`

**Status:** ▢ OK ▢ WARN ▢ FEHLER
**Notiz:**

---

### Item 5 – Kurzfassung sichtbar

- [ ] Migration `20260705_analysen_kurzfassung.sql` in Supabase gelaufen
- [ ] Neue Test-Anfrage → `analysen.kurzfassung` in DB gefüllt (SQL-Check)
- [ ] Inbox-Karte zeigt Subline unter Betreff (line-clamp-1)
- [ ] Bestandsmail ohne `kurzfassung` → Fallback (erste 80 Zeichen der
      langen `zusammenfassung` mit „…"-Suffix am Wortende)
- [ ] Kein Confidence-Warnbanner mehr in der Inbox

**Status:** ▢ OK ▢ WARN ▢ FEHLER
**Notiz:**

---

### Item 6 – Collapse-Cards

- [ ] Auf `/dashboard/anfragen/<id>`: „Konversation" + „KI-Analyse"
      haben Chevron-Icon links im Header
- [ ] Klick auf Header → Card klappt ein, Icon dreht sich
- [ ] Reload → Zustand bleibt (localStorage `auftragswerk:collapse:<cardId>`)
- [ ] Andere Anfrage öffnen → gleiche Card ist gleich zu/offen (owner-
      globales Layout, nicht pro Anfrage)

**Status:** ▢ OK ▢ WARN ▢ FEHLER
**Notiz:**

---

## Abschluss

- [ ] Alle Zellen ausgefüllt, keine ▢ mehr offen
- [ ] Bei FEHLER: Bug-Report in Backlog eingetragen mit Repro-Link
- [ ] Owner-Freigabe: „Ready für Max-Besuch"

**Datum abgeschlossen:** ________________
**Freigabe:** Florian
