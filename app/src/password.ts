// Password hashing with Web Crypto (SPEC §9: no authentication library).
// PBKDF2-SHA256, stored as "pbkdf2-sha256$<iterations>$<salt>$<hash>" in
// base64. The iteration count travels with the hash, so it can change later
// without breaking stored passwords. 100,000 is the most Workers accepts.
// Runs unchanged in Node, for tools/user-create.ts.

const ITERATIONS = 100_000;
const SCHEME = "pbkdf2-sha256";

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${SCHEME}$${ITERATIONS}$${b64(salt)}$${b64(await derive(password, salt, ITERATIONS))}`;
}

// Compares every byte whatever the first difference, so the time taken does
// not tell how much of the hash matched.
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ (b[i] ?? 0);
  return diff === 0;
}

// Any stored value that is not a hash of ours, the empty one included,
// matches no password. Accounts without a password (a later Microsoft SSO)
// rely on that.
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  const iterations = Number(iter);
  if (scheme !== SCHEME || !salt || !hash || !Number.isInteger(iterations) || iterations < 1 || iterations > ITERATIONS) {
    // Same work as a real check, so a missing account answers as slowly as
    // a wrong password.
    await derive(password, new Uint8Array(16), ITERATIONS);
    return false;
  }
  return sameBytes(await derive(password, unb64(salt), iterations), unb64(hash));
}

// A one-time password the Board hands over in person (phase 4.4): twelve
// characters in groups of four, from an alphabet without look-alikes (no
// 0/o, 1/l/i), so it can be read aloud or copied by hand.
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function temporaryPassword(): string {
  const chars: string[] = [];
  // Rejection sampling: only bytes below the largest multiple of the
  // alphabet's length, so every character is equally likely.
  const limit = 256 - (256 % TEMP_ALPHABET.length);
  while (chars.length < 12) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < limit && chars.length < 12) chars.push(TEMP_ALPHABET[byte % TEMP_ALPHABET.length]!);
    }
  }
  return [0, 4, 8].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

// SPEC sets no rule. Eight characters is the shortest that still asks for
// something more than a word.
export const MIN_PASSWORD = 8;
export function passwordError(password: string): string | null {
  return [...password].length < MIN_PASSWORD ? `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` : null;
}
