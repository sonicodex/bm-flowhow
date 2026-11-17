import { env } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { FAILED_DELAY_MS, LOGIN_FAILED } from "../src/login.tsx";
import { hashPassword } from "../src/password.ts";
import { COOKIE, sessionId } from "../src/session.ts";
import { createUser } from "../src/users.ts";
import { ORIGIN, signIn, withSession } from "./session.ts";

const anonymous = withSession("");
const PASSWORD = "clave de prueba";

async function makeUser(username = "ana", password = PASSWORD) {
  const r = await createUser(env.DB, { username, fullName: "Ana Gómez", role: "leader", areaIds: [], passwordHash: await hashPassword(password) });
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

const login = (username: string, password: string, origin = ORIGIN) =>
  exports.default.fetch(`${ORIGIN}/login`, {
    method: "POST",
    headers: { origin },
    body: new URLSearchParams({ username, password }),
    redirect: "manual",
  });

const tokenOf = (res: Response) => res.headers.get("set-cookie")?.match(new RegExp(`${COOKIE}=([^;]*)`))?.[1];
const sessions = async () => (await env.DB.prepare("SELECT id, user_id, expires_at FROM sessions").all<{ id: string; user_id: number; expires_at: string }>()).results;

describe("login screen (phase 4.1)", () => {
  it("is the root URL without a session, on the base page", async () => {
    const res = await anonymous("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="es-CO">');
    expect(html).toContain('href="/theme.css"');
    expect(html).toContain('src="/flowhow_logotype.svg"');
    expect(html).toContain('<h1 class="page-title">Entrar</h1>');
    expect(html).toContain('<form method="post" action="/login"');
    expect(html).toContain('autocomplete="current-password"');
    // No sign-up, and no account in the header.
    expect(html).not.toMatch(/regístrate|crear cuenta/i);
    expect(html).not.toContain("Salir");
  });

  it("sends a signed-in user from the root URL to the home screen", async () => {
    const me = await signIn();
    const res = await me.fetch("/");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/home");
  });

  it("signs in, ignoring case and accents in the username, with a safe cookie", async () => {
    const id = await makeUser("andrés");
    const res = await login("  ANDRES ", PASSWORD);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/home");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=604800");
    const token = tokenOf(res)!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // The table keeps the token's hash, never the token.
    const [row] = await sessions();
    expect(row).toMatchObject({ id: await sessionId(token), user_id: id });
    expect(row!.id).not.toContain(token);
    const days = (Date.parse(row!.expires_at) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThanOrEqual(7);
    // The cookie opens the home screen, with the name and "Salir".
    const home = await withSession(`${COOKIE}=${token}`)("/home");
    expect(home.status).toBe(200);
    const html = await home.text();
    expect(html).toContain("Hola, Ana Gómez");
    expect(html).toContain('<form method="post" action="/logout" class="site-account"><span>Ana Gómez</span>');
  });

  it("answers a wrong password, an unknown user and an inactive one alike, after a delay", async () => {
    await makeUser("ana");
    await makeUser("berta");
    await env.DB.prepare("UPDATE users SET is_active = 0 WHERE username = 'berta'").run();
    const bodies: string[] = [];
    for (const [username, password] of [["ana", "otra clave"], ["nadie", PASSWORD], ["berta", PASSWORD]] as const) {
      const started = Date.now();
      const res = await login(username, password);
      expect(Date.now() - started).toBeGreaterThanOrEqual(FAILED_DELAY_MS - 50);
      expect(res.status).toBe(401);
      expect(res.headers.get("set-cookie")).toBeNull();
      const html = await res.text();
      expect(html).toContain(`<p class="form-error" role="alert">${LOGIN_FAILED}</p>`);
      // What was typed stays, so only the password is typed again.
      expect(html).toContain(`value="${username}"`);
      bodies.push(html.replace(`value="${username}"`, ""));
    }
    expect(new Set(bodies).size).toBe(1);
    expect(await sessions()).toEqual([]);
  });

  it("never lets in an account without a password, as the placeholder user had", async () => {
    await createUser(env.DB, { username: "sso", fullName: "Sin contraseña", role: "leader", areaIds: [], passwordHash: "" });
    expect((await login("sso", "")).status).toBe(401);
    expect(await sessions()).toEqual([]);
  });
});

describe("routes behind the session (phase 4.1)", () => {
  it("sends pages to the login, and answers the tour's JSON with 401", async () => {
    for (const path of ["/home", "/flows", "/flows/1", "/flows/1/edit", "/areas", "/no-existe"]) {
      const res = await anonymous(path);
      expect(res.status, path).toBe(302);
      expect(res.headers.get("location"), path).toBe("/");
    }
    const form = await anonymous("/areas", { method: "POST", body: new URLSearchParams({ name: "Bodega" }) });
    expect(form.status).toBe(303);
    expect(form.headers.get("location")).toBe("/");
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM areas").first("n")).toBe(0);
    for (const path of ["/flows/1/tour", "/flows/1/tour/restart", "/flows/1/tour/step", "/flows/1/tour/finish"]) {
      const res = await anonymous(path, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      expect(res.status, path).toBe(401);
      expect(await res.json()).toEqual({ error: "Tu sesión terminó. Vuelve a entrar y sigue donde ibas." });
    }
  });

  it("signs out: the session is deleted and the cookie stops working", async () => {
    const me = await signIn();
    const res = await me.fetch("/logout", { method: "POST" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
    expect(res.headers.get("set-cookie")).toMatch(new RegExp(`^${COOKIE}=; Max-Age=0`));
    expect(await sessions()).toEqual([]);
    expect((await me.fetch("/home")).status).toBe(302);
  });

  it("drops an expired session, and those of a deactivated user", async () => {
    const me = await signIn();
    await env.DB.prepare("UPDATE sessions SET expires_at = ?").bind(new Date(Date.now() - 1000).toISOString()).run();
    const res = await me.fetch("/home");
    expect(res.status).toBe(302);
    expect(res.headers.get("set-cookie")).toMatch(new RegExp(`^${COOKIE}=; Max-Age=0`));
    expect(await sessions()).toEqual([]);

    const other = await signIn({ username: "otra", role: "leader" });
    expect((await other.fetch("/home")).status).toBe(200);
    await env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = ?").bind(other.id).run();
    expect((await other.fetch("/home")).status).toBe(302);
  });

  it("keeps a session alive with use, moving its expiry at most once a day", async () => {
    const me = await signIn();
    // Fresh: used again right away, nothing is written.
    const fresh = await me.fetch("/home");
    expect(fresh.headers.get("set-cookie")).toBeNull();
    const [before] = await sessions();
    // Last moved two days ago: it moves to seven days from now.
    const twoDaysOld = new Date(Date.now() + 5 * 86_400_000).toISOString();
    await env.DB.prepare("UPDATE sessions SET expires_at = ?").bind(twoDaysOld).run();
    const used = await me.fetch("/home");
    expect(used.status).toBe(200);
    expect(used.headers.get("set-cookie")).toContain("Max-Age=604800");
    const [after] = await sessions();
    expect(after!.id).toBe(before!.id);
    expect(Date.parse(after!.expires_at)).toBeGreaterThan(Date.parse(twoDaysOld) + 1.9 * 86_400_000);
  });

  it("refuses a form posted from another site, signed in or not", async () => {
    await makeUser("ana");
    const res = await login("ana", PASSWORD, "https://otro-sitio.example");
    expect(res.status).toBe(403);
    expect(await sessions()).toEqual([]);
    const me = await signIn();
    const areas = await me.fetch("/areas", {
      method: "POST",
      headers: { origin: "https://otro-sitio.example" },
      body: new URLSearchParams({ name: "Bodega" }),
    });
    expect(areas.status).toBe(403);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM areas").first("n")).toBe(0);
  });
});
