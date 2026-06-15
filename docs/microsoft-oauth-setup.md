# Microsoft 365 / Outlook OAuth — Setup-Anleitung

Schritt-für-Schritt für die Azure-App-Registrierung. Einmalig pro Auftragswerk-Installation. Spiegelt das Setup von Google Cloud (Gmail).

Resultat: drei Env-Vars die in Vercel landen, dann funktioniert „Mit Outlook verbinden" für jeden Owner.

---

## 1. Azure-Portal öffnen

1. [portal.azure.com](https://portal.azure.com) → mit dem Account einloggen, der die Auftragswerk-Apps verwalten soll (kann ein einfacher persönlicher Microsoft-Account sein, kein Premium-Tenant nötig).
2. Suchleiste oben: **„App-Registrierungen"** → klicken.
3. **„+ Neue Registrierung"** klicken.

## 2. App registrieren

Felder ausfüllen:

- **Name:** `Auftragswerk` (das sehen die Owner im Consent-Screen)
- **Unterstützte Kontotypen:**
  Wähle **„Konten in einem beliebigen Organisationsverzeichnis (jedes Microsoft Entra ID-Verzeichnis – mehrinstanzenfähig) und persönliche Microsoft-Konten (z. B. Skype, Xbox)"**
  → Das deckt Outlook.com Consumer + alle Firmen-M365-Tenants ab.
- **Umleitungs-URI:**
  - Plattform: **Web**
  - URI: `https://www.auftragswerk.app/api/auth/microsoft/callback`
  - (für lokale Tests zusätzlich später: `http://localhost:3000/api/auth/microsoft/callback`)

→ **„Registrieren"** klicken.

## 3. Application (Client) ID kopieren

Nach der Registrierung landest du auf der Übersicht. Notiere dir:

- **Anwendungs-ID (Client) ID** → wird `MICROSOFT_OAUTH_CLIENT_ID`

## 4. Client Secret erstellen

1. Linke Sidebar: **„Zertifikate und Geheimnisse"**.
2. Tab **„Geheime Clientschlüssel"** → **„+ Neuer geheimer Clientschlüssel"**.
3. Beschreibung: `auftragswerk-prod`. Gültigkeit: **24 Monate** (sonst musst du in 6 Monaten neu).
4. **„Hinzufügen"** klicken.
5. **WICHTIG:** Der **Wert** (nicht die geheime ID!) wird nur EINMAL angezeigt. Sofort kopieren.

→ Wird `MICROSOFT_OAUTH_CLIENT_SECRET`.

## 5. API-Berechtigungen setzen

1. Linke Sidebar: **„API-Berechtigungen"**.
2. **„+ Berechtigung hinzufügen"** → **„Microsoft Graph"** → **„Delegierte Berechtigungen"**.
3. Suche nach `Mail.Send` → Häkchen setzen.
4. Suche nach `offline_access` → Häkchen setzen.
5. `openid` und `email` werden automatisch mit angefragt (kein Häkchen nötig).
6. Unten **„Berechtigungen hinzufügen"** klicken.

**KEINE** „Administratoreinwilligung erteilen" klicken — wir wollen, dass jeder einzelne Owner per Klick zustimmt, nicht zentral admin-genehmigt.

## 6. Umleitungs-URI prüfen

Linke Sidebar: **„Authentifizierung"**. Prüfen dass `https://www.auftragswerk.app/api/auth/microsoft/callback` als Web-Umleitungs-URI eingetragen ist. Falls Tests von Preview-URLs nötig: dort die Preview-URL ebenfalls ergänzen.

Unter **„Implizite Genehmigung und hybride Flows"** beides ausgeschaltet lassen (wir nutzen Authorization-Code-Flow, nicht Implicit).

## 7. Env-Vars in Vercel setzen

In Vercel → Auftragswerk-Project → Settings → Environment Variables. Drei Vars:

```
MICROSOFT_OAUTH_CLIENT_ID       = <Anwendungs-ID aus Schritt 3>
MICROSOFT_OAUTH_CLIENT_SECRET   = <Wert aus Schritt 4>
MICROSOFT_OAUTH_REDIRECT_URI    = https://www.auftragswerk.app/api/auth/microsoft/callback
```

Scope: **Production**, **Preview**, **Development**. Für Preview/Dev ggf. unterschiedliche Redirect-URIs eintragen (separate Env-Sets).

Nach dem Speichern: ein Re-Deploy ist nötig damit die neuen Vars greifen.

## 8. Migration auf Production-DB ausführen

Migration `20260615_microsoft_connections.sql` im Supabase SQL Editor laufen lassen (gleicher Vorgang wie bei `extrahierte_position`). Inhalt der Datei:

```sql
-- siehe supabase/migrations/20260615_microsoft_connections.sql
```

Oder einfach den File-Inhalt aus dem Repo kopieren.

## 9. Smoke-Test

1. In Vercel ist alles deployed, Migration ist durch.
2. Im Profil: Card „Outlook / Microsoft 365" sichtbar.
3. „Mit Outlook verbinden" klicken → Microsoft-Login → Consent-Screen → Redirect zurück → grüner „Verbunden"-Banner mit Outlook-Adresse.
4. Test-Mail an dritte Adresse senden über den Entwurf-Editor → kommt aus dem echten Outlook-Account raus (Header-Check beim Empfänger).
5. Reply vom Empfänger → kommt zurück über Postmark-Inbound (Subdomain) → Thread funktioniert.
6. „Verbindung trennen" → grüner Toast → Card zeigt wieder „Mit Outlook verbinden".

## Fehlerbehandlung

Häufige Probleme:

- **„AADSTS50011: The reply URL specified in the request does not match"** → Umleitungs-URI in Schritt 6 stimmt nicht exakt mit dem ENV überein. Trailing-Slash, http vs https, Subdomain genau prüfen.
- **„AADSTS70011: The provided value for the input parameter 'scope' is not valid"** → Scope falsch geschrieben, muss exakt `https://graph.microsoft.com/Mail.Send offline_access openid email` sein (siehe Code).
- **„invalid_grant"** beim Refresh → Refresh-Token wurde rotiert oder Owner hat in Microsoft-Account die App entfernt. Auftragswerk markiert die Connection als `widerrufen`, Owner muss neu verbinden.

---

**Iron Rule (Wiederholung):** `TOKEN_ENCRYPTION_KEY` darf NIE verloren gehen. Backup in 1Password/Bitwarden Pflicht. Verlust = alle Microsoft-Connections unentschlüsselbar = alle Owner müssen neu verbinden.
