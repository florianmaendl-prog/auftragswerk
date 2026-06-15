import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendMail } from '@/lib/postmark';
import { sendeViaGmail } from '@/lib/gmail';
import { sendeViaMicrosoft } from '@/lib/microsoft';
import { buildSignaturHtml } from '@/lib/signatur';
import { AngebotPdf, type AngebotPdfProps } from '@/lib/angebot-pdf';
import type { AngebotPosition } from '@/lib/angebot';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/angebote/[id]/senden
 * Body: { betreff: string, bodyText: string }
 *
 * Versendet das Angebot per Mail an den Kunden mit PDF im Anhang.
 * Status wird auf 'versendet' gesetzt + versendet_am gestempelt + PDF
 * landet in kunden_dateien (Mini-CRM-Verknüpfung), damit Owner alle
 * Angebote pro Kunde an einem Ort sieht.
 *
 * Send-Pfad nutzt die 4-stufige Provider-Hierarchie aus Säule 1
 * (Microsoft → Gmail → Custom Sender → Postmark-Fallback).
 */
export async function POST(
  req: NextRequest,
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

  const body = await req.json().catch(() => null);
  const betreff = typeof body?.betreff === 'string' ? body.betreff.trim() : '';
  const bodyText = typeof body?.bodyText === 'string' ? body.bodyText.trim() : '';
  if (!betreff || !bodyText) {
    return NextResponse.json(
      { error: 'betreff und bodyText sind pflicht' },
      { status: 400 }
    );
  }

  // Angebot mit RLS holen
  const { data: angebot, error } = await supabase
    .from('angebote')
    .select(
      `id, anfrage_id, titel, einleitung, positionen, schlusstext,
       summe_netto, mwst_satz, summe_brutto, angebotsnummer, gueltig_bis,
       betrieb_id, status, created_at,
       empfaenger_name, empfaenger_firma, empfaenger_email,
       empfaenger_adresse, empfaenger_plz,
       anfragen (von_name, von_email)`
    )
    .eq('id', id)
    .single();
  if (error || !angebot) {
    return NextResponse.json({ error: 'Angebot nicht gefunden' }, { status: 404 });
  }

  type AnfrageJoin = { von_name: string | null; von_email: string } | null;
  const anfrageRaw = angebot.anfragen as unknown;
  const anfrageJoined: AnfrageJoin = Array.isArray(anfrageRaw)
    ? ((anfrageRaw as AnfrageJoin[])[0] ?? null)
    : (anfrageRaw as AnfrageJoin);

  // Empfänger am Angebot hat Vorrang, fällt zurück auf Anfrage
  const empfaengerEmail = (
    angebot.empfaenger_email ||
    anfrageJoined?.von_email ||
    ''
  ).trim();
  const empfaengerName =
    angebot.empfaenger_name || anfrageJoined?.von_name || null;

  if (!empfaengerEmail) {
    return NextResponse.json(
      { error: 'Keine Empfänger-Email am Angebot gesetzt' },
      { status: 400 }
    );
  }

  // Stammdaten + Provider parallel
  const [{ data: betrieb }, { data: gmailConn }, { data: microsoftConn }] =
    await Promise.all([
      supabaseAdmin
        .from('betriebe')
        .select(
          'id, name, inhaber, inbound_email, signatur, sender_email, sender_name, sender_verified, logo_storage_path, logo_content_type'
        )
        .eq('id', angebot.betrieb_id)
        .single(),
      supabaseAdmin
        .from('gmail_connections')
        .select('id, google_email, status')
        .eq('betrieb_id', angebot.betrieb_id)
        .eq('status', 'aktiv')
        .maybeSingle(),
      supabaseAdmin
        .from('microsoft_connections')
        .select('id, microsoft_email, status')
        .eq('betrieb_id', angebot.betrieb_id)
        .eq('status', 'aktiv')
        .maybeSingle(),
    ]);

  if (!betrieb) {
    return NextResponse.json({ error: 'Betrieb nicht gefunden' }, { status: 404 });
  }

  // Logo + PDF rendern
  let logoUrl: string | null = null;
  if (betrieb.logo_storage_path) {
    const { data: signed } = await supabaseAdmin.storage
      .from('logos')
      .createSignedUrl(betrieb.logo_storage_path, 600);
    logoUrl = signed?.signedUrl ?? null;
  }

  // Kunden-Zeile in kunden-Tabelle (für Archivierung der PDF). Lookup
  // läuft auf die finale Empfänger-Email am Angebot, nicht auf
  // anfragen.von_email – Owner darf Empfänger frei umstellen.
  const { data: kundeRow } = await supabaseAdmin
    .from('kunden')
    .select('id, name, firma, adresse, plz')
    .eq('betrieb_id', angebot.betrieb_id)
    .eq('email', empfaengerEmail)
    .maybeSingle();

  const pdfProps: AngebotPdfProps = {
    betrieb: {
      name: betrieb.name ?? null,
      inhaber: betrieb.inhaber ?? null,
      sender_email: betrieb.sender_email ?? null,
      inbound_email: betrieb.inbound_email ?? null,
      signatur: betrieb.signatur ?? null,
      logo_url: logoUrl,
    },
    kunde: {
      name:
        angebot.empfaenger_name || kundeRow?.name || empfaengerName || null,
      firma: angebot.empfaenger_firma ?? kundeRow?.firma ?? null,
      adresse: angebot.empfaenger_adresse ?? kundeRow?.adresse ?? null,
      plz: angebot.empfaenger_plz ?? kundeRow?.plz ?? null,
      email: empfaengerEmail,
    },
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

  const element = createElement(AngebotPdf, pdfProps) as unknown as Parameters<
    typeof renderToBuffer
  >[0];
  const pdfBuffer = await renderToBuffer(element);
  const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
  const dateiname = angebot.angebotsnummer
    ? `Angebot-${angebot.angebotsnummer}.pdf`
    : `Angebot-${id.slice(0, 8)}.pdf`;

  // 4-stufige From-Wahl (gleiche Logik wie Versand-Route Säule 1)
  const useMicrosoft = !!microsoftConn?.microsoft_email;
  const useGmail = !useMicrosoft && !!gmailConn?.google_email;
  const useCustomSender =
    !useMicrosoft &&
    !useGmail &&
    !!(betrieb.sender_verified && betrieb.sender_email);

  const fromEmail = useMicrosoft
    ? microsoftConn!.microsoft_email
    : useGmail
    ? gmailConn!.google_email
    : useCustomSender
    ? betrieb.sender_email!
    : process.env.POSTMARK_FROM_EMAIL || 'info@auftragswerk.app';
  const fromName = useCustomSender
    ? betrieb.sender_name || betrieb.name || 'Auftragswerk'
    : betrieb.name || 'Auftragswerk';

  const replyToAddress =
    betrieb.inbound_email ||
    (useCustomSender ? betrieb.sender_email! : undefined) ||
    process.env.POSTMARK_REPLY_TO ||
    undefined;
  const replyToName = betrieb.name || fromName;

  // HTML-Body bauen (Signatur + Logo wie Säule 1)
  const { bodyHtml, inlineAttachment } = await buildSignaturHtml({
    betriebId: angebot.betrieb_id,
    bodyText,
    signaturPlain: betrieb.signatur ?? null,
  });
  const inlineAttachments = inlineAttachment
    ? [
        {
          name:
            'logo.' +
            (inlineAttachment.contentType.split('/')[1] || 'png').replace(
              'svg+xml',
              'svg'
            ),
          contentBase64: inlineAttachment.contentBase64,
          contentType: inlineAttachment.contentType,
          contentId: inlineAttachment.contentId,
        },
      ]
    : undefined;

  const attachments = [
    {
      name: dateiname,
      contentBase64: pdfBase64,
      contentType: 'application/pdf',
    },
  ];

  // Send-Pfad
  let sendOk = false;
  let sendError: string | null = null;

  const toName =
    angebot.empfaenger_name || kundeRow?.name || empfaengerName || undefined;

  if (useMicrosoft) {
    const r = await sendeViaMicrosoft(angebot.betrieb_id, {
      to: empfaengerEmail,
      toName,
      fromEmail,
      fromName,
      subject: betreff,
      bodyText,
      bodyHtml,
      replyTo: replyToAddress,
      replyToName,
      attachments,
      inlineAttachments,
    });
    sendOk = r.success;
    sendError = r.error ?? null;
  } else if (useGmail) {
    const r = await sendeViaGmail(angebot.betrieb_id, {
      to: empfaengerEmail,
      toName,
      fromEmail,
      fromName,
      subject: betreff,
      bodyText,
      bodyHtml,
      replyTo: replyToAddress,
      replyToName,
      attachments,
      inlineAttachments,
    });
    sendOk = r.success;
    sendError = r.error ?? null;
  } else {
    const r = await sendMail({
      to: empfaengerEmail,
      toName,
      fromEmail,
      fromName,
      subject: betreff,
      bodyText,
      bodyHtml,
      replyTo: replyToAddress,
      replyToName,
      attachments,
      inlineAttachments,
      tag: 'angebot',
      metadata: { angebot_id: id, betrieb_id: angebot.betrieb_id },
    });
    sendOk = r.success;
    sendError = r.error ?? null;
  }

  if (!sendOk) {
    return NextResponse.json(
      { error: `Versand fehlgeschlagen: ${sendError ?? 'unbekannt'}` },
      { status: 500 }
    );
  }

  // Status + versendet_am updaten
  await supabaseAdmin
    .from('angebote')
    .update({
      status: 'versendet',
      versendet_am: new Date().toISOString(),
    })
    .eq('id', id);

  // PDF in kunden_dateien archivieren (Mini-CRM-Verknüpfung)
  if (kundeRow?.id) {
    try {
      const path = `${angebot.betrieb_id}/${kundeRow.id}/angebote/${randomUUID()}_${dateiname}`;
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('kunden_dateien')
        .upload(path, new Uint8Array(pdfBuffer), {
          contentType: 'application/pdf',
          upsert: false,
        });
      if (!uploadErr) {
        await supabaseAdmin.from('kunden_dateien').insert({
          kunde_id: kundeRow.id,
          betrieb_id: angebot.betrieb_id,
          dateiname,
          content_type: 'application/pdf',
          groesse_bytes: pdfBuffer.byteLength,
          storage_path: path,
          storage_bucket: 'kunden_dateien',
          quelle: 'manuell_upload',
          anfrage_id: angebot.anfrage_id,
        });
      }
    } catch (err) {
      console.warn(
        'Angebot-PDF in kunden_dateien archivieren fehlgeschlagen (nicht-blockend):',
        err instanceof Error ? err.message : err
      );
    }
  }

  return NextResponse.json({ success: true });
}
