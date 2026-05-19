import { NextRequest, NextResponse } from 'next/server';
import { cleanMail } from '@/lib/mail-cleaner';

/**
 * Test-Endpoint für den Mail-Cleaner
 * 
 * Usage:
 * POST /api/test-cleaner
 * Body: { textBody: "...", htmlBody: "..." }
 */
export async function POST(req: NextRequest) {
  try {
    const { textBody, htmlBody } = await req.json();
    
    const result = cleanMail(textBody, htmlBody);
    
    return NextResponse.json({
      success: true,
      result,
      preview: {
        first_200_chars: result.cleaned_text.substring(0, 200),
        last_100_chars: result.cleaned_text.substring(result.cleaned_text.length - 100),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'cleaner test endpoint ready' });
}
