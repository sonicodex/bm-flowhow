import { raw } from "hono/html";
import { jsxRenderer, useRequestContext } from "hono/jsx-renderer";
import type { AppEnv } from "./session.ts";

declare module "hono" {
  interface ContextRenderer {
    (content: string | Promise<string>, props: { title: string }): Response | Promise<Response>;
  }
}

// JSON inside <script>: "<" is escaped so no text in a step can close it.
export const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

// The screens the user's permissions open (phase 4.2). Hiding a link is a
// courtesy: the server refuses the route anyway (src/access.tsx).
function Nav() {
  const user = useRequestContext<AppEnv>().get("user");
  // A user who must change their password reaches nothing else yet.
  if (!user || user.mustChangePassword) return null;
  // The progress report: Board members and Leaders (SPEC §7; phase 6.9).
  const report = user.role === "board" || user.role === "leader";
  if (!(user.canEdit || user.canManageUsers || report)) return null;
  return (
    <nav class="site-nav" aria-label="Administración">
      {user.canEdit && <a href="/flows">Flujos</a>}
      {user.canEdit && <a href="/areas">Áreas</a>}
      {user.canEdit && <a href="/categories">Categorías</a>}
      {user.canManageUsers && <a href="/users">Usuarios</a>}
      {report && <a href="/report">Reporte</a>}
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

// The splash (SPEC §9; public/js/splash.js). Runs before the first paint:
// the first page of this tab opens the app (the logotype); a page reached
// from a link or a form of the app continues that move (the isotype, already
// up, so it does not fade in twice), counting its cap from the click. A move
// older than ten seconds is one that never happened (a cancelled leave).
// Without sessionStorage there is no splash.
const SPLASH_HEAD = `try {
  var d = document.documentElement, s = sessionStorage, at = Number(s.getItem("flowhow-splash")), ago = Date.now() - at;
  s.removeItem("flowhow-splash");
  if (!s.getItem("flowhow-open")) { s.setItem("flowhow-open", "1"); d.dataset.splash = "start"; }
  else if (at > 0 && ago >= 0 && ago < 10000) { d.dataset.splash = "section"; d.dataset.splashCarry = ""; d.style.setProperty("--splash-elapsed", ago + "ms"); }
} catch (e) {}`;

function Splash() {
  return (
    <div class="splash" aria-hidden="true">
      <img class="splash-logo" src="/flowhow_logotype.svg" alt="" />
      <img class="splash-isotype" src="/loading_isotype.svg" alt="" />
    </div>
  );
}

// The owner's favicons (public/app-icon/, and /favicon.ico where browsers
// look for it unasked), with the tags that came with them. The manifest
// keeps its own icons for installing the app. public/offline.html repeats
// these tags.
const APPLE_SIZES = [57, 114, 72, 144, 60, 120, 76, 152];
const FAVICON_SIZES: [string, string][] = [
  ["favicon-196x196.png", "196x196"],
  ["favicon-96x96.png", "96x96"],
  ["favicon-32x32.png", "32x32"],
  ["favicon-16x16.png", "16x16"],
  ["favicon-128.png", "128x128"],
];
function BrandIcons() {
  return (
    <>
      {APPLE_SIZES.map((n) => (
        <link rel="apple-touch-icon-precomposed" sizes={`${n}x${n}`} href={`/app-icon/apple-touch-icon-${n}x${n}.png`} />
      ))}
      {FAVICON_SIZES.map(([file, sizes]) => (
        <link rel="icon" type="image/png" href={`/app-icon/${file}`} sizes={sizes} />
      ))}
      <meta name="application-name" content={" "} />
      <meta name="msapplication-TileColor" content="#FFFFFF" />
      <meta name="msapplication-TileImage" content="/app-icon/mstile-144x144.png" />
      <meta name="msapplication-square70x70logo" content="/app-icon/mstile-70x70.png" />
      <meta name="msapplication-square150x150logo" content="/app-icon/mstile-150x150.png" />
      <meta name="msapplication-wide310x150logo" content="/app-icon/mstile-310x150.png" />
      <meta name="msapplication-square310x310logo" content="/app-icon/mstile-310x310.png" />
    </>
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
      <script>{raw(SPLASH_HEAD)}</script>
      <script type="module" src="/js/splash.js"></script>
      {/* PWA (SPEC §9, Architecture; phase 6.10): the manifest, and the service worker
          that keeps the app shell, never data. */}
      <link rel="manifest" href="/manifest.webmanifest" />
      <BrandIcons />
      <meta name="theme-color" content="#28519D" />
      <script type="module" src="/js/sw-register.js"></script>
    </head>
    <body>
      <Splash />
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
