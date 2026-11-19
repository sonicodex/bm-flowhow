import { Router } from "./access.tsx";
import { userOf, type SessionUser } from "./session.ts";

// The progress report (SPEC §7, Progress report; phase 6.9). One row per
// person who gets certified and flow of theirs: Empleados with the flows of
// their areas, Leaders with every flow (§4). The Board is never a row: it
// is not certified. Deactivated accounts have no progress to follow and
// are left out. Stage 1 has the review columns only; the score and the
// certified flag come with stage 2.
//
// Scope, applied here and nowhere else: the Board gets every row; a Leader
// only the rows of people who share at least one area with them (§9).
export const report = new Router();

export const LEADER_WITHOUT_AREAS =
  "No tienes áreas asignadas, así que el reporte no muestra a nadie. Pide a la Junta directiva que te asigne las áreas que lideras.";
export const NOBODY_YET = "Todavía no hay a quién seguir: nadie de tu alcance tiene flujos publicados.";
export const NO_MATCH = "Ninguna fila cumple esos filtros.";

export type ReportRow = {
  userId: number;
  name: string;
  areas: { id: number; name: string }[];
  flowId: number;
  flow: string;
  version: string;
  // Reviewed under the same rule as the home screen: a review of a release
  // with the latest's major version (§8).
  reviewed: boolean;
  reviewedAt: string | null;
  // The version that was reviewed, when it is not the latest; also the
  // older major one when the latest asks for a new review.
  reviewedVersion: string | null;
  seconds: number | null;
};

const version = (r: { major: number; minor: number }) => `${r.major}.${r.minor}`;

export async function reportRows(db: D1Database, viewer: Pick<SessionUser, "id" | "role">): Promise<ReportRow[]> {
  const [people, memberships, flows, flowAreas, reviews] = await Promise.all([
    db
      .prepare(
        `SELECT u.id, u.full_name, u.role FROM users u
         WHERE u.is_active = 1 AND u.role IN ('standard', 'leader')
           AND (?1 = 'board' OR EXISTS (
             SELECT 1 FROM user_areas mine JOIN user_areas theirs ON theirs.area_id = mine.area_id
             WHERE mine.user_id = ?2 AND theirs.user_id = u.id))`,
      )
      .bind(viewer.role, viewer.id)
      .all<{ id: number; full_name: string; role: "standard" | "leader" }>(),
    db
      .prepare("SELECT ua.user_id, a.id, a.name FROM user_areas ua JOIN areas a ON a.id = ua.area_id ORDER BY a.name_key")
      .all<{ user_id: number; id: number; name: string }>(),
    db
      .prepare(
        `SELECT f.id, f.name, rel.major, rel.minor FROM flows f
         JOIN releases rel ON rel.id = (
           SELECT id FROM releases WHERE flow_id = f.id ORDER BY major DESC, minor DESC LIMIT 1)
         ORDER BY f.name_key`,
      )
      .all<{ id: number; name: string; major: number; minor: number }>(),
    db.prepare("SELECT flow_id, area_id FROM flow_areas").all<{ flow_id: number; area_id: number }>(),
    // The newest release each person reviewed of each flow, and for it the
    // first review: a repeated tour never replaces it (as reviewStatus).
    db
      .prepare(
        `SELECT rr.user_id, rel.flow_id, rel.major, rel.minor, rr.completed_at, rr.duration_seconds
         FROM review_records rr JOIN releases rel ON rel.id = rr.release_id
         ORDER BY rel.major DESC, rel.minor DESC, rr.completed_at ASC`,
      )
      .all<{ user_id: number; flow_id: number; major: number; minor: number; completed_at: string; duration_seconds: number }>(),
  ]);

  const areasOf = new Map<number, { id: number; name: string }[]>();
  for (const m of memberships.results) {
    const list = areasOf.get(m.user_id) ?? [];
    list.push({ id: m.id, name: m.name });
    areasOf.set(m.user_id, list);
  }
  const flowsOfArea = new Map<number, Set<number>>();
  for (const fa of flowAreas.results) {
    const set = flowsOfArea.get(fa.area_id) ?? new Set<number>();
    set.add(fa.flow_id);
    flowsOfArea.set(fa.area_id, set);
  }
  const review = new Map<string, (typeof reviews.results)[number]>();
  for (const r of reviews.results) {
    const key = `${r.user_id}:${r.flow_id}`;
    if (!review.has(key)) review.set(key, r);
  }

  const rows: ReportRow[] = [];
  for (const p of people.results) {
    const areas = areasOf.get(p.id) ?? [];
    // Leaders see, and are certified on, every flow; Empleados the flows of
    // their areas (§4).
    const assigned =
      p.role === "leader" ? flows.results : flows.results.filter((f) => areas.some((a) => flowsOfArea.get(a.id)?.has(f.id)));
    for (const f of assigned) {
      const r = review.get(`${p.id}:${f.id}`);
      const reviewed = !!r && r.major === f.major;
      rows.push({
        userId: p.id,
        name: p.full_name,
        areas,
        flowId: f.id,
        flow: f.name,
        version: version(f),
        reviewed,
        reviewedAt: reviewed ? r!.completed_at : null,
        reviewedVersion: r && version(r) !== version(f) ? version(r) : null,
        seconds: reviewed ? r!.duration_seconds : null,
      });
    }
  }
  return rows;
}

