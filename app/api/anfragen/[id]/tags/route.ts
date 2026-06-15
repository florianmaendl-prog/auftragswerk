import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/anfragen/[id]/tags
 * Body: { tag: string, action: 'add' | 'remove' | 'toggle' }
 *
 * Setzt oder entfernt einen Tag auf einer Anfrage. RLS prüft Zugriff
 * über profile.betrieb_id → anfragen.betrieb_id.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: anfrageId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const tagRaw = typeof body?.tag === 'string' ? body.tag.trim() : '';
  const action: 'add' | 'remove' | 'toggle' = body?.action ?? 'toggle';
  if (!tagRaw) {
    return NextResponse.json({ error: 'tag fehlt im Body' }, { status: 400 });
  }
  if (tagRaw.length > 60) {
    return NextResponse.json({ error: 'tag zu lang (max 60)' }, { status: 400 });
  }

  // RLS-konforme Read über User-Client; Update über Admin damit der Array-
  // Append atomar bleibt.
  const { data: anfrage, error: readError } = await supabase
    .from('anfragen')
    .select('id, tags, betrieb_id')
    .eq('id', anfrageId)
    .single();
  if (readError || !anfrage) {
    return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 });
  }

  const tags = Array.isArray(anfrage.tags) ? [...anfrage.tags] : [];
  const hat = tags.includes(tagRaw);
  let neueTags: string[];
  if (action === 'add' || (action === 'toggle' && !hat)) {
    neueTags = hat ? tags : [...tags, tagRaw].sort();
  } else {
    neueTags = tags.filter((t) => t !== tagRaw);
  }

  const { error: updateError } = await supabaseAdmin
    .from('anfragen')
    .update({ tags: neueTags })
    .eq('id', anfrageId);

  if (updateError) {
    return NextResponse.json(
      { error: `Update fehlgeschlagen: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, tags: neueTags });
}
