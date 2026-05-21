# Auftragswerk – System-Inventur

> **Stand: 21.5.2026 (Tag 10 abends)**  
> Referenz-Snapshot vor Tab-Umbau. Jeder neue Claude/Entwickler liest das.

---

## 🌍 Live-System

| Komponente | Wert |
|---|---|
| Domain | https://auftragswerk.app |
| DNS-Provider | united-domains |
| Hosting | Vercel (flo-maendl-s-projects/auftragswerk) |
| Datenbank | Supabase (lfziiallrfnrzbgatrml) |
| Mail-Service | Postmark (Server 19265866) |
| GitHub | florianmaendl-prog/auftragswerk |
| Anthropic Account | florian.maendl@gmx.de |

---

## 📊 Datenbank (Tabellen)

| Tabelle | Zweck |
|---|---|
| `anfragen` | Hauptobjekt: jede eingegangene Mail = 1 Anfrage |
| `betriebe` | Multi-Tenant: jeder Handwerker = 1 Betrieb |
| `entwuerfe` | KI-generierte Antwort-Entwürfe (1:1 zu Anfrage) |
| `nachrichten` | Mail-Thread: alle Mails einer Anfrage (eingehend + ausgehend) |
| `analysen` | KI-Klassifikations-Ergebnisse |
| `ai_runs` | Audit-Log aller KI-Aufrufe |
| `processing_errors` | Fehler-Log |
| `feedback` | User-Feedback (ungenutzt) |
| `angebote` | LEER, Säule 2 noch nicht gebaut |
| `profile` / `profiles` | User-Profile (Auth) |

### Tabelle `anfragen` – wichtige Spalten
id              uuid (PK)
betrieb_id      uuid (FK)
kanal           text 'mail'
von_email       text
von_name        text
betreff         text
body_text       text
body_text_clean text  ← bereinigt von Signaturen/Quotes/Disclaimern
body_html       text
empfangen_am    timestamptz
status          text DEFAULT 'neu'
geloescht_am    timestamptz NULL ← Soft-Delete für Papierkorb
raw_payload     jsonb ← Original-Webhook-Payload von Postmark

---

## 🚦 Status-Werte einer Anfrage

| Status | Bedeutung | KI-trigger |
|---|---|---|
| `neu` | Frisch eingegangen, noch nicht klassifiziert | Webhook gerade angelegt |
| `entwurf_bereit` | KI hat Entwurf gebaut, warten auf Freigabe | KI sagt passt + confidence ≥ 60% |
| `manuell_pruefen` | KI unsicher, Max muss selbst antworten | confidence < 60% oder passt_nicht |
| `info` | Rechnung/Bestellung/Innung, kein Action | Kategorie = info |
| `aussortiert` | Werbung/Spam | Kategorie = werbung |
| `versendet` | Mail wurde rausgeschickt | nach Freigabe + Postmark-Send |
| `reply_eingegangen` | Kunde hat geantwortet | Threading match auf existing anfrage |
| `erledigt` | Abgeschlossen | User-Klick auf "Erledigt"-Button |

**Soft-Delete:** Anfrage bleibt aber bekommt `geloescht_am = NOW()` → wird im Papierkorb gelistet.

---

## 📁 Code-Struktur

### API-Endpoints (Backend)
app/api/
anfragen/[id]/route.ts   PATCH (Status-Update) + DELETE (Soft-Delete)
betriebe/[id]/route.ts   Betriebsprofil-Update
inbound/route.ts         Postmark Webhook: Mail empfangen + KI + Status setzen
versand/route.ts         Entwurf freigeben + via Postmark senden
versand/manuell/route.ts Manuelle Antwort senden (ohne Entwurf)
health/route.ts          System-Status
test-*/route.ts          Dev-Tools
auth/callback/route.ts   Supabase Magic-Link Callback

### Frontend (Dashboard)
app/dashboard/
page.tsx                          Inbox: 8 Tabs + Anfragen-Liste
layout.tsx                        Dashboard-Layout (Sidebar)
dashboard-shell.tsx               Sidebar + Header + Mobile-Menü
anfrage-quick-menu.tsx            Dropdown rechts an jeder Anfrage in Liste
anfragen/[id]/
page.tsx                        Detail: Conversation links, Editor rechts
detail-actions.tsx              Status-Buttons (Erledigt, Aussortieren, etc.)
entwurf-editor.tsx              KI-Entwurf bearbeiten + freigeben
reply-editor.tsx                Manuelle Antwort (istFolgeNachricht-Prop)
papierkorb/
page.tsx                        Liste gelöschter Anfragen
papierkorb-item-actions.tsx     Wiederherstellen / endgültig löschen
profil/
page.tsx                        Betriebsprofil-Anzeige
profil-form.tsx                 Betriebsprofil-Bearbeiten
app/login/page.tsx                  Magic-Link Login
app/page.tsx                        Root: redirect zu /dashboard oder /login

### Helper-Library
lib/
claude.ts          Anthropic API Client
klassifikation.ts  KI-Klassifikator (Haiku, schnell + günstig)
entwurf.ts         KI-Entwurfsgenerator (Sonnet 4.6)
mail-cleaner.ts    Body-Bereinigung (Signaturen/Quotes/Disclaimer raus)
postmark.ts        Postmark API Wrapper (Versand)
supabase-*.ts      Supabase Clients (Browser + Server)
utils.ts           cn() helper für Tailwind

---

## 🎨 UI-Features (live)

