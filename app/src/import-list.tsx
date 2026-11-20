import { raw } from "hono/html";
import { scriptJson } from "./layout.tsx";
import { nameKey } from "./names.ts";

// The importers of areas and users (SPEC §4 «Importing areas, users and
// flows»; phase 7). One file per thing. The browser only reads the paste or
// the .xlsx into a table of text cells (public/js/import-list.js); the
// server reads its columns, checks every row, answers a review, and writes
// nothing until the admin accepts, when it checks everything again.
//
// The review has the shape of the flow importer's: the row errors first,
// and what would come in below; while a row is wrong nothing can be
// imported.

export type Table = string[][];
export type RowError = { row: number | null; message: string };
// What a review or a result lists: a heading, an optional line, and a table.
export type Group = { title: string; note?: string; columns: string[]; rows: string[][] };
// A file the browser builds from the result (the users' passwords): notes
// above, then the table.
export type Download = { name: string; sheet: string; notes: string[]; columns: string[]; rows: string[][] };

export type Review = { status: "review"; summary: string; errors: RowError[]; warnings: string[]; groups: Group[] };
export type Invalid = { status: "invalid"; error: string };
export type Saved = { status: "saved"; title: string; message: string; warnings: string[]; groups: Group[]; download?: Download };

// Far above a company of fifty, and small enough to read in one request.
const MAX_ROWS = 2000;
const MAX_COLS = 40;
const MAX_CELL = 1000;

const invalid = (error: string): Invalid => ({ status: "invalid", error });

// The body the browser sends: { table: string[][] }. Anything else did not
// come from our page.
export function readTable(body: unknown): { ok: true; table: Table } | { ok: false; answer: Invalid } {
  const fail = (why: string) => ({ ok: false as const, answer: invalid(`La tabla no tiene la forma esperada: ${why}`) });
  const table = typeof body === "object" && body !== null ? (body as Record<string, unknown>).table : undefined;
  if (!Array.isArray(table)) return fail("falta la lista de filas.");
  if (table.length > MAX_ROWS) return fail(`tiene más de ${MAX_ROWS} filas.`);
  for (const row of table) {
    if (!Array.isArray(row) || row.length > MAX_COLS) return fail("una fila no es una lista de celdas.");
    if (!row.every((cell) => typeof cell === "string" && cell.length <= MAX_CELL)) return fail("una celda no es texto.");
  }
  return { ok: true, table: table as Table };
}

export type Column<K extends string> = { key: K; label: string };
export type Line<K extends string> = { row: number; cells: Record<K, string> };

// The first row names the columns: every one of `columns`, in any order,
// and nothing else. Headers are compared without case or accents. Empty
// rows are skipped (Excel leaves them at the end); every other row keeps
// its number in the file, the header being row 1.
export function readColumns<K extends string>(table: Table, columns: Column<K>[]): { ok: true; lines: Line<K>[] } | { ok: false; answer: Invalid } {
  const expected = columns.map((c) => `«${c.label}»`).join(", ");
  const blank = (row: string[]) => row.every((cell) => cell.trim() === "");
  const header = table[0];
  if (!header || blank(header)) return { ok: false, answer: invalid(`La primera fila tiene que traer los encabezados: ${expected}.`) };
  const at = new Map<K, number>();
  for (const [i, text] of header.entries()) {
    const label = text.trim();
    if (!label) {
      // An unnamed column is fine only when it is empty all the way down.
      if (table.some((row) => (row[i] ?? "").trim() !== "")) {
        return { ok: false, answer: invalid(`La columna ${i + 1} tiene datos pero no tiene encabezado. Las columnas son ${expected}.`) };
      }
      continue;
    }
    const column = columns.find((c) => nameKey(c.label) === nameKey(label));
    if (!column) return { ok: false, answer: invalid(`No se reconoce la columna «${label}». Las columnas son ${expected}.`) };
    if (at.has(column.key)) return { ok: false, answer: invalid(`La columna «${column.label}» está dos veces.`) };
    at.set(column.key, i);
  }
  const missing = columns.filter((c) => !at.has(c.key)).map((c) => `«${c.label}»`);
  if (missing.length) return { ok: false, answer: invalid(`Falta${missing.length > 1 ? "n las columnas" : " la columna"} ${missing.join(", ")}.`) };
  const lines: Line<K>[] = [];
  for (const [i, row] of table.entries()) {
    if (i === 0 || blank(row)) continue;
    const cells = {} as Record<K, string>;
    for (const c of columns) cells[c.key] = (row[at.get(c.key)!] ?? "").trim();
    lines.push({ row: i + 1, cells });
  }
  if (!lines.length) return { ok: false, answer: invalid("No hay ninguna fila debajo de los encabezados.") };
  return { ok: true, lines };
}

export const rowError = (row: number, message: string): RowError => ({ row, message: `Fila ${row}: ${message}` });

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// What the page hands to public/js/import-list.js.
export type ImportConfig = {
  // The sheet read from an .xlsx, and the template's.
  sheet: string;
  reviewUrl: string;
  applyUrl: string;
  template: { name: string; columns: string[]; widths: number[]; lists?: { col: number; values: string[]; title: string; message: string }[] };
  // Where the finished import leads: the list, or the first-use wizard.
  done: { href: string; label: string };
  // Said on the result while it shows something that is never shown again.
  keepWarning?: string;
};

// The importer's page: the way back, what it does, the template, the file
// or the paste, then the review in place of all that.
export function ImportPage(props: { back: { href: string; label: string }; title: string; intro: string; columnsNote: string; config: ImportConfig }) {
  return (
    <>
      <p class="admin-back">
        <a href={props.back.href}>← {props.back.label}</a>
      </p>
      <h1 class="page-title">{props.title}</h1>
      <section class="card editor-import import-list" id="import-box" aria-labelledby="import-title">
        <h2 id="import-title">Desde Excel</h2>
        <p>{props.intro}</p>
        <p class="muted">{props.columnsNote}</p>
        <p class="editor-template">
          ¿Vas a empezar en Excel?{" "}
          <button type="button" class="button-link" data-template>
            Descarga la plantilla
          </button>
          .
        </p>
        <label for="import-file">Un archivo .xlsx (se lee su hoja «{props.config.sheet}»)</label>
        <input id="import-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
        <label for="import-paste">O las celdas copiadas de Excel, con la fila de encabezados</label>
        <textarea id="import-paste" rows={6} spellcheck={false}></textarea>
        <ul class="plain-list form-error" role="alert" id="import-errors" hidden></ul>
        <div class="editor-message-actions">
          <button type="button" class="button-primary" data-import-review>
            Revisar
          </button>
          <a class="button-secondary" href={props.back.href}>
            Cancelar
          </a>
        </div>
      </section>
      <section class="editor-review" id="import-review" aria-labelledby="review-title" hidden></section>
      <script type="application/json" id="import-data">
        {raw(scriptJson(props.config))}
      </script>
      <script type="module" src="/js/import-list.js"></script>
    </>
  );
}

// `?desde=configuracion`: opened from the first-use wizard (7.3), which the
// finished import leads back to.
export const FROM_SETUP = "configuracion";
export const SETUP_DONE = { href: "/setup", label: "Volver a la configuración inicial" };
