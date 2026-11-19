import { describe, expect, it } from "vitest";
import sw from "../public/sw.js?raw";
import manifest from "../public/manifest.webmanifest?raw";
import { signIn, withSession } from "./session.ts";

// The files in public/ that make up the shell, read by Vite at test time.
const files = (glob: Record<string, unknown>) => Object.keys(glob).map((p) => p.replace(/^\.\.\/public/, ""));
const shellFiles = [
  ...files(import.meta.glob("../public/js/*.js")),
  ...files(import.meta.glob("../public/icons/*.svg")),
  "/offline",
  "/theme.css",
  "/app.css",
  "/flowhow_logotype.svg",
  "/fonts/ibrand.woff",
].sort();

describe("PWA (phase 6.10)", () => {
  it("links the manifest and registers the service worker on every page", async () => {
    const board = await signIn();
    // The login, signed out, and a signed-in page.
    for (const res of [await withSession("")("/"), await board.fetch("/home")]) {
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"/>');
      expect(html).toContain('<script type="module" src="/js/sw-register.js"></script>');
      expect(html).toContain('<link rel="apple-touch-icon" href="/app-icon/apple-touch-icon.png"/>');
    }
  });

  it("names the app FlowHow, opens on the home screen, and has the icons to be installed", () => {
    const m = JSON.parse(manifest);
    expect(m).toMatchObject({ name: "FlowHow", short_name: "FlowHow", lang: "es-CO", start_url: "/home", display: "standalone" });
    // Provisional icons: 192 and 512 px, and a maskable one for Android.
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
