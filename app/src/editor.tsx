import { Router } from "./access.tsx";
import { AdminList, RowActions, yesNo } from "./admin.tsx";
import { listSavePoints, restoreSavePoint, saveDraft, type SaveAnswer, type SavePoint } from "./draft.ts";
import { getFlow } from "./flows.ts";
import type { AppEnv } from "./session.ts";
import type { Context } from "hono";

// The editor's routes (SPEC §6, §8; phase 5). Editors only. 5.2: saving the
// draft, and its save points. The grid screen that uses them is 5.3.
export const editor = new Router();

const flowOf = async (c: Context<AppEnv>) => getFlow(c.env.DB, Number(c.req.param("id")));

// Date and time to the second, in Bogotá: an editor may save several times
// within a minute, and each point must be told apart.
const when = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "medium" });
export const savedAt = (iso: string) => when.format(new Date(iso));

const STATUS: Record<SaveAnswer["status"], 200 | 400 | 409 | 422> = { saved: 200, confirm: 200, invalid: 400, blocked: 422, conflict: 409 };

// The grid's save, as JSON: `{grid, base, accepted?}` (src/draft.ts).
editor.post("/:id{[0-9]+}/draft", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = null;
  }
  const answer = await saveDraft(c.env.DB, flow.id, body, c.get("user")!.id);
  return c.json(answer, STATUS[answer.status]);
});

function SavePointsPage({ flow, points, notice }: { flow: { id: number; name: string }; points: SavePoint[]; notice?: string }) {
  return (
    <AdminList
      back={{ href: "/flows", label: "Volver a flujos" }}
      title={`Puntos guardados: ${flow.name}`}
      note="Volver a un punto pone su contenido en el borrador. Los demás puntos se quedan, también los posteriores. Al publicar se borran todos."
      notice={notice}
      columns={[{ label: "Guardado" }, { label: "Por" }, { label: "Pasos", numeric: true }, { label: "Es el borrador actual" }]}
      empty={{
        purpose: "Cada vez que guardas el borrador queda aquí un punto al que puedes volver.",
        howToAdd: "Todavía no hay ninguno: aparecen al guardar desde el editor o al importar.",
      }}
      rows={points.map((p) => (
        <tr>
          <td>{savedAt(p.createdAt)}</td>
          <td>{p.by ?? "—"}</td>
          <td class="num">{p.steps}</td>
          <td>{yesNo(p.current)}</td>
          <RowActions>
            {!p.current && (
              <form method="post" action={`/flows/${flow.id}/save-points/${p.id}/restore`}>
                <button type="submit" class="button-link" aria-label={`Volver al punto del ${savedAt(p.createdAt)}`}>
                  Volver a este punto
                </button>
              </form>
            )}
          </RowActions>
        </tr>
      ))}
    />
  );
}

editor.get("/:id{[0-9]+}/save-points", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const points = await listSavePoints(c.env.DB, flow.id);
  const back = points.find((p) => String(p.id) === c.req.query("vuelta"));
  // No final period: the time already ends in one ("p. m.").
  const notice = back && `El borrador volvió al punto del ${savedAt(back.createdAt)}`;
  return c.render(<SavePointsPage flow={flow} points={points} notice={notice} />, { title: `Puntos guardados: ${flow.name}` });
});

editor.post("/:id{[0-9]+}/save-points/:point{[0-9]+}/restore", "editor", async (c) => {
  const flow = await flowOf(c);
  if (!flow) return c.notFound();
  const point = Number(c.req.param("point"));
  if (!(await restoreSavePoint(c.env.DB, flow.id, point, c.get("user")!.id))) return c.notFound();
  return c.redirect(`/flows/${flow.id}/save-points?vuelta=${point}`, 303);
});