- ✅ 8 Tabs in horizontaler Reihe (Posteingang, Freigabe, Manuell, Info, Versendet, Antwort, Erledigt, Aussortiert)
- ✅ Pro Tab: Counter mit Anzahl
- ✅ Anfragen-Liste sortiert nach `empfangen_am DESC`
- ✅ Detail-View: Conversation (links) + Editor (rechts)
- ✅ Conversation zeigt alle Mails einer Anfrage chronologisch
- ✅ KI-Entwurf-Editor: bearbeiten + freigeben
- ✅ Reply-Editor: manuelle Antwort schreiben + senden
- ✅ Reply-Editor `istFolgeNachricht`-Modus (bei `versendet` heißt es "Weitere Nachricht senden")
- ✅ Erledigt-Button (grün, immer sichtbar bei aktiven Anfragen)
- ✅ Status-Dropdown: manuell Status ändern
- ✅ Soft-Delete: Papierkorb-Sidebar-Link
- ✅ Papierkorb: Wiederherstellen / endgültig löschen
- ✅ Betriebsprofil: Name, Branche, Tonbeispiele bearbeiten
- ✅ Sidebar: Inbox / Profil / Papierkorb / Logout
- ✅ Mobile-Header mit Hamburger
- ✅ Doppelklick-Schutz an allen Send-Buttons (isLoading-Guards)
- ✅ KEIN Confirm-Popup beim Senden (wie Gmail, direkt raus)
- ✅ Magic-Link Login (über Postmark, kein Spam)

---

## ⛓ Threading-Logik (kritisch wichtig)

Eingehende Mail hat Header:
In-Reply-To: id1@domain.com
References: id1@domain.com id2@mtasv.net
Webhook parsed BEIDE Header
Sucht in nachrichten-Tabelle: matched eine Anfrage?
→ Match-Spalten: message_id ODER in_reply_to
Wenn Match:
→ Nachricht der EXISTING Anfrage zugeordnet
→ Status der Anfrage = 'reply_eingegangen'
Wenn KEIN Match:
→ Neue Anfrage anlegen + KI-Klassifikation

WICHTIG: Postmark transformiert beim Versand die Message-IDs auf @mtasv.net.
Beide IDs (originale @pm-bounces UND transformierte @mtasv.net) müssen
in der DB gefunden werden können.

---

## 📨 Mail-Setup

### Outbound (Versand)
Provider:    Postmark (Server 19265866)
From-Email:  info@auftragswerk.app
Reply-To:    22410d58b0879712e00751421bbe7f29@inbound.postmarkapp.com
DKIM:        ✅ verified für auftragswerk.app
Return-Path: ✅ pm-bounces.auftragswerk.app → pm.mtasv.net

### Inbound (Empfang)
Provider:    Postmark Inbound
Adresse:     22410d58b0879712e00751421bbe7f29@inbound.postmarkapp.com
↑ hässliche Hex-Adresse, im Backlog: auf inbox@auftragswerk.app umstellen
Webhook:     https://auftragswerk.app/api/inbound

### Magic-Link (Supabase Auth)
Provider:    Postmark (gleicher Server) via SMTP
From-Email:  noreply@auftragswerk.app
SMTP-Host:   smtp.postmarkapp.com:587

---

## 🛠 Iron Rules / Verhaltensweisen

Diese **NICHT verlieren** beim Refactoring:

1. **Versand: KEIN Confirm-Dialog** — direkt senden, wie Gmail
2. **Doppelklick-Schutz** — isLoading-Guards an allen Send-Buttons
3. **KI baut Entwurf für ALLE Kundenanfragen** — auch passt_nicht (höfliche Absage), unklar (Rückfrage)
4. **Bei Status `versendet`** — Reply-Editor heißt "Weitere Nachricht senden", nicht "Antworten"
5. **Reply-To-Header** immer gesetzt (sonst kommen Kunden-Antworten nicht zurück)
6. **References-Header** sowohl beim Versenden setzen als auch beim Empfangen parsen
7. **Magic-Link Mails** kommen von `noreply@auftragswerk.app`
8. **Reguläre Versandt-Mails** kommen von `info@auftragswerk.app`
9. **body_text_clean** ist die bereinigte Version — KI bekommt IMMER das clean field
10. **Eine Anfrage** kann mehrere `nachrichten` haben (Conversation)

---

## 🔧 Vercel Env-Vars (Production)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
NEXT_PUBLIC_APP_URL                = https://auftragswerk.app
POSTMARK_SERVER_TOKEN
POSTMARK_FROM_EMAIL                = info@auftragswerk.app
POSTMARK_FROM_NAME                 = Auftragswerk
POSTMARK_REPLY_TO                  = 22410d58b0879712e00751421bbe7f29@inbound.postmarkapp.com

---

## 📋 Was als Nächstes auf der Roadmap (Stand 21.5.2026)
HEUTE / DIESE WOCHE:
□ Tab-Umbau (3 Bereiche: ZU TUN / TRACKING / ARCHIV)
□ Login: Email + Passwort dazu (Magic-Link bleibt als Backup)
□ Hex-Adresse → inbox@auftragswerk.app (MX-Records ändern)
□ Custom Sender pro Betrieb (Postmark Sender-Signature API)
NÄCHSTE WOCHEN:
□ Google Calendar Integration (USP-Feature)
□ Säule 2: Angebote (Stammdaten + Editor + KI-Boost + PDF)
□ Säule 3: Material-Recherche
NACH PILOT:
□ Self-Service-Onboarding
□ Admin-Backend
□ Pricing / Stripe

---

## 🚨 Rollback-Strategie
Backup-Branch:  backup-vor-tab-umbau
Rollback:       git checkout main && git reset --hard backup-vor-tab-umbau && git push --force
Vercel:         Auto-deploys von main, also greift Rollback sofort
DB-Backup:      Supabase Auto-Backups täglich (Settings → Database → Backups)