/**
 * Postmark Sender Signatures API Wrapper
 * 
 * Erlaubt jedem Betrieb eine eigene Versand-Adresse mit DKIM.
 * 
 * Workflow:
 *   1. createSenderSignature(email, name) → erstellt Sender bei Postmark
 *   2. Postmark gibt DNS-Records zurück (DKIM-TXT + Return-Path-CNAME)
 *   3. Betrieb trägt DNS-Records bei seinem Provider ein
 *   4. verifySignature(id) → triggert DKIM-Check bei Postmark
 *   5. getSignatureStatus(id) → ist confirmed (DKIM ok)?
 */

const POSTMARK_API_BASE = 'https://api.postmarkapp.com';

function getAccountToken(): string {
  const token = process.env.POSTMARK_ACCOUNT_TOKEN;
  if (!token) {
    throw new Error('POSTMARK_ACCOUNT_TOKEN environment variable not set');
  }
  return token;
}

async function postmarkRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${POSTMARK_API_BASE}${endpoint}`, {
    method,
    headers: {
      'X-Postmark-Account-Token': getAccountToken(),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.Message || `Postmark API error: ${response.status}`;
    throw new Error(`Postmark API: ${errorMsg} (ErrorCode: ${data.ErrorCode})`);
  }

  return data as T;
}

// ============================================
// TYPES
// ============================================

export interface SenderSignature {
  ID: number;
  Domain: string;
  EmailAddress: string;
  ReplyToEmailAddress: string;
  Name: string;
  Confirmed: boolean;
  SPFVerified: boolean;
  SPFHost: string;
  SPFTextValue: string;
  DKIMVerified: boolean;
  WeakDKIM: boolean;
  DKIMHost: string;
  DKIMTextValue: string;
  DKIMPendingHost: string;
  DKIMPendingTextValue: string;
  DKIMRevokedHost: string;
  DKIMRevokedTextValue: string;
  SafeToRemoveRevokedKeyFromDNS: boolean;
  DKIMUpdateStatus: string;
  ReturnPathDomain: string;
  ReturnPathDomainVerified: boolean;
  ReturnPathDomainCNAMEValue: string;
}

export interface DnsRecord {
  type: 'TXT' | 'CNAME';
  hostname: string;
  value: string;
  description: string;
  verified: boolean;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Erstellt eine neue Sender Signature in Postmark.
 * Postmark schickt automatisch eine Verifikations-Mail an die Email-Adresse.
 * Die Domain-Verifikation läuft separat über DKIM-DNS-Records.
 */
export async function createSenderSignature(
  email: string,
  name: string,
  replyToEmail?: string
): Promise<SenderSignature> {
  return postmarkRequest<SenderSignature>('/senders', 'POST', {
    FromEmail: email,
    Name: name,
    ReplyToEmail: replyToEmail || email,
  });
}

/**
 * Holt den aktuellen Status einer Sender Signature.
 */
export async function getSignatureStatus(
  signatureId: number
): Promise<SenderSignature> {
  return postmarkRequest<SenderSignature>(`/senders/${signatureId}`, 'GET');
}

/**
 * Triggert die DKIM-Verifikation. Postmark prüft die DNS-Records.
 * Wenn DNS-Records korrekt gesetzt sind → DKIMVerified = true.
 */
export async function verifyDkim(signatureId: number): Promise<SenderSignature> {
  return postmarkRequest<SenderSignature>(
    `/senders/${signatureId}/verifydkim`,
    'POST'
  );
}

/**
 * Triggert die Return-Path-Verifikation.
 */
export async function verifyReturnPath(
  signatureId: number
): Promise<SenderSignature> {
  return postmarkRequest<SenderSignature>(
    `/senders/${signatureId}/verifyreturnpath`,
    'POST'
  );
}

/**
 * Löscht eine Sender Signature.
 */
export async function deleteSignature(signatureId: number): Promise<void> {
  await postmarkRequest<{ Message: string }>(
    `/senders/${signatureId}`,
    'DELETE'
  );
}

/**
 * Holt alle Sender Signatures (für Admin-Übersicht).
 */
export async function listSignatures(): Promise<{
  TotalCount: number;
  SenderSignatures: SenderSignature[];
}> {
  return postmarkRequest('/senders?count=100&offset=0', 'GET');
}

// ============================================
// HELPER: DNS-Records extrahieren
// ============================================

/**
 * Extrahiert aus einer Sender Signature die DNS-Records die der Betrieb
 * bei seinem Provider eintragen muss.
 */
export function extractDnsRecords(signature: SenderSignature): DnsRecord[] {
  const records: DnsRecord[] = [];

  // DKIM TXT Record (für Email-Authentifizierung)
  if (signature.DKIMHost && signature.DKIMTextValue) {
    records.push({
      type: 'TXT',
      hostname: signature.DKIMHost,
      value: signature.DKIMTextValue,
      description: 'DKIM-Signatur für Email-Authentifizierung',
      verified: signature.DKIMVerified,
    });
  }

  // Return-Path CNAME (für Bounces)
  if (signature.ReturnPathDomain) {
    records.push({
      type: 'CNAME',
      hostname: signature.ReturnPathDomain,
      value: signature.ReturnPathDomainCNAMEValue || 'pm.mtasv.net',
      description: 'Return-Path für Bounce-Handling',
      verified: signature.ReturnPathDomainVerified,
    });
  }

  return records;
}

/**
 * Prüft ob eine Sender Signature voll verifiziert ist (Email + DKIM + Return-Path).
 */
export function isFullyVerified(signature: SenderSignature): boolean {
  return (
    signature.Confirmed &&
    signature.DKIMVerified &&
    signature.ReturnPathDomainVerified
  );
}