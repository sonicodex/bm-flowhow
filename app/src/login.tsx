import { nameKey } from "./names.ts";
import { hashPassword, passwordError, verifyPassword } from "./password.ts";
import { PASSWORD_SCREEN, Router } from "./access.tsx";
import { createSession, endSession, userOf } from "./session.ts";
import { changeOwnPassword } from "./users.ts";

// The root URL is the login (SPEC §7: no landing page, no open sign-up).
export const login = new Router();

export const HOME = "/home";
export const LOGIN_FAILED = "Usuario o contraseña incorrectos.";
// A failed attempt waits this long before answering: it slows a guessing
// script down without ever locking a real user out. Cloudflare's rate
// limiting rule on POST /login does the rest once deployed (DEPLOY.md).
export const FAILED_DELAY_MS = 1000;

function LoginPage({ username, error }: { username?: string; error?: boolean }) {
  return (
    <section class="card login-card">
      <h1 class="page-title">Entrar</h1>
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
          Entrar
        </button>
      </form>
      <p class="muted">Si no tienes usuario o olvidaste la contraseña, pídeselo a la Junta directiva.</p>
    </section>
  );
}

login.get("/", "public", (c) => (c.get("user") ? c.redirect(HOME, 302) : c.render(<LoginPage />, { title: "Entrar" })));

login.post("/login", "public", async (c) => {
  const form = await c.req.parseBody();
  const typed = String(form.username ?? "");
  const password = String(form.password ?? "");
  // Usernames are stored as their name key: case and accents do not count.
  const user = await c.env.DB.prepare("SELECT id, password_hash FROM users WHERE username = ? AND is_active = 1")
    .bind(nameKey(typed))
    .first<{ id: number; password_hash: string }>();
  // A missing or inactive user is checked against nothing, at the same
  // cost: the answer and its timing are the same as for a wrong password.
  const ok = await verifyPassword(password, user?.password_hash ?? "");
  if (!user || !ok) {
    await new Promise((resolve) => setTimeout(resolve, FAILED_DELAY_MS));
    c.status(401);
    return c.render(<LoginPage username={typed.trim()} error />, { title: "Entrar" });
  }
  await createSession(c, user.id);
  return c.redirect(HOME, 303);
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
  if (!userOf(c).mustChangePassword) return c.redirect(HOME, 302);
  return c.render(<ChangePasswordPage />, { title: "Cambia tu contraseña" });
});

login.post(PASSWORD_SCREEN, "account", async (c) => {
  const user = userOf(c);
  if (!user.mustChangePassword) return c.redirect(HOME, 303);
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
  return c.redirect(HOME, 303);
});
