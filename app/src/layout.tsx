import { jsxRenderer, useRequestContext } from "hono/jsx-renderer";
import type { AppEnv } from "./session.ts";

declare module "hono" {
  interface ContextRenderer {
    (content: string | Promise<string>, props: { title: string }): Response | Promise<Response>;
  }
}

// The screens the user's permissions open (phase 4.2). Hiding a link is a
// courtesy: the server refuses the route anyway (src/access.tsx).
function Nav() {
  const user = useRequestContext<AppEnv>().get("user");
  // A user who must change their password reaches nothing else yet.
  if (!user || user.mustChangePassword || !(user.canEdit || user.canManageUsers)) return null;
  return (
    <nav class="site-nav" aria-label="Administración">
      {user.canEdit && <a href="/flows">Flujos</a>}
      {user.canEdit && <a href="/areas">Áreas</a>}
      {user.canEdit && <a href="/categories">Categorías</a>}
      {user.canManageUsers && <a href="/users">Usuarios</a>}
    </nav>
  );
}

// The signed-in user's name and "Salir". Leaving is a POST, so a link on
// another site cannot sign anyone out.
function Account() {
  const user = useRequestContext<AppEnv>().get("user");
  if (!user) return null;
  return (
    <form method="post" action="/logout" class="site-account">
      <span>{user.fullName}</span>
      <button type="submit" class="button-link">
        Salir
      </button>
    </form>
  );
}

// Base page. theme.css brings Google Sans (Google Fonts) and iBrand (fonts/).
export const renderer = jsxRenderer(({ children, title }) => (
  <html lang="es-CO">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{`${title} · FlowHow`}</title>
      <link rel="stylesheet" href="/theme.css" />
      <link rel="stylesheet" href="/app.css" />
    </head>
    <body>
      <header class="site-header">
        <a href="/" class="site-logo">
          <img src="/flowhow_logotype.svg" alt="FlowHow" />
        </a>
        <Nav />
        <Account />
      </header>
      <main class="site-main">{children}</main>
    </body>
  </html>
));
