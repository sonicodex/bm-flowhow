import { Router } from "./access.tsx";
import { FROM_SETUP, plural } from "./import-list.tsx";
import { userOf } from "./session.ts";

// The first-use wizard (SPEC §4 «First-use wizard»; phase 7.3): areas, then
// users, then flows, each step the matching importer, each one skippable.
// It is a path through what already exists, not a second way of creating
// things. Nothing about it is stored (owner's decision): which step it opens
// on comes from the data, so leaving and coming back resumes it.
export const setup = new Router();

export type SetupCounts = { areas: number; others: number; flows: number };

// What the app has. `others`: accounts besides the one looking, since the
// first Board member is there from the start.
export async function setupCounts(db: D1Database, userId: number): Promise<SetupCounts> {
  const row = await db
    .prepare(
      `SELECT (SELECT count(*) FROM areas) AS areas,
         (SELECT count(*) FROM users WHERE id <> ?) AS others,
         (SELECT count(*) FROM flows) AS flows`,
    )
    .bind(userId)
    .first<SetupCounts>();
  return row!;
}

type StepKey = "areas" | "usuarios" | "flujos";
type Step = {
  key: StepKey;
  title: string;
  what: string;
  has: (n: SetupCounts) => string | null;
  none: string;
  action: { href: string; label: string };
  also: { href: string; label: string };
};

const STEPS: Step[] = [
  {
    key: "areas",
    title: "Áreas",
    what: "Las áreas agrupan a los Empleados y deciden qué flujos ve cada uno. Van primero porque los usuarios y los flujos se asignan a ellas.",
    has: (n) => (n.areas ? plural(n.areas, "área", "áreas") : null),
    none: "Todavía no hay ninguna.",
    action: { href: `/areas/import?desde=${FROM_SETUP}`, label: "Importar áreas" },
    also: { href: "/areas/new", label: "crear una a mano" },
  },
  {
    key: "usuarios",
    title: "Usuarios",
    what: "Las cuentas de quienes van a entrar, con su rol y sus áreas. Cada una recibe una contraseña temporal que se cambia en el primer ingreso.",
    has: (n) => (n.others ? plural(n.others, "cuenta además de la tuya", "cuentas además de la tuya") : null),
    none: "Todavía no hay ninguna además de la tuya.",
    action: { href: `/users/import?desde=${FROM_SETUP}`, label: "Importar usuarios" },
    also: { href: "/users/new", label: "crear una a mano" },
  },
  {
    key: "flujos",
    title: "Flujos",
    what: "Cada flujo se crea con su nombre; en su editor, «Importar desde Excel» trae sus pasos. Las categorías y sus valores salen de ese mismo archivo.",
    has: (n) => (n.flows ? plural(n.flows, "flujo", "flujos") : null),
    none: "Todavía no hay ninguno.",
    action: { href: "/flows/new", label: "Crear un flujo" },
    also: { href: "/flows", label: "ver los flujos" },
  },
];

const stepHref = (key: StepKey) => `/setup?paso=${key}`;

function SetupPage({ counts, current }: { counts: SetupCounts; current: StepKey | null }) {
  return (
    <>
      <h1 class="page-title">Configuración inicial</h1>
      <p class="setup-intro">
        Trae la empresa a FlowHow en tres pasos. Cada uno se puede saltar y retomar: vuelve aquí cuando tengas lo que falta. Todo lo que hace este
        asistente también se hace desde Áreas, Usuarios y Flujos.
      </p>
      {current === null && <p role="status">Ya hay áreas, usuarios y flujos. Desde aquí puedes volver a cualquier paso.</p>}
      <ol class="setup-steps">
        {STEPS.map((step, i) => {
          const has = step.has(counts);
          const open = step.key === current;
          const next = STEPS[i + 1];
          return (
            <li class={`card setup-step${open ? " is-current" : ""}`} aria-current={open ? "step" : undefined}>
              <h2>
                {i + 1}. {step.title}
              </h2>
              <p class={has ? "setup-has" : "muted setup-has"}>{has ? `Ya hay ${has}.` : step.none}</p>
              {open ? (
                <>
                  <p>{step.what}</p>
                  <div class="editor-message-actions">
                    <a class="button-primary" href={step.action.href}>
                      {step.action.label}
                    </a>
                    <a class="button-secondary" href={next ? stepHref(next.key) : "/home"}>
                      {next ? "Saltar este paso" : "Terminar por ahora"}
                    </a>
                  </div>
                  <p class="muted">
                    También puedes <a href={step.also.href}>{step.also.label}</a>.
                  </p>
                </>
              ) : (
                <p>
                  <a href={stepHref(step.key)}>Ir a este paso</a>
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

// The step asked for, or the first one with nothing yet.
setup.get("/setup", "setup", async (c) => {
  const counts = await setupCounts(c.env.DB, userOf(c).id);
  const asked = STEPS.find((s) => s.key === c.req.query("paso"));
  const empty = STEPS.find((s) => s.has(counts) === null);
  return c.render(<SetupPage counts={counts} current={(asked ?? empty)?.key ?? null} />, { title: "Configuración inicial" });
});
