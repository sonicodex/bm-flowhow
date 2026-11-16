import { nameKey } from "./names.ts";
import { verifyPassword } from "./password.ts";
import { Router } from "./access.tsx";
import { createSession, endSession } from "./session.ts";

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
