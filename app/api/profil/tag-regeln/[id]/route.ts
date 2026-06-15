import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * DELETE /api/profil/tag-regeln/[id]  → Regel löschen
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: regelId } = await params;

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
  const betriebId = profile?.betrieb_id;
  if (!betriebId) {
    return NextResponse.json({ error: 'Kein Betrieb verknüpft' }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from('tag_regeln')
    .delete()
    .eq('id', regelId)
    .eq('betrieb_id', betriebId);

  if (error) {
    return NextResponse.json(
      { error: `Löschen fehlgeschlagen: ${error.message}` },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true });
}
