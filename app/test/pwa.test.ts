import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import sw from "../public/sw.js?raw";
import manifest from "../public/manifest.webmanifest?raw";
import offline from "../public/offline.html?raw";
import { signIn, withSession } from "./session.ts";

// The files in public/ that make up the shell, read by Vite at test time.
const files = (glob: Record<string, unknown>) => Object.keys(glob).map((p) => p.replace(/^\.\.\/public/, ""));
const shellFiles = [
  ...files(import.meta.glob("../public/js/*.js")),
  ...files(import.meta.glob("../public/icons/*.svg")),
  ...files(import.meta.glob("../public/brand/*")),
  "/offline",
  "/theme.css",
  "/app.css",
  "/flowhow_logotype.svg",
  "/loading_isotype.svg",
  "/fonts/ibrand.woff",
].sort();

describe("splash (SPEC §9, Visual style)", () => {
  it("puts the veil on every page, with both marks, and decides it before the first paint", async () => {
    const board = await signIn();
    for (const res of [await withSession("")("/"), await board.fetch("/home")]) {
      const html = await res.text();
      expect(html).toContain('<div class="splash" aria-hidden="true"><img class="splash-logo" src="/flowhow_logotype.svg" alt=""/><img class="splash-isotype" src="/loading_isotype.svg" alt=""/></div>');
      expect(html).toContain('<script type="module" src="/js/splash.js"></script>');
      // The inline script sits in the head, after the styles.
      const head = html.slice(0, html.indexOf("</head>"));
      expect(head.indexOf('href="/app.css"')).toBeLessThan(head.indexOf('d.dataset.splash = section ? "section" : "start"'));
      // Every page loaded from the server holds the logotype (SPEC §9):
      // nothing remembers that a tab has seen it.
      expect(head).not.toContain("flowhow-open");
      expect(head).toContain('ms(section ? "--splash-section-hold" : "--splash-start-hold")');
    }
  });

  it("takes every duration, size and colour from the --splash-* tokens", () => {
    const css = env.CSS_FILES["app.css"];
    const rules = css.slice(css.indexOf("/* The splash"));
    expect(rules).not.toMatch(/\b[1-9]\d*m?s\b|#[0-9a-f]{3,8}\b|rgba?\(|\d+px/i);
    for (const token of ["surface", "enter", "leave", "start-hold", "section-hold", "scale-from", "scale-to", "ease", "logo-width", "isotype-width"]) {
      expect(rules).toContain(`var(--splash-${token})`);
    }
    expect(rules).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("PWA (phase 6.10)", () => {
  it("links the manifest and registers the service worker on every page", async () => {
    const board = await signIn();
    // The login, signed out, and a signed-in page.
    for (const res of [await withSession("")("/"), await board.fetch("/home")]) {
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"/>');
      expect(html).toContain('<script type="module" src="/js/sw-register.js"></script>');
    }
  });

  it("links the owner's favicons on every page and on «Sin conexión», and every one exists", async () => {
    const icons = files(import.meta.glob("../public/app-icon/*"));
    const refs = (html: string) => [...html.matchAll(/(?:href|content)="(\/app-icon\/[^"]+)"/g)].map((m) => m[1]!).sort();
    const page = await (await withSession("")("/")).text();
    const linked = refs(page);
    // 8 apple-touch-icon-precomposed, 5 PNG favicons, 5 Windows tiles.
    expect(linked).toHaveLength(18);
    for (const ref of linked) expect(icons).toContain(ref);
    expect(page).toContain('<link rel="apple-touch-icon-precomposed" sizes="152x152" href="/app-icon/apple-touch-icon-152x152.png"/>');
    expect(page).toContain('<link rel="icon" type="image/png" href="/app-icon/favicon-32x32.png" sizes="32x32"/>');
    expect(page).toContain('<meta name="msapplication-TileColor" content="#FFFFFF"/>');
    // The provisional favicon is gone from the pages.
    expect(page).not.toContain("icon.svg");
    expect(refs(offline)).toEqual(linked);
    expect(files(import.meta.glob("../public/favicon.ico"))).toEqual(["/favicon.ico"]);
  });

  it("names the app FlowHow, opens on the home screen, and has the icons to be installed", () => {
    const m = JSON.parse(manifest);
    expect(m).toMatchObject({ name: "FlowHow", short_name: "FlowHow", lang: "es-CO", start_url: "/home", display: "standalone" });
    // Install icons, still the provisional ones (DECISIONS 2026-11-19): the
    // owner's set has no 192, 512 or maskable icon. 192 and 512 px, and a
    // maskable one for Android.
    const icons = files(import.meta.glob("../public/app-icon/*"));
    for (const icon of m.icons as { src: string }[]) expect(icons).toContain(icon.src);
    expect(m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`)).toEqual(["any any", "192x192 any", "512x512 any", "512x512 maskable"]);
  });

  it("keeps exactly the shell: every module, icon, style and font, and no page", () => {
    const listed = [...sw.matchAll(/^\s+'(\/[^']+)',$/gm)].map((m) => m[1]!).sort();
    expect(listed).toEqual(shellFiles);
    // Pages are never cached: navigation goes to the network, and only the
    // "sin conexión" page answers without one.
    expect(sw).toContain("request.mode === 'navigate'");
    expect(sw).toContain("fetch(request).catch(() => caches.match('/offline'))");
  });
});
