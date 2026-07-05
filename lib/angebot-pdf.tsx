/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';
import type { AngebotPosition } from './angebot';

/**
 * PDF-Komponente für ein Angebot. Brief-Layout mit Logo + Stammdaten
 * + Empfänger + Positionen-Tabelle + Summen + Schluss. Bewusst minimal
 * gestylt damit es premium-ruhig wirkt – schwarze Schrift, dezente
 * Lineaturen.
 *
 * Kein Auftragswerk-Branding im PDF – Iron Rule "vor Kunden unsichtbar".
 */

// Standard-Helvetica reicht – wir registrieren keine externen Schriften
// (würde Edge-Function-Bundle aufblähen). Helvetica ist solide für Brief.

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111',
    lineHeight: 1.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  betriebBlock: {
    flexDirection: 'column',
    gap: 1,
  },
  logo: {
    maxWidth: 120,
    maxHeight: 60,
    objectFit: 'contain',
  },
  empfaengerBlock: {
    marginTop: 30,
    marginBottom: 30,
  },
  empfaengerLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999',
    paddingBottom: 1,
    width: 200,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    fontSize: 9,
    color: '#444',
  },
  titel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  abschnitt: {
    marginBottom: 14,
  },
  positionenTable: {
    marginTop: 14,
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    paddingBottom: 4,
    fontSize: 8,
    color: '#444',
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  colPos: { width: 20 },
  colBezeichnung: { flex: 1, paddingRight: 6 },
  colMenge: { width: 55, textAlign: 'right' },
  colEinzel: { width: 65, textAlign: 'right' },
  colGesamt: { width: 75, textAlign: 'right', fontWeight: 'bold' },
  positionBezeichnung: { fontWeight: 'bold', marginBottom: 1 },
  positionBeschreibung: { fontSize: 8, color: '#555', lineHeight: 1.3 },
  epMarker: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#92400e',
  },
  epGesamt: { color: '#92400e', fontStyle: 'italic' as const },
  legende: {
    marginTop: 4,
    fontSize: 8,
    color: '#666',
    fontStyle: 'italic' as const,
  },
  summenRowEP: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    marginTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: '#d97706',
    fontSize: 9,
    color: '#92400e',
  },
  summenBlock: {
    marginTop: 12,
    alignSelf: 'flex-end',
    width: 250,
  },
  summenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    fontSize: 10,
  },
  summenRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#111',
    marginTop: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    fontSize: 8,
    color: '#666',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#999',
    paddingTop: 6,
  },
});

export type AngebotPdfProps = {
  betrieb: {
    name: string | null;
    inhaber: string | null;
    adresse?: string | null;
    plz?: string | null;
    ort?: string | null;
    sender_email?: string | null;
    inbound_email?: string | null;
    logo_url?: string | null;
    signatur?: string | null;
  };
  kunde: {
    name?: string | null;
    firma?: string | null;
    adresse?: string | null;
    plz?: string | null;
    email?: string | null;
  };
  angebot: {
    angebotsnummer: string | null;
    titel: string | null;
    einleitung: string | null;
    positionen: AngebotPosition[];
    schlusstext: string | null;
    mwst_satz: number;
    summe_netto: number;
    summe_brutto: number;
    gueltig_bis: string | null;
    erstellt_am: string;
  };
};

function formatEuro(n: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(n);
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE');
}

