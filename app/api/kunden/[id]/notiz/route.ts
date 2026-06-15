import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/kunden/[id]/notiz
 * Body: { notizen: string }
 *
 * Owner-Notizen am Kunden speichern (z.B. "zahlt schlecht", "Anzahlung
 * verlangen"). RLS prüft Zugriff über profile.betrieb_id.
 */
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

  const body = await req.json().catch(() => null);
  const notizen = typeof body?.notizen === 'string' ? body.notizen : '';
  if (notizen.length > 10000) {
    return NextResponse.json({ error: 'Notiz zu lang (max 10k)' }, { status: 400 });
  }

  // RLS-Check via User-Client
  const { data: kunde, error: readError } = await supabase
    .from('kunden')
    .select('id')
    .eq('id', kundeId)
    .single();
  if (readError || !kunde) {
    return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('kunden')
    .update({ notizen: notizen.length > 0 ? notizen : null })
    .eq('id', kundeId);
  if (updateError) {
    return NextResponse.json(
      { error: `Update fehlgeschlagen: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
