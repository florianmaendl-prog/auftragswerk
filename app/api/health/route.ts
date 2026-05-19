import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Test: Können wir die Datenbank erreichen?
    const { count, error } = await supabaseAdmin
      .from('betriebe')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json(
        {
          status: 'error',
          database: 'fehler',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      service: 'auftragswerk',
      database: 'verbunden',
      betriebe_count: count ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    );
  }
}
