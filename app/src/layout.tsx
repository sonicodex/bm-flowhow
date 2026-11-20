import { raw } from "hono/html";
import { jsxRenderer, useRequestContext } from "hono/jsx-renderer";
import type { AppEnv, SessionUser } from "./session.ts";

declare module "hono" {
  interface ContextRenderer {
    (content: string | Promise<string>, props: { title: string }): Response | Promise<Response>;
  }
}

// JSON inside <script>: "<" is escaped so no text in a step can close it.
export const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

// The navigation band (SPEC §9, Navigation): the screens the user's
// permissions open, right-aligned under the white bar. Hiding a link is a
// courtesy: the server refuses the route anyway (src/access.tsx).
// «Flujos» is the flows an editor manages; for anyone else, the flows they
// review (Inicio). Categories are a link on the flows screen, and the
// first-use wizard (/setup) is linked from nowhere.
type NavLink = { href: string; label: string; section: string[] };

export function navLinks(user: SessionUser): NavLink[] {
  const report = user.role === "board" || user.role === "leader";
  return [
    user.canEdit
      ? { href: "/flows", label: "Flujos", section: ["/flows", "/categories", "/home"] }
      : { href: "/home", label: "Flujos", section: ["/home", "/flows"] },
    ...(user.canEdit ? [{ href: "/areas", label: "Áreas", section: ["/areas"] }] : []),
    ...(user.canManageUsers ? [{ href: "/users", label: "Usuarios", section: ["/users"] }] : []),
    ...(report ? [{ href: "/report", label: "Reportes", section: ["/report"] }] : []),
  ];
}

const inSection = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + "/");

function Nav() {
  const c = useRequestContext<AppEnv>();
  const user = c.get("user");
  // A user who must change their password reaches nothing else yet.
  if (!user || user.mustChangePassword) return null;
  const path = c.req.path;
  return (
    <div class="site-band">
      <nav class="site-nav" aria-label="Secciones">
        {navLinks(user).map((l) => (
          <a href={l.href} aria-current={l.section.some((p) => inSection(path, p)) ? "page" : undefined}>
            {l.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

// The signed-in user's name and "Salir". Leaving is a POST, so a link on
// another site cannot sign anyone out.
function Account() {
  const user = useRequestContext<AppEnv>().get("user");
  if (!user) return null;
  return (
    <form method="post" action="/logout" class="site-account">
      <span title={user.fullName}>{user.fullName}</span>
      <button type="submit" class="button-link">
        Salir
      </button>
    </form>
  );
}

// The splash (SPEC §9; public/js/splash.js). Runs before the first paint,
// inline, so nothing it waits on can fail to arrive. Both marks are waits:
// the veil fades out once its hold has passed and the page has loaded,
// whichever comes last.
// - A page reached from a link or a form of the app continues that move:
//   the isotype, already up so it does not fade in twice, held
//   --splash-section-hold counted from the click. A move older than ten
//   seconds is one that never happened.
// - Any other load is a page loaded from the server (opening the app, a
//   reload, a typed address, a link from elsewhere): the logotype, held
//   --splash-start-hold from now.
// A move started on this page (data-splash-move, splash.js) ends this
// page's own veil: the timers below leave it alone.
const SPLASH_HEAD = `(function () {
  var d = document.documentElement, at = 0, ago = 0;
  try {
    at = Number(sessionStorage.getItem("flowhow-splash"));
    ago = Date.now() - at;
    sessionStorage.removeItem("flowhow-splash");
  } catch (e) {}
  var section = at > 0 && ago >= 0 && ago < 10000;
  d.dataset.splash = section ? "section" : "start";
  if (section) {
    d.dataset.splashCarry = "";
    d.style.setProperty("--splash-elapsed", ago + "ms");
  }
  var t0 = performance.now() - (section ? ago : 0);
  var ms = function (name) { return parseFloat(getComputedStyle(d).getPropertyValue(name)) || 0; };
  var ours = function () { return d.dataset.splash !== undefined && d.dataset.splashMove === undefined; };
  addEventListener("load", function () {
    setTimeout(function () {
      if (!ours()) return;
      d.dataset.splashLeaving = "";
      setTimeout(function () {
        if (!ours()) return;
        delete d.dataset.splash;
        delete d.dataset.splashCarry;
        delete d.dataset.splashLeaving;
        d.style.removeProperty("--splash-elapsed");
      }, ms("--splash-leave"));
    }, Math.max(0, ms(section ? "--splash-section-hold" : "--splash-start-hold") - (performance.now() - t0)));
  });
})();`;

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
        <div class="site-bar">
          <a href="/" class="site-logo">
            <img src="/flowhow_logotype.svg" alt="FlowHow" />
          </a>
          <Account />
        </div>
        <Nav />
      </header>
      <main class="site-main">{children}</main>
    </body>
  </html>
));
