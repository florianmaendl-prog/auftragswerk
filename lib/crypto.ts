/**
 * AES-256-GCM Token-Verschlüsselung für OAuth-Tokens at-rest.
 *
 * Iron Rule: Gmail-Tokens (access + refresh) sind Vollzugriff aufs
 * Postfach. DSGVO-kritisch sie plain zu speichern → AES-256-GCM mit
 * authentifizierter Verschlüsselung (Integritäts-Tag).
 *
 * Format: <iv-base64>.<auth-tag-base64>.<ciphertext-base64>
 *   - iv: 12 Bytes (96 Bit, GCM-Standard)
 *   - auth tag: 16 Bytes (128 Bit)
 *   - ciphertext: variabel
 *
 * Key: TOKEN_ENCRYPTION_KEY aus Env, muss 32 Bytes (base64-decodiert)
 * sein → generiert mit `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
 *
 * NIE Tokens loggen, NIE in processing_errors schreiben.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY env-var fehlt – Token-Verschlüsselung nicht möglich'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY hat falsche Länge: ${key.length} Bytes (32 erwartet, base64-decoded)`
    );
  }
  return key;
}

/**
 * Verschlüsselt einen Token-String. Rückgabe: `<iv>.<authTag>.<ciphertext>` (alles base64).
 */
export function encryptToken(plain: string): string {
  if (!plain) {
    throw new Error('encryptToken: leerer Plaintext');
  }
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
}

/**
 * Entschlüsselt einen Token-String aus dem `<iv>.<authTag>.<ciphertext>`-Format.
 * Wirft, wenn AuthTag nicht stimmt (Manipulation oder falscher Key).
 */
export function decryptToken(encrypted: string): string {
  if (!encrypted) {
    throw new Error('decryptToken: leerer Ciphertext');
  }
  const parts = encrypted.split('.');
  if (parts.length !== 3) {
    throw new Error('decryptToken: ungültiges Format (erwartet iv.tag.ct)');
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`decryptToken: IV-Länge falsch (${iv.length})`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`decryptToken: AuthTag-Länge falsch (${authTag.length})`);
  }

  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
