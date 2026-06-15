import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/profil/logo  → Logo-Upload (multipart/form-data, Feld "file")
 * DELETE /api/profil/logo → Logo entfernen
 *
 * Premium-Signatur (Welle P2): Owner lädt Logo hoch, beim Send-Pfad
 * wird's als Inline-Attachment unter die Signatur eingebettet.
 *
 * Limits:
 *   - max 2 MB pro Logo (Mail-Größen-Friendly)
 *   - nur Bild-MIME-Types (png/jpeg/svg/webp)
 *   - pro Betrieb genau 1 Logo (Upload überschreibt)
 */

const MAX_BYTES = 2 * 1024 * 1024;
const ERLAUBTE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
]);

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

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Datei fehlt im Feld "file"' }, { status: 400 });
  }
  const mime = file.type?.toLowerCase() ?? '';
  if (!ERLAUBTE_MIMES.has(mime)) {
    return NextResponse.json(
      { error: `Nicht erlaubter Dateityp (${mime || 'unbekannt'}). Erlaubt: PNG, JPEG, SVG, WEBP.` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 2 MB.` },
      { status: 400 }
    );
  }

  // Datei-Endung aus MIME ableiten (Owner-Filename ignorieren – Storage-Key
  // ist fix <betrieb_id>.<ext>, sonst orphans bei Re-Upload)
  const extByMime: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };
  const ext = extByMime[mime] ?? 'bin';
  const path = `${betriebId}/logo.${ext}`;

  // Alte Logo-Datei vor Upload löschen (Storage-Bucket erlaubt sonst nicht
  // mit upsert=true für andere Extension)
  const { data: betriebVorher } = await supabaseAdmin
    .from('betriebe')
    .select('logo_storage_path')
    .eq('id', betriebId)
    .single();
  if (betriebVorher?.logo_storage_path && betriebVorher.logo_storage_path !== path) {
    await supabaseAdmin.storage
      .from('logos')
      .remove([betriebVorher.logo_storage_path])
      .catch(() => undefined);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from('logos')
    .upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
  if (uploadError) {
    return NextResponse.json(
      { error: `Upload fehlgeschlagen: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { error: dbError } = await supabaseAdmin
    .from('betriebe')
    .update({
      logo_storage_path: path,
      logo_content_type: mime,
    })
    .eq('id', betriebId);
  if (dbError) {
    return NextResponse.json(
      { error: `DB-Update fehlgeschlagen: ${dbError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, storage_path: path, content_type: mime });
}

export async function DELETE() {
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

  const { data: betrieb } = await supabaseAdmin
    .from('betriebe')
    .select('logo_storage_path')
    .eq('id', betriebId)
    .single();

  if (betrieb?.logo_storage_path) {
    await supabaseAdmin.storage
      .from('logos')
      .remove([betrieb.logo_storage_path])
      .catch(() => undefined);
  }

  const { error: dbError } = await supabaseAdmin
    .from('betriebe')
    .update({ logo_storage_path: null, logo_content_type: null })
    .eq('id', betriebId);
  if (dbError) {
    return NextResponse.json(
      { error: `DB-Update fehlgeschlagen: ${dbError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

/**
 * GET /api/profil/logo  → Signed-URL für Logo-Preview im Profil
 */
export async function GET() {
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

  const { data: betrieb } = await supabaseAdmin
    .from('betriebe')
    .select('logo_storage_path, logo_content_type')
    .eq('id', betriebId)
    .single();

  if (!betrieb?.logo_storage_path) {
    return NextResponse.json({ logo: null });
  }

  const { data: signed, error } = await supabaseAdmin.storage
    .from('logos')
    .createSignedUrl(betrieb.logo_storage_path, 300);
  if (error || !signed) {
    return NextResponse.json(
      { error: `Signed-URL fehlgeschlagen: ${error?.message ?? 'unbekannt'}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    logo: { url: signed.signedUrl, content_type: betrieb.logo_content_type },
  });
}
