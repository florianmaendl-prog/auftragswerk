/**
 * Claude API Wrapper für Auftragswerk
 *
 * Zentrale Funktion für alle Claude-Aufrufe.
 * Loggt jeden Call in ai_runs (Tokens, Kosten, Latenz, Status).
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Pricing pro Million Tokens (Stand 2026, USD)
const MODEL_PRICING = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0, cached_input: 0.1 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, cached_input: 0.3 },
} as const;

export type SupportedModel = keyof typeof MODEL_PRICING;

export interface ClaudeCallOptions {
  model: SupportedModel;
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
  cacheSystemPrompt?: boolean;
  // Für ai_runs Logging
  zweck: 'klassifikation' | 'antwortentwurf' | 'angebotsentwurf' | 'andere';
  betriebId?: string;
  anfrageId?: string;
}

export interface ClaudeCallResult {
  success: boolean;
  text: string;
  ai_run_id: string | null;
  tokens_input: number;
  tokens_output: number;
  tokens_cached: number;
  cost_usd: number;
  latency_ms: number;
  error?: string;
}

/**
 * Hauptfunktion: Ruft Claude auf + loggt automatisch
 */
export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeCallResult> {
  const startTime = Date.now();
  let aiRunId: string | null = null;

  try {
    // Prompt Caching: System-Prompt cachen wenn Flag gesetzt
    const systemBlocks = opts.cacheSystemPrompt
      ? [
          {
            type: 'text' as const,
            text: opts.systemPrompt,
            cache_control: { type: 'ephemeral' as const },
          },
        ]
      : opts.systemPrompt;

    // API-Call
    const response = await anthropic.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0,
      system: systemBlocks,
      messages: [
        {
          role: 'user',
          content: opts.userMessage,
        },
      ],
    });

    const latencyMs = Date.now() - startTime;

    // Token-Verbrauch extrahieren
    const tokensInput = response.usage.input_tokens;
    const tokensOutput = response.usage.output_tokens;
    const tokensCached = response.usage.cache_read_input_tokens || 0;

    // Kosten berechnen (USD pro Mio Tokens, also durch 1.000.000 teilen)
    const pricing = MODEL_PRICING[opts.model];
    const costUsd =
      (tokensInput * pricing.input) / 1_000_000 +
      (tokensOutput * pricing.output) / 1_000_000 +
      (tokensCached * pricing.cached_input) / 1_000_000;

    // Text extrahieren
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n');

    // In ai_runs loggen
    const { data: aiRun } = await supabaseAdmin
      .from('ai_runs')
      .insert({
        betrieb_id: opts.betriebId,
        anfrage_id: opts.anfrageId,
        zweck: opts.zweck,
        model: opts.model,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        tokens_cached: tokensCached,
        cost_usd: costUsd,
        latency_ms: latencyMs,
        status: 'ok',
      })
      .select()
      .single();

    aiRunId = aiRun?.id ?? null;

    console.log(
      `✓ Claude ${opts.model} (${opts.zweck}): ` +
        `${tokensInput} in / ${tokensOutput} out / ${tokensCached} cached, ` +
        `$${costUsd.toFixed(6)}, ${latencyMs}ms`
    );

    return {
      success: true,
      text,
      ai_run_id: aiRunId,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      tokens_cached: tokensCached,
      cost_usd: costUsd,
      latency_ms: latencyMs,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : 'Unbekannter Claude-Fehler';

    console.error('Claude API Fehler:', errorMsg);

    // Fehler-Log
    await supabaseAdmin.from('ai_runs').insert({
      betrieb_id: opts.betriebId,
      anfrage_id: opts.anfrageId,
      zweck: opts.zweck,
      model: opts.model,
      latency_ms: latencyMs,
      status: 'fehler',
      fehler_text: errorMsg,
    });

    return {
      success: false,
      text: '',
      ai_run_id: null,
      tokens_input: 0,
      tokens_output: 0,
      tokens_cached: 0,
      cost_usd: 0,
      latency_ms: latencyMs,
      error: errorMsg,
    };
  }
}