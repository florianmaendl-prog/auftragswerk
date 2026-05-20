import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const ERLAUBTE_STATI = [
  'neu',
  'entwurf_bereit',
  'manuell_pruefen',
  'info',
  'versendet',
  'reply_eingegangen',
  'erledigt',
  'aussortiert',
];

// PATCH /api/anfragen/[id] – Status ändern oder soft-delete
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth-Check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  }

  let body: { action?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalides JSON' }, { status: 400 });
  }

  const { action, status } = body;

  // SOFT-DELETE
  if (action === 'soft_delete') {
    const { error } = await supabase
      .from('anfragen')
      .update({ geloescht_am: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, action: 'soft_deleted' });
  }

  // RESTORE (aus Papierkorb)
  if (action === 'restore') {
    const { error } = await supabase
      .from('anfragen')
      .update({ geloescht_am: null })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, action: 'restored' });
  }

  // STATUS ÄNDERN
  if (status) {
    if (!ERLAUBTE_STATI.includes(status)) {
      return NextResponse.json(
        { error: `Status '${status}' nicht erlaubt` },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('anfragen')
      .update({ status })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, status });
  }

  return NextResponse.json(
    { error: 'Action oder Status fehlt' },
    { status: 400 }
  );
}

// DELETE /api/anfragen/[id] – Hart löschen (nur aus Papierkorb)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  }

  // Sicherheits-Check: Nur löschen wenn schon im Papierkorb
  const { data: anfrage } = await supabase
    .from('anfragen')
    .select('id, geloescht_am')
    .eq('id', id)
    .single();

  if (!anfrage) {
    return NextResponse.json({ error: 'Anfrage nicht gefunden' }, { status: 404 });
  }

  if (!anfrage.geloescht_am) {
    return NextResponse.json(
      {
        error:
          'Anfrage ist nicht im Papierkorb. Erst soft-delete, dann hart löschen.',
      },
      { status: 400 }
    );
  }

  // Hart löschen – CASCADE räumt verknüpfte Tabellen mit auf
  const { error } = await supabase.from('anfragen').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, action: 'hard_deleted' });
}