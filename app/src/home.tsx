import { Router, visibleFlows, type VisibleFlow } from "./access.tsx";
import { HOME } from "./login.tsx";
import { userOf } from "./session.ts";
import { StatusLine } from "./status.tsx";
import { reviewStatus, type ReviewStatus } from "./tour.ts";

// The home screen (SPEC §7; phase 4.3): where a user lands after signing
// in. The flows they see, each with its status and its next action. The
// Board tours like anyone, so it gets the same screen.
export const home = new Router();

export const NO_FLOWS_IN_AREAS = "Tus áreas todavía no tienen flujos asignados. Cuando la Junta directiva te asigne uno, aparecerá aquí.";
export const NO_FLOWS = "Todavía no hay flujos publicados.";

type Item = VisibleFlow & { status: ReviewStatus };

function FlowCard({ flow }: { flow: Item }) {
  const { action } = flow.status;
  return (
    <li class={`card home-flow flow-${flow.colour}`}>
      <h2 class="home-flow-name">
        <span class="flow-dot" aria-hidden="true"></span>
        {flow.name}
      </h2>
      {flow.objective && <p class="muted">{flow.objective}</p>}
      <StatusLine status={flow.status} />
      <a class="button-primary" href={`/flows/${flow.id}`} aria-label={`${action}: ${flow.name}`}>
        {action}
      </a>
    </li>
  );
}

home.get(HOME, "user", async (c) => {
  const user = userOf(c);
  const db = c.env.DB;
  const flows = await visibleFlows(db, user);
  const items = await Promise.all(flows.map(async (f): Promise<Item> => ({ ...f, status: await reviewStatus(db, user.id, f.id, f) })));
  return c.render(
    <>
      <h1 class="page-title">Hola, {user.fullName}</h1>
      {items.length ? (
        <ul class="home-flows" aria-label="Tus flujos">
          {items.map((f) => (
            <FlowCard flow={f} />
          ))}
        </ul>
      ) : (
        <p class="muted">{user.role === "standard" ? NO_FLOWS_IN_AREAS : NO_FLOWS}</p>
      )}
      {/* Stage 2: the user's valid certificates go here (§7). Not built. */}
    </>,
    { title: "Inicio" },
  );
});
