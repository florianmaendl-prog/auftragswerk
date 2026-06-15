import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/kunden/[id]/dateien/[dateiId]
 *   → Signed-URL (5 Min TTL) zum Download – Owner klickt im UI auf den
 *     Dateinamen, wir liefern ihn die signed-URL zurück.
 *
 * DELETE /api/kunden/[id]/dateien/[dateiId]
 *   → Datei löschen: bei manuellem Upload auch aus dem Storage entfernen,
 *     bei Inbound-Verknüpfung nur die kunden_dateien-Zeile (Original im
 *     anhaenge-Bucket bleibt für die Anfrage-Detail-Page).
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; dateiId: string }> }
) {
  const { dateiId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { data: datei, error } = await supabase
    .from('kunden_dateien')
    .select('storage_path, storage_bucket, dateiname')
    .eq('id', dateiId)
    .single();
  if (error || !datei) {
    return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(datei.storage_bucket)
    .createSignedUrl(datei.storage_path, 300, {
      download: datei.dateiname,
    });
  if (signError || !signed) {
    return NextResponse.json(
      { error: `Signed-URL fehlgeschlagen: ${signError?.message ?? 'unbekannt'}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ url: signed.signedUrl });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; dateiId: string }> }
) {
  const { dateiId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // RLS-Read prüft Zugriff
  const { data: datei, error } = await supabase
    .from('kunden_dateien')
    .select('id, storage_path, storage_bucket, quelle')
    .eq('id', dateiId)
    .single();
  if (error || !datei) {
    return NextResponse.json({ error: 'Datei nicht gefunden' }, { status: 404 });
  }

  // Bei manuellem Upload auch aus Storage löschen – Inbound-Verknüpfung
  // belässt die Original-Datei (kommt aus anhaenge-Bucket, die Anfrage-
  // Detail-Page zeigt sie weiter an).
  if (datei.quelle === 'manuell_upload') {
    await supabaseAdmin.storage
      .from(datei.storage_bucket)
      .remove([datei.storage_path])
      .catch(() => undefined);
  }

  const { error: deleteError } = await supabaseAdmin
    .from('kunden_dateien')
    .delete()
    .eq('id', dateiId);
  if (deleteError) {
    return NextResponse.json(
      { error: `Löschen fehlgeschlagen: ${deleteError.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true });
}
