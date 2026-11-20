// Password hashing with Web Crypto (SPEC §9: no authentication library).
// PBKDF2-SHA256, stored as "pbkdf2-sha256$<iterations>$<salt>$<hash>" in
// base64. The iteration count travels with the hash, so it can change later
// without breaking stored passwords. Runs unchanged in Node, for
// tools/user-create.ts.

// New hashes use ITERATIONS, held down by the Workers Free CPU limit
// (DECISIONS 2026-11-20, DEPLOY §5). A stored hash keeps working with the
// count it was made with, up to 100,000, the most Workers accepts.
const ITERATIONS = 10_000;
const MAX_ITERATIONS = 100_000;
const SCHEME = "pbkdf2-sha256";

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

async function hashWith(password: string, iterations: number): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${SCHEME}$${iterations}$${b64(salt)}$${b64(await derive(password, salt, iterations))}`;
}

// A password someone chose.
export const hashPassword = (password: string) => hashWith(password, ITERATIONS);

// A temporary password (temporaryPassword below) is eighteen characters
// drawn at random from 31, about 89 bits, and lives until its first use.
// Stretching makes up for passwords people choose; with almost none, its
// length is what protects it if the database leaks, so it is kept at 80
// bits or more (owner's decision): guessing it from a stolen hash takes
// around 2^96 SHA-256 operations. Being cheap is what
// lets the user importer hash fifty of them in one request under the
// Workers Free CPU limit (DECISIONS 2026-11-20, phase 7.2).
export const TEMPORARY_ITERATIONS = 100;
export const hashTemporary = (password: string) => hashWith(password, TEMPORARY_ITERATIONS);

// Compares every byte whatever the first difference, so the time taken does
// not tell how much of the hash matched.
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ (b[i] ?? 0);
  return diff === 0;
}

// Any stored value that is not a hash of ours, the empty one included,
// matches no password, so a row written without a real hash (as the old
// placeholder user was) never opens a session.
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  const iterations = Number(iter);
  if (scheme !== SCHEME || !salt || !hash || !Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
    // Same work as a real check, so a missing account answers as slowly as
    // a wrong password.
    await derive(password, new Uint8Array(16), ITERATIONS);
    return false;
  }
  const same = sameBytes(await derive(password, unb64(salt), iterations), unb64(hash));
  // A cheaper hash (a temporary password) is topped up to the full count,
  // so the time taken does not tell which accounts wait for a first login.
  if (iterations < ITERATIONS) await derive(password, new Uint8Array(16), ITERATIONS - iterations);
  return same;
}

// A one-time password the Board hands over in person (phase 4.4):
// eighteen characters in three groups of six, from an alphabet without
// look-alikes (no 0/o, 1/l/i), so it can be read aloud or copied by hand.
// 31 symbols give about 4.95 bits each: sixteen would be 79.3 bits, short
// of the 80 the owner asked for (phase 7.2); eighteen are about 89.
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const TEMP_LENGTH = 18;
export function temporaryPassword(): string {
  const chars: string[] = [];
  // Rejection sampling: only bytes below the largest multiple of the
  // alphabet's length, so every character is equally likely.
  const limit = 256 - (256 % TEMP_ALPHABET.length);
  while (chars.length < TEMP_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
      if (byte < limit && chars.length < TEMP_LENGTH) chars.push(TEMP_ALPHABET[byte % TEMP_ALPHABET.length]!);
    }
  }
  return [0, 6, 12].map((i) => chars.slice(i, i + 6).join("")).join("-");
}

// SPEC sets no rule. Eight characters is the shortest that still asks for
// something more than a word.
export const MIN_PASSWORD = 8;
export function passwordError(password: string): string | null {
  return [...password].length < MIN_PASSWORD ? `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` : null;
}
