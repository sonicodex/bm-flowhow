import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Grid } from "../public/js/core.js";
import instalaciones from "../../reference/Flujo_Instalaciones.grid.json";
import apertura from "../../reference/Flujo_Apertura_OT.grid.json";
import { loadDevFlows } from "../src/devload.ts";
import { createFlow } from "../src/flows.ts";
import { NO_FLOWS, NO_FLOWS_IN_AREAS } from "../src/home.tsx";
import { startTour, takeStep } from "../src/tour.ts";
import { signIn } from "./session.ts";

const load = () =>
  loadDevFlows(env.DB, [
    { name: "Instalaciones", grid: instalaciones as Grid },
    { name: "Apertura de OT", grid: apertura as Grid },
  ]);
const idOf = async (name: string) => (await env.DB.prepare("SELECT id FROM flows WHERE name = ?").bind(name).first<number>("id"))!;
const devArea = async () => (await env.DB.prepare("SELECT id FROM areas WHERE name = 'Desarrollo'").first<number>("id"))!;
const home = async (who: { fetch: (p: string) => Promise<Response> }) => {
  const res = await who.fetch("/home");
  expect(res.status).toBe(200);
  return res.text();
};
const cards = (html: string) => [...html.matchAll(/<li class="card home-flow flow-\d+">(.*?)<\/li>/gs)].map((m) => m[1]!);
const names = (html: string) => cards(html).map((c) => c.match(/<\/span>([^<]*)<\/h2>/)![1]);

describe("home screen (phase 4.3)", () => {
  it("lists the flows the user sees, by name, each with status, icon and next action", async () => {
    await load();
    const leader = await signIn({ username: "lia", role: "leader" });
    const html = await home(leader);
    expect(html).toContain('<h1 class="page-title">Hola, Nombre de lia</h1>');
    expect(names(html)).toEqual(["Apertura de OT", "Instalaciones"]);
    const id = await idOf("Instalaciones");
    const card = cards(html)[1]!;
    // Status never by colour alone: an icon and a text label.
    expect(card).toContain('<p class="review-status" data-state="pending"><img class="icon" src="/icons/pending.svg"');
    expect(card).toContain("<strong>Pendiente de revisión</strong>");
    expect(card).toContain(`<a class="button-primary" href="/flows/${id}" aria-label="Iniciar recorrido: Instalaciones">Iniciar recorrido</a>`);
    // The viewer's id is not repeated once per card.
    expect(html).not.toContain('id="review-status"');
  });

  it("shows a Standard user only the flows of their areas", async () => {
    await load();
    // Instalaciones moves to another area: published, but not Ana's.
    const ventas = (await env.DB.prepare("INSERT INTO areas (name, name_key) VALUES ('Ventas', 'ventas') RETURNING id").first<number>("id"))!;
    await env.DB.prepare("UPDATE flow_areas SET area_id = ? WHERE flow_id = ?").bind(ventas, await idOf("Instalaciones")).run();
    const ana = await signIn({ username: "ana", role: "standard", areaIds: [await devArea()] });
    expect(names(await home(ana))).toEqual(["Apertura de OT"]);
    // In both areas, both flows.
    const eva = await signIn({ username: "eva", role: "standard", areaIds: [await devArea(), ventas] });
    expect(names(await home(eva))).toEqual(["Apertura de OT", "Instalaciones"]);
  });

  it("says so when a Standard user's areas have no flows yet", async () => {
    await load();
    const outsider = await signIn({ username: "beto", role: "standard" });
    const html = await home(outsider);
    expect(cards(html)).toEqual([]);
    expect(html).toContain(NO_FLOWS_IN_AREAS);
  });

  it("leaves out flows never published, for the Board too", async () => {
    const draft = await createFlow(env.DB, "Borrador");
    if (!draft.ok) throw new Error(draft.error);
    const html = await home(await signIn());
    expect(cards(html)).toEqual([]);
    expect(html).toContain(NO_FLOWS);
  });

  it("follows the user's own progress on each flow", async () => {
    await load();
    const board = await signIn();
    const id = await idOf("Apertura de OT");
    await startTour(env.DB, board.id, id, new Date());
    let card = cards(await home(board))[0]!;
    expect(card).toContain("<strong>Recorrido en curso</strong>");
    expect(card).toContain(">Continuar recorrido</a>");

    const release = (await env.DB.prepare("SELECT id FROM releases WHERE flow_id = ?").bind(id).first<number>("id"))!;
    await env.DB.prepare("UPDATE tour_runs SET finished_at = ? WHERE user_id = ?").bind(new Date().toISOString(), board.id).run();
    await env.DB.prepare("INSERT INTO review_records (user_id, release_id, completed_at, duration_seconds) VALUES (?, ?, ?, ?)")
      .bind(board.id, release, "2026-11-16T15:00:00.000Z", 600)
      .run();
    card = cards(await home(board))[0]!;
    expect(card).toContain('src="/icons/done.svg"');
    expect(card).toContain("<strong>Revisado</strong>");
    expect(card).toContain("El 16 de noviembre de 2026.");
    expect(card).toContain(">Repetir recorrido</a>");
    // Someone else's progress is theirs.
    const leader = await signIn({ username: "lia", role: "leader" });
    expect(cards(await home(leader))[0]).toContain("<strong>Pendiente de revisión</strong>");
  });

  // SPEC §7: a tour left unfinished, by following a link or otherwise, stays
  // listed with the step it was on (phase 6.5).
  it("says which step an open tour was left on", async () => {
    await load();
    const board = await signIn();
    const id = await idOf("Apertura de OT");
    const t0 = Date.parse("2026-11-19T15:00:00.000Z");
    await startTour(env.DB, board.id, id, new Date(t0));
    let card = cards(await home(board))[0]!;
    // Just started: on the first step.
    expect(card).toContain('<p class="muted home-flow-step">Quedaste en «Apertura de OT».</p>');
    // Four steps on, at P5; then the decision P6, its «Interna» branch, P13.
    for (const [k, at] of ["P1", "P2", "P3", "P4", "P5"].entries()) {
      expect((await takeStep(env.DB, board.id, id, { at, action: "next" }, new Date(t0 + (k + 1) * 10_000))).ok).toBe(true);
    }
    expect((await takeStep(env.DB, board.id, id, { at: "P6", action: "choose", exit: 1 }, new Date(t0 + 70_000))).ok).toBe(true);
    card = cards(await home(board))[0]!;
    expect(card).toContain("Quedaste en «Instalaciones».");
    // The other card has no open tour, and says nothing of the kind.
    expect(cards(await home(board))[1]).not.toContain("home-flow-step");
    // Finished, the line goes.
    await env.DB.prepare("UPDATE tour_runs SET finished_at = ? WHERE user_id = ?").bind(new Date().toISOString(), board.id).run();
    expect(cards(await home(board))[0]).not.toContain("home-flow-step");
  });
});