// ---- Filters and order, all in the address, so a filtered report can be
// bookmarked and works without JavaScript. ----

export type ReportQuery = {
  area: number | null;
  flow: number | null;
  reviewed: "si" | "no" | null;
  sort: SortKey;
  desc: boolean;
};
const SORT_KEYS = ["empleado", "area", "flujo", "revisado", "tiempo"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const id = (v: string | undefined) => (v && /^[1-9][0-9]{0,9}$/.test(v) ? Number(v) : null);

export function readQuery(q: Record<string, string | undefined>): ReportQuery {
  return {
    area: id(q.area),
    flow: id(q.flujo),
    reviewed: q.revisado === "si" || q.revisado === "no" ? q.revisado : null,
    sort: (SORT_KEYS as readonly string[]).includes(q.orden ?? "") ? (q.orden as SortKey) : "empleado",
    desc: q.dir === "desc",
  };
}

const collator = new Intl.Collator("es-CO", { sensitivity: "base", numeric: true });

export function applyQuery(rows: ReportRow[], q: ReportQuery): ReportRow[] {
  const kept = rows.filter(
    (r) =>
      (q.area === null || r.areas.some((a) => a.id === q.area)) &&
      (q.flow === null || r.flowId === q.flow) &&
      (q.reviewed === null || r.reviewed === (q.reviewed === "si")),
  );
  const byName = (a: ReportRow, b: ReportRow) => collator.compare(a.name, b.name) || a.userId - b.userId || collator.compare(a.flow, b.flow);
  // Empty values (no area, not reviewed) go last whichever the direction.
  const key: Record<SortKey, (a: ReportRow, b: ReportRow) => number | null> = {
    empleado: (a, b) => collator.compare(a.name, b.name),
    area: (a, b) => (!a.areas.length || !b.areas.length ? null : collator.compare(areaText(a), areaText(b))),
    flujo: (a, b) => collator.compare(a.flow, b.flow),
    revisado: (a, b) => (!a.reviewedAt || !b.reviewedAt ? null : a.reviewedAt.localeCompare(b.reviewedAt)),
    tiempo: (a, b) => (a.seconds === null || b.seconds === null ? null : a.seconds - b.seconds),
  };
  const empty: Record<SortKey, (r: ReportRow) => boolean> = {
    empleado: () => false,
    area: (r) => !r.areas.length,
    flujo: () => false,
    revisado: (r) => !r.reviewedAt,
    tiempo: (r) => r.seconds === null,
  };
  return kept.sort((a, b) => {
    const ea = empty[q.sort](a);
    const eb = empty[q.sort](b);
    if (ea !== eb) return ea ? 1 : -1;
    const k = ea ? 0 : (key[q.sort](a, b) ?? 0);
    return (q.desc ? -k : k) || byName(a, b);
  });
}

const areaText = (r: ReportRow) => r.areas.map((a) => a.name).join(", ");

const longDate = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" });

export function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  if (m) return s ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

// ---- Page ----

const href = (q: ReportQuery, change: Partial<ReportQuery>) => {
  const n = { ...q, ...change };
  const p = new URLSearchParams();
  if (n.area !== null) p.set("area", String(n.area));
  if (n.flow !== null) p.set("flujo", String(n.flow));
  if (n.reviewed !== null) p.set("revisado", n.reviewed);
  if (n.sort !== "empleado") p.set("orden", n.sort);
  if (n.desc) p.set("dir", "desc");
  const s = p.toString();
  return s ? `/report?${s}` : "/report";
};

function SortHeader({ q, sort, label }: { q: ReportQuery; sort: SortKey; label: string }) {
  const active = q.sort === sort;
  const next = active ? !q.desc : false;
  return (
    <th scope="col" aria-sort={active ? (q.desc ? "descending" : "ascending") : undefined}>
      <a href={href(q, { sort, desc: next })} class="sort-link">
        {label}
        {active && <span aria-hidden="true">{q.desc ? " ↓" : " ↑"}</span>}
      </a>
    </th>
  );
}

function Filters({ q, rows }: { q: ReportQuery; rows: ReportRow[] }) {
  // Only the areas and flows that appear in this person's report.
  const areas = [...new Map(rows.flatMap((r) => r.areas).map((a) => [a.id, a])).values()].sort((a, b) => collator.compare(a.name, b.name));
  const flows = [...new Map(rows.map((r) => [r.flowId, r.flow])).entries()].sort((a, b) => collator.compare(a[1], b[1]));
  return (
    <form method="get" action="/report" class="report-filters">
      <label>
        Área
        <select name="area">
          <option value="">Todas</option>
          {areas.map((a) => (
            <option value={String(a.id)} selected={q.area === a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Flujo
        <select name="flujo">
          <option value="">Todos</option>
          {flows.map(([fid, name]) => (
            <option value={String(fid)} selected={q.flow === fid}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Revisado
        <select name="revisado">
          <option value="">Todos</option>
          <option value="si" selected={q.reviewed === "si"}>
            Sí
          </option>
          <option value="no" selected={q.reviewed === "no"}>
            No
          </option>
        </select>
      </label>
      {q.sort !== "empleado" && <input type="hidden" name="orden" value={q.sort} />}
      {q.desc && <input type="hidden" name="dir" value="desc" />}
      {/* The filters apply as they change (public/js/report.js; SPEC §9).
          Without JavaScript, the button. */}
      <noscript>
        <button type="submit" class="button-secondary">
          Filtrar
        </button>
      </noscript>
      <span id="report-clear">
        {(q.area !== null || q.flow !== null || q.reviewed !== null) && <a href={href(q, { area: null, flow: null, reviewed: null })}>Quitar filtros</a>}
      </span>
    </form>
  );
}

function ReviewedCell({ row }: { row: ReportRow }) {
  if (row.reviewed) {
    return (
      <td>
        <strong>Sí</strong> · {longDate.format(new Date(row.reviewedAt!))}
        {row.reviewedVersion && <span class="muted">, en la versión {row.reviewedVersion}</span>}
      </td>
    );
  }
  return (
    <td>
      <strong>No</strong>
      {row.reviewedVersion && <span class="muted"> · revisó la versión {row.reviewedVersion}</span>}
    </td>
  );
}

function ReportPage({ q, all, shown, message }: { q: ReportQuery; all: ReportRow[]; shown: ReportRow[]; message: string | null }) {
  return (
    <>
      <h1 class="page-title">Reporte de avance</h1>
      <p class="muted admin-subtitle">Quién revisó cada flujo, cuándo y en cuánto tiempo.</p>
      {message ? (
        <div class="card admin-empty">
          <p>{message}</p>
        </div>
      ) : (
        <>
          <Filters q={q} rows={all} />
          <p class="muted report-count" id="report-count" role="status">
            {shown.length === 1 ? "1 fila" : `${shown.length} filas`}
            {shown.length !== all.length && ` de ${all.length}`}
          </p>
          <div id="report-results">
          {shown.length ? (
            <div class="table-frame">
              <div class="table-scroll" data-table-scroll>
                <table class="admin-table report-table">
                  <thead>
                    <tr>
                      <SortHeader q={q} sort="empleado" label="Nombre" />
                      <SortHeader q={q} sort="area" label="Área" />
                      <SortHeader q={q} sort="flujo" label="Flujo" />
                      <th scope="col">Versión</th>
                      <SortHeader q={q} sort="revisado" label="Revisado" />
                      <SortHeader q={q} sort="tiempo" label="Tiempo de revisión" />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr>
                        <td>{r.name}</td>
                        <td>{areaText(r) || <span class="muted">Sin área</span>}</td>
                        <td>{r.flow}</td>
                        <td>{r.version}</td>
                        <ReviewedCell row={r} />
                        <td>{r.seconds === null ? <span class="muted">—</span> : duration(r.seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <script type="module" src="/js/table-scroll.js"></script>
            </div>
          ) : (
            <div class="card admin-empty">
              <p>{NO_MATCH}</p>
            </div>
          )}
          </div>
          <script type="module" src="/js/report.js"></script>
        </>
      )}
    </>
  );
}

report.get("/report", "report", async (c) => {
  const user = userOf(c);
  const db = c.env.DB;
  const q = readQuery(c.req.query());
  // A Leader without areas shares one with nobody: say why the report is
  // empty, rather than show an empty table (owner's decision, phase 6.9).
  if (user.role === "leader") {
    const own = await db.prepare("SELECT 1 FROM user_areas WHERE user_id = ? LIMIT 1").bind(user.id).first();
    if (!own) return c.render(<ReportPage q={q} all={[]} shown={[]} message={LEADER_WITHOUT_AREAS} />, { title: "Reporte de avance" });
  }
  const all = await reportRows(db, user);
  const shown = applyQuery(all, q);
  return c.render(<ReportPage q={q} all={all} shown={shown} message={all.length ? null : NOBODY_YET} />, { title: "Reporte de avance" });
});
