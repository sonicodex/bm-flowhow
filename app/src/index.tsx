import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { areas } from "./areas.tsx";
import { flowsScreen } from "./flows-screen.tsx";
import { renderer } from "./layout.tsx";
import { HOME, login } from "./login.tsx";
import { loadSession, requireUser, userOf, type AppEnv } from "./session.ts";
import { viewer } from "./viewer.tsx";

const app = new Hono<AppEnv>();

// A form posted from another site is refused (the session cookie is also
// SameSite=Lax). The tour's JSON requests are not forms: a browser cannot
// send them across sites without CORS, which the app never grants.
app.use(csrf());
app.use(loadSession);
app.use(renderer);

// The only routes without a session: the login, and leaving.
app.route("/", login);

app.use(requireUser);

// Provisional until phase 4.3 builds the home screen.
app.get(HOME, (c) =>
  c.render(
    <>
      <h1 class="page-title">Hola, {userOf(c).fullName}</h1>
      <p>
        <a href="/flows">Flujos</a>
      </p>
    </>,
    { title: "Inicio" },
  ),
);

app.route("/areas", areas);
app.route("/flows", viewer);
app.route("/flows", flowsScreen);

export default app;
