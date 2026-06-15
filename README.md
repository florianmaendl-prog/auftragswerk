# Auftragswerk

Premium-Mail-Assistenz für Handwerksbetriebe. Liest Kundenanfragen, schreibt Antwort-Entwürfe im Owner-Ton, schlägt Termine vor — Owner gibt jede Mail per Klick frei.

Stack: Next.js (App Router) + Supabase (Postgres + Auth + Storage) + Anthropic Claude (Sonnet + Haiku) + Postmark (Inbound/Outbound) + Vercel.

---

## Source-of-Truth-Dateien

Vor jedem Sprint kurz lesen:

- [STRATEGIE.md](STRATEGIE.md) — was JETZT, was geparkt, was gestrichen. Filter-Regeln.
- [BACKLOG.md](BACKLOG.md) — Tag-für-Tag-Historie, jüngster Stand oben.
- [INVENTUR.md](INVENTUR.md) — System-Snapshot, Iron Rules, Tabellen, Files.
- [IDEEN-EISSCHRANK.md](IDEEN-EISSCHRANK.md) — geparkte Ideen mit Triggern.
- `AGENTS.md` / `CLAUDE.md` — Konventionen für Claude-Code-Sessions.

---

## Branch- und Deploy-Workflow

**Production = `main`.** Pushes auf `main` deployen automatisch auf [auftragswerk.app](https://auftragswerk.app) (Vercel).

**Änderungen vor Live testen:**

1. Feature-Branch von `main` abzweigen: `git checkout -b fix/<thema>` oder `feat/<thema>`.
2. Pushen — Vercel baut automatisch eine **Preview-URL** pro Push (Form: `auftragswerk-git-<branch>-<scope>.vercel.app`).
3. Auf der Preview-URL klicken/testen. Wenn ok → in `main` mergen.
4. DB-Migrationen liegen versioniert in `supabase/migrations/`. Lokal/Preview testen, dann auf Production-DB ausführen.

**Warum kein separates Staging-Supabase?** Bei aktuell 1 Pilot ist eine zweite DB-Instanz Overkill (Wartung + Kosten). Preview-Deployments + saubere Migrationen reichen. Falls bei Pilot #3+ Migrations-Pain auftaucht → separates Staging hochziehen.

**Niemals:** direkt auf `main` pushen ohne lokales Testen; Hooks mit `--no-verify` überspringen; force-push auf `main`.

---

## Lokal entwickeln

```bash
pnpm install
pnpm dev
```

Läuft auf `http://localhost:3000`. ENV-Vars aus `.env.local` (Supabase, Anthropic, Postmark, Google OAuth, TOKEN_ENCRYPTION_KEY).

---

## Debug-Scripts

Unter `scripts/`, mit Service-Role-Key gegen die Production-DB:

```bash
npx tsx --env-file=.env.local scripts/check-edits.ts     # Edit-Diff-Stand
npx tsx --env-file=.env.local scripts/check-versand.ts   # Versand-Aktivität
```
