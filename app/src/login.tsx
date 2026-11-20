import { nameKey } from "./names.ts";
import { hashPassword, passwordError, verifyPassword } from "./password.ts";
import { PASSWORD_SCREEN, Router } from "./access.tsx";
import { createSession, endSession, userOf } from "./session.ts";
import { changeOwnPassword } from "./users.ts";

// The root URL is the login (SPEC §7: no landing page, no open sign-up).
export const login = new Router();

export const HOME = "/home";
// Where a signed-in user lands (SPEC §4): the Board on the progress report,
// everyone else on the home screen.
export const landing = (role: string) => (role === "board" ? "/report" : HOME);
export const LOGIN_FAILED = "Usuario o contraseña incorrectos.";
// A failed attempt waits this long before answering: it slows a guessing
// script down without ever locking a real user out. Cloudflare's rate
// limiting rule on POST /login does the rest once deployed (DEPLOY.md).
export const FAILED_DELAY_MS = 1000;

// SPEC §9, Login screen (phase 8.2): one white card over the company's
// image (the layout drops the header for `page: "login"`).
// - The image is webp, with the jpg for a browser without it.
// - It never blocks the card: the card has its own background, and the
//   image is lazy, which keeps it out of the page's `load`. A background
//   image would hold `load`, and the logotype splash waits for `load`, so a
//   slow image would keep the card covered.
function LoginPage({ username, error }: { username?: string; error?: boolean }) {
  return (
    <>
      <picture class="login-hero">
        <source srcset="/brand/login_hero.webp" type="image/webp" />
        <img src="/brand/login_hero.jpg" alt="" loading="lazy" decoding="async" />
      </picture>
      <section class="card login-card">
        <img class="login-logo" src="/flowhow_logotype.svg" alt="FlowHow" />
        <h1 class="page-title">Iniciar sesión</h1>
        <form method="post" action="/login" class="stacked-form">
          <label for="username">Usuario</label>
          <input
            id="username"
            name="username"
            value={username ?? ""}
            required
            maxlength={100}
            autocomplete="username"
            autocapitalize="none"
            spellcheck={false}
            autofocus={!username}
          />
          <label for="password">Contraseña</label>
          <input id="password" name="password" type="password" required autocomplete="current-password" autofocus={!!username} />
          {error && (
            <p class="form-error" role="alert">
              {LOGIN_FAILED}
            </p>
          )}
          <button type="submit" class="button-primary">
            Acceder
          </button>
        </form>
        <p class="muted login-help">Si olvidaste tu contraseña, el administrador la restablece.</p>
        {/* The maker's mark, on the login only (SPEC §9). */}
        <img class="login-maker" src="/brand/bmec_logotype.svg" alt="Blue Monkey" />
      </section>
    </>
  );
}

login.get("/", "public", (c) => {
  const user = c.get("user");
  return user ? c.redirect(landing(user.role), 302) : c.render(<LoginPage />, { title: "Iniciar sesión", page: "login" });
});

login.post("/login", "public", async (c) => {
  const form = await c.req.parseBody();
  const typed = String(form.username ?? "");
  const password = String(form.password ?? "");
  // Usernames are stored as their name key: case and accents do not count.
  const user = await c.env.DB.prepare("SELECT id, role, password_hash FROM users WHERE username = ? AND is_active = 1")
    .bind(nameKey(typed))
    .first<{ id: number; role: string; password_hash: string }>();
  // A missing or inactive user is checked against nothing, at the same
  // cost: the answer and its timing are the same as for a wrong password.
  const ok = await verifyPassword(password, user?.password_hash ?? "");
  if (!user || !ok) {
    await new Promise((resolve) => setTimeout(resolve, FAILED_DELAY_MS));
    c.status(401);
    return c.render(<LoginPage username={typed.trim()} error />, { title: "Iniciar sesión", page: "login" });
  }
  await createSession(c, user.id);
  return c.redirect(landing(user.role), 303);
});

login.post("/logout", "public", async (c) => {
  await endSession(c);
  return c.redirect("/", 303);
});

// «Cambia tu contraseña» (phase 4.4): after a reset by the Board, the user
// signs in with the temporary password and lands here; every other screen
// sends them back here until they choose their own (src/access.tsx).
function ChangePasswordPage({ error }: { error?: string }) {
  return (
    <section class="card login-card">
      <h1 class="page-title">Cambia tu contraseña</h1>
      <p>Entraste con una contraseña temporal. Elige la tuya para seguir; nadie más la conocerá.</p>
      <form method="post" action={PASSWORD_SCREEN} class="stacked-form">
        <label for="password">Contraseña nueva</label>
        <input id="password" name="password" type="password" required autocomplete="new-password" autofocus />
        <label for="repeat">Repítela</label>
        <input id="repeat" name="repeat" type="password" required autocomplete="new-password" />
        {error && (
          <p class="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" class="button-primary">
          Guardar contraseña
        </button>
      </form>
    </section>
  );
}

login.get(PASSWORD_SCREEN, "account", (c) => {
  if (!userOf(c).mustChangePassword) return c.redirect(landing(userOf(c).role), 302);
  return c.render(<ChangePasswordPage />, { title: "Cambia tu contraseña" });
});

login.post(PASSWORD_SCREEN, "account", async (c) => {
  const user = userOf(c);
  if (!user.mustChangePassword) return c.redirect(landing(user.role), 303);
  const form = await c.req.parseBody();
  const password = String(form.password ?? "");
  const stored = await c.env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(user.id).first<string>("password_hash");
  const error =
    passwordError(password) ??
    (String(form.repeat ?? "") !== password ? "Las dos contraseñas no coinciden." : null) ??
    ((await verifyPassword(password, stored ?? "")) ? "Elige una contraseña distinta de la temporal." : null);
  if (error) {
    c.status(422);
    return c.render(<ChangePasswordPage error={error} />, { title: "Cambia tu contraseña" });
  }
  await changeOwnPassword(c.env.DB, user.id, await hashPassword(password));
  return c.redirect(landing(user.role), 303);
});
