import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { assertGuarded, signInFirst } from "./access.tsx";
import { areas } from "./areas.tsx";
import { categories } from "./categories.tsx";
import { flowsScreen } from "./flows-screen.tsx";
import { home } from "./home.tsx";
import { renderer } from "./layout.tsx";
import { login } from "./login.tsx";
import { loadSession, type AppEnv } from "./session.ts";
import { usersScreen } from "./users-screen.tsx";
import { viewer } from "./viewer.tsx";

const app = new Hono<AppEnv>();

// A form posted from another site is refused (the session cookie is also
// SameSite=Lax). The tour's JSON requests are not forms: a browser cannot
// send them across sites without CORS, which the app never grants.
app.use(csrf());
app.use(loadSession);
app.use(renderer);

// Each route declares who may reach it (src/access.tsx); the order here
// does not decide it.
app.route("/", login.app);
app.route("/", home.app);
app.route("/areas", areas.app);
app.route("/categories", categories.app);
app.route("/users", usersScreen.app);
app.route("/flows", viewer.app);
app.route("/flows", flowsScreen.app);

// Without a session, an unknown path goes to the login too: only the
// public routes answer anything else.
app.notFound((c) => (c.get("user") ? c.text("404 Not Found", 404) : signInFirst(c)));

// A route without a declared access stops the Worker from starting.
assertGuarded(app);

export default app;