export function AngebotPdf(props: AngebotPdfProps) {
  const { betrieb, kunde, angebot } = props;
  const mwstBetrag = angebot.summe_brutto - angebot.summe_netto;

  // Eventualpositionen separat ausweisen (zählen nicht in summe_netto/brutto,
  // die kommen bereits ohne EP aus lib/angebot.ts berechneSummen).
  const hatEventualpositionen = angebot.positionen.some(
    (p) => p.eventualposition === true
  );
  const summeEventualNetto = angebot.positionen.reduce(
    (acc, p) => (p.eventualposition ? acc + p.gesamtpreis_netto : acc),
    0
  );

  // Empfänger-Block: Firma optional über Namen, dann Adresse
  const empfaengerLines: string[] = [];
  if (kunde.firma) empfaengerLines.push(kunde.firma);
  if (kunde.name) empfaengerLines.push(kunde.name);
  if (kunde.adresse) empfaengerLines.push(kunde.adresse);
  if (kunde.plz) empfaengerLines.push(kunde.plz);

  return (
    <Document>
      <Page size="A4" style={styles.page as any}>
        {/* Kopf: Betrieb links, Logo rechts */}
        <View style={styles.header as any}>
          <View style={styles.betriebBlock as any}>
            {betrieb.name && (
              <Text style={{ fontWeight: 'bold', fontSize: 11 }}>
                {betrieb.name}
              </Text>
            )}
            {betrieb.inhaber && <Text>{betrieb.inhaber}</Text>}
            {betrieb.adresse && <Text>{betrieb.adresse}</Text>}
            {(betrieb.plz || betrieb.ort) && (
              <Text>
                {[betrieb.plz, betrieb.ort].filter(Boolean).join(' ')}
              </Text>
            )}
            {betrieb.sender_email && (
              <Text style={{ marginTop: 4, fontSize: 9, color: '#444' }}>
                {betrieb.sender_email}
              </Text>
            )}
          </View>
          {betrieb.logo_url && (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={betrieb.logo_url} style={styles.logo as any} />
          )}
        </View>

        {/* Empfänger */}
        <View style={styles.empfaengerBlock as any}>
          <Text style={styles.empfaengerLabel as any}>An</Text>
          {empfaengerLines.map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </View>

        {/* Meta-Zeile: Angebotsnummer + Datum + Gültigkeit */}
        <View style={styles.metaRow as any}>
          <Text>
            Angebot{angebot.angebotsnummer ? ` ${angebot.angebotsnummer}` : ''}
          </Text>
          <Text>
            {formatDatum(angebot.erstellt_am)}
            {angebot.gueltig_bis
              ? `  ·  gültig bis ${formatDatum(angebot.gueltig_bis)}`
              : ''}
          </Text>
        </View>

        {/* Titel */}
        {angebot.titel && <Text style={styles.titel as any}>{angebot.titel}</Text>}

        {/* Einleitung */}
        {angebot.einleitung && (
          <View style={styles.abschnitt as any}>
            <Text>{angebot.einleitung}</Text>
          </View>
        )}

        {/* Positionen */}
        <View style={styles.positionenTable as any}>
          <View style={styles.tableHeader as any}>
            <Text style={styles.colPos as any}>Pos.</Text>
            <Text style={styles.colBezeichnung as any}>Bezeichnung</Text>
            <Text style={styles.colMenge as any}>Menge</Text>
            <Text style={styles.colEinzel as any}>Einzel €</Text>
            <Text style={styles.colGesamt as any}>Gesamt €</Text>
          </View>
          {angebot.positionen.map((p) => (
            <View key={p.pos} style={styles.tableRow as any}>
              <View style={styles.colPos as any}>
                <Text>{p.pos}</Text>
                {p.eventualposition && (
                  <Text style={styles.epMarker as any}>EP</Text>
                )}
              </View>
              <View style={styles.colBezeichnung as any}>
                <Text style={styles.positionBezeichnung as any}>
                  {p.bezeichnung}
                </Text>
                {p.beschreibung && (
                  <Text style={styles.positionBeschreibung as any}>
                    {p.beschreibung}
                  </Text>
                )}
              </View>
              <Text style={styles.colMenge as any}>
                {p.menge} {p.einheit}
              </Text>
              <Text style={styles.colEinzel as any}>
                {formatEuro(p.einzelpreis_netto)}
              </Text>
              <Text
                style={
                  p.eventualposition
                    ? { ...(styles.colGesamt as any), ...(styles.epGesamt as any) }
                    : (styles.colGesamt as any)
                }
              >
                {p.eventualposition
                  ? `(${formatEuro(p.gesamtpreis_netto)})`
                  : formatEuro(p.gesamtpreis_netto)}
              </Text>
            </View>
          ))}
          {hatEventualpositionen && (
            <Text style={styles.legende as any}>
              EP = Eventualposition, wird nur nach Rücksprache und bei
              tatsächlichem Bedarf berechnet.
            </Text>
          )}
        </View>

        {/* Summen */}
        <View style={styles.summenBlock as any}>
          <View style={styles.summenRow as any}>
            <Text>Summe netto</Text>
            <Text>{formatEuro(angebot.summe_netto)}</Text>
          </View>
          <View style={styles.summenRow as any}>
            <Text>MwSt {angebot.mwst_satz}%</Text>
            <Text>{formatEuro(mwstBetrag)}</Text>
          </View>
          <View style={styles.summenRowTotal as any}>
            <Text>Gesamtbetrag brutto</Text>
            <Text>{formatEuro(angebot.summe_brutto)}</Text>
          </View>
          {summeEventualNetto > 0 && (
            <View style={styles.summenRowEP as any}>
              <Text>Eventualpositionen gesamt (nur nach Rücksprache)</Text>
              <Text>+{formatEuro(summeEventualNetto)}</Text>
            </View>
          )}
        </View>

        {/* Schlusstext */}
        {angebot.schlusstext && (
          <View style={{ ...(styles.abschnitt as any), marginTop: 20 }}>
            <Text>{angebot.schlusstext}</Text>
          </View>
        )}

        {/* Signatur */}
        {betrieb.signatur && (
          <View style={{ marginTop: 24 }}>
            <Text>{betrieb.signatur}</Text>
          </View>
        )}

        {/* Footer: nur dezente Stammdaten, KEIN Auftragswerk-Branding */}
        <View style={styles.footer as any} fixed>
          <Text>{betrieb.name ?? ''}</Text>
          <Text>
            {betrieb.sender_email ?? betrieb.inbound_email ?? ''}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
