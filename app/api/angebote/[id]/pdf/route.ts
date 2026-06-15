import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { AngebotPdf, type AngebotPdfProps } from '@/lib/angebot-pdf';
import type { AngebotPosition } from '@/lib/angebot';

// react-pdf braucht Node-Runtime (Buffer, native Helvetica-Font etc.)
export const runtime = 'nodejs';

/**
 * GET /api/angebote/[id]/pdf  → liefert das Angebot als PDF aus
 *
 * Lädt Angebot + Betriebs-Stammdaten + Kunden-Daten + Logo-Signed-URL,
 * rendert mit @react-pdf/renderer, returnt application/pdf zum Download.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // Angebot mit RLS lesen
  const { data: angebot, error } = await supabase
    .from('angebote')
    .select(
      `id, anfrage_id, titel, einleitung, positionen, schlusstext,
       summe_netto, mwst_satz, summe_brutto, angebotsnummer, gueltig_bis,
       betrieb_id, created_at,
       empfaenger_name, empfaenger_firma, empfaenger_email,
       empfaenger_adresse, empfaenger_plz,
       anfragen (von_name, von_email)`
    )
    .eq('id', id)
    .single();

  if (error || !angebot) {
    return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 });
  }

  // Betriebs-Stammdaten + Logo + Signatur
  const { data: betrieb } = await supabaseAdmin
    .from('betriebe')
    .select(
      'name, inhaber, sender_email, sender_name, inbound_email, signatur, logo_storage_path, logo_content_type'
    )
    .eq('id', angebot.betrieb_id)
    .single();

  // Logo als Signed-URL (PDF-Rendering läd das Bild per HTTP)
  let logoUrl: string | null = null;
  if (betrieb?.logo_storage_path) {
    const { data: signed } = await supabaseAdmin.storage
      .from('logos')
      .createSignedUrl(betrieb.logo_storage_path, 300);
    logoUrl = signed?.signedUrl ?? null;
  }

  // Empfänger: am Angebot direkt gespeichert hat Vorrang (Owner kann
  // im Editor frei editieren, auch für Angebote ohne Anfrage). Fallback
  // nur wenn am Angebot leer: kunden-Tabelle → Anfrage.
  type AnfrageJoin = { von_name: string | null; von_email: string } | null;
  const anfrageRaw = angebot.anfragen as unknown;
  const anfrageJoined: AnfrageJoin = Array.isArray(anfrageRaw)
    ? ((anfrageRaw as AnfrageJoin[])[0] ?? null)
    : (anfrageRaw as AnfrageJoin);

  let fallbackKunde: AngebotPdfProps['kunde'] = {
    name: anfrageJoined?.von_name ?? null,
    email: anfrageJoined?.von_email ?? null,
  };
  if (anfrageJoined?.von_email) {
    const { data: kundeRow } = await supabaseAdmin
      .from('kunden')
      .select('name, firma, adresse, plz')
      .eq('betrieb_id', angebot.betrieb_id)
      .eq('email', anfrageJoined.von_email)
      .maybeSingle();
    if (kundeRow) {
      fallbackKunde = {
        name: kundeRow.name || fallbackKunde.name,
        firma: kundeRow.firma,
        adresse: kundeRow.adresse,
        plz: kundeRow.plz,
        email: anfrageJoined.von_email,
      };
    }
  }

  const kunde: AngebotPdfProps['kunde'] = {
    name: angebot.empfaenger_name || fallbackKunde.name,
    firma: angebot.empfaenger_firma ?? fallbackKunde.firma ?? null,
    adresse: angebot.empfaenger_adresse ?? fallbackKunde.adresse ?? null,
    plz: angebot.empfaenger_plz ?? fallbackKunde.plz ?? null,
    email: angebot.empfaenger_email || fallbackKunde.email,
  };

  const props: AngebotPdfProps = {
    betrieb: {
      name: betrieb?.name ?? null,
      inhaber: betrieb?.inhaber ?? null,
      sender_email: betrieb?.sender_email ?? null,
      inbound_email: betrieb?.inbound_email ?? null,
      signatur: betrieb?.signatur ?? null,
      logo_url: logoUrl,
    },
    kunde,
    angebot: {
      angebotsnummer: angebot.angebotsnummer ?? null,
      titel: angebot.titel ?? null,
      einleitung: angebot.einleitung ?? null,
      positionen: (angebot.positionen ?? []) as AngebotPosition[],
      schlusstext: angebot.schlusstext ?? null,
      mwst_satz: Number(angebot.mwst_satz) || 19,
      summe_netto: Number(angebot.summe_netto) || 0,
      summe_brutto: Number(angebot.summe_brutto) || 0,
      gueltig_bis: angebot.gueltig_bis ?? null,
      erstellt_am: angebot.created_at,
    },
  };

  // @react-pdf/renderer types sind streng auf DocumentProps – Type-Cast OK.
  const element = createElement(AngebotPdf, props) as unknown as Parameters<
    typeof renderToBuffer
  >[0];
  const buffer = await renderToBuffer(element);
  const dateiname = angebot.angebotsnummer
    ? `Angebot-${angebot.angebotsnummer}.pdf`
    : `Angebot-${id.slice(0, 8)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${dateiname}"`,
      'Cache-Control': 'no-store',
    },
  });
}
