import { describe, expect, it } from "vitest";
import { hashPassword, passwordError, verifyPassword } from "../src/password.ts";

describe("passwords (phase 4.1)", () => {
  it("hashes with PBKDF2-SHA256 at 100,000 iterations and a fresh salt each time", async () => {
    const a = await hashPassword("una clave larga");
    const b = await hashPassword("una clave larga");
    expect(a).toMatch(/^pbkdf2-sha256\$100000\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=$/);
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
