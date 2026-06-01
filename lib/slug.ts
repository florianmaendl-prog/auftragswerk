/**
 * Slug-Generator für `betrieb.inbound_email` auf der Catch-All-Subdomain
 * `kunden.auftragswerk.app` (Welle E.2).
 *
 * Aus dem Betriebsnamen wird eine URL- und E-Mail-sichere Adresse:
 *   "Bauelemente Rapp GmbH" → "bauelemente-rapp"
 *   "Metallbau Müller & Söhne" → "metallbau-mueller-und-soehne"
 *   "AB+ Elektro 24" → "ab-elektro-24"
 *
 * Konflikt-Resolution: wenn der Wunsch-Slug schon vergeben ist, hängen
 * wir `-2`, `-3` etc. an. Caller stellt die Existenz-Check-Query bereit.
 *
 * Unterstützt deutsche Umlaute (ä→ae, ö→oe, ü→ue, ß→ss).
 */

const SUBDOMAIN = 'kunden.auftragswerk.app';

const UMLAUTE: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'ae',
  Ö: 'oe',
  Ü: 'ue',
  ß: 'ss',
};

const STOPWOERTER = new Set([
  'gmbh',
  'mbh',
  'ag',
  'kg',
  'ohg',
  'ug',
  'co',
  'gbr',
  'und',
  'der',
  'die',
  'das',
]);

/**
 * Wandelt einen Betriebsnamen in einen rohen Slug-Kandidaten um.
 * Ohne Konflikt-Auflösung.
 */
export function nameZuSlug(name: string): string {
  if (!name) return 'betrieb';

  // Umlaute + ß ersetzen
  let s = name;
  for (const [von, zu] of Object.entries(UMLAUTE)) {
    s = s.replaceAll(von, zu);
  }

  // & und + zu "und"
  s = s.replace(/[&+]/g, ' und ');

  // Alles nicht-Buchstaben/Ziffern zu Bindestrich
  s = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Stoppwörter filtern (Rechtsformen + Bindewörter)
  const teile = s.split('-').filter((t) => t.length > 0 && !STOPWOERTER.has(t));
  if (teile.length === 0) {
    // Fallback wenn nur Stoppwörter übrig waren
    return s || 'betrieb';
  }

  // Auf 40 Zeichen begrenzen (Subdomain-Adressen sollen lesbar bleiben)
  const slug = teile.join('-').slice(0, 40).replace(/-+$/g, '');
  return slug || 'betrieb';
}

/**
 * Baut die volle Inbound-Adresse aus einem Slug.
 */
export function slugZuInboundEmail(slug: string): string {
  return `${slug}@${SUBDOMAIN}`;
}

/**
 * Generiert einen eindeutigen Slug mit Conflict-Resolution.
 * `existiertCheck(slug)` muss true zurückgeben wenn der Slug bereits
 * vergeben ist. Probiert max 99 Suffixe, dann wirft.
 */
export async function generiereEindeutigenSlug(
  name: string,
  existiertCheck: (slug: string) => Promise<boolean>
): Promise<string> {
  const basis = nameZuSlug(name);
  if (!(await existiertCheck(basis))) return basis;

  for (let i = 2; i <= 99; i++) {
    const kandidat = `${basis}-${i}`;
    if (!(await existiertCheck(kandidat))) return kandidat;
  }

  throw new Error(
    `Slug-Konflikt: ${basis} und 98 Varianten alle vergeben – sehr ungewöhnlich, bitte manuell prüfen`
  );
}

export const KUNDEN_SUBDOMAIN = SUBDOMAIN;
