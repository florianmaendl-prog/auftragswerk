import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'node:crypto';

/**
 * POST /api/kunden/[id]/dateien  → Owner-Upload einer Datei
 *
 * multipart/form-data, Feld "file". Datei landet im Bucket
 * `kunden_dateien` mit Pfad <betrieb_id>/<kunde_id>/<uuid>_<safeName>,
 * Eintrag in kunden_dateien-Tabelle mit quelle='manuell_upload'.
 *
 * Inbound-Anhänge werden separat verlinkt (lib/kunden-sync.ts) – die
 * liegen weiter im anhaenge-Bucket, nur die Referenz wird angelegt.
 */
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: kundeId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // Profile für Betrieb-Id
  const { data: profile } = await supabase
    .from('profiles')
    .select('betrieb_id')
    .eq('id', user.id)
    .single();
  const betriebId = profile?.betrieb_id as string | null | undefined;
  if (!betriebId) {
    return NextResponse.json({ error: 'Kein Betrieb verknüpft' }, { status: 404 });
  }

  // Kunde gehört zum Betrieb? RLS sichert das, hier nur explicit für Pfad
  const { data: kunde, error: readError } = await supabase
    .from('kunden')
    .select('id, betrieb_id')
    .eq('id', kundeId)
    .single();
  if (readError || !kunde || kunde.betrieb_id !== betriebId) {
    return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Feld "file" fehlt' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB, max 25 MB)` },
      { status: 400 }
    );
  }

  // Filename sanitisieren (gleiche Logik wie lib/anhaenge.ts)
  const safeName = sanitizeFilename(file.name);
  const path = `${betriebId}/${kundeId}/${randomUUID()}_${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from('kunden_dateien')
    .upload(path, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json(
      { error: `Upload fehlgeschlagen: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { error: insertError } = await supabaseAdmin
    .from('kunden_dateien')
    .insert({
      kunde_id: kundeId,
      betrieb_id: betriebId,
      dateiname: file.name,
      content_type: file.type || 'application/octet-stream',
      groesse_bytes: file.size,
      storage_path: path,
      storage_bucket: 'kunden_dateien',
      quelle: 'manuell_upload',
    });
  if (insertError) {
    // Orphan-Cleanup
    await supabaseAdmin.storage.from('kunden_dateien').remove([path]).catch(() => undefined);
    return NextResponse.json(
      { error: `DB-Insert fehlgeschlagen: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

function sanitizeFilename(name: string): string {
  const raw = name || 'datei';
  const trans = raw
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss');
  const lastDot = trans.lastIndexOf('.');
  const stamm = lastDot > 0 ? trans.slice(0, lastDot) : trans;
  const ext = lastDot > 0 ? trans.slice(lastDot) : '';
  const cleanStamm = stamm.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_');
  const cleanExt = ext.replace(/[^A-Za-z0-9.]/g, '');
  const result = (cleanStamm + cleanExt).slice(0, 200);
  return result.length > 0 ? result : 'datei';
}
