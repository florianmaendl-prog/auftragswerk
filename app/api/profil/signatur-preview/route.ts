import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildSignaturHtml } from '@/lib/signatur';

/**
 * POST /api/profil/signatur-preview  → liefert HTML-Vorschau zurück
 *
 * Owner klickt im Entwurf-Editor „Vorschau wie's beim Kunden ankommt".
 * Wir bauen das gleiche HTML wie beim Versand, ABER ersetzen das
 * cid:-Logo-Tag durch eine Signed-URL aus dem Storage – cid: kann
 * der Browser direkt nicht darstellen, das funktioniert nur im
 * Mail-Client (multipart/related-Auflösung).
 *
 * Body: { bodyText: string }
 * Return: { html: string }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('betrieb_id')
    .eq('id', user.id)
    .single();
  const betriebId = profile?.betrieb_id as string | null | undefined;
  if (!betriebId) {
    return NextResponse.json({ error: 'Kein Betrieb verknüpft' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const bodyText: string =
    typeof body?.bodyText === 'string' ? body.bodyText : '';

  const { data: betrieb } = await supabaseAdmin
    .from('betriebe')
    .select('signatur, logo_storage_path')
    .eq('id', betriebId)
    .single();

  const { bodyHtml, inlineAttachment } = await buildSignaturHtml({
    betriebId,
    bodyText,
    signaturPlain: betrieb?.signatur ?? null,
  });

  // Für die Preview im Browser cid:auftragswerk-logo durch eine Signed-URL
  // ersetzen. Im echten Versand bleibt cid: – Mail-Clients lösen das selbst.
  let htmlForPreview = bodyHtml;
  if (inlineAttachment && betrieb?.logo_storage_path) {
    const { data: signed } = await supabaseAdmin.storage
      .from('logos')
      .createSignedUrl(betrieb.logo_storage_path, 300);
    if (signed?.signedUrl) {
      htmlForPreview = htmlForPreview.replace(
        new RegExp(`cid:${inlineAttachment.contentId}`, 'g'),
        signed.signedUrl
      );
    }
  }

  return NextResponse.json({ html: htmlForPreview });
}
