import { describe, expect, it } from "vitest";
import { hashPassword, hashTemporary, passwordError, temporaryPassword, verifyPassword } from "../src/password.ts";

describe("passwords (phase 4.1)", () => {
  it("hashes with PBKDF2-SHA256 at 10,000 iterations and a fresh salt each time", async () => {
    const a = await hashPassword("una clave larga");
    const b = await hashPassword("una clave larga");
    expect(a).toMatch(/^pbkdf2-sha256\$10000\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain("una clave larga");
  });

  it("verifies the right password only", async () => {
    const stored = await hashPassword("Contraseña ñandú");
    expect(await verifyPassword("Contraseña ñandú", stored)).toBe(true);
    expect(await verifyPassword("contraseña ñandú", stored)).toBe(false);
    expect(await verifyPassword("Contraseña nandu", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  // DECISIONS 2026-11-20: the count went down from 100,000 for the Workers
  // Free CPU limit. Hashes made before keep working with their own count.
  it("still verifies a hash made at 100,000 iterations", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("una clave larga"), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 }, key, 256);
    const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
    const stored = `pbkdf2-sha256$100000$${b64(salt)}$${b64(new Uint8Array(bits))}`;
    expect(await verifyPassword("una clave larga", stored)).toBe(true);
    expect(await verifyPassword("otra clave larga", stored)).toBe(false);
  });

  // DECISIONS 2026-11-20 (phase 7.2): a random temporary password needs no
  // stretching, and the importer hashes fifty of them in one request.
  it("hashes a temporary password at 100 iterations, and verifies it like any other", async () => {
    const password = temporaryPassword();
    const stored = await hashTemporary(password);
    expect(stored).toMatch(/^pbkdf2-sha256\$100\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$/);
    expect(await verifyPassword(password, stored)).toBe(true);
    expect(await verifyPassword(password.toUpperCase(), stored)).toBe(false);
  });

  it("matches nothing against a value that is not one of its hashes", async () => {
    const stored = await hashPassword("una clave larga");
    const [, , salt, hash] = stored.split("$");
    for (const bad of ["", "x", "una clave larga", `pbkdf2-sha256$0$${salt}$${hash}`, `pbkdf2-sha256$100001$${salt}$${hash}`, `sha1$100000$${salt}$${hash}`, `pbkdf2-sha256$100000$${salt}$`]) {
      expect(await verifyPassword("una clave larga", bad), bad).toBe(false);
    }
  });

  it("asks for at least eight characters", () => {
    expect(passwordError("1234567")).toBe("La contraseña necesita al menos 8 caracteres.");
    expect(passwordError("ñandúñañ")).toBeNull();
  });
});
